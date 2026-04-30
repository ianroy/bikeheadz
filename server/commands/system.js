// X-013 — system.health command. Aggregates the four pieces the
// /status page renders as traffic-light tiles:
//
//   - node    : process uptime + ok flag
//   - runpod  : reachability ping (cached separately inside runpod-client)
//   - db      : SELECT 1 round-trip if a Postgres pool is configured
//   - stripe  : whether webhook delivery is enabled (env-derived)
//
// Cached for 60 s in module scope. /status mounts on every page load and
// we don't want every visitor to fan out four cold probes; 60 s is the
// shortest budget that still keeps RunPod ping costs negligible.

import { pingRunpod } from '../workers/runpod-client.js';
import { hasDb, db } from '../db.js';
import { webhookEnabled, stripeEnabled } from '../stripe-client.js';
import { logger } from '../logger.js';
import { getAppConfig } from '../app-config.js';

const CACHE_MS = 60_000;
let cache = null; // { value, expiresAt }

async function probeDb() {
  if (!hasDb()) return null;
  const startedAt = Date.now();
  try {
    await db.query('SELECT 1');
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch (err) {
    logger.debug({ msg: 'system.health.db_failed', err: err.message });
    return { ok: false, latencyMs: Date.now() - startedAt, error: err.message };
  }
}

async function buildHealth() {
  const nowISO = new Date().toISOString();
  const [runpod, dbStatus] = await Promise.all([pingRunpod(), probeDb()]);
  return {
    node: {
      ok: true,
      uptimeS: Math.floor(process.uptime()),
    },
    runpod,
    db: dbStatus,
    stripe: webhookEnabled(),
    lastChecked: nowISO,
  };
}

export const systemCommands = {
  'system.health': async () => {
    const now = Date.now();
    if (cache && cache.expiresAt > now) {
      return cache.value;
    }
    const value = await buildHealth();
    cache = { value, expiresAt: now + CACHE_MS };
    return value;
  },

  // Anonymous-callable runtime config so the SPA can branch on the
  // MVP launch toggles without an extra round-trip per page.
  'system.config': async () => {
    const flags = await getAppConfig();
    return {
      paymentsEnabled: flags.paymentsEnabled,
      printingEnabled: flags.printingEnabled,
      aaaToggleEnabled: flags.aaaToggleEnabled,
      stripeConfigured: stripeEnabled(),
    };
  },
};
