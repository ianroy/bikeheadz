// P1-001 / P1-002 — auth surface.
//
// Commands:
//   auth.requestMagicLink({ email })
//     - rate-limited per email + per IP
//     - emits a token via email; in dev with no provider configured the
//       link is logged + returned in `result.devUrl` so /account works
//       end-to-end without provider keys.
//   auth.consumeMagicLink({ token })
//     - returns { user, cookieValue }; the client sets the cookie via
//       document.cookie since socket.io has no Response object.
//   auth.whoami()
//   auth.logout({ scope?: 'this' | 'all' })

import { z } from 'zod';
import {
  createMagicToken,
  consumeMagicToken,
  loadSessionUser,
  revokeSession,
  revokeOtherSessions,
  buildCookieString,
  buildClearCookieString,
  authCookieName,
  signSessionId,
  parseCookie,
  fingerprint,
  hashPassword,
  verifyPassword,
  createSession,
  consumeInvite as consumeInviteHelper,
  upsertUserByEmail,
} from '../auth.js';
import { db, hasDb } from '../db.js';
import { sendEmail } from '../email.js';
import { magicLinkLimiter, makeRateLimiter } from '../rate-limit.js';
import { recordAudit } from '../audit.js';
import { CommandError, ErrorCode } from '../errors.js';
import { logger } from '../logger.js';

// P1-012 — adapt the existing makeRateLimiter helper to the {key, max,
// windowMs} signature the spec asked for. Caches a limiter per
// (max, windowMs) so we don't create N buckets per IP.
const _consumeLimiters = new Map();
function checkRateLimit({ key, max, windowMs }) {
  const cacheKey = `${max}|${windowMs}`;
  let limiter = _consumeLimiters.get(cacheKey);
  if (!limiter) {
    limiter = makeRateLimiter(`auth.consume:${cacheKey}`, [
      { windowMs, max, keyer: (ctx) => ctx.key },
    ]);
    _consumeLimiters.set(cacheKey, limiter);
  }
  return limiter({ key });
}

// P1-012 — track which (ip, hour-bucket) we've already audited so we
// only emit `auth.brute_force_suspected` once per hour per IP.
const _bruteForceAudited = new Set();
// Sliding window of failed attempts per IP. Map<ip, number[]>.
const _consumeFailures = new Map();
const BRUTE_THRESHOLD = 20;
const BRUTE_WINDOW_MS = 60 * 60 * 1000;
function trackConsumeFailure(ip) {
  const now = Date.now();
  const arr = _consumeFailures.get(ip) || [];
  const cutoff = now - BRUTE_WINDOW_MS;
  const fresh = arr.filter((t) => t >= cutoff);
  fresh.push(now);
  _consumeFailures.set(ip, fresh);
  if (fresh.length >= BRUTE_THRESHOLD) {
    const hourBucket = Math.floor(now / BRUTE_WINDOW_MS);
    const hashedIp = fingerprint([ip]);
    const auditKey = `${hashedIp}|${hourBucket}`;
    if (!_bruteForceAudited.has(auditKey)) {
      _bruteForceAudited.add(auditKey);
      recordAudit({
        actorId: null,
        action: 'auth.brute_force_suspected',
        targetType: 'ip',
        targetId: hashedIp,
        metadata: { count: fresh.length, windowMs: BRUTE_WINDOW_MS },
      }).catch((err) => logger.warn({ msg: 'auth.brute_audit_failed', err: err.message }));
    }
  }
}

const RequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  redirectTo: z.string().max(256).optional(),
});

const ConsumeSchema = z.object({
  token: z.string().min(20).max(96),
});

const LogoutSchema = z.object({
  scope: z.enum(['this', 'all']).optional(),
});

function appUrlFromSocket(socket) {
  return (
    process.env.APP_URL ||
    process.env.PUBLIC_URL ||
    socket?.handshake?.headers?.origin ||
    `http://localhost:${process.env.PORT || 3000}`
  ).replace(/\/$/, '');
}

function ipOf(socket) {
  return (
    socket?.handshake?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    socket?.handshake?.address ||
    'unknown'
  );
}

function uaOf(socket) {
  return socket?.handshake?.headers?.['user-agent'] || 'unknown';
}

export const authCommands = {
  'auth.requestMagicLink': async ({ socket, payload }) => {
    const parsed = RequestSchema.safeParse(payload);
    if (!parsed.success) {
      throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid_email', parsed.error.issues);
    }
    const { email, redirectTo = '/account' } = parsed.data;
    const ip = ipOf(socket);
    magicLinkLimiter({ email, ip });

    const { token, expiresAt } = await createMagicToken({
      email,
      ip,
      userAgent: uaOf(socket),
    });

    const base = appUrlFromSocket(socket);
    const safeRedirect = redirectTo.startsWith('/') ? redirectTo : '/account';
    const magicUrl = `${base}/auth/consume?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(
      safeRedirect
    )}`;

    const result = await sendEmail({
      to: email,
      template: 'magic-link',
      data: { magicUrl },
    });

    await recordAudit({
      action: 'auth.magic_link.requested',
      targetType: 'email',
      targetId: email,
      ip,
      metadata: { sent: result.ok, backend: result.backend || 'console' },
    });

    return {
      ok: true,
      expiresAt: expiresAt.toISOString(),
      // Dev affordance: when no real backend is wired, hand the URL back so
      // tests + local browsing work without a Resend account. Never returned
      // when a real provider is enabled — that would defeat the purpose.
      devUrl: !result.backend || result.backend === 'console' ? magicUrl : null,
    };
  },

  'auth.consumeMagicLink': async ({ socket, payload }) => {
    const parsed = ConsumeSchema.safeParse(payload);
    if (!parsed.success) {
      throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid_token', parsed.error.issues);
    }
    const ip = ipOf(socket);
    const userAgent = uaOf(socket);

    // P1-012 — per-IP rate limit + brute-force audit. We rate-limit
    // BEFORE touching the token store so an attacker can't grind
    // through the namespace; failed attempts feed the brute-force
    // counter that emits one audit event per (ip, hour).
    try {
      checkRateLimit({
        key: 'auth_consume:' + ip,
        max: 10,
        windowMs: 600_000,
      });
    } catch (rlErr) {
      const retryAfterMs = (rlErr.details?.retryAfter || 60) * 1000;
      throw new CommandError(ErrorCode.RATE_LIMITED, 'too_many_attempts', { retryAfterMs });
    }

    let result;
    try {
      result = await consumeMagicToken({ token: parsed.data.token, ip, userAgent });
    } catch (err) {
      trackConsumeFailure(ip);
      throw err;
    }
    const { user, session } = result;
    socket.data = socket.data || {};
    socket.data.user = user;
    socket.data.session = { id: extractSessionId(session) };

    await recordAudit({
      actorId: user.id,
      action: 'auth.session.created',
      targetType: 'session',
      targetId: socket.data.session.id,
      ip,
      metadata: { fingerprint: fingerprint([userAgent, ip]) },
    });
    logger.info({ msg: 'auth.session_started', userId: user.id, sessionId: socket.data.session.id });

    return {
      user: publicUser(user),
      cookie: {
        name: authCookieName(),
        value: session,
        maxAgeSeconds: Number(process.env.AUTH_COOKIE_MAX_AGE_S) || 60 * 60 * 24 * 30,
      },
      // For browsers where document.cookie can set the cookie directly when
      // it's not HttpOnly. Our default cookie IS HttpOnly so the client
      // typically uses the /auth/consume HTTP redirect path instead.
      setCookieHeader: buildCookieString({ value: session }),
    };
  },

  // Password login (migration 006). Email + password → session cookie.
  // Falls back to magic-link if the account hasn't opted in to a
  // password (no password_hash row). Same per-IP rate limit as the
  // magic-link consume path so brute-forcing isn't free.
  'auth.loginWithPassword': async ({ socket, payload }) => {
    const Schema = z.object({
      email: z.string().trim().toLowerCase().email(),
      password: z.string().min(10).max(256),
    });
    const parsed = Schema.safeParse(payload);
    if (!parsed.success) {
      throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid_credentials', parsed.error.issues);
    }
    const ip = ipOf(socket);
    const ua = uaOf(socket);
    try {
      checkRateLimit({ key: 'auth_pwlogin:' + ip, max: 10, windowMs: 600_000 });
    } catch (rlErr) {
      const retryAfterMs = (rlErr.details?.retryAfter || 60) * 1000;
      throw new CommandError(ErrorCode.RATE_LIMITED, 'too_many_attempts', { retryAfterMs });
    }
    if (!hasDb()) throw new CommandError(ErrorCode.INVALID_TOKEN, 'invalid_credentials');
    const { rows } = await db.query(
      `SELECT id, email, role, password_hash FROM accounts
        WHERE LOWER(email) = $1 AND deleted_at IS NULL LIMIT 1`,
      [parsed.data.email]
    );
    const row = rows[0];
    // Constant-time-ish: always run a verify even on no-row, so
    // attackers can't enumerate accounts via timing.
    const stored = row?.password_hash || 'scrypt$32768$8$1$00$00';
    const ok = verifyPassword(parsed.data.password, stored) && !!row;
    if (!ok) {
      trackConsumeFailure(ip);
      throw new CommandError(ErrorCode.INVALID_TOKEN, 'invalid_credentials');
    }
    const cookie = await createSession({ userId: row.id, ip, userAgent: ua });
    await recordAudit({ actorId: row.id, action: 'auth.password_login', ip });
    return {
      ok: true,
      user: publicUser(row),
      clearCookieHeader: null,
      cookie,
    };
  },

  // Password-reset request — same shape as requestMagicLink but uses
  // a different email template + tags the token channel so the
  // consume side can branch the post-login UX ("set new password").
  'auth.requestPasswordReset': async ({ socket, payload }) => {
    const parsed = RequestSchema.safeParse(payload);
    if (!parsed.success) {
      throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid_email', parsed.error.issues);
    }
    const { email } = parsed.data;
    const ip = ipOf(socket);
    magicLinkLimiter({ email, ip });

    const { token, expiresAt } = await createMagicToken({
      email, ip, userAgent: uaOf(socket), channel: 'password_reset',
    });
    const base = appUrlFromSocket(socket);
    const resetUrl =
      `${base}/auth/consume?token=${encodeURIComponent(token)}` +
      `&redirect=${encodeURIComponent('/account?reset=1')}`;

    const result = await sendEmail({
      to: email,
      template: 'password-reset',
      data: { resetUrl },
    });
    await recordAudit({
      action: 'auth.password_reset.requested',
      targetType: 'email', targetId: email, ip,
      metadata: { sent: result.ok, backend: result.backend || 'console' },
    });
    return {
      ok: true,
      expiresAt: expiresAt.toISOString(),
      devUrl: !result.backend || result.backend === 'console' ? resetUrl : null,
    };
  },

  // Invite consume (migration 006). The invite code carries enough
  // weight on its own to sign the recipient in, since the inviter
  // already vouched for the email address. Tags account.invited_by.
  'auth.consumeInvite': async ({ socket, payload }) => {
    const Schema = z.object({ code: z.string().min(8).max(64) });
    const parsed = Schema.safeParse(payload);
    if (!parsed.success) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid', parsed.error.issues);
    const ip = ipOf(socket);
    try {
      checkRateLimit({ key: 'auth_invite:' + ip, max: 10, windowMs: 600_000 });
    } catch (rlErr) {
      const retryAfterMs = (rlErr.details?.retryAfter || 60) * 1000;
      throw new CommandError(ErrorCode.RATE_LIMITED, 'too_many_attempts', { retryAfterMs });
    }
    const { user, cookie } = await consumeInviteHelper({
      code: parsed.data.code, ip, userAgent: uaOf(socket),
    });
    await recordAudit({ actorId: user.id, action: 'auth.invite_accepted', ip });
    return { ok: true, user: publicUser(user), cookie };
  },

  'auth.whoami': async ({ socket }) => {
    const user = socket.data?.user;
    if (!user) return { user: null };
    return { user: publicUser(user) };
  },

  'auth.logout': async ({ socket, payload }) => {
    const parsed = LogoutSchema.safeParse(payload || {});
    const scope = parsed.success ? parsed.data.scope || 'this' : 'this';
    const sessionId = socket.data?.session?.id;
    const user = socket.data?.user;

    if (scope === 'all' && user) {
      await revokeOtherSessions({ userId: user.id, keepSessionId: null });
      await recordAudit({ actorId: user.id, action: 'auth.logout_all' });
    } else if (sessionId) {
      await revokeSession(sessionId);
      await recordAudit({ actorId: user?.id || null, action: 'auth.logout' });
    }
    socket.data.user = null;
    socket.data.session = null;
    return { ok: true, clearCookieHeader: buildClearCookieString() };
  },
};

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    displayName: u.display_name || u.displayName,
    role: u.role,
    username: u.username || null,
    avatar: u.avatar || { kind: 'identicon' },
    locale: u.locale || 'en',
    emailPrefs: u.email_prefs || u.emailPrefs || {},
  };
}

function extractSessionId(signedCookieValue) {
  if (!signedCookieValue) return null;
  const dot = signedCookieValue.indexOf('.');
  return dot > 0 ? signedCookieValue.slice(0, dot) : null;
}

// Helper for the HTTP-side `/auth/consume` redirect handler in server/index.js.
export async function consumeForHttpRedirect({ token, ip, userAgent }) {
  const { user, session } = await consumeMagicToken({ token, ip, userAgent });
  return {
    user,
    cookie: buildCookieString({ value: session }),
    sessionId: extractSessionId(session),
    signed: session,
  };
}

// Helper used by index.js socket-connect middleware.
export async function attachUserFromCookie(socket) {
  const cookieHeader = socket?.handshake?.headers?.cookie;
  const raw = parseCookie(cookieHeader);
  if (!raw) return null;
  const dot = raw.indexOf('.');
  if (dot <= 0) return null;
  const sessionId = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  // Validate signature first so a malformed cookie can't cause DB lookups.
  const verified = signSessionId(sessionId);
  if (verified !== `${sessionId}.${sig}`) return null;
  const found = await loadSessionUser(sessionId);
  if (!found) return null;
  socket.data = socket.data || {};
  socket.data.user = found.user;
  socket.data.session = { id: sessionId };
  return found.user;
}
