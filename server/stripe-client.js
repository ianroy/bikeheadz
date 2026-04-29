import Stripe from 'stripe';
import { logger } from './logger.js';

let _stripe = null;

export function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  _stripe = new Stripe(key, { apiVersion: '2024-11-20.acacia' });
  return _stripe;
}

export function stripeEnabled() {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function webhookEnabled() {
  return Boolean(
    (process.env.STRIPE_WEBHOOK_ENABLED || '').toLowerCase() === 'true' &&
      process.env.STRIPE_WEBHOOK_SECRET
  );
}

export function taxEnabled() {
  return (process.env.STRIPE_TAX_ENABLED || '').toLowerCase() === 'true';
}

export function shippingCountries() {
  const raw = (process.env.STRIPE_SHIPPING_COUNTRIES || 'US,CA,GB,DE,FR,IE,NL,BE,IT,ES,DK,SE,NO,FI,AU,NZ').toString();
  return raw
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
}

// Resolve the public base URL for Stripe success/cancel redirects.
// Preference order:
//   1. explicit APP_URL / PUBLIC_URL env (operator override)
//   2. the origin header from the socket handshake (where the browser
//      actually loaded the page — works on any DO URL or custom domain
//      with zero config)
//   3. http://localhost:${PORT} fallback for dev
export function appUrl(socket) {
  const envUrl = process.env.APP_URL || process.env.PUBLIC_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  const origin = socket?.handshake?.headers?.origin;
  if (origin) return origin.replace(/\/$/, '');
  const port = process.env.PORT || 3000;
  return `http://localhost:${port}`;
}

// P2-002 — full product catalogue. Prices in cents, currency env-driven.
// `printed_stem` ships the printed cap to a single address; `pack_of_4`
// ships four printed caps. STL download is digital-only.
export function pricingCatalogue() {
  const currency = process.env.STRIPE_CURRENCY || 'usd';
  return {
    stl_download: {
      productId: 'stl_download',
      name: 'STL Download',
      description: 'Personalized ValveHeadZ valve stem cap — downloadable STL.',
      unitAmount: Number(process.env.STRIPE_PRICE_STL_CENTS) || 200,
      currency,
      shippable: false,
    },
    printed_stem: {
      productId: 'printed_stem',
      name: 'Printed ValveHeadZ Cap',
      description: 'One 3D-printed Schrader valve cap of your design, mailed to you.',
      unitAmount: Number(process.env.STRIPE_PRICE_PRINT_CENTS) || 1999,
      currency,
      shippable: true,
    },
    pack_of_4: {
      productId: 'pack_of_4',
      name: 'Pack of 4',
      description: 'Four caps — share with the crew. Mix and match designs.',
      unitAmount: Number(process.env.STRIPE_PRICE_PACK_CENTS) || 5999,
      currency,
      shippable: true,
    },
  };
}

export function logStripeConfig() {
  if (!stripeEnabled()) {
    logger.warn({ msg: 'stripe.disabled', hint: 'STRIPE_SECRET_KEY not set — checkout will reject' });
    return;
  }
  logger.info({
    msg: 'stripe.configured',
    currency: process.env.STRIPE_CURRENCY || 'usd',
    webhook: webhookEnabled(),
    tax: taxEnabled(),
  });
}
