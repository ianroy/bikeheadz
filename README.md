# 3D Bike Valve Stem App

BikeHeadz turns a portrait photo into a 3D-printable Presta valve stem cap.
The visual interface is preserved from the original Figma-made design
(https://www.figma.com/design/kXNX9EMUVdydwPa8gcr5G9/3D-Bike-Valve-Stem-App);
the underlying architecture has been rebuilt around the project guidelines.

## Architecture

| Layer          | Tech                                             |
| -------------- | ------------------------------------------------ |
| Client UI      | Vanilla JS + Tailwind v4 (no React, no GraphQL)  |
| Client graphics| [SVG.js](https://svgjs.dev) — all valve-stem rendering |
| Transport      | socket.io with a two-way command pattern (no REST) |
| Server         | Node.js 20 + Express (static assets + socket.io) |
| Database       | Digital Ocean Managed PostgreSQL 18              |

### Two-way command pattern

A single socket event `"command"` carries every request and response:

```js
// Client → Server
socket.emit('command', { id, name: 'designs.list', payload: {} });

// Server → Client (replies are correlated by id)
socket.emit('command', { id, name: 'designs.list.result', payload: [...] });
socket.emit('command', { id, name: 'stl.generate.progress', payload: { step, pct } });
socket.emit('command', { id, name: 'designs.list.error',   payload: { error } });
```

Handlers live under `server/commands/`. The client helper in
`client/socket.js` exposes `socket.request(name, payload, { onMessage })` which
returns a promise resolved by the matching `*.result` message and forwards
`*.progress` frames to `onMessage`.

## 12-factor compliance

| Factor                         | Implementation                                           |
| ------------------------------ | -------------------------------------------------------- |
| III. Config in env             | `PORT`, `DATABASE_URL`, `DATABASE_SSL`, `LOG_LEVEL`, ... |
| IV. Backing services           | `DATABASE_URL` points at DO Managed Postgres             |
| V. Build, release, run         | `npm run build` → `npm start`; release = `npm run migrate` |
| VI. Stateless processes        | Session state lives in Postgres, not in memory           |
| VII. Port binding              | Server listens on `process.env.PORT`                     |
| IX. Disposability              | SIGTERM/SIGINT gracefully drain socket.io + pg pool      |
| XI. Logs as event streams      | Structured JSON to stdout via `server/logger.js`         |
| XII. Admin processes           | `server/migrate.js` runs migrations in-environment       |

## Running locally

```bash
cp .env.example .env           # adjust DATABASE_URL if needed
npm install
npm run migrate                # optional; works without a DB too (falls back to in-memory data)
npm run dev                    # starts Vite on :5173 + API on :3000, with socket.io proxy
```

Visit http://localhost:5173.

## Production build

```bash
npm run build                  # emits dist/
npm start                      # node server/index.js, serves dist + socket.io on $PORT
```

## Deploying to Digital Ocean App Platform

1. Push this repo to GitHub and fill in `github.repo` in `.do/app.yaml`.
2. Create the App:
   ```bash
   doctl apps create --spec .do/app.yaml
   ```
3. The spec attaches a Managed PostgreSQL 18 cluster as component `db`.
   `DATABASE_URL` is injected into the web and migrate services automatically.
4. The `migrate` PRE_DEPLOY job runs `node server/migrate.js` before each
   release goes live.

Environment variables (set by the platform):

- `PORT` — supplied by DO; the server binds to it.
- `DATABASE_URL` — supplied from the attached managed DB.
- `DATABASE_SSL=true` — required by DO Managed Postgres.

## Project layout

```
.
├── client/                    Vanilla JS front-end (SVG.js + Tailwind)
│   ├── main.js                Entry: mounts header + router
│   ├── router.js              Minimal History-API router
│   ├── socket.js              socket.io client with command-pattern helpers
│   ├── dom.js                 Tiny hyperscript-style element helper
│   ├── icons.js               Inline SVG icon set (replaces lucide-react)
│   ├── components/
│   │   ├── header.js
│   │   └── valve-stem-viewer.js   SVG.js-powered 3D-style valve viewer
│   ├── pages/
│   │   ├── home.js
│   │   ├── how-it-works.js
│   │   └── account.js
│   └── styles/                Tailwind v4 + theme
├── server/                    Node.js backend
│   ├── index.js               Express + socket.io bootstrap
│   ├── logger.js              JSON stdout logger
│   ├── db.js                  pg Pool (DATABASE_URL)
│   ├── migrate.js             admin process
│   ├── commands/              socket.io command handlers
│   └── migrations/            SQL files applied by migrate.js
├── .do/app.yaml               Digital Ocean App Platform spec
├── Procfile                   release + web process declarations
├── .env.example               config template (12-factor §3)
├── index.html                 static shell
├── vite.config.js             Vite build config
└── package.json
```
