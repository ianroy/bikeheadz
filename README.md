# 3D Bike Valve Stem App

BikeHeadz turns a portrait photo into a 3D-printable Presta valve stem cap. A
photo is sent over a socket.io command to a Node.js server, which invokes a
Python [TRELLIS](https://github.com/Microsoft/TRELLIS) worker to produce a
head mesh, fuses it onto a fixed valve-cap STL, and streams the merged STL
back via Stripe Checkout — $2 per download.

The visual interface is preserved from the original Figma-made design
(https://www.figma.com/design/kXNX9EMUVdydwPa8gcr5G9/3D-Bike-Valve-Stem-App);
the architecture has been rebuilt around the project guidelines.

## Architecture

| Layer          | Tech                                             |
| -------------- | ------------------------------------------------ |
| Client UI      | Vanilla JS + Tailwind v4 (no React, no GraphQL)  |
| Client graphics| [SVG.js](https://svgjs.dev) — all valve-stem rendering |
| Transport      | socket.io with a two-way command pattern (no REST) |
| Server         | Node.js 20 + Express (static assets + socket.io + Stripe webhook) |
| 3D generation  | Python + Microsoft TRELLIS, spawned per request  |
| Mesh compositing| [trimesh](https://trimesh.org) — fuses head onto `server/assets/valve_cap.stl` |
| Payments       | Stripe Checkout ($2 STL, $19.99 print, $59.99 pack of 4) |
| Database       | Digital Ocean Managed PostgreSQL 18              |

### Two-way command pattern

A single socket event `"command"` carries every request and response:

```js
// Client → Server
socket.emit('command', { id, name: 'stl.generate', payload: { imageData, settings } });

// Server → Client (replies correlated by id)
socket.emit('command', { id, name: 'stl.generate.progress', payload: { step, pct } });
socket.emit('command', { id, name: 'stl.generate.result',   payload: { designId, triangles } });
socket.emit('command', { id, name: 'stl.generate.error',    payload: { error } });
```

Handlers live under `server/commands/`. The only non-socket HTTP surface is
`POST /stripe/webhook` — Stripe requires a signed HTTP POST to deliver
payment events.

### STL generation pipeline

```
 client (photo base64)
        │
        ▼
 socket "stl.generate" command
        │
        ▼
 server/commands/stl.js
        │  spawns
        ▼
 server/workers/trellis_generate.py
        │  1. load TRELLIS pipeline (GPU)
        │  2. photo → head mesh (trimesh)
        │  3. load server/assets/valve_cap.stl (base geometry; unchanged)
        │  4. scale head to valve top diameter × head_scale
        │  5. translate head above stem by neck_length/2
        │  6. rotate by head_tilt°
        │  7. concatenate meshes → export ASCII STL
        │
        ▼
 designStore.save({ id: uuid, stl: bytes })
        │
        ▼
 client receives { designId, triangles }
```

The STL itself is **not** returned to the client at generation time. It sits
server-side until the client completes Stripe Checkout.

### Paywall flow

```
 client: payments.createCheckoutSession({ product: 'stl_download', designId })
    → server creates Stripe Checkout Session, records pending purchase
    → client redirects to session.url (hosted Stripe page)
 user pays on stripe.com
    → Stripe redirects to /checkout/return?session_id=cs_xxx
    → client: payments.verifySession({ sessionId })
         → server hits Stripe API, flips purchase → 'paid'
         → server returns { paid: true, design: { stl, filename } }
    → client downloads the STL as a Blob
```

Stripe webhooks (`/stripe/webhook`) provide redundant, out-of-band confirmation
so payments are persisted even if the browser never returns to the success URL.

## 12-factor compliance

| Factor                         | Implementation                                           |
| ------------------------------ | -------------------------------------------------------- |
| III. Config in env             | `PORT`, `DATABASE_URL`, `STRIPE_*`, `TRELLIS_*`, `APP_URL`… |
| IV. Backing services           | `DATABASE_URL` points at DO Managed Postgres, Stripe via `STRIPE_SECRET_KEY` |
| V. Build, release, run         | `npm run build` → `npm start`; release = `npm run migrate` |
| VI. Stateless processes        | Generated STLs + purchases live in Postgres, not in memory |
| VII. Port binding              | Server listens on `process.env.PORT`                     |
| IX. Disposability              | SIGTERM/SIGINT drain socket.io, pg pool, expiry job      |
| XI. Logs as event streams      | Structured JSON lines to stdout via `server/logger.js`   |
| XII. Admin processes           | `server/migrate.js` runs migrations in-environment       |

## Running locally

### 1. Install Node dependencies

```bash
cp .env.example .env           # fill in DATABASE_URL, STRIPE_SECRET_KEY, etc.
npm install
npm run migrate                # optional — falls back to in-memory mode without a DB
```

### 2. Install TRELLIS (optional but required for real 3D)

```bash
git clone https://github.com/Microsoft/TRELLIS.git
cd TRELLIS
./setup.sh --new-env --basic --flash-attn --diffoctreerast --spconv --mipgaussian --kaolin --nvdiffrast
# ↑ follow upstream instructions; needs a CUDA GPU, PyTorch, etc.
cd ..
pip install -r server/workers/requirements.txt    # numpy, pillow, trimesh
```

Point `TRELLIS_PATH` in `.env` at the cloned repo (`./TRELLIS` or
`./TRELLIS-main`). Without a GPU, set `TRELLIS_ENABLED=false` to use the
procedural fallback head — the rest of the pipeline still exercises end-to-end.

### 3. Configure Stripe

1. Create a Stripe account and grab a test secret key (`sk_test_…`).
2. Run `stripe listen --forward-to localhost:3000/stripe/webhook` to get a
   webhook signing secret, copy it into `STRIPE_WEBHOOK_SECRET`.
3. Set `STRIPE_SECRET_KEY=sk_test_…` in `.env`.
4. Optional: adjust `STRIPE_PRICE_STL_CENTS` (default `200` = $2).

### 4. Boot

```bash
npm run dev                    # Vite on :5173, API on :3000 (socket.io proxied)
```

Visit http://localhost:5173. Upload a photo, click **Generate**, then **Buy STL
· $2**. Use Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC.

## Production build

```bash
npm run build                  # emits dist/
npm start                      # node server/index.js — serves dist + socket.io on $PORT
```

## Deploying to Digital Ocean App Platform

1. Push this repo to GitHub and fill in `services[0].github.repo` in
   `.do/app.yaml`.
2. Create the App:
   ```bash
   doctl apps create --spec .do/app.yaml
   ```
3. The spec attaches a Managed PostgreSQL 18 cluster as component `db`;
   `DATABASE_URL` is injected automatically.
4. In the DO dashboard, bind `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
   as **Secret** env vars.
5. The `migrate` PRE_DEPLOY job runs `node server/migrate.js` before each
   release goes live.
6. Add `https://<your-app>.ondigitalocean.app/stripe/webhook` as a webhook
   endpoint in the Stripe Dashboard. Subscribe to at least
   `checkout.session.completed`, `checkout.session.expired`,
   `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`.

### TRELLIS in production

Digital Ocean App Platform does not currently offer GPU instance sizes, so
the default `.do/app.yaml` ships with `TRELLIS_ENABLED=false` — the server
will emit a procedural placeholder head. To enable real 3D generation either:

- Spin up a GPU Droplet (e.g. NVIDIA H100) with TRELLIS pre-installed and
  expose a small HTTP worker. Update `server/commands/stl.js` to call that
  worker instead of spawning the local Python script.
- Or deploy this app directly onto a GPU-capable runtime (Paperspace, Lambda
  Labs, RunPod) with Python + CUDA in the image. Keep `TRELLIS_ENABLED=true`
  and set `PYTHON_BIN`/`TRELLIS_PATH` to point at the installed interpreter.

## Project layout

```
.
├── client/                       Vanilla JS front-end (SVG.js + Tailwind)
│   ├── main.js                   Entry: mounts header + router
│   ├── router.js                 History-API router with query parsing
│   ├── socket.js                 socket.io client with command-pattern helpers
│   ├── dom.js                    Hyperscript element helper
│   ├── icons.js                  Inline SVG icon set (replaces lucide-react)
│   ├── components/
│   │   ├── header.js
│   │   └── valve-stem-viewer.js  SVG.js-powered 3D-style valve viewer
│   ├── pages/
│   │   ├── home.js               Photo → STL generator
│   │   ├── how-it-works.js
│   │   ├── pricing.js            Stripe pricing tiers
│   │   ├── checkout-return.js    Post-payment verification + STL download
│   │   └── account.js
│   └── styles/                   Tailwind v4 + theme
├── server/                       Node.js backend
│   ├── index.js                  Express + socket.io bootstrap, Stripe webhook
│   ├── logger.js                 JSON stdout logger
│   ├── db.js                     pg Pool (DATABASE_URL)
│   ├── design-store.js           STL persistence (Postgres ↔ memory fallback)
│   ├── stripe-client.js          Stripe SDK factory + pricing catalogue
│   ├── migrate.js                admin process
│   ├── commands/                 socket.io command handlers
│   │   ├── index.js              dispatcher
│   │   ├── stl.js                spawns the TRELLIS worker, persists designs
│   │   ├── payments.js           createCheckoutSession + verifySession
│   │   ├── designs.js
│   │   ├── orders.js
│   │   ├── account.js
│   │   └── events.js
│   ├── workers/
│   │   ├── trellis_generate.py   Python: TRELLIS → trimesh → STL merge
│   │   └── requirements.txt      numpy, pillow, trimesh
│   ├── assets/
│   │   └── valve_cap.stl         Base valve-cap geometry (never scaled)
│   └── migrations/               001_initial, 002_designs_and_purchases
├── .do/app.yaml                  Digital Ocean App Platform spec
├── Procfile                      release + web process declarations
├── .env.example                  config template (12-factor §3)
├── index.html                    static shell
├── vite.config.js                Vite build config
└── package.json
```
