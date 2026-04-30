// Page-view middleware. One row per HTML/SPA navigation; powers the
// admin Trends graph + Funnel + Referrer split + Device split.
//
// Implementation notes:
//   * Only tracks GET requests to non-asset paths (HTML routes). The
//     /socket.io/, /metrics, /health, /og/, /.well-known/, and
//     hashed-asset paths are all skipped — they're either machine
//     traffic or static assets that would balloon the table.
//   * session_key cookie sd_visitor is set if absent (anon visitor
//     identifier). It's NOT auth — that's sd_session. The visitor
//     cookie just lets us collapse a multi-page session into one
//     funnel attempt.
//   * IP + UA are recorded but the geo resolution + UA parsing both
//     run AFTER the response has been sent so the page-view never
//     adds latency to the user's first paint.

import { randomBytes } from 'node:crypto';
import { db, hasDb } from './db.js';
import { logger } from './logger.js';
import { geoLookupAsync } from './geo.js';

const VISITOR_COOKIE = 'sd_visitor';
const COOKIE_TTL_S = 90 * 24 * 60 * 60; // 90d

const SKIP_PREFIXES = [
  '/socket.io/',
  '/metrics',
  '/health',
  '/og/',
  '/.well-known/',
  '/auth/consume',
  '/auth/logout',
  '/stripe/webhook',
  '/robots.txt',
  '/sitemap.xml',
  '/favicon',
  '/manifest',
  '/service-worker.js',
  '/icons/',
  '/press/',
  '/demo/',
];

const ASSET_EXTENSIONS = /\.(js|css|map|png|jpg|jpeg|webp|gif|svg|ico|woff2?|ttf|eot|mp4|webm|stl|json|webmanifest)$/i;

function shouldTrack(req) {
  if (req.method !== 'GET') return false;
  const url = req.path || req.url.split('?')[0] || '/';
  if (SKIP_PREFIXES.some((p) => url.startsWith(p))) return false;
  if (ASSET_EXTENSIONS.test(url)) return false;
  return true;
}

function ensureVisitorCookie(req, res) {
  const existing = req.cookies?.[VISITOR_COOKIE];
  if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return existing;
  const next = randomBytes(18).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const secure = (req.protocol === 'https' || req.get?.('x-forwarded-proto') === 'https')
    ? '; Secure' : '';
  res.append?.('Set-Cookie',
    `${VISITOR_COOKIE}=${next}; Path=/; Max-Age=${COOKIE_TTL_S}; HttpOnly; SameSite=Lax${secure}`);
  return next;
}

function classifyUserAgent(ua) {
  const u = String(ua || '').toLowerCase();
  let device = 'desktop';
  if (/iphone|ipod|android.*mobile|windows phone/.test(u)) device = 'mobile';
  else if (/ipad|android(?!.*mobile)|tablet/.test(u)) device = 'tablet';
  else if (/bot|crawler|spider|curl|wget|httpie/.test(u)) device = 'bot';

  let os = 'other';
  if (/iphone|ipad|ipod|cpu (iphone )?os /.test(u)) os = 'ios';
  else if (/android/.test(u)) os = 'android';
  else if (/mac os x|macintosh/.test(u)) os = 'macos';
  else if (/windows nt/.test(u)) os = 'windows';
  else if (/linux/.test(u)) os = 'linux';

  let browser = 'other';
  if (/edg\//.test(u)) browser = 'edge';
  else if (/chrome\//.test(u) && !/edg\//.test(u)) browser = 'chrome';
  else if (/firefox\//.test(u)) browser = 'firefox';
  else if (/safari\//.test(u) && !/chrome\//.test(u)) browser = 'safari';
  else if (/opr\//.test(u) || /opera/.test(u)) browser = 'opera';

  return { device, os, browser };
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || null;
}

export function pageViewMiddleware() {
  return async (req, res, next) => {
    if (!shouldTrack(req)) return next();
    const sessionKey = ensureVisitorCookie(req, res);
    const accountId = null; // populated below if a sd_session cookie resolves
    const ip = clientIp(req);
    const ua = req.get?.('user-agent') || '';
    const referrer = req.get?.('referer') || req.get?.('referrer') || null;
    const path = req.path || '/';

    // Resolve account from sd_session cookie if present. Best-effort —
    // a stale cookie just means account_id stays null (still tracks
    // the visit for funnel purposes via session_key).
    let resolvedAccountId = accountId;
    try {
      const sd = req.cookies?.sd_session;
      if (sd && hasDb()) {
        const dot = sd.indexOf('.');
        const sid = dot > 0 ? sd.slice(0, dot) : null;
        if (sid) {
          const { rows } = await db.query(
            `SELECT user_id FROM sessions WHERE id = $1 AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1`,
            [sid]
          );
          if (rows[0]) resolvedAccountId = Number(rows[0].user_id);
        }
      }
    } catch { /* ignore */ }

    next();

    // Fire-and-forget after the response is queued.
    if (!hasDb()) return;
    setImmediate(async () => {
      try {
        const { device, os, browser } = classifyUserAgent(ua);
        const geo = await geoLookupAsync(ip);
        await db.query(
          `INSERT INTO page_views
            (account_id, session_key, path, referrer, ip, user_agent,
             geo_country, geo_city, device_kind, os_kind, browser_kind)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            resolvedAccountId,
            sessionKey,
            path.slice(0, 512),
            referrer ? referrer.slice(0, 512) : null,
            ip,
            ua.slice(0, 512),
            geo.country || null,
            geo.city || null,
            device,
            os,
            browser,
          ]
        );
      } catch (err) {
        logger.debug({ msg: 'page_view.persist_failed', err: err.message });
      }
    });
  };
}

export function classifyUserAgentForExport(ua) {
  return classifyUserAgent(ua);
}
