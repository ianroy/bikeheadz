# BikeHeadz — 3D Bike Valve Stem App

<p>
  <img alt="Node" src="https://img.shields.io/badge/node-22.x-3c873a">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/postgres-18-336791">
  <img alt="Stack" src="https://img.shields.io/badge/stack-vanilla%20JS%20%2B%20socket.io%20%2B%20SVG.js-b4ff45">
  <img alt="Deploy" src="https://img.shields.io/badge/deploy-Digital%20Ocean%20App%20Platform-0080FF">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue">
  <a href="https://console.runpod.io/hub/ianroy/bikeheadz"><img alt="RunPod Hub" src="https://api.runpod.io/badge/ianroy/bikeheadz"></a>
</p>

> Turn a portrait into a 3D-printable Presta valve stem cap — upload a photo,
> get a bespoke stem-with-your-head-on-top STL for $2.

BikeHeadz takes a selfie, runs it through Microsoft's
[TRELLIS](https://github.com/Microsoft/TRELLIS) image-to-3D model, merges the
result onto a fixed valve cap geometry (`server/assets/valve_cap.stl`), and
sells the resulting STL for $2 via Stripe Checkout. All client/server traffic
rides a single two-way command pattern over socket.io — **no REST endpoints
at all** (not even for Stripe; verification happens when the user returns
from Checkout).

---

## Table of contents

- [What it does](#what-it-does)
- [Demo flow](#demo-flow)
- [Quick start](#quick-start)
- [Architecture at a glance](#architecture-at-a-glance)
- [Running locally](#running-locally)
- [Deploying to Digital Ocean](#deploying-to-digital-ocean)
- [Environment variables](#environment-variables)
- [Project layout](#project-layout)
- [Further reading](#further-reading)
- [Contributing](#contributing)
- [Authors](#authors)
- [Acknowledgments](#acknowledgments)
- [License](#license)

---

## What it does

BikeHeadz is a full-stack web app for generating personalised bike valve stem
caps. A rider uploads a photo; the app produces a printable STL where the
user's head sits on top of a standard Presta valve cap. The app also supports
ordering printed stems (see the pricing page).

Primary user journey:

1. **Upload a photo** on the home page (`/`).
2. **Generate** — the photo goes to the server, TRELLIS generates a head
   mesh, the server merges it onto the fixed valve cap geometry, and an STL
   is stored server-side.
3. **Checkout** — a Stripe Checkout Session is created for $2. The user pays
   on Stripe's hosted page.
4. **Download** — on return, the client verifies the session and downloads
   the STL. Print-to-order ($19.99) and pack-of-4 ($59.99) tiers share the
   same checkout flow.

## Demo flow

```
 ┌─────────────┐  photo   ┌───────────┐  spawn   ┌──────────────┐
 │  Browser    │─────────▶│  Node.js  │─────────▶│  Python /    │
 │ (SVG.js UI) │◀───progr─│ socket.io │◀──json───│  TRELLIS     │
 └─────────────┘          │  server   │          │  trimesh     │
        │                 │           │          │  merge STL   │
        │  checkout URL   │           │          └──────┬───────┘
        ▼                 │           │                 │ STL bytes
 ┌─────────────┐ paid?    │           │                 ▼
 │ Stripe.com  │◀────────▶│           │     ┌───────────────────┐
 │ (hosted)    │  webhook │           │     │ generated_designs │
 └─────────────┘          │           │     │      (Postgres)   │
        │                 │           │     └───────────────────┘
        └── redirect ────▶│ verify    │
                          │ → stream  │
                          │   STL     │
                          └───────────┘
```

See [`ProductSpec.md`](./ProductSpec.md) for the annotated data flow and
[`FEATUREROADMAP_workplan.md`](./FEATUREROADMAP_workplan.md) for the
forward-looking plan.

## Quick start

```bash
# 1. Install Node + Python prerequisites
nvm install 22 && nvm use 22
pip install -r server/workers/requirements.txt

# 2. Configure secrets
cp .env.example .env
# edit .env — at minimum set STRIPE_SECRET_KEY (sk_test_…) for local checkout

# 3. Start the database (optional — the app runs in in-memory mode without one)
createdb bikeheadz && npm run migrate

# 4. Boot the app
npm install
npm run dev        # Vite on :5173, API on :3000 with socket.io proxied
```

Then open **http://localhost:5173**. Test Stripe card:
`4242 4242 4242 4242`, any future expiry, any CVC.

> **GPU note**: Without a CUDA GPU, set `TRELLIS_ENABLED=false` in `.env`.
> You'll still get a working end-to-end flow using a procedural head; real
> TRELLIS inference requires a GPU + PyTorch.

## Architecture at a glance

| Layer            | Tech                                                               |
| ---------------- | ------------------------------------------------------------------ |
| Client UI        | Vanilla JS + Tailwind v4 (no React, no GraphQL)                    |
| Client graphics  | [SVG.js](https://svgjs.dev) — all valve-stem rendering             |
| Transport        | socket.io with a two-way command pattern (no REST)                 |
| Server           | Node.js 22 + Express (serves the built client + socket.io; healthcheck) |
| 3D generation    | Python + Microsoft TRELLIS, spawned per request                    |
| Mesh compositing | [trimesh](https://trimesh.org) fuses head onto the valve cap STL   |
| Payments         | Stripe Checkout — $2 STL download; print tiers on the roadmap      |
| Database         | Digital Ocean Managed PostgreSQL 18                                |
| 12-factor        | Port binding, env-only config, JSON stdout logs, SIGTERM disposal  |

### Two-way command pattern

Every client↔server interaction is one socket event, `"command"`, carrying
`{ id, name, payload }`:

```js
// Client → Server
socket.emit('command', { id, name: 'stl.generate', payload: { imageData, settings } });

// Server → Client (replies correlated by id)
socket.emit('command', { id, name: 'stl.generate.progress', payload: { step, pct } });
socket.emit('command', { id, name: 'stl.generate.result',   payload: { designId, triangles } });
socket.emit('command', { id, name: 'stl.generate.error',    payload: { error } });
```

Handlers live under [`server/commands/`](./server/commands/). The **only**
HTTP surfaces the server exposes are `GET /health` and the built client
under `/`. Stripe is verified on the way back from Checkout via the
`payments.verifySession` command — no webhook endpoint, no REST.

## Running locally

### 1. Node dependencies

```bash
cp .env.example .env           # fill in DATABASE_URL, STRIPE_SECRET_KEY, etc.
npm install
npm run migrate                # optional — falls back to in-memory mode without a DB
```

### 2. TRELLIS (optional for dev)

```bash
git clone https://github.com/Microsoft/TRELLIS.git
cd TRELLIS
./setup.sh --new-env --basic --flash-attn --diffoctreerast \
           --spconv --mipgaussian --kaolin --nvdiffrast
cd ..
pip install -r server/workers/requirements.txt
```

Point `TRELLIS_PATH` in `.env` at the clone. With no GPU, set
`TRELLIS_ENABLED=false` and the worker will use a procedural fallback head
so the rest of the pipeline still works end-to-end.

### 3. Stripe (local checkout)

```bash
stripe login            # once — caches a dashboard token
```

Put your test secret key into `STRIPE_SECRET_KEY=sk_test_…`. Optional
override: `STRIPE_PRICE_STL_CENTS=200` (default = $2). The app does **not**
use Stripe webhooks — `payments.verifySession` confirms the payment when
the user is redirected back from Checkout — so no `stripe listen` forwarder
is needed.

### 4. Boot

```bash
npm run dev
```

Open http://localhost:5173.

## Deploying to Digital Ocean

1. Push this repo to GitHub and fill in `services[0].github.repo` in
   [`.do/app.yaml`](./.do/app.yaml).
2. Create the app:
   ```bash
   doctl apps create --spec .do/app.yaml
   ```
3. The spec attaches a Managed PostgreSQL 18 cluster as component `db`.
   `DATABASE_URL` is injected automatically.
4. In the DO dashboard, bind `STRIPE_SECRET_KEY` as a **Secret** env var.
5. The `migrate` `PRE_DEPLOY` job runs `node server/migrate.js` before each
   release goes live.

### TRELLIS in production (GPU offload)

DO App Platform has no GPU sizes, so the bundled `app.yaml` ships with
`TRELLIS_ENABLED=false`. Real inference is offloaded to a **RunPod
Serverless** endpoint running the image in [`deploy/runpod/`](./deploy/runpod/).

The handoff is transparent to callers:

- Set `RUNPOD_ENDPOINT_URL` + `RUNPOD_API_KEY` in the DO env → every
  `stl.generate` command is routed to RunPod via
  [`server/workers/runpod-client.js`](./server/workers/runpod-client.js).
- Leave them unset → the server falls back to the local Python spawn
  path (`TRELLIS_ENABLED=false` → procedural placeholder head).

End-to-end setup lives in [`deploy/runpod/README.md`](./deploy/runpod/README.md):
image build, network volume for model weights, endpoint creation,
warm-up, and dashboard tuning. The same image pattern would run on
Paperspace Deployments or Lambda with minor changes.

## Environment variables

See [`.env.example`](./.env.example) for the complete catalogue. Highlights:

| Variable                 | Purpose                                                        |
| ------------------------ | -------------------------------------------------------------- |
| `PORT`                   | HTTP port (platform-injected)                                  |
| `DATABASE_URL`           | Postgres connection string                                     |
| `DATABASE_SSL`           | `false` to disable TLS for local Postgres                      |
| `APP_URL`                | Public URL for Stripe redirects                                |
| `STRIPE_SECRET_KEY`      | Stripe API secret (`sk_test_…` / `sk_live_…`)                  |
| `STRIPE_PRICE_STL_CENTS` | STL price override in cents (default `200`)                    |
| `TRELLIS_ENABLED`        | `false` to use the procedural fallback head (local path only)  |
| `TRELLIS_PATH`           | Path to a cloned TRELLIS repo (local path only)                |
| `PYTHON_BIN`             | Python interpreter for the worker (default `python3`)          |
| `RUNPOD_ENDPOINT_URL`    | `https://api.runpod.ai/v2/<id>` — routes STL gen to RunPod     |
| `RUNPOD_API_KEY`         | RunPod bearer token (SECRET)                                   |
| `LOG_LEVEL`              | `error` · `warn` · `info` (default) · `debug`                  |

## Project layout

```
.
├── client/                         Vanilla JS front-end (SVG.js + Tailwind)
│   ├── main.js                     Entry: mounts header + router
│   ├── router.js                   History-API router with query parsing
│   ├── socket.js                   socket.io client with command-pattern helpers
│   ├── dom.js                      Hyperscript element helper
│   ├── icons.js                    Inline SVG icon set (replaces lucide-react)
│   ├── components/
│   │   ├── header.js
│   │   └── valve-stem-viewer.js    SVG.js-powered 3D-style valve viewer
│   ├── pages/
│   │   ├── home.js                 Photo → STL generator
│   │   ├── how-it-works.js
│   │   ├── pricing.js              Stripe pricing tiers
│   │   ├── checkout-return.js      Post-payment verification + STL download
│   │   └── account.js
│   └── styles/                     Tailwind v4 + theme
├── server/                         Node.js backend
│   ├── index.js                    Express + socket.io bootstrap, healthcheck
│   ├── logger.js                   JSON stdout logger
│   ├── db.js                       pg Pool (DATABASE_URL, encrypted unverified TLS)
│   ├── design-store.js             STL persistence (Postgres ↔ memory fallback)
│   ├── stripe-client.js            Stripe SDK factory + pricing catalogue
│   ├── migrate.js                  Admin process
│   ├── commands/                   socket.io command handlers
│   │   ├── index.js                dispatcher
│   │   ├── stl.js                  RunPod-or-local routing, persists designs
│   │   ├── payments.js             Checkout Session + verify
│   │   └── designs · orders · account
│   ├── workers/
│   │   ├── trellis_generate.py     Local TRELLIS (dev / CPU fallback)
│   │   ├── runpod-client.js        HTTP client for the RunPod endpoint
│   │   └── requirements.txt        numpy, pillow, trimesh
│   ├── assets/
│   │   └── valve_cap.stl           Base valve-cap geometry (never scaled)
│   └── migrations/                 001_initial, 002_designs_and_purchases, 003_drop_events
├── Dockerfile                      CUDA 12.1 + TRELLIS + handler (RunPod image)
├── .dockerignore                   Trims the Docker build context
├── .runpod/
│   ├── hub.json                    RunPod Hub listing config
│   └── tests.json                  Smoke test RunPod runs after each build
├── deploy/
│   └── runpod/
│       ├── handler.py              RunPod Serverless generator handler
│       └── README.md               Hub + dashboard walkthrough
├── .do/app.yaml                    Digital Ocean App Platform spec
├── Procfile                        release + web process declarations
├── .env.example                    config template (12-factor §3)
├── index.html                      static shell
├── vite.config.js                  Vite build config
├── README.md                       (this file)
├── ProductSpec.md                  Developer onboarding guide
└── FEATUREROADMAP_workplan.md      Forward-looking, agent-drivable roadmap
```

## Further reading

- **[ProductSpec.md](./ProductSpec.md)** — annotated architecture, request
  lifecycles, data model, extension points.
- **[FEATUREROADMAP_workplan.md](./FEATUREROADMAP_workplan.md)** — phased
  feature plan with agent-recursive regeneration and execution prompts.
- **[.env.example](./.env.example)** — every env var the app reads.
- **[.do/app.yaml](./.do/app.yaml)** — production spec.

## Contributing

Contributions welcome. The codebase is small, deliberately un-abstracted, and
follows a handful of house rules:

1. **No REST.** All client↔server messages go over the `"command"` socket
   event.
2. **No React / JSX.** The UI is vanilla DOM via [`client/dom.js`](./client/dom.js)
   and [SVG.js](https://svgjs.dev) for the viewer.
3. **12-factor discipline.** New configuration lives in `.env.example` and
   is read via `process.env`. Never hard-code secrets or URLs.
4. **Tailwind v4 + theme.css.** Prefer utility classes over custom CSS.
5. **Migrations are append-only.** Add a new `NNN_name.sql` file in
   `server/migrations/`; don't edit old ones.
6. **Commits carry a short body** describing the "why". Add a
   `Co-Authored-By` trailer when pair-programming.

### Development loop

```bash
npm run dev          # concurrently runs Vite + the socket.io server
npm run build        # production bundle to dist/
npm start            # node server/index.js serves dist/ on $PORT
npm run migrate      # applies any pending SQL migrations
```

### Picking up the roadmap

Start at [FEATUREROADMAP_workplan.md](./FEATUREROADMAP_workplan.md). The file
contains a state header, a regeneration prompt (to discover new tasks), and an
execution prompt (to implement them). Update task checkboxes and notes as you
go — the file is designed to survive context-window limits.

## Authors

- **Ian Roy** ([@ianroy](https://github.com/ianroy)) — creator, design, and
  product lead.

Pair-programmed with Anthropic's Claude (Claude Code + the Anthropic SDK).
See `Co-Authored-By` trailers in the git log for attribution on individual
commits.

## Acknowledgments

- **Microsoft TRELLIS** for the image-conditioned 3D generation pipeline.
  <https://github.com/Microsoft/TRELLIS>
- **trimesh** for mesh I/O, concatenation, and STL export.
- **SVG.js** for fluent DOM-first SVG manipulation.
- **Stripe** for the Checkout hosted pages.
- **Unsplash** for the imagery on the generator sidebars (used under license —
  see [`ATTRIBUTIONS.md`](./ATTRIBUTIONS.md)).
- Original layout exported from a
  [Figma Make](https://www.figma.com/design/kXNX9EMUVdydwPa8gcr5G9/3D-Bike-Valve-Stem-App)
  design; all React/shadcn scaffolding has since been removed.

## License

[MIT](./LICENSE) © 2026 Ian Roy.
