// P0-016 — boot resilience for the AUTH_SECRET resolver.
//
// `server/auth.js` decides at module-load time how to derive the HMAC
// key used for signed sessions. Production deploys will sometimes
// arrive without an explicit AUTH_SECRET; we MUST still boot, but the
// chosen path (DB-derived stable fallback vs. per-process random) has
// to be loud about itself in stderr so the operator can fix it.
//
// These tests spawn child processes with controlled env and assert on
// the warning emitted on import. We only need the side effect, so the
// inline script just imports server/auth.js and exits.

import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Tests live at tests/server/...; resolve back to the repo root so the
// child can import the real server/auth.js by absolute path.
const repoRoot = path.resolve(__dirname, '..', '..');
const authPath = path.join(repoRoot, 'server', 'auth.js')
  .replace(/\\/g, '/');

// `node -e` runs the script in CWD. Use a dynamic import so ESM-only
// dependencies (zod etc.) load correctly under Node's default module
// system regardless of whether the host project is "type":"module".
const childScript = `import('file://${authPath}').then(()=>{process.exit(0)},(e)=>{console.error('child_import_error',e&&e.message||e);process.exit(2)});`;

function runChild(env) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', ['-e', childScript], {
      // Force LOG_LEVEL=info so we capture the warn-level secret
      // resolution messages even if the host shell narrows logging.
      env: { ...process.env, LOG_LEVEL: 'info', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: repoRoot,
    });
    let stderr = '';
    let stdout = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
    proc.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
    const t = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('child_timeout'));
    }, 4500);
    proc.on('close', (code) => {
      clearTimeout(t);
      resolve({ code, stderr, stdout });
    });
    proc.on('error', (err) => {
      clearTimeout(t);
      reject(err);
    });
  });
}

describe('auth.js boot resilience', () => {
  it.concurrent('derives a stable secret from DATABASE_URL when AUTH_SECRET is unset', async () => {
    const out = await runChild({
      NODE_ENV: 'production',
      AUTH_SECRET: '',
      DATABASE_URL: 'postgres://fake@localhost/x',
    });
    expect(out.code).toBe(0);
    const blob = out.stderr + out.stdout;
    expect(blob).toContain('auth.secret_derived_from_db_url');
  }, 5000);

  it.concurrent('falls back to a per-process random secret with no DB and no AUTH_SECRET', async () => {
    const env = {
      NODE_ENV: 'production',
      AUTH_SECRET: '',
    };
    // Explicitly strip anything inherited from the host env that would
    // otherwise mask the random fallback path.
    env.DATABASE_URL = '';
    env.PUBLIC_URL = '';
    const out = await runChild(env);
    expect(out.code).toBe(0);
    const blob = out.stderr + out.stdout;
    expect(blob).toContain('auth.secret_random_fallback');
  }, 5000);

  it.concurrent('uses the configured AUTH_SECRET without warnings', async () => {
    const out = await runChild({
      NODE_ENV: 'production',
      AUTH_SECRET: 'mySecret',
      DATABASE_URL: 'postgres://fake@localhost/x',
    });
    expect(out.code).toBe(0);
    const blob = out.stderr + out.stdout;
    expect(blob).not.toContain('auth.secret_derived_from_db_url');
    expect(blob).not.toContain('auth.secret_random_fallback');
  }, 5000);
});
