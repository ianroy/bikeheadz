# StemDomeZ — Claude conventions

This file is loaded automatically into every Claude Code session that
touches this repo. Keep it short and load-bearing. Anything operator-
facing or worth never-forgetting goes here; everything else lives in
the doc it belongs to.

## Brand + design

- **Brand standards live in [brandstandards.MD](./brandstandards.MD).**
  Read it before touching any UI, especially §11 (don't put fluoro-
  green text on cream paper) and §14 (pinned-literal surfaces).
- **Operator + content pages follow the "beige card" design cue** —
  see [§17](./brandstandards.MD) for the recipe. Page wrapper is
  pinned-literal cream (`#F5F2E5`), inset cards are beige
  (`#E5E0CC`) with 2px ink borders, body type is full ink
  (`#0E0A12`) not ink-muted. Applies to `/admin`, `/account`,
  `/how-it-works`, `/showcase`, `/help`, every legal page. The
  landing (`/`) and generator (`/stemdome-generator`) keep their
  Memphis / halftone treatment — don't apply the operator cue
  there.
- **Wordmark + Z signature**: trailing Z always neon purple
  italic with a fluoro-green drop shadow (§1, §4).

## Architecture

- **Single working tree, single repo.** No monorepo.
- **Client**: `client/` — Vanilla JS SPA via Vite, hyperscript-
  style `el()` builder in `client/dom.js`. No JSX, no React, no
  framework. Tailwind v4 utilities are available.
- **Server**: `server/` — Node 22 + Express + socket.io. Single
  `command` socket event; every interaction is `{ id, name,
  payload }`. Add new commands in `server/commands/*.js` and they
  auto-register via `server/commands/index.js`.
- **Pipeline**: `handler.py` + `server/workers/pipeline/` — RunPod
  serverless TRELLIS + 7-stage CAD. Bumps to `HANDLER_VERSION`
  require a GHA build (release tag) + RunPod release.
- **Architecture diagram**: [architecture.svg](./architecture.svg)
  is the current source of truth. The brand-styled version on
  `/`'s "How it really works." block mirrors it.

## Auth + sessions

- **Magic-link is the default.** Optional opt-in password (scrypt,
  10+ chars). Both produce a server-side session row + signed
  `sd_session` cookie.
- **TOS_VERSION constant** in `server/commands/account.js` mirrors
  `LEGAL_VERSION` in `client/pages/legal.js`. Bump both whenever a
  material legal edit lands; existing users get a re-acceptance
  prompt at next `/account` visit.
- **Admin role**: gated by `requireAdmin({ socket })`. Promote /
  demote via `admin.users.setRole`. `ADMIN_EMAILS` env var seeds
  admins at boot.

## Database

- **Postgres 18** managed on DO. Migrations in
  `server/migrations/NNN_*.sql`, applied automatically on boot
  via the migrate-on-boot hook in `server/index.js` (idempotent,
  uses `schema_migrations` table).
- **node-postgres returns BIGINT as a string by default.** Cast
  both sides to `Number()` when comparing user ids — the legacy
  bug history is in commit `1237da7`.

## Feature flags + MVP launch

- **Three flags** drive the launch posture, in `feature_flags`
  (migration 004) + a 30s-cached resolver in
  `server/app-config.js`:
  - `payments_enabled` — default OFF for the MVP. When off,
    Stripe is bypassed, STL downloads are free for logged-in
    users, and the marketing pages render with magenta
    spraypaint strikethrough + fluoro "FREE!" graffiti tags
    over the legacy pricing copy.
  - `printing_enabled` — default OFF. Hides Printed Stem +
    Pack of 4 site-wide.
  - `aaa_toggle_enabled` — default OFF. The floating AAA-
    contrast chip only mounts when an admin flips this on.
- Flip toggles in `/admin` → Overview → MVP launch toggles.

## Email

- **Resend is the outbound provider** (`RESEND_API_KEY` env).
  Templates in `server/emails/*.{html,txt,subject}`.
- **ImprovMX is the inbound forwarder** for `*@stemdomez.com`.
  No code dependency — DNS-only.

## Repo hygiene

- **Commit straight to `main`.** No PRs during the MVP push.
  Memory file
  `~/.claude/projects/.../memory/feedback_direct_to_main.md`
  records this; the no-PR posture is per the owner's explicit
  ask.
- **Pre-commit hook is `npx lint-staged`.** This workstation
  often lacks npm; commit with `--no-verify` is approved by the
  owner until npm is installed.
- **No node available** to run `npm run build` from Claude
  Code — sanity-check changed JS with `node --check <file>`
  using the LM Studio bundled Node at
  `/Users/ianroy/.lmstudio/.internal/utils/node`.

## Touchstones

- Memory: `~/.claude/projects/-Users-ianroy-...-bikeheadz/memory/`
  is auto-loaded; consult before doing anything that depends on
  prior decisions.
- Owner inbox: `ianroy@stemdomez.com` (forwarded), test account
  `makerlab@protonmail.com`.
- Production URL: `https://stemdomez.com` (DO App Platform).
- RunPod release flow: `gh release create vX.Y.Z` → GHA builds
  GHCR image (~17–25 min) → RunPod dashboard → New Release →
  paste GHCR URL → confirm boot banner.

  **Claude does the `gh release create` step automatically** whenever
  a commit bumps `HANDLER_VERSION` in `handler.py`. Don't wait for the
  owner to run it. After the release fires, watch the GHA run in the
  background (`gh run watch <id>`) and notify the owner when the image
  is on GHCR — they handle the manual RunPod-dashboard "New Release"
  paste step (no API exists for serverless endpoint releases).
