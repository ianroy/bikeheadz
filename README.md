# StemDomeZ — your face on a bike valve cap

<p>
  <img alt="Node" src="https://img.shields.io/badge/node-22.x-3c873a">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/postgres-18-336791">
  <img alt="Stack" src="https://img.shields.io/badge/stack-vanilla%20JS%20%2B%20socket.io%20%2B%20Three.js-b4ff45">
  <img alt="GPU" src="https://img.shields.io/badge/GPU-RunPod%20Serverless-7c3aed">
  <img alt="Deploy" src="https://img.shields.io/badge/deploy-Digital%20Ocean%20App%20Platform-0080FF">
  <img alt="Pipeline" src="https://img.shields.io/badge/pipeline-v1%20%E2%9C%93%20shipped-22c55e">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue">
  <a href="https://console.runpod.io/hub/ianroy/stemdomez"><img alt="RunPod Hub" src="https://api.runpod.io/badge/ianroy/stemdomez"></a>
</p>

> Drop in a portrait. A GPU running TRELLIS sculpts your dome in 3D.
> We graft it into a Schrader thread. 3D-print the STL. Screw on your
> tire valve. Roll out. Free during launch.

StemDomeZ turns a selfie into an FDM/PLA-printable bike valve stem
cap. Photo lands on the server, gets downsampled by `sharp`, ships
to one of two RunPod Serverless GPU regions (whichever picks up the
job first wins), Microsoft's
[TRELLIS](https://github.com/Microsoft/TRELLIS) sculpts the head, an
8-stage CAD pipeline grafts it onto a Schrader-threaded valve cap, the
result streams back to the browser through one socket.io `"command"`
event, and the user prints it. **No REST endpoints**, **no webhooks
required**, **no JSX**. Built for the Gumball Machine Takeover
residency at [Sadie's Bikes](https://www.instagram.com/sadiesbikes/)
in Great (Turners) Falls, Massachusetts.

Current production handler is **v0.1.41** (stage 1.7 watertight head
before booleans + stage 6 PyMeshFix safety net). Site lives at
[stemdomez.com](https://stemdomez.com). The full env-var matrix is in
[ProductSpec.md §8](./ProductSpec.md#8-environments--configuration);
the production gotchas we burned days learning are in
[docs/RUNPOD_TRELLIS_PLAYBOOK.md](./docs/RUNPOD_TRELLIS_PLAYBOOK.md);
the visual diagrams are at [docs/](./docs/) — pipeline,
system-architecture, multi-region-race, data-flow, user-journey,
gumball-takeover.

---

## Table of contents

- [What it does](#what-it-does)
- [End-to-end flow](#end-to-end-flow)
- [Quick start](#quick-start)
- [Architecture at a glance](#architecture-at-a-glance)
- [Running locally](#running-locally)
- [Deploying](#deploying)
- [Environment variables](#environment-variables)
- [Project layout](#project-layout)
- [Further reading](#further-reading)
- [Contributing](#contributing)
- [Authors](#authors)
- [Acknowledgments](#acknowledgments)
- [License](#license)

---

## What it does

A rider uploads a portrait. The app:

1. Validates the photo (size + face-detection pre-flight).
2. Submits a job to a RunPod Serverless TRELLIS endpoint that returns
   a unitless head mesh (~780 K tris, head + chest, often non-manifold).
3. Runs a 7-stage CAD pipeline in the same handler:
   - Stage 1 normalizes orientation and rescales to ~30 mm.
   - Stage 1.5 repairs the mesh (drops floaters, closes holes).
   - Stage 2 crops to neck-and-up.
   - Stage 3 carves the threaded cavity (boolean subtract a
     `negative_core` STL).
   - Stage 4 unions the threaded `valve_cap` STL into the cavity.
   - Stage 5 simplifies, smooths, and exports a binary STL.
4. Streams the result back via chunked yields (RunPod's per-frame size
   cap forced this design — see the playbook).
5. Renders the STL in a Three.js OrbitControls viewer immediately so the
   user sees their head before paying.
6. On purchase, Stripe Checkout collects $2 and the server delivers the
   STL bytes via a paywalled `stl.download` command.

Print tiers ($19.99 single, $59.99 pack-of-4) reuse the same checkout.

## End-to-end flow

```
 Browser ─upload photo─▶ Node socket.io ─sharp resize─┐
                                                       │
                                                       ▼
                          ┌─POST /run──▶ RunPod handler (US)
                          │                  │
                          │     ◀─/stream/<id>─ progress (in_progress wins)
                          │
              ── race ────┤
                          │
                          └─POST /run──▶ RunPod handler (RO)
                                             │
                                  ◀─/cancel/<id>─ (loser cancelled)

  WINNER (whichever picks up first):
       │
       │ TRELLIS  (~30s warm · 5–10 min cold)
       │ stage 1  · normalize
       │ stage 1.5 · pymeshlab close-holes
       │ stage 1.7 · PyMeshFix watertight (NEW v0.1.41)
       │ stage 2  · crop neck (CSG)
       │ stage 3  · subtract negative_core (CSG)
       │ stage 4  · union valve_cap (CSG)
       │ stage 5  · decimate to 50–80k tris
       │ stage 6  · split-and-process safety net (PyMeshFix)
       │
       ▼
  result_chunk × N (~700KB base64 each, ~1MB RunPod cap)
       │
       ▼
 Browser ◀─progress frames─ Node ─reassemble bytes─◀
                              │
                              ├─ store.save(stlBytes, 24h TTL)
                              └─ emit stl.generate.result

 Browser ─renders Three.js viewer with the actual STL─

 [Free during launch — payments_enabled flag OFF]
 Browser ─stl.downloadFree──▶ Node ──signed bytes──▶ Blob download
```

The diagram above is the prose version. See visual SVGs at
[docs/system-architecture.svg](./docs/system-architecture.svg),
[docs/multi-region-race.svg](./docs/multi-region-race.svg),
[docs/pipeline.svg](./docs/pipeline.svg),
[docs/data-flow.svg](./docs/data-flow.svg),
[docs/user-journey.svg](./docs/user-journey.svg) (rider perspective),
and [docs/gumball-takeover.svg](./docs/gumball-takeover.svg)
(residency narrative).

Cross-doc nav:
[`ProductSpec.md`](./ProductSpec.md) for the annotated data flow,
[`3D_Pipeline.md`](./3D_Pipeline.md) for the mesh pipeline,
[`docs/RUNPOD_TRELLIS_PLAYBOOK.md`](./docs/RUNPOD_TRELLIS_PLAYBOOK.md)
for the GPU-tier gotchas, and
[`FEATUREROADMAP_workplan.md`](./FEATUREROADMAP_workplan.md) for
what's next.

## Quick start

```bash
# 1. Node + Python prerequisites
nvm install 22 && nvm use 22
pip install -r server/workers/requirements.txt   # numpy, pillow, trimesh

# 2. Configure secrets
cp .env.example .env
# at minimum set STRIPE_SECRET_KEY=sk_test_… for local checkout

# 3. (optional) Postgres — the app runs in-memory without one
createdb stemdomez && npm run migrate

# 4. Boot
npm install
npm run dev          # Vite on :5173, Node API on :3000 with socket.io proxied
```

Open **http://localhost:5173**. Stripe test card:
`4242 4242 4242 4242`, any future expiry, any CVC.

> **GPU note**: Real TRELLIS inference needs a CUDA GPU. On laptops, set
> `TRELLIS_ENABLED=false` in `.env` to use a procedural placeholder head
> so the rest of the flow still works end-to-end. To exercise the real
> GPU path locally, point `RUNPOD_ENDPOINT_URL` + `RUNPOD_API_KEY` at
> your dev RunPod endpoint.

## Architecture at a glance

| Layer            | Tech                                                                |
| ---------------- | ------------------------------------------------------------------- |
| Client UI        | Vanilla JS + Tailwind v4 (no React, no GraphQL, no JSX)             |
| Client 3D viewer | Three.js + STLLoader + OrbitControls (~200 KB gzipped)              |
| Transport        | socket.io with one two-way `"command"` event (no REST surface)      |
| Server           | Node.js 22 + Express; serves the built client + socket.io           |
| GPU worker       | RunPod Serverless, custom image at `ghcr.io/<owner>/<repo>:<tag>`   |
| Pipeline         | Python: TRELLIS → trimesh + manifold3d + pymeshlab + fast-simplification |
| Payments         | Stripe Checkout (no webhook; verified on redirect-return)           |
| Database         | DigitalOcean Managed PostgreSQL 18 (BYTEA STL storage, 24 h TTL)    |
| 12-factor        | Port-binding, env-only config, JSON stdout logs, SIGTERM disposal   |

### Two-way command pattern

Every client↔server interaction is one socket event, `"command"`, carrying
`{ id, name, payload }`:

```js
// Client → Server
socket.emit('command', { id, name: 'stl.generate', payload: { imageData, settings } });

// Server → Client (replies correlated by id)
socket.emit('command', { id, name: 'stl.generate.progress', payload: { step, pct } });
socket.emit('command', { id, name: 'stl.generate.result',   payload: { designId, triangles, stl_b64 } });
socket.emit('command', { id, name: 'stl.generate.error',    payload: { error } });
```

Handlers live under [`server/commands/`](./server/commands/). The only
HTTP surfaces the server exposes are `GET /health` and the built client
under `/`. Stripe is verified on the redirect-return via
`payments.verifySession` — no webhook, no REST.

## Running locally

### 1. Node dependencies

```bash
cp .env.example .env           # fill in DATABASE_URL, STRIPE_SECRET_KEY, etc.
npm install
npm run migrate                # optional — falls back to in-memory mode
```

### 2. TRELLIS — local GPU dev (optional, advanced)

```bash
git clone https://github.com/Microsoft/TRELLIS.git
cd TRELLIS
./setup.sh --new-env --basic --flash-attn --diffoctreerast \
           --spconv --mipgaussian --kaolin --nvdiffrast
cd ..
pip install -r server/workers/requirements.txt
```

Point `TRELLIS_PATH` in `.env` at the clone. Without a GPU, set
`TRELLIS_ENABLED=false` and the local worker uses a procedural fallback
head. Most contributors don't run TRELLIS locally — they point at a dev
RunPod endpoint instead.

### 3. Stripe (local checkout)

```bash
stripe login            # caches a dashboard token; one-time
```

Set `STRIPE_SECRET_KEY=sk_test_…` in `.env`. Optional override:
`STRIPE_PRICE_STL_CENTS=200` (default = $2). The app does **not** use
Stripe webhooks — `payments.verifySession` confirms the payment when
the user is redirected back from Checkout — so no `stripe listen`
forwarder is needed.

### 4. Boot

```bash
npm run dev
```

Open http://localhost:5173.

## Deploying

### Node tier — DigitalOcean App Platform

1. Push this repo to GitHub and fill in `services[0].github.repo` in
   [`.do/app.yaml`](./.do/app.yaml).
2. `doctl apps create --spec .do/app.yaml`
3. The spec attaches a Managed PostgreSQL 18 cluster (`db`).
   `DATABASE_URL` injects automatically.
4. In the DO dashboard, bind `STRIPE_SECRET_KEY` and `RUNPOD_API_KEY`
   as **Secret** env vars.
5. The `migrate` `PRE_DEPLOY` job runs `node server/migrate.js` before
   each release goes live.

### GPU tier — RunPod Serverless

DO App Platform has no GPU sizes, so TRELLIS runs on RunPod. The image
is built by GitHub Actions on each release tag and pushed to GHCR
(`ghcr.io/<owner>/<repo>:<tag>`).

To ship a worker change:

```bash
# 1. bump HANDLER_VERSION in handler.py + commit
git commit -am "v0.1.X: <change>"
git push origin main

# 2. cut a release — this is what GHA listens for
gh release create v0.1.X --title "v0.1.X — <description>" --notes "…"

# 3. wait ~17–25 min for the build
gh run watch

# 4. paste the new image URL into RunPod → Manage → New Release
#    ghcr.io/<owner>/<repo>:v0.1.X
```

End-to-end RunPod setup (Hub flow, Network Volume, dashboard tuning) is
in [`deploy/runpod/README.md`](./deploy/runpod/README.md).

The hard-won production lessons (chunked-yield protocol,
`return_aggregate_stream=False`, pipeline gate strictness, Dockerfile
gotchas) live in
[`docs/RUNPOD_TRELLIS_PLAYBOOK.md`](./docs/RUNPOD_TRELLIS_PLAYBOOK.md) —
**read it before touching the handler**.

## Environment variables

The full matrix lives in
[**ProductSpec.md §8**](./ProductSpec.md#8-environments--configuration)
— two tables (Node app on DO, RunPod handler) covering every variable
the codebase reads at startup, what's required, default, and what
breaks when it's missing. Don't duplicate it here.

The handful you cannot start without:

| Variable                       | Where           | Why                                               |
|--------------------------------|-----------------|---------------------------------------------------|
| `DATABASE_URL`                 | Node            | DO Managed Postgres (injected via `${db.…}`)      |
| `AUTH_SECRET`                  | Node (SECRET)   | Signs the `sd_session` cookie                     |
| `RUNPOD_API_KEY`               | Node (SECRET)   | Bearer for either single or multi-region RunPod   |
| `RUNPOD_ENDPOINT_URL` *or* `RUNPOD_ENDPOINT_URLS` | Node | Single region or comma-sep multi-region race |
| `RESEND_API_KEY`               | Node (SECRET)   | Magic-link emails                                 |
| `HF_TOKEN`                     | RunPod (SECRET) | Gated TRELLIS download — handler boots without it but never produces a result |

Everything else has a sane default. See ProductSpec §8 for the
complete reference + the recently-added knobs:
`RUNPOD_FORCE_WARMUP`, `IMAGE_RESIZE_*`, `STL_RATE_LIMIT_*`,
`SENTRY_*`, `STRIPE_*`, the handler tunables in `.runpod/hub.json`.

## Project layout

```
.
├── client/                         Vanilla JS front-end (Three.js + Tailwind)
│   ├── main.js                     entry: mounts header + router
│   ├── router.js                   history-API router with query parsing
│   ├── socket.js                   socket.io client with command-pattern helpers
│   ├── components/
│   │   ├── header.js
│   │   └── valve-stem-viewer.js    Three.js OrbitControls + STLLoader viewer
│   ├── pages/
│   │   ├── home.js                 photo → STL generator, sliders, viewer
│   │   ├── pricing.js              Stripe pricing tiers
│   │   ├── checkout-return.js      post-payment verification + STL download
│   │   └── …
│   └── styles/                     Tailwind v4 + theme
├── server/                         Node.js backend
│   ├── index.js                    Express + socket.io bootstrap, healthcheck
│   ├── design-store.js             STL persistence (Postgres ↔ memory fallback)
│   ├── stripe-client.js            Stripe SDK factory + pricing catalogue
│   ├── commands/                   socket.io command handlers
│   │   ├── stl.js                  RunPod-or-local routing, persists designs
│   │   ├── payments.js             Checkout Session + verify
│   │   └── designs · orders · account
│   ├── workers/
│   │   ├── runpod-client.js        chunked-yield-aware HTTP client for RunPod
│   │   ├── trellis_generate.py     local Python fallback (dev / CI)
│   │   ├── pipeline/               v1 mesh pipeline (Python)
│   │   │   ├── __init__.py         run_v1 entry point
│   │   │   ├── stages.py           stage1 / 1.5 / 2 / 3 / 4 / 5
│   │   │   ├── constants.py        Constants dataclass + JSON loader
│   │   │   ├── errors.py           PipelineError + ErrorCode enum
│   │   │   └── validation.py       assert_printable
│   │   └── requirements.txt
│   ├── assets/
│   │   ├── valve_cap.stl           ~7.4K tris, threaded screw cap
│   │   ├── negative_core.stl       ~290 tris, boolean cutter
│   │   └── reference/              calibration-target STLs
│   └── migrations/                 append-only SQL
├── handler.py                      RunPod Serverless TRELLIS handler
├── Dockerfile                      CUDA 12.1 + TRELLIS image (RunPod / GHCR)
├── .runpod/
│   ├── hub.json                    RunPod Hub manifest
│   └── tests.json                  smoke test after each build
├── .github/workflows/
│   └── build-runpod-image.yml      builds + pushes GHCR image on release
├── deploy/runpod/
│   └── README.md                   Hub setup + dashboard walkthrough
├── docs/
│   └── RUNPOD_TRELLIS_PLAYBOOK.md  the gotchas we burned days learning
├── .do/app.yaml                    DigitalOcean App Platform spec
├── architecture.svg                system diagram (regenerated with docs)
├── README.md                       (this file)
├── ProductSpec.md                  developer onboarding guide
├── 3D_Pipeline.md                  pipeline architecture & calibration
└── FEATUREROADMAP_workplan.md      forward-looking, agent-drivable roadmap
```

## Further reading

- **[ProductSpec.md](./ProductSpec.md)** — annotated architecture,
  request lifecycles, data model, extension points.
- **[3D_Pipeline.md](./3D_Pipeline.md)** — the v1 mesh pipeline:
  stages, calibration, asset contracts, library audit.
- **[docs/RUNPOD_TRELLIS_PLAYBOOK.md](./docs/RUNPOD_TRELLIS_PLAYBOOK.md)**
  — production gotchas, delivery protocol, Dockerfile traps,
  diagnostic surfaces.
- **[deploy/runpod/README.md](./deploy/runpod/README.md)** — Hub setup,
  Network Volume, endpoint tuning.
- **[FEATUREROADMAP_workplan.md](./FEATUREROADMAP_workplan.md)** —
  phased roadmap with regeneration + execution prompts.
- **[.env.example](./.env.example)** — every env var the app reads.
- **[.do/app.yaml](./.do/app.yaml)** — production deployment spec.

## Contributing

Contributions welcome. The codebase is small, deliberately
un-abstracted, and follows a handful of house rules:

1. **No REST.** All client↔server messages go over the `"command"`
   socket event.
2. **No React / JSX.** UI is vanilla DOM via [`client/dom.js`](./client/dom.js)
   and Three.js for the viewer.
3. **12-factor discipline.** New configuration lives in `.env.example`
   and is read via `process.env`. Never hard-code secrets or URLs.
4. **Tailwind v4 + theme.css.** Prefer utility classes over custom CSS.
5. **Migrations are append-only.** Add a new `NNN_name.sql` in
   `server/migrations/`; don't edit old ones.
6. **Bump `HANDLER_VERSION`** in `handler.py` for any handler change,
   and tag the release the same day. Otherwise you cannot tell from
   the worker logs which code is running.
7. **Commits carry a short body** describing the *why*. Add a
   `Co-Authored-By` trailer when pair-programming.

### Development loop

```bash
npm run dev          # concurrently runs Vite + the socket.io server
npm run build        # production bundle to dist/
npm start            # node server/index.js serves dist/ on $PORT
npm run migrate      # applies any pending SQL migrations
```

### Picking up the roadmap

Start at [FEATUREROADMAP_workplan.md](./FEATUREROADMAP_workplan.md). The
file contains a state header, a regeneration prompt (to discover new
tasks), and an execution prompt (to implement them). Update task
checkboxes and notes as you go — the file is designed to survive
context-window limits.

## Authors

- **Ian Roy** ([@ianroy](https://github.com/ianroy)) — creator, design,
  and product lead.

Pair-programmed with Anthropic's Claude (Claude Code + the Anthropic
SDK). See `Co-Authored-By` trailers in the git log for attribution on
individual commits.

## Acknowledgments

- **Microsoft TRELLIS** for the image-conditioned 3D generation pipeline.
  <https://github.com/Microsoft/TRELLIS>
- **manifold3d** for the only CPU CSG library with a manifold-output
  guarantee.
- **trimesh** for mesh I/O, transforms, and STL export.
- **pymeshlab** for the heavy-duty repair pipeline (used behind a
  subprocess wrapper to respect GPL).
- **fast-simplification** for QEM decimation.
- **Three.js** for the WebGL STL viewer.
- **Stripe** for the Checkout hosted pages.
- **Unsplash** for the imagery on the generator sidebars (used under
  license — see [`ATTRIBUTIONS.md`](./ATTRIBUTIONS.md)).
- Original layout exported from a
  [Figma Make](https://www.figma.com/design/kXNX9EMUVdydwPa8gcr5G9/3D-Bike-Valve-Stem-App)
  design; all React/shadcn scaffolding has since been removed.

## License

[MIT](./LICENSE) © 2026 Ian Roy.
