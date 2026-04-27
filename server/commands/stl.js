import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../logger.js';
import { db, hasDb } from '../db.js';
import { designStore } from '../design-store.js';
import { runpodEnabled, runRunpod } from '../workers/runpod-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER = path.resolve(__dirname, '..', 'workers', 'trellis_generate.py');
const VALVE_CAP = path.resolve(__dirname, '..', 'assets', 'valve_cap.stl');
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';
const TRELLIS_ENABLED = (process.env.TRELLIS_ENABLED || 'true').toLowerCase() !== 'false';

// Command: stl.generate
//
// Request payload:
//   { imageData: <base64|ArrayBuffer>, imageName: string, settings: {...} }
//
// Streams { step, pct } frames over stl.generate.progress, then resolves with
// { designId, filename, triangles }. The raw STL bytes are NOT shipped over
// the wire — they're persisted server-side and fetched later via
// stl.download (post-payment) or payments.verifySession.
//
// Backend selection (decided per-request, so ops can flip without a restart):
//   • if RUNPOD_ENDPOINT_URL + RUNPOD_API_KEY are set → call RunPod
//     Serverless (handler.py at repo root, real TRELLIS on GPU).
//   • otherwise → spawn the local Python worker
//     (server/workers/trellis_generate.py — honours TRELLIS_ENABLED).
export const stlCommands = {
  'stl.generate': async ({ socket, id, payload }) => {
    const { imageData, imageName = 'photo.png', settings = {} } = payload || {};
    if (!imageData) throw new Error('image_required');

    const designId = randomUUID();
    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bikeheadz-'));
    const imagePath = path.join(workDir, sanitizeFilename(imageName));
    const outputPath = path.join(workDir, `${designId}.stl`);

    try {
      const imageBuf = decodeImage(imageData);
      await fs.writeFile(imagePath, imageBuf);

      let stlBytes;
      if (runpodEnabled()) {
        logger.info({ msg: 'stl.backend', backend: 'runpod' });
        stlBytes = await runRunpod({ socket, commandId: id, imageBuf, settings });
      } else {
        logger.info({ msg: 'stl.backend', backend: 'local_spawn', trellis_enabled: TRELLIS_ENABLED });
        await runLocalWorker({
          socket,
          commandId: id,
          cfg: {
            image_path: imagePath,
            valve_cap_path: VALVE_CAP,
            output_path: outputPath,
            head_scale: Number(settings.headScale) || 1.0,
            neck_length_mm: Number(settings.neckLength) || 50,
            head_tilt_deg: Number(settings.headTilt) || 0,
            seed: 1,
          },
        });
        stlBytes = await fs.readFile(outputPath);
      }

      const filename = 'BikeHeadz_ValveStem.stl';
      await designStore.save({
        id: designId,
        stl: stlBytes,
        filename,
        settings,
        photoName: imageName,
      });

      logger.info({ msg: 'stl.generated', designId, bytes: stlBytes.length });
      return {
        designId,
        filename,
        triangles: countTriangles(stlBytes),
        bytes: stlBytes.length,
        // Base64 of the raw STL so the client can render the real mesh in
        // the 3D viewer immediately, without waiting for purchase. The
        // post-payment download path still goes through stl.download.
        stl_b64: stlBytes.toString('base64'),
      };
    } finally {
      fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  },

  // Fetches an STL for a design the client has already purchased.
  'stl.download': async ({ payload }) => {
    const { designId, sessionId } = payload || {};
    if (!designId) throw new Error('designId_required');

    if (!hasDb()) {
      const cached = await designStore.get(designId);
      if (!cached) throw new Error('design_not_found');
      return { filename: cached.filename, stl: cached.stl.toString('utf8') };
    }

    const { rows } = await db.query(
      `SELECT status FROM purchases
        WHERE design_id = $1 AND status = 'paid'
          AND (stripe_session_id = $2 OR $2 IS NULL)
        LIMIT 1`,
      [designId, sessionId || null]
    );
    if (!rows.length) throw new Error('payment_required');

    const cached = await designStore.get(designId);
    if (!cached) throw new Error('design_expired');
    return { filename: cached.filename, stl: cached.stl.toString('utf8') };
  },
};

// ---- Local spawn path (dev + CPU-only deployments) -------------------------

function runLocalWorker({ socket, commandId, cfg }) {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_BIN, [WORKER], {
      env: { ...process.env, TRELLIS_ENABLED: String(TRELLIS_ENABLED) },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderrBuf = '';
    let stdoutBuf = '';
    let resolvedResult = null;

    child.stdout.on('data', (chunk) => {
      stdoutBuf += chunk.toString('utf8');
      let idx;
      while ((idx = stdoutBuf.indexOf('\n')) !== -1) {
        const line = stdoutBuf.slice(0, idx).trim();
        stdoutBuf = stdoutBuf.slice(idx + 1);
        if (!line) continue;
        let frame;
        try { frame = JSON.parse(line); } catch { continue; }
        if (frame.type === 'progress') {
          socket.emit('command', {
            id: commandId,
            name: 'stl.generate.progress',
            payload: { step: frame.step, pct: frame.pct },
          });
        } else if (frame.type === 'result') {
          resolvedResult = frame;
        } else if (frame.type === 'error') {
          reject(new Error(frame.error || 'worker_error'));
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      stderrBuf += chunk.toString('utf8');
      logger.debug({ msg: 'worker.stderr', chunk: chunk.toString('utf8').trim() });
    });

    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (resolvedResult) return resolve(resolvedResult);
      if (code === 0) return resolve({ type: 'result' });
      reject(new Error(`worker_exited_${code}: ${stderrBuf.slice(0, 500)}`));
    });

    child.stdin.write(JSON.stringify(cfg) + '\n');
    child.stdin.end();
  });
}

// ---- Helpers ---------------------------------------------------------------

function decodeImage(data) {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data);
  if (typeof data === 'string') {
    const comma = data.indexOf(',');
    const b64 = comma >= 0 && data.startsWith('data:') ? data.slice(comma + 1) : data;
    return Buffer.from(b64, 'base64');
  }
  if (data && typeof data === 'object' && 'type' in data && data.type === 'Buffer' && Array.isArray(data.data)) {
    return Buffer.from(data.data);
  }
  throw new Error('unsupported_image_encoding');
}

function sanitizeFilename(name) {
  return String(name).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120) || 'photo.png';
}

function countTriangles(stl) {
  const ascii = stl.subarray(0, 80).toString('ascii');
  if (ascii.trimStart().startsWith('solid')) {
    return (stl.toString('utf8').match(/facet normal/g) || []).length;
  }
  if (stl.length >= 84) return stl.readUInt32LE(80);
  return 0;
}
