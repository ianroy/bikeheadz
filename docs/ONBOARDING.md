# Engineer Onboarding — StemDomeZ

> Welcome. Read this once, then bookmark
> [`CLAUDE.md`](../CLAUDE.md) and
> [`ProductSpec.md`](../ProductSpec.md) — those are your daily
> references. This file gets you from cold start to first commit;
> the others tell you why anything is the way it is.
>
> Tone: this codebase is documented in plain, occasionally grumpy
> prose. The grumpy bits are war stories — every "do not change this"
> warning was earned. Treat them as load-bearing.

---

## 0. Two-minute project tour

**StemDomeZ** turns a portrait photo into a 3D-printable Schrader-thread
bike valve cap with the user's head on top. Live at
[stemdomez.com](https://stemdomez.com). Built for the Gumball Machine
Takeover residency at Sadie's Bikes (Great Falls, MA).

Three tiers, one repo:

| Tier | Where it lives | Tech |
|---|---|---|
| **Client SPA** | `client/` | Vanilla JS via Vite. Hyperscript `el()` builder. No JSX, no React, no framework. Tailwind v4 utilities. Three.js viewer. socket.io-client. |
| **Node server** | `server/` | Node 22 + Express + socket.io + Helmet CSP. Single `'command'` event protocol. Postgres 18. |
| **GPU worker** | `handler.py` + `server/workers/pipeline/` | Python on RunPod Serverless. TRELLIS image-to-3D + 8-stage CAD. Two regions (US + RO) raced in parallel. |

There is no REST. There are no webhooks (Stripe verifies on redirect-return).
There is one socket.io `'command'` event surface; everything else is a
command name. This is deliberate.

Visual orientation:

- [`docs/system-architecture.svg`](./system-architecture.svg) — the four-tier picture
- [`docs/multi-region-race.svg`](./multi-region-race.svg) — how we pick a GPU
- [`docs/pipeline.svg`](./pipeline.svg) — the eight pipeline stages
- [`docs/data-flow.svg`](./data-flow.svg) — what happens to the photo bytes
- [`docs/user-journey.svg`](./user-journey.svg) — what the rider sees
- [`docs/gumball-takeover.svg`](./gumball-takeover.svg) — the residency context

---

## 1. Local setup

### 1.1 Prerequisites

- **Node 22.x** (matches `engines.node` in `package.json`). Use `nvm` or `fnm`.
- **Python 3.11+** for the local pipeline fallback (you can skip this if
  you're routing to a real RunPod endpoint via env vars).
- **Postgres 18** locally OR access to a managed instance OR none — the
  server boots in-memory if no `DATABASE_URL` is set.
- **A HuggingFace account that has accepted the TRELLIS-image-large
  license** at <https://huggingface.co/microsoft/TRELLIS-image-large>.
  Without this, the GPU worker can never download model weights and
  will silently produce nothing. Read that sentence twice.

### 1.2 Clone + install

```bash
git clone https://github.com/ianroy/bikeheadz.git
cd bikeheadz
npm install                                          # client + server JS deps
pip install -r server/workers/requirements.txt        # pipeline Python deps (numpy, pillow, trimesh, pymeshfix, ...)
```

### 1.3 Environment

```bash
cp .env.example .env
```

Edit `.env`. Bare-minimum entries to boot:

```
AUTH_SECRET=<32+ bytes — `openssl rand -hex 32` works>
SHARE_LINK_SECRET=<another 32+ bytes>
RESEND_API_KEY=<your Resend API key, or omit and watch console for devUrl magic links>
```

For real GPU work, also set one of:

```
# Single-region path (legacy, works fine for dev)
RUNPOD_ENDPOINT_URL=https://api.runpod.ai/v2/<your-endpoint-id>
RUNPOD_API_KEY=<your bearer token>

# OR multi-region race (production posture)
RUNPOD_ENDPOINT_URLS=https://api.runpod.ai/v2/<us-id>,https://api.runpod.ai/v2/<ro-id>
RUNPOD_API_KEY=<bearer; account-wide; same key both regions>
```

For the no-GPU local dev loop, set `TRELLIS_ENABLED=false` in `.env`
and the local Python worker will return a procedural placeholder head
so you can exercise the rest of the flow without a GPU.

The full env-var matrix is in
[`ProductSpec.md §8`](../ProductSpec.md#8-environments--configuration) —
two tables, every variable, what's required, default, what breaks
when it's missing. Don't memorise it; bookmark it.

### 1.4 Database (optional but recommended)

```bash
createdb stemdomez
DATABASE_URL=postgresql://localhost/stemdomez DATABASE_SSL=false npm run migrate
```

Migrations are idempotent and live at `server/migrations/NNN_*.sql`.
The server applies them on every boot via the migrate-on-boot hook
in `server/index.js`, so you can also just boot and let it migrate.

### 1.5 Boot

```bash
npm run dev
```

That spins up Vite on `:5173` and the Node API on `:3000` with the
socket.io and `/health` proxies wired in `vite.config.js`. Open
**<http://localhost:5173>** and you should see the landing page.

If something is wrong, the most useful first move is:

```bash
LOG_LEVEL=debug npm run dev
```

…and tail the Node side. We log structured JSON (`logger.info({...})`)
which `jq` will pretty-print if you pipe it through.

---

## 2. Your first commit (the 30-minute walkthrough)

Goal: add a trivial socket command that the client can call. By the
end of this section you will have touched the client, the server, the
command registry, and the build/test loop.

### 2.1 Add a server command

Create `server/commands/hello.js`:

```js
// Minimal example command. Lives in the registry; client calls it via
// socket.request('hello.greet', { name: 'World' }).
export const helloCommands = {
  'hello.greet': async ({ socket: _socket, payload }) => {
    const name = (payload?.name || 'world').slice(0, 64);
    return { greeting: `hello, ${name}` };
  },
};
```

Wire it into `server/commands/index.js` (the auto-register):

```js
import { helloCommands } from './hello.js';
// ...
const ALL_COMMANDS = {
  ...stlCommands,
  ...helloCommands,   // ← add
  // ...
};
```

### 2.2 Call it from the client

Anywhere in the client (e.g. as a console-poke from `client/main.js`):

```js
window.__socket.request('hello.greet', { name: 'Sadie' }).then(console.log);
// → { greeting: "hello, Sadie" }
```

### 2.3 Verify

```bash
npm run dev
# open the page, open devtools, paste the line above into the console
```

If you see `{ greeting: "hello, Sadie" }`, you've successfully added a
new command. Delete the file before committing — this was just to
prove the loop.

---

## 3. Common tasks

### 3.1 Add a new admin tab

1. Add a server command for the data: `server/commands/admin.js` →
   `'admin.metrics.<your-thing>'` gated by `requireAdmin({ socket })`.
2. Add the tab id to the `renderTabs` list at the top of
   `client/pages/admin.js`.
3. Add the dispatch line to `renderContent()` so your tab id maps
   to a render function.
4. Write `renderYourThing()` — use `card`, `simpleTable`, `makeChart`,
   `statBox`, `rangeSelector`, `chartTheme` from elsewhere in
   `admin.js`. Don't reinvent.
5. If your data depends on a date range, add to `loadAndRender()`'s
   `Promise.all` so it refetches on range change.
6. Otherwise add to `loadInitial()`'s `Promise.all` and stash on
   `state.<yourThing>`.

The Regions tab (commit
[`8ed91fa`](https://github.com/ianroy/bikeheadz/commit/8ed91fa)) is a
clean reference implementation with both a chart and a table.

### 3.2 Add a new client page (route)

1. Create `client/pages/your-page.js` exporting `YourPage({ socket })`
   that returns `{ el, destroy? }`. The `el` is what gets mounted;
   `destroy()` runs on the way out for any cleanup (WebGL teardown,
   IntersectionObserver disconnect, in-flight aborts).
2. Add `'/your-page': () => YourPage({ socket })` to the `routes`
   object in `client/main.js`.
3. Add a header nav link in `client/components/header.js` if you want
   it in the global nav.
4. Add a footer link in `client/components/site-footer.js` if it
   belongs in the Product/Help/Legal columns.

Style conventions: pinned-light pages use `class: 'sdzr-bg-paper-soft'`
+ inline `var(--sdzr-*)` tokens (NOT theme `var(--ink)` — those flip
in dark mode and break the page; see CLAUDE.md). Operator-style pages
follow brandstandards.MD §17 (beige cards on cream).

### 3.3 Bump the GPU handler

1. Edit `handler.py` → bump `HANDLER_VERSION = "v0.1.X"`. The version
   banner that prints at module load is the only honest source of
   "what's actually running." Trust it more than the dashboard.
2. Make your code change, commit + push to main.
3. **Claude Code does the next step automatically** — fires
   `gh release create vX.Y.Z` per the convention recorded in
   `~/.claude/projects/.../memory/feedback_runpod_release_dance.md`
   and copied into [`CLAUDE.md`](../CLAUDE.md) Touchstones. If a
   human is doing it manually:

   ```bash
   gh release create v0.1.X --target main \
     --title "v0.1.X — <short summary>" \
     --notes "$(cat <<'EOF'
   <release notes>
   EOF
   )"
   ```

4. Wait ~17–25 min for GHA to build the GHCR image
   (`gh run watch <id> --exit-status` in the background is the move).
5. Roll **both** RunPod regions to the new tag via the dashboard:
   Manage → New Release → paste `ghcr.io/ianroy/bikeheadz:v0.1.X` →
   confirm boot banner. There is no API for serverless endpoint
   releases. We checked.
6. Smoke-test one generation through the production site, watch the
   `[stage*]` log lines.

### 3.4 Debug a failing RunPod job

1. Get the worker ID from the user (or DO logs — `runpod.race_winner`
   or `runpod.warmup_routing` will have it).
2. RunPod dashboard → endpoint → Requests tab → find the worker ID →
   Logs.
3. Look for the `[stage*]` warning lines. `assert_printable` failures
   are routine and ship anyway. `PipelineError` exceptions kill the
   job; the auto-retry covers some classes (thin walls, NECK_NOT_FOUND).
4. The failure corpus on the network volume
   (`/runpod-volume/failures/<yyyymmdd>/<jobId>/`) holds the input
   image + intermediate STLs for replay. Surfaces in `/admin` →
   Failures tab.
5. If the issue is reproducible, drop the input photo into your
   local dev loop with `RUNPOD_ENDPOINT_URL` pointing at a dev
   endpoint and iterate.

### 3.5 Add or modify a feature flag

Three flags drive the launch posture
(`payments_enabled`, `printing_enabled`, `aaa_toggle_enabled`). They
live in the `feature_flags` table (migration `004`) and are resolved
through a 30-second-cached helper in `server/app-config.js`.

To add a new one:

1. Add the row in a new migration: `INSERT INTO feature_flags (key,
   value, …) VALUES ('your_flag', false, …)`.
2. Add a getter to `server/app-config.js` that reads it.
3. Surface a toggle in `/admin` → Overview → MVP launch toggles.
4. Make sure both Node and client read it through the same cached
   helper so flips propagate consistently.

---

## 4. Conventions

### 4.1 Code

- **No comments on what.** Code with good names already says what.
  Comment on **why** — non-obvious constraints, hidden invariants,
  workarounds for specific bugs (with bug context), trade-off rationale.
- **Tone.** Direct, slightly grumpy, war-story-aware. Treats the
  reader as a peer who has also seen things. Examples in stages.py,
  handler.py, runpod-client.js.
- **No premature abstractions.** Three similar lines beats a poorly-
  designed helper. Six similar lines is the threshold for refactor.
- **Pinned brand colours.** `var(--sdzr-*)` for surfaces that are
  pinned-light (e.g. anywhere using `sdzr-bg-paper*`). `var(--ink)`
  flips in dark mode and will produce cream-on-cream on those
  surfaces. We've shipped this bug. We are not shipping it again.

### 4.2 Git

- **Commit straight to `main`.** No PRs during the MVP push. The
  no-PR posture is recorded in
  `~/.claude/projects/.../memory/feedback_direct_to_main.md`.
- **`--no-verify` is approved** for the pre-commit hook (`npx
  lint-staged`) when npm isn't installed on the workstation.
- **Bigger commits get long messages.** Title is the imperative one-
  liner; body explains the why. Examples in recent git history.

### 4.3 Docs

- **`CLAUDE.md`** at the repo root is loaded into every Claude Code
  session. Keep it short and load-bearing. Don't duplicate
  ProductSpec content in it; cross-link.
- **`ProductSpec.md`** is the canonical reference. The env-var matrix
  lives there (§8), never in README.
- **`docs/`** holds the playbook + the SVG diagram suite + this
  onboarding guide.
- **Brand standards** are in `brandstandards.MD` at the repo root.
  Read §11 (don't put fluoro green on cream) and §14 (pinned literals)
  before any UI work.

---

## 5. Where the bodies are buried

Things that look weird but are correct, with the reason:

- **Stage 1.5 + 1.7 are both in the pipeline.** Pymeshlab's
  close-holes is best-effort and TRELLIS routinely produces meshes
  with euler < -20. PyMeshFix is the topology hammer that actually
  guarantees watertight. We need both — pymeshlab is fast and good
  at small holes, PyMeshFix is slow and good at everything.
- **Stage 6 splits the mesh and only repairs the largest component.**
  Otherwise PyMeshFix occasionally decides the cap's threading is
  "messy" and deletes it. We learned this in v0.1.39. The cap is a
  hand-tuned watertight asset that ships with the image. Don't ever
  let it go through topology repair.
- **`return_aggregate_stream=False`** is a hard requirement on the
  RunPod handler. The default `True` aggregates frames into one
  response, which RunPod then rejects for being over the 1 MB
  per-request cap. We learned this five releases in a row.
- **node-postgres returns BIGINT as a string by default.** Cast both
  sides to `Number()` when comparing user ids. The legacy bug history
  is in commit `1237da7`.
- **Migrations on boot, not just PRE_DEPLOY.** DO's PRE_DEPLOY job
  doesn't fire on the first deploy of a new app. The boot-time hook
  catches that case + every restart.
- **Pinned literal hex on dark/cream surfaces.** Theme tokens flip in
  dark mode. Pinned `--sdzr-*` tokens do not. Mix them on a pinned
  surface and you get invisible cream-on-cream text. (We have shipped
  this. Twice.)
- **No PR workflow during MVP push.** Commit straight to main. There's
  a memory file recording this is the owner's explicit ask.
- **Stripe webhooks are off.** Verification happens on the user's
  redirect-return via `payments.verifySession`. Saves us a moving
  part during launch; we'll revisit if subscription tiers happen.

---

## 6. What to read next

In order:

1. **[`CLAUDE.md`](../CLAUDE.md)** — operating conventions for AI + human contributors. Short, load-bearing.
2. **[`ProductSpec.md`](../ProductSpec.md)** — full architecture, request lifecycles, env-var matrix.
3. **[`brandstandards.MD`](../brandstandards.MD)** — design system. Read §11 + §14 before touching UI.
4. **[`docs/RUNPOD_TRELLIS_PLAYBOOK.md`](./RUNPOD_TRELLIS_PLAYBOOK.md)** — production gotchas, the hardest-won knowledge in the codebase.
5. **[`3D_Pipeline.md`](../3D_Pipeline.md)** — the 8 pipeline stages in CAD detail. Read this before changing `stages.py`.
6. **[`docs/CHANGELOG.md`](./CHANGELOG.md)** — recent ship-history.
7. **[`FEATUREROADMAP_workplan.md`](../FEATUREROADMAP_workplan.md)** — what's next.
8. **The SVG suite** in `docs/` — six diagrams covering technical and non-technical aspects.

---

## 7. Getting unstuck

- **Pipeline error you don't recognise?** Search the codebase for the
  error code (e.g. `NECK_NOT_FOUND`) — it'll be in `errors.py` with
  the user-facing message and the auto-retry policy if any.
- **`/admin` not loading data?** Open the network tab; `admin.metrics.*`
  commands are gated by `requireAdmin`. Confirm your account has
  `role='admin'` (set by `ADMIN_EMAILS` env at boot).
- **socket.io reconnect storm?** Check `client/socket.js` — there's a
  bounded backoff. If you see infinite retries, the server probably
  rejected the connection (CORS, auth-token mismatch).
- **Production GPU returning weird outputs?** Look at the handler
  `[stage*]` warning lines. `[stage6]` will tell you if PyMeshFix
  found anything multi-shell, and the `multi-shell input` line tells
  you stage 4 fell back to concat — usually means the head wasn't
  watertight enough going into the booleans.

If you've spent more than 30 minutes on something without progress,
ask. The memory directory at
`~/.claude/projects/-Users-ianroy-...-bikeheadz/memory/` is the
durable knowledge bank — feedback files there capture past decisions
and recurring patterns.

Welcome to the workshop. Don't break the cap geometry.
