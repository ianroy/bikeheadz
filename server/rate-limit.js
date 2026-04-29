// P0-006 — in-memory sliding-window rate limiter.
//
// Tradeoff: state is per-process; if you scale horizontally, two replicas
// each enforce the per-IP/per-socket window independently. Acceptable for
// MVP because the GPU bottleneck (RunPod queue) is the real cap; the
// limiter just protects from one client hammering one node.
//
// Future fix (tracked separately): Redis or Postgres `audit_log`-style
// table.

import { CommandError, ErrorCode } from './errors.js';

// Each bucket = a Map<key, number[]> where the array holds the timestamps
// (ms) of recent hits sorted by insertion order. Buckets are pruned lazily
// on each check.
const BUCKETS = new Map();

function bucket(name) {
  let b = BUCKETS.get(name);
  if (!b) {
    b = new Map();
    BUCKETS.set(name, b);
  }
  return b;
}

// limits: [{ windowMs, max, keyer }]
//   keyer: (ctx) => string  — produce a key for that limit (per-socket vs per-ip)
//
// Returns a `check(ctx)` function. If the limit is exceeded the function
// throws CommandError(RATE_LIMITED) with `details.retryAfter` (seconds).
export function makeRateLimiter(name, limits) {
  const b = bucket(name);
  return function check(ctx) {
    const now = Date.now();
    let earliestReset = 0;
    for (const limit of limits) {
      const k = `${limit.windowMs}|${limit.keyer(ctx)}`;
      const arr = b.get(k) || [];
      const cutoff = now - limit.windowMs;
      let firstFresh = 0;
      while (firstFresh < arr.length && arr[firstFresh] < cutoff) firstFresh++;
      const fresh = firstFresh > 0 ? arr.slice(firstFresh) : arr;
      if (fresh.length >= limit.max) {
        const reset = fresh[0] + limit.windowMs;
        const retryAfter = Math.max(1, Math.ceil((reset - now) / 1000));
        throw new CommandError(ErrorCode.RATE_LIMITED, 'rate_limited', {
          retryAfter,
          limit: limit.max,
          windowMs: limit.windowMs,
        });
      }
      fresh.push(now);
      b.set(k, fresh);
      earliestReset = Math.max(earliestReset, fresh[0] + limit.windowMs);
    }
    return { ok: true, resetAt: earliestReset };
  };
}

// Pre-baked limiters for the heavy commands. Tunable via env so ops can
// loosen during canary windows without a deploy.
const STL_LIMIT_PER_SOCKET = Number(process.env.STL_RATE_LIMIT_PER_SOCKET) || 3;
const STL_LIMIT_PER_IP = Number(process.env.STL_RATE_LIMIT_PER_IP) || 10;
const AUTH_LIMIT_PER_EMAIL = Number(process.env.AUTH_LIMIT_PER_EMAIL) || 3;
const AUTH_LIMIT_PER_IP = Number(process.env.AUTH_LIMIT_PER_IP) || 10;

export const stlGenerateLimiter = makeRateLimiter('stl.generate', [
  { windowMs: 60_000, max: STL_LIMIT_PER_SOCKET, keyer: (ctx) => `socket:${ctx.socketId}` },
  { windowMs: 60 * 60_000, max: STL_LIMIT_PER_IP, keyer: (ctx) => `ip:${ctx.ip}` },
]);

export const magicLinkLimiter = makeRateLimiter('auth.magicLink', [
  { windowMs: 60 * 60_000, max: AUTH_LIMIT_PER_EMAIL, keyer: (ctx) => `email:${ctx.email}` },
  { windowMs: 60 * 60_000, max: AUTH_LIMIT_PER_IP, keyer: (ctx) => `ip:${ctx.ip}` },
]);

export function clearAllLimiters() {
  BUCKETS.clear();
}
