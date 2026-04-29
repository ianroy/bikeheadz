// P1-005 / P1-007 / P1-008 — account profile + email prefs + GDPR export.

import { z } from 'zod';
import { db, hasDb } from '../db.js';
import { requireAuth } from '../auth.js';
import { recordAudit } from '../audit.js';
import { CommandError, ErrorCode } from '../errors.js';

const DEFAULT_PROFILE = {
  displayName: 'Alex Rider',
  email: 'alex@valveheadz.com',
  preferences: { shipNotify: true, marketing: false, defaultChrome: true },
};

const UpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(40).optional(),
  preferences: z.record(z.union([z.string(), z.boolean(), z.number()])).optional(),
  emailPrefs: z
    .object({
      marketing: z.boolean().optional(),
      order_updates: z.boolean().optional(),
      design_reminders: z.boolean().optional(),
    })
    .partial()
    .optional(),
  avatar: z
    .object({
      kind: z.enum(['identicon', 'color', 'design']),
      color: z.string().regex(/^#?[0-9a-fA-F]{6}$/).optional(),
      designId: z.string().uuid().optional(),
    })
    .optional(),
  username: z
    .string()
    .trim()
    .min(3)
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
  locale: z.string().min(2).max(8).optional(),
});

const RESERVED_USERNAMES = new Set([
  'admin',
  'api',
  'account',
  'pricing',
  'how-it-works',
  'showcase',
  'gallery',
  'help',
  'd',
  'u',
  'security',
  'privacy',
  'terms',
  'login',
  'signin',
  'logout',
]);

export const accountCommands = {
  'account.get': async ({ socket }) => {
    const user = socket.data?.user;
    if (!user) {
      if (!hasDb()) return DEFAULT_PROFILE;
      // Anonymous read — return demo profile
      return DEFAULT_PROFILE;
    }
    return publicProfile(user);
  },

  'account.update': async ({ socket, payload }) => {
    const user = requireAuth({ socket });
    const parsed = UpdateSchema.safeParse(payload || {});
    if (!parsed.success) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid', parsed.error.issues);
    const fields = parsed.data;

    if (fields.username && RESERVED_USERNAMES.has(fields.username.toLowerCase())) {
      throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'username_reserved');
    }

    if (!hasDb()) {
      Object.assign(user, fields, fields.displayName ? { display_name: fields.displayName } : {});
      return publicProfile(user);
    }

    const sets = [];
    const args = [];
    if (fields.displayName) {
      args.push(fields.displayName);
      sets.push(`display_name = $${args.length}`);
    }
    if (fields.preferences) {
      args.push(fields.preferences);
      sets.push(`preferences = $${args.length}`);
    }
    if (fields.emailPrefs) {
      args.push(JSON.stringify(fields.emailPrefs));
      sets.push(`email_prefs = email_prefs || $${args.length}::jsonb`);
    }
    if (fields.avatar) {
      args.push(JSON.stringify(fields.avatar));
      sets.push(`avatar = $${args.length}::jsonb`);
    }
    if (fields.username) {
      args.push(fields.username);
      sets.push(`username = $${args.length}`);
    }
    if (fields.locale) {
      args.push(fields.locale);
      sets.push(`locale = $${args.length}`);
    }
    if (!sets.length) return publicProfile(user);
    sets.push('updated_at = NOW()');
    args.push(user.id);
    const { rows } = await db.query(
      `UPDATE accounts SET ${sets.join(', ')}
        WHERE id = $${args.length}
        RETURNING id, display_name, email, role, preferences, email_prefs, avatar, username, locale`,
      args
    );
    await recordAudit({ actorId: user.id, action: 'account.update', metadata: { fields: Object.keys(fields) } });
    return publicProfile(rows[0]);
  },

  // P1-004 — GDPR export. Returns a JSON bundle.
  'account.exportData': async ({ socket }) => {
    const user = requireAuth({ socket });
    if (!hasDb()) {
      return {
        profile: publicProfile(user),
        designs: [],
        purchases: [],
        photos: [],
      };
    }
    const [profile, designs, purchases, photos] = await Promise.all([
      db.query(
        `SELECT id, email, display_name, role, preferences, email_prefs, avatar, username,
                locale, created_at, last_login_at
           FROM accounts WHERE id = $1`,
        [user.id]
      ),
      db.query(
        `SELECT id, filename, settings, photo_name, created_at, expires_at, is_public
           FROM generated_designs WHERE account_id = $1 ORDER BY created_at DESC`,
        [user.id]
      ),
      db.query(
        `SELECT id, design_id, stripe_session_id, amount_cents, currency, status, product,
                customer_email, paid_at, shipping_address, tax_breakdown
           FROM purchases WHERE account_id = $1 ORDER BY id DESC`,
        [user.id]
      ),
      db.query(
        `SELECT id, sha256, filename, size_bytes, uploaded_at, last_used_at, expires_at
           FROM user_photos WHERE account_id = $1 ORDER BY uploaded_at DESC`,
        [user.id]
      ),
    ]);
    await recordAudit({ actorId: user.id, action: 'account.export' });
    return {
      profile: profile.rows[0],
      designs: designs.rows,
      purchases: purchases.rows,
      photos: photos.rows,
      exportedAt: new Date().toISOString(),
    };
  },

  // P1-004 — soft-delete. Anonymise purchases (Stripe retention).
  'account.delete': async ({ socket }) => {
    const user = requireAuth({ socket });
    if (!hasDb()) return { ok: true };
    await db.query(
      `UPDATE accounts SET deleted_at = NOW(), email = CONCAT('deleted-', id, '@deleted.local')
        WHERE id = $1`,
      [user.id]
    );
    await db.query(`DELETE FROM generated_designs WHERE account_id = $1`, [user.id]);
    await db.query(`DELETE FROM user_photos WHERE account_id = $1`, [user.id]);
    await db.query(`UPDATE purchases SET customer_email = NULL WHERE account_id = $1`, [user.id]);
    await db.query(`UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1`, [user.id]);
    await recordAudit({ actorId: user.id, action: 'account.delete' });
    return { ok: true };
  },
};

function publicProfile(u) {
  return {
    id: u.id,
    email: u.email,
    displayName: u.display_name || u.displayName,
    role: u.role,
    preferences: u.preferences || {},
    emailPrefs: u.email_prefs || u.emailPrefs || { marketing: false, order_updates: true, design_reminders: true },
    avatar: u.avatar || { kind: 'identicon' },
    username: u.username || null,
    locale: u.locale || 'en',
  };
}
