// P1-003 / P1-005 / P5-001 / P5-002 / P5-003 — design listings.
//
// `designs.list` shows the current user's designs (the legacy hardcoded
// `designs` table is still queryable for back-compat with the demo
// dataset). `designs.listMine` is the authoritative paginated user
// gallery against `generated_designs`.
//
// `designs.listPublic` powers the public showcase (P5-001 / P5-005).
// Share permalinks (P5-002) and remixes (P5-003) live here too.

import { z } from 'zod';
import { createHmac } from 'node:crypto';
import { db, hasDb } from '../db.js';
import { maybeUser, requireAuth } from '../auth.js';
import { CommandError, ErrorCode } from '../errors.js';
import { recordAudit } from '../audit.js';
import { designStore } from '../design-store.js';

// No demo gallery for anonymous visitors. The "Alex's Head / Jordan
// Stem / Sam Rider" stub leaked into production and made /account
// look populated for guests; the SPA now renders a proper "Sign in"
// empty state for anonymous callers.

const PageSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(48).default(12),
});

const ShareSecret =
  process.env.SHARE_LINK_SECRET ||
  process.env.AUTH_SECRET ||
  'dev-share-secret-do-not-use-in-prod';

function signShare(designId) {
  return createHmac('sha256', ShareSecret).update(designId).digest('base64url').slice(0, 24);
}

export const designsCommands = {
  // Lightweight gallery used by the home/account headers. Empty for
  // anonymous callers, the user's real designs otherwise.
  'designs.list': async ({ socket }) => {
    const user = maybeUser({ socket });
    if (!user || !hasDb()) return [];
    const { rows } = await db.query(
      `SELECT id::text,
              photo_name AS name,
              to_char(created_at, 'Mon DD, YYYY') AS date,
              'chrome' AS material,
              5 AS stars,
              NULL::text AS thumbnail
         FROM generated_designs
        WHERE account_id = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [user.id]
    );
    return rows;
  },

  // P1-005 — paginated authoritative gallery for /account.
  'designs.listMine': async ({ socket, payload }) => {
    const user = requireAuth({ socket });
    const { page, pageSize } = PageSchema.parse(payload || {});
    if (!hasDb()) return { rows: [], page, pageSize };
    const offset = (page - 1) * pageSize;
    const { rows } = await db.query(
      `SELECT id, filename, photo_name, settings, photo_id, is_public,
              to_char(created_at, 'Mon DD, YYYY') AS date,
              created_at, expires_at, pipeline_version,
              -- v0.1.42 dual-output flags. has_head_stl is FALSE for
              -- legacy designs (created pre-migration 008) and the UI
              -- greycaps the "Head only" button for them. final_failed
              -- is TRUE when the boolean phase couldn't seat the cap;
              -- the UI greycaps "Full STL" and shows the apology copy.
              (head_stl_bytes IS NOT NULL) AS has_head_stl,
              final_failed,
              final_error,
              (SELECT EXISTS (
                 SELECT 1 FROM purchases p
                  WHERE p.design_id = generated_designs.id AND p.status = 'paid'
              )) AS paid
         FROM generated_designs
        WHERE account_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      [user.id, pageSize, offset]
    );
    return { rows, page, pageSize };
  },

  // P5-001 — public gallery.
  'designs.listPublic': async ({ payload }) => {
    const { page, pageSize } = PageSchema.parse(payload || {});
    if (!hasDb()) return { rows: [], page, pageSize };
    const offset = (page - 1) * pageSize;
    const { rows } = await db.query(
      `SELECT gd.id, gd.filename, gd.created_at, a.username, a.display_name, a.avatar
         FROM generated_designs gd
         LEFT JOIN accounts a ON a.id = gd.account_id
        WHERE gd.is_public = TRUE
        ORDER BY gd.created_at DESC
        LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );
    return { rows, page, pageSize };
  },

  // P5-001 — opt-in public toggle.
  'designs.setPublic': async ({ socket, payload }) => {
    const user = requireAuth({ socket });
    const Schema = z.object({ designId: z.string().uuid(), isPublic: z.boolean() });
    const parsed = Schema.safeParse(payload);
    if (!parsed.success) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid', parsed.error.issues);
    if (!hasDb()) return { ok: true };
    const { rowCount } = await db.query(
      `UPDATE generated_designs SET is_public = $1 WHERE id = $2 AND account_id = $3`,
      [parsed.data.isPublic, parsed.data.designId, user.id]
    );
    if (!rowCount) throw new CommandError(ErrorCode.DESIGN_NOT_FOUND, 'design_not_found');
    await recordAudit({
      actorId: user.id,
      action: parsed.data.isPublic ? 'design.publish' : 'design.unpublish',
      targetType: 'design',
      targetId: parsed.data.designId,
    });
    return { ok: true };
  },

  // P5-002 — share permalink (HMAC, no DB row needed).
  'designs.createShareLink': async ({ socket, payload }) => {
    const user = requireAuth({ socket });
    const Schema = z.object({ designId: z.string().uuid() });
    const parsed = Schema.safeParse(payload);
    if (!parsed.success) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid', parsed.error.issues);
    const exists = hasDb()
      ? (
          await db.query(
            `SELECT 1 FROM generated_designs WHERE id = $1 AND account_id = $2`,
            [parsed.data.designId, user.id]
          )
        ).rowCount > 0
      : await designStore.exists(parsed.data.designId);
    if (!exists) throw new CommandError(ErrorCode.DESIGN_NOT_FOUND, 'design_not_found');
    const sig = signShare(parsed.data.designId);
    return { token: `${parsed.data.designId}.${sig}`, designId: parsed.data.designId };
  },

  // P5-002 — preview a shared design (no STL bytes, just metadata + thumb).
  'designs.openShareLink': async ({ payload }) => {
    const Schema = z.object({ token: z.string().min(20).max(96) });
    const parsed = Schema.safeParse(payload);
    if (!parsed.success) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid', parsed.error.issues);
    const dot = parsed.data.token.indexOf('.');
    if (dot < 0) throw new CommandError(ErrorCode.INVALID_TOKEN, 'invalid_share_token');
    const designId = parsed.data.token.slice(0, dot);
    const sig = parsed.data.token.slice(dot + 1);
    if (sig !== signShare(designId)) throw new CommandError(ErrorCode.INVALID_TOKEN, 'invalid_share_token');
    if (!hasDb()) {
      const cached = await designStore.get(designId);
      if (!cached) throw new CommandError(ErrorCode.DESIGN_NOT_FOUND, 'design_not_found');
      return { designId, filename: cached.filename, settings: cached.settings, displayName: 'A rider' };
    }
    const { rows } = await db.query(
      `SELECT gd.id, gd.filename, gd.settings, a.display_name, a.username, a.avatar
         FROM generated_designs gd
         LEFT JOIN accounts a ON a.id = gd.account_id
        WHERE gd.id = $1 AND gd.expires_at > NOW()
        LIMIT 1`,
      [designId]
    );
    if (!rows.length) throw new CommandError(ErrorCode.DESIGN_NOT_FOUND, 'design_not_found');
    return {
      designId: rows[0].id,
      filename: rows[0].filename,
      settings: rows[0].settings,
      displayName: rows[0].display_name || 'A rider',
      username: rows[0].username || null,
      avatar: rows[0].avatar || { kind: 'identicon' },
    };
  },

  // Legacy save/delete (demo / curator workflow).
  'designs.save': async ({ payload }) => {
    const Schema = z.object({
      name: z.string().min(1).max(120),
      thumbnail: z.string().nullable().optional(),
      material: z.enum(['matte', 'gloss', 'chrome']).default('chrome'),
      stars: z.number().int().min(0).max(5).default(5),
      settings: z.record(z.any()).optional(),
    });
    const parsed = Schema.safeParse(payload);
    if (!parsed.success) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid', parsed.error.issues);
    const { name, thumbnail = null, material, stars, settings = {} } = parsed.data;
    if (!hasDb()) return { id: String(Date.now()), name, material, stars, thumbnail };
    const { rows } = await db.query(
      `INSERT INTO designs (name, thumbnail_url, material, stars, settings)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id::text, name,
                 to_char(created_at, 'Mon DD, YYYY') AS date,
                 thumbnail_url AS thumbnail, material, stars`,
      [name, thumbnail, material, stars, settings]
    );
    return rows[0];
  },

  'designs.delete': async ({ socket, payload }) => {
    const user = maybeUser({ socket });
    const Schema = z.object({ id: z.string() });
    const parsed = Schema.safeParse(payload);
    if (!parsed.success) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid', parsed.error.issues);
    if (!hasDb()) return { ok: true };
    if (user && /^[0-9a-f-]{36}$/i.test(parsed.data.id)) {
      await db.query(`DELETE FROM generated_designs WHERE id = $1 AND account_id = $2`, [
        parsed.data.id,
        user.id,
      ]);
    } else {
      await db.query(`DELETE FROM designs WHERE id = $1`, [parsed.data.id]);
    }
    return { ok: true };
  },

};
