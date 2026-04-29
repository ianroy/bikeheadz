// Thin Sentry wrapper. Disabled when SENTRY_DSN is unset so dev / CI never
// have to touch a Sentry account or generate noisy "is Sentry up?" pings.
//
// Required env: SENTRY_DSN
// Optional env: SENTRY_ENVIRONMENT (defaults to NODE_ENV), SENTRY_RELEASE
//
// PII discipline:
//   - never ship STL bytes, photo blobs, or raw socket payloads in error frames
//   - the `extra` field on captureException should only contain ids + small scalars

import { logger } from './logger.js';

let SentryRef = null;
let initialized = false;

const DSN = process.env.SENTRY_DSN || '';
const ENV = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
const RELEASE = process.env.SENTRY_RELEASE || undefined;

export async function initSentry() {
  if (!DSN) {
    logger.info({ msg: 'sentry.disabled', hint: 'SENTRY_DSN not set' });
    return;
  }
  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn: DSN,
      environment: ENV,
      release: RELEASE,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0,
      profilesSampleRate: 0,
      // Don't capture request bodies — they may contain photo blobs.
      sendDefaultPii: false,
      beforeSend(event) {
        if (event.extra && typeof event.extra === 'object') {
          for (const key of Object.keys(event.extra)) {
            const v = event.extra[key];
            if (v instanceof Buffer || v instanceof Uint8Array) {
              event.extra[key] = `[bytes:${v.length}]`;
            }
            if (typeof v === 'string' && v.length > 4096) {
              event.extra[key] = v.slice(0, 4096) + '…';
            }
          }
        }
        return event;
      },
    });
    SentryRef = Sentry;
    initialized = true;
    logger.info({ msg: 'sentry.initialized', env: ENV });

    process.on('unhandledRejection', (err) => {
      Sentry.captureException(err);
    });
    process.on('uncaughtException', (err) => {
      Sentry.captureException(err);
    });
  } catch (err) {
    logger.warn({ msg: 'sentry.init.failed', err: err.message });
  }
}

export function captureException(err, context = {}) {
  if (!initialized || !SentryRef) return;
  try {
    SentryRef.withScope((scope) => {
      if (context.tags) {
        for (const [k, v] of Object.entries(context.tags)) scope.setTag(k, v);
      }
      if (context.user) scope.setUser(context.user);
      if (context.extra) scope.setContext('extra', context.extra);
      SentryRef.captureException(err);
    });
  } catch {
    // never let Sentry failures bubble up
  }
}

export function captureMessage(message, level = 'info', context = {}) {
  if (!initialized || !SentryRef) return;
  try {
    SentryRef.withScope((scope) => {
      if (context.tags) for (const [k, v] of Object.entries(context.tags)) scope.setTag(k, v);
      if (context.extra) scope.setContext('extra', context.extra);
      SentryRef.captureMessage(message, level);
    });
  } catch {
    // ignore
  }
}

export function sentryEnabled() {
  return initialized;
}
