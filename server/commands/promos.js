// P2-011 — promo / discount codes (admin-managed; users redeem via the
// existing payments.createCheckoutSession `promo` argument).
// P2-012 — comp / free-grant flow (admin only, no Stripe involvement).

import { z } from 'zod';
import { db, hasDb } from '../db.js';
import { requireAdmin } from '../auth.js';
import { recordAudit } from '../audit.js';
import { CommandError, ErrorCode } from '../errors.js';
import { designStore } from '../design-store.js';
import { sendEmail } from '../email.js';
import { logger } from '../logger.js';

const CreateSchema = z.object({
  code: z.string().min(2).max(64).regex(/^[A-Z0-9_-]+$/i),
  percent_off: z.number().int().min(1).max(100).optional(),
  amount_off: z.number().int().min(1).max(100_000).optional(),
  max_uses: z.number().int().min(1).optional(),
  expires_at: z.string().datetime().optional(),
  scope: z.record(z.any()).optional(),
});

const ExpireSchema = z.object({ code: z.string().min(2).max(64) });

const CompSchema = z.object({
  designId: z.string().uuid(),
  reason: z.string().min(1).max(280),
  email: z.string().email().optional(),
});

export const promosCommands = {
  'promos.create': async ({ socket, payload }) => {
    const actor = requireAdmin({ socket });
    const parsed = CreateSchema.safeParse(payload);
    if (!parsed.success) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid', parsed.error.issues);
    if (!parsed.data.percent_off && !parsed.data.amount_off) {
      throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'percent_or_amount_required');
    }
    if (!hasDb()) return { ok: true, code: parsed.data.code.toUpperCase() };
    const code = parsed.data.code.toUpperCase();
    await db.query(
      `INSERT INTO promo_codes (code, percent_off, amount_off, max_uses, expires_at, scope, created_by)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6,'{}'::jsonb), $7)
       ON CONFLICT (code) DO NOTHING`,
      [
        code,
        parsed.data.percent_off || null,
        parsed.data.amount_off || null,
        parsed.data.max_uses || null,
        parsed.data.expires_at || null,
        parsed.data.scope ? JSON.stringify(parsed.data.scope) : null,
        actor.id,
      ]
    );
    await recordAudit({ actorId: actor.id, action: 'promo.create', targetType: 'promo', targetId: code });
    return { ok: true, code };
  },

  'promos.list': async ({ socket }) => {
    requireAdmin({ socket });
    if (!hasDb()) return { rows: [] };
    const { rows } = await db.query(
      `SELECT code, percent_off, amount_off, max_uses, used_count,
              expires_at, scope, created_at
         FROM promo_codes ORDER BY created_at DESC LIMIT 200`
    );
    return { rows };
  },

  'promos.expire': async ({ socket, payload }) => {
    const actor = requireAdmin({ socket });
    const parsed = ExpireSchema.safeParse(payload);
    if (!parsed.success) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid', parsed.error.issues);
    if (!hasDb()) return { ok: true };
    await db.query(`UPDATE promo_codes SET expires_at = NOW() WHERE code = $1`, [parsed.data.code.toUpperCase()]);
    await recordAudit({
      actorId: actor.id,
      action: 'promo.expire',
      targetType: 'promo',
      targetId: parsed.data.code.toUpperCase(),
    });
    return { ok: true };
  },

  // P2-012 — free grant. Comps live entirely in our DB (no Stripe roundtrip).
  // Marks a design as paid via a synthetic purchases row with product='comp_grant'.
  'purchases.comp': async ({ socket, payload }) => {
    const actor = requireAdmin({ socket });
    const parsed = CompSchema.safeParse(payload);
    if (!parsed.success) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid', parsed.error.issues);
    const exists = await designStore.exists(parsed.data.designId);
    if (!exists) throw new CommandError(ErrorCode.DESIGN_NOT_FOUND, 'design_not_found');

    if (!hasDb()) {
      logger.info({ msg: 'comp.memory', designId: parsed.data.designId, reason: parsed.data.reason });
      return { ok: true };
    }

    // synthetic stripe_session_id with comp_ prefix to satisfy UNIQUE constraint
    const fakeSession = `comp_${Date.now()}_${parsed.data.designId.slice(0, 8)}`;
    await db.query(
      `INSERT INTO purchases (design_id, stripe_session_id, amount_cents, currency, status, product, customer_email, paid_at, metadata)
       VALUES ($1, $2, 0, 'usd', 'paid', 'comp_grant', $3, NOW(), $4)`,
      [
        parsed.data.designId,
        fakeSession,
        parsed.data.email || null,
        JSON.stringify({ reason: parsed.data.reason, granted_by: actor.id }),
      ]
    );
    await recordAudit({
      actorId: actor.id,
      action: 'purchase.comp',
      targetType: 'design',
      targetId: parsed.data.designId,
      metadata: { reason: parsed.data.reason },
    });

    if (parsed.data.email) {
      const entry = await designStore.get(parsed.data.designId);
      if (entry) {
        sendEmail({
          to: parsed.data.email,
          template: 'comp-grant',
          data: { reason: parsed.data.reason, designId: parsed.data.designId },
          attachments: [{ filename: entry.filename, content: entry.stl, contentType: 'model/stl' }],
        }).catch((err) => logger.warn({ msg: 'comp.email_failed', err: err.message }));
      }
    }
    return { ok: true };
  },
};
