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
} from '../auth.js';
import { sendEmail } from '../email.js';
import { magicLinkLimiter } from '../rate-limit.js';
import { recordAudit } from '../audit.js';
import { CommandError, ErrorCode } from '../errors.js';
import { logger } from '../logger.js';

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
    const { user, session } = await consumeMagicToken({ token: parsed.data.token, ip, userAgent });
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
