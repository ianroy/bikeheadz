// P1-006 — photo library. List + delete; saves happen as a side-effect of
// stl.generate so an explicit `photos.upload` command is unnecessary.
//
// Privacy: we hash for dedup but do NOT keep any EXIF metadata; the worker
// (and stl.generate) is responsible for stripping bytes-level EXIF before
// the photo lands here.

import { z } from 'zod';
import { db, hasDb } from '../db.js';
import { requireAuth } from '../auth.js';
import { CommandError, ErrorCode } from '../errors.js';
import { recordAudit } from '../audit.js';

const PageSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(12),
});

const IdSchema = z.object({
  id: z.string().uuid(),
});

export const photosCommands = {
  'photos.list': async ({ socket, payload }) => {
    const user = requireAuth({ socket });
    const { page, pageSize } = PageSchema.parse(payload || {});
    if (!hasDb()) return { rows: [], page, pageSize };
    const offset = (page - 1) * pageSize;
    const { rows } = await db.query(
      `SELECT id, sha256, filename, size_bytes, uploaded_at, last_used_at,
              expires_at
         FROM user_photos
        WHERE account_id = $1 AND expires_at > NOW()
        ORDER BY last_used_at DESC
        LIMIT $2 OFFSET $3`,
      [user.id, pageSize, offset]
    );
    return { rows, page, pageSize };
  },

  'photos.delete': async ({ socket, payload }) => {
    const user = requireAuth({ socket });
    const parsed = IdSchema.safeParse(payload);
    if (!parsed.success) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid', parsed.error.issues);
    if (!hasDb()) return { ok: true };
    await db.query(`DELETE FROM user_photos WHERE id = $1 AND account_id = $2`, [parsed.data.id, user.id]);
    await recordAudit({
      actorId: user.id,
      action: 'photo.delete',
      targetType: 'photo',
      targetId: parsed.data.id,
    });
    return { ok: true };
  },
};
