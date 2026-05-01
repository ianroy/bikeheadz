# Changelog

What's shipped on **stemdomez.com**, most recent at the top. Anything a
user sees on the site, anything that changes a contract, anything that
moves the print-quality needle — gets a bullet.

For the deeper "why," see [`3D_Pipeline.md`](../3D_Pipeline.md),
[`docs/RUNPOD_TRELLIS_PLAYBOOK.md`](RUNPOD_TRELLIS_PLAYBOOK.md), and
the press kit at [/press](/press).

---

## v0.1.39 — preserve the valve cap, harden stage 2 (2026-04-30)

The "watertight head with no cap" bug from v0.1.38 fixed.

- **PyMeshFix `joincomp=False`.** When stage 4 falls back to mesh
  concatenation (head + cap as 2 separate shells — the typical path
  because TRELLIS heads aren't watertight enough for manifold3d's
  CSG union), the previous `joincomp=True` was telling MeshFix to
  *stitch* the cap onto the head, collapsing the threaded geometry
  into nothing. Now both shells are sealed independently and the
  bike-mounting end actually exists in the output.
- **Stage 2 `NoneType` guard.** `_boolean_crop_below()` returning
  `None` no longer crashes the pipeline mid-job. Surfaces as a
  structured `NECK_NOT_FOUND` error and the orchestrator
  auto-retries stage 2+3 once with a relaxed shoulder-taper
  fraction (matching the existing thin-wall retry).

## v0.1.38 — fix the watertight repair (2026-04-30)

The repair pass introduced in v0.1.37 was silently no-op'ing on
every job because of two API mismatches.

- **`pymeshfix` API.** `MeshFix.v` / `.f` was removed in 0.15+.
  Switched to `pymeshfix.clean_from_arrays()`. v0.1.37 was shipping
  un-repaired meshes — the holes you saw in the preview were never
  actually being fixed in production.
- **`fast_simplification` API.** `simplify_mesh(target_count=…)`
  doesn't exist; the real call is `simplify(target_reduction=…)`.
  Stage 1.5 was leaving 1M+-tri TRELLIS output un-decimated, which
  then tripped stage 2's `NECK_NOT_FOUND` on hard inputs.

## v0.1.37 — stage 6 print-repair pass (2026-04-30)

- **Stage 6 added.** A final pass after stage 5 pipes the post-
  decimate mesh through PyMeshFix (Marco Attene's MeshFix wrapped
  for Python) — the gold-standard tool for turning an arbitrary
  triangle soup into a guaranteed watertight, 2-manifold,
  self-intersection-free mesh. Output is now slicer-ready as a
  printable solid; the small head-crown holes + cap-seam
  self-intersections we'd been seeing in production are sealed.
  *(API bugs in this release fixed in v0.1.38.)*

## v0.1.36 — visible error UI + viewer hardening (2026-04-30)

- **Generation-failed error banner** on `/stemdome-generator`.
  The previous failure UX was a transient generate-button text
  flip. Now a magenta-bordered "Generation failed." card surfaces
  the actual error message until the user retries.
- **Viewer defensive scale.** STL loader guards against degenerate
  bounding spheres so the model never silently lands at
  micro-scale (the cause of the "preview is empty" report).
- **Stage 1.5 mesh-too-large demoted to warn-and-continue.** Was
  raising on every TRELLIS output that exceeded the 500K tri cap;
  now auto-decimates and ships through.

## v0.1.35 — iPhone-photo robustness (2026-04-30)

iCloud sets every iOS-default camera to HEIC. Without this, every
iPhone-direct upload failed at decode.

- **`pillow-heif` registered** in handler.py so HEIC/HEIF inputs
  decode without the user having to convert.
- **EXIF orientation honored** before the photo hits TRELLIS — fixes
  the "head appears sideways" symptom on phone-portrait uploads.
- **Auto-retry on TRELLIS sampler stalls** with a different seed when
  the first sample produces an empty silhouette.

---

## Spring 2026 — product

The launch-window features, version-less because they touched the
website rather than the RunPod handler.

- **Sadie's Sixpack drop.** Six hand-modeled lore caps (Captain, Big
  Mick, Little Space Bear, Old Reliable, Sasquatch Foot, Professor)
  inline on the landing page and via the `#sixpack` anchor. Free
  STL downloads, no auth, no checkout. Powered by lazy WebGL
  viewers (max 2 alive at once via IntersectionObserver).
- **Gumball Machine Takeover.** The whole project reframed around
  the [Sadie's Bikes](https://www.instagram.com/sadiesbikes/)
  curatorial residency — 50¢ caps in 2″ capsules at Waterway Arts,
  Great (Turners) Falls, MA. Landing About + `/press` long-form
  rewritten to match.
- **Spinning CSS-3D cap hero.** Replaces the static monogram on
  `/`. Drag-to-spin wired by `SDZRadical.init()`.
- **Three marquee tickers** (top magenta · mid purple-reversed ·
  low ink) bridge the section beats on the landing.
- **Operator-page beige-card design cue** (brandstandards.MD §17)
  applied to `/admin`, `/account`, `/help`, `/showcase`, `/press`,
  every legal page. Pinned-literal hexes via `var(--sdzr-*)` so
  dark-mode users don't get cream-on-cream invisible text.
- **Multi-region RunPod racing.** Backend now races US + Romania
  endpoints in parallel, sticks with whichever region's worker
  picks up the job first, cancels the loser. Same job, half the
  queue wait. New `/admin` Regions tab with race-winner pie +
  per-endpoint table.
- **Stage 6 watertight repair** (see v0.1.37–v0.1.39 above).
- **MVP Free mode.** `payments_enabled` flag default OFF. The
  `$2 STL` line gets a magenta spraypaint X with a fluoro
  `Free!` graffiti tag site-wide; STLs are free to download for
  any signed-in user.
- **`/sixpack` and `/how-it-works` collapsed into landing anchors.**
  Header nav, footer column, and legal-page quicklinks all point
  to `/#sixpack` and `/#how`. Router gained hash-aware navigation
  with smooth-scroll + retry-after-layout-settle.
- **WCAG AA contrast pass.** Six white-on-magenta failures (~3.26:1)
  flipped to ink-on-magenta (5.31:1). Audit notes in
  `brandstandards.MD`.
- **Calm-mode floating toggle** (∥/▶ button bottom-left). Honors
  `prefers-reduced-motion` automatically; `localStorage` persists
  user override.
- **Tweaks panel** (`?tweaks=1` to enable). Live knobs for hero
  variant, halftone density, splatter count, marquee speed,
  jitter, checker size. Workshop tool, not a feature.
- **Press kit redesign** (`/press`). Three-length boilerplate with
  copy buttons, real wordmark, real palette, real product imagery,
  CC0 sticker.

---

## v0.1.34 — production end-to-end pipeline (week of 2026-04-29)

The big one: photo → printable STL → checkout → download now works in
production without manual intervention.

- **Pipeline lands.** Stages 1–5 run on the RunPod worker and produce a
  printable STL inside the 50–80K triangle budget. Stage 1.5 warns
  rather than raising on non-watertight TRELLIS output (the meshes
  routinely have euler < -20 — see `trellis_mesh_quality.md`).
- **Chunked-yield delivery.** The 5-version delivery-bug saga
  (v0.1.31–v0.1.33) ends. `return_aggregate_stream=False` and
  ~700 KB base64 chunks per yield. RunPod's per-request 1 MB cap no
  longer 400s the result.
- **TRELLIS-output cache.** Slider tweaks (Crop Tightness, Head Pitch,
  Head Height, Cap Protrusion) skip the GPU stage on warm workers
  when the photo + seed match. First generation: ~30–60 s warm;
  re-tweak: 1–2 s.
- **Status page (`/status`).** Live traffic-light tiles for Node,
  RunPod, Postgres, and the Stripe webhook (`system.health` socket
  command, cached 60 s).
- **Help (`/help`), Press kit (`/press`), Changelog (`/changelog`),
  Incidents (`/incidents`).** Public surfaces for support, brand
  partners, and trust.
- **Latency budget doc** (`docs/LATENCY_BUDGET.md`). Where the
  seconds go and what each hop's ceiling is.

## v0.1.30 — magic-link auth, account hub, GDPR (week of 2026-04-22)

- Passwordless sign-in with magic links (Resend in prod, devUrl
  fallback in development).
- `/account` hub with Designs / Photos / Orders / Settings tabs.
- GDPR-grade self-serve data export (`account.exportData`) and account
  delete (`account.delete`) — Stripe purchase rows are anonymised
  rather than hard-deleted to comply with payment-processor retention.
- Audit log for staff actions (no photo bytes or STL contents are
  logged — only ids and metadata).

## v0.1.27 — admin, promos, A/B, OG cards (week of 2026-04-15)

- Admin dashboard for moderation, refunds, and feature-flag
  inspection. Role-gated server-side via `requireRole('admin')`.
- Promo codes (`promos.apply`) and per-design Open Graph cards for
  shareable links.
- A/B framework (`flags.evaluate`) used for the homepage hero copy
  experiment.
- Failure-corpus snapshots written to
  `/runpod-volume/failures/<yyyymmdd>/<jobId>/` for debug replay.
