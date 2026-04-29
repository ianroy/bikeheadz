# Latency Budget — generate → checkout → download

Last updated: 2026-04-29 (v0.1.34)

This is the one-pager every time-budget conversation should reference
before someone "optimizes" the wrong hop. The numbers below are
empirical, drawn from the v0.1.34 production runs documented in
[`docs/RUNPOD_TRELLIS_PLAYBOOK.md`](RUNPOD_TRELLIS_PLAYBOOK.md) and the
locked decisions in [`3D_Pipeline.md` §0](../3D_Pipeline.md). When
adding a new hop, update this table — don't grow the budget silently.

The user-perceived clock starts when they tap **Generate** on
`/` (home) and stops when the printable STL has hit their disk after
checkout.

---

## Total budget at a glance

| Phase                        | Cold (worst case) | Warm (typical) | Hard ceiling |
|------------------------------|-------------------|----------------|--------------|
| `generate` (photo → STL)     | 5–10 min          | 30–60 s        | 12 min (RunPod stream cap) |
| `checkout` (STL → paid)      | 8–15 s            | 4–8 s          | 30 s (Stripe redirect timeout) |
| `download` (paid → on disk)  | 2–6 s             | 1–3 s          | 12 s (socket reassembly + blob) |
| **End-to-end**               | **~12 min**       | **~45–80 s**   | **~13 min**  |

Cold = first request after a deploy or after the GPU worker idled out;
warm = subsequent requests on the same RunPod worker.

---

## Phase 1 — `generate`

```
Browser
  └─ socket.emit("command", stl.generate, { imageData })
        ▼  Node tier (DigitalOcean App Platform)
        └─ runpod-client.js POST /v2/<endpoint>/run
              ▼  RunPod scheduler → worker
              └─ handler.py generator yields:
                   { type: "progress", … }      (every stage)
                   { type: "result_chunk", … }  (CHUNK_SIZE = 700_000 b64 bytes)
                   { type: "result", chunks: N }
              ◀─ /v2/<endpoint>/stream/<jobId>  (Node polls every 1.5 s)
        ◀─ socket.emit("command", stl.generate.progress|result)
Browser receives `{ designId, stl_b64, triangles }`
```

| Hop                           | Cold   | Warm    | Notes |
|-------------------------------|--------|---------|-------|
| Browser → Node socket emit    | <50 ms | <50 ms  | Local LAN / WiFi typical. Counted against the start-of-`generate`. |
| Node → RunPod `/run` POST     | 200–400 ms | 200–400 ms | DO ↔ RunPod cross-region. |
| RunPod schedule + worker boot | **5–10 min** | **0 s** | TRELLIS = 2.5 GB safetensors + dinov2 1.1 GB + u2net 176 MB. With Network Volume + warm pipeline (`docs/RUNPOD_TRELLIS_PLAYBOOK.md` §7) drops to **~30–60 s** to first result. |
| TRELLIS GPU inference         | 25–45 s | 25–45 s | Slider tweaks hit the TRELLIS-output cache and skip this entirely (~1–2 s on rerun). |
| Pipeline stages 1–5           | 4–8 s  | 4–8 s   | Stage 1 voxel → 1.5 repair → 2 align → 3 subtract → 4 union → 5 export. Triangle budget 50–80K, min wall 1.2 mm (`3D_Pipeline.md §0`). Stage 1.5 warns and continues on non-watertight (per `runpod_aggregate_stream_400.md` and `trellis_mesh_quality.md`). |
| Chunked yield delivery        | 2–5 s  | 2–5 s   | ~4 MB binary STL → ~5.5 MB base64 → 8 frames at 700 KB. `return_aggregate_stream=False` (anything else trips the per-request 1 MB cap and 400s the entire result). |
| Node poll → socket forward    | 1–3 s  | 1–3 s   | Polling cadence 1.5 s; reassembly happens on every poll, not at COMPLETED. |
| **Phase total**               | **5–10 min** | **30–60 s** | |

**Where the seconds actually go (warm path):**
- 50% TRELLIS GPU work (uncacheable on first generation).
- 25% pipeline stages 1–5 (CPU-bound; manifold3d boolean is the long pole).
- 15% chunked delivery + Node polling round trips.
- 10% network + scheduling overhead.

**The single biggest lever:** keep the pipeline warm. The
`min_workers ≥ 1` setting on the RunPod endpoint trades ~$0.40/hr idle
GPU cost for the difference between a 30 s warm response and a 5–10
min cold start.

---

## Phase 2 — `checkout`

```
Browser
  └─ socket.emit("command", payments.createCheckoutSession, { designId })
        ▼  Node tier
        └─ Stripe Checkout Session API call
        ◀─ { url } returned
Browser
  └─ window.location = url   ──▶  checkout.stripe.com
                                       (user enters card)
                                       ◀─ redirect to /checkout-return
                                          (with session_id)
        ▼  Node tier
        └─ payments.confirmCheckoutSession  (verifies, marks paid)
```

| Hop                                  | Cold | Warm | Notes |
|--------------------------------------|------|------|-------|
| socket → `payments.createCheckoutSession` | ~50 ms | ~50 ms | Single round trip. |
| Node → Stripe API                    | 250–600 ms | 250–600 ms | Stripe call + DB insert of pending purchase row. |
| Stripe redirect                      | 1–2 s | 1–2 s | Browser navigates to `checkout.stripe.com`. |
| User card entry                      | excluded | excluded | Out of our latency budget — but Stripe Link autofill cuts this dramatically when the user has used Stripe before. |
| Stripe → `/checkout-return`          | 1–2 s | 1–2 s | Stripe 302s back; the browser loads `checkout-return.js`. |
| `payments.confirmCheckoutSession`    | 500 ms–2 s | 500 ms–2 s | Polls the Checkout Session to verify, since `STRIPE_WEBHOOK_ENABLED=false` in dev (see FAQ + `docs/INCIDENTS.md`). In prod the webhook fires in parallel and writes the same row first; the polled call reconciles. |
| **Phase total (excl. card entry)**   | **~8–15 s** | **~4–8 s** | |

**No webhook in dev** is intentional — we don't want to require a
Stripe CLI tunnel for local development. The post-redirect polling
handler is the source of truth in dev. In production the webhook is
required (`webhookEnabled()` returns true) and the redirect handler
becomes the safety net.

---

## Phase 3 — `download`

```
Browser  (already on /checkout-return, purchase verified)
  └─ socket.emit("command", stl.download, { designId })
        ▼  Node tier
        └─ Loads STL from ephemeral cache OR DB blob row
        ◀─ stl.download.result   { stl_b64 }
Browser
  └─ Buffer.from(stl_b64, "base64") → Blob → <a download>
```

| Hop                              | Cold | Warm | Notes |
|----------------------------------|------|------|-------|
| socket → `stl.download`          | ~50 ms | ~50 ms | |
| STL fetch (cache or DB)          | 100–500 ms | 50–200 ms | DB blob path on cold container; in-memory cache otherwise. |
| Server emit `stl.download.result`| 1–3 s | 1–3 s | Same chunked-yield protocol as generate; ~4 MB binary STL. The socket.io `maxHttpBufferSize` ceiling is the cap of last resort (default 1 MB; bumped server-side to 8 MB). |
| Browser blob assembly + save     | 100–500 ms | 100–500 ms | Base64 → bytes → Blob → URL.createObjectURL → anchor click. |
| **Phase total**                  | **2–6 s** | **1–3 s** | |

---

## Hop-level targets (single source of truth)

| Hop                                | Target | Hard ceiling |
|------------------------------------|--------|--------------|
| Socket round-trip (DO ↔ browser)   | <100 ms p50 | 500 ms p99 |
| Node ↔ RunPod single API call      | <500 ms p50 | 2 s p99 |
| TRELLIS warm inference             | 30 s   | 60 s |
| TRELLIS cold start (volume on)     | 60 s   | 180 s |
| TRELLIS cold start (volume off)    | 5 min  | 10 min |
| Pipeline stages 1–5 (CPU)          | 6 s    | 15 s |
| STL chunked delivery (~4 MB binary)| 3 s    | 10 s |
| Stripe Checkout Session create     | 400 ms | 1.5 s |
| Stripe redirect round-trip         | 3 s    | 8 s |
| `/checkout-return` confirmation    | 1 s    | 5 s |
| Blob delivery to disk              | 1 s    | 5 s |

**Anything outside the "ceiling" column is a bug.** If a single hop
breaches the ceiling, treat it as an incident — log it, root-cause
it, and update this doc. The ceiling values are wired into the
`/status` page tiles where applicable.

---

## See also

- [`docs/RUNPOD_TRELLIS_PLAYBOOK.md`](RUNPOD_TRELLIS_PLAYBOOK.md) — why `return_aggregate_stream=False` and 700 KB chunks.
- [`3D_Pipeline.md` §0](../3D_Pipeline.md#0-locked-decisions) — triangle budget, wall thickness, format-on-the-wire.
- [`docs/CHANGELOG.md`](CHANGELOG.md) — version history; v0.1.34 is the first release where the warm path consistently lands inside the budget above.
- [`docs/INCIDENTS.md`](INCIDENTS.md) — when a hop blew its ceiling and why.
