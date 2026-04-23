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

export function pricingCatalogue() {
  return {
    stl_download: {
      productId: 'stl_download',
      name: 'STL Download',
      description: 'Personalized BikeHeadz valve stem cap — downloadable STL.',
      unitAmount: Number(process.env.STRIPE_PRICE_STL_CENTS) || 200,
      currency: process.env.STRIPE_CURRENCY || 'usd',
    },
  };
}

export function logStripeConfig() {
  if (!stripeEnabled()) {
    logger.warn({ msg: 'stripe.disabled', hint: 'STRIPE_SECRET_KEY not set — checkout will 501' });
    return;
  }
  logger.info({
    msg: 'stripe.configured',
    currency: process.env.STRIPE_CURRENCY || 'usd',
  });
}
