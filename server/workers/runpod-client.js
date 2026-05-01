import { logger } from '../logger.js';
import { recordHandlerVersion } from '../replica-drift.js';

// RunPod serverless adapter. The wire format (progress / result_chunk /
// result / error frames) matches the local Python worker exactly so
// callers don't have to care which backend served the request. Treat
// this file as the contract between Node and the GPU side; if you
// change a frame shape here, you change it in handler.py too.
//
// Two modes, picked at request time from env:
//   • Single endpoint (legacy `RUNPOD_ENDPOINT_URL`). The original
//     deployment shape. Still works, ships traffic to one region.
//   • Multi-region race (`RUNPOD_ENDPOINT_URLS`, comma-separated).
//     POST `/run` to every endpoint in parallel, watch each
//     `/stream/<id>`, stick with whichever region's worker actually
//     picks up the job (first IN_PROGRESS flip), cancel the losers.
//     Costs ~2× the cheap `/run` POSTs but only one GPU run, and
//     buys us back the queue-wait time on the loser region.
//     Telemetry surfaces in /admin → Regions tab.
//
// Quick examples:
//   RUNPOD_ENDPOINT_URL  = https://api.runpod.ai/v2/<us-id>
//   RUNPOD_ENDPOINT_URLS = https://api.runpod.ai/v2/<us-id>,https://api.runpod.ai/v2/<ro-id>
//   RUNPOD_API_KEY       = <bearer token>   ← account-wide; same key authenticates every region.
//
// If a region is freshly provisioned and has not seen weights yet,
// `RUNPOD_FORCE_WARMUP=1` routes the first job after server boot to
// the LAST endpoint in URLS only (no race). One job warms the volume,
// then racing resumes. The flag re-arms on app restart, so it's safe
// to leave permanently set; the cost is at most one un-raced job per
// DO redeploy.

const POLL_INTERVAL_MS  = 1_500;
// Cold-start TRELLIS is genuinely slow: pulling 2.5GB of safetensors plus
// dinov2 (1.1GB) and u2net (176MB) on first invocation, then constructing
// 4 decoders before the first frame. We've measured ~8 min end-to-end on a
// fresh worker. Subsequent warm invocations are ~30-60s. Pick 12 min so a
// queued job that has to spin up a brand-new worker still completes.
const POLL_MAX_WAIT_MS  = 720_000;
const REQUEST_TIMEOUT_MS = 30_000;

// ── Endpoint discovery ──────────────────────────────────────────────

function getEndpoints() {
  if (process.env.RUNPOD_ENDPOINT_URLS) {
    return process.env.RUNPOD_ENDPOINT_URLS
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map(trimSlash);
  }
  if (process.env.RUNPOD_ENDPOINT_URL) {
    return [trimSlash(process.env.RUNPOD_ENDPOINT_URL)];
  }
  return [];
}

export function runpodEnabled() {
  return getEndpoints().length > 0 && !!process.env.RUNPOD_API_KEY;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

// ── Force-warmup flag ───────────────────────────────────────────────
// When `RUNPOD_FORCE_WARMUP=1` is set on DO, the FIRST generation
// request after this server boot is routed to the LAST endpoint in
// RUNPOD_ENDPOINT_URLS only (no race). That endpoint is assumed to be
// the cold one needing weights downloaded into its network volume.
// Once it completes successfully, the flag is consumed in memory and
// every subsequent request races all configured endpoints normally.
//
// On app restart the flag re-arms (since memory resets) — if the cold
// endpoint is already warm by then, the next request just runs there
// quickly and racing resumes after one job. Leave the env var set
// indefinitely; the cost is at most one non-raced job per restart.
let _warmupConsumed = false;

// ── Telemetry — exposed via getRunpodTelemetry() for /admin ─────────

const _telemetry = new Map();

function bumpStat(url, key, value) {
  let stat = _telemetry.get(url);
  if (!stat) {
    stat = {
      submits: 0, wins: 0, losses: 0, errors: 0,
      lastWinAt: null, lastWinLatencyMs: null, lastErrorAt: null,
    };
    _telemetry.set(url, stat);
  }
  if (key === 'lastWinAt' || key === 'lastWinLatencyMs' || key === 'lastErrorAt') {
    stat[key] = value;
  } else {
    stat[key] = (stat[key] || 0) + 1;
  }
}

export function getRunpodTelemetry() {
  const out = [];
  for (const [url, stat] of _telemetry) {
    out.push({ url, id: url.split('/').pop(), ...stat });
  }
  return out;
}

// Boot-time visibility. Logs the resolved endpoint order, count, and
// the warmup latch state so an operator who's reading DO logs can tell
// at a glance which region is "first" (tie-break winner) and whether
// the next request will be a forced-warmup (single-region) or a real
// race. Without this you have to grep /admin telemetry to figure out
// why one region keeps winning. Call once on boot.
export function logRunpodConfig() {
  const endpoints = getEndpoints();
  if (endpoints.length === 0) {
    logger.info({ msg: 'runpod.config', mode: 'disabled', note: 'no RUNPOD_ENDPOINT_URL(S) set' });
    return;
  }
  const warmupArmed = process.env.RUNPOD_FORCE_WARMUP === '1' && endpoints.length > 1;
  logger.info({
    msg: 'runpod.config',
    mode: endpoints.length === 1 ? 'single' : 'race',
    endpoints: endpoints.map((url, i) => ({
      position: i,
      id: url.split('/').pop(),
      role: i === 0 ? 'tie_break_winner' : (i === endpoints.length - 1 ? 'warmup_target' : 'middle'),
    })),
    force_warmup: warmupArmed,
    next_request: warmupArmed
      ? `forced to ${endpoints[endpoints.length - 1].split('/').pop()} (one-shot, then races resume)`
      : 'races all endpoints',
  });
}

// ── Public entry point: signature unchanged from the single-endpoint era

export async function runRunpod({ socket, commandId, imageBuf, settings }) {
  const endpoints = getEndpoints();
  if (endpoints.length === 0) throw new Error('runpod_not_configured');
  const input = buildInput({ imageBuf, settings });

  // First-run warmup override. When RUNPOD_FORCE_WARMUP=1 is set and
  // we haven't yet completed a generation in this process, force the
  // job to the LAST configured endpoint (the new region) so its
  // network volume populates with TRELLIS weights. Subsequent requests
  // race normally.
  const wantsWarmup = process.env.RUNPOD_FORCE_WARMUP === '1' && !_warmupConsumed && endpoints.length > 1;
  const targetEndpoints = wantsWarmup ? [endpoints[endpoints.length - 1]] : endpoints;
  if (wantsWarmup) {
    logger.info({
      msg: 'runpod.warmup_routing',
      endpoint: targetEndpoints[0],
      note: 'forcing first-job warmup; racing resumes after this completes',
    });
  }

  if (targetEndpoints.length === 1) {
    const base = targetEndpoints[0];
    bumpStat(base, 'submits');
    try {
      const job = await submitJob(base, input);
      const stl = await streamAndAssemble({
        socket, commandId, base, jobId: job.id,
        deadline: Date.now() + POLL_MAX_WAIT_MS,
      });
      if (wantsWarmup) {
        _warmupConsumed = true;
        logger.info({ msg: 'runpod.warmup_complete', endpoint: base });
      }
      return stl;
    } catch (err) {
      bumpStat(base, 'errors');
      bumpStat(base, 'lastErrorAt', new Date().toISOString());
      throw err;
    }
  }

  return raceAndStream({ socket, commandId, endpoints: targetEndpoints, input });
}

// ── Race logic (Option A): submit to N, stick with first to start ───

async function raceAndStream({ socket, commandId, endpoints, input }) {
  const auth = authHeaders();
  const startedAt = Date.now();
  const deadline = startedAt + POLL_MAX_WAIT_MS;

  // Submit to every endpoint in parallel. Some may 5xx or 429 — that's fine.
  const submits = await Promise.allSettled(endpoints.map(async (base) => {
    bumpStat(base, 'submits');
    const job = await submitJob(base, input);
    return { base, jobId: job.id };
  }));

  const accepted = [];
  for (let i = 0; i < submits.length; i++) {
    if (submits[i].status === 'fulfilled') {
      accepted.push(submits[i].value);
    } else {
      bumpStat(endpoints[i], 'errors');
      bumpStat(endpoints[i], 'lastErrorAt', new Date().toISOString());
      logger.warn({
        msg: 'runpod.race_submit_failed',
        endpoint: endpoints[i],
        err: submits[i].reason?.message,
      });
    }
  }
  if (accepted.length === 0) {
    throw new Error('runpod_all_endpoints_failed_to_start');
  }
  logger.info({
    msg: 'runpod.race_started',
    endpoints: accepted.map((a) => ({ base: a.base, jobId: a.jobId })),
  });

  // Poll all accepted endpoints. First one to flip IN_PROGRESS or
  // emit any frames is the winner — its worker has actually picked up
  // the job (vs. sitting in queue waiting for a worker).
  //
  // Strike policy: a single transient /stream poll failure (RunPod
  // gateway hiccup, momentary 5xx, network blip) USED to permanently
  // bench the endpoint for the rest of the race, which made one bad
  // poll look like a region-wide outage and handed the win to the
  // other region by default. We now tolerate POLL_STRIKE_LIMIT-1
  // consecutive failures before benching. Any successful poll resets
  // the counter. Terminal RunPod statuses (FAILED / CANCELLED /
  // TIMED_OUT) still bench immediately — those aren't transient.
  const POLL_STRIKE_LIMIT = 2;
  let winner = null;
  let initialFrames = [];
  const benchedIndices = new Set();
  const strikeCounts = new Map();

  while (!winner && Date.now() < deadline) {
    const polls = await Promise.allSettled(accepted.map(async (a, idx) => {
      if (benchedIndices.has(idx)) return null;
      const chunk = await fetchJson(`${a.base}/stream/${a.jobId}`, { headers: auth });
      return { ...a, idx, chunk, frames: Array.isArray(chunk.stream) ? chunk.stream : [] };
    }));

    for (let i = 0; i < polls.length; i++) {
      const p = polls[i];
      if (p.status === 'rejected') {
        const strikes = (strikeCounts.get(i) || 0) + 1;
        strikeCounts.set(i, strikes);
        bumpStat(accepted[i].base, 'errors');
        logger.warn({
          msg: 'runpod.race_poll_failed',
          endpoint: accepted[i].base,
          err: p.reason?.message,
          strike: `${strikes}/${POLL_STRIKE_LIMIT}`,
        });
        if (strikes >= POLL_STRIKE_LIMIT) {
          benchedIndices.add(i);
          logger.warn({
            msg: 'runpod.race_endpoint_benched',
            endpoint: accepted[i].base,
            reason: 'poll_strike_limit',
          });
        }
        continue;
      }
      // Successful poll resets the strike counter for this endpoint.
      if (strikeCounts.has(i)) strikeCounts.delete(i);
      const v = p.value;
      if (!v) continue;
      const status = v.chunk.status;
      if (status === 'FAILED' || status === 'CANCELLED' || status === 'TIMED_OUT') {
        benchedIndices.add(i);
        logger.warn({
          msg: 'runpod.race_endpoint_failed',
          endpoint: v.base,
          jobId: v.jobId,
          status,
        });
        continue;
      }
      if (status === 'IN_PROGRESS' || status === 'COMPLETED' || v.frames.length > 0) {
        winner = v;
        initialFrames = v.frames;
        break;
      }
    }

    if (benchedIndices.size === accepted.length) {
      throw new Error('runpod_all_endpoints_failed_during_race');
    }
    if (!winner) await sleep(POLL_INTERVAL_MS);
  }

  if (!winner) {
    accepted.forEach((a) => cancelJob(a.base, a.jobId).catch(() => {}));
    throw new Error('runpod_race_timeout');
  }

  // Winner found — record telemetry, cancel losers.
  const latencyMs = Date.now() - startedAt;
  bumpStat(winner.base, 'wins');
  bumpStat(winner.base, 'lastWinAt', new Date().toISOString());
  bumpStat(winner.base, 'lastWinLatencyMs', latencyMs);
  const losers = accepted.filter((a) => a.base !== winner.base);
  for (const loser of losers) {
    bumpStat(loser.base, 'losses');
    cancelJob(loser.base, loser.jobId).catch((err) =>
      logger.debug({ msg: 'runpod.cancel_failed', endpoint: loser.base, jobId: loser.jobId, err: err.message })
    );
  }
  logger.info({
    msg: 'runpod.race_winner',
    winner: winner.base,
    jobId: winner.jobId,
    latencyMs,
    losers: losers.length,
  });

  return streamAndAssemble({
    socket, commandId,
    base: winner.base,
    jobId: winner.jobId,
    deadline,
    initialFrames,
    initialStatus: winner.chunk.status,
  });
}

// ── HTTP helpers ────────────────────────────────────────────────────

async function submitJob(base, input) {
  const res = await fetchJson(`${base}/run`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ input }),
  });
  if (!res.id) {
    throw new Error(`runpod_start_failed:${JSON.stringify(res).slice(0, 200)}`);
  }
  logger.info({ msg: 'runpod.job_started', endpoint: base, jobId: res.id });
  return res;
}

async function cancelJob(base, jobId) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5_000);
  try {
    const res = await fetch(`${base}/cancel/${jobId}`, {
      method: 'POST',
      headers: authHeaders(),
      signal: ctrl.signal,
    });
    if (res && res.ok) {
      logger.debug({ msg: 'runpod.cancelled', endpoint: base, jobId });
    }
  } catch {
    // Best-effort; RunPod will time the worker out anyway if cancel fails.
  } finally {
    clearTimeout(timer);
  }
}

// ── Stream + assemble (the canonical reader loop) ───────────────────

async function streamAndAssemble({
  socket, commandId, base, jobId, deadline,
  initialFrames = [], initialStatus = 'IN_QUEUE',
}) {
  const auth = authHeaders();
  let stlBytes = null;
  let lastStatus = initialStatus;
  // Chunk reassembly buffer for the v0.1.33+ handler protocol.
  // RunPod's /job-stream per-frame cap is ~1 MB; the worker splits the
  // base64 STL into ≤700 KB `result_chunk` frames + a final `result`
  // frame with metadata. We index by `chunk.index` so order doesn't
  // matter (frames may arrive across multiple poll batches).
  const stlChunks = [];
  let stlChunkTotal = null;
  let stlBytesLen = null;

  const processFrames = (frames) => {
    for (const frame of frames) {
      const out = frame?.output;
      if (!out || typeof out !== 'object') continue;
      // P4-018 — drift detection. Worker boot frames or any frame that
      // includes the handler_version string get fed into the ring buffer.
      // Don't gate on out.type so the next handler revision can ship
      // boot-style metadata without us missing it.
      if (out.type === 'boot' || typeof out.handler_version === 'string') {
        const v = typeof out.handler_version === 'string' ? out.handler_version : null;
        if (v) recordHandlerVersion(v, jobId);
      }
      if (out.type === 'progress') {
        socket.emit('command', {
          id: commandId,
          name: 'stl.generate.progress',
          payload: { step: out.step, pct: out.pct },
        });
      } else if (out.type === 'result_chunk') {
        if (typeof out.data === 'string' && Number.isInteger(out.index)) {
          stlChunks[out.index] = out.data;
          if (Number.isInteger(out.total)) stlChunkTotal = out.total;
        }
      } else if (out.type === 'result') {
        // Three handler eras live here:
        //   ≤v0.1.31: stl_b64 inlined (HTTP 400 — never actually arrives).
        //   v0.1.32:  metadata only, STL via /status (broken — SDK drops it).
        //   v0.1.33+: metadata only, STL came in via prior result_chunk frames.
        if (typeof out.stl_b64 === 'string') {
          stlBytes = Buffer.from(out.stl_b64, 'base64');
        } else if (Number.isInteger(out.chunks)) {
          stlChunkTotal = out.chunks;
          if (Number.isInteger(out.stl_bytes_len)) stlBytesLen = out.stl_bytes_len;
        }
      } else if (out.type === 'error') {
        throw new Error(`runpod_worker_error:${out.error}`);
      }
    }
  };

  // Drain any frames the race loop already saw before we entered here.
  if (initialFrames.length > 0) processFrames(initialFrames);
  if (!stlBytes && stlChunkTotal && stlChunks.filter(Boolean).length === stlChunkTotal) {
    stlBytes = Buffer.from(stlChunks.join(''), 'base64');
  }

  while (!stlBytes && Date.now() < deadline) {
    const chunk = await fetchJson(`${base}/stream/${jobId}`, { headers: auth });
    const frames = Array.isArray(chunk.stream) ? chunk.stream : [];
    processFrames(frames);

    if (!stlBytes && stlChunkTotal && stlChunks.filter(Boolean).length === stlChunkTotal) {
      stlBytes = Buffer.from(stlChunks.join(''), 'base64');
      if (stlBytesLen !== null && stlBytes.length !== stlBytesLen) {
        logger.warn({
          msg: 'runpod.stl_size_mismatch',
          expected: stlBytesLen,
          actual: stlBytes.length,
        });
      }
    }

    lastStatus = chunk.status || lastStatus;
    if (lastStatus === 'COMPLETED') break;
    if (lastStatus === 'FAILED' || lastStatus === 'CANCELLED' || lastStatus === 'TIMED_OUT') {
      throw new Error(`runpod_job_${lastStatus.toLowerCase()}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }

  if (!stlBytes) {
    // Final safety net: some handler variants only return via /status.
    const status = await fetchJson(`${base}/status/${jobId}`, { headers: auth });
    const out = status?.output;
    if (out && typeof out === 'object' && out.stl_b64) {
      stlBytes = Buffer.from(out.stl_b64, 'base64');
    }
  }

  if (!stlBytes) {
    throw new Error(`runpod_no_result (last_status=${lastStatus})`);
  }
  logger.info({
    msg: 'runpod.job_complete',
    endpoint: base,
    jobId,
    bytes: stlBytes.length,
  });
  return stlBytes;
}

// ── Input builder ───────────────────────────────────────────────────

function buildInput({ imageBuf, settings }) {
  // PIPELINE_VERSION rolls out the new mesh pipeline (3D_Pipeline.md §9.5):
  //   "legacy": handler runs the original `_merge` concat. Always available.
  //   "v1":     handler runs the seven-stage CAD pipeline.
  // Handler treats unknown values as "legacy" and logs a warning.
  return {
    image_b64: imageBuf.toString('base64'),
    head_scale: Number(settings.headScale) || 1.0,
    neck_length_mm: Number(settings.neckLength) || 50,
    head_tilt_deg: Number(settings.headTilt) || 0,
    shoulder_taper_fraction: clamp(Number(settings.cropTightness) || 0.60, 0.40, 0.85),
    target_head_height_mm: clamp(Number(settings.targetHeadHeightMm) || 30, 22, 42),
    cap_protrusion_fraction: clamp((Number(settings.capProtrusionPct) || 10) / 100, 0.0, 0.25),
    pipeline_version: process.env.PIPELINE_VERSION || 'legacy',
    seed: 1,
  };
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const body = await res.text();
    let parsed;
    try { parsed = body ? JSON.parse(body) : {}; } catch { parsed = { raw: body }; }
    if (!res.ok) {
      const hint = parsed?.error || parsed?.message || body?.slice(0, 200) || res.statusText;
      throw new Error(`runpod_http_${res.status}:${hint}`);
    }
    return parsed;
  } finally {
    clearTimeout(timeoutId);
  }
}

function trimSlash(u) { return u.replace(/\/+$/, ''); }
function sleep(ms)    { return new Promise((r) => setTimeout(r, ms)); }
function clamp(v, lo, hi) {
  if (Number.isNaN(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

// ── Reachability ping (multi-endpoint aware) ────────────────────────
// Returns { reachable, latencyMs, lastChecked, endpoints[] }.
// `reachable` is true if ANY endpoint responds; `latencyMs` is the
// fastest. The `endpoints` array gives per-region breakdown for /admin.
// Never throws so /health stays up even when both regions are melting.
export async function pingRunpod() {
  const out = { reachable: false, latencyMs: null, lastChecked: Date.now(), endpoints: [] };
  if (!runpodEnabled()) return out;
  const endpoints = getEndpoints();
  const results = await Promise.allSettled(endpoints.map(async (base) => {
    const startedAt = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5_000);
    try {
      const res = await fetch(`${base}/health`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${process.env.RUNPOD_API_KEY}` },
        signal: ctrl.signal,
      }).catch(() => null);
      clearTimeout(timer);
      const latencyMs = Date.now() - startedAt;
      if (res && res.ok) return { base, id: base.split('/').pop(), reachable: true, latencyMs };
      // Some endpoints don't expose /health; a 404/405 still means the gateway is up.
      if (res) return { base, id: base.split('/').pop(), reachable: res.status < 500, latencyMs };
      return { base, id: base.split('/').pop(), reachable: false, latencyMs: null };
    } catch (err) {
      logger.debug({ msg: 'runpod.ping_failed', endpoint: base, err: err.message });
      return { base, id: base.split('/').pop(), reachable: false, latencyMs: null };
    }
  }));
  out.endpoints = results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { base: endpoints[i], id: endpoints[i].split('/').pop(), reachable: false, latencyMs: null }
  );
  out.reachable = out.endpoints.some((e) => e.reachable);
  const reachable = out.endpoints.filter((e) => e.reachable && e.latencyMs != null);
  if (reachable.length > 0) {
    out.latencyMs = Math.min(...reachable.map((e) => e.latencyMs));
  }
  return out;
}
