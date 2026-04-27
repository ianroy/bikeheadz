import { getStripe, stripeEnabled, appUrl, pricingCatalogue } from '../stripe-client.js';
import { db, hasDb } from '../db.js';
import { designStore } from '../design-store.js';
import { logger } from '../logger.js';

// Socket command surface for Stripe.
//
//   payments.catalogue             — return { enabled, item } for the pricing page
//   payments.createCheckoutSession — start checkout for the current design
//   payments.verifySession         — post-redirect: confirm payment, unlock download

const PRODUCT = 'stl_download';

export const paymentsCommands = {
  'payments.catalogue': async () => {
    const item = pricingCatalogue()[PRODUCT];
    return { enabled: stripeEnabled(), item };
  },

  'payments.createCheckoutSession': async ({ socket, payload }) => {
    if (!stripeEnabled()) throw new Error('stripe_not_configured');
    const { designId = null } = payload || {};
    if (!designId) throw new Error('designId_required');

    const exists = await designStore.exists(designId);
    if (!exists) throw new Error('design_not_found_or_expired');

    const item = pricingCatalogue()[PRODUCT];
    const stripe = getStripe();
    const base = appUrl(socket);

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
        quantity: 1,
      }],
      success_url: `${base}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/pricing?cancelled=1`,
      metadata: { designId },
    });

    if (hasDb()) {
      await db.query(
        `INSERT INTO purchases (design_id, stripe_session_id, amount_cents, currency, product)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (stripe_session_id) DO NOTHING`,
        [designId, session.id, item.unitAmount, item.currency, PRODUCT]
      );
    }

    logger.info({ msg: 'payments.session_created', sessionId: session.id, designId });
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
        // STL is shipped as base64 to survive the JSON round-trip when
        // the underlying bytes are binary (the upcoming pipeline emits
        // binary STL via manifold3d — see 3D_Pipeline.md §8.9 + Phase 0
        // task #1). The client decodes in checkout-return.js.
        design = {
          designId,
          filename: entry.filename,
          stl_b64: entry.stl.toString('base64'),
        };
      }
    }

    return {
      paid,
      designId,
      design,
      amount: session.amount_total,
      currency: session.currency,
      customerEmail: session.customer_details?.email || null,
    };
  },
};
