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
  `/showcase`, `/help`, `/press`, `/changelog`, `/incidents`,
  every legal page. The landing (`/`) and generator
  (`/stemdome-generator`) keep their Memphis / halftone treatment
  — don't apply the operator cue there.
- **Wordmark + Z signature**: trailing Z always neon purple
  italic with a fluoro-green drop shadow (§1, §4).
- **Pin colors with `var(--sdzr-*)`** anywhere a card/strip/sticker
  has a pinned background. The theme tokens `var(--ink)`,
  `var(--paper)`, `var(--brand)` flip in dark mode; the `--sdzr-*`
  set in `client/styles/sdz-radical.css` does NOT. Mixing the two
  on a pinned surface produces invisible cream-on-cream text in
  dark mode — already burned us once on `/sixpack`.
- **`/sixpack` and `/how-it-works` are landing anchors**, not
  separate pages. Header + footer + legal-quicklink links use
  `/#sixpack` and `/#how`. The router strips the fragment, renders
  `/`, and scrolls to the matching id with retry-after-layout-settle.
  The full inline Sixpack gallery lives in `client/pages/home.js`.
- **Brand footer is mounted globally** in `client/main.js` below
  the router's `<main>` element — every page gets it. Re-renders
  on `onAppConfigChange` so the Pricing graffiti tracks
  `payments_enabled`.

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
  require a GHA build (release tag) + RunPod release. Stage 6
  (PyMeshFix watertight repair) is the final pass before STL
  export — guarantees a 2-manifold solid for slicer input.
- **Architecture diagram**: [architecture.svg](./architecture.svg)
  is the current source of truth. The brand-styled version on
  `/`'s "How it really works." block mirrors it.

## Multi-region GPU (RunPod racing)

- **Backend races configured RunPod regions in parallel.** Set
  `RUNPOD_ENDPOINT_URLS=<us-url>,<ro-url>` (comma-separated) on DO
  to enable. Single-URL `RUNPOD_ENDPOINT_URL` still works as the
  legacy single-region path.
- **How it resolves**: POST `/run` to all endpoints in parallel →
  poll `/stream/<id>` on each → first endpoint whose worker picks
  up the job (status `IN_PROGRESS` or any frames) wins → losers
  get `/cancel/<id>`. One GPU bill per generation.
- **Force-warmup the new region**: `RUNPOD_FORCE_WARMUP=1` routes
  the first generation after server boot to the LAST endpoint in
  `RUNPOD_ENDPOINT_URLS` only (no race), so its volume populates
  with weights. Auto-consumed after one successful job. Safe to
  leave set indefinitely.
- **Telemetry** lives in `server/workers/runpod-client.js` (in-
  memory `getRunpodTelemetry()`) and surfaces in `/admin` →
  Regions tab.

## Image processing

- **Server-side downsample** before GPU dispatch.
  `server/commands/stl.js` runs uploads through `sharp` and caps
  the long edge at 1024 px (mozjpeg q88) before posting to
  RunPod. TRELLIS internally resizes to ~518 px so anything above
  ~1024 is wasted bandwidth. Tunable via env (see ProductSpec §8).
  Original upload bytes are still persisted to `user_photos` for
  re-runs; only the GPU-bound payload is shrunk.

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
- Owner inbox: `ianroy@stemdomez.com` (forwarded via ImprovMX),
  test account `makerlab@protonmail.com`.
- Production URL: `https://stemdomez.com` (DO App Platform).
- **Current handler image**: `v0.1.39` (PyMeshFix-cap-preserved
  + stage-2 None guard). Bump checklist lives in §"Architecture"
  above; the env-var matrix is in
  [ProductSpec.md §8](./ProductSpec.md#8-environments--configuration).
- **Both endpoints must be on the same image tag.** Roll US first,
  smoke-test, then roll RO. Race results are inconsistent if one
  region runs an older handler.
- **`RUNPOD_FORCE_WARMUP=1` is permanently set** on DO so freshly
  rolled regions get warmed by the first real job after boot.
- RunPod release flow: `gh release create vX.Y.Z` → GHA builds
  GHCR image (~17–25 min) → RunPod dashboard → New Release →
  paste GHCR URL → confirm boot banner.

  **Claude does the `gh release create` step automatically** whenever
  a commit bumps `HANDLER_VERSION` in `handler.py`. Don't wait for the
  owner to run it. After the release fires, watch the GHA run in the
  background (`gh run watch <id>`) and notify the owner when the image
  is on GHCR — they handle the manual RunPod-dashboard "New Release"
  paste step (no API exists for serverless endpoint releases).
