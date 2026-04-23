import pg from 'pg';
import { logger } from './logger.js';

const { Pool } = pg;

// 12-factor §3 — DATABASE_URL injected by the platform (DO Managed PostgreSQL).
// 12-factor §4 — treat backing services as attached resources.
const rawUrl = process.env.DATABASE_URL;
const sslDisabled = process.env.DATABASE_SSL === 'false';

// DO Managed PostgreSQL (including the dev tier) serves a cert chain that
// does not validate under Node's default trust store. We force
// `sslmode=no-verify` directly in the URL AND pass a matching `ssl` object:
// pg honors whichever the current version prefers. Net effect: encrypted
// channel, no cert verification — the recipe DO's Node guide documents.
function prepareConnectionString(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (sslDisabled) {
      u.searchParams.delete('sslmode');
    } else {
      u.searchParams.set('sslmode', 'no-verify');
    }
    return u.toString();
  } catch {
    return url;
  }
}

const connectionString = prepareConnectionString(rawUrl);
const sslConfig = sslDisabled ? false : { rejectUnauthorized: false };

export const db = connectionString
  ? new Pool({
      connectionString,
      ssl: sslConfig,
      max: Number(process.env.DB_POOL_MAX) || 10,
      idleTimeoutMillis: 30_000,
    })
  : null;

db?.on('error', (err) => logger.error({ msg: 'db.pool.error', err: err.message }));

export function hasDb() {
  return !!db;
}

export async function initDb() {
  if (!db) {
    logger.warn({ msg: 'db.disabled', hint: 'DATABASE_URL not set — running with in-memory fallbacks' });
    return;
  }
  const client = await db.connect();
  try {
    const { rows } = await client.query('SELECT version() AS version');
    logger.info({ msg: 'db.connected', version: rows[0].version });
  } finally {
    client.release();
  }
}

export async function query(text, params) {
  if (!db) throw new Error('database_not_configured');
  return db.query(text, params);
}

export async function closeDb() {
  if (!db) return;
  try {
    await db.end();
    logger.info({ msg: 'db.closed' });
  } catch (err) {
    logger.warn({ msg: 'db.close.error', err: err.message });
  }
}
