// P4-018 — Replica drift detector.
//
// In-memory ring buffer of recent handler-version observations from the
// RunPod worker fleet. When more than one distinct handler version appears
// inside the rolling window we flag drift, which is a leading indicator
// that a deploy is mid-rollout (or the autoscaler is stuck pinning warm
// pods at an older image).
//
// The buffer lives in process memory; on a multi-instance deploy each
// replica only sees its own observations, which is fine — the GitHub
// Actions canary scrapes /health periodically and we aggregate from there.
//
// Public API:
//   recordHandlerVersion(version, jobId)
//   getRecentVersions({ windowMs })
//
// No DB writes, no REST.

const RING_SIZE = 200;

const ring = new Array(RING_SIZE).fill(null);
let writeIdx = 0;

export function recordHandlerVersion(version, jobId) {
  if (!version || typeof version !== 'string') return;
  ring[writeIdx % RING_SIZE] = {
    version,
    jobId: jobId == null ? null : String(jobId),
    ts: Date.now(),
  };
  writeIdx += 1;
}

export function getRecentVersions({ windowMs = 60 * 60 * 1000 } = {}) {
  const cutoff = Date.now() - windowMs;
  const seen = new Set();
  let oldestTs = null;
  for (const entry of ring) {
    if (!entry) continue;
    if (entry.ts < cutoff) continue;
    seen.add(entry.version);
    if (oldestTs === null || entry.ts < oldestTs) oldestTs = entry.ts;
  }
  const versions = Array.from(seen).sort();
  const distinct = versions.length;
  return {
    versions,
    distinct,
    since: oldestTs ? new Date(oldestTs).toISOString() : null,
    drift: distinct > 1,
  };
}

// Test-only — clears the ring. Not exported through index.
export function _resetForTests() {
  for (let i = 0; i < RING_SIZE; i += 1) ring[i] = null;
  writeIdx = 0;
}
