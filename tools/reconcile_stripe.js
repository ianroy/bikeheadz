#!/usr/bin/env node
// P4-019 — Stripe ↔ purchases reconciliation.
//
// Daily cron (06:00 UTC). Lists the last 24h of Checkout sessions from
// Stripe, joins them against our `purchases` table over `stripe_session_id`,
// and emits an audit row for every mismatch under one of three buckets:
//
//   • paid_in_stripe_pending_in_db — Stripe says paid, DB still pending
//   • paid_in_db_absent_in_stripe  — DB says paid, no matching Stripe session
//   • divergent_amount             — both sides exist but amounts disagree
//
// Idempotency: each mismatch is hashed by (session_id, kind) and we skip
// inserting another audit row if one with the same hash exists in the
// last 24h. The hash is stored in metadata.idem_hash so subsequent runs
// can detect their own previous output.
//
// No REST. Pure Node script. Exits 0 if zero mismatches, 2 otherwise.

import crypto from 'node:crypto';
import pg from 'pg';
import Stripe from 'stripe';

const { Pool } = pg;

const STRIPE_KEY      = process.env.STRIPE_SECRET_KEY;
const DATABASE_URL    = process.env.DATABASE_URL;
const SSL_DISABLED    = process.env.DATABASE_SSL === 'false';
const WINDOW_SECONDS  = 86_400; // 24h

function logLine(obj) {
  process.stderr.write(JSON.stringify(obj) + '\n');
}

function hashMismatch(sessionId, kind) {
  return crypto.createHash('sha256').update(`${sessionId}|${kind}`).digest('hex');
}

function preparePgUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (SSL_DISABLED) u.searchParams.delete('sslmode');
    else u.searchParams.set('sslmode', 'no-verify');
    return u.toString();
  } catch {
    return url;
  }
}

async function recordAudit(db, { action, targetType, targetId, metadata }) {
  await db.query(
    `INSERT INTO audit_log (action, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4)`,
    [action, targetType, targetId == null ? null : String(targetId), metadata]
  );
}

async function alreadyLogged(db, idemHash) {
  const { rows } = await db.query(
    `SELECT 1 FROM audit_log
      WHERE action = 'reconcile.mismatch'
        AND metadata->>'idem_hash' = $1
        AND created_at > NOW() - INTERVAL '24 hours'
      LIMIT 1`,
    [idemHash]
  );
  return rows.length > 0;
}

async function main() {
  if (!STRIPE_KEY) {
    logLine({ ok: false, reason: 'stripe_secret_unset' });
    process.exit(2);
  }
  if (!DATABASE_URL) {
    logLine({ ok: false, reason: 'database_url_unset' });
    process.exit(2);
  }

  const stripe = new Stripe(STRIPE_KEY, { apiVersion: '2024-11-20.acacia' });
  const pool = new Pool({
    connectionString: preparePgUrl(DATABASE_URL),
    ssl: SSL_DISABLED ? false : { rejectUnauthorized: false },
    max: 2,
  });

  const since = Math.floor(Date.now() / 1000) - WINDOW_SECONDS;

  // 1. Pull Stripe sessions for the window.
  const stripeSessions = [];
  for await (const sess of stripe.checkout.sessions.list({
    created: { gte: since },
    limit: 100,
  })) {
    stripeSessions.push(sess);
  }

  // 2. Pull our purchases for the same window. Use created_at >= since
  // so we catch DB-side rows that Stripe may have rotated out of their
  // 100-row cap. (Bigger gap = bigger reconciliation, which is fine.)
  const sinceIso = new Date(since * 1000).toISOString();
  const { rows: dbRows } = await pool.query(
    `SELECT id, stripe_session_id, amount_cents, currency, status, created_at
       FROM purchases
      WHERE created_at >= $1`,
    [sinceIso]
  );

  // 3. Index both sides for the join.
  const stripeBySession = new Map();
  for (const s of stripeSessions) stripeBySession.set(s.id, s);
  const dbBySession = new Map();
  for (const r of dbRows) dbBySession.set(r.stripe_session_id, r);

  const mismatches = [];

  // 3a. Stripe says paid, DB still pending (or missing).
  for (const s of stripeSessions) {
    if (s.payment_status !== 'paid') continue;
    const dbRow = dbBySession.get(s.id);
    if (!dbRow || dbRow.status !== 'paid') {
      mismatches.push({
        kind: 'paid_in_stripe_pending_in_db',
        sessionId: s.id,
        stripeAmount: s.amount_total,
        stripeCurrency: s.currency,
        dbStatus: dbRow ? dbRow.status : null,
        dbId: dbRow ? dbRow.id : null,
      });
    }
  }

  // 3b. DB says paid, but no Stripe row in the window.
  for (const r of dbRows) {
    if (r.status !== 'paid') continue;
    if (!stripeBySession.has(r.stripe_session_id)) {
      mismatches.push({
        kind: 'paid_in_db_absent_in_stripe',
        sessionId: r.stripe_session_id,
        dbAmount: r.amount_cents,
        dbCurrency: r.currency,
        dbId: r.id,
      });
    }
  }

  // 3c. Divergent amounts — both sides agree the session exists but
  // the totals don't match. Stripe stores cents in amount_total; we
  // store cents in amount_cents. Currency comparison is case-insensitive.
  for (const s of stripeSessions) {
    const dbRow = dbBySession.get(s.id);
    if (!dbRow) continue;
    const stripeCents = Number(s.amount_total);
    const dbCents = Number(dbRow.amount_cents);
    const stripeCcy = String(s.currency || '').toLowerCase();
    const dbCcy = String(dbRow.currency || '').toLowerCase();
    if (Number.isFinite(stripeCents) && Number.isFinite(dbCents)) {
      if (stripeCents !== dbCents || stripeCcy !== dbCcy) {
        mismatches.push({
          kind: 'divergent_amount',
          sessionId: s.id,
          stripeAmount: stripeCents,
          stripeCurrency: stripeCcy,
          dbAmount: dbCents,
          dbCurrency: dbCcy,
          dbId: dbRow.id,
        });
      }
    }
  }

  // 4. Persist mismatches; suppress duplicates within the last 24h.
  let recorded = 0;
  for (const m of mismatches) {
    const idemHash = hashMismatch(m.sessionId, m.kind);
    if (await alreadyLogged(pool, idemHash)) {
      logLine({ ok: false, reason: 'mismatch_skipped_idempotent', kind: m.kind, sessionId: m.sessionId });
      continue;
    }
    const metadata = { ...m, idem_hash: idemHash };
    logLine({ ok: false, reason: 'mismatch', ...m });
    try {
      await recordAudit(pool, {
        action: 'reconcile.mismatch',
        targetType: 'purchase',
        targetId: m.dbId ?? m.sessionId,
        metadata,
      });
      recorded += 1;
    } catch (err) {
      logLine({ ok: false, reason: 'audit_insert_failed', err: err.message, kind: m.kind, sessionId: m.sessionId });
    }
  }

  await pool.end().catch(() => {});

  process.stdout.write(
    JSON.stringify({
      ok: mismatches.length === 0,
      checked: { stripe: stripeSessions.length, db: dbRows.length },
      mismatches: mismatches.length,
      recorded,
    }) + '\n'
  );

  process.exit(mismatches.length === 0 ? 0 : 2);
}

main().catch((err) => {
  logLine({ ok: false, reason: 'uncaught', err: err && err.message ? err.message : 'unknown' });
  process.exit(2);
});
