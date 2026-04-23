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
    printed_stem: {
      productId: 'printed_stem',
      name: 'Printed Stem',
      description: 'We print and ship your BikeHeadz valve stem cap.',
      unitAmount: Number(process.env.STRIPE_PRICE_PRINT_CENTS) || 1999,
      currency: process.env.STRIPE_CURRENCY || 'usd',
    },
    pack_of_4: {
      productId: 'pack_of_4',
      name: 'Pack of 4 printed stems',
      description: 'Four printed BikeHeadz valve stem caps — great for group rides.',
      unitAmount: Number(process.env.STRIPE_PRICE_PACK4_CENTS) || 5999,
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
    hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
    currency: process.env.STRIPE_CURRENCY || 'usd',
  });
}
