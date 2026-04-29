// P4-009 — A/B testing harness.
//
// `experiments` table holds the variant config; `experiment_exposures` is
// the events table (one row per (key, user) first-exposure). Bucketing is
// deterministic per user so a user always sees the same variant. The
// statistics layer (95% CI on conversion-rate diff) is intentionally tiny
// — see `experimentStats(key)` below.

import { createHash } from 'node:crypto';
import { db, hasDb } from './db.js';
import { logger } from './logger.js';

const CACHE = new Map(); // key → { at, exp }
const CACHE_TTL_MS = 30_000;

function bucket(seed, key) {
  const h = createHash('sha256').update(`${key}|${seed}`).digest();
  return ((h[0] << 24) | (h[1] << 16) | (h[2] << 8) | h[3]) >>> 0;
}

async function loadExperiment(key) {
  const cached = CACHE.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.exp;
  if (!hasDb()) return null;
  try {
    const { rows } = await db.query(
      `SELECT key, variants, allocation, started_at, stopped_at FROM experiments WHERE key = $1`,
      [key]
    );
    const exp = rows[0] || null;
    CACHE.set(key, { at: Date.now(), exp });
    return exp;
  } catch (err) {
    logger.debug({ msg: 'experiments.load_failed', err: err.message });
    return null;
  }
}

export async function assignVariant({ key, user }) {
  const exp = await loadExperiment(key);
  if (!exp || exp.stopped_at) return { variant: 'control', assigned: false };
  const variants = Array.isArray(exp.variants) ? exp.variants : [];
  if (!variants.length) return { variant: 'control', assigned: false };
  const allocation = exp.allocation || {};
  const seed = user?.id != null ? `u:${user.id}` : 'anon';
  const score = bucket(seed, key) % 10000;

  // Allocation is { variantName: percent }, percent 0..100. Default = even split.
  const totalAlloc = variants.reduce((s, v) => s + (Number(allocation[v]) || 0), 0);
  const cumulative = [];
  let acc = 0;
  if (totalAlloc <= 0) {
    const evenPct = 100 / variants.length;
    for (const v of variants) {
      acc += evenPct;
      cumulative.push({ v, threshold: Math.round((acc / 100) * 10000) });
    }
  } else {
    for (const v of variants) {
      acc += (Number(allocation[v]) || 0) * (100 / totalAlloc);
      cumulative.push({ v, threshold: Math.round((acc / 100) * 10000) });
    }
  }
  const chosen = cumulative.find((c) => score < c.threshold)?.v || cumulative[cumulative.length - 1].v;

  if (hasDb() && user?.id != null) {
    db.query(
      `INSERT INTO experiment_exposures (experiment_key, account_id, variant)
       SELECT $1, $2, $3 WHERE NOT EXISTS (
         SELECT 1 FROM experiment_exposures
          WHERE experiment_key = $1 AND account_id = $2
       )`,
      [key, user.id, chosen]
    ).catch(() => {});
  }
  return { variant: chosen, assigned: true };
}

export async function listExperiments() {
  if (!hasDb()) return [];
  const { rows } = await db.query(
    `SELECT key, variants, allocation, description, started_at, stopped_at FROM experiments ORDER BY started_at DESC`
  );
  return rows;
}

export async function startExperiment({ key, variants, allocation = {}, description = null }) {
  if (!hasDb()) return;
  await db.query(
    `INSERT INTO experiments (key, variants, allocation, description)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (key) DO UPDATE SET
       variants = EXCLUDED.variants,
       allocation = EXCLUDED.allocation,
       description = EXCLUDED.description,
       started_at = COALESCE(experiments.started_at, NOW()),
       stopped_at = NULL`,
    [key, JSON.stringify(variants), JSON.stringify(allocation), description]
  );
  CACHE.delete(key);
}

export async function stopExperiment(key) {
  if (!hasDb()) return;
  await db.query(`UPDATE experiments SET stopped_at = NOW() WHERE key = $1`, [key]);
  CACHE.delete(key);
}
