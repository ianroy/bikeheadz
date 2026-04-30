// Tiny singleton that fetches the runtime app-config (payments +
// printing toggles) once per page load and lets components subscribe
// to changes. Pages that depend on it call `getAppConfig()` and then
// re-render once the promise resolves.

let cached = null;
let inflight = null;
const subscribers = new Set();

// First-paint defaults — match the server's: BOTH OFF for the MVP
// launch window. The real values arrive from `system.config` shortly
// after socket connect; main.js re-renders the active route once they
// resolve so the no-flash window is small. Defaulting payments OFF
// here means a returning visitor sees the graffiti on first paint
// even before the socket round-trip completes.
const DEFAULT = {
  paymentsEnabled: false,
  printingEnabled: false,
  stripeConfigured: false,
};

export function getCachedAppConfig() {
  return cached || DEFAULT;
}

export async function getAppConfig({ socket } = {}) {
  if (cached) return cached;
  if (inflight) return inflight;
  if (!socket) return DEFAULT;
  inflight = socket
    .request('system.config')
    .then((res) => {
      cached = { ...DEFAULT, ...(res || {}) };
      inflight = null;
      for (const fn of subscribers) {
        try {
          fn(cached);
        } catch {
          // ignore
        }
      }
      return cached;
    })
    .catch(() => {
      inflight = null;
      return DEFAULT;
    });
  return inflight;
}

export function refreshAppConfig({ socket } = {}) {
  cached = null;
  return getAppConfig({ socket });
}

export function onAppConfigChange(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
