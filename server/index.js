import express from 'express';
import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import helmet from 'helmet';
import { logger } from './logger.js';
import { initCommandRegistry, dispatchCommand } from './commands/index.js';
import { initDb, closeDb, db, hasDb } from './db.js';
import { logStripeConfig, getStripe, webhookEnabled, stripeEnabled } from './stripe-client.js';
import { startExpiryJob, designStore } from './design-store.js';
import { initSentry, captureException } from './sentry.js';
import { attachUserFromCookie, consumeForHttpRedirect } from './commands/auth.js';
import { seedAdmins } from './auth.js';
import { runpodEnabled, pingRunpod } from './workers/runpod-client.js';
import { sendEmail } from './email.js';
import { setFlag, listFlags } from './flags.js';
import { invalidateAppConfigCache } from './app-config.js';
import { applyPendingMigrations } from './migrate.js';
import { pageViewMiddleware } from './page-view.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 12-factor §3 — config strictly via environment.
const PORT = Number(process.env.PORT) || 3000;
const STATIC_DIR = process.env.STATIC_DIR || path.resolve(__dirname, '..', 'dist');
const CORS_ORIGIN = process.env.CORS_ORIGIN || true;
const METRICS_TOKEN = process.env.METRICS_TOKEN || '';

const app = express();
const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: { origin: CORS_ORIGIN },
  maxHttpBufferSize: 12 * 1024 * 1024,
});

// ── P0-007 — security headers via helmet. CSP allows self + ws/wss for
// socket.io and Stripe Checkout's top-level redirect. Stripe.js (inline
// element) would need additional `script-src` whitelisting; revisit when
// P2-014 lands.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://js.stripe.com', 'https://cdn.jsdelivr.net'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://images.unsplash.com', 'https://*.stripe.com'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: [
          "'self'",
          'ws:',
          'wss:',
          'https://api.stripe.com',
          'https://*.ingest.sentry.io',
        ],
        frameSrc: ["'self'", 'https://js.stripe.com', 'https://hooks.stripe.com'],
        workerSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Three.js + WebAssembly need cross-origin assets to load
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

app.disable('x-powered-by');
app.set('trust proxy', true);

// ── Cookie parsing (used by /auth/consume) ────────────────────────────────
app.use((req, _res, next) => {
  const header = req.headers.cookie;
  req.cookies = {};
  if (!header) return next();
  for (const item of header.split(/;\s*/)) {
    const eq = item.indexOf('=');
    if (eq < 0) continue;
    req.cookies[item.slice(0, eq).trim()] = decodeURIComponent(item.slice(eq + 1));
  }
  next();
});

// ── P2-001 — Stripe webhook (raw body required for signature verification).
// Mounted before express.json so the raw body is preserved.
if (webhookEnabled()) {
  app.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const stripe = getStripe();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripe || !secret) {
      logger.warn({ msg: 'stripe.webhook_disabled_runtime' });
      return res.status(503).send('stripe_not_configured');
    }
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err) {
      logger.warn({ msg: 'stripe.webhook_signature_invalid', err: err.message });
      return res.status(400).send(`bad_signature: ${err.message}`);
    }
    try {
      await handleStripeEvent(event);
      res.json({ ok: true });
    } catch (err) {
      logger.error({ msg: 'stripe.webhook_handler_failed', err: err.message });
      captureException(err, { tags: { source: 'stripe.webhook' } });
      res.status(500).json({ ok: false });
    }
  });
}

app.use(express.json({ limit: '12mb' }));

// Page-view middleware — populates page_views for the admin Trends /
// Funnel / Devices / Referrer dashboards. Skips static assets, the
// socket.io upgrade endpoint, /health, /metrics, /webhooks, etc.
// Persistence is fire-and-forget after next() so the user's first
// paint is unaffected by any geo-IP latency.
app.use(pageViewMiddleware());

// ── /health (DO App Platform), enriched with RunPod ping (P0-011).
let runpodCache = { reachable: null, lastChecked: 0, latencyMs: null };
app.get('/health', async (_req, res) => {
  const out = { status: 'ok', uptime: process.uptime() };
  if (runpodEnabled()) {
    if (Date.now() - runpodCache.lastChecked > 60_000) {
      runpodCache = await pingRunpod().catch(() => ({
        reachable: false,
        latencyMs: null,
        lastChecked: Date.now(),
      }));
      runpodCache.lastChecked = Date.now();
    }
    out.runpod = runpodCache;
  }
  res.json(out);
});

// ── P0-011 / P4-002 — Prometheus metrics endpoint, behind METRICS_TOKEN.
const metrics = {
  cmd_total: new Map(),
  cmd_error_total: new Map(),
  active_sockets: 0,
  stl_latency_ms: [],
};
app.get('/metrics', (req, res) => {
  if (METRICS_TOKEN) {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ') || auth.slice(7) !== METRICS_TOKEN) {
      return res.status(401).send('unauthorized');
    }
  }
  res.set('Content-Type', 'text/plain; version=0.0.4');
  const lines = [];
  lines.push('# HELP stemdomez_active_sockets active socket.io connections');
  lines.push('# TYPE stemdomez_active_sockets gauge');
  lines.push(`stemdomez_active_sockets ${metrics.active_sockets}`);
  lines.push('# HELP stemdomez_command_total command count by name');
  lines.push('# TYPE stemdomez_command_total counter');
  for (const [name, n] of metrics.cmd_total) {
    lines.push(`stemdomez_command_total{name="${name}"} ${n}`);
  }
  lines.push('# HELP stemdomez_command_error_total command error count by name');
  lines.push('# TYPE stemdomez_command_error_total counter');
  for (const [name, n] of metrics.cmd_error_total) {
    lines.push(`stemdomez_command_error_total{name="${name}"} ${n}`);
  }
  lines.push('# HELP stemdomez_stl_latency_ms last 100 stl.generate latencies');
  lines.push('# TYPE stemdomez_stl_latency_ms summary');
  if (metrics.stl_latency_ms.length) {
    const sorted = [...metrics.stl_latency_ms].sort((a, b) => a - b);
    lines.push(`stemdomez_stl_latency_ms{quantile="0.5"} ${sorted[Math.floor(sorted.length * 0.5)]}`);
    lines.push(`stemdomez_stl_latency_ms{quantile="0.95"} ${sorted[Math.floor(sorted.length * 0.95)] || 0}`);
    lines.push(`stemdomez_stl_latency_ms_count ${sorted.length}`);
  }
  res.send(lines.join('\n') + '\n');
});

// ── P1-001 — Magic-link redirect endpoint. Sets the HttpOnly cookie and
// 302s into the SPA at the requested redirect path. This is one of the
// few "real" HTTP surfaces — same exception class as the Stripe webhook.
app.get('/auth/consume', async (req, res) => {
  const token = String(req.query.token || '');
  const redirect = String(req.query.redirect || '/account');
  const safeRedirect = redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/account';
  try {
    const ip = req.ip;
    const userAgent = req.get('user-agent');
    const out = await consumeForHttpRedirect({ token, ip, userAgent });
    res.setHeader('Set-Cookie', out.cookie);
    res.redirect(302, safeRedirect);
  } catch (err) {
    logger.warn({ msg: 'auth.consume_failed', err: err.message });
    res.redirect(302, `/?auth=expired`);
  }
});

// ── P1-001 — POST endpoint for SPA to clear the cookie on logout.
app.post('/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie', `sd_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  res.json({ ok: true });
});

// ── X-008 — RFC 9116 security.txt + /security page is rendered by the SPA.
app.get('/.well-known/security.txt', (_req, res) => {
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const base = (process.env.APP_URL || 'https://stemdomez.com').replace(/\/$/, '');
  res.set('Content-Type', 'text/plain');
  res.send(
    [
      'Contact: mailto:security@stemdomez.com',
      'Preferred-Languages: en',
      `Expires: ${expires}`,
      `Acknowledgments: ${base}/security`,
      `Policy: ${base}/security`,
      `Canonical: ${base}/.well-known/security.txt`,
    ].join('\n') + '\n'
  );
});

// ── X-010 — robots.txt + sitemap.xml.
app.get('/robots.txt', (_req, res) => {
  res.set('Content-Type', 'text/plain');
  const base = process.env.APP_URL || 'https://stemdomez.com';
  res.send(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /account',
      'Disallow: /checkout/return',
      'Disallow: /.well-known/',
      `Sitemap: ${base.replace(/\/$/, '')}/sitemap.xml`,
    ].join('\n') + '\n'
  );
});

app.get('/sitemap.xml', (_req, res) => {
  const base = (process.env.APP_URL || 'https://stemdomez.com').replace(/\/$/, '');
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = [
    '/',
    '/stemdome-generator',
    '/pricing',
    '/help',
    '/showcase',
    '/security',
    '/terms',
    '/privacy',
    '/acceptable-use',
    '/dmca',
    '/cookies',
    '/refunds',
    '/photo-policy',
    '/changelog',
    '/incidents',
    '/press',
    '/status',
  ];
  res.set('Content-Type', 'application/xml');
  res.send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls
        .map(
          (u) =>
            `  <url><loc>${base}${u}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq></url>`
        )
        .join('\n') +
      `\n</urlset>\n`
  );
});

// P5-006 — per-design OG card meta endpoint. Slack/Discord/Twitter render
// the OG tags out of the initial HTML; the SPA hydration takes over after.
// We rewrite a slim version of `dist/index.html` with per-design title +
// description + image. The image is a lightweight SVG returned by a sibling
// route. This is server-rendered HTML, intentionally limited in scope.
app.get('/d/:token', async (req, res, next) => {
  // Only intercept when the request looks like a crawler (User-Agent
  // contains bot/crawler/twitter/slack/facebook/linkedin/discord), or when
  // the query asks for `?og=1`. Everything else falls through to the SPA.
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  const isBot =
    /bot|crawler|spider|twitter|slack|facebook|linkedin|discord|whatsapp|telegram/.test(ua) ||
    req.query.og === '1';
  if (!isBot) return next();

  const token = String(req.params.token || '');
  let title = 'StemDomeZ — shared design';
  let description = "Someone's StemDomeZ cap. Tap Remix to make your own.";
  let imageUrl = `${process.env.APP_URL || ''}/og.png`;
  try {
    const dot = token.indexOf('.');
    if (dot > 0) {
      const designId = token.slice(0, dot);
      if (hasDb()) {
        const { rows } = await db.query(
          `SELECT a.display_name, a.username FROM generated_designs gd
            LEFT JOIN accounts a ON a.id = gd.account_id WHERE gd.id = $1 LIMIT 1`,
          [designId]
        );
        if (rows[0]?.display_name) {
          title = `${rows[0].display_name}'s StemDomeZ cap`;
        }
      }
      imageUrl = `${process.env.APP_URL || ''}/og/d/${encodeURIComponent(token)}.svg`;
    }
  } catch (err) {
    logger.debug({ msg: 'og.lookup_failed', err: err.message });
  }
  const safe = (s) => String(s).replace(/[<>"]/g, '');
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html><html lang="en"><head>
    <meta charset="utf-8" />
    <title>${safe(title)}</title>
    <meta name="description" content="${safe(description)}" />
    <meta property="og:title" content="${safe(title)}" />
    <meta property="og:description" content="${safe(description)}" />
    <meta property="og:image" content="${safe(imageUrl)}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${safe(imageUrl)}" />
    <meta http-equiv="refresh" content="0; url=${safe(req.originalUrl)}" />
  </head><body>${safe(title)}</body></html>`);
});

app.get('/og/d/:token.svg', (req, res) => {
  // Intentionally minimal — design-rendered thumbnails belong in P4-007.
  // This is the "shareable on chat" placeholder.
  res.set('Content-Type', 'image/svg+xml');
  const safe = String(req.params.token || '').replace(/[^A-Za-z0-9._-]/g, '');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <rect width="1200" height="630" fill="#FAF7F2" />
  <rect x="40" y="40" width="1120" height="550" rx="24" fill="#FFFFFF" stroke="#E5DFD3" stroke-width="2" />
  <text x="80" y="180" font-family="-apple-system, system-ui, sans-serif" font-size="64" font-weight="800" fill="#C71F1F">StemDomeZ</text>
  <text x="80" y="260" font-family="-apple-system, system-ui, sans-serif" font-size="38" fill="#1A1614">Your face on a Schrader valve cap</text>
  <text x="80" y="540" font-family="ui-monospace, monospace" font-size="20" fill="#6B6157">/d/${safe.slice(0, 36)}</text>
</svg>`);
});

// P5-007 — username permalink pages. Same crawler-aware handoff: bots
// see meta tags, humans get the SPA.
app.get('/u/:username', async (req, res, next) => {
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  const isBot = /bot|crawler|spider|twitter|slack|facebook|linkedin|discord/.test(ua);
  if (!isBot) return next();
  const username = String(req.params.username || '').toLowerCase();
  if (!username || !hasDb()) return next();
  try {
    const { rows } = await db.query(
      `SELECT display_name, username FROM accounts WHERE LOWER(username) = $1 AND deleted_at IS NULL`,
      [username]
    );
    if (!rows.length) return next();
    const safe = (s) => String(s).replace(/[<>"]/g, '');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html><html lang="en"><head>
      <meta charset="utf-8" />
      <title>${safe(rows[0].display_name)} on StemDomeZ</title>
      <meta property="og:title" content="${safe(rows[0].display_name)} on StemDomeZ" />
      <meta property="og:type" content="profile" />
      <meta http-equiv="refresh" content="0; url=${safe(req.originalUrl)}" />
    </head><body>${safe(rows[0].display_name)}</body></html>`);
  } catch (err) {
    logger.debug({ msg: 'og.username_lookup_failed', err: err.message });
    next();
  }
});

// Serve the built client. SPA fallback for deep links.
app.use(express.static(STATIC_DIR, { maxAge: '1h', index: false }));

// X-011 — Custom 404 / 500 pages. Both use the SPA shell so the workshop
// palette + header render; specific routes (`/404`, `/500`) are handled in
// the client router.
app.use((err, _req, res, _next) => {
  if (res.headersSent) return;
  const incidentId = Math.random().toString(36).slice(2, 10);
  captureException(err, { tags: { incidentId } });
  logger.error({ msg: 'http.error', err: err.message, incidentId });
  res
    .status(500)
    .sendFile(path.join(STATIC_DIR, 'index.html'), {
      headers: { 'X-Incident-Id': incidentId },
    });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

// Command registry — single source of truth for socket.io two-way commands.
const registry = initCommandRegistry();

// P1-002 — attach user from cookie at handshake time so command handlers
// can use socket.data.user without an extra round-trip.
io.use(async (socket, next) => {
  try {
    await attachUserFromCookie(socket);
    next();
  } catch (err) {
    logger.warn({ msg: 'auth.handshake_failed', err: err.message });
    next();
  }
});

io.on('connection', (socket) => {
  metrics.active_sockets++;
  logger.info({
    msg: 'socket.connect',
    id: socket.id,
    addr: socket.handshake.address,
    user: socket.data?.user?.id || null,
  });

  socket.on('command', async (msg) => {
    if (msg && typeof msg.name === 'string') {
      metrics.cmd_total.set(msg.name, (metrics.cmd_total.get(msg.name) || 0) + 1);
    }
    const started = Date.now();
    await dispatchCommand(registry, socket, msg);
    if (msg?.name === 'stl.generate') {
      const ms = Date.now() - started;
      metrics.stl_latency_ms.push(ms);
      if (metrics.stl_latency_ms.length > 100) metrics.stl_latency_ms.shift();
    }
  });

  socket.on('disconnect', (reason) => {
    metrics.active_sockets = Math.max(0, metrics.active_sockets - 1);
    logger.info({ msg: 'socket.disconnect', id: socket.id, reason });
  });
});

// ── Stripe webhook event router. ──────────────────────────────────────────
async function handleStripeEvent(event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      if (!hasDb()) return;
      await db.query(
        `UPDATE purchases
            SET status = 'paid',
                paid_at = COALESCE(paid_at, NOW()),
                stripe_payment_id = COALESCE(stripe_payment_id, $2),
                customer_email = COALESCE(customer_email, $3),
                shipping_address = COALESCE(shipping_address, $4)
          WHERE stripe_session_id = $1`,
        [
          session.id,
          typeof session.payment_intent === 'string' ? session.payment_intent : null,
          session.customer_details?.email || null,
          session.shipping_details ? JSON.stringify(session.shipping_details) : null,
        ]
      );
      logger.info({ msg: 'stripe.webhook.paid', sessionId: session.id });

      // Email STL on webhook delivery so the user gets it even if they
      // never come back to /checkout/return (P2-008).
      const designId = session.metadata?.designId;
      if (designId && session.customer_details?.email) {
        const entry = await designStore.get(designId);
        if (entry) {
          sendEmail({
            to: session.customer_details.email,
            template: 'order-stl',
            data: {
              email: session.customer_details.email,
              designId,
              product: session.metadata?.product || 'stl_download',
              amount: ((session.amount_total || 0) / 100).toFixed(2),
              currency: (session.currency || 'usd').toUpperCase(),
            },
            attachments: [{ filename: entry.filename, content: entry.stl, contentType: 'model/stl' }],
          }).catch((err) => logger.warn({ msg: 'stripe.webhook.email_failed', err: err.message }));
        }
      }
      break;
    }
    case 'checkout.session.expired': {
      const session = event.data.object;
      if (!hasDb()) return;
      await db.query(
        `UPDATE purchases SET status = 'expired' WHERE stripe_session_id = $1 AND status = 'pending'`,
        [session.id]
      );
      break;
    }
    case 'charge.refunded': {
      const charge = event.data.object;
      if (!hasDb()) return;
      await db.query(
        `UPDATE purchases SET status = 'refunded' WHERE stripe_payment_id = $1`,
        [charge.payment_intent]
      );
      break;
    }
    default:
      logger.debug({ msg: 'stripe.webhook.ignored', type: event.type });
  }
}

// Seed the two MVP launch toggle rows so the admin panel always shows
// them. Defaults: BOTH OFF — free-MVP launch posture (Stripe disabled,
// login-gated free downloads, no third-party printing fulfilment yet).
// Idempotent: only INSERTs when the row is absent, so admin overrides
// via /admin stick across restarts.
//
// `mvp_launch_v2` marker forces a one-shot UPSERT of both flags to OFF
// when present. This catches earlier deploys that seeded payments=ON
// before the launch posture was finalized; the marker prevents
// repeated overrides so a later admin "turn payments back on" toggle
// stays sticky.
async function seedMvpFlags() {
  if (!hasDb()) return;
  const existing = new Set((await listFlags()).map((f) => f.key));
  if (!existing.has('payments_enabled')) {
    await setFlag({ key: 'payments_enabled', enabled: false, percent: 0 });
  }
  if (!existing.has('printing_enabled')) {
    await setFlag({ key: 'printing_enabled', enabled: false, percent: 0 });
  }
  if (!existing.has('aaa_toggle_enabled')) {
    await setFlag({ key: 'aaa_toggle_enabled', enabled: false, percent: 0 });
  }
  const RESET_MARKER = 'mvp_launch_v2';
  if (!existing.has(RESET_MARKER)) {
    await setFlag({ key: 'payments_enabled', enabled: false, percent: 0 });
    await setFlag({ key: 'printing_enabled', enabled: false, percent: 0 });
    await setFlag({ key: RESET_MARKER, enabled: true, percent: 100 });
    logger.info({ msg: 'flags.mvp_launch_v2_applied' });
  }
  invalidateAppConfigCache();
}

let stopExpiry = null;

async function start() {
  try {
    await initSentry();
    await initDb();
    // Migrate-on-boot: catches the case where DO's PRE_DEPLOY job
    // didn't fire (e.g., the app was created before migrate.js was
    // declared, or the spec change wasn't picked up retroactively).
    // applyPendingMigrations() is idempotent — already-applied files
    // sit in the schema_migrations table and get skipped. Failure
    // here is fatal; better to crash early than serve a half-migrated
    // schema (auth_tokens missing → /login throws internal_error).
    if (hasDb()) {
      try {
        const result = await applyPendingMigrations({ silent: true });
        if (result.applied.length) {
          logger.info({ msg: 'migrate.boot_applied', files: result.applied });
        } else {
          logger.info({ msg: 'migrate.boot_clean', total: result.skipped.length });
        }
      } catch (err) {
        logger.error({ msg: 'migrate.boot_failed', err: err.message });
        throw err;
      }
    }
    await seedAdmins().catch((err) => logger.warn({ msg: 'auth.seed_admins_failed', err: err.message }));
    await seedMvpFlags().catch((err) => logger.warn({ msg: 'flags.seed_failed', err: err.message }));
    logStripeConfig();
    if (webhookEnabled()) logger.info({ msg: 'stripe.webhook_enabled' });
    if (stripeEnabled()) logger.info({ msg: 'stripe.live', tax: process.env.STRIPE_TAX_ENABLED === 'true' });
    stopExpiry = startExpiryJob();
    httpServer.listen(PORT, () => {
      logger.info({ msg: 'server.listen', port: PORT, env: process.env.NODE_ENV || 'development' });
    });
  } catch (err) {
    logger.error({ msg: 'server.fatal', err: err.message, stack: err.stack });
    process.exit(1);
  }
}

function shutdown(signal) {
  logger.info({ msg: 'server.shutdown', signal });
  stopExpiry?.();
  io.close();
  httpServer.close(async () => {
    await closeDb();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => logger.error({ msg: 'unhandledRejection', err: String(err) }));

start();
