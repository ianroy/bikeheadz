// 12-factor §12 — admin processes run in the same environment as the app.
// Usage: `npm run migrate` (Procfile `release: node server/migrate.js`)
//
// The migration loop is also exported as `applyPendingMigrations()` so
// server/index.js can self-heal on cold start if the PRE_DEPLOY job
// failed to fire — see the migrate-on-boot hook there. The function
// is idempotent: applied filenames sit in the schema_migrations
// table, already-applied files are skipped silently.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, hasDb, initDb, closeDb } from './db.js';
import { logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

export async function applyPendingMigrations({ silent = false } = {}) {
  if (!hasDb()) {
    if (!silent) logger.warn({ msg: 'migrate.no_database_url' });
    return { applied: [], skipped: [] };
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

  const applied = [];
  const skipped = [];
  for (const file of files) {
    const { rowCount } = await db.query(
      'SELECT 1 FROM schema_migrations WHERE name = $1',
      [file]
    );
    if (rowCount) {
      skipped.push(file);
      if (!silent) logger.info({ msg: 'migrate.skip', file });
      continue;
    }
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      applied.push(file);
      logger.info({ msg: 'migrate.applied', file });
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error({ msg: 'migrate.failed', file, err: err.message });
      throw err;
    } finally {
      client.release();
    }
  }
  return { applied, skipped };
}

async function main() {
  await initDb();
  if (!hasDb()) {
    logger.error({ msg: 'migrate.no_database_url' });
    process.exit(1);
  }
  await applyPendingMigrations();
}

// Run as standalone script when invoked directly (npm run migrate /
// PRE_DEPLOY job). When imported as a module the main() block is
// skipped — server/index.js calls applyPendingMigrations() itself.
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => closeDb())
    .then(() => process.exit(0))
    .catch(async (err) => {
      logger.error({ msg: 'migrate.fatal', err: err.message });
      await closeDb();
      process.exit(1);
    });
}
