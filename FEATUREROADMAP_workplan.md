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
  file_version: 5
  last_touched: 2026-04-29
  last_agent: claude-opus-4.7
  handler_version: v0.1.34               # GPU worker tag deployed on RunPod
  repo_sha: 1c76a0e                      # HEAD after AA-contrast + viewer IBL + Schrader rebrand
  active_phase: 1                        # gating phase for go-to-market — auth first
  in_progress_tasks: []
  blocked_tasks: []
  next_suggested_task: P1-001            # magic-link login — gates the whole account dashboard chain
  pause_reason: null
  recent_milestones:
    - 2026-04-29 — Roadmap regen pass 2. Audit closed P0-003 (Dockerfile shipped, deviations documented) and P6-003 (manual AA contrast pass landed; CI/axe split out as P6-009). Added 28 new candidate tasks across all phases and cross-cutting (P0-012..015, P1-009..011, P2-014..016, P3-013..015, P4-013..015, P5-007..008, P6-006..009, P7-005..006, X-008..011). See section 15 changelog and docs/DESIGN_DECISIONS.md for verbose decision records.
    - 2026-04-29 — AA contrast + viewer IBL + Schrader rebrand. Brand red bumped #DC2626→#C71F1F, muted gray #8B8278→#6B6157, gold-text #A88735→#7C5E1F, removed Tailwind text-white classes that were rendering invisible on cream. RoomEnvironment IBL added to the 3D viewer (this was THE fix for "metallic looks dark"). Schrader replaces Presta everywhere — the prior copy was wrong.
    - 2026-04-29 — Doc + roadmap regen pass 1 for go-to-market. 37 new tasks across all phases focused on user-facing (account dashboard, photo library, email-the-STL, recovery, referrals) and admin tooling (metrics, user mgmt, design viewer, cost tracking, A/B testing, live ops).
    - 2026-04-29 — Workshop palette UI redesign. Cream + signal-red replaces the dark + lime-green look; viewer lighting overhauled (rim light + warmer ambient); home-page designs gallery removed.
    - v0.1.34 — production end-to-end: TRELLIS → 7-stage pipeline → chunked-yield delivery → Three.js render. The five-version delivery saga is documented in docs/RUNPOD_TRELLIS_PLAYBOOK.md.
    - v1 mesh pipeline shipped (3D_Pipeline.md Phases −1 … 4 done).
    - User-facing sliders live: Crop Tightness, Head Pitch, Head Height, Cap Protrusion.
    - TRELLIS-output cache makes slider-tweak regenerations ~1–2 s on a warm worker.
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
3. Skim README.md and ProductSpec.md and 3D_pipeline.md to refresh your mental model.
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
- **Status**: [x]
- **Phase**: 0
- **Depends on**: (none)
- **Unlocks**: P3-002
- **Effort**: M
- **Owner**: claude-opus-4.7
- **Acceptance criteria**:
  - [x] Dockerfile builds + ships TRELLIS + handler. Path differs
    from the original spec — it lives at repo root as `Dockerfile`
    rather than `docker/trellis-worker.Dockerfile`, because RunPod
    Hub's auto-detection expects it there. Base is
    `pytorch/pytorch:2.4.0-cuda12.1-cudnn9-devel` instead of bare
    `nvidia/cuda` — TRELLIS needs the matching torch wheels and the
    pytorch image saves a 12-minute install step.
  - [x] HTTP endpoint exposed via RunPod Serverless `/run` +
    `/stream/<id>` polling (POST + long-poll), not bare HTTP. The
    Node side talks via `server/workers/runpod-client.js`.
  - [x] Deployment recipe documented in `deploy/runpod/README.md`
    plus `docs/RUNPOD_TRELLIS_PLAYBOOK.md` for the production
    gotchas.
- **Implementation notes**:
  - `Dockerfile`, `.runpod/hub.json`, `.runpod/tests.json`,
    `.github/workflows/build-runpod-image.yml` all ship together.
    The full image tag history is in the git release log.
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): Closing this out as part of the
    audit pass. The deliverable shipped at v0.1.30; it took until
    v0.1.34 to land *correctly* (the saga is in
    `docs/RUNPOD_TRELLIS_PLAYBOOK.md`). Path/base deviations from
    the original spec were forced by RunPod Hub's expectations and
    upstream TRELLIS install requirements — both intentional, both
    documented above.

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

### [P0-008] Admin role + `requireAdmin` guard
- **Status**: [ ]
- **Phase**: 0
- **Depends on**: P1-002
- **Unlocks**: P4-005, P4-006, P4-007, P2-012
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `accounts.role` column added (`'user' | 'admin'`, default `'user'`)
    via append-only migration.
  - `requireAdmin({ socket })` helper rejects with `auth_required` /
    `forbidden_admin_only` for non-admin users.
  - `account.update` cannot self-promote to admin (whitelist of
    user-mutable fields enforced server-side).
  - Bootstrap admin via env var `ADMIN_EMAILS` so the first user
    seeded as admin doesn't need a privileged user already to exist.
- **Implementation notes**:
  - Future-proof for `'admin' | 'support' | 'user'` even if we ship
    only two today — store as text, not bool.
  - Pair with P0-009 audit log so privileged actions are traceable.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P0-009] Audit log table + helper
- **Status**: [ ]
- **Phase**: 0
- **Depends on**: (none)
- **Unlocks**: P4-006, P2-007, P2-012
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Migration adds `audit_log (id BIGSERIAL, actor_id, action TEXT,
    target_type TEXT, target_id TEXT, metadata JSONB, created_at)`.
  - `recordAudit({ actor_id, action, target, metadata })` helper
    used by every admin-action command.
  - Admin dashboard later renders this table (P4-006).
- **Implementation notes**:
  - Don't index on `actor_id` until we see traffic; the table can be
    sequential-scanned for the first months.
  - PII discipline: don't log photo bytes or STL contents — only
    SHAs and IDs.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P0-010] Feature-flag table + flag-aware helpers
- **Status**: [ ]
- **Phase**: 0
- **Depends on**: P0-008
- **Unlocks**: staged rollouts (P3-008, P5-001, P2-002)
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `feature_flags (key PK, enabled BOOL, percent INT, allowlist
    JSONB, updated_at)` migration.
  - `isEnabled(key, { user })` helper checks env override → DB row →
    default. Returns boolean or rolls dice based on percent.
  - Admin command `flags.set` (gated by P0-008) flips a flag.
- **Implementation notes**:
  - Cache rows in-process for 30 s to avoid hammering the DB on the
    hot path; invalidate on `flags.set`.
  - Useful for go-to-market: hide "pack of 4" until inventory is
    ready, dark-launch best-of-N (P3-004), etc.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P0-011] RunPod endpoint healthcheck from Node
- **Status**: [ ]
- **Phase**: 0
- **Depends on**: P3-002
- **Unlocks**: cleaner pre-launch readiness checks
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `GET /health` returns `{ ok, runpod: { reachable, latencyMs,
    handlerVersion?, lastChecked } }` when RunPod env is set.
  - `runpod-client.js` exposes `pingEndpoint()` that hits a tiny
    pre-warmed test job (or `/health` once the worker has it) at
    most every 60 s.
  - DO App Platform's healthcheck won't fail on RunPod hiccups —
    surface but don't block.
- **Implementation notes**:
  - Cache the result; do not block /health on a fresh ping.
  - This is what tells us pre-launch whether RunPod is wired up
    correctly without burning a real generate.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P0-012] Schema validation on every command payload
- **Status**: [ ]
- **Phase**: 0
- **Depends on**: P0-001
- **Unlocks**: cleaner errors, defense against malformed input
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Every command handler under `server/commands/` validates its
    `payload` against a schema (zod or @sinclair/typebox — pick
    one) before doing work.
  - Invalid payloads reject with `{ error: 'invalid_payload',
    details: [...] }` and a 400-shaped semantic error frame.
  - `stl.generate` validates: `imageData` size cap (5 MB), known
    MIME prefixes, settings field bounds (e.g.
    `targetHeadHeightMm` 22–42, `cropTightness` 0.40–0.85).
- **Implementation notes**:
  - Today the worker silently clamps out-of-range slider values.
    Validating up front gives better UX *and* catches scripted
    abuse trying to send `headTilt: 9999`.
  - Schemas should live alongside their handlers, not in a
    central registry — keeps the diff radius small per change.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P0-013] Structured error taxonomy (server + client)
- **Status**: [ ]
- **Phase**: 0
- **Depends on**: (none)
- **Unlocks**: P3-007, P2-008, all client-side UX polish
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Single `ErrorCode` enum (server-side, exported) — values like
    `no_face_detected`, `rate_limited`, `payment_required`,
    `runpod_no_result`, `unsafe_image`, `internal_error`.
  - Every `*.error` socket frame carries `{ code, message,
    retryable: bool }` — no more bare `{ error: "string" }`.
  - Client has a copy-table mapping codes → user-facing English
    strings; the inverse from the worker's `pipeline/errors.py`
    `ErrorCode` enum is wired through.
- **Implementation notes**:
  - Saves us from string-matching on `err.message` to decide
    "should I show a banner" vs "should I retry."
  - Required by P3-007 (surface stage warnings) so the client
    can branch on code, not message.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P0-014] Pre-commit hook (lint + format on staged files)
- **Status**: [ ]
- **Phase**: 0
- **Depends on**: P0-002
- **Unlocks**: cleaner PRs, less CI noise
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `husky` + `lint-staged` configured.
  - `npm install` sets up the hook automatically (`prepare`
    script).
  - Staged JS/MD files run `eslint --fix` + `prettier --write`
    before the commit lands.
- **Implementation notes**:
  - Must not run on untouched files (lint-staged handles this);
    full-tree lints belong in CI (P0-004).
  - Document a one-liner bypass for emergency fixes
    (`git commit --no-verify`) in CONTRIBUTING.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P0-015] Database restore drill — verify backups actually work
- **Status**: [ ]
- **Phase**: 0
- **Depends on**: (none)
- **Unlocks**: launch confidence
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - One-page runbook in `docs/DB_RESTORE.md` covering:
    - Where DO Managed Postgres backups live
    - How to clone them to a fork DB
    - How to point the staging app at the fork
    - Expected RTO (recovery time objective)
  - Drill performed at least once before launch; commit captures
    the date + time-to-restore.
- **Implementation notes**:
  - DO ships automated backups but nobody has tested the restore
    path. Untested backup = no backup.
  - Don't restore over production. Always to a fork DB.
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

### [P1-005] Account dashboard — designs gallery + purchase history
- **Status**: [ ]
- **Phase**: 1
- **Depends on**: P1-003
- **Unlocks**: P1-006, P1-008, retention
- **Effort**: L
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `/account` page shows three tabs: **Designs**, **Orders**,
    **Settings**.
  - Designs tab lists every generated_design for the current user
    (with thumbnail, generation date, settings used, paid? flag),
    paginated 12/page.
  - Each row has buttons: **Download STL** (paid only),
    **Re-render with new sliders** (jumps to home with photo
    pre-loaded, P3-010), **Share** (P5-002), **Delete**.
  - Orders tab lists every purchase row joined with the design,
    with Stripe receipt URL and order status.
  - Settings tab edits `accounts.display_name`, `email`, and email
    preferences (P1-007).
- **Implementation notes**:
  - Replace the current placeholder `client/pages/account.js`
    (which uses a hardcoded mock dataset) with a real factory that
    `socket.request('designs.list')` and `socket.request('orders.list')`
    on mount.
  - Orders need a join with `generated_designs` — extend
    `orders.list` to return `{ purchase, design }` pairs.
  - The home page used to host this gallery (removed in the UI
    redesign); this is its new home.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P1-006] Photo library — keep uploaded photos, regenerate on demand
- **Status**: [ ]
- **Phase**: 1
- **Depends on**: P1-005
- **Unlocks**: P3-010 (re-generate from saved photo)
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - New `user_photos (id UUID PK, account_id, image_b64 BYTEA,
    sha256 TEXT, filename, uploaded_at, last_used_at)` migration.
  - On `stl.generate`, persist the photo (deduped by sha256) and
    link the design row to it via `generated_designs.photo_id`.
  - `photos.list` socket command returns recent photos for the
    account (paginated).
  - `/account` Designs tab shows a thumbnail strip of "Your photos"
    above the design grid, click → re-generate with that photo.
  - 90-day TTL with prompt before deletion.
- **Implementation notes**:
  - BYTEA is fine for now (photos are <2 MB). DO Spaces (P4-004) is
    the future home; gate behind a feature flag.
  - Privacy: hash the photo for dedup, don't OCR the EXIF — strip
    GPS/orientation server-side before persisting.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P1-007] Email preferences (transactional + marketing opt-out)
- **Status**: [ ]
- **Phase**: 1
- **Depends on**: P1-001
- **Unlocks**: P2-008, P2-009 (email delivery flows)
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `accounts.email_prefs JSONB` column with shape
    `{ marketing: bool, order_updates: bool, design_reminders: bool }`.
  - Settings tab on /account toggles each.
  - `email.send` helper checks the relevant pref before queuing
    non-transactional mail (transactional bypasses).
  - One-click unsubscribe link in every marketing email (List-
    Unsubscribe header + dedicated landing page).
- **Implementation notes**:
  - Default opts: order_updates=true, design_reminders=true,
    marketing=false (don't auto-enroll; CAN-SPAM/CASL friendly).
  - Use a signed token in the unsubscribe URL so the user doesn't
    need to log in.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P1-008] Profile management — name + avatar
- **Status**: [ ]
- **Phase**: 1
- **Depends on**: P1-005
- **Unlocks**: P5-001 (gallery attribution)
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Settings tab edits `accounts.display_name` (1–40 chars,
    profanity-light filter) and avatar.
  - Avatar is one of: a generated identicon (default), a user-picked
    color from a palette, or one of their generated heads as a
    rendered thumbnail.
  - Header bar shows the avatar + first name when authed.
- **Implementation notes**:
  - Identicon: deterministic from `account_id` so it stays stable
    across sessions.
  - Profanity filter is a simple wordlist; not a moderation system.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P1-009] Passkey / WebAuthn login alongside magic-link
- **Status**: [ ]
- **Phase**: 1
- **Depends on**: P1-001
- **Unlocks**: friction-free return UX
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Account settings exposes "Add a passkey" — registers a
    WebAuthn credential bound to the user's authenticator
    (Touch ID, Windows Hello, hardware key, or platform-bound
    on Android).
  - Login page offers both: "email me a magic link" or "sign in
    with passkey." Magic-link remains for first-time users + lost
    devices.
  - `webauthn_credentials (id PK, user_id, public_key BYTEA,
    sign_count, transports JSONB, added_at)` migration.
- **Implementation notes**:
  - Use `@simplewebauthn/server` and `@simplewebauthn/browser`.
  - Don't drop magic-link — passkey-only locks out users who lose
    every device.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P1-010] Active sessions list + "log out everywhere"
- **Status**: [ ]
- **Phase**: 1
- **Depends on**: P1-002
- **Unlocks**: P4-006 force-logout, support workflow
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Account settings shows the user's currently-active sessions:
    user-agent string, IP city (rough geo), last seen time,
    "is current" flag.
  - "Log out this session" per row.
  - "Log out everywhere except this one" button at the top.
  - Backed by a `sessions (id PK, user_id, ua, ip, created_at,
    last_seen_at, revoked_at)` table; the cookie carries the
    session id, not just the user id.
- **Implementation notes**:
  - Replaces the implicit "any valid cookie = signed in" model
    with a row-per-session model — required to actually revoke.
  - Update P1-002's middleware to validate against this table.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P1-011] Login-from-new-device email notification
- **Status**: [ ]
- **Phase**: 1
- **Depends on**: P1-007, P1-010
- **Unlocks**: account-takeover deterrent
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - On a successful login, if the resulting `sessions` row has a
    new (UA, IP-city) tuple for that user, send a "new sign-in"
    email with the device + approximate location + a "wasn't
    you?" link.
  - The "wasn't you" link → magic-link verify → revokes the
    flagged session and forces a passkey/password reset prompt.
- **Implementation notes**:
  - Don't email on every login or it becomes noise. Hashing the
    UA into a "device fingerprint" and only emailing on first
    sight is the right shape.
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
- **Depends on**: P1-002, P0-008
- **Unlocks**: (support tooling)
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Command refunds a charge by session id, updates
    `purchases.status = 'refunded'`.
  - Gated on `requireAdmin` (P0-008), not the legacy `ADMIN_EMAILS`
    env allowlist.
  - Writes an audit log row (P0-009).
- **Implementation notes**:
  - `stripe.refunds.create({ payment_intent })`.
  - Surface in the admin dashboard (P4-006).
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P2-008] Email the STL after purchase
- **Status**: [ ]
- **Phase**: 2
- **Depends on**: P1-007, P2-001
- **Unlocks**: retention, "I lost the file" support
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - On `payments.verifySession` resolving paid (or in the webhook
    handler from P2-001), enqueue an email with the STL attached
    and a download link to `/account` for re-download.
  - Email template lives in `server/emails/order-stl.{html,txt}`
    with handlebars-style placeholders.
  - Integration test: POST to a Stripe test event → receipt arrives
    in the dev inbox (Mailpit/Resend dev mode).
- **Implementation notes**:
  - STL attachment limit: 25 MB on most providers; our STLs are
    ~4 MB, fine. If size grows, switch to a signed-URL link only.
  - Use the same provider chosen in P1-001.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P2-009] Order receipt + tax/VAT line in email
- **Status**: [ ]
- **Phase**: 2
- **Depends on**: P2-008, P2-006
- **Unlocks**: VAT compliance
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Receipt email includes line items, subtotal, tax, total,
    Stripe receipt URL, and order id.
  - Pull tax breakdown from the verified session (P2-006).
- **Implementation notes**:
  - Stripe sends its own receipt by default — disable that and own
    the touchpoint, or link out to it. Pick one and document.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P2-010] "I lost my STL" recovery flow
- **Status**: [ ]
- **Phase**: 2
- **Depends on**: P1-001, P2-008
- **Unlocks**: support deflection
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Marketing site includes a "Find my STL" link.
  - User enters the email used at purchase → magic link with a
    direct link to /account/orders.
  - If the design has expired (24 h TTL), surface a friendly
    "regenerate from your saved photo" CTA (P3-010).
- **Implementation notes**:
  - Don't bypass auth — magic-link in, then show.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P2-011] Promo / discount codes
- **Status**: [ ]
- **Phase**: 2
- **Depends on**: P0-008, P0-010
- **Unlocks**: launch promos, partner deals
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `promo_codes (code PK, percent_off, amount_off, max_uses,
    used_count, expires_at, scope JSONB, created_by, created_at)`
    migration.
  - `payments.createCheckoutSession` accepts an optional `promo`
    field; valid codes apply via Stripe Coupon attached to the
    session.
  - Admin command `promos.create` / `promos.list` / `promos.expire`
    gated by `requireAdmin`.
- **Implementation notes**:
  - Use Stripe Coupons under the hood — don't reinvent discount math.
  - Handle race conditions on `max_uses` with a SELECT … FOR UPDATE.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P2-012] Comp / free-grant flow (admin-driven)
- **Status**: [ ]
- **Phase**: 2
- **Depends on**: P0-008, P0-009
- **Unlocks**: support, beta tester gifting
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Admin command `purchases.comp({ design_id, reason })` creates
    a `purchases` row with `status='paid'`, `amount_cents=0`,
    `product='comp_grant'` (new value, migration to update CHECK).
  - Audit row written (P0-009).
  - User is emailed (P2-008) with the STL.
- **Implementation notes**:
  - Don't touch Stripe — comps live entirely in our DB.
  - Surface in the user's order list as "Gifted by BikeHeadz."
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P2-013] Abandoned-cart recovery
- **Status**: [ ]
- **Phase**: 2
- **Depends on**: P1-007, P2-001
- **Unlocks**: conversion lift
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Track checkout-session creation; if no `paid` event fires in
    24h and the user has a verified email + opted in, send a
    one-shot reminder with a re-checkout link.
  - Honors P1-007 marketing-pref and includes one-click unsub.
- **Implementation notes**:
  - Use the Stripe webhook (P2-001) for the negative signal —
    `checkout.session.expired`.
  - Cap to one reminder per session_id; never spam.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P2-014] Apple Pay / Google Pay express checkout
- **Status**: [ ]
- **Phase**: 2
- **Depends on**: (none)
- **Unlocks**: mobile conversion lift
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Stripe Payment Element (or Express Checkout Element) embedded
    on the post-generate Buy step shows wallet buttons when the
    browser supports them.
  - Hosted Checkout remains the fallback path; wallet shortcut
    just skips the redirect for one-tap purchase.
  - Mobile Safari + Chrome smoke-tested before launch.
- **Implementation notes**:
  - Trade-off: hosting payment UI inline grows the CSP surface
    (P0-007). Fine for our case — the express element is sandboxed
    in an iframe.
  - Don't break the "no REST" invariant: the wallet flow still
    creates a session via `payments.createCheckoutSession`; only
    the *redirect* is replaced by an in-page confirmation.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P2-015] Stripe Customer Portal for self-serve
- **Status**: [ ]
- **Phase**: 2
- **Depends on**: P1-002
- **Unlocks**: support deflection
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `payments.openCustomerPortal` command returns a Stripe-hosted
    portal URL pre-bound to the user's customer id.
  - "Manage payments / receipts / refund requests" link on
    /account opens it in a new tab.
  - Portal config in Stripe restricts to the actions we want
    (view receipts, request refund, update payment method) — no
    subscription cancellation since we don't have subscriptions.
- **Implementation notes**:
  - One env var `STRIPE_CUSTOMER_PORTAL_CONFIG_ID` to allow
    test/live separation.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P2-016] Print fulfillment tracking page
- **Status**: [ ]
- **Phase**: 2
- **Depends on**: P2-004, P2-005
- **Unlocks**: post-purchase clarity for printed-stem buyers
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `/orders/<id>` shows a 5-step tracker: Paid → In Queue →
    Printing → Shipped (with carrier + tracking #) → Delivered.
  - Each transition driven by P2-005's webhook from the
    print-on-demand vendor.
  - Email notifications at each transition (honors P1-007 prefs).
- **Implementation notes**:
  - Tracking number lives on `purchases.shipping_tracking`.
  - Carrier-specific tracking URL templates kept server-side so
    the client doesn't have to know UPS/USPS/FedEx URL shapes.
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
- **Status**: [x]
- **Phase**: 3
- **Depends on**: P0-003, P0-006 (rate-limit follow-up, not gating)
- **Unlocks**: production TRELLIS — landed v0.1.34
- **Effort**: L
- **Owner**: claude-opus-4.7
- **Acceptance criteria**:
  - [x] `stl.generate` talks to a remote GPU worker; selection is
    per-request via `RUNPOD_ENDPOINT_URL` + `RUNPOD_API_KEY`.
  - [x] Progress frames identical to local backend (client unchanged).
  - [x] Default unset env → uses local spawn (dev).
  - [x] Verified end-to-end against a live RunPod endpoint with the
    chunked-yield delivery protocol (v0.1.34).
- **Implementation notes**:
  - RunPod Serverless `/run` + `/stream/{id}` polling fits the
    generator-handler shape. The Node tier polls every 1.5 s, re-emits
    progress frames as socket.io progress, indexes `result_chunk` frames
    and reassembles the STL bytes once `total` is reached.
  - **Critical:** `return_aggregate_stream=False` in
    `runpod.serverless.start({...})`. With `True` the SDK aggregates
    every yielded frame into one POST to `/job-stream` with
    `isStream=false` at generator-finish, and 4+ MB of base64 chunks
    blows past the per-request size cap. See
    `docs/RUNPOD_TRELLIS_PLAYBOOK.md` for the full delivery story.
  - Worker auth via the user's `RUNPOD_API_KEY` — Stripe-level authZ
    is handled in the Node server before the request reaches RunPod.
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): v0.1.34 lands. The five-version saga
    (v0.1.30 constants crash → v0.1.31 libOpenGL + pymeshlab guard →
    v0.1.32 result-via-return-value → v0.1.33 chunked yield →
    v0.1.34 `return_aggregate_stream=False` + lenient stage 1.5)
    is documented in `docs/RUNPOD_TRELLIS_PLAYBOOK.md`. Browser
    renders the actual STL on first try.
  - 2026-04-23 (claude-opus-4.7): Scaffolding — `deploy/runpod/`,
    `server/workers/runpod-client.js`, `stl.js` backend gating.
    Walkthrough in `deploy/runpod/README.md`.

### [P3-003] Cache TRELLIS outputs by (photo hash, settings hash)
- **Status**: [x]
- **Phase**: 3
- **Depends on**: P3-002
- **Unlocks**: cost savings + slider-tweak UX
- **Effort**: M
- **Owner**: claude-opus-4.7
- **Acceptance criteria**:
  - [x] On-disk cache at `/runpod-volume/cache/trellis/<key>.stl`,
    keyed by `sha256(image_b64 + seed)`.
  - [x] `handler.py` checks for a cache hit before invoking TRELLIS.
  - [x] 24h TTL (matches design-store TTL).
  - [x] Slider-tweak regenerations on the same photo bypass the GPU
    stage entirely.
- **Implementation notes**:
  - Cache lives on the Network Volume so it survives worker recycles.
  - Slider state (Crop Tightness, Head Pitch, Head Height, Cap
    Protrusion) doesn't change what TRELLIS produces — only Stage 2/3/4
    post-processing. Caching the raw TRELLIS mesh is the right grain.
  - Cache hit logs `[trellis-cache] HIT key=…`; miss + save logs
    `[trellis-cache] SAVED key=…`.
- **Agent notes** (append-only, newest first):
  - 2026-04-28 (claude-opus-4.7): Shipped as part of the v0.1.30+ run.
    Confirmed via worker logs: warm-worker slider tweaks complete in
    ~1–2 s vs ~30 s for a fresh TRELLIS pass.

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
- **Status**: [x]
- **Phase**: 3
- **Depends on**: (none)
- **Unlocks**: reduced print failures
- **Effort**: S
- **Owner**: claude-opus-4.7
- **Acceptance criteria**:
  - [x] Post-pipeline `assert_printable(stage="stage5")` checks
    watertight, winding consistency, single shell.
  - [x] Warnings surfaced inline in worker logs (`[stage4]`,
    `[stage5]` WARNING lines).
  - [ ] Warnings surfaced to client as `stl.generate.warnings` frames
    (deferred — client has no UI for them yet).
- **Implementation notes**:
  - `pipeline/validation.py:assert_printable`. Stage warnings ship to
    the worker log with enough detail to diagnose offline.
  - Wall-thickness check stub in place; ray-cast not yet wired.
- **Agent notes** (append-only, newest first):
  - 2026-04-28 (claude-opus-4.7): Shipped with v1 pipeline. Client-side
    warning surfacing is a deferred polish item — see P3-007.

### [P3-006] Failure-corpus replay harness
- **Status**: [ ]
- **Phase**: 3
- **Depends on**: P3-002
- **Unlocks**: regression detection without burning GPU minutes
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `tools/replay_failures.py` reads the
    `/runpod-volume/failures/<yyyymmdd>/<jobId>/` corpus, re-runs the
    pipeline locally (skips TRELLIS when `photo.b64` is paired with a
    cached `head.stl`), and reports stage-by-stage outcomes.
  - CI job runs the harness against a small committed corpus on each
    PR; regressions fail the build.
- **Implementation notes**:
  - The handler already writes the corpus (handler.py:_write_failure).
  - The replay path needs to load `pipeline_constants.json`, run from
    Stage 1.5 onward (Stage 0/1 are pure transforms, Stage 1.5+ is
    where the bugs land).
  - Keep the committed corpus tiny (3–5 hand-picked cases) and rotate
    aggressively — full corpus stays on the Network Volume.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P3-007] Surface stage warnings to the client UI
- **Status**: [ ]
- **Phase**: 3
- **Depends on**: P3-005
- **Unlocks**: user-visible "this is a best-effort print"
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Worker yields `{"type":"warning", "stage":"…", "message":"…"}`
    frames where it currently writes to stderr.
  - Node tier re-emits as `stl.generate.warnings` frames.
  - HomePage shows a small warning chip below the viewer when any
    stage flagged "shipping anyway."
- **Implementation notes**:
  - Don't bury this in DevTools; the user paid $2 and deserves to know
    when their cap might not be 100% slicer-clean.
  - Warning copy needs to be plain-English and actionable ("try a
    less tilted photo," not "stage 4 boolean union euler -3").
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P3-008] Live red-line preview workflow
- **Status**: [ ]
- **Phase**: 3
- **Depends on**: P3-007
- **Unlocks**: real-time slider feedback without re-rendering STL
- **Effort**: L
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - As the user drags Crop Tightness / Head Pitch sliders, an SVG
    overlay on the photo shows where the cut, the cavity, and the
    cap protrusion will land.
  - No STL re-render fires until the user releases the slider.
- **Implementation notes**:
  - The mediapipe landmarks in Stage 0 give us the chin, jawline, and
    eye line in 2D. Project the cut location back through those.
  - Pure client-side SVG.js render of the proposed crop region.
  - Bonus: confidence band ("this might be too aggressive") informed
    by the photo's detected pose.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P3-009] Tighten stage 1.5 input check
- **Status**: [ ]
- **Phase**: 3
- **Depends on**: P3-006
- **Unlocks**: better failure messages on truly-broken inputs
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Stage 1.5 distinguishes "pymeshlab couldn't fully close holes"
    (current warning case, ship anyway) from "this isn't a valid
    mesh" (empty vertices, NaN coords, single-shell-only) and
    raises only on the latter.
  - Failure-corpus replay catches the regression where v0.1.33's
    hard gate blocked everyone.
- **Implementation notes**:
  - Currently the gate is a flat `is_watertight` warn. Add explicit
    checks for `len(vertices) > 0`, no NaN coords, at least 4 faces.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P3-010] Re-generate from a saved photo
- **Status**: [ ]
- **Phase**: 3
- **Depends on**: P1-006
- **Unlocks**: huge UX win for slider exploration + re-orders
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `stl.generate` accepts `{ photoId }` as an alternative to
    `imageData`; server resolves it to the BYTEA blob server-side.
  - /account Designs tab "Re-render" button opens /home with
    `?photo=<id>&heads=<presets>` deep-link.
  - Auth required: `photoId` must belong to the requesting user.
- **Implementation notes**:
  - Avoids re-uploading the same multi-MB photo every iteration.
  - Pairs nicely with P3-003 (TRELLIS-output cache) — same hash
    gives the same cached head.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P3-011] Post-generation feedback ("did this look like you?")
- **Status**: [ ]
- **Phase**: 3
- **Depends on**: P0-009
- **Unlocks**: prompt-tuning data, A/B baseline
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Post-render the viewer shows an unobtrusive 1-tap rating:
    👍 / 👎 / 🤷.
  - Rating + design_id + brief optional reason persisted to
    `design_feedback` table.
  - Admin dashboard (P4-005) charts rating-rate over time and
    correlates with sliders / pipeline_version.
- **Implementation notes**:
  - Don't gate downloads on this; it's optional.
  - Don't show twice for the same design.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P3-012] NSFW + minor-likeness pre-screen
- **Status**: [ ]
- **Phase**: 3
- **Depends on**: P3-001
- **Unlocks**: launch readiness, TOS enforcement
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Photo upload runs a lightweight NSFW classifier (NudeNet or
    equivalent, server-side); reject with `unsafe_image` if score
    > threshold.
  - Same path runs an age estimator; if predicted age < 13, reject
    with `minor_likeness` and a friendly explanation.
  - Both rejection paths persist a row to `audit_log` (P0-009)
    without storing the photo bytes.
- **Implementation notes**:
  - Run on the GPU worker (it's already there) — extends
    mediapipe pre-flight (P3-001).
  - Tune thresholds against a small labeled set; bias toward
    false-negatives on the age estimator (it's a soft prior, not
    a verifier).
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P3-013] Auto-isolate face from cluttered backgrounds
- **Status**: [ ]
- **Phase**: 3
- **Depends on**: P3-001
- **Unlocks**: better TRELLIS reconstructions on real selfies
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Pre-TRELLIS pass uses `rembg` (already in the worker for
    u2net) to mask out the background, replacing it with a
    neutral gray.
  - Toggleable per-request via `settings.autoIsolate` (default
    on); off-mode preserves the original photo for users who
    want to.
  - Visible quality lift on a hand-curated test set of 10 cluttered
    selfies (compared via reference STLs in the failure corpus).
- **Implementation notes**:
  - rembg is already loaded for the TRELLIS pipeline; we just
    need to use it as a pre-pass on the input image.
  - Replace the background, don't crop — TRELLIS uses the full
    framing to estimate scale.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P3-014] Multi-photo input — front + side for back-of-head
- **Status**: [ ]
- **Phase**: 3
- **Depends on**: P3-002
- **Unlocks**: dramatically better back-of-head reconstruction
- **Effort**: L
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `stl.generate` accepts `imageData` as either a single photo
    or an array of 2–4 photos with view hints (`{ image, view:
    'front' | 'side-left' | 'side-right' | 'back' }`).
  - Worker passes the array through to TRELLIS's multi-image
    code-path (already supported by the `image-large` checkpoint,
    just unused in our handler).
  - Home page UI shows a "+ add another angle" affordance when
    the first photo is uploaded.
- **Implementation notes**:
  - The "back of head is hallucinated" defect (3D_Pipeline.md §8.2)
    is dramatically reduced when TRELLIS gets even a low-quality
    side photo.
  - Cache key (P3-003) needs to include the *set* hash, not just
    one photo's hash.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P3-015] Smart auto-orient using facial landmarks
- **Status**: [ ]
- **Phase**: 3
- **Depends on**: P3-001
- **Unlocks**: fewer "head looks sideways" failures
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Stage 1 (normalize) defaults to facial-landmark orientation
    when mediapipe FaceMesh confidence > 0.7; falls back to PCA
    when confidence is lower.
  - Computes a head-frame matrix from chin → forehead and eye
    line → +Y, applies it, then runs the existing PCA confirm.
  - Failure-corpus replay (P3-006) shows landmark-mode beats
    PCA on at least 70% of regression cases.
- **Implementation notes**:
  - Required by 3D_Pipeline.md §5 Stage 1 risks doc — the PCA
    orientation fails ~10% of the time and that's our biggest
    "looks wrong" defect class.
  - The mediapipe landmarks are already extracted in Stage 0
    (P3-001); just flow them down.
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

### [P4-005] Admin dashboard — usage trends + conversion funnel
- **Status**: [ ]
- **Phase**: 4
- **Depends on**: P0-008, P4-002
- **Unlocks**: P4-006, P4-008
- **Effort**: L
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `/admin` route, gated by `requireAdmin` (P0-008), renders four
    tabs: **Overview**, **Users**, **Designs**, **Money**.
  - Overview: time-series charts for daily generations, daily
    purchases, conversion rate (purchases / generations), median
    end-to-end latency, GPU cost per generation.
  - Date-range picker (7d / 30d / 90d / custom); all charts honor it.
  - Server commands `admin.metrics.timeseries({ metric, range })` and
    `admin.metrics.summary({ range })` returning JSON suitable for
    a Chart.js / lightweight chart library.
- **Implementation notes**:
  - Materialize daily aggregates into a `daily_stats` table updated
    by a scheduled job — querying `generated_designs` directly
    won't scale past ~6 months.
  - Don't ship Chart.js if it adds 200 KB; consider a tiny SVG
    line-chart helper (~500 lines) instead.
  - Cache `summary` for 60 s; the dashboard is admin-only so
    freshness doesn't have to be real-time.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P4-006] Admin user-management page
- **Status**: [ ]
- **Phase**: 4
- **Depends on**: P0-008, P0-009, P4-005
- **Unlocks**: support workflow
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Users tab on /admin lists every account: id, email, signup
    date, last-active, design count, total spend.
  - Search by email / id; filter by role / activity recency.
  - Per-user side panel actions:
    - Promote to admin (writes audit row)
    - Comp a free STL (calls P2-012 `purchases.comp`)
    - Force-logout (invalidate session token)
    - Soft-delete (with confirmation modal)
    - View their full audit log (joins audit_log on actor_id)
  - Paginated 50/page; CSV export of the current view.
- **Implementation notes**:
  - Search query: trigram index on `accounts.email` for "starts
    with" style typing without full table scan.
  - Force-logout: bump a `session_token_version` on the account row
    and verify in P1-002 middleware.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P4-007] Admin design-output viewer
- **Status**: [ ]
- **Phase**: 4
- **Depends on**: P0-008, P4-005
- **Unlocks**: quality triage, abuse review
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Designs tab on /admin shows a paginated grid of recent
    generated_designs with photo thumbnail + STL thumbnail (server-
    rendered via headless Three.js or pre-baked at generation time).
  - Per-design side panel: full settings, telemetry timings, user
    rating (P3-011), download STL, link to user, link to failure
    corpus row if present.
  - Abuse-flag button: marks the design hidden, audit-logs the action.
- **Implementation notes**:
  - STL thumbnails are expensive — generate once at handler time,
    cache to `/runpod-volume/thumbs/<design_id>.png`. ~50–80 KB each.
  - The grid view is a DSAR / take-down workflow as much as it is
    a dashboard; design accordingly.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P4-008] Cost-tracking dashboard (RunPod GPU $$ per request)
- **Status**: [ ]
- **Phase**: 4
- **Depends on**: P4-005
- **Unlocks**: pricing experiments, unit-economics
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Money tab on /admin shows: daily revenue, daily GPU cost
    (estimated from RunPod's per-second billing × telemetry
    `total_ms` per generation), gross margin %.
  - Breakdown by `pipeline_version` (legacy vs v1) and by
    cache hit/miss.
  - Refund / chargeback line subtracted from revenue.
- **Implementation notes**:
  - Hard-code a `RUNPOD_GPU_USD_PER_S` env var; the actual cost
    depends on the GPU type chosen by the endpoint, so this is an
    estimate not an invoice.
  - Pull true costs from RunPod's billing API in a follow-up.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P4-009] A/B testing harness
- **Status**: [ ]
- **Phase**: 4
- **Depends on**: P0-010
- **Unlocks**: data-driven product decisions
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `experiments (key PK, variants JSONB, allocation JSONB,
    started_at, stopped_at)` table.
  - `assignVariant({ user, key })` helper deterministic per user
    (sha256(user_id + key) → bucket).
  - Server emits `[telemetry]` exposure events keyed by experiment.
  - Admin command to start/stop experiments + per-variant
    conversion summary on /admin.
- **Implementation notes**:
  - Use this for P3-008 (red-line preview rollout), pricing
    experiments, button copy A/B tests.
  - Don't ship a full bayesian stats engine; a 95% CI calculator
    on conversion-rate diff is enough.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P4-010] Live ops view — current GPU queue + recent failures
- **Status**: [ ]
- **Phase**: 4
- **Depends on**: P0-008, P0-011, P3-006
- **Unlocks**: faster incident response
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - "Now" panel on /admin shows: in-flight generations, RunPod
    endpoint health (P0-011), last 50 telemetry events from the
    worker (success / failure / latency), failure-corpus growth rate.
  - Auto-refreshes every 5 s via a socket subscription.
- **Implementation notes**:
  - Pipe handler stderr through a tail-N buffer in the Node
    server; no need for a real log aggregator at MVP.
  - This is the "is the site burning right now?" page on launch
    day — make it loadable on mobile.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P4-011] Email-engagement metrics
- **Status**: [ ]
- **Phase**: 4
- **Depends on**: P2-008, P4-005
- **Unlocks**: deliverability tuning, content iteration
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Webhooks from the email provider (Resend/Postmark) update
    `email_events (id, message_id, type, account_id, created_at)`.
  - Admin dashboard shows open / click / bounce / complaint rates
    per template, last 30 days.
  - Auto-suppress addresses that hard-bounce twice.
- **Implementation notes**:
  - Don't track opens by default if we want a strict privacy
    posture — make it a per-template flag.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P4-012] Real-time error stream + alerting
- **Status**: [ ]
- **Phase**: 4
- **Depends on**: P0-005, P4-010
- **Unlocks**: launch-day on-call discipline
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Sentry (P0-005) issues mirrored to a Slack/Discord webhook
    with rate-limiting (max 1 message per error fingerprint per
    10 min).
  - Threshold alerts: error rate > 1%/min for 5 min → page;
    GPU latency P95 > 60s for 5 min → page.
- **Implementation notes**:
  - Reuse Sentry's own alert rules where possible — don't build
    a parallel system.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P4-013] Synthetic canary — auto-generate every 30 min
- **Status**: [ ]
- **Phase**: 4
- **Depends on**: P0-008
- **Unlocks**: detect prod regressions before users do
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Scheduled job (cron / DO scheduler) runs `stl.generate`
    against a canary photo every 30 min; asserts output size
    is in expected range, p95 latency under budget.
  - Failure pages on-call via P4-012 alert routing.
  - Canary results graphed on /admin (P4-005) — gives a
    reliable "how is the site right now?" signal independent
    of whether any real user is generating.
- **Implementation notes**:
  - Use a consented fixture photo committed to the repo at
    `tools/canary/canary-photo.jpg` so we don't burn a real
    user's image on every check.
  - Tag canary jobs with `account_id = NULL` and
    `metadata.canary = true` so the admin metrics tabs can
    exclude them from real-user counts.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P4-014] DB slow-query dashboard
- **Status**: [ ]
- **Phase**: 4
- **Depends on**: P4-005
- **Unlocks**: catch N+1 / missing-index regressions
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - DO Managed PG `pg_stat_statements` enabled.
  - /admin "DB" tab lists the top 20 queries by total_time and
    by mean_time, with rolling 7-day delta.
  - Threshold alert if any query's mean_time > 200ms for 5 min.
- **Implementation notes**:
  - Reset stats nightly (or on each schema-migration deploy) so
    the rolling view stays meaningful.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P4-015] Admin "impersonate user" mode for support
- **Status**: [ ]
- **Phase**: 4
- **Depends on**: P0-008, P0-009
- **Unlocks**: faster support triage
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `/admin` user-detail panel has "View as this user" — opens a
    new browser tab in a session bound to the target user.
  - Top of every page shows a high-contrast banner "Impersonating
    <email> — STOP" that ends the impersonation cleanly.
  - Every action taken during impersonation logs both the actor
    (admin) and the target (user) in `audit_log`.
- **Implementation notes**:
  - Implementation: a separate signed-cookie scheme that carries
    `{ actor_id, target_id }`; the auth middleware (P1-002)
    treats `target_id` as the effective user, but every command
    handler with a side-effect double-checks via `requireAdmin`
    (P0-008) that there's a valid actor.
  - Don't allow impersonating another admin; that's how privilege
    escalation chains start.
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

### [P5-004] Referral codes — give a friend $2 off
- **Status**: [ ]
- **Phase**: 5
- **Depends on**: P2-011, P1-005
- **Unlocks**: organic acquisition
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Each authed user gets a unique referral code on /account.
  - Sharing the code → friend gets $2 off first purchase, referrer
    gets $2 credit applied to their next purchase.
  - Referral attribution stored on `purchases` (`referred_by`).
- **Implementation notes**:
  - Cap at 5 self-referrals per account to prevent loops.
  - Surface referral leaderboard in the admin dashboard (P4-005).
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P5-005] Public showcase / "wall of fame"
- **Status**: [ ]
- **Phase**: 5
- **Depends on**: P5-001, P1-008
- **Unlocks**: social proof on the marketing page
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `/showcase` page shows the latest 50 opt-in designs in a
    Pinterest-style masonry grid with display names + remix CTA.
  - Featured-design carousel embeds on the home page above the fold.
- **Implementation notes**:
  - `designs.publish_to_showcase` writes a row to a separate
    `showcase_entries` table to keep the gallery query fast.
  - Admin can pin/unpin entries (P4-007).
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P5-006] OpenGraph / Twitter card preview per design
- **Status**: [ ]
- **Phase**: 5
- **Depends on**: P5-002
- **Unlocks**: shareable social previews
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `/d/:token` returns OG and Twitter meta tags so Slack /
    Discord / Twitter previews show the rendered head + display
    name.
  - Image: pre-baked 1200×630 PNG of the model on the workshop
    backdrop, generated at design-creation time (re-uses the
    P4-007 thumbnail pipeline).
- **Implementation notes**:
  - Server-side rendered HTML for the share URL only — the SPA
    still hydrates the same route normally for logged-in viewers.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P5-007] Custom user permalinks (`/u/<username>`)
- **Status**: [ ]
- **Phase**: 5
- **Depends on**: P1-008, P5-001
- **Unlocks**: brand-able share URLs
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `accounts.username UNIQUE` column (3–20 chars, alphanumeric +
    underscore + hyphen).
  - `/u/<username>` renders that user's opt-in showcase entries
    with their display name + avatar.
  - Username can be claimed once on /account; changing it
    requires admin (P0-008) + leaves a redirect from the old slug
    so external links don't break.
- **Implementation notes**:
  - Reserve a wordlist of route-name conflicts (`admin`, `api`,
    `account`, `u`, `d`, `pricing`, etc.) so users can't claim
    them.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P5-008] Featured design of the week (admin-curated)
- **Status**: [ ]
- **Phase**: 5
- **Depends on**: P5-005, P0-008
- **Unlocks**: editorial quality bar on the showcase
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Admin can flag a showcase entry as "featured" with a start
    date.
  - The home-page hero shows the current featured design (image
    + display name + remix CTA) above the regular hero copy.
  - Auto-rotates weekly if no manual flag.
- **Implementation notes**:
  - The first featured design is a marketing decision — pick one
    that prints cleanly + has a charismatic-looking head.
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
- **Status**: [x]
- **Phase**: 6
- **Depends on**: (none)
- **Effort**: L
- **Owner**: claude-opus-4.7
- **Acceptance criteria**:
  - [x] Manual contrast pass: every text/UI surface meets 4.5:1
    (normal) / 3:1 (large bold).
  - [x] Tailwind `text-white` classes purged from non-red-bg
    contexts (they were rendering invisible on cream).
  - [x] Black-on-red button text flipped to white-on-red.
  - [ ] Automated `axe-core` CLI in CI — split out as a follow-up
    in a new task so this one can close (see notes).
- **Implementation notes**:
  - The brand-red, muted-gray and gold-text bumps below are now
    the canonical tokens for any new code that follows.
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): Closing this out per user
    sign-off. Verbose decision record below — mirror in
    `docs/DESIGN_DECISIONS.md` which should be the canonical home
    for these going forward. CI/axe deliverable explicitly
    deferred to `P6-009` so progress isn't blocked behind the test
    harness work.

    **Contrast-ratio decisions (cream `#FAF7F2` background unless
    stated):**

    | Token | Old | New | Old ratio | New ratio | Reason |
    |---|---|---|---|---|---|
    | Brand red (text) | `#DC2626` | `#C71F1F` | 4.47 (FAIL AA) | 5.32 ✓ | Just under threshold; bumped slightly darker so pricing/labels at <14pt bold pass |
    | Muted body text | `#8B8278` | `#6B6157` | 3.42 (FAIL) | 5.51 ✓ | Used for dates, captions, sub-labels — all below threshold |
    | Gold (text/icon) | `#A88735` | `#7C5E1F` | 2.86 (FAIL) | 6.45 ✓ | Step-4 accent + info-banner text. Kept `#A88735` only for the legend swatch *dot* in home.js because the dot represents the actual valve color and isn't text |
    | Button text on red | `#000` | `#FFFFFF` | 4.38 (FAIL) | 5.74 ✓ | Black-on-red is a legacy lime-theme leftover; white-on-red is the canonical pattern |
    | Tailwind `.text-white` H1/H2/body | white | inherit `--foreground` | 1.06 (FAIL) | ~14:1 ✓ | Removed via search — kept only on the header logo where the bg is the red gradient |

    **Brand decisions:**

    - Workshop palette over dark-mode-lime. The product is a
      *tactile* 3D-printed object; cream paper + jersey red maps
      to the cycling-craftsperson aesthetic far better than the
      previous "generic dev-tool dark" look. Locked in
      `client/styles/theme.css` with semantic tokens
      (`--ink`, `--paper`, `--paper-soft`, `--paper-edge`, etc.)
      so future code can use names instead of hex.

    - Schrader, not Presta. Earlier copy was wrong. The product's
      thread spec (8 mm × 32 TPI) matches Schrader; Presta is a
      narrower different-thread valve. Renamed across all client
      pages, README, ProductSpec, 3D_Pipeline, playbook,
      FEATUREROADMAP, deploy/runpod/README. Updated
      `schraderPara()` in how-it-works to describe Schrader's
      actual properties (wider, sprung, common on MTBs/hybrids/
      car tires) instead of Presta's.

    **3D viewer decisions:**

    - Added `RoomEnvironment` IBL via `PMREMGenerator`. This was
      THE fix — metallic materials (chrome STL) read mostly via
      reflections of their environment, not via direct lights.
      No amount of point/directional light boost compensates for
      missing IBL on a PBR metal. We were tweaking the wrong knob
      for two iterations before landing on this.

    - Backdrop `#2D2A26` → `#4A453F`. The lighter graphite gives
      the silhouette something to bounce against. Still contrasts
      the cream UI by enough margin to read as "workshop slate."

    - Light rig: ambient 0.65→0.9, hemi 0.85→1.1, key 2.2→2.6,
      fill 0.85→1.2, rim 1.1→1.5, **added** a side rim at 1.1
      for back-contour readability during auto-rotate. Tone-map
      exposure 1.25 → 1.6.

    - Floor disc opacity 0.08 → 0.14. The lighter bg made the
      previous opacity invisible.

    **Layout decisions:**

    - Removed the home-page "Previous 3D Designs" gallery
      entirely. It was a hardcoded mock-data section that didn't
      tie to anything real, and there's no auth yet so showing
      "your designs" was inherently misleading. Replaced the
      sidebar with a Pricing card promoted to top + a "3D
      Printing Tips" workshop card.

    - "3D Printing Tips" card includes the brim instruction
      (5 mm brim, 0 mm brim-object gap) with the *why* — the cap
      is tall+narrow and shears off the bed without a brim.
      Concrete slicer paths for Bambu Studio / OrcaSlicer /
      PrusaSlicer because users print on whichever they have.

### [P6-009] axe-core CI integration for AA regressions
- **Status**: [ ]
- **Phase**: 6
- **Depends on**: P6-003
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `axe-core/playwright` (or @axe-core/cli) wired into a CI job
    that loads each route in a headless browser and asserts zero
    critical/serious violations.
  - Job runs on every PR; failures block merge.
  - One-line escape hatch documented (`<axe-skip>` comment) for
    intentional violations the team has accepted.
- **Implementation notes**:
  - The manual a11y pass already landed (P6-003); this task is
    the regression net so the next color tweak doesn't silently
    re-break contrast.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P6-004] Email template i18n
- **Status**: [ ]
- **Phase**: 6
- **Depends on**: P2-008, P6-002
- **Effort**: S
- **Acceptance criteria**:
  - Email templates accept a locale; user's `accounts.locale`
    drives the choice (default `en`).
  - First locale ships alongside the second site locale (P6-002).
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P6-005] Localized pricing + tax-inclusive display
- **Status**: [ ]
- **Phase**: 6
- **Depends on**: P6-001, P2-006
- **Effort**: S
- **Acceptance criteria**:
  - EU users see VAT-inclusive prices on /pricing and the home
    "Buy" CTA.
  - Currency-formatting honors the locale (£2.00, 2,00 €).
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P6-006] Respect prefers-reduced-motion + prefers-color-scheme
- **Status**: [ ]
- **Phase**: 6
- **Depends on**: P6-003
- **Effort**: S
- **Acceptance criteria**:
  - 3D viewer auto-rotate disabled when `prefers-reduced-motion:
    reduce`.
  - `.fade-up` / `.pulse-dot` / `.spinner` honor the same media
    query (animation-duration: 0).
  - If a user has `prefers-color-scheme: dark`, the workshop
    palette inverts to a deep-graphite + warm-cream variant
    (separate token block, gated by `@media (prefers-color-scheme:
    dark)`).
- **Implementation notes**:
  - The dark variant is a stretch goal — at minimum, ship the
    reduced-motion behavior.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P6-007] Screen-reader live announcements for processing
- **Status**: [ ]
- **Phase**: 6
- **Depends on**: P6-003
- **Effort**: S
- **Acceptance criteria**:
  - Generation progress announced via an `aria-live="polite"`
    region. Each progress frame ("Loading TRELLIS…", "30% — head
    extraction") spoken once.
  - Final state ("STL ready, $2 to download") spoken on
    completion; errors spoken via `aria-live="assertive"`.
  - Tested with VoiceOver on macOS Safari + NVDA on Windows
    Firefox.
- **Implementation notes**:
  - Throttle announcements — too many spoken updates is worse
    than none. One per stage transition is enough.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P6-008] RTL language scaffold
- **Status**: [ ]
- **Phase**: 6
- **Depends on**: P6-002
- **Effort**: M
- **Acceptance criteria**:
  - `<html dir>` attribute set from the active locale.
  - Layouts use logical CSS properties (`margin-inline-start`,
    `padding-inline-end`, `text-align: start`) instead of
    physical (`margin-left`, etc.) on every page.
  - One RTL locale shipped end-to-end (Arabic) so the scaffold
    is exercised.
- **Implementation notes**:
  - Tailwind v4 has `ms-*` / `me-*` utilities (margin-inline-
    start/end). Use those.
  - The 3D viewer doesn't need RTL — it's spatial, not textual.
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

### [P7-003] SMS magic-link option
- **Status**: [ ]
- **Phase**: 7
- **Depends on**: P1-001
- **Effort**: M
- **Acceptance criteria**:
  - Login flow accepts a phone number alongside email; `auth.requestMagicLink`
    sends a Twilio SMS with a tap-to-open URL.
  - Same `auth_tokens` table; tokens are channel-agnostic.
- **Implementation notes**:
  - Don't ship as default — gate behind P0-010 feature flag until
    SMS pricing is dialed in.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P7-004] Mobile-first photo capture flow
- **Status**: [ ]
- **Phase**: 7
- **Depends on**: P7-002
- **Effort**: S
- **Acceptance criteria**:
  - On phones, tapping the upload area opens the rear camera with
    a face-aligned reticule overlay (uses mediapipe FaceMesh in
    real-time, P3-001).
  - Capture button disabled until alignment confidence > 0.7.
- **Implementation notes**:
  - The reticule is the killer UX — most "no face detected"
    rejections are framing problems.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P7-005] Native Web Share API integration
- **Status**: [ ]
- **Phase**: 7
- **Depends on**: P5-002
- **Effort**: S
- **Acceptance criteria**:
  - On a successful generation, a "Share" button calls
    `navigator.share({ title, text, url })` when supported (mobile
    + macOS Safari).
  - Falls back to a "Copy link" button + native clipboard API on
    desktop browsers.
- **Implementation notes**:
  - The share URL is the P5-002 signed permalink, not the
    socket-frame STL.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P7-006] "Add to Home Screen" install prompt
- **Status**: [ ]
- **Phase**: 7
- **Depends on**: P7-001
- **Effort**: S
- **Acceptance criteria**:
  - Listen for `beforeinstallprompt`; show a small banner the
    second time the user successfully generates an STL ("install
    BikeHeadz to skip the upload next time?").
  - Dismissible permanently per device; never shown again after
    "no thanks."
- **Implementation notes**:
  - First-visit prompts are user-hostile. Wait for a real success
    moment before asking.
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

### [X-003] Marketing landing page polish (above-the-fold + social proof)
- **Status**: [ ]
- **Effort**: M
- **Acceptance criteria**:
  - Home page above the fold: punchy headline, single demo
    animation (looped 5s recording), one CTA.
  - Below: 3-step "how it works", press / showcase tiles (P5-005),
    FAQ accordion, footer.
  - Hero animation < 800 KB.
- **Agent notes**: _(empty)_

### [X-004] TOS, Privacy Policy, Acceptable Use pages
- **Status**: [ ]
- **Effort**: S
- **Acceptance criteria**:
  - `/terms`, `/privacy`, `/acceptable-use` static pages with
    versioned copy (date in the URL).
  - Footer links visible from every page; signup flow has a
    "by continuing you agree to TOS" hint.
  - Privacy policy mentions photo retention (90 days, P1-006),
    failure-corpus retention, and STL retention (24h for free
    tier, indefinite for purchased).
- **Implementation notes**:
  - Have a lawyer review before launch; this task ships the
    *scaffold* with placeholder copy.
- **Agent notes**: _(empty)_

### [X-005] First-run onboarding tour
- **Status**: [ ]
- **Effort**: S
- **Acceptance criteria**:
  - First-time visitor sees a 3-step tooltip walkthrough on the
    home page (Upload → Adjust → Buy).
  - Dismissable; remembered via localStorage.
- **Agent notes**: _(empty)_

### [X-006] FAQ + help center
- **Status**: [ ]
- **Effort**: S
- **Acceptance criteria**:
  - `/help` page with searchable FAQ (compatible printers,
    shipping policy, refund policy, photo guidelines, what to
    do when the print fails).
  - First 12 questions seeded from anticipated support volume.
- **Implementation notes**:
  - Static markdown rendered to HTML at build time. No CMS
    integration; edit the markdown and redeploy.
- **Agent notes**: _(empty)_

### [X-007] Launch-readiness checklist
- **Status**: [ ]
- **Effort**: S
- **Acceptance criteria**:
  - One-page checklist in `docs/LAUNCH_CHECKLIST.md` covering:
    legal pages live (X-004), Stripe live keys swapped, RunPod
    Max Workers raised, healthcheck (P0-011) green, error
    alerting wired (P4-012), Sentry DSN set, admin user seeded,
    feature flags set to launch defaults.
  - Each item has a verification command or URL.
- **Agent notes**: _(empty)_

### [X-008] Security disclosure policy + security.txt
- **Status**: [ ]
- **Effort**: S
- **Acceptance criteria**:
  - `/.well-known/security.txt` served with a contact email and
    expiration date (RFC 9116 format).
  - `/security` page describes the disclosure process: report to
    `security@`, 90-day disclosure window, hall of fame for
    responsible reports.
  - Linked from the footer.
- **Agent notes**: _(empty)_

### [X-009] "Try with sample photo" demo mode
- **Status**: [ ]
- **Effort**: S
- **Acceptance criteria**:
  - Home page upload area has a "Try with a sample" link that
    runs `stl.generate` against a committed sample photo.
  - Result is rendered + viewable but not purchasable (no real
    user attached).
  - Removes friction for first-time visitors curious to see the
    output before committing their own face.
- **Implementation notes**:
  - Bypass rate-limit (P0-006) for the demo path or it'll burn
    one of the user's allotment.
  - Cap demo generations per IP per day to prevent GPU abuse.
- **Agent notes**: _(empty)_

### [X-010] SEO basics — meta tags, OG, sitemap.xml, robots.txt
- **Status**: [ ]
- **Effort**: S
- **Acceptance criteria**:
  - Every public route has unique `<title>` + `<meta
    description>` server-rendered into the shell.
  - Default OG card for the marketing pages (separate from the
    per-design OG cards in P5-006).
  - `sitemap.xml` lists `/`, `/pricing`, `/how-it-works`,
    `/help`, `/showcase` (after P5-005).
  - `robots.txt` allows everything except `/admin`, `/account`,
    `/checkout/return`, and `/.well-known/`.
- **Agent notes**: _(empty)_

### [X-011] Custom 404 / 500 pages
- **Status**: [ ]
- **Effort**: S
- **Acceptance criteria**:
  - Unknown routes show a 404 page with workshop-branded copy
    and a search box / sitemap link.
  - Server-side errors show a 500 page with an incident reference
    id (correlate with Sentry / P0-005).
  - Both pages match the workshop palette.
- **Agent notes**: _(empty)_

---

## 15. Change log

Agents append one line per session. Most recent at top.

- 2026-04-29 — claude-opus-4.7 — Roadmap regen pass 2 + completion
  audit. **Audit:** marked **P0-003** (Dockerfile) `[x]` — shipped at
  v0.1.30, ratified at v0.1.34; path/base deviations from spec
  documented inline. Marked **P6-003** (WCAG AA audit) `[x]` for the
  manual pass; split the axe-core CI piece into a fresh **P6-009** so
  the manual deliverable can close without blocking on test infra.
  Added agent notes to both with verbose decision records.
  Created `docs/DESIGN_DECISIONS.md` as the canonical home for the
  workshop-palette / Schrader-rebrand / viewer-IBL decisions
  (mirrors the agent notes; longer-form). **Regen:** 28 new
  candidate tasks (incl. P6-009): P0-012..015 (payload validation,
  error taxonomy, pre-commit, DB-restore drill), P1-009..011
  (passkey, sessions list, new-device email), P2-014..016 (express
  checkout, Stripe portal, fulfillment tracking), P3-013..015
  (rembg pre-pass, multi-photo input, landmark auto-orient),
  P4-013..015 (synthetic canary, slow-query dashboard, impersonate
  mode), P5-007..008 (custom permalinks, featured design),
  P6-006..009 (reduced-motion, screen-reader announcements, RTL
  scaffold, axe-core CI), P7-005..006 (Web Share, install prompt),
  X-008..011 (security.txt, demo mode, SEO, 404/500 pages).
  next_suggested_task unchanged at P1-001.
- 2026-04-29 — claude-opus-4.7 — Roadmap regenerate (go-to-market
  themes). 37 new tasks added: P0-008..011 (admin role, audit log,
  feature flags, RunPod healthcheck), P1-005..008 (account dashboard,
  photo library, email prefs, profile), P2-008..013 (email STL,
  receipts, recovery flow, promos, comps, abandoned-cart), P3-010..012
  (re-gen from photo, feedback, NSFW/minor screen), P4-005..012 (admin
  metrics dashboard, user mgmt, design viewer, cost tracking, A/B,
  live ops, email engagement, alerting), P5-004..006 (referrals,
  showcase, OG cards), P6-004..005 (email i18n, localized pricing),
  P7-003..004 (SMS, mobile camera reticule), X-003..007 (marketing
  polish, TOS/Privacy, onboarding tour, FAQ, launch checklist).
  next_suggested_task flipped to P1-001 (magic-link auth) — it gates
  the new user-dashboard chain.
- 2026-04-29 — claude-opus-4.7 — Doc-regen pass after v0.1.34 lands:
  marked P3-002, P3-003, P3-005 as `[x]`; added P3-006 (failure-corpus
  replay), P3-007 (surface warnings), P3-008 (live red-line preview),
  P3-009 (tighten stage 1.5 input check). State header now tracks
  `handler_version`. Wrote `docs/RUNPOD_TRELLIS_PLAYBOOK.md` capturing
  the v0.1.30 → v0.1.34 delivery saga.
- 2026-04-28 — claude-opus-4.7 — v0.1.34 ships end-to-end. Browser
  renders the STL; chunked-yield + `return_aggregate_stream=False`
  delivery protocol confirmed in production.
- 2026-04-23 — claude-opus-4.7 — P3-002 scaffolding: RunPod Serverless
  Dockerfile + handler.py + client + stl.js gating + docs. Awaits user
  dashboard steps to flip `[~]` → `[x]`.
- 2026-04-23 — claude-opus-4.7 — Initial roadmap draft. Seeded phases
  0–7 with 30 tasks; no work executed yet.
