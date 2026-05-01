# ProductSpec — StemDomeZ developer onboarding

> **Who this is for**: engineers (human or agentic) who need to build,
> extend, or operate StemDomeZ. Start at the top, skim the TL;DR,
> deep-dive into the section that matches your task. If you are about
> to make architectural changes, also read the relevant SVGs in
> [docs/](./docs/) — there are six and they are accurate as of v0.1.41.
>
> Tone of these docs is plain and load-bearing. If a sentence sounds
> grumpy that is because the lesson it encodes was paid for in
> production minutes nobody is getting back.

---

## Contents

1. [TL;DR](#1-tldr)
2. [Mental model](#2-mental-model)
3. [System architecture](#3-system-architecture)
4. [Request lifecycles](#4-request-lifecycles)
5. [Command pattern protocol](#5-command-pattern-protocol)
6. [Data model](#6-data-model)
7. [Code layout](#7-code-layout)
8. [Environments & configuration](#8-environments--configuration)
9. [Dev workflow](#9-dev-workflow)
10. [Extension points](#10-extension-points)
11. [Design decisions & why](#11-design-decisions--why)
12. [Security & privacy](#12-security--privacy)
13. [Observability & operations](#13-observability--operations)
14. [Glossary](#14-glossary)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. TL;DR

- **What it is**: a web app that turns a portrait photo into a
  3D-printable Schrader-thread bike valve cap with the user's head on
  top. Target output is FDM/PLA-printable on any 0.4 mm-nozzle printer
  at 0.12–0.16 mm layer height (Bambu A1, Prusa MK4, Elegoo Centauri
  Carbon, etc.). Free during the launch window; $2 STL after.
- **Production status (v0.1.41)**: the 8-stage mesh pipeline runs
  end-to-end on RunPod GPU workers in two regions (US + RO) raced
  in parallel. Photo → server-side `sharp` resize (≤1024 px) →
  whichever region's worker picks up first → TRELLIS head mesh
  (~750k tris) → stage 1 normalize → stage 1.5 pymeshlab close-holes →
  **stage 1.7 PyMeshFix watertight** (added v0.1.41) → stage 2 crop →
  stage 3 carve cavity → stage 4 union cap → stage 5 decimate →
  **stage 6 split-and-process safety net** → chunked binary STL →
  Three.js viewer → free download (or Stripe Checkout when payments
  flag flips on). Pipeline details in
  [3D_Pipeline.md](3D_Pipeline.md); production gotchas in
  [docs/RUNPOD_TRELLIS_PLAYBOOK.md](docs/RUNPOD_TRELLIS_PLAYBOOK.md);
  visual diagrams in [docs/](./docs/).
- **How it's built**: vanilla JS + Three.js WebGL viewer client (no
  React, no JSX, ~50-line History API router); socket.io command
  pattern (single `'command'` event surface); Node 22 + Express
  server; RunPod Serverless GPU workers running TRELLIS + manifold3d +
  pymeshlab + pymeshfix; sharp on the Node side for image resize;
  Postgres 18 for state.
- **How it deploys**: DigitalOcean App Platform serves the Node app
  with Managed Postgres attached. Migrations run on every boot via an
  idempotent migrate-on-boot hook (DO PRE_DEPLOY also runs them but
  it skips the first deploy of every new app, which we discovered the
  exciting way). The TRELLIS image is built by GitHub Actions on each
  release tag, pushed to GHCR, and pulled by RunPod Serverless via a
  manual "New Release" click per region (no API exists for serverless
  endpoint releases — yes, we asked). Stripe Checkout verified on
  user return via `payments.verifySession` (no webhook required, no
  REST surface anywhere).
- **Brand context**: built for the Gumball Machine Takeover residency
  at Sadie's Bikes in Great (Turners) Falls, MA. The site lives at
  [stemdomez.com](https://stemdomez.com); 50¢ capsules at Waterway
  Arts on First Friday point at the URL. The machine is the flyer,
  the capsule is the box, the cap is the product, the site is real
  and it ships.

---

## 2. Mental model

StemDomeZ is the Node app coordinating four backends through two protocols:

```
                                                  ┌─ RunPod Serverless (prod) ──┐
                                                  │  POST /v2/<endpoint>/run    │
                                                  │  GET  /v2/<endpoint>/stream │
                                                  │  ghcr.io image: handler.py  │
                                                  │  (TRELLIS + trimesh)        │
                                  HTTP+poll       └─────────────────────────────┘
┌────────────┐    socket.io    ┌──────────────┐ ◀──┐
│   Client   │◀───commands───▶│   Node.js    │     │   stdin/stdout (dev fallback)
│ (vanilla + │                 │  (Express +  │     ├─▶ ┌──────────────────────┐
│ Three.js)  │                 │   socket.io) │     │   │ trellis_generate.py  │
└─────┬──────┘                 └──────┬───────┘ ◀──┘   │ (procedural / TRELLIS)│
      │ redirect                      │                └──────────────────────┘
      ▼                               │ Stripe SDK (SSR only)
┌────────────┐                        ▼                   ┌────────────┐
│  Stripe    │                 ┌────────────┐             │  Stripe    │
│ Checkout   │                 │  Postgres  │             │   API      │
│ (hosted)   │                 │ (designs,  │             │ (sessions) │
└────────────┘                 │ purchases, │             └────────────┘
                               │ accounts)  │
                               └────────────┘
```

Backend selection happens per-request in
[server/commands/stl.js:48](server/commands/stl.js): if both
`RUNPOD_ENDPOINT_URL` and `RUNPOD_API_KEY` are set, the request goes to
RunPod; otherwise the Node process spawns the local Python worker.

Three invariants hold everywhere:

1. **One transport, one event.** All traffic is `socket.emit('command', …)`.
   The only HTTP surfaces the server exposes are `GET /health` and the
   static `dist/` served under `/`. No REST endpoints at all — the Stripe
   integration is pure SSR (the Node server uses the Stripe SDK) and
   verified client-side through `payments.verifySession`.
2. **Stateless process.** The Node process never holds session data beyond a
   single request. Purchases and generated STLs live in Postgres.
3. **Environment-driven config.** Every knob — Stripe keys, TRELLIS path,
   prices, log level — is read from `process.env`.

---

## 3. System architecture

### Components

| Process / file                           | Responsibility                                                   |
| ---------------------------------------- | ---------------------------------------------------------------- |
| `client/main.js` + `router.js`           | SPA bootstrap; history-API router; single `SocketClient`         |
| `client/components/valve-stem-viewer.js` | Three.js WebGL viewer — drag-to-rotate / scroll-to-zoom OrbitControls; loads STL bytes (`stl_b64`) from `stl.generate.result` and renders the real mesh; parametric stem+sphere placeholder before generation |
| `client/pages/*.js`                      | One factory per route; returns `{ el, destroy? }`                |
| `server/index.js`                        | Express + socket.io bootstrap; healthcheck; graceful shutdown    |
| `server/commands/*.js`                   | Business logic; every command here ends in `.result` / `.error`  |
| `server/design-store.js`                 | STL persistence (Postgres BYTEA, memory fallback, TTL expiry)    |
| `server/workers/runpod-client.js`        | HTTP client for RunPod Serverless; submits jobs, polls `/stream/<id>` for progress + result frames; activated when `RUNPOD_ENDPOINT_URL` + `RUNPOD_API_KEY` are set |
| `server/workers/trellis_generate.py`     | Local Python fallback; one-shot process, reads stdin, streams stdout frames. Used for dev / CI / when RunPod is unconfigured |
| `handler.py` (repo root)                 | RunPod Serverless TRELLIS worker. Imports TRELLIS, runs the v1 pipeline, yields progress + chunked result frames. Module banner prints `HANDLER_VERSION` so the boot log identifies the running release. Registered with `return_aggregate_stream=False` so chunked yields stream individually rather than aggregating into one oversized POST |
| `server/workers/pipeline/`               | The v1 mesh pipeline (Python). `__init__.py` exposes `run_v1`; `stages.py` implements stages 1, 1.5, 2, 3, 4, 5; `constants.py` loads `pipeline_constants.json`; `errors.py` carries `PipelineError` + `ErrorCode`; `validation.py` provides `assert_printable` |
| `Dockerfile` (repo root)                 | Builds the TRELLIS GPU image. Base `pytorch/pytorch:2.4.0-cuda12.1-cudnn9-devel`, clones TRELLIS, installs OpenGL libs (libopengl0/libegl1/libgles2 — pymeshlab needs them), force-installs the CUDA-extension wheels (xformers, kaolin, spconv-cu121, nvdiffrast) that setup.sh's case-mismatch fails to install. See `docs/RUNPOD_TRELLIS_PLAYBOOK.md §9` for the full set of gotchas |
| `.github/workflows/build-runpod-image.yml` | CI image build → `ghcr.io/<owner>/<repo>:<tag>` on each release |
| `.runpod/hub.json`                       | RunPod Hub manifest (env vars, GPU presets, allowed CUDA versions) |
| `server/assets/valve_cap.stl`            | Threaded screw cap (~7.4K tris) — minimal version, runtime asset |
| `server/assets/negative_core.stl`        | Boolean cutter for the planned mesh pipeline (~290 tris) — see [3D_Pipeline.md](3D_Pipeline.md) |
| `server/assets/reference/*.stl`          | Golden output STLs (`ian_head.stl`, `nik_head.stl`) — calibration targets, not runtime |
| `server/migrations/*.sql`                | Append-only migrations applied by `server/migrate.js`            |
| `3D_Pipeline.md`                         | Forward-looking plan for the multi-stage mesh pipeline that replaces the current naïve merge |

### Build pipeline

- **Client**: Vite builds `client/main.js` + Tailwind v4 into `dist/` with
  hashed asset URLs. No React, no JSX, no GraphQL. Three.js + STLLoader +
  OrbitControls add ~600 KB minified (~200 KB gzipped) to the bundle.
- **Server**: ESM, runs directly with Node 22 (`type: module` in
  `package.json`). No build step.
- **Local worker** (dev / CI): a plain Python script; dependencies pinned
  in `server/workers/requirements.txt`. Spawned per request with
  `child_process.spawn(PYTHON_BIN, [WORKER])`.
- **GPU worker image** (prod): GitHub Actions builds the Dockerfile on
  each release tag and pushes to GHCR
  (`ghcr.io/ianroy/stemdomez:<tag>` and `:latest`). RunPod Serverless
  pulls the image; weights cache to a Network Volume mounted at
  `/runpod-volume/hf` so cold-starts after the first request stay quick.

---

## 4. Request lifecycles

### 4.1 Initial page load

```
GET /                                  → dist/index.html
GET /assets/main-[hash].js             → Vite bundle
GET /assets/main-[hash].css            → Tailwind + theme
WSS /socket.io (upgraded)              → persistent socket
client.on('connect') … routes render
```

In dev, `GET /socket.io/**` is proxied by Vite to `BACKEND_PORT=3000`.

### 4.2 Generate an STL

```
Client ─ socket "command" {name: 'stl.generate', payload: {imageData, settings}}
   │
Server ─ dispatchCommand() → stlCommands['stl.generate']
   │       ├─ write photo to tempdir
   │       ├─ if (runpodEnabled())  ← RUNPOD_ENDPOINT_URL + RUNPOD_API_KEY set
   │       │     POST {base}/run    body: {input: {image_b64, head_scale, …, pipeline_version}}
   │       │       ← {id: jobId, status: "IN_QUEUE"}
   │       │     poll {base}/stream/<jobId> every 1.5 s (≤12 min cap)
   │       │       ← {stream: [{output:…}, …]}
   │       │     frame router:
   │       │       {type:"progress",     step, pct}        → stl.generate.progress
   │       │       {type:"result_chunk", index, total, data} → stlChunks[index]
   │       │       {type:"result",       chunks, stl_bytes_len} → mark expected
   │       │       {type:"error",        error}              → throw runpod_worker_error:…
   │       │     reassemble base64 = stlChunks.join('') as soon as
   │       │       stlChunks.length === stlChunkTotal (don't wait for COMPLETED)
   │       │   else  (local fallback)
   │       │     spawn python3 server/workers/trellis_generate.py
   │       │       stdin  ← {image_path, valve_cap_path, output_path, head_scale, …}
   │       │       stdout → {"type":"progress","step":"…","pct":30}
   │       │       stdout → {"type":"result","path":"…","triangles":N}
   │       │     fs.readFile(outputPath) → Buffer stlBytes
   │       ├─ designStore.save({id, stl, filename, settings})
   │       └─ return {designId, filename, triangles, bytes, stl_b64}
   │
Client ← {id, name: 'stl.generate.result', payload: {designId, …, stl_b64}}
   │
   └─ valve-stem-viewer.update({stlData: stl_b64})  ← 3D viewer renders the real mesh
```

**Why chunked delivery.** The base64 of a typical 60 K-tri binary STL
is ~4 MB, well over RunPod's per-frame `/job-stream` size cap (~1 MB).
v0.1.31–0.1.33 each tried to ship the result in fewer larger pieces and
each tripped a different cap; v0.1.34 settled on 700 KB chunks plus
`return_aggregate_stream=False`, which keeps `/stream/<id>` polling
delivery and drops the broken aggregate POST at generator finish. See
`docs/RUNPOD_TRELLIS_PLAYBOOK.md` §3–§5 for the full story.

**The result includes the STL bytes (`stl_b64`)** so the Three.js viewer
can render the real mesh as an immediate preview without waiting for
purchase. Anyone could intercept and decode this — the friction of
stripping STL from socket.io traffic is far higher than $2, so the
trade-off favours UX. The post-payment download path through
`stl.download` remains the canonical "you bought it, here it is" route.

### 4.3 Pay for & download an STL

```
Client ─ payments.createCheckoutSession({designId})
Server ─ stripe.checkout.sessions.create({
           line_items: [{ price_data: $2, quantity: 1 }],
           success_url: /checkout/return?session_id={CHECKOUT_SESSION_ID},
           cancel_url:  /pricing?cancelled=1,
           metadata: { designId },
         })
         INSERT INTO purchases (status='pending', …)
       ← returns { url, sessionId }
Client → window.location.assign(url)
         (user pays on stripe.com)
Stripe → browser redirect → GET /checkout/return?session_id=cs_xxx
Client ─ payments.verifySession({sessionId})
Server ─ stripe.checkout.sessions.retrieve(sessionId)
         UPDATE purchases SET status='paid', paid_at=NOW()
         design = designStore.get(designId)
       ← returns { paid: true, design: { stl, filename } }
Client → Blob download STL
```

> **No Stripe webhook.** Payment status is confirmed synchronously on return
> from Checkout by `payments.verifySession`. If the user closes the tab
> mid-redirect, the `purchases` row stays `pending` — the client can call
> `payments.verifySession` later (e.g. from a recovery link) to finalize.
> Adding a webhook for hard durability is tracked in the roadmap.

### 4.4 Graceful shutdown

On `SIGTERM`/`SIGINT`:

1. `server.shutdown` log line.
2. `stopExpiry()` cancels the design-store TTL timer.
3. `io.close()` + `httpServer.close()` drain in-flight sockets.
4. `closeDb()` ends the pg pool.
5. Hard exit after 10 s if anything hangs.

---

## 5. Command pattern protocol

Every socket message has the same envelope:

```ts
type Command = {
  id?: string;          // uuid, correlates request↔replies
  name: string;         // e.g. "stl.generate" or "stl.generate.progress"
  payload: unknown;     // JSON-serialisable
};
```

### Client helper (`client/socket.js`)

```js
socket.send(name, payload);                               // fire-and-forget
const result = await socket.request(name, payload);       // awaits *.result
await socket.request(name, payload, { onMessage: (n, p) => … });  // stream progress
socket.on(name, (payload, msg) => …);                     // global listener
```

`request()` generates an id, resolves when a matching `<name>.result` arrives,
rejects on `<name>.error`, and forwards intermediate frames (commonly
`<name>.progress`) to `onMessage`.

### Server registry (`server/commands/index.js`)

```js
export function initCommandRegistry() {
  return Object.freeze({
    ...designsCommands,
    ...ordersCommands,
    ...accountCommands,
    ...stlCommands,
    ...paymentsCommands,
  });
}
```

A handler is `async ({ socket, payload, id }) => result`. Return value is
wrapped in `<name>.result`. Throwing produces `<name>.error`. To stream
intermediate frames, emit directly on `socket` with the same `id`:

```js
socket.emit('command', { id, name: 'stl.generate.progress', payload: { step, pct } });
```

### Existing commands

| Command                            | Purpose                                                 |
| ---------------------------------- | ------------------------------------------------------- |
| `account.get` / `account.update`   | Read / upsert the single-user profile (row id=1)        |
| `designs.list` / `.save` / `.delete` | CRUD over the historical designs gallery               |
| `orders.list`                      | Past orders (for the Account → Orders tab)              |
| `stl.generate`                     | Photo → STL; streams progress; persists design          |
| `stl.download`                     | Post-payment STL fetch (requires paid purchase row)     |
| `payments.catalogue`               | Returns `{ enabled, item }` — the single STL-download SKU |
| `payments.createCheckoutSession`   | Builds a Stripe Checkout session URL for a `designId`    |
| `payments.verifySession`           | Confirms payment, returns the STL payload on success    |

---

## 6. Data model

### 6.1 Schema (migrations applied in order)

`001_initial.sql`:

```sql
accounts(id BIGINT PK, display_name, email UNIQUE, preferences JSONB, …)
designs(id BIGSERIAL PK, account_id → accounts, name, thumbnail_url,
        material CHECK(matte|gloss|chrome), stars 0-5, settings JSONB, …)
orders(id TEXT PK, account_id → accounts, design_id → designs,
       name, status, price, qty, placed_at)
events(id TEXT PK, …)  -- dropped in 003_drop_events.sql
```

`002_designs_and_purchases.sql`:

```sql
generated_designs(id UUID PK, account_id → accounts,
                  stl_bytes BYTEA, filename, settings JSONB, photo_name,
                  created_at, expires_at  -- NOW() + 24h)
purchases(id BIGSERIAL PK, design_id → generated_designs,
          stripe_session_id UNIQUE, stripe_payment_id,
          amount_cents, currency,
          status CHECK(pending|paid|failed|expired|refunded),
          product CHECK(stl_download|printed_stem|pack_of_4),  -- only 'stl_download' is used today
          customer_email, created_at, paid_at)
```

`schema_migrations(name PK, run_at)` is created by `migrate.js` and tracks
which files have been applied.

### 6.2 Lifetimes

- **`generated_designs` expire after 24 hours** by default. A TTL job in
  `server/design-store.js` calls `DELETE FROM generated_designs WHERE
  expires_at <= NOW()` every 15 minutes.
- **Purchases are retained indefinitely** so refund/support flows can find
  them.

### 6.3 In-memory fallback

When `DATABASE_URL` is unset, `design-store.js` keeps the last 50 STLs in an
in-process `Map` with the same 24h TTL. Useful for local dev; never used in
production.

---

## 7. Code layout

```
3D_Pipeline.md                      forward-looking mesh pipeline plan
Dockerfile                          TRELLIS GPU image (RunPod / GHCR)
handler.py                          RunPod Serverless TRELLIS worker
.runpod/
 └─ hub.json                        RunPod Hub manifest
.github/
 └─ workflows/
     └─ build-runpod-image.yml      CI: build + push GHCR image on release

client/
 ├─ main.js                         entry point; router + socket
 ├─ router.js                       history API + query parsing
 ├─ socket.js                       two-way command helper
 ├─ dom.js                          el(tag, attrs, ...children) hyperscript
 ├─ icons.js                        inline SVG icon set (replaces lucide-react)
 ├─ components/
 │   ├─ header.js                   sticky nav + mobile menu
 │   └─ valve-stem-viewer.js        Three.js WebGL viewer (OrbitControls,
 │                                  STLLoader, parametric placeholder before
 │                                  generation, real STL after)
 └─ pages/
     ├─ home.js                     photo upload → generate → checkout
     ├─ how-it-works.js             marketing / explainer
     ├─ pricing.js                  Single STL-download tier + CTA
     ├─ checkout-return.js          verify Stripe session, stream STL
     └─ account.js                  profile, designs, orders, settings

server/
 ├─ index.js                        Express, socket.io, /health, graceful shutdown
 ├─ logger.js                       JSON lines → stdout/stderr
 ├─ db.js                           pg Pool (encrypted, unverified SSL)
 ├─ design-store.js                 STL persistence + expiry job
 ├─ stripe-client.js                Stripe SDK lazy init + pricing catalogue
 ├─ migrate.js                      admin process
 ├─ commands/                       socket.io command handlers
 │   ├─ index.js                    dispatcher + registry
 │   ├─ stl.js                      routes to RunPod or local Python; persists; paywalls
 │   ├─ payments.js                 Stripe checkout + verify
 │   └─ designs|orders|account.js
 ├─ workers/
 │   ├─ runpod-client.js            HTTP client for RunPod Serverless (production)
 │   ├─ trellis_generate.py         local Python fallback (dev / CI)
 │   └─ requirements.txt            numpy, pillow, trimesh
 ├─ assets/
 │   ├─ valve_cap.stl               372 KB — minimal threaded screw cap (~7.4K tris)
 │   ├─ negative_core.stl           14 KB — boolean cutter (~290 tris); future pipeline
 │   └─ reference/                  golden outputs for calibration / smoke tests
 │       ├─ ian_head.stl            10 MB — definition-of-done #1
 │       └─ nik_head.stl            10 MB — definition-of-done #2
 └─ migrations/
     ├─ 001_initial.sql
     ├─ 002_designs_and_purchases.sql
     └─ 003_drop_events.sql
```

---

## 8. Environments & configuration

Everything is read from `process.env` (Node) or `os.environ` (Python) at
startup. Two distinct envelopes:

1. **Node app** (Express + socket.io running on DigitalOcean App Platform).
2. **RunPod handler** (`handler.py` + the Python pipeline running on the
   GPU worker container).

The Node `.env` / DO env vars are declared in `.do/app.yaml` (with
`SECRET` type for credentials and `${db.DATABASE_URL}` injected from
the managed Postgres). The handler env vars are set per-endpoint in the
RunPod Console — `.runpod/hub.json` declares the canonical defaults.

### Node app (DO App Platform)

#### Core boot

| Variable           | Required | Default        | Purpose |
|--------------------|----------|----------------|---------|
| `PORT`             | platform | platform       | HTTP port (DO injects this; don't override). |
| `NODE_ENV`         | no       | `production`   | `production` enables prod logging + cookie `Secure`. |
| `LOG_LEVEL`        | no       | `info`         | `error`/`warn`/`info`/`debug`. |
| `APP_URL`          | yes      | —              | Public origin (`https://stemdomez.com`). Used for Stripe redirects, sitemap.xml, OG image absolute URLs. |
| `PUBLIC_URL`       | no       | `APP_URL`      | Override only when the SPA shell needs a different origin from the API (we don't, but the constant is read). |
| `STATIC_DIR`       | no       | `./dist`       | Where `vite build` output lives. |
| `BACKEND_PORT`     | dev only | `3000`         | Vite proxy target during `npm run dev`. |
| `VITE_PORT`        | dev only | `5173`         | Vite dev server port. |
| `CORS_ORIGIN`      | no       | `APP_URL`      | Tightens `Access-Control-Allow-Origin` for socket.io. |

#### Database (DO Managed Postgres 18)

| Variable        | Required | Default | Purpose |
|-----------------|----------|---------|---------|
| `DATABASE_URL`  | yes      | —       | Postgres connection string. DO injects via `${db.DATABASE_URL}`. |
| `DATABASE_SSL`  | no       | on      | Set `false` for local plaintext Postgres only — DO Managed requires TLS, prod always runs with `rejectUnauthorized: false` per DO's recipe. |
| `DB_POOL_MAX`   | no       | `10`    | `pg` pool max connections. |

#### Auth + sessions

| Variable                | Required | Default        | Purpose |
|-------------------------|----------|----------------|---------|
| `AUTH_SECRET` (SECRET)  | yes      | —              | Signs `sd_session` cookies and magic-link tokens. Must be ≥ 32 bytes. Rotating invalidates every session. |
| `AUTH_COOKIE_NAME`      | no       | `sd_session`   | Cookie name. |
| `AUTH_COOKIE_MAX_AGE_S` | no       | `2592000` (30d)| Session lifetime in seconds. |
| `AUTH_TOKEN_TTL_MS`     | no       | `900000` (15m) | Magic-link token expiry. |
| `AUTH_LIMIT_PER_EMAIL`  | no       | `5`            | Magic-link request rate limit per email per hour. |
| `AUTH_LIMIT_PER_IP`     | no       | `20`           | Same per IP per hour. |
| `ADMIN_EMAILS`          | no       | —              | Comma-separated list. Accounts created with these emails get `role=admin` at boot. |
| `SHARE_LINK_SECRET` (SECRET) | yes | —             | Signs `/d/<token>` permalinks. |

#### Email

| Variable               | Required | Default                  | Purpose |
|------------------------|----------|--------------------------|---------|
| `RESEND_API_KEY` (SECRET) | yes  | —                        | Resend.com outbound provider. Falls back to console-log devUrl in development. |
| `EMAIL_FROM`           | no       | `hello@stemdomez.com`    | `From:` header. |
| `POSTMARK_TOKEN`       | no       | —                        | Legacy provider, used only if Resend fails to load. |
| `POSTMARK_STREAM`      | no       | `outbound`               | Postmark message stream. |

#### Payments (Stripe)

| Variable                          | Required           | Default      | Purpose |
|-----------------------------------|--------------------|--------------|---------|
| `STRIPE_SECRET_KEY` (SECRET)      | when payments_enabled | —         | `sk_test_…` / `sk_live_…`. |
| `STRIPE_WEBHOOK_SECRET` (SECRET)  | when webhook on    | —            | Verifies Stripe webhook signatures. |
| `STRIPE_WEBHOOK_ENABLED`          | no                 | `false`      | Webhook is opt-in; redirect-return verification works without it. |
| `STRIPE_PRICE_STL_CENTS`          | no                 | `200`        | $2 STL — overridable without a deploy. |
| `STRIPE_PRICE_PRINT_CENTS`        | no                 | `1999`       | $19.99 printed cap. |
| `STRIPE_PRICE_PACK_CENTS`         | no                 | `5999`       | $59.99 pack of four. |
| `STRIPE_CURRENCY`                 | no                 | `usd`        | ISO 4217. |
| `STRIPE_TAX_ENABLED`              | no                 | `false`      | Toggle Stripe Tax automatic calculation. |
| `STRIPE_SHIPPING_COUNTRIES`       | no                 | `US`         | Comma-separated country codes for Checkout shipping. |
| `STRIPE_CUSTOMER_PORTAL_CONFIG_ID`| no                 | —            | Optional billing-portal config id. |

#### Image processing (server-side, before GPU dispatch)

| Variable                  | Required | Default | Purpose |
|---------------------------|----------|---------|---------|
| `MAX_IMAGE_BYTES`         | no       | `10485760` (10 MB) | Hard upload cap on **decoded** image bytes. Exceed = `IMAGE_TOO_LARGE` error. The server-side `sharp` downsample (≤1024 px / mozjpeg q88) caps the GPU-bound payload at ~150-400 KB regardless of input size, so this is purely a defence against malicious uploads / OOM. Socket.io's `maxHttpBufferSize` (16 MB) accommodates the base64 envelope. |
| `IMAGE_RESIZE_ENABLED`    | no       | `true`  | `false` to disable the `sharp` downsample pass entirely. |
| `IMAGE_RESIZE_MAX_EDGE`   | no       | `1024`  | Long-edge cap in pixels. TRELLIS internally resizes to ~518 px, so values above ~1024 are wasted bandwidth. |
| `IMAGE_RESIZE_QUALITY`    | no       | `88`    | mozjpeg quality. |

#### RunPod GPU dispatch

| Variable                      | Required | Default | Purpose |
|-------------------------------|----------|---------|---------|
| `RUNPOD_ENDPOINT_URL`         | one of   | —       | Single-region legacy. `https://api.runpod.ai/v2/<endpoint-id>`. |
| `RUNPOD_ENDPOINT_URLS`        | one of   | —       | Multi-region racing. Comma-separated URLs (no spaces). When 2+ entries, every generation is submitted to all regions in parallel; first to start processing wins, losers cancelled. |
| `RUNPOD_API_KEY` (SECRET)     | yes      | —       | RunPod bearer token. Account-wide — same key authenticates against every region. |
| `RUNPOD_FORCE_WARMUP`         | no       | unset   | Set to `1` to route the first generation after server boot to the LAST endpoint in `RUNPOD_ENDPOINT_URLS` only (no race). Auto-consumed after one successful job; re-arms on app restart. Safe to leave set indefinitely. |

#### TRELLIS pipeline (Node side)

| Variable           | Required | Default     | Purpose |
|--------------------|----------|-------------|---------|
| `PIPELINE_VERSION` | no       | `legacy`    | `v1` runs the seven-stage CAD pipeline (recommended). `legacy` runs the old `_merge` concat. Unknown values fall back to legacy with a warning. |
| `TRELLIS_ENABLED`  | no       | `true`      | `false` toggles the procedural fallback head in the LOCAL Python worker only — useful for CI / Docker dev without a GPU. No effect on the RunPod path. |
| `PYTHON_BIN`       | no       | `python3`   | Python interpreter for the local worker. |

#### Rate limits + telemetry + observability

| Variable                       | Required | Default | Purpose |
|--------------------------------|----------|---------|---------|
| `STL_RATE_LIMIT_PER_IP`        | no       | `10/h`  | `stl.generate` requests per IP per hour. |
| `STL_RATE_LIMIT_PER_SOCKET`    | no       | `5/m`   | Same per socket per minute (faster window catches accidental loops). |
| `FLAG_CACHE_TTL_MS`            | no       | `30000` | `feature_flags` cache TTL. |
| `IPINFO_TOKEN`                 | no       | —       | ipinfo.io token for `/admin` Map tab. Without it, geo lookups fall back to country-only. |
| `METRICS_TOKEN` (SECRET)       | no       | —       | Bearer auth for `GET /metrics` (Prometheus exposition). Omit to disable the endpoint. |
| `SENTRY_DSN`                   | no       | —       | Server-side Sentry. Auto-disabled when missing. |
| `SENTRY_ENVIRONMENT`           | no       | `production` | Sentry env tag. |
| `SENTRY_RELEASE`               | no       | git sha | Sentry release tag. |
| `SENTRY_TRACES_SAMPLE_RATE`    | no       | `0.05`  | Performance trace sampling. |

### RunPod handler (`handler.py` + pipeline)

Set per-endpoint in the RunPod Console. Required env vars are listed
in `.runpod/hub.json` so the Hub deploy flow prompts for them.

#### Required

| Variable          | Default                              | Purpose |
|-------------------|--------------------------------------|---------|
| `HF_TOKEN` (SECRET)  | —                                 | Hugging Face token for the TRELLIS-image-large gated model download. **Without this, every cold start fails to download weights and the worker silently can't generate anything** — the most common "queued forever" cause. Token must have read access AND the HF account must have accepted the TRELLIS license at huggingface.co/microsoft/TRELLIS-image-large. |

#### Cache paths (point at the network volume)

| Variable                  | Default                  | Purpose |
|---------------------------|--------------------------|---------|
| `HF_HOME`                 | `/runpod-volume/hf`      | HuggingFace cache root. |
| `HUGGINGFACE_HUB_CACHE`   | `/runpod-volume/hf`      | Same path — both vars are read by different versions of `huggingface_hub`. |
| `TRANSFORMERS_CACHE`      | `/runpod-volume/hf`      | `transformers` library cache. |
| `TORCH_HOME`              | `/runpod-volume/torch`   | `torch.hub` cache (dinov2, u2net). |

Without these, every cold start re-downloads ~3.8 GB of weights to
ephemeral container storage and loses them at scale-to-zero.

#### Static asset paths (baked into the image)

| Variable             | Default                   | Purpose |
|----------------------|---------------------------|---------|
| `TRELLIS_MODEL`      | `microsoft/TRELLIS-image-large` | HF repo for the image-to-3D pipeline. |
| `VALVE_CAP_PATH`     | `/app/valve_cap.stl`      | Threaded Schrader cap STL — Stage 4 union target. |
| `NEGATIVE_CORE_PATH` | `/app/negative_core.stl`  | Boolean-cutter STL for Stage 3 cavity carve. |

#### Performance backends

| Variable                | Default     | Purpose |
|-------------------------|-------------|---------|
| `SPCONV_ALGO`           | `native`    | TRELLIS sparse-conv backend. |
| `ATTN_BACKEND`          | `xformers`  | Dense-attention kernel for `trellis.modules.attention`. |
| `SPARSE_ATTN_BACKEND`   | `xformers`  | **Both must be set** — sparse attention reads a different env var and only accepts `xformers` or `flash_attn`. |

#### Pipeline tunables

| Variable                  | Default                       | Purpose |
|---------------------------|-------------------------------|---------|
| `PIPELINE_VERSION`        | `legacy` (Node-driven)        | Same toggle as Node side; the handler reads it from the request body, not env. |
| `MAX_TRIS_AFTER_REPAIR`   | `500000`                      | Stage 1.5 cap. Above this, `fast_simplification` auto-decimates to fit. |
| `STAGE_TIMEOUT_S`         | `60`                          | Per-stage wall-clock budget. |
| `JOB_TIMEOUT_S`           | `300`                         | Total pipeline budget (TRELLIS itself runs separately in handler.py). |
| `TRELLIS_CACHE_DIR`       | `/runpod-volume/cache/trellis`| Slider-tweak cache (skip TRELLIS when only post-process sliders changed). |
| `TRELLIS_CACHE_TTL_S`     | `86400` (24 h)                | Cache TTL. Matches the design-store TTL. |
| `FAILURE_CORPUS_DIR`      | `/runpod-volume/failures`     | Bad-job snapshots for debug replay. |
| `PIPELINE_CONSTANTS_PATH` | `/app/pipeline/pipeline_constants.json` | Override the locked-constants JSON for experimentation. |

### Print process (locked, see [3D_Pipeline.md §0](3D_Pipeline.md))

Not env vars, but downstream constants that drive Stage 5 + Stage 6:

- Process: FDM, PLA filament, 0.4 mm nozzle.
- Layer height target: 0.12–0.16 mm.
- Triangle budget: 50–80K out of Stage 5.
- Min wall thickness: 1.2 mm.
- Negative-core clearance: 0.25 mm radial.
- Stage 6 watertight repair via PyMeshFix (`joincomp=False`,
  `remove_smallest_components=False`) — preserves the head + cap as
  separately-sealed shells.

---

## 9. Dev workflow

### Setup

```bash
nvm install 22 && nvm use 22
pip install -r server/workers/requirements.txt
cp .env.example .env       # edit
npm install
npm run migrate            # optional; required only if DATABASE_URL set
```

### Run

```bash
npm run dev                # Vite :5173 + Node :3000 (socket.io proxied)
```

### Build / prod

```bash
npm run build              # emits dist/
npm start                  # node server/index.js
```

### Inspect

- **Network (client)**: open the WS frame inspector in DevTools → Network →
  WS. Every client↔server message has the same envelope.
- **Logs (server)**: stdout is JSON lines. Pipe through `jq` for readability:
  `npm run dev:server | jq`.
- **Database**: `psql $DATABASE_URL` → `\d generated_designs`.

### Commit conventions

Short subject (<70 chars), body explains the "why". Always add
`Co-Authored-By:` when an AI assisted.

---

## 10. Extension points

### 10.1 Add a new socket command

1. Create (or extend) a module under `server/commands/`, export an object of
   handlers:
   ```js
   export const widgetsCommands = {
     'widgets.list': async () => [...],
     'widgets.create': async ({ payload }) => {...},
   };
   ```
2. Register it in `server/commands/index.js` by spreading into the registry.
3. Call it from the client: `await socket.request('widgets.list')`.

### 10.2 Add a new page

1. Create `client/pages/widgets.js` exporting a factory that returns
   `{ el, destroy? }`.
2. Register the route in `client/main.js`:
   ```js
   '/widgets': () => WidgetsPage({ socket }),
   ```
3. Add a nav link in `client/components/header.js` (`links` array).

### 10.3 Add a new product / price tier

The app currently ships a single product (`stl_download`). To introduce
another tier:

1. Extend `pricingCatalogue()` in `server/stripe-client.js` with a new key
   and env-driven `unitAmount`.
2. Reintroduce a product selector in `server/commands/payments.js` — accept a
   `product` param in `createCheckoutSession`, validate against a whitelist,
   and thread it through `metadata` + the `purchases.product` column. The
   DB `CHECK` constraint already permits `printed_stem` / `pack_of_4`, so
   reusing those names needs no migration.
3. Update `payments.catalogue` to return `{ items }` (array) and adjust
   `client/pages/pricing.js` to render a grid of cards again.
4. Add any new fulfillment rules (e.g. shipping address collection) in the
   checkout-session creation call.

### 10.4 Swap the GPU backend

The default backend is RunPod Serverless via
[server/workers/runpod-client.js](server/workers/runpod-client.js).
[server/commands/stl.js:48](server/commands/stl.js) decides per-request:
RunPod if both `RUNPOD_ENDPOINT_URL` and `RUNPOD_API_KEY` are set, local
Python spawn otherwise. Both implement the same wire contract:

- Input: `{ image_b64, head_scale, neck_length_mm, head_tilt_deg, seed }`
- Output: a stream of `{type: "progress", step, pct}` frames, then a
  final `{type: "result", stl_b64, triangles}`.

Progress frames are re-emitted client-bound as `stl.generate.progress`,
so swapping backends is invisible to the UI. To target a different GPU
provider:

1. Build a worker that exposes a job-submit + progress-stream endpoint
   (RunPod's `/run` and `/stream/<id>` are the model).
2. Add a sibling client to `server/workers/`, e.g. `replicate-client.js`,
   exposing the same `runX(...)` interface.
3. Branch in `server/commands/stl.js` on whichever env vars activate it.

The `handler.py` at the repo root is the canonical worker
implementation — clone it for any provider that accepts a Docker image
plus an HTTP job protocol.

### 10.5 Add a new SQL migration

Create `server/migrations/NNN_description.sql` (next sequential number).
Never edit existing migrations. `npm run migrate` applies new files in
order, tracked by `schema_migrations`.

---

## 11. Design decisions & why

| Decision                                          | Rationale                                                                                                |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Single `"command"` socket event, not REST         | Project guidelines require it, but also: one transport, one envelope, easy to trace & replay.            |
| Vanilla JS + Three.js viewer (was SVG.js)         | Vanilla DOM keeps the bundle tiny and the architecture simple. Three.js replaced the SVG.js pseudo-3D viewer when generated STLs needed real WebGL rendering — see [client/components/valve-stem-viewer.js](client/components/valve-stem-viewer.js) and commit `f9dc227`. ~200 KB gzipped is the price for OrbitControls + STLLoader. |
| RunPod Serverless for production GPU              | DO App Platform has no GPU instance sizes. Running TRELLIS on a dedicated GPU droplet is wasteful (idle 99% of the time). RunPod Serverless bills per-second of GPU use, scales to zero, and pulls our prebuilt GHCR image. Cold-start cost is real (~8 min on first request) but warm requests are ~30–60 s. Local Python fallback is preserved for dev / CI. |
| TRELLIS warm in RunPod, fresh per request locally | RunPod keeps `_PIPELINE` and `_VALVE_CAP` loaded across warm invocations; cold-start pays once. Local fallback is one-shot per spawn — trivial concurrency, no shared state. Two different concurrency models, same wire contract. |
| STL bytes stored in Postgres BYTEA                | Stateless processes (12-factor §6). One backup gets everything. Fine at current data sizes (<2 MB each). |
| STL bytes returned in `stl.generate.result` (`stl_b64`) | Originally the client only saw a `designId`. Once we shipped a real Three.js viewer, the user expects to see their model immediately — not after paying $2. Sending `stl_b64` in the result trades a small theoretical leak (anyone can decode the bytes from a socket frame) for a much better preview UX. The friction of intercepting socket.io traffic is far higher than $2; the canonical post-payment download still goes through `stl.download`. |
| No Stripe webhook; verify on redirect-return only | Keeps the "no REST" invariant absolute. Trades a little durability for protocol purity — a webhook can be re-added behind a feature flag if the drop-off rate matters. |
| 24h TTL on generated designs                      | Storage bound. Users that don't pay within 24h must regenerate. Trivial to adjust if support asks.       |
| In-memory fallback when `DATABASE_URL` is unset   | Low-friction local dev; keeps happy-path demo working without a DB install.                              |
| Migrations are append-only, tracked in a table    | Safe, boring, recoverable. No ORM = no drift vs. an ORM's opinion of the schema.                         |
| Mesh pipeline owned by `3D_Pipeline.md`, not this spec | Anything past the TRELLIS call (scaling, repair, cropping, boolean ops, print-prep, calibration, library choice, traffic-flagged rollout) belongs to that document. ProductSpec stays at the app-architecture layer; mesh-pipeline questions belong there. |

---

## 12. Security & privacy

- **Card data** never touches the server — Stripe Checkout is hosted.
- **Checkout integrity** is guaranteed by verifying the session server-side
  via the Stripe SDK before marking a purchase `paid`. The client only sends
  a `sessionId`; the STL is read from server memory/DB after verification.
- **Photo storage** is transient: images are written to a per-request
  tempdir under the OS temp directory and deleted in the `finally` block of
  `stl.generate`. Only the resulting STL is persisted.
- **Database TLS** is mandatory in production (`DATABASE_SSL=true`). The
  channel is encrypted but unverified (`rejectUnauthorized: false`), which
  is what DO's managed PG + Node recipe requires.
- **No cross-account authz yet.** Every request currently operates on a
  single hard-coded account id (`1`). Adding auth is a Phase 1 roadmap item.
- **Rate limiting** is not yet implemented. See roadmap.

---

## 13. Observability & operations

### Node app

- **Logs** are single-line JSON objects on stdout/stderr — DO App Platform
  captures them automatically.
- **Healthcheck** is `GET /health`, wired into `app.yaml`.
- **Graceful shutdown**: SIGTERM drains sockets, stops the pg pool, cancels
  the TTL job, and exits within 10 s (hard-kill fallback).
- **Key log lines**: `server.listen`, `socket.connect`, `cmd.ok`, `cmd.error`,
  `stl.backend` (which backend handled the request — `runpod` or
  `local_spawn`), `runpod.job_started`, `runpod.job_complete`,
  `stl.generated`, `stripe.checkout.paid`, `db.pool.error`,
  `design_store.pruned`.

### RunPod GPU worker

- **Worker logs** stream from RunPod's runtime. Look in RunPod Console →
  endpoint → Workers → \[worker id\] → Logs. Lines prefixed with
  `[stemdomez]`, `[probe]`, `[diag]`, `[trellis]`, `[stage*]`,
  `[telemetry]` come from `handler.py`.
- **Image versioning**: `HANDLER_VERSION` is a string at the top of
  `handler.py` printed at module load time. Bump it when changing the
  worker so a glance at the boot log confirms which release is running.
  This banner is the first thing to grep for when diagnosing a "no 3D
  output" report — if it doesn't match the expected version, the
  deploy didn't take.
- **Cold-start cost**: ~5–10 minutes on a fresh worker (model download
  to Network Volume). Warm-worker requests are ~30–60 s. Slider-tweak
  re-generations on the same photo hit the TRELLIS-output cache (24 h
  TTL on `/runpod-volume/cache/trellis/`) and complete in ~1–2 s. Watch
  the `runpod.job_complete` line in DO logs for `bytes` to confirm the
  result shape.
- **Failure corpus**: every pipeline error writes input photo + structured
  `error.json` to `/runpod-volume/failures/<yyyymmdd>/<jobId>/`. To
  reproduce a user-reported failure, pull the photo from the corpus and
  re-run the handler against it.

### Mesh-pipeline telemetry

`handler.py` emits one structured `[telemetry]` JSON line per request
on stderr — `kind`, `outcome`, `version`, `handler_version`, `job_id`,
`image_sha`, per-stage `timings`, settings used. This is what an
aggregator (BetterStack, Loki) ingests when wired up. Stage warnings
(`[stage3]`, `[stage4]`, `[stage5]`) appear inline in the worker log
and tell you when manifold3d fell back to mesh concatenation, when the
final mesh shipped non-watertight, etc.

For richer telemetry (Sentry, OpenTelemetry), see FEATUREROADMAP →
Phase 4. The full diagnostic playbook for the GPU tier is in
[docs/RUNPOD_TRELLIS_PLAYBOOK.md](docs/RUNPOD_TRELLIS_PLAYBOOK.md) §13.

---

## 14. Glossary

| Term             | Meaning                                                                   |
| ---------------- | ------------------------------------------------------------------------- |
| **Valve stem cap** | The plastic/metal cap that screws on top of a Schrader valve; this app's target product. |
| **STL**          | Triangle-soup mesh format, universally supported by 3D printers. Two flavours: ASCII (text, large) and binary (compact, 5–10× faster to parse). |
| **TRELLIS**      | Microsoft's image-conditioned 3D-generation model. Outputs an unscaled, frequently non-manifold mesh of head + chest. |
| **trimesh**      | Python library for mesh I/O, transforms, repair, export.                  |
| **manifold3d**   | Modern CSG library (Apache 2.0). The boolean engine for the planned pipeline — only Python-accessible CSG with a manifold-output guarantee. See [3D_Pipeline.md §7](3D_Pipeline.md). |
| **RunPod Serverless** | GPU-on-demand provider. Submits jobs via `POST /v2/<endpoint>/run`, streams progress via `GET /v2/<endpoint>/stream/<id>`. Workers are Docker containers pulled from GHCR. |
| **GHCR**         | GitHub Container Registry. Where this repo's TRELLIS image is published by the `build-runpod-image.yml` workflow. |
| **FDM**          | Fused Deposition Modeling — filament 3D printing. The locked print process for this product (PLA, 0.4 mm nozzle, 0.12–0.16 mm layer height). |
| **PLA**          | Polylactic acid filament. Low-shrinkage, easy to print, brittle when stressed. The default material for this product. |
| **Design**       | One generated STL + the settings used to produce it, stored in Postgres.  |
| **Purchase**     | One Stripe Checkout session tied to a design (currently always the STL-download product). |
| **Command**      | A single socket.io message, `{ id, name, payload }`.                      |
| **12-factor**    | The configuration discipline we follow; see https://12factor.net.         |

---

## 15. Troubleshooting

| Symptom                                                    | Likely cause & fix                                                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Client shows "Generating… 0%" forever (local backend)      | Python worker isn't installed / `PYTHON_BIN` wrong / `TRELLIS_PATH` invalid. Check `stderr` under `worker.stderr`. |
| `runpod_no_result (last_status=COMPLETED)` after only ~2 min | The worker finished but the Node tier never reassembled chunks. Check the worker log for `Failed to return job results. \| 400, message='Bad Request'`. If the URL has `isStream=false`, you're hitting the aggregate-POST cap — confirm `return_aggregate_stream=False` is set in `handler.py`. If `isStream=true`, individual chunks are too big — reduce CHUNK_SIZE. See [docs/RUNPOD_TRELLIS_PLAYBOOK.md §3–§5](docs/RUNPOD_TRELLIS_PLAYBOOK.md). |
| `runpod_no_result (last_status=IN_QUEUE)` after 12 min     | RunPod has the job but no worker picked it up. Check RunPod Console → endpoint → Workers tab: is **Max Workers** ≥ 1? Are workers **Throttled** (region out of GPUs)? Is the active image actually the latest tag? Click **Manage → New Release** to re-pull. |
| Worker log doesn't show `[stemdomez] handler.py vX.X.X booting` for the version you expect | RunPod is still on the old image. Open Manage → New Release → paste the new GHCR tag. Don't debug code that isn't running. |
| Pipeline crashes at stage 1.5 with `non_manifold_input_unrepairable` | The hard gate from older code revisions. Stage 1.5 has been a **warning** since v0.1.34 — pull the latest. |
| `runpod_http_401` from `runRunpod`                         | `RUNPOD_API_KEY` invalid or expired. Regenerate in RunPod Console → API Keys; update DO Settings → App-Level Environment Variables. |
| `runpod_worker_error:no module named 'X'` at boot          | Image build dropped a dependency. Common case: setup.sh's PyTorch-version case-statement misses `2.4.0+cu121` and the corresponding CUDA wheel never installs. Fix in `Dockerfile` with an explicit `pip install` and bump `HANDLER_VERSION`. See playbook §9. |
| Worker boots fine but `pipeline.run` raises `zero-size array to reduction` | rembg detected no foreground in the input photo. The user uploaded a 1×1 PNG / abstract image / something with no face. Front-load this with a mediapipe pre-flight (planned Stage 0 in [3D_Pipeline.md](3D_Pipeline.md)). |
| Three.js viewer shows the placeholder forever after generate | Either: (a) server is on legacy code that doesn't include `stl_b64` in the result — redeploy past commit `f9dc227`. (b) The `stl.generate` call errored — check the browser DevTools console for the `stl.generate` rejection message. (c) The Node tier is on pre-chunk-aware `runpod-client.js` — pull past commit `3fb5393`. |
| `stl.backend` log line says `local_spawn` in production     | `RUNPOD_ENDPOINT_URL` or `RUNPOD_API_KEY` is unset / empty in DO config. Set both, redeploy, terminate any warm Node processes so they re-read env. |
| `payments.createCheckoutSession` errors `stripe_not_configured` | `STRIPE_SECRET_KEY` is empty. Set it in `.env` (dev) or DO dashboard (prod).                                   |
| STL download returns `payment_required`                    | The purchase row isn't `status='paid'`. Usually means the user navigated away before `payments.verifySession` ran. |
| Post-payment STL download returns garbled bytes            | Latent ASCII-STL assumption at [server/commands/stl.js:98](server/commands/stl.js) — switch the path to `Buffer`-aware. Tracked as a Phase 0 task in [3D_Pipeline.md §10](3D_Pipeline.md). |
| pg error `self signed certificate in certificate chain`    | `DATABASE_SSL=true` should already yield an encrypted-but-unverified connection. If you see this in prod, check that `db.js` hasn't been changed to `rejectUnauthorized: true`. For local plaintext PG, set `DATABASE_SSL=false`. |
| pg error `relation "designs" does not exist`               | `npm run migrate` never ran on the production database. The `migrate` PRE_DEPLOY job in `app.yaml` should handle this — check that it's still wired and that the last deploy ran it. |
| Socket connects but no commands reach server               | Vite proxy misconfigured in `vite.config.js` (`BACKEND_PORT`), or client-side ad-blocker mangling `/socket.io/`.    |
| `stl.generate.result` arrives but STL download 404s        | Design expired (>24h). Regenerate.                                                                                 |

---

*When in doubt, read the handler. The codebase is small enough that jumping
from a command name in `server/commands/` to its implementation is the
fastest way to understand an edge case.*
