import { z } from 'zod';
import {
  getStripe,
  stripeEnabled,
  appUrl,
  pricingCatalogue,
  taxEnabled,
  shippingCountries,
} from '../stripe-client.js';
import { db, hasDb } from '../db.js';
import { designStore } from '../design-store.js';
import { logger } from '../logger.js';
import { CommandError, ErrorCode } from '../errors.js';
import { maybeUser, requireAdmin } from '../auth.js';
import { recordAudit } from '../audit.js';
import { sendEmail } from '../email.js';

// Socket command surface for Stripe.
//
//   payments.catalogue             — return { enabled, items } for the pricing page
//   payments.createCheckoutSession — start checkout for the current design
//   payments.verifySession         — post-redirect: confirm payment, unlock download
//   payments.refund                — admin-only refund of a paid session
//   payments.openCustomerPortal    — Stripe-hosted self-serve portal (P2-015)

const VALID_PRODUCTS = ['stl_download', 'printed_stem', 'pack_of_4'];

const CreateSchema = z.object({
  designId: z.string().uuid(),
  product: z.enum(VALID_PRODUCTS).default('stl_download'),
  promo: z.string().min(2).max(64).optional(),
});

const VerifySchema = z.object({
  sessionId: z.string().min(8).max(256),
});

const RefundSchema = z.object({
  sessionId: z.string().min(8).max(256),
  reason: z.string().max(200).optional(),
});

export const paymentsCommands = {
  'payments.catalogue': async () => {
    const items = pricingCatalogue();
    return { enabled: stripeEnabled(), items };
  },

  'payments.createCheckoutSession': async ({ socket, payload }) => {
    if (!stripeEnabled()) throw new CommandError(ErrorCode.STRIPE_NOT_CONFIGURED, 'stripe_not_configured');
    const parsed = CreateSchema.safeParse(payload);
    if (!parsed.success) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid', parsed.error.issues);
    const { designId, product, promo } = parsed.data;

    const exists = await designStore.exists(designId);
    if (!exists) throw new CommandError(ErrorCode.DESIGN_NOT_FOUND, 'design_not_found_or_expired');

    const item = pricingCatalogue()[product];
    if (!item) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'unknown_product');
    const stripe = getStripe();
    const base = appUrl(socket);
    const user = maybeUser({ socket });

    let discounts;
    if (promo) {
      try {
        const list = await stripe.coupons.list({ limit: 100 });
        const coupon = list.data.find((c) => c.id.toLowerCase() === promo.toLowerCase());
        if (!coupon) throw new CommandError(ErrorCode.PROMO_INVALID, 'promo_invalid');
        if (coupon.times_redeemed && coupon.max_redemptions && coupon.times_redeemed >= coupon.max_redemptions) {
          throw new CommandError(ErrorCode.PROMO_EXHAUSTED, 'promo_exhausted');
        }
        discounts = [{ coupon: coupon.id }];
      } catch (err) {
        if (err instanceof CommandError) throw err;
        logger.warn({ msg: 'payments.promo_lookup_failed', err: err.message });
      }
    }

    const sessionParams = {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: item.currency,
            product_data: { name: item.name, description: item.description },
            unit_amount: item.unitAmount,
          },
          quantity: 1,
        },
      ],
      success_url: `${base}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/pricing?cancelled=1`,
      metadata: { designId, product, accountId: user?.id ? String(user.id) : '' },
      automatic_tax: taxEnabled() ? { enabled: true } : undefined,
      customer_email: user?.email || undefined,
      shipping_address_collection: item.shippable
        ? { allowed_countries: shippingCountries() }
        : undefined,
      discounts,
    };
    const session = await stripe.checkout.sessions.create(sessionParams);

    if (hasDb()) {
      await db.query(
        `INSERT INTO purchases (design_id, account_id, stripe_session_id, amount_cents, currency, product, promo_code, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (stripe_session_id) DO NOTHING`,
        [
          designId,
          user?.id || null,
          session.id,
          item.unitAmount,
          item.currency,
          product,
          promo || null,
          JSON.stringify({ shippable: !!item.shippable }),
        ]
      );
    }

    logger.info({ msg: 'payments.session_created', sessionId: session.id, designId, product });
    return { url: session.url, sessionId: session.id };
  },

  'payments.verifySession': async ({ socket, payload }) => {
    if (!stripeEnabled()) throw new CommandError(ErrorCode.STRIPE_NOT_CONFIGURED, 'stripe_not_configured');
    const parsed = VerifySchema.safeParse(payload);
    if (!parsed.success) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid', parsed.error.issues);
    const { sessionId } = parsed.data;

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent', 'total_details.breakdown'],
    });

    const paid = session.payment_status === 'paid';
    const designId = session.metadata?.designId || null;
    const product = session.metadata?.product || 'stl_download';
    const user = maybeUser({ socket });

    if (paid && hasDb()) {
      await db.query(
        `UPDATE purchases
            SET status = 'paid',
                paid_at = COALESCE(paid_at, NOW()),
                stripe_payment_id = $2,
                customer_email = $3,
                shipping_address = $4,
                tax_breakdown = $5
          WHERE stripe_session_id = $1`,
        [
          sessionId,
          session.payment_intent?.id || null,
          session.customer_details?.email || null,
          session.shipping_details ? JSON.stringify(session.shipping_details) : null,
          session.total_details?.breakdown ? JSON.stringify(session.total_details.breakdown) : null,
        ]
      );
    }

    let design = null;
    if (paid && designId) {
      const entry = await designStore.get(designId);
      if (entry) {
        // P1-003 — refuse cross-user reads.
        if (entry.accountId != null && user && entry.accountId !== user.id) {
          throw new CommandError(ErrorCode.AUTH_REQUIRED, 'design_belongs_to_other_user');
        }
        design = {
          designId,
          filename: entry.filename,
          stl_b64: entry.stl.toString('base64'),
        };
      }
      // P2-008 — email the STL after purchase. Best-effort, never blocks.
      if (paid && session.customer_details?.email && entry) {
        sendEmail({
          to: session.customer_details.email,
          template: 'order-stl',
          data: {
            email: session.customer_details.email,
            product,
            amount: ((session.amount_total || 0) / 100).toFixed(2),
            currency: (session.currency || 'usd').toUpperCase(),
            designId,
            stlUrl: `${appUrl(socket)}/account`,
          },
          attachments: [
            {
              filename: entry.filename,
              content: entry.stl,
              contentType: 'model/stl',
            },
          ],
          accountId: user?.id || null,
        }).catch((err) => logger.warn({ msg: 'payments.stl_email_failed', err: err.message }));
      }
    }

    return {
      paid,
      designId,
      design,
      product,
      amount: session.amount_total,
      currency: session.currency,
      customerEmail: session.customer_details?.email || null,
      tax: session.total_details?.amount_tax || null,
      shipping: session.shipping_details || null,
    };
  },

  // P2-007 — admin refund command.
  'payments.refund': async ({ socket, payload }) => {
    if (!stripeEnabled()) throw new CommandError(ErrorCode.STRIPE_NOT_CONFIGURED, 'stripe_not_configured');
    const actor = requireAdmin({ socket });
    const parsed = RefundSchema.safeParse(payload);
    if (!parsed.success) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid', parsed.error.issues);
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.retrieve(parsed.data.sessionId, {
      expand: ['payment_intent'],
    });
    if (!session.payment_intent?.id) {
      throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'no_payment_intent');
    }
    const refund = await stripe.refunds.create({
      payment_intent: session.payment_intent.id,
      reason: parsed.data.reason ? 'requested_by_customer' : undefined,
    });

    if (hasDb()) {
      await db.query(
        `UPDATE purchases SET status = 'refunded', metadata = metadata || $2::jsonb WHERE stripe_session_id = $1`,
        [parsed.data.sessionId, JSON.stringify({ refund_id: refund.id, refund_reason: parsed.data.reason || null })]
      );
    }
    await recordAudit({
      actorId: actor.id,
      action: 'payments.refund',
      targetType: 'session',
      targetId: parsed.data.sessionId,
      metadata: { reason: parsed.data.reason || null, refund_id: refund.id },
    });
    return { ok: true, refundId: refund.id };
  },

  // P2-015 — Stripe Customer Portal.
  'payments.openCustomerPortal': async ({ socket }) => {
    if (!stripeEnabled()) throw new CommandError(ErrorCode.STRIPE_NOT_CONFIGURED, 'stripe_not_configured');
    const user = maybeUser({ socket });
    if (!user) throw new CommandError(ErrorCode.AUTH_REQUIRED, 'auth_required');
    const stripe = getStripe();
    let customerId = user.stripe_customer_id || null;
    if (!customerId && hasDb()) {
      const { rows } = await db.query(
        `SELECT stripe_payment_id FROM purchases WHERE account_id = $1 AND stripe_payment_id IS NOT NULL LIMIT 1`,
        [user.id]
      );
      if (rows[0]?.stripe_payment_id) {
        try {
          const pi = await stripe.paymentIntents.retrieve(rows[0].stripe_payment_id);
          customerId = typeof pi.customer === 'string' ? pi.customer : null;
        } catch (err) {
          logger.warn({ msg: 'payments.portal_pi_lookup_failed', err: err.message });
        }
      }
    }
    if (!customerId) throw new CommandError(ErrorCode.PAYMENT_REQUIRED, 'no_stripe_customer');

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl(socket)}/account`,
      configuration: process.env.STRIPE_CUSTOMER_PORTAL_CONFIG_ID || undefined,
    });
    return { url: session.url };
  },
};
