# Launch checklist

> One-page checklist for shipping ValveHeadZ to the public. Each item has a
> verification command or URL — don't tick the box unless you've actually
> seen the green signal.

## Legal & policy

- [ ] **Terms of Service** rendered at `/terms` with a versioned date in the
      footer (`<a href="/terms">…2026-04-29 version</a>`).
- [ ] **Privacy Policy** rendered at `/privacy` — mentions photo retention
      (90 days, P1-006), failure-corpus retention, STL retention (24h free,
      indefinite paid).
- [ ] **Acceptable Use Policy** rendered at `/acceptable-use`.
- [ ] **Lawyer review** — at minimum, the privacy policy. The TOS / AUP
      scaffolds are placeholders.

  Verify: `curl -fsS $APP_URL/terms /privacy /acceptable-use | head -5`.

## Identity & accounts (Phase 1)

- [ ] `AUTH_SECRET` set to a 32+ byte random string in production. Verify
      in DO console — not in the repo.
- [ ] `ADMIN_EMAILS=…` set so the first sign-in promotes you. After first
      login: `psql $DATABASE_URL -c "select email, role from accounts where role = 'admin'"`.
- [ ] Email provider env set: `RESEND_API_KEY` (or `POSTMARK_TOKEN`) +
      `EMAIL_FROM=…`. End-to-end test:
      `socket.request('auth.requestMagicLink', { email: '<your email>' })`
      and confirm the message arrives (not a `console` backend log line).

## Stripe (Phase 2)

- [ ] **Live keys** swapped (`STRIPE_SECRET_KEY=sk_live_…`).
- [ ] `STRIPE_WEBHOOK_ENABLED=true` + `STRIPE_WEBHOOK_SECRET` from the
      Stripe dashboard's webhook endpoint.
- [ ] `STRIPE_TAX_ENABLED=true` if registered in the Stripe dashboard.
- [ ] `STRIPE_SHIPPING_COUNTRIES=…` matches print-vendor coverage.
- [ ] Webhook endpoint listed in Stripe dashboard:
      `https://$APP_URL/stripe/webhook`. Test event delivers and arrives.
- [ ] **Single end-to-end purchase** in live mode: $2 STL → email arrives
      → STL downloads.

## RunPod / GPU (Phase 3)

- [ ] `RUNPOD_ENDPOINT_URL` + `RUNPOD_API_KEY` set.
- [ ] **Max Workers** raised to expected concurrency (default 1; bump to
      ≥3 before launch).
- [ ] `/health` returns `runpod.reachable: true` (P0-011).
- [ ] One canary `stl.generate` lands inside p95 budget (~60s warm).

## Observability (Phase 4)

- [ ] `SENTRY_DSN` set; deliberately throw an error in dev to confirm it
      arrives in Sentry.
- [ ] `METRICS_TOKEN` set; `curl -H "Authorization: Bearer $METRICS_TOKEN" $APP_URL/metrics`
      returns Prometheus text.
- [ ] Sentry → Slack/Discord webhook alerts wired (P4-012).
- [ ] Synthetic canary cron scheduled (P4-013).

## Rate limiting & abuse (Phase 0)

- [ ] `STL_RATE_LIMIT_PER_SOCKET=3`, `STL_RATE_LIMIT_PER_IP=10` (defaults).
- [ ] CSP headers verified in browser DevTools — no warnings on the normal
      flow.

## Feature flags (P0-010)

- [ ] All flags reviewed in `flags.list`. Set known launch defaults:
      ```
      flags.set { key: 'best_of_n',          enabled: false }    # P3-004
      flags.set { key: 'live_redline',       enabled: false }    # P3-008
      flags.set { key: 'pack_of_4',          enabled: true }     # P2-002
      flags.set { key: 'sms_magic_link',     enabled: false }    # P7-003
      ```

## Backups (P0-015)

- [ ] Latest entry in `docs/DB_RESTORE.md` drill log is < 90 days old.

## DNS & TLS

- [ ] Custom domain attached to DO App Platform.
- [ ] `https://valveheadz.app` redirects from `http://`.
- [ ] `https://www.valveheadz.app` 301s to apex.

## Final gut-check

- [ ] **Logged-out flow**: visit /, generate, attempt purchase. Confirm
      gentle prompt to sign in (or anonymous purchase if that's the call).
- [ ] **First-time signed-in flow**: magic-link → /account → photo library
      empty state looks fine.
- [ ] **Admin flow**: log in as admin → /admin loads → metrics render.
- [ ] **Mobile Safari** + **Mobile Chrome** smoke test of the home page.
- [ ] No `console.error` lines during the happy path.

## Rollback plan

- Keep the previous DO App revision ready for one-click rollback.
- If only the GPU side is broken: flip `TRELLIS_ENABLED=false` to drop
  back to the procedural fallback head; users can still see something.
- If everything's broken: `STRIPE_SECRET_KEY` blanked → home page still
  serves, but `payments.*` returns `stripe_not_configured` cleanly.
