import express from 'express';
import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from './logger.js';
import { initCommandRegistry, dispatchCommand } from './commands/index.js';
import { initDb, closeDb, db, hasDb } from './db.js';
import { getStripe, stripeEnabled, logStripeConfig } from './stripe-client.js';
import { startExpiryJob } from './design-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 12-factor §3 — config strictly via environment.
const PORT = Number(process.env.PORT) || 3000;
const STATIC_DIR = process.env.STATIC_DIR || path.resolve(__dirname, '..', 'dist');
const CORS_ORIGIN = process.env.CORS_ORIGIN || true;

const app = express();
const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: { origin: CORS_ORIGIN },
  maxHttpBufferSize: 12 * 1024 * 1024,
});

// Required for Digital Ocean App Platform health checks.
app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// Stripe webhook — the only non-socket HTTP surface. Needs the RAW body
// before Express/JSON parsing so the signature can be verified. Scoped
// tightly to this single path.
app.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripeEnabled()) return res.status(501).send('stripe_not_configured');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = getStripe();
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = secret
      ? stripe.webhooks.constructEvent(req.body, sig, secret)
      : JSON.parse(req.body.toString('utf8'));
  } catch (err) {
    logger.warn({ msg: 'stripe.webhook.invalid_signature', err: err.message });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    await handleStripeEvent(event);
    res.json({ received: true });
  } catch (err) {
    logger.error({ msg: 'stripe.webhook.handler_error', err: err.message, eventType: event.type });
    res.status(500).send('handler_error');
  }
});

async function handleStripeEvent(event) {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object;
      if (!hasDb()) return;
      await db.query(
        `UPDATE purchases
            SET status = 'paid',
                paid_at = COALESCE(paid_at, NOW()),
                stripe_payment_id = $2,
                customer_email = $3
          WHERE stripe_session_id = $1`,
        [session.id, session.payment_intent || null, session.customer_details?.email || null]
      );
      logger.info({ msg: 'stripe.checkout.paid', sessionId: session.id });
      break;
    }
    case 'checkout.session.expired':
    case 'checkout.session.async_payment_failed': {
      const session = event.data.object;
      if (!hasDb()) return;
      await db.query(
        `UPDATE purchases SET status = 'failed' WHERE stripe_session_id = $1 AND status = 'pending'`,
        [session.id]
      );
      break;
    }
    default:
      logger.debug({ msg: 'stripe.webhook.ignored', type: event.type });
  }
}

// Serve the built client. SPA fallback for deep links.
app.use(express.static(STATIC_DIR, { maxAge: '1h', index: false }));
app.get('*', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'index.html')));

// Command registry — single source of truth for socket.io two-way commands.
const registry = initCommandRegistry();

io.on('connection', (socket) => {
  logger.info({ msg: 'socket.connect', id: socket.id, addr: socket.handshake.address });

  socket.on('command', async (msg) => {
    await dispatchCommand(registry, socket, msg);
  });

  socket.on('disconnect', (reason) => {
    logger.info({ msg: 'socket.disconnect', id: socket.id, reason });
  });
});

let stopExpiry = null;

async function start() {
  try {
    await initDb();
    logStripeConfig();
    stopExpiry = startExpiryJob();
    httpServer.listen(PORT, () => {
      // 12-factor §7 — port binding.
      logger.info({ msg: 'server.listen', port: PORT, env: process.env.NODE_ENV || 'development' });
    });
  } catch (err) {
    logger.error({ msg: 'server.fatal', err: err.message, stack: err.stack });
    process.exit(1);
  }
}

// 12-factor §9 — disposability: respond to termination signals quickly.
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
