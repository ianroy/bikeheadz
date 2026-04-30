// P1-005 / P1-007 / P1-008 — account profile + email prefs + GDPR export.

import { z } from 'zod';
import { db, hasDb } from '../db.js';
import { requireAuth, hashPassword, verifyPassword } from '../auth.js';
import { recordAudit } from '../audit.js';
import { CommandError, ErrorCode } from '../errors.js';

// TOS_VERSION must match LEGAL_VERSION in client/pages/legal.js. Bump
// both whenever a material edit lands; existing accounts get a
// re-acceptance prompt at next /account visit because account.get
// returns needsTosAccept = (tos_version IS NULL OR tos_version !=
// TOS_VERSION).
export const TOS_VERSION = '2026-04-30';

// Empty profile for anonymous callers. The legacy "Alex Rider /
// alex@stemdomez.com" demo profile shipped a fake identity to logged-
// out visitors which made the /account page look like someone was
// already signed in. Now we return null fields so the SPA renders
// the genuine guest state ("Sign in to see your designs").
const ANONYMOUS_PROFILE = {
  displayName: '',
  email: '',
  preferences: {},
  emailPrefs: {},
  avatar: { kind: 'identicon' },
  username: null,
  locale: 'en',
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
    if (!user) return ANONYMOUS_PROFILE;
    // Hydrate password_hash + password_set_at + tos_* from the DB.
    // The session-loaded user object intentionally omits the hash so
    // it can't accidentally serialise; we re-read here to surface the
    // hasPassword + needsTosAccept booleans for the Settings UI.
    if (hasDb()) {
      try {
        const { rows } = await db.query(
          `SELECT password_hash, password_set_at, tos_accepted_at, tos_version
             FROM accounts WHERE id = $1`,
          [user.id]
        );
        if (rows[0]) {
          return publicProfile({
            ...user,
            password_hash: rows[0].password_hash,
            password_set_at: rows[0].password_set_at,
            tos_accepted_at: rows[0].tos_accepted_at,
            tos_version: rows[0].tos_version,
          });
        }
      } catch { /* ignore — fall through to plain profile */ }
    }
    return publicProfile(user);
  },

  // Record acceptance of the current Terms of Service + Privacy
  // Policy version. Stores the bump in accounts.tos_version so
  // future TOS_VERSION changes re-prompt the user.
  'account.acceptTos': async ({ socket, payload }) => {
    const user = requireAuth({ socket });
    const Schema = z.object({
      version: z.string().min(4).max(64),
    });
    const parsed = Schema.safeParse(payload || {});
    if (!parsed.success) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid');
    if (parsed.data.version !== TOS_VERSION) {
      throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'tos_version_mismatch', {
        expected: TOS_VERSION, got: parsed.data.version,
      });
    }
    if (!hasDb()) return { ok: true, version: TOS_VERSION };
    await db.query(
      `UPDATE accounts SET tos_accepted_at = NOW(), tos_version = $2 WHERE id = $1`,
      [user.id, TOS_VERSION]
    );
    await recordAudit({
      actorId: user.id,
      action: 'account.tos_accepted',
      metadata: { version: TOS_VERSION },
    });
    return { ok: true, version: TOS_VERSION, acceptedAt: new Date().toISOString() };
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

  // Migration 006 — opt-in password. The user can add or change a
  // password from /account → Settings; we hash with scrypt
  // (server/auth.js helpers) and persist on accounts.password_hash.
  // Magic-link login keeps working even after a password is set —
  // password is additive, never the only auth.
  'account.setPassword': async ({ socket, payload }) => {
    const user = requireAuth({ socket });
    const Schema = z.object({
      password: z.string().min(10).max(256),
      currentPassword: z.string().max(256).optional(),
    });
    const parsed = Schema.safeParse(payload);
    if (!parsed.success) {
      throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'password_too_short', parsed.error.issues);
    }
    if (!hasDb()) throw new CommandError(ErrorCode.INTERNAL_ERROR, 'no_database');
    // If a password is already set, require the current one (or a
    // recent magic-link / reset-flow consume — those land here
    // signed-in but without a currentPassword in payload).
    const { rows } = await db.query(
      `SELECT password_hash FROM accounts WHERE id = $1`, [user.id]
    );
    const existing = rows[0]?.password_hash || null;
    if (existing && parsed.data.currentPassword) {
      if (!verifyPassword(parsed.data.currentPassword, existing)) {
        throw new CommandError(ErrorCode.INVALID_TOKEN, 'wrong_current_password');
      }
    }
    const hashed = hashPassword(parsed.data.password);
    await db.query(
      `UPDATE accounts SET password_hash = $1, password_set_at = NOW() WHERE id = $2`,
      [hashed, user.id]
    );
    await recordAudit({
      actorId: user.id,
      action: existing ? 'account.password_changed' : 'account.password_set',
    });
    return { ok: true, hasPassword: true };
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
    // Surface a boolean (NEVER the hash) so the SPA can render the
    // "Set a password" vs "Change password" form variant.
    hasPassword: !!u.password_hash,
    passwordSetAt: u.password_set_at || null,
    // TOS acceptance state — used by the SPA to show the blocking
    // accept modal on /account when the user hasn't accepted yet
    // OR their accepted version is stale.
    tosVersion: u.tos_version || null,
    tosAcceptedAt: u.tos_accepted_at || null,
    tosCurrentVersion: TOS_VERSION,
    needsTosAccept: !u.tos_version || u.tos_version !== TOS_VERSION,
  };
}
