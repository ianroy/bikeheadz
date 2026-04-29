// P0-009 — append-only audit log. PII discipline: never log photo bytes,
// STL contents, or secrets. Only ids, scalars, and tiny JSON metadata.

import { db, hasDb } from './db.js';
import { logger } from './logger.js';

const SAFE_ACTIONS = /^[a-z][a-z0-9_.]{0,63}$/;

export async function recordAudit({
  actorId = null,
  onBehalfOf = null,
  action,
  targetType = null,
  targetId = null,
  metadata = {},
  ip = null,
}) {
  if (!action || !SAFE_ACTIONS.test(action)) {
    logger.warn({ msg: 'audit.invalid_action', action });
    return;
  }
  const safeMeta = sanitizeMetadata(metadata);
  if (!hasDb()) {
    logger.info({
      msg: 'audit.memory',
      actorId,
      onBehalfOf,
      action,
      targetType,
      targetId,
      metadata: safeMeta,
    });
    return;
  }
  try {
    await db.query(
      `INSERT INTO audit_log (actor_id, on_behalf_of, action, target_type, target_id, metadata, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [actorId, onBehalfOf, action, targetType, targetId == null ? null : String(targetId), safeMeta, ip]
    );
  } catch (err) {
    logger.error({ msg: 'audit.insert_failed', action, err: err.message });
  }
}

function sanitizeMetadata(meta) {
  const out = {};
  for (const [k, v] of Object.entries(meta || {})) {
    if (v == null) continue;
    if (Buffer.isBuffer(v) || v instanceof Uint8Array) {
      out[k] = `[bytes:${v.length}]`;
      continue;
    }
    if (typeof v === 'string' && v.length > 1024) {
      out[k] = v.slice(0, 1024) + '…';
      continue;
    }
    out[k] = v;
  }
  return out;
}
