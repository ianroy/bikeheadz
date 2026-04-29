# Changelog

A user-facing list of what's shipped, week by week. Bug fixes that no
user noticed get folded into the weekly bucket; anything visible in the
UI or that changes a contract gets its own bullet. Most-recent at the
top.

For the deeper "why," see [`3D_Pipeline.md`](../3D_Pipeline.md) and
[`docs/RUNPOD_TRELLIS_PLAYBOOK.md`](RUNPOD_TRELLIS_PLAYBOOK.md).

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
