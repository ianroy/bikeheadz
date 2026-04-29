// P1-001 / P1-002 / P1-010 — auth primitives.
//
// Token model:
//   - magic-link tokens are random 32-byte url-safe strings stored in
//     auth_tokens with a 15-minute TTL.
//   - sessions are server-side rows; the cookie carries `<sessionId>.<hmac>`
//     where the hmac is HMAC-SHA256(sessionId, AUTH_SECRET) base64url.
//
// AUTH_SECRET should be set in production. If it isn't (e.g. first deploy
// before secrets are wired up), we still need to boot — otherwise health
// checks fail and the operator can't even reach the platform UI to fix it.
//
// Resolution order:
//   1. AUTH_SECRET env (preferred, ≥32 random bytes)
//   2. dev fallback constant (NODE_ENV !== 'production')
//   3. SHA-256 of DATABASE_URL (production fallback): stable across restarts
//      and replicas, private, guaranteed by the platform. Cookies survive
//      redeploys; once AUTH_SECRET is set explicitly, all old cookies become
//      invalid in one rotation.
//   4. per-process random bytes as last resort. Server boots; sessions reset
//      on every restart. Logs scream about this so it gets noticed.
//
// Cookies are HttpOnly, SameSite=Lax, and Secure in production.

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { db, hasDb } from './db.js';
import { logger } from './logger.js';
import { CommandError, ErrorCode } from './errors.js';

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'vh_session';
const COOKIE_MAX_AGE_S = Number(process.env.AUTH_COOKIE_MAX_AGE_S) || 60 * 60 * 24 * 30; // 30d
const TOKEN_TTL_MS = Number(process.env.AUTH_TOKEN_TTL_MS) || 15 * 60 * 1000;

const AUTH_SECRET = resolveAuthSecret();

function resolveAuthSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.NODE_ENV !== 'production') {
    logger.warn({
      msg: 'auth.using_dev_secret',
      hint: 'set AUTH_SECRET to a 32+ byte random string',
    });
    return 'valveheadz-dev-only-do-not-use-in-prod';
  }
  const seed = process.env.DATABASE_URL || process.env.PUBLIC_URL || '';
  if (seed) {
    logger.warn({
      msg: 'auth.secret_derived_from_db_url',
      hint: 'AUTH_SECRET not set; derived a stable fallback from DATABASE_URL. Set AUTH_SECRET to a 32+ byte random string in DO secrets ASAP — once set, in-flight sessions will be invalidated once and then stable.',
    });
    return createHash('sha256').update('bh-fallback|' + seed).digest('base64');
  }
  logger.error({
    msg: 'auth.secret_random_fallback',
    hint: 'AUTH_SECRET not set and no DATABASE_URL/PUBLIC_URL to derive from; using a per-process random secret. Sessions will reset on every restart. Set AUTH_SECRET immediately.',
  });
  return randomBytes(32).toString('base64');
}

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// In-memory fallback when DB isn't configured (dev/test). All maps keyed by
// the auth token / session id so look-up is O(1).
const MEMORY_TOKENS = new Map();
const MEMORY_SESSIONS = new Map();
const MEMORY_USERS_BY_EMAIL = new Map();
let MEMORY_USER_ID_SEQ = 1000;

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

export function authCookieName() {
  return COOKIE_NAME;
}

export function generateMagicToken() {
  // 32 bytes encoded url-safe — collisions are astronomically unlikely.
  return randomBytes(32)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function createMagicToken({ email, ip = null, userAgent = null, channel = 'email' }) {
  const token = generateMagicToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  if (!hasDb()) {
    MEMORY_TOKENS.set(token, {
      email: email.toLowerCase(),
      channel,
      ip,
      userAgent,
      expires_at: expiresAt,
      used_at: null,
    });
    return { token, expiresAt };
  }
  await db.query(
    `INSERT INTO auth_tokens (token, email, channel, expires_at, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [token, email.toLowerCase(), channel, expiresAt, ip, userAgent]
  );
  return { token, expiresAt };
}

export async function consumeMagicToken({ token, ip = null, userAgent = null }) {
  if (!token || typeof token !== 'string') {
    throw new CommandError(ErrorCode.INVALID_TOKEN, 'token_required');
  }
  let row;
  if (!hasDb()) {
    row = MEMORY_TOKENS.get(token);
    if (!row) throw new CommandError(ErrorCode.INVALID_TOKEN, 'invalid_token');
    if (row.used_at) throw new CommandError(ErrorCode.INVALID_TOKEN, 'invalid_token');
    if (row.expires_at.getTime() < Date.now()) {
      throw new CommandError(ErrorCode.TOKEN_EXPIRED, 'token_expired');
    }
    row.used_at = new Date();
  } else {
    const { rows } = await db.query(
      `UPDATE auth_tokens SET used_at = NOW()
        WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()
        RETURNING email, channel`,
      [token]
    );
    if (!rows.length) throw new CommandError(ErrorCode.INVALID_TOKEN, 'invalid_or_expired_token');
    row = { email: rows[0].email, channel: rows[0].channel };
  }
  const user = await upsertUserByEmail(row.email);
  const session = await createSession({ userId: user.id, ip, userAgent });
  return { user, session };
}

export async function upsertUserByEmail(email) {
  const lc = String(email || '').toLowerCase().trim();
  if (!lc) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'email_required');
  if (!hasDb()) {
    let user = MEMORY_USERS_BY_EMAIL.get(lc);
    if (!user) {
      const id = MEMORY_USER_ID_SEQ++;
      const role = ADMIN_EMAILS.includes(lc) ? 'admin' : 'user';
      user = {
        id,
        email: lc,
        role,
        display_name: lc.split('@')[0] || `user${id}`,
        preferences: {},
        email_prefs: { marketing: false, order_updates: true, design_reminders: true },
        avatar: { kind: 'identicon' },
        username: null,
        locale: 'en',
        session_token_version: 1,
      };
      MEMORY_USERS_BY_EMAIL.set(lc, user);
    }
    return user;
  }
  const role = ADMIN_EMAILS.includes(lc) ? 'admin' : 'user';
  const { rows } = await db.query(
    `INSERT INTO accounts (display_name, email, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET
       last_login_at = NOW(),
       role = CASE WHEN accounts.role = 'admin' THEN accounts.role ELSE EXCLUDED.role END
     RETURNING id, display_name, email, role, preferences, email_prefs, avatar, username,
               locale, session_token_version`,
    [lc.split('@')[0] || 'rider', lc, role]
  );
  return rows[0];
}

export async function createSession({ userId, ip = null, userAgent = null }) {
  const sessionId = randomBytes(16).toString('hex');
  if (!hasDb()) {
    MEMORY_SESSIONS.set(sessionId, {
      id: sessionId,
      user_id: userId,
      user_agent: userAgent,
      ip,
      created_at: new Date(),
      last_seen_at: new Date(),
      revoked_at: null,
    });
  } else {
    await db.query(
      `INSERT INTO sessions (id, user_id, user_agent, ip)
       VALUES ($1::uuid, $2, $3, $4)`,
      [sessionToUuid(sessionId), userId, userAgent, ip]
    );
  }
  return signSessionId(sessionId);
}

export function signSessionId(sessionId) {
  const sig = createHmac('sha256', AUTH_SECRET).update(sessionId).digest('base64url');
  return `${sessionId}.${sig}`;
}

export function verifySignedSession(value) {
  if (!value || typeof value !== 'string') return null;
  const dot = value.indexOf('.');
  if (dot <= 0) return null;
  const sessionId = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = createHmac('sha256', AUTH_SECRET).update(sessionId).digest('base64url');
  if (sig.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return sessionId;
}

export async function loadSessionUser(sessionId) {
  if (!sessionId) return null;
  if (!hasDb()) {
    const session = MEMORY_SESSIONS.get(sessionId);
    if (!session || session.revoked_at) return null;
    session.last_seen_at = new Date();
    const user = [...MEMORY_USERS_BY_EMAIL.values()].find((u) => u.id === session.user_id);
    return user ? { user, session } : null;
  }
  const { rows } = await db.query(
    `SELECT s.id::text   AS session_id,
            s.user_agent AS user_agent,
            s.ip         AS ip,
            s.last_seen_at,
            a.id, a.display_name, a.email, a.role, a.preferences, a.email_prefs,
            a.avatar, a.username, a.locale, a.session_token_version, a.deleted_at
       FROM sessions s
       JOIN accounts a ON a.id = s.user_id
      WHERE s.id = $1::uuid AND s.revoked_at IS NULL AND a.deleted_at IS NULL
      LIMIT 1`,
    [sessionToUuid(sessionId)]
  );
  if (!rows.length) return null;
  const r = rows[0];
  // best-effort touch
  db.query(`UPDATE sessions SET last_seen_at = NOW() WHERE id = $1::uuid`, [sessionToUuid(sessionId)]).catch(
    () => {}
  );
  const user = {
    id: Number(r.id),
    email: r.email,
    display_name: r.display_name,
    role: r.role,
    preferences: r.preferences,
    email_prefs: r.email_prefs,
    avatar: r.avatar,
    username: r.username,
    locale: r.locale,
    session_token_version: r.session_token_version,
  };
  return { user, session: { id: r.session_id, user_agent: r.user_agent, ip: r.ip } };
}

export async function revokeSession(sessionId) {
  if (!sessionId) return;
  if (!hasDb()) {
    const session = MEMORY_SESSIONS.get(sessionId);
    if (session) session.revoked_at = new Date();
    return;
  }
  await db.query(`UPDATE sessions SET revoked_at = NOW() WHERE id = $1::uuid`, [sessionToUuid(sessionId)]);
}

export async function revokeOtherSessions({ userId, keepSessionId = null }) {
  if (!hasDb()) {
    for (const [sid, s] of MEMORY_SESSIONS) {
      if (s.user_id === userId && sid !== keepSessionId) s.revoked_at = new Date();
    }
    return;
  }
  await db.query(
    `UPDATE sessions SET revoked_at = NOW()
      WHERE user_id = $1 AND revoked_at IS NULL
        AND ($2::uuid IS NULL OR id <> $2::uuid)`,
    [userId, keepSessionId ? sessionToUuid(keepSessionId) : null]
  );
}

export async function listSessions({ userId }) {
  if (!hasDb()) {
    return [...MEMORY_SESSIONS.values()]
      .filter((s) => s.user_id === userId)
      .map((s) => ({
        id: s.id,
        user_agent: s.user_agent,
        ip: s.ip,
        created_at: s.created_at,
        last_seen_at: s.last_seen_at,
        revoked: !!s.revoked_at,
      }));
  }
  const { rows } = await db.query(
    `SELECT id::text AS id, user_agent, ip, created_at, last_seen_at, revoked_at
       FROM sessions
      WHERE user_id = $1
      ORDER BY last_seen_at DESC`,
    [userId]
  );
  return rows.map((r) => ({ ...r, revoked: !!r.revoked_at }));
}

// Build a Set-Cookie string the client can attach. Chosen explicitly because
// socket.io doesn't have a Response object — we hand the cookie back in the
// command result and the page sets it via document.cookie. (HttpOnly is set
// during the magic-link consumption HTTP redirect path; see server/index.js
// `/auth/consume`.)
export function buildCookieString({ value, maxAge = COOKIE_MAX_AGE_S }) {
  const secure = process.env.NODE_ENV === 'production' ? 'Secure; ' : '';
  return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax; ${secure}`.trim();
}

export function buildClearCookieString() {
  const secure = process.env.NODE_ENV === 'production' ? 'Secure; ' : '';
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; ${secure}`.trim();
}

// Convert the 32-char hex sessionId into a UUID-shaped string that can be
// stored in our `sessions.id UUID` column without taking on a JS UUID
// dependency.
function sessionToUuid(sessionId) {
  const h = sessionId.padEnd(32, '0').slice(0, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

// Parse a Cookie header. Returns the named cookie value or null.
export function parseCookie(headerValue, name = COOKIE_NAME) {
  if (!headerValue) return null;
  const items = headerValue.split(/;\s*/);
  for (const item of items) {
    const eq = item.indexOf('=');
    if (eq < 0) continue;
    if (item.slice(0, eq).trim() === name) return decodeURIComponent(item.slice(eq + 1));
  }
  return null;
}

// Hash a request identifier (e.g. IP+UA) for rate-limit + new-device detection.
export function fingerprint(parts) {
  return createHash('sha256').update(parts.filter(Boolean).join('|')).digest('hex');
}

// ── Guards used by command handlers ────────────────────────────────────────
export function requireAuth({ socket }) {
  const user = socket.data?.user;
  if (!user) throw new CommandError(ErrorCode.AUTH_REQUIRED, 'auth_required');
  return user;
}

export function requireAdmin({ socket }) {
  const user = requireAuth({ socket });
  if (user.role !== 'admin') throw new CommandError(ErrorCode.FORBIDDEN_ADMIN_ONLY, 'admin_only');
  return user;
}

export function maybeUser({ socket }) {
  return socket.data?.user || null;
}

// ── Bootstrap: seed admin users from ADMIN_EMAILS at startup. Idempotent. ──
export async function seedAdmins() {
  if (!ADMIN_EMAILS.length) return;
  for (const email of ADMIN_EMAILS) {
    try {
      await upsertUserByEmail(email);
      if (hasDb()) {
        await db.query(`UPDATE accounts SET role = 'admin' WHERE LOWER(email) = $1`, [email]);
      }
      logger.info({ msg: 'auth.admin_seeded', email });
    } catch (err) {
      logger.warn({ msg: 'auth.admin_seed_failed', email, err: err.message });
    }
  }
}
