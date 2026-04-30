import { spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { logger } from '../logger.js';
import { db, hasDb } from '../db.js';
import { designStore } from '../design-store.js';
import { runpodEnabled, runRunpod } from '../workers/runpod-client.js';
import { stlGenerateLimiter } from '../rate-limit.js';
import { CommandError, ErrorCode } from '../errors.js';
import { maybeUser, requireAuth } from '../auth.js';
import { paymentsEnabled } from '../app-config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER = path.resolve(__dirname, '..', 'workers', 'trellis_generate.py');
const VALVE_CAP = path.resolve(__dirname, '..', 'assets', 'valve_cap.stl');
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';
const TRELLIS_ENABLED = (process.env.TRELLIS_ENABLED || 'true').toLowerCase() !== 'false';
const MAX_IMAGE_BYTES = Number(process.env.MAX_IMAGE_BYTES) || 5 * 1024 * 1024;

// P0-012: settings/payload schema. Slider bounds match what's safe for the
// post-processing pipeline; exceeding them either silently clamps (current
// worker behaviour) or causes pymeshlab crashes (we want to reject upfront).
const SettingsSchema = z
  .object({
    headScale: z.number().min(0.5).max(2.0).optional(),
    neckLength: z.number().min(20).max(120).optional(),
    headTilt: z.number().min(-30).max(30).optional(),
    targetHeadHeightMm: z.number().min(22).max(42).optional(),
    cropTightness: z.number().min(0.4).max(0.85).optional(),
    capProtrusion: z.number().min(0).max(8).optional(),
    autoIsolate: z.boolean().optional(),
    variants: z.union([z.literal(1), z.literal(3)]).optional(),
    material: z.enum(['matte', 'gloss', 'chrome']).optional(),
    seed: z.number().int().min(0).max(2 ** 31 - 1).optional(),
  })
  .passthrough();

const PayloadSchema = z.object({
  imageData: z.union([z.string(), z.instanceof(Uint8Array), z.any()]),
  imageName: z.string().max(255).optional(),
  photoId: z.string().uuid().optional(),
  settings: SettingsSchema.optional(),
});

// Command: stl.generate
//
// Request payload:
//   { imageData: <base64|ArrayBuffer>, imageName: string, settings: {...} }
//   (alternative) { photoId: <uuid>, settings: {...} } when re-generating
//   from a saved photo (P3-010, requires auth).
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
    const parsed = PayloadSchema.safeParse(payload || {});
    if (!parsed.success) {
      throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid_stl_payload', parsed.error.issues);
    }
    const { imageName: imageNameRaw = 'photo.png', settings = {} } = parsed.data;
    const photoId = parsed.data.photoId;
    let imageData = parsed.data.imageData;

    const ip =
      socket?.handshake?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
      socket?.handshake?.address ||
      'unknown';
    stlGenerateLimiter({ socketId: socket.id, ip });

    const user = maybeUser({ socket });
    let imageBuf;
    let imageName = imageNameRaw;

    if (photoId) {
      if (!user) throw new CommandError(ErrorCode.AUTH_REQUIRED, 'auth_required_for_photo_id');
      if (!hasDb()) throw new CommandError(ErrorCode.PHOTO_NOT_FOUND, 'photo_not_found');
      const { rows } = await db.query(
        `SELECT image_b64, filename FROM user_photos WHERE id = $1 AND account_id = $2 AND expires_at > NOW()`,
        [photoId, user.id]
      );
      if (!rows.length) throw new CommandError(ErrorCode.PHOTO_NOT_FOUND, 'photo_not_found');
      imageBuf = rows[0].image_b64;
      imageName = rows[0].filename || imageName;
      // touch last_used_at
      db.query(`UPDATE user_photos SET last_used_at = NOW() WHERE id = $1`, [photoId]).catch(() => {});
    } else {
      if (!imageData) throw new CommandError(ErrorCode.IMAGE_REQUIRED, 'image_required');
      imageBuf = decodeImage(imageData);
    }

    if (imageBuf.length > MAX_IMAGE_BYTES) {
      throw new CommandError(ErrorCode.IMAGE_TOO_LARGE, 'image_too_large', {
        sizeBytes: imageBuf.length,
        maxBytes: MAX_IMAGE_BYTES,
      });
    }

    const designId = randomUUID();
    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stemdomez-'));
    const imagePath = path.join(workDir, sanitizeFilename(imageName));
    const outputPath = path.join(workDir, `${designId}.stl`);

    try {
      await fs.writeFile(imagePath, imageBuf);

      let stlBytes;
      let backend;
      if (runpodEnabled()) {
        backend = 'runpod';
        logger.info({ msg: 'stl.backend', backend });
        stlBytes = await runRunpod({ socket, commandId: id, imageBuf, settings });
      } else {
        backend = 'local_spawn';
        logger.info({ msg: 'stl.backend', backend, trellis_enabled: TRELLIS_ENABLED });
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
            seed: Number(settings.seed) || 1,
          },
        });
        stlBytes = await fs.readFile(outputPath);
      }

      const filename = 'StemDomeZ_ValveStem.stl';
      const accountId = user?.id ?? null;
      let savedPhotoId = photoId || null;

      // Persist photo (P1-006) when an authenticated user uploaded fresh bytes.
      if (user && !photoId && hasDb()) {
        try {
          const sha = createHash('sha256').update(imageBuf).digest('hex');
          const { rows } = await db.query(
            `INSERT INTO user_photos (id, account_id, image_b64, sha256, filename, size_bytes)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
             ON CONFLICT (account_id, sha256) DO UPDATE SET last_used_at = NOW()
             RETURNING id`,
            [user.id, imageBuf, sha, imageName, imageBuf.length]
          );
          savedPhotoId = rows[0].id;
        } catch (err) {
          logger.warn({ msg: 'stl.photo_persist_failed', err: err.message });
        }
      }

      await designStore.save({
        id: designId,
        stl: stlBytes,
        filename,
        settings,
        photoName: imageName,
        accountId,
        photoId: savedPhotoId,
      });

      logger.info({ msg: 'stl.generated', designId, bytes: stlBytes.length, backend, accountId });
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
  //
  // Returns the STL as base64 (`stl_b64`) so binary STLs survive the JSON
  // round-trip. The previous `stl: cached.stl.toString('utf8')` shape
  // assumed ASCII STL — fine in 2024 when trimesh's default merge produced
  // ASCII output, but the upcoming pipeline (3D_Pipeline.md Phase 2) emits
  // binary STL via manifold3d, and `.toString('utf8')` corrupts those
  // bytes. The client decodes base64 → Uint8Array → Blob in
  // client/pages/checkout-return.js:triggerDownload.
  'stl.download': async ({ socket, payload }) => {
    const Schema = z.object({
      designId: z.string().uuid(),
      sessionId: z.string().optional(),
    });
    const parsed = Schema.safeParse(payload || {});
    if (!parsed.success) {
      throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid_download_payload', parsed.error.issues);
    }
    const { designId, sessionId = null } = parsed.data;

    if (!hasDb()) {
      const cached = await designStore.get(designId);
      if (!cached) throw new CommandError(ErrorCode.DESIGN_NOT_FOUND, 'design_not_found');
      return { filename: cached.filename, stl_b64: cached.stl.toString('base64') };
    }

    const user = maybeUser({ socket });
    const { rows } = await db.query(
      `SELECT p.status, gd.account_id
         FROM purchases p
         JOIN generated_designs gd ON gd.id = p.design_id
        WHERE p.design_id = $1 AND p.status = 'paid'
          AND (p.stripe_session_id = $2 OR $2 IS NULL)
        LIMIT 1`,
      [designId, sessionId]
    );
    if (!rows.length) throw new CommandError(ErrorCode.PAYMENT_REQUIRED, 'payment_required');
    if (rows[0].account_id != null && user && rows[0].account_id !== user.id) {
      throw new CommandError(ErrorCode.AUTH_REQUIRED, 'design_belongs_to_other_user');
    }

    const cached = await designStore.get(designId);
    if (!cached) throw new CommandError(ErrorCode.DESIGN_EXPIRED, 'design_expired');
    return { filename: cached.filename, stl_b64: cached.stl.toString('base64') };
  },

  // MVP launch — free STL download for logged-in users when the
  // payments_enabled flag is OFF. Refuses unless (a) the admin has
  // disabled payments, (b) the caller is logged in, and (c) the design
  // belongs to that account.
  'stl.downloadFree': async ({ socket, payload }) => {
    if (await paymentsEnabled()) {
      throw new CommandError(ErrorCode.PAYMENT_REQUIRED, 'payments_enabled');
    }
    const user = requireAuth({ socket });
    const Schema = z.object({ designId: z.string().uuid() });
    const parsed = Schema.safeParse(payload || {});
    if (!parsed.success) {
      throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid_download_payload', parsed.error.issues);
    }
    const { designId } = parsed.data;
    const cached = await designStore.get(designId);
    if (!cached) throw new CommandError(ErrorCode.DESIGN_NOT_FOUND, 'design_not_found');
    if (cached.accountId != null && cached.accountId !== user.id) {
      throw new CommandError(ErrorCode.AUTH_REQUIRED, 'design_belongs_to_other_user');
    }
    return { filename: cached.filename, stl_b64: cached.stl.toString('base64') };
  },

  // P3-011 — single-tap rating per design.
  'designs.rate': async ({ socket, payload }) => {
    const Schema = z.object({
      designId: z.string().uuid(),
      rating: z.enum(['up', 'meh', 'down']),
      reason: z.string().max(500).optional(),
    });
    const parsed = Schema.safeParse(payload);
    if (!parsed.success) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid', parsed.error.issues);
    const user = maybeUser({ socket });
    if (!hasDb()) return { ok: true };
    await db.query(
      `INSERT INTO design_feedback (design_id, account_id, rating, reason)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (design_id, account_id) DO UPDATE SET rating = EXCLUDED.rating, reason = EXCLUDED.reason`,
      [parsed.data.designId, user?.id || null, parsed.data.rating, parsed.data.reason || null]
    );
    return { ok: true };
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
        try {
          frame = JSON.parse(line);
        } catch {
          continue;
        }
        if (frame.type === 'progress') {
          socket.emit('command', {
            id: commandId,
            name: 'stl.generate.progress',
            payload: { step: frame.step, pct: frame.pct },
          });
        } else if (frame.type === 'warning') {
          // P3-007 — surface stage warnings to the client.
          socket.emit('command', {
            id: commandId,
            name: 'stl.generate.warning',
            payload: { stage: frame.stage, message: frame.message, detail: frame.detail || null },
          });
        } else if (frame.type === 'result') {
          resolvedResult = frame;
        } else if (frame.type === 'error') {
          reject(new CommandError(ErrorCode.WORKER_FAILED, frame.error || 'worker_error'));
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
      reject(
        new CommandError(
          ErrorCode.WORKER_FAILED,
          `worker_exited_${code}: ${stderrBuf.slice(0, 500)}`
        )
      );
    });

    child.stdin.write(JSON.stringify(cfg) + '\n');
    child.stdin.end();
  });
}

// ---- Helpers ---------------------------------------------------------------

export function decodeImage(data) {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data);
  if (typeof data === 'string') {
    const comma = data.indexOf(',');
    const b64 = comma >= 0 && data.startsWith('data:') ? data.slice(comma + 1) : data;
    return Buffer.from(b64, 'base64');
  }
  if (
    data &&
    typeof data === 'object' &&
    'type' in data &&
    data.type === 'Buffer' &&
    Array.isArray(data.data)
  ) {
    return Buffer.from(data.data);
  }
  throw new Error('unsupported_image_encoding');
}

export function sanitizeFilename(name) {
  return String(name).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120) || 'photo.png';
}

export function countTriangles(stl) {
  const ascii = stl.subarray(0, 80).toString('ascii');
  if (ascii.trimStart().startsWith('solid')) {
    return (stl.toString('utf8').match(/facet normal/g) || []).length;
  }
  if (stl.length >= 84) return stl.readUInt32LE(80);
  return 0;
}
