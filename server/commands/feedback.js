// P3-011 — post-generation feedback (👍/❤️/🤷).
//
// Two commands:
//   feedback.submit({ designId, rating, reason? })
//     Open to anonymous callers. Rating is up/down/meh. Reason capped at
//     280 chars. Inserts into design_feedback (table lives in migration
//     004). UNIQUE(design_id, account_id) means an authed user gets
//     upsert-like semantics on subsequent ratings; anonymous (account_id
//     NULL) submits stack because Postgres treats NULLs as distinct in
//     unique indexes — that's intentional, the client gates duplicates.
//
//   feedback.get({ designId })
//     Auth required. Returns the calling user's own row, or null. We
//     deliberately do NOT expose anyone else's rating — that's the admin
//     surface's job.

import { z } from 'zod';
import { db, hasDb } from '../db.js';
import { maybeUser, requireAuth } from '../auth.js';
import { CommandError, ErrorCode } from '../errors.js';
import { logger } from '../logger.js';

const SubmitSchema = z.object({
  designId: z.string().uuid(),
  rating: z.enum(['up', 'down', 'meh']),
  reason: z.string().max(280).optional(),
});

const GetSchema = z.object({
  designId: z.string().uuid(),
});

// In-memory fallback so dev/test without a DB still exercises the
// feedback path. Keyed by `${designId}|${accountId ?? 'anon'}`.
const MEMORY_FEEDBACK = new Map();

export const feedbackCommands = {
  'feedback.submit': async ({ socket, payload }) => {
    const parsed = SubmitSchema.safeParse(payload);
    if (!parsed.success) {
      throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid', parsed.error.issues);
    }
    const { designId, rating, reason = null } = parsed.data;
    const user = maybeUser({ socket });
    const accountId = user?.id || null;

    if (!hasDb()) {
      const key = `${designId}|${accountId ?? 'anon'}`;
      MEMORY_FEEDBACK.set(key, {
        designId,
        accountId,
        rating,
        reason,
        createdAt: new Date(),
      });
      return { ok: true };
    }

    try {
      // For authed users, upsert on (design_id, account_id) so they can
      // change their mind. For anonymous callers, account_id is NULL and
      // Postgres treats those as distinct so each click stacks — that's
      // fine, the client suppresses duplicates.
      if (accountId != null) {
        await db.query(
          `INSERT INTO design_feedback (design_id, account_id, rating, reason)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (design_id, account_id)
           DO UPDATE SET rating = EXCLUDED.rating, reason = EXCLUDED.reason`,
          [designId, accountId, rating, reason]
        );
      } else {
        await db.query(
          `INSERT INTO design_feedback (design_id, account_id, rating, reason)
           VALUES ($1, NULL, $2, $3)`,
          [designId, rating, reason]
        );
      }
    } catch (err) {
      logger.warn({ msg: 'feedback.submit_failed', err: err.message });
      throw new CommandError(ErrorCode.INTERNAL_ERROR, 'feedback_insert_failed');
    }
    return { ok: true };
  },

  'feedback.get': async ({ socket, payload }) => {
    const user = requireAuth({ socket });
    const parsed = GetSchema.safeParse(payload);
    if (!parsed.success) {
      throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid', parsed.error.issues);
    }
    const { designId } = parsed.data;

    if (!hasDb()) {
      const row = MEMORY_FEEDBACK.get(`${designId}|${user.id}`);
      return row ? { rating: row.rating, reason: row.reason } : null;
    }

    const { rows } = await db.query(
      `SELECT rating, reason FROM design_feedback
        WHERE design_id = $1 AND account_id = $2
        LIMIT 1`,
      [designId, user.id]
    );
    if (!rows.length) return null;
    return { rating: rows[0].rating, reason: rows[0].reason };
  },
};
