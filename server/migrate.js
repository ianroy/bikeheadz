// 12-factor §12 — admin processes run in the same environment as the app.
// Usage: `npm run migrate` (Procfile `release: node server/migrate.js`)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, hasDb, initDb, closeDb } from './db.js';
import { logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function main() {
  await initDb();
  if (!hasDb()) {
    logger.error({ msg: 'migrate.no_database_url' });
    process.exit(1);
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name   TEXT PRIMARY KEY,
      run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = (await fs.readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const { rowCount } = await db.query(
      'SELECT 1 FROM schema_migrations WHERE name = $1',
      [file]
    );
    if (rowCount) {
      logger.info({ msg: 'migrate.skip', file });
      continue;
    }
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      logger.info({ msg: 'migrate.applied', file });
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error({ msg: 'migrate.failed', file, err: err.message });
      throw err;
    } finally {
      client.release();
    }
  }
}

main()
  .then(() => closeDb())
  .then(() => process.exit(0))
  .catch(async (err) => {
    logger.error({ msg: 'migrate.fatal', err: err.message });
    await closeDb();
    process.exit(1);
  });
