// MVP launch toggles, surfaced through the existing feature_flags table.
//
//   payments_enabled  — when off, Stripe is disabled globally and STL
//                       downloads become free for logged-in users.
//   printing_enabled  — when off, third-party printing options ("Printed
//                       Stem", "Pack of 4") disappear from the frontend.
//
// Defaults are ON: an unset flag (no DB row) means the feature is on, so
// existing deploys keep their current behavior until an admin explicitly
// toggles them off.

import { db, hasDb } from './db.js';
import { logger } from './logger.js';
import { invalidateFlagCache } from './flags.js';

const PAYMENTS_KEY = 'payments_enabled';
const PRINTING_KEY = 'printing_enabled';
const AAA_TOGGLE_KEY = 'aaa_toggle_enabled';

const CACHE_TTL_MS = 30_000;
let cache = { at: 0, payments: false, printing: false, aaaToggle: false };

// Defaults — kept here next to the resolver so they're easy to audit.
// payments + printing OFF for the MVP launch window: Stripe stays
// cold, downloads are free for logged-in users, third-party printing
// is hidden. Admin can flip either back on via /admin once the
// launch posture is over.
//
// AAA toggle OFF by default: the floating "AAA on/off" chip used to
// sit on every page (P6-011) but most visitors never need it and the
// chip cluttered the chrome. When the admin flips this flag on, the
// chip reappears at bottom-right.
const PAYMENTS_DEFAULT = false;
const PRINTING_DEFAULT = false;
const AAA_TOGGLE_DEFAULT = false;

async function loadFromDb() {
  if (!hasDb()) {
    return {
      payments: defaultFromEnv(PAYMENTS_KEY, PAYMENTS_DEFAULT),
      printing: defaultFromEnv(PRINTING_KEY, PRINTING_DEFAULT),
      aaaToggle: defaultFromEnv(AAA_TOGGLE_KEY, AAA_TOGGLE_DEFAULT),
    };
  }
  try {
    const { rows } = await db.query(
      `SELECT key, enabled FROM feature_flags WHERE key = ANY($1::text[])`,
      [[PAYMENTS_KEY, PRINTING_KEY, AAA_TOGGLE_KEY]]
    );
    const map = new Map(rows.map((r) => [r.key, r.enabled]));
    return {
      payments: map.has(PAYMENTS_KEY) ? !!map.get(PAYMENTS_KEY) : defaultFromEnv(PAYMENTS_KEY, PAYMENTS_DEFAULT),
      printing: map.has(PRINTING_KEY) ? !!map.get(PRINTING_KEY) : defaultFromEnv(PRINTING_KEY, PRINTING_DEFAULT),
      aaaToggle: map.has(AAA_TOGGLE_KEY) ? !!map.get(AAA_TOGGLE_KEY) : defaultFromEnv(AAA_TOGGLE_KEY, AAA_TOGGLE_DEFAULT),
    };
  } catch (err) {
    logger.debug({ msg: 'app_config.load_failed', err: err.message });
    return { payments: PAYMENTS_DEFAULT, printing: PRINTING_DEFAULT, aaaToggle: AAA_TOGGLE_DEFAULT };
  }
}

function defaultFromEnv(key, fallback) {
  const env = process.env[`FLAG_${key.toUpperCase()}`];
  if (env == null || env === '') return fallback;
  if (env === 'false' || env === '0') return false;
  if (env === 'true' || env === '1') return true;
  return fallback;
}

async function refresh() {
  const v = await loadFromDb();
  cache = { at: Date.now(), payments: v.payments, printing: v.printing, aaaToggle: v.aaaToggle };
  return cache;
}

async function getFresh() {
  if (Date.now() - cache.at > CACHE_TTL_MS) await refresh();
  return cache;
}

export async function paymentsEnabled() {
  const c = await getFresh();
  return c.payments;
}

export async function printingEnabled() {
  const c = await getFresh();
  return c.printing;
}

export async function aaaToggleEnabled() {
  const c = await getFresh();
  return c.aaaToggle;
}

export async function getAppConfig() {
  const c = await getFresh();
  return {
    paymentsEnabled: c.payments,
    printingEnabled: c.printing,
    aaaToggleEnabled: c.aaaToggle,
  };
}

export function invalidateAppConfigCache() {
  cache = {
    at: 0,
    payments: PAYMENTS_DEFAULT,
    printing: PRINTING_DEFAULT,
    aaaToggle: AAA_TOGGLE_DEFAULT,
  };
  invalidateFlagCache();
}
