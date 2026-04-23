# BikeHeadz — Feature Roadmap & Agent Workplan

> **Living document.** Agents are expected to mutate this file as they work.
> Humans are expected to read it before starting, and to append notes on
> decisions that matter for the next person.
>
> This file is designed to be **context-window safe**: no task assumes the
> reader has memorised the rest of the document. Work one task at a time,
> write back your notes, stop.

---

## 0. State header — the only thing a new agent must read first

> Always update this section at the end of a session. Treat it as the
> pointer into the file.

```yaml
state:
  file_version: 1
  last_touched: 2026-04-23
  last_agent: claude-opus-4.7
  repo_sha: 8f1f324                      # most recent commit known to the last agent
  active_phase: 0                        # the phase being worked right now
  in_progress_tasks: []                  # ids (e.g. [P0-001]) currently [~]
  blocked_tasks: []                      # ids currently [!] — see task notes for reason
  next_suggested_task: P0-001            # agents should pick this up unless the user says otherwise
  pause_reason: null                     # "context-window-limit" | "awaiting-decision" | null
```

Legend for checkbox states:

| Mark  | Meaning                                           |
| ----- | ------------------------------------------------- |
| `[ ]` | Not started                                       |
| `[~]` | In progress (exactly one agent should hold this)  |
| `[x]` | Done and merged to `main`                         |
| `[!]` | Blocked — reason captured in **Agent notes**      |
| `[?]` | Needs product / design input before it can start  |

---

## 1. How to use this file

### For humans
- Start at the State header. Find the `next_suggested_task`. Open it.
  Everything you need to make a decision is in that task's block.
- If you complete or advance a task, append a dated **Agent note** — never
  overwrite older notes.
- When in doubt, run the **Execution prompt** in section 3 against a fresh
  AI session. It is self-contained.

### For agents (AI pair programmers)
1. Read section 0 (state header) **only**. If `pause_reason` is set, stop
   and report to the user.
2. Open the task referenced by `next_suggested_task`. Read it in full.
3. Before writing code, check the task's **Depends on** list. If any
   dependency is not `[x]`, either (a) work on the dependency first, or
   (b) mark this task `[!]` with a note explaining why it's blocked.
4. Work the task. Update the checkbox to `[~]` when you start; `[x]` when
   finished; `[!]` if you get stuck.
5. Always append a dated **Agent note** under the task summarising what you
   did, what you deferred, and anything a future agent needs to know.
6. Before handing control back, update the State header: `last_touched`,
   `last_agent`, `repo_sha`, `active_phase`, `next_suggested_task`.
7. Commit the code change and this file in the same commit where possible.

### Pause / resume contract
- Agents **must** stop after at most one task per session unless the user
  explicitly asks for more. That keeps the context window healthy and the
  audit trail per-commit clean.
- If a task is larger than one session, split it into sub-tasks in place
  and mark the parent `[~]` with a breakdown note.

---

## 2. Recursive regeneration prompt (discover new features)

> Paste this into a new AI session when the backlog feels thin or stale.
> The prompt rereads the codebase, reasons about gaps, and *appends* new
> task entries at the bottom of each phase. It does **not** delete or
> reorder existing tasks.

```
You are the BikeHeadz roadmap curator. The product is described in
README.md and ProductSpec.md in this repo. The current backlog is in
FEATUREROADMAP_workplan.md.

Your job: discover additional feature candidates and APPEND them to the
roadmap without disturbing existing content.

Process (execute in order, stop after each phase if the context window
is getting tight — you can be re-invoked to continue):

1. Read the State header in FEATUREROADMAP_workplan.md. Respect the
   `pause_reason`; if non-null, stop and report.
2. Read the full file once. Build a mental index of existing task ids
   (`P{phase}-{NNN}`) so you don't duplicate.
3. Skim README.md and ProductSpec.md to refresh your mental model.
4. Skim the codebase: `server/commands/`, `client/pages/`, `.do/app.yaml`,
   and the two migrations. Note anything obviously missing, hacky, or
   TODO-like.
5. For each phase (0–7), generate 2–4 *new* task candidates that:
   - Fit that phase's Purpose.
   - Do not duplicate an existing task id or intent.
   - Have a concrete acceptance criterion.
   - Declare dependencies using existing task ids where applicable.
6. For each new task, choose the next available id in that phase
   (e.g. if P3-007 is the highest, the next is P3-008).
7. Append the new tasks to the END of that phase's "Tasks" subsection.
   Use the canonical task template from section 4.
8. Do not mark any new task `[~]` or `[x]`. Leave status `[ ]`.
9. Update the State header: set `last_touched`, `last_agent`,
   `repo_sha` (current HEAD), and leave `next_suggested_task` alone
   unless you have a very good reason. Add a one-line summary to the
   CHANGELOG at the bottom.
10. Commit with message:
    "roadmap: regenerate candidates (phases X–Y)"

Guardrails:
- Never invent a task that contradicts the Project Guidelines
  (no REST, no React, socket.io two-way command pattern only).
- Never move an existing task between phases. If you think a task is
  mis-phased, leave it and add a note suggesting re-phasing.
- Do not widen scope. Each task should fit in 1–3 agent-days.
- If the same idea shows up twice while you're generating, keep only
  the better-specified version.

When you're done, print:
  • count of new tasks per phase
  • the new `next_suggested_task` (only change if a dependency flipped)
  • anything you deliberately did NOT add, with a 1-line reason
```

### Heuristics for *quality* candidates

A good feature candidate:

- Names a specific user pain or engineering debt (not "improve UX").
- Has an acceptance criterion you could ship against.
- Lists concrete files or commands you'd touch in notes.
- Includes a cost/effort estimate (S ≤½ day, M 1–2 days, L >2 days).
- Doesn't bundle more than one concern.

---

## 3. Execution prompt (build the next feature)

> Paste this into a new AI session to advance the roadmap by exactly one
> task. The prompt is deliberately narrow — agents that try to do more
> than one task in a sitting tend to over-commit and leave a mess.

```
You are a BikeHeadz build agent. Your job is to execute ONE task from
FEATUREROADMAP_workplan.md end-to-end and then stop.

1. Read FEATUREROADMAP_workplan.md section 0 (State header). If
   `pause_reason` is non-null, stop and report — do not start work.
2. Determine the task to work on:
   - If the user named a task id, use that.
   - Otherwise use `next_suggested_task`.
3. Read the FULL task block (status line + depends on + acceptance +
   implementation notes + agent notes).
4. Check each dependency: open its task block and confirm status `[x]`.
   If any dependency is incomplete, either:
   a. If you have time and it is trivially sized, work that dependency
      first (still only ONE task this session — escalate to the user
      if the graph is tangled).
   b. Else mark the current task `[!]` with a note
      "blocked by P{phase}-{id}", update the State header's
      `blocked_tasks`, and stop.
5. Before coding: post a one-paragraph plan to the user and wait for
   their implicit or explicit go-ahead (if they said "just do it" at
   invocation time, proceed).
6. Implement. Obey house rules:
   - No REST (except `GET /health` and static assets).
   - No React or JSX.
   - Use the command-pattern (`server/commands/`).
   - All config via env vars; update `.env.example` and
     `.do/app.yaml` if you add any.
   - Append-only migrations in `server/migrations/`.
7. Add or update tests if the foundations phase includes them.
8. Update the task block:
   - Flip the status checkbox to `[x]`.
   - Append a dated **Agent note** summarising: what you did, what
     you deferred, any surprises, links to the commit(s).
9. Update the State header:
   - `last_touched` = today's date
   - `last_agent` = your model id
   - `repo_sha` = the new HEAD sha after you commit
   - `active_phase` = the task's phase
   - `in_progress_tasks` = []  (unless you split the task)
   - `next_suggested_task` = the next unblocked `[ ]` task, biased
     toward the same phase when possible
10. Commit with a Conventional-ish subject:
    "feat(P{phase}-{id}): <short description>"
    and a body summarising the acceptance criteria you ticked off.
    Always add `Co-Authored-By: <your model> <noreply@anthropic.com>`.
11. Run `npm run build` (and `npm test` once P0-001 lands). If either
    fails, revert or fix before handing back.
12. Push to origin/main unless the user said otherwise.
13. Report back with: commit sha, the task id, and a 3-bullet summary.

Do not start a second task. Ask the user first.
```

### When the execution prompt should *refuse* to run

- `pause_reason` set
- Task is `[~]` (already in progress)
- Task is `[!]` with no recent note explaining resolution
- Task is `[?]` (needs product input)
- Dependencies are not all `[x]` and none of them are trivially resolvable

---

## 4. Task template (canonical)

```
### [P{phase}-{NNN}] Short imperative title
- **Status**: [ ]
- **Phase**: {0–7}
- **Depends on**: (none) | P0-001, P1-003
- **Unlocks**: P2-001
- **Effort**: S | M | L
- **Owner**: (unassigned) | human | agent
- **Acceptance criteria**:
  - …
  - …
- **Implementation notes**:
  - Paths you'll touch: …
  - Commands/flags: …
  - Known hazards: …
- **Agent notes** (append-only, newest first):
  - _(empty)_
```

Every task MUST have all fields. Leave `_(empty)_` where nothing is known
yet rather than dropping a field.

---

## 5. Phase index

| Phase | Theme                           | Entry criteria                              |
| ----- | ------------------------------- | ------------------------------------------- |
| 0     | Foundations (testing, CI, infra)| — (can start any time)                      |
| 1     | Identity & accounts             | P0-001 lands (we want tests before auth)    |
| 2     | Payments & fulfillment          | P1-003 lands (purchases need a real user)   |
| 3     | AI generation quality           | P0-006 lands (rate-limit protects the GPU)  |
| 4     | Observability & scale           | P0-005 lands (error reporting first)        |
| 5     | Creator ecosystem               | Phase 1 complete                            |
| 6     | i18n & accessibility            | Phase 0 complete                            |
| 7     | Mobile / PWA / native           | Phase 4 complete (scale before breadth)     |

Dependencies between *individual tasks* are declared on each task block;
the table above is a rule-of-thumb for ordering phases, not a hard lock.

---

## 6. Phase 0 — Foundations

**Purpose.** Lock down the quality gates before growing features:
automated tests, CI, error reporting, rate limiting. These unblock the
more consequential later phases where mistakes cost money or reputation.

**Deliverables.** `npm test`, GitHub Actions CI, Sentry, ESLint+Prettier,
a Dockerfile for the GPU worker, and first-pass rate limiting.

### Tasks

### [P0-001] Vitest harness + first unit tests
- **Status**: [ ]
- **Phase**: 0
- **Depends on**: (none)
- **Unlocks**: P0-004, P1-001, P3-001
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `vitest` added as devDependency; `npm test` runs and passes.
  - At least 3 unit tests covering: `server/design-store.js` (in-memory
    path), `server/commands/stl.js::decodeImage` / `sanitizeFilename`,
    `client/dom.js::parseTag` (especially the `\.` escape).
  - A `tests/` or `__tests__` directory convention picked and documented
    in `ProductSpec.md` section 9.
- **Implementation notes**:
  - Prefer Vitest over Jest (native ESM, zero config for our setup).
  - Node + browser envs required — use `vitest.config.js` with
    `environmentMatchGlobs` or separate configs.
  - Server tests can stub `pg` and `child_process`; don't hit Postgres.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P0-002] ESLint + Prettier baseline
- **Status**: [ ]
- **Phase**: 0
- **Depends on**: (none)
- **Unlocks**: P0-004
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `eslint.config.js` with `@eslint/js` recommended + a minimal set of
    rules (no-unused-vars as warn, prefer-const, no-undef).
  - `.prettierrc` with project conventions (2-space indent, single
    quotes, no semicolons? — pick one and document).
  - `npm run lint` and `npm run format` scripts.
- **Implementation notes**:
  - Current codebase uses semicolons + single quotes + 2 spaces — match.
  - Ignore `dist/`, `node_modules/`, `TRELLIS-main/`.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P0-003] Dockerfile for the TRELLIS GPU worker
- **Status**: [ ]
- **Phase**: 0
- **Depends on**: (none)
- **Unlocks**: P3-002
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `docker/trellis-worker.Dockerfile` builds on `nvidia/cuda` base
    image, installs TRELLIS per upstream instructions, exposes an
    HTTP endpoint the Node server can call.
  - README updated with "GPU worker" deployment recipe.
- **Implementation notes**:
  - Do NOT put this in the main app image — DO App Platform has no
    GPU sizes. This is for a GPU Droplet / Paperspace / RunPod.
  - Contract should mirror the current `trellis_generate.py`
    stdin/stdout protocol so the swap in `server/commands/stl.js`
    is one call-site change.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P0-004] GitHub Actions CI (test + build + lint)
- **Status**: [ ]
- **Phase**: 0
- **Depends on**: P0-001, P0-002
- **Unlocks**: (everything benefits)
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `.github/workflows/ci.yml` runs on push + PR.
  - Job matrix: Node 22.
  - Runs `npm ci`, `npm run lint`, `npm test`, `npm run build`.
  - Failing builds block PR merges (branch protection toggle noted
    in README for the repo owner).
- **Implementation notes**:
  - Use `actions/checkout@v4`, `actions/setup-node@v4`.
  - Cache npm via `actions/setup-node`'s built-in cache.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P0-005] Error reporting (Sentry or equivalent)
- **Status**: [ ]
- **Phase**: 0
- **Depends on**: (none)
- **Unlocks**: P4-*
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `@sentry/node` (server) + `@sentry/browser` (client) integrated
    behind a `SENTRY_DSN` env var — disabled when unset.
  - Unhandled promise rejections, socket command errors, and Python
    worker stderr are forwarded.
  - `.env.example` + `.do/app.yaml` updated.
- **Implementation notes**:
  - Wrap `dispatchCommand` catch block with a Sentry capture.
  - Respect PII scrubbing: don't ship photo bytes or STL bodies in
    error frames.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P0-006] Rate-limit stl.generate per socket + per IP
- **Status**: [ ]
- **Phase**: 0
- **Depends on**: (none)
- **Unlocks**: P3-002
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - At most 3 `stl.generate` requests per socket per minute, 10 per IP
    per hour (tunable via env).
  - Exceeding the limit emits `stl.generate.error` with payload
    `{ error: 'rate_limited', retryAfter }`.
  - Persisted across restarts via Postgres (simple sliding-window
    table) or accepted in-memory with the trade-off documented.
- **Implementation notes**:
  - Cheap start: an in-memory Map keyed by socket.id and IP with
    per-minute buckets. Note the limitation in the task's agent note.
  - Real fix: Redis or a Postgres table. Can be a follow-up task.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P0-007] CSP + security headers middleware
- **Status**: [ ]
- **Phase**: 0
- **Depends on**: (none)
- **Unlocks**: (general hardening)
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `helmet` (or hand-rolled headers) configured on Express.
  - CSP allows `self`, `ws:`/`wss:` for socket.io, and `js.stripe.com`
    for Checkout redirects.
  - Manual smoke test in browser devtools confirms no CSP warnings on
    the normal flow.
- **Implementation notes**:
  - Stripe Checkout is a top-level redirect so `frame-src` rules don't
    matter, but Stripe.js would — leave a `connect-src` hole for any
    future inline Elements.
- **Agent notes** (append-only, newest first):
  - _(empty)_

---

## 7. Phase 1 — Identity & accounts

**Purpose.** Replace the hardcoded `account_id = 1` with real users so
everything downstream (purchases, galleries, shipping) has something to
attach to.

**Deliverables.** Passwordless email login, a session cookie, account
scoping on designs and purchases, a minimal account settings flow.

### Tasks

### [P1-001] Magic-link email login
- **Status**: [ ]
- **Phase**: 1
- **Depends on**: P0-001, P0-005
- **Unlocks**: P1-002, P1-003
- **Effort**: L
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - New socket commands: `auth.requestMagicLink({ email })`,
    `auth.consumeMagicLink({ token })`.
  - Postgres table `auth_tokens (token PK, email, expires_at, used_at)`.
  - Email delivered via Resend or Postmark (env-configured).
  - Successful consumption sets a signed HttpOnly cookie.
- **Implementation notes**:
  - Use `jose` or Node's built-in `crypto` for JWT/HMAC signing.
  - Rate-limit `auth.requestMagicLink` to 3/email/hour.
  - Add `EMAIL_FROM`, `RESEND_API_KEY` (or equivalent) env vars.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P1-002] Session middleware for socket.io
- **Status**: [ ]
- **Phase**: 1
- **Depends on**: P1-001
- **Unlocks**: P1-003
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `socket.handshake.auth` or cookie yields a `user_id` on connect.
  - Unauthenticated sockets still work but `socket.data.user` is null.
  - A `auth.whoami` command returns the current user payload.
- **Implementation notes**:
  - Parse the signed cookie with the same secret as P1-001.
  - Write a small `requireAuth` helper that command handlers can call.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P1-003] Scope designs & purchases to the authenticated user
- **Status**: [ ]
- **Phase**: 1
- **Depends on**: P1-002
- **Unlocks**: P2-*, P5-*
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `generated_designs.account_id` populated from `socket.data.user`.
  - `designs.list` / `orders.list` filter by current user (or return
    the demo dataset for anonymous users).
  - `payments.verifySession` refuses to return a design whose
    `account_id` doesn't match the session.
- **Implementation notes**:
  - Migration may not be needed — the column already exists.
  - Be careful with anonymous users: they should still be able to
    generate + download, just not see others' galleries.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P1-004] GDPR data export + account deletion
- **Status**: [ ]
- **Phase**: 1
- **Depends on**: P1-003
- **Unlocks**: (compliance)
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `account.exportData` returns a JSON bundle of the user's profile,
    designs, and purchase history.
  - `account.delete` soft-deletes the user, anonymises purchases,
    and hard-deletes designs.
- **Implementation notes**:
  - Soft-delete pattern: set `accounts.deleted_at`; exclude from all
    reads.
  - Stripe requires retention of payment records for ~7 years —
    anonymise the `customer_email` but keep the row.
- **Agent notes** (append-only, newest first):
  - _(empty)_

---

## 8. Phase 2 — Payments & fulfillment

**Purpose.** Turn the $2 downloadable into a real multi-product business:
printed stems, packs, webhooks for durability, shipping, tax, refunds.

**Deliverables.** Re-enabled printed tiers, Stripe webhook for hard
durability, shipping address capture, print-service integration, refund
command.

### Tasks

### [P2-001] Restore Stripe webhook for payment durability
- **Status**: [ ]
- **Phase**: 2
- **Depends on**: P0-005
- **Unlocks**: (print order flow)
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `POST /stripe/webhook` mounted in `server/index.js` behind a feature
    flag (`STRIPE_WEBHOOK_ENABLED=true`).
  - Signature verified with `STRIPE_WEBHOOK_SECRET`.
  - `checkout.session.completed` flips `purchases.status` to `paid`
    even if the user never returns to `/checkout/return`.
  - `.env.example` + `.do/app.yaml` updated.
- **Implementation notes**:
  - This intentionally *adds back* an HTTP surface that the "no REST"
    guideline would normally forbid. The feature flag keeps the strict
    mode available. Document the tradeoff clearly in ProductSpec.md
    section 11.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P2-002] Re-enable `printed_stem` and `pack_of_4` product tiers
- **Status**: [ ]
- **Phase**: 2
- **Depends on**: P1-003
- **Unlocks**: P2-003, P2-004
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `pricingCatalogue()` in `server/stripe-client.js` re-exports all
    three products.
  - `client/pages/pricing.js` shows three tiles.
  - `HomePage` "Pay & Print" button creates a checkout session with
    product `printed_stem`.
- **Implementation notes**:
  - Copy retained in `client/pages/pricing.js` already under `COPY`.
  - Requires shipping address (next task).
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P2-003] Collect shipping address via Stripe Checkout
- **Status**: [ ]
- **Phase**: 2
- **Depends on**: P2-002
- **Unlocks**: P2-004, P2-005
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Checkout sessions for `printed_stem` / `pack_of_4` include
    `shipping_address_collection.allowed_countries`.
  - Verified session extracts the address and persists it to a new
    column on `purchases` (migration 003).
- **Implementation notes**:
  - `session.customer_details.address` in the verification handler.
  - Consider a separate `shipping_addresses` table if we want
    multiple per account.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P2-004] Integrate a real 3D print-on-demand service
- **Status**: [?]
- **Phase**: 2
- **Depends on**: P2-003
- **Unlocks**: P2-005
- **Effort**: L
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - A `print.submitOrder` command takes a paid purchase id and ships
    the STL + address to a 3D-print vendor API.
  - Vendor-chosen — candidates: Shapeways API, Sculpteo API, CraftCloud.
  - Vendor order id persisted on `purchases`.
- **Implementation notes**:
  - Needs product decision on vendor + SLA.
  - Consider a queue for retries (Phase 4 P4-005).
- **Agent notes** (append-only, newest first):
  - _(empty)_ (marked `[?]` pending vendor pick)

### [P2-005] Order status webhook → `purchases.status`
- **Status**: [ ]
- **Phase**: 2
- **Depends on**: P2-004
- **Unlocks**: (user experience)
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Print vendor's status webhook hits a dedicated endpoint
    (`POST /print/webhook`) behind signed HMAC.
  - Orders surface `Processing → Printing → Shipped → Delivered` in
    the Account page.
- **Implementation notes**:
  - Same feature-flag pattern as P2-001; this is a second HTTP
    surface but narrowly scoped to the print vendor.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P2-006] Stripe Tax for VAT / US sales tax
- **Status**: [ ]
- **Phase**: 2
- **Depends on**: P2-002
- **Unlocks**: (i18n revenue)
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Checkout sessions created with `automatic_tax: { enabled: true }`.
  - Tax breakdown visible on the `/checkout/return` page.
- **Implementation notes**:
  - Requires registering tax settings in the Stripe dashboard first.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P2-007] `payments.refund` admin command
- **Status**: [ ]
- **Phase**: 2
- **Depends on**: P1-002
- **Unlocks**: (support tooling)
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Command refunds a charge by session id, updates
    `purchases.status = 'refunded'`.
  - Gated on an `ADMIN_EMAILS` env var allowlist.
- **Implementation notes**:
  - `stripe.refunds.create({ payment_intent })`.
  - Future: a tiny admin page. Out of scope here.
- **Agent notes** (append-only, newest first):
  - _(empty)_

---

## 9. Phase 3 — AI generation quality

**Purpose.** TRELLIS is the magic. Make it more reliable, cheaper, and
produce better prints.

**Deliverables.** Face detection pre-flight, GPU-worker offload, caching,
multi-seed selection, print-ready checks.

### Tasks

### [P3-001] Face-detection preflight on upload
- **Status**: [ ]
- **Phase**: 3
- **Depends on**: P0-001
- **Unlocks**: (better UX; reduces wasted GPU time)
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Client runs face detection (e.g. `face-api.js` or `mediapipe`)
    on the uploaded image before enabling Generate.
  - If no face is detected, show a clear error and don't send the
    `stl.generate` command.
- **Implementation notes**:
  - Client-side is cheaper but the model adds ~5 MB. Alternative: a
    `image.analyze` command invoking a lightweight server-side model.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P3-002] Swap spawn(python) for HTTP call to a GPU worker
- **Status**: [ ]
- **Phase**: 3
- **Depends on**: P0-003, P0-006
- **Unlocks**: (production TRELLIS)
- **Effort**: L
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `runWorker` in `server/commands/stl.js` can talk to either
    local `spawn` or a remote GPU worker via `TRELLIS_WORKER_URL`.
  - Progress frames identical (client code unchanged).
  - Default `TRELLIS_WORKER_URL=null` → uses local spawn (dev).
- **Implementation notes**:
  - Use chunked HTTP or websockets for progress. WS is closer to the
    socket.io stream we already have.
  - Authenticate the worker with a shared secret (`TRELLIS_WORKER_TOKEN`).
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P3-003] Cache TRELLIS outputs by (photo hash, settings hash)
- **Status**: [ ]
- **Phase**: 3
- **Depends on**: P3-002
- **Unlocks**: (cost savings)
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - New table `trellis_cache (key TEXT PK, stl_bytes BYTEA, created_at)`.
  - `stl.generate` checks for a cache hit before spawning the worker.
  - Hit rate + cost savings logged.
- **Implementation notes**:
  - Key = `sha256(photo_bytes) + sha256(JSON(settings))`.
  - Cache should be short-TTL (30 days) to keep storage bounded.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P3-004] Best-of-N: generate 3 heads, let the user pick
- **Status**: [ ]
- **Phase**: 3
- **Depends on**: P3-002
- **Unlocks**: (quality improvement)
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `stl.generate` accepts `variants: 1 | 3` (default 1).
  - Progress frames include a `variant` field.
  - Client shows thumbnails of all 3; user picks one before checkout.
- **Implementation notes**:
  - Seeds are just `[1, 2, 3]`. Worker loop is trivial.
  - Storage multiplies 3× — rely on P3-003 to amortise.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P3-005] Print-readiness checks in the mesh merge
- **Status**: [ ]
- **Phase**: 3
- **Depends on**: (none)
- **Unlocks**: (reduced print failures)
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - After `trimesh.util.concatenate`, run a basic validity check
    (watertight, consistent winding, minimum wall thickness).
  - Warnings surfaced as `stl.generate.warnings` frames.
- **Implementation notes**:
  - `trimesh` has `is_watertight`, `is_winding_consistent`.
  - Wall thickness needs a ray-cast; can be approximated.
- **Agent notes** (append-only, newest first):
  - _(empty)_

---

## 10. Phase 4 — Observability & scale

**Purpose.** Once money is flowing, we need to see what's happening and
scale horizontally without surprises.

**Deliverables.** Tracing, metrics, CDN, sticky-session scaling, audit
logging.

### Tasks

### [P4-001] Request tracing with `pino` + trace-id propagation
- **Status**: [ ]
- **Phase**: 4
- **Depends on**: P0-005
- **Unlocks**: P4-002
- **Effort**: M
- **Acceptance criteria**:
  - Every socket command has a generated `trace_id` logged on both
    entry and exit; progress frames carry it.
  - Python worker receives the trace id on stdin and echoes it on
    stdout.
- **Implementation notes**:
  - Replace the hand-rolled logger with `pino` (keeps JSON lines,
    adds child loggers with bound context).
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P4-002] Prometheus metrics endpoint
- **Status**: [ ]
- **Phase**: 4
- **Depends on**: P4-001
- **Unlocks**: (Grafana dashboards)
- **Effort**: S
- **Acceptance criteria**:
  - `GET /metrics` exposes counters for: command count by name,
    command error count by name, active sockets, STL generation
    latency histogram, checkout success/failure counters.
- **Implementation notes**:
  - This is another HTTP surface — scope it behind `/metrics` only,
    protected by `METRICS_TOKEN` bearer auth.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P4-003] Sticky sessions for horizontally-scaled socket.io
- **Status**: [ ]
- **Phase**: 4
- **Depends on**: P4-001
- **Unlocks**: (scale-out)
- **Effort**: M
- **Acceptance criteria**:
  - DO App Platform `instance_count > 1` works without users losing
    their socket mid-request.
  - Either configure sticky sessions at the load balancer OR add a
    Redis adapter (`@socket.io/redis-adapter`).
- **Implementation notes**:
  - Redis is the cleaner route; requires a managed Redis add-on in
    `app.yaml`.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P4-004] DO Spaces CDN for static assets
- **Status**: [ ]
- **Phase**: 4
- **Depends on**: (none)
- **Effort**: S
- **Acceptance criteria**:
  - `dist/` uploaded to a DO Spaces bucket on deploy; Express serves
    only the `index.html` and hands the rest off to the CDN.
- **Implementation notes**:
  - Vite already hashes asset filenames so long-cache headers are
    safe.
- **Agent notes** (append-only, newest first):
  - _(empty)_

---

## 11. Phase 5 — Creator ecosystem

**Purpose.** Let users show off, remix, and maybe earn.

### Tasks

### [P5-001] Public gallery of opt-in designs
- **Status**: [ ]
- **Phase**: 5
- **Depends on**: P1-003
- **Effort**: M
- **Acceptance criteria**:
  - `generated_designs.is_public` column (migration NNN).
  - `designs.listPublic` command, paginated.
  - `/gallery` page renders them in a masonry grid (no React — reuse
    `client/dom.js`).
- **Implementation notes**:
  - Moderation is manual for v1. Add a `flag` command for users.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P5-002] Shareable signed URLs for individual designs
- **Status**: [ ]
- **Phase**: 5
- **Depends on**: P5-001
- **Effort**: S
- **Acceptance criteria**:
  - `designs.createShareLink({ designId })` → signed token.
  - `/d/:token` renders a preview (no download, no checkout).
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P5-003] "Remix" a shared design
- **Status**: [ ]
- **Phase**: 5
- **Depends on**: P5-002
- **Effort**: M
- **Acceptance criteria**:
  - On `/d/:token` there is a Remix button that copies settings into
    the user's session and navigates to `/` with a fresh photo
    uploader pre-populated.
- **Agent notes** (append-only, newest first):
  - _(empty)_

---

## 12. Phase 6 — i18n & accessibility

**Purpose.** Ship to the world and to everyone in it.

### Tasks

### [P6-001] Multi-currency pricing
- **Status**: [ ]
- **Phase**: 6
- **Depends on**: P2-002
- **Effort**: M
- **Acceptance criteria**:
  - Visitor's country → automatic currency selection (GBP, EUR, USD).
  - Stripe `currency` in `createCheckoutSession` respects the locale.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P6-002] Translation scaffolding + first locale (es)
- **Status**: [ ]
- **Phase**: 6
- **Depends on**: (none)
- **Effort**: M
- **Acceptance criteria**:
  - `client/i18n/` with `en.json`, `es.json`.
  - A `t(key)` helper used by page components.
  - Header shows a locale switcher.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P6-003] WCAG AA audit + critical-path fixes
- **Status**: [ ]
- **Phase**: 6
- **Depends on**: (none)
- **Effort**: L
- **Acceptance criteria**:
  - `axe-core` CLI run in CI; zero critical failures on Home + Pricing
    + Checkout Return pages.
  - Keyboard path: Tab / Space operates every interactive control.
- **Agent notes** (append-only, newest first):
  - _(empty)_

---

## 13. Phase 7 — Mobile / PWA / native

**Purpose.** Meet users on the device their bike lives next to.

### Tasks

### [P7-001] PWA manifest + service worker
- **Status**: [ ]
- **Phase**: 7
- **Depends on**: P4-004
- **Effort**: M
- **Acceptance criteria**:
  - `manifest.webmanifest` with icon set.
  - Service worker precaches the app shell; runtime-caches Unsplash
    images with `stale-while-revalidate`.
  - Lighthouse PWA score ≥ 90.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P7-002] Native camera capture (getUserMedia)
- **Status**: [ ]
- **Phase**: 7
- **Depends on**: P3-001
- **Effort**: M
- **Acceptance criteria**:
  - HomePage's upload area has a "Use camera" toggle that opens
    `getUserMedia` and captures a frame.
- **Agent notes** (append-only, newest first):
  - _(empty)_

---

## 14. Cross-cutting backlog (unphased)

Tasks that don't belong to any single phase — typically chores or
research. Agents may pick from here only when explicitly directed.

### [X-001] Convert `ATTRIBUTIONS.md` to reflect post-React stack
- **Status**: [ ]
- **Effort**: S
- **Acceptance criteria**:
  - Remove shadcn/ui reference.
  - Add TRELLIS, trimesh, SVG.js, Stripe, Unsplash.
- **Agent notes**: _(empty)_

### [X-002] Research: end-to-end latency budget
- **Status**: [ ]
- **Effort**: S
- **Acceptance criteria**:
  - One-page write-up: where the seconds go in a typical generate →
    checkout → download path; targets for each hop.
- **Agent notes**: _(empty)_

---

## 15. Change log

Agents append one line per session. Most recent at top.

- 2026-04-23 — claude-opus-4.7 — Initial roadmap draft. Seeded phases
  0–7 with 30 tasks; no work executed yet.
