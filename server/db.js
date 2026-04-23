import pg from 'pg';
import { logger } from './logger.js';

const { Pool } = pg;

// 12-factor §3 — DATABASE_URL injected by the platform (DO Managed PostgreSQL).
// 12-factor §4 — treat backing services as attached resources.
const connectionString = process.env.DATABASE_URL;
const sslDisabled = process.env.DATABASE_SSL === 'false';

export const db = connectionString
  ? new Pool({
      connectionString,
      ssl: sslDisabled ? false : { rejectUnauthorized: false },
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
