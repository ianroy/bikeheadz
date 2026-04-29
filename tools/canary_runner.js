#!/usr/bin/env node
// P4-013 — synthetic canary.
//
// Connects to APP_URL via socket.io-client, fires `stl.generate` with a
// fixture portrait, and asserts that a `stl.generate.result` arrives in
// time and within a sane STL-size envelope.
//
// Wire protocol matches client/socket.js: a single "command" event with
// payload { id, name, payload }. Result frames arrive as
//   { id, name: "stl.generate.result", payload: { bytes, ... } }
// Error frames arrive as
//   { id, name: "stl.generate.error",  payload: { error, ... } }
//
// Exit codes:
//   0 — success, or fixture missing (CI no-op)
//   1 — failure; structured stderr line { ok:false, reason, ms, bytes }
//
// Env knobs (no .env.example edits in this task — caller updates parent):
//   APP_URL                       (required) e.g. https://stemdomez.app
//   CANARY_TOKEN                  optional bearer for socket.io auth
//   CANARY_TIMEOUT_MS             default 300_000 (5 min)
//   CANARY_LATENCY_BUDGET_MS      default  90_000 (1.5 min) — soft p95 budget
//   CANARY_MIN_BYTES              default 200_000
//   CANARY_MAX_BYTES              default 10_000_000

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.resolve(__dirname, 'canary', 'canary-photo.jpg');

const APP_URL              = process.env.APP_URL || '';
const CANARY_TOKEN         = process.env.CANARY_TOKEN || '';
const TIMEOUT_MS           = Number(process.env.CANARY_TIMEOUT_MS) || 300_000;
const LATENCY_BUDGET_MS    = Number(process.env.CANARY_LATENCY_BUDGET_MS) || 90_000;
const MIN_BYTES            = Number(process.env.CANARY_MIN_BYTES) || 200_000;
const MAX_BYTES            = Number(process.env.CANARY_MAX_BYTES) || 10_000_000;

function emitFailure({ reason, ms = 0, bytes = 0 }) {
  process.stderr.write(JSON.stringify({ ok: false, reason, ms, bytes }) + '\n');
}

function emitSuccess({ ms, bytes }) {
  process.stdout.write(JSON.stringify({ ok: true, ms, bytes }) + '\n');
}

async function main() {
  if (!APP_URL) {
    emitFailure({ reason: 'app_url_unset' });
    process.exit(1);
  }

  let imageBuf;
  try {
    imageBuf = await fs.readFile(FIXTURE_PATH);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      // Fixture is purposefully not committed (consented portrait,
      // PII). Treat as a CI no-op so the workflow stays green until
      // ops drops a real photo at tools/canary/canary-photo.jpg.
      process.stdout.write(
        JSON.stringify({ ok: true, skipped: true, reason: 'fixture_missing' }) + '\n'
      );
      process.exit(0);
    }
    emitFailure({ reason: `fixture_read_failed:${err.message}` });
    process.exit(1);
  }

  const auth = CANARY_TOKEN ? { token: CANARY_TOKEN } : undefined;
  const socket = io(APP_URL, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: true,
    auth,
    reconnection: false,
    timeout: 15_000,
  });

  const startedAt = Date.now();
  const id = `canary-${startedAt}-${Math.random().toString(36).slice(2)}`;

  let timer;
  const result = await new Promise((resolve) => {
    timer = setTimeout(() => {
      resolve({ ok: false, reason: 'timeout', ms: Date.now() - startedAt, bytes: 0 });
    }, TIMEOUT_MS);

    socket.on('connect_error', (err) => {
      resolve({
        ok: false,
        reason: `connect_error:${err && err.message ? err.message : 'unknown'}`,
        ms: Date.now() - startedAt,
        bytes: 0,
      });
    });

    socket.on('connect', () => {
      socket.emit('command', {
        id,
        name: 'stl.generate',
        payload: {
          imageData: imageBuf.toString('base64'),
          imageName: 'canary.jpg',
          // Tagged so the server can decide to short-circuit billing,
          // skip emails, mark the design as ephemeral, etc.
          settings: { canary: true },
        },
      });
    });

    socket.on('command', (msg) => {
      if (!msg || msg.id !== id) return;
      if (msg.name === 'stl.generate.result') {
        const ms = Date.now() - startedAt;
        const bytes = Number(msg.payload?.bytes) || 0;
        resolve({ ok: true, ms, bytes });
      } else if (msg.name === 'stl.generate.error') {
        const ms = Date.now() - startedAt;
        resolve({
          ok: false,
          reason: `server_error:${msg.payload?.error || 'unknown'}`,
          ms,
          bytes: 0,
        });
      }
    });
  });

  clearTimeout(timer);
  try { socket.close(); } catch { /* noop */ }

  if (!result.ok) {
    emitFailure(result);
    process.exit(1);
  }

  if (result.bytes < MIN_BYTES) {
    emitFailure({ reason: 'bytes_below_floor', ms: result.ms, bytes: result.bytes });
    process.exit(1);
  }
  if (result.bytes > MAX_BYTES) {
    emitFailure({ reason: 'bytes_above_ceiling', ms: result.ms, bytes: result.bytes });
    process.exit(1);
  }
  if (result.ms > LATENCY_BUDGET_MS) {
    // Soft budget violation still fails the canary — anything routinely
    // slipping past p95 is a regression we want to see.
    emitFailure({ reason: 'over_latency_budget', ms: result.ms, bytes: result.bytes });
    process.exit(1);
  }

  emitSuccess(result);
  process.exit(0);
}

main().catch((err) => {
  emitFailure({ reason: `uncaught:${err && err.message ? err.message : 'unknown'}` });
  process.exit(1);
});
