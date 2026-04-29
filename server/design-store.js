import { db, hasDb } from './db.js';
import { logger } from './logger.js';

// Durable store for generated STL files. We keep the bytes in Postgres when a
// DATABASE_URL is configured (12-factor §6 — state out of the process),
// otherwise fall back to an in-memory LRU for local dev.

const MEMORY = new Map(); // id → { stl: Buffer, filename, settings, photoName, at, accountId, photoId }
const MEMORY_TTL_MS = 24 * 60 * 60 * 1000;
const MEMORY_MAX = 50;

function pruneMemory() {
  const cutoff = Date.now() - MEMORY_TTL_MS;
  for (const [id, entry] of MEMORY) {
    if (entry.at < cutoff) MEMORY.delete(id);
  }
  while (MEMORY.size > MEMORY_MAX) {
    const oldest = MEMORY.keys().next().value;
    MEMORY.delete(oldest);
  }
}

export const designStore = {
  async save({ id, stl, filename, settings = {}, photoName = null, accountId = null, photoId = null }) {
    pruneMemory();
    if (!hasDb()) {
      MEMORY.set(id, { stl, filename, settings, photoName, accountId, photoId, at: Date.now() });
      return { id };
    }
    await db.query(
      `INSERT INTO generated_designs (id, account_id, photo_id, stl_bytes, filename, settings, photo_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         account_id = COALESCE(EXCLUDED.account_id, generated_designs.account_id),
         photo_id   = COALESCE(EXCLUDED.photo_id, generated_designs.photo_id),
         stl_bytes  = EXCLUDED.stl_bytes,
         filename   = EXCLUDED.filename,
         settings   = EXCLUDED.settings,
         photo_name = EXCLUDED.photo_name`,
      [id, accountId, photoId, stl, filename, settings, photoName]
    );
    return { id };
  },

  async get(id) {
    if (!hasDb()) {
      pruneMemory();
      return MEMORY.get(id) || null;
    }
    const { rows } = await db.query(
      `SELECT id, account_id AS "accountId", photo_id AS "photoId",
              stl_bytes AS stl, filename, settings, photo_name AS "photoName"
         FROM generated_designs
        WHERE id = $1 AND expires_at > NOW()
        LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  async exists(id) {
    if (!hasDb()) {
      pruneMemory();
      return MEMORY.has(id);
    }
    const { rowCount } = await db.query(
      `SELECT 1 FROM generated_designs WHERE id = $1 AND expires_at > NOW()`,
      [id]
    );
    return rowCount > 0;
  },
};

export function startExpiryJob(intervalMs = 15 * 60 * 1000) {
  const tick = async () => {
    try {
      if (hasDb()) {
        const { rowCount } = await db.query(`DELETE FROM generated_designs WHERE expires_at <= NOW()`);
        if (rowCount) logger.info({ msg: 'design_store.pruned', count: rowCount });
      } else {
        pruneMemory();
      }
    } catch (err) {
      logger.warn({ msg: 'design_store.prune.error', err: err.message });
    }
  };
  const handle = setInterval(tick, intervalMs);
  handle.unref?.();
  return () => clearInterval(handle);
}
