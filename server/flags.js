// P0-010 — feature flags.
//
// Resolution order: env override (FLAG_<KEY>=true|false|<percent>) → DB row →
// default false. Cached in-process for FLAG_CACHE_TTL_MS to avoid hammering
// PG on the hot path. Cache invalidates on flags.set.

import { createHash } from 'node:crypto';
import { db, hasDb } from './db.js';
import { logger } from './logger.js';

const CACHE_TTL_MS = Number(process.env.FLAG_CACHE_TTL_MS) || 30_000;
let CACHE = { at: 0, rows: new Map() };

function envOverride(key) {
  const env = process.env[`FLAG_${key.toUpperCase().replace(/[.-]/g, '_')}`];
  if (env == null || env === '') return null;
  if (env === 'true' || env === '1') return { enabled: true, percent: 100, allowlist: [] };
  if (env === 'false' || env === '0') return { enabled: false, percent: 0, allowlist: [] };
  const n = Number(env);
  if (Number.isFinite(n) && n >= 0 && n <= 100) return { enabled: true, percent: n, allowlist: [] };
  return null;
}

async function loadFromDb() {
  if (!hasDb()) return new Map();
  try {
    const { rows } = await db.query(
      `SELECT key, enabled, percent, allowlist FROM feature_flags`
    );
    const out = new Map();
    for (const r of rows) out.set(r.key, r);
    return out;
  } catch (err) {
    logger.debug({ msg: 'flags.load_failed', err: err.message });
    return new Map();
  }
}

async function getCachedRow(key) {
  const now = Date.now();
  if (now - CACHE.at > CACHE_TTL_MS) {
    CACHE = { at: now, rows: await loadFromDb() };
  }
  return CACHE.rows.get(key) || null;
}

export function invalidateFlagCache() {
  CACHE = { at: 0, rows: new Map() };
}

export async function isEnabled(key, { user = null } = {}) {
  const env = envOverride(key);
  const row = env || (await getCachedRow(key));
  if (!row) return false;
  if (!row.enabled) return false;
  if (Array.isArray(row.allowlist) && user?.email) {
    if (row.allowlist.includes(String(user.email).toLowerCase())) return true;
  }
  if (row.percent >= 100) return true;
  if (row.percent <= 0) return false;
  // Deterministic bucket so a user always sees the same variant.
  const seed = user?.id != null ? String(user.id) : 'anon';
  const bucket = bucketHash(`${key}|${seed}`);
  return bucket < row.percent;
}

function bucketHash(str) {
  const h = createHash('sha1').update(str).digest();
  // first 4 bytes → 0..2^32 → mod 100
  return ((h[0] << 24) | (h[1] << 16) | (h[2] << 8) | h[3]) >>> 0 % 100;
}

export async function setFlag({ key, enabled, percent = null, allowlist = null, updatedBy = null }) {
  if (!hasDb()) {
    logger.info({ msg: 'flags.set.memory', key, enabled, percent });
    invalidateFlagCache();
    return;
  }
  await db.query(
    `INSERT INTO feature_flags (key, enabled, percent, allowlist, updated_by, updated_at)
     VALUES ($1, $2, COALESCE($3,0), COALESCE($4,'[]'::jsonb), $5, NOW())
     ON CONFLICT (key) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       percent = COALESCE($3, feature_flags.percent),
       allowlist = COALESCE($4, feature_flags.allowlist),
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
    [key, enabled, percent, allowlist ? JSON.stringify(allowlist) : null, updatedBy]
  );
  invalidateFlagCache();
}

export async function listFlags() {
  if (!hasDb()) return [];
  const { rows } = await db.query(`SELECT key, enabled, percent, allowlist, description, updated_at FROM feature_flags ORDER BY key`);
  return rows;
}
