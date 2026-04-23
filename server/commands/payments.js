import { getStripe, stripeEnabled, appUrl, pricingCatalogue } from '../stripe-client.js';
import { db, hasDb } from '../db.js';
import { designStore } from '../design-store.js';
import { logger } from '../logger.js';

// Socket command surface for Stripe.
//
//   payments.catalogue          — list products + prices for the pricing page
//   payments.createCheckoutSession — start checkout for a product+design
//   payments.verifySession      — post-redirect: confirm payment, unlock download
//
// Webhook-driven state updates happen in a narrow HTTP endpoint in server/index.js
// (the only non-command surface in the app — Stripe requires a signed HTTP POST).

const PRODUCTS = ['stl_download', 'printed_stem', 'pack_of_4'];

export const paymentsCommands = {
  'payments.catalogue': async () => {
    return {
      enabled: stripeEnabled(),
      items: Object.values(pricingCatalogue()),
    };
  },

  'payments.createCheckoutSession': async ({ payload }) => {
    if (!stripeEnabled()) throw new Error('stripe_not_configured');
    const { product = 'stl_download', designId = null, qty = 1 } = payload || {};
    if (!PRODUCTS.includes(product)) throw new Error('unknown_product');

    // STL downloads must reference a freshly generated design.
    if (product === 'stl_download') {
      if (!designId) throw new Error('designId_required');
      const exists = await designStore.exists(designId);
      if (!exists) throw new Error('design_not_found_or_expired');
    }

    const catalogue = pricingCatalogue();
    const item = catalogue[product];
    const stripe = getStripe();

    const base = appUrl();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: item.currency,
          product_data: {
            name: item.name,
            description: item.description,
          },
          unit_amount: item.unitAmount,
        },
        quantity: Math.max(1, Math.min(10, Number(qty) || 1)),
      }],
      success_url: `${base}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/pricing?cancelled=1`,
      metadata: {
        product,
        designId: designId || '',
      },
    });

    if (hasDb()) {
      await db.query(
        `INSERT INTO purchases (design_id, stripe_session_id, amount_cents, currency, product)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (stripe_session_id) DO NOTHING`,
        [designId, session.id, item.unitAmount, item.currency, product]
      );
    }

    logger.info({ msg: 'payments.session_created', sessionId: session.id, product, designId });
    return { url: session.url, sessionId: session.id };
  },

  'payments.verifySession': async ({ payload }) => {
    if (!stripeEnabled()) throw new Error('stripe_not_configured');
    const { sessionId } = payload || {};
    if (!sessionId) throw new Error('sessionId_required');

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });

    const paid = session.payment_status === 'paid';
    const designId = session.metadata?.designId || null;
    const product = session.metadata?.product || 'stl_download';

    if (paid && hasDb()) {
      await db.query(
        `UPDATE purchases
            SET status = 'paid',
                paid_at = COALESCE(paid_at, NOW()),
                stripe_payment_id = $2,
                customer_email = $3
          WHERE stripe_session_id = $1`,
        [sessionId, session.payment_intent?.id || null, session.customer_details?.email || null]
      );
    }

    let design = null;
    if (paid && designId) {
      const entry = await designStore.get(designId);
      if (entry) {
        design = {
          designId,
          filename: entry.filename,
          stl: entry.stl.toString('utf8'),
        };
      }
    }

    return {
      paid,
      product,
      designId,
      design,
      amount: session.amount_total,
      currency: session.currency,
      customerEmail: session.customer_details?.email || null,
    };
  },
};
