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

export function appUrl() {
  const u = process.env.APP_URL || process.env.PUBLIC_URL;
  if (u) return u.replace(/\/$/, '');
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
