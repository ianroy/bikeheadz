# ProductSpec — BikeHeadz developer onboarding

> **Who this is for**: engineers (human or agentic) who need to build,
> extend, or operate BikeHeadz. Start at the top; skim the TL;DR; deep-dive
> into the section that matches your task.

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

- **What it is**: a web app that turns a portrait photo into a 3D-printable
  Presta valve stem cap with the user's head on top.
- **How it works**: photo → TRELLIS (image-to-3D) → trimesh merge onto a
  fixed valve-cap STL → Stripe Checkout → download.
- **How it's built**: vanilla JS + SVG.js client, socket.io command pattern,
  Node 22 Express server, Python worker for TRELLIS, Postgres 18 for state.
- **How it deploys**: Digital Ocean App Platform, Managed Postgres attached,
  Stripe Checkout verified on user return via `payments.verifySession` (no
  webhook endpoint, no REST surface).

---

## 2. Mental model

Think of BikeHeadz as three coordinated processes joined by two protocols:

```
┌────────────┐      socket.io      ┌──────────────┐     stdin/stdout      ┌──────────────┐
│   Client   │ ◀──────commands─────▶│   Node.js    │ ◀────json lines──────▶│  Python      │
│ (vanilla)  │                      │  (Express +  │                       │  (TRELLIS +  │
│            │                      │   socket.io) │                       │   trimesh)   │
└─────┬──────┘                      └──────┬───────┘                       └──────────────┘
      │ redirect                           │ Stripe SDK (HTTPS, SSR only)
      ▼                                    ▼
┌────────────┐                       ┌────────────┐        ┌────────────┐
│  Stripe    │                       │  Postgres  │        │  Stripe    │
│ Checkout   │                       │ (designs,  │        │   API      │
│ (hosted)   │                       │ purchases, │        │ (sessions) │
└────────────┘                       │ accounts)  │        └────────────┘
                                     └────────────┘
```

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
| `client/components/valve-stem-viewer.js` | SVG.js pseudo-3D viewer — drag to rotate, live-update props      |
| `client/pages/*.js`                      | One factory per route; returns `{ el, destroy? }`                |
| `server/index.js`                        | Express + socket.io bootstrap; healthcheck; graceful shutdown    |
| `server/commands/*.js`                   | Business logic; every command here ends in `.result` / `.error`  |
| `server/design-store.js`                 | STL persistence (Postgres BYTEA, memory fallback, TTL expiry)    |
| `server/workers/trellis_generate.py`     | One-shot Python process; reads stdin, streams stdout frames      |
| `server/migrations/*.sql`                | Append-only migrations applied by `server/migrate.js`            |

### Build pipeline

- **Client**: Vite builds `client/main.js` + Tailwind v4 into `dist/` with
  hashed asset URLs. No React, no JSX, no GraphQL.
- **Server**: ESM, runs directly with Node 22 (`type: module` in
  `package.json`). No build step.
- **Worker**: a plain Python script; dependencies pinned in
  `server/workers/requirements.txt`. Spawned per request with
  `child_process.spawn(PYTHON_BIN, [WORKER])`.

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
   │       ├─ spawn python3 server/workers/trellis_generate.py
   │       │     stdin  ← {image_path, valve_cap_path, output_path, head_scale, …}
   │       │     stdout → {"type":"progress","step":"…","pct":30}
   │       │             (re-emitted as stl.generate.progress frames)
   │       │     stdout → {"type":"result","path":"…","triangles":12345}
   │       ├─ fs.readFile(outputPath) → Buffer stlBytes
   │       ├─ designStore.save({id, stl, filename, settings})
   │       └─ return {designId, filename, triangles, bytes}
   │
Client ← {id, name: 'stl.generate.result', payload: {designId, …}}
```

Crucially, **the STL bytes are not returned here.** The client gets a
`designId` and proceeds to checkout.

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
    ...eventsCommands,
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
| `events.list`                      | Upcoming bike events shown in the left sidebar          |
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
events(id TEXT PK, title, happens_at, location, image_url)
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
client/
 ├─ main.js                         entry point; router + socket
 ├─ router.js                       history API + query parsing
 ├─ socket.js                       two-way command helper
 ├─ dom.js                          el(tag, attrs, ...children) hyperscript
 ├─ icons.js                        inline SVG icon set (replaces lucide-react)
 ├─ components/
 │   ├─ header.js                   sticky nav + mobile menu
 │   └─ valve-stem-viewer.js        SVG.js pseudo-3D renderer
 └─ pages/
     ├─ home.js                     photo upload → generate → checkout
     ├─ how-it-works.js             marketing / explainer
     ├─ pricing.js                  Single STL-download tier + CTA
     ├─ checkout-return.js          verify Stripe session, stream STL
     └─ account.js                  profile, designs, orders, settings

server/
 ├─ index.js                        Express, socket.io, /health, graceful shutdown
 ├─ logger.js                       JSON lines → stdout/stderr
 ├─ db.js                           pg Pool with CA-verified TLS
 ├─ design-store.js                 STL persistence + expiry job
 ├─ stripe-client.js                Stripe SDK lazy init + pricing catalogue
 ├─ migrate.js                      admin process
 ├─ commands/                       socket.io command handlers
 │   ├─ index.js                    dispatcher + registry
 │   ├─ stl.js                      spawns TRELLIS, persists, paywalls
 │   ├─ payments.js                 Stripe checkout + verify
 │   └─ designs|orders|account|events.js
 ├─ workers/
 │   ├─ trellis_generate.py         photo → head mesh → merge → STL
 │   └─ requirements.txt            numpy, pillow, trimesh
 ├─ assets/
 │   └─ valve_cap.stl               1.2 MB — the base stem we never scale
 └─ migrations/
     ├─ 001_initial.sql
     └─ 002_designs_and_purchases.sql
```

---

## 8. Environments & configuration

Everything is read from `process.env` at startup. Canonical list in
`.env.example`. A few notes that are easy to miss:

- **`DATABASE_SSL=false`** is only for local plaintext Postgres. DO Managed
  DB requires TLS.
- **`DATABASE_CA_CERT`** (PEM-encoded) triggers strict cert verification.
  Without it, SSL is still enabled but with `rejectUnauthorized: false`.
- **`APP_URL`** is used to build Stripe success/cancel URLs. Set it to your
  production domain (e.g. `https://bikeheadz.ondigitalocean.app`).
- **`TRELLIS_ENABLED=false`** toggles the procedural fallback head — useful
  on App Platform (no GPU) and in CI.
- **`STRIPE_PRICE_STL_CENTS`** overrides the STL-download price without code changes.

The DO `app.yaml` declares the same variables, promotes Stripe secrets to
`SECRET` type, and injects `${db.DATABASE_URL}` / `${db.CA_CERT}` from the
managed database.

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

### 10.4 Replace the TRELLIS worker with a remote GPU service

In `server/commands/stl.js`, the `runWorker` function is a single point of
swap. Replace the `child_process.spawn` call with a `fetch` to your GPU
endpoint, keeping the contract:

- Input: `{ image_path | image_bytes, head_scale, neck_length_mm, head_tilt_deg }`
- Output: progress events + final `{ stl bytes, triangles }`

Forward progress events using the same `stl.generate.progress` command name
so the client UI needs no changes.

### 10.5 Add a new SQL migration

Create `server/migrations/NNN_description.sql` (next sequential number).
Never edit existing migrations. `npm run migrate` applies new files in
order, tracked by `schema_migrations`.

---

## 11. Design decisions & why

| Decision                                          | Rationale                                                                                                |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Single `"command"` socket event, not REST         | Project guidelines require it, but also: one transport, one envelope, easy to trace & replay.            |
| Vanilla JS + SVG.js instead of React + THREE.js   | Guidelines again, but yields a tiny bundle, no virtual DOM overhead, SVG is a natural fit for 2.5D UI.   |
| TRELLIS spawned per request, not long-running     | Trivial concurrency model; crash recovery = spawn the next request. Downside: cold-start per generation. |
| STL bytes stored in Postgres BYTEA                | Stateless processes (12-factor §6). One backup gets everything. Fine at current data sizes (<2 MB each). |
| STL bytes **never** returned from `stl.generate`  | Forces payment before download. Client only holds a `designId` until `payments.verifySession` succeeds.  |
| No Stripe webhook; verify on redirect-return only | Keeps the "no REST" invariant absolute. Trades a little durability for protocol purity — a webhook can be re-added behind a feature flag if the drop-off rate matters. |
| 24h TTL on generated designs                      | Storage bound. Users that don't pay within 24h must regenerate. Trivial to adjust if support asks.       |
| In-memory fallback when `DATABASE_URL` is unset   | Low-friction local dev; keeps happy-path demo working without a DB install.                              |
| Migrations are append-only, tracked in a table    | Safe, boring, recoverable. No ORM = no drift vs. an ORM's opinion of the schema.                         |

---

## 12. Security & privacy

- **Card data** never touches the server — Stripe Checkout is hosted.
- **Checkout integrity** is guaranteed by verifying the session server-side
  via the Stripe SDK before marking a purchase `paid`. The client only sends
  a `sessionId`; the STL is read from server memory/DB after verification.
- **Photo storage** is transient: images are written to a per-request
  tempdir under the OS temp directory and deleted in the `finally` block of
  `stl.generate`. Only the resulting STL is persisted.
- **Database TLS** is mandatory in production; bind a `DATABASE_CA_CERT`
  from DO's managed DB for strict verification.
- **No cross-account authz yet.** Every request currently operates on a
  single hard-coded account id (`1`). Adding auth is a Phase 1 roadmap item.
- **Rate limiting** is not yet implemented. See roadmap.

---

## 13. Observability & operations

- **Logs** are single-line JSON objects on stdout/stderr — DO App Platform
  captures them automatically.
- **Healthcheck** is `GET /health`, wired into `app.yaml`.
- **Graceful shutdown**: SIGTERM drains sockets, stops the pg pool, cancels
  the TTL job, and exits within 10 s (hard-kill fallback).
- **Key log lines**: `server.listen`, `socket.connect`, `cmd.ok`, `cmd.error`,
  `stl.generated`, `stripe.checkout.paid`, `db.pool.error`, `design_store.pruned`.

For richer telemetry, see FEATUREROADMAP → Observability phase (Sentry,
OpenTelemetry).

---

## 14. Glossary

| Term             | Meaning                                                                   |
| ---------------- | ------------------------------------------------------------------------- |
| **Valve stem cap** | The brass/metal cap that screws on top of a Presta valve; this app's target product. |
| **STL**          | Triangle-soup mesh format, universally supported by 3D printers.          |
| **TRELLIS**      | Microsoft's image-conditioned 3D-generation model.                        |
| **trimesh**      | Python library for mesh I/O, transforms, boolean ops, export.             |
| **Design**       | One generated STL + the settings used to produce it, stored in Postgres.  |
| **Purchase**     | One Stripe Checkout session tied to a design (currently always the STL-download product). |
| **Command**      | A single socket.io message, `{ id, name, payload }`.                      |
| **12-factor**    | The configuration discipline we follow; see https://12factor.net.         |

---

## 15. Troubleshooting

| Symptom                                                    | Likely cause & fix                                                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Client shows "Generating… 0%" forever                      | Python worker isn't installed / `PYTHON_BIN` wrong / `TRELLIS_PATH` invalid. Check `stderr` under `worker.stderr`. |
| `payments.createCheckoutSession` errors `stripe_not_configured` | `STRIPE_SECRET_KEY` is empty. Set it in `.env` (dev) or DO dashboard (prod).                                   |
| STL download returns `payment_required`                    | The purchase row isn't `status='paid'`. Usually means the user navigated away before `payments.verifySession` ran. |
| pg error `self signed certificate in certificate chain`    | Bind `DATABASE_CA_CERT` or set `DATABASE_SSL=false` for local plaintext.                                           |
| Socket connects but no commands reach server               | Vite proxy misconfigured in `vite.config.js` (`BACKEND_PORT`), or client-side ad-blocker mangling `/socket.io/`.    |
| `stl.generate.result` arrives but STL download 404s        | Design expired (>24h). Regenerate.                                                                                 |

---

*When in doubt, read the handler. The codebase is small enough that jumping
from a command name in `server/commands/` to its implementation is the
fastest way to understand an edge case.*
