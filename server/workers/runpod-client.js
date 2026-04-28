import { logger } from '../logger.js';

// Drop-in replacement for the local Python worker. Talks to a RunPod
// Serverless endpoint that runs handler.py at the repo root. The wire format
// (progress / result / error frames) matches the local worker exactly, so
// the caller doesn't care which backend is serving the request.
//
// Activated when RUNPOD_ENDPOINT_URL is set. Example:
//   RUNPOD_ENDPOINT_URL=https://api.runpod.ai/v2/<endpoint-id>
//   RUNPOD_API_KEY=<bearer token>

const POLL_INTERVAL_MS  = 1_500;
// Cold-start TRELLIS is genuinely slow: pulling 2.5GB of safetensors plus
// dinov2 (1.1GB) and u2net (176MB) on first invocation, then constructing
// 4 decoders before the first frame. We've measured ~8 min end-to-end on a
// fresh worker. Subsequent warm invocations are ~30-60s. Pick 12 min so a
// queued job that has to spin up a brand-new worker still completes.
const POLL_MAX_WAIT_MS  = 720_000;
const REQUEST_TIMEOUT_MS = 30_000;

export function runpodEnabled() {
  return !!process.env.RUNPOD_ENDPOINT_URL && !!process.env.RUNPOD_API_KEY;
}

export async function runRunpod({ socket, commandId, imageBuf, settings }) {
  const base = trimSlash(process.env.RUNPOD_ENDPOINT_URL);
  const auth = {
    Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`,
    'Content-Type': 'application/json',
  };

  // PIPELINE_VERSION is the rollout flag for the new mesh pipeline
  // (3D_Pipeline.md §9.5). Acceptable values:
  //   - "legacy" (default): handler.py runs the original `_merge`
  //     concatenation. Always available, never broken.
  //   - "v1": handler.py runs the seven-stage pipeline (validate,
  //     normalize, repair, crop, subtract, union, print-prep).
  // The handler treats unknown values as "legacy" and logs a warning.
  const input = {
    image_b64: imageBuf.toString('base64'),
    head_scale: Number(settings.headScale) || 1.0,
    neck_length_mm: Number(settings.neckLength) || 50, // legacy slider, deprecated by v1
    head_tilt_deg: Number(settings.headTilt) || 0,     // v1: pitch about +X (chin up)
    shoulder_taper_fraction: clamp(Number(settings.cropTightness) || 0.60, 0.40, 0.85),
    // Two new v1 overrides: target head height in mm (drives Stage 1
    // rescale) and cap protrusion as a fraction (drives the bike-valve
    // entry opening). Sliders ship pct (0..25); convert to fraction
    // here so the wire format matches the pipeline's Constants schema.
    target_head_height_mm: clamp(Number(settings.targetHeadHeightMm) || 30, 22, 42),
    cap_protrusion_fraction: clamp((Number(settings.capProtrusionPct) || 10) / 100, 0.0, 0.25),
    pipeline_version: process.env.PIPELINE_VERSION || 'legacy',
    seed: 1,
  };

  // 1. Submit the job.
  const startRes = await fetchJson(`${base}/run`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ input }),
  });
  const jobId = startRes.id;
  if (!jobId) {
    throw new Error(`runpod_start_failed:${JSON.stringify(startRes).slice(0, 200)}`);
  }
  logger.info({ msg: 'runpod.job_started', jobId });

  // 2. Poll /stream/{id}. Each call returns frames yielded since the last call.
  const deadline = Date.now() + POLL_MAX_WAIT_MS;
  let stlBytes = null;
  let lastStatus = startRes.status || 'IN_QUEUE';

  while (Date.now() < deadline) {
    const chunk = await fetchJson(`${base}/stream/${jobId}`, { headers: auth });
    const frames = Array.isArray(chunk.stream) ? chunk.stream : [];
    for (const frame of frames) {
      const out = frame?.output;
      if (!out || typeof out !== 'object') continue;
      if (out.type === 'progress') {
        socket.emit('command', {
          id: commandId,
          name: 'stl.generate.progress',
          payload: { step: out.step, pct: out.pct },
        });
      } else if (out.type === 'result') {
        if (typeof out.stl_b64 !== 'string') {
          throw new Error('runpod_result_missing_stl');
        }
        stlBytes = Buffer.from(out.stl_b64, 'base64');
      } else if (out.type === 'error') {
        throw new Error(`runpod_worker_error:${out.error}`);
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
    // Final safety net: some handler variants only return via /status, not /stream.
    const status = await fetchJson(`${base}/status/${jobId}`, { headers: auth });
    const out = status?.output;
    if (out && typeof out === 'object' && out.stl_b64) {
      stlBytes = Buffer.from(out.stl_b64, 'base64');
    }
  }

  if (!stlBytes) {
    throw new Error(`runpod_no_result (last_status=${lastStatus})`);
  }
  logger.info({ msg: 'runpod.job_complete', jobId, bytes: stlBytes.length });
  return stlBytes;
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
