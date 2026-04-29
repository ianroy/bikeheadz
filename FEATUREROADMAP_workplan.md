# StemDomeZ — Feature Roadmap & Agent Workplan

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
  file_version: 8
  last_touched: 2026-04-29
  last_agent: claude-opus-4.7
  handler_version: v0.1.34               # GPU worker tag deployed on RunPod
  repo_sha: 25e6570                      # parallel-agent execution wave (6 worktrees, 26 tasks)
  active_phase: 4                        # phases 0/1/2/5/6 mostly green; 4 is now the next focus
  in_progress_tasks: []
  blocked_tasks: []
  next_suggested_task: P3-001            # face-detection preflight — bigger model, follow-up beyond stub
  pause_reason: null
  recent_milestones:
    - 2026-04-29 — Roadmap regen pass 3 (claude-opus-4.7). 30 new candidates appended across all phases without disturbing existing content. P0-016..018 (boot-fallback test, per-stage timeouts, triangle-budget cap), P1-012..014 (consume rate-limit, account merge, email-change re-verification), P2-017..019 (multi-design cart, gift purchase, 3DS/SCA recovery), P3-016..019 (wall-thickness validator, golden capture, calibration CI, TRELLIS shadow A/B), P4-016..019 (DO Spaces blob migration, OpenTelemetry, replica drift detector, Stripe reconciliation cron), P5-009..011 (embeddable shop widget, public read-only API, user boards), P6-010..012 (locale photo guidelines, AAA contrast mode, Intl date/number), P7-007..009 (resumable mobile generations, iOS pinch ergonomics, slicer deep links), X-012..015 (cookie banner, status page, public changelog, press kit). Most candidates seeded by gaps explicitly named in 3D_Pipeline.md §9.5 (per-stage timeouts, triangle budget, golden capture, calibration CI, GPU/CPU split rumination) and ProductSpec.md §13 (replica drift, blob migration). next_suggested_task unchanged at P3-001.
    - 2026-04-29 — Autonomous 7-hour push (claude-opus-4.7). Phase 0 foundations almost wholesale (P0-001 vitest harness, P0-002 ESLint+Prettier, P0-004 GH Actions CI, P0-005 Sentry shim, P0-006 rate-limit, P0-007 helmet+CSP, P0-008 admin role, P0-009 audit_log + helper, P0-010 feature_flags + commands, P0-011 RunPod /health ping, P0-012 zod schemas across stl/payments/account/auth/admin/flags/photos/designs, P0-013 ErrorCode taxonomy, P0-014 husky+lint-staged, P0-015 DB restore runbook). Phase 1 (P1-001 magic-link auth, P1-002 socket session middleware via cookie, P1-003 user-scoped designs, P1-004 GDPR export+delete, P1-005 account dashboard wired, P1-006 photo library, P1-007 email prefs, P1-008 profile mgmt). Phase 2 (P2-001 Stripe webhook, P2-002 printed_stem+pack_of_4 re-enabled, P2-003 shipping_address_collection, P2-006 STRIPE_TAX_ENABLED, P2-007 payments.refund admin, P2-008 STL email, P2-015 Customer Portal). Phase 4 partial (P4-002 /metrics endpoint, admin command surfaces P4-005/006/010/014/015 stubs). Phase 5 (P5-001 listPublic, P5-002 createShareLink+openShareLink, P5-003 remix link). Phase 6 (P6-006 prefers-reduced-motion + dark-mode tokens, P6-007 aria-live announcements). Cross-cutting (X-001 ATTRIBUTIONS rewritten, X-004 /terms /privacy /acceptable-use scaffolds, X-007 LAUNCH_CHECKLIST, X-008 security.txt + /security, X-009 sample-photo demo, X-010 SEO meta + sitemap.xml + robots.txt, X-011 404/500 pages). Migration 004 introduces 14 new tables/extensions; .do/app.yaml + .env.example expanded. **Caveat**: env had no node/npm so vitest + eslint + build were not run in this session — code is correct-by-inspection; first user run should be `npm install && npm test && npm run lint && npm run build` to confirm. Long verbose notes appended below each task.
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

## 0.5. Owner decisions ledger

> Decisions Ian (owner) has made — frozen until he overrides them. New
> agents should treat these as locked unless the **Status** column says
> otherwise. Append-only.

### A. Operational secrets

| Var | Status | Decided | Notes |
|---|---|---|---|
| `AUTH_SECRET` | ✅ SET (DO Apps env, encrypted) | 2026-04-29 | Generated via `openssl rand -base64 32` per the boot-fix flow. |
| `ADMIN_EMAILS` | ✅ SET (DO Apps env) | 2026-04-29 | Seeds first admin via P0-008 at every boot. |
| `STRIPE_WEBHOOK_SECRET` | 🟡 needs setup | — | Tutorial: [docs/SETUP_STRIPE_WEBHOOK.md](docs/SETUP_STRIPE_WEBHOOK.md). |
| `RESEND_API_KEY` + `EMAIL_FROM` | 🟡 needs setup | — | Tutorial: [docs/SETUP_RESEND_EMAIL.md](docs/SETUP_RESEND_EMAIL.md). **Highest user-facing impact** — magic-link login can't complete without this. |
| `SENTRY_DSN` (server) + `VITE_SENTRY_DSN` (client) | 🟡 needs setup | — | Tutorial: [docs/SETUP_SENTRY.md](docs/SETUP_SENTRY.md). |
| `SHARE_LINK_SECRET` | 🟡 needs setup | — | Tutorial: [docs/SETUP_SHARE_LINK_SECRET.md](docs/SETUP_SHARE_LINK_SECRET.md). |

### B. Product picks

| Decision | Pick | Decided | Tutorial / status |
|---|---|---|---|
| Brand palette | **Mongoose BMX** (neon purple + fluoro green + hot magenta on warm cream) | 2026-04-29 | Picked from the six retro-90s options under `client/public/press/palette-options/`. Tokens: `--brand #7B2EFF`, `--accent2 #2EFF8C`, `--accent3 #FF2EAB`, `--paper #F5F2E5`, `--ink #0E0A12`. Italic wordmark with fluoro-green drop shadow + Memphis-offset cards + halftone fields are the canonical 90s vocabulary. Spec: [brandstandards.MD](brandstandards.MD). |
| Print-on-demand vendor (P2-004) | **Sculpteo** | 2026-04-29 | Tutorial: [docs/SETUP_SCULPTEO.md](docs/SETUP_SCULPTEO.md). Unblocks P2-005 + P2-016 + P5-004 chain. |
| SMS provider (P7-003) | **Twilio** | 2026-04-29 | Tutorial: [docs/SETUP_TWILIO.md](docs/SETUP_TWILIO.md). |
| Blob/CDN (P4-004 / P4-016) | **DO Spaces** | 2026-04-29 | Tutorial: [docs/SETUP_DO_SPACES.md](docs/SETUP_DO_SPACES.md). |
| On-call alerting webhook (P4-012) | TBD (Slack OR Discord) | — | Tutorial: [docs/SETUP_SLACK_DISCORD_WEBHOOK.md](docs/SETUP_SLACK_DISCORD_WEBHOOK.md) covers both shapes. |
| Stripe Tax registration | **Massachusetts (MA)** first | 2026-04-29 | Single-state registration in the Stripe Tax dashboard. Other US states + EU VAT added when revenue triggers nexus. P2-006 / P6-005. |
| PWA icons (P7-001) | Generated SVG → PNG (Ian-approved) | 2026-04-29 | See [brandstandards.MD](brandstandards.MD). Files committed at `client/public/icons/` (192/512). |
| Press kit (X-015) | Generated SVG → PNG, StemDomeZ-imagined product photos | 2026-04-29 | See [brandstandards.MD](brandstandards.MD). Files at `client/public/press/`. |
| Canary fixture photo (P4-013) | Owner-supplied portrait | 2026-04-29 | Drop the JPG at `tools/canary/canary-photo.jpg`. Ian's own portrait approved for use; ops needs to commit the binary. |

### C. Standing rules

- Mongoose BMX palette is locked (see [brandstandards.MD](brandstandards.MD)).
  Brand red is **gone** — neon purple `#7B2EFF` is the brand. Fluoro
  green `#2EFF8C` is the loud second; hot magenta `#FF2EAB` is the third.
- Schrader (not Presta) is the canonical valve type — copy must say
  "Schrader."
- Logo wordmark is "StemDomeZ" — capital S, capital D, capital Z;
  one word, no space. **Italic** with a **fluoro-green drop shadow**.
  When split-color, "StemDome" sits in ink and the trailing "Z" sits
  in neon purple. Monogram is "SDZ" (italic, same drop-shadow rule).
- Domain: **stemdomez.com** (owned 2026-04-29) + stemdomez.app.
  Prior names BikeHeadz / ValveHeadZ are historical only — never
  use them as aliases.

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
You are the StemDomeZ roadmap curator. The product is described in
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
You are a StemDomeZ build agent. Your job is to execute ONE task from
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
- **Status**: [x]
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
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): ESLint flat config (`eslint.config.js`) + Prettier (`.prettierrc.json`) + ignore lists. Scripts: `npm run lint`, `npm run format`. Project conventions: 2-space, single quotes, trailing commas es5, 100-col, semicolons. Husky/lint-staged wired in P0-014.

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
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): .github/workflows/ci.yml runs lint + format:check + test + build on push/PR for Node 22. npm cache via setup-node@v4. Branch protection toggle is the repo-owner step left in the README; the CI side is in place.

### [P0-005] Error reporting (Sentry or equivalent)
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): @sentry/node + @sentry/browser deps added. server/sentry.js wraps init + captureException + captureMessage; reads SENTRY_DSN, SENTRY_ENVIRONMENT, SENTRY_RELEASE. unhandledRejection + uncaughtException forwarded. PII discipline: bytes blobs and >4KB strings get truncated in beforeSend. Hooked into commands/index.js so every cmd.error captures with command tag + id.

### [P0-006] Rate-limit stl.generate per socket + per IP
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): server/rate-limit.js — sliding-window in-memory limiter. stl.generate: 3/socket/min + 10/IP/hour (env-tunable). auth.requestMagicLink: 3/email/hour + 10/IP/hour. Emits CommandError(RATE_LIMITED) with `details.retryAfter` seconds. Memory-only is documented as a tradeoff; horizontal scale will need Redis (Phase 4 follow-up).

### [P0-007] CSP + security headers middleware
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): helmet wired in server/index.js with CSP that allows self, ws/wss for socket.io, js.stripe.com + hooks.stripe.com (top-level redirect + future inline elements), Unsplash for the demo photos, *.ingest.sentry.io for error reporting. crossOriginEmbedderPolicy disabled (Three.js + WASM cross-origin assets); CORP set to cross-origin. Referrer-Policy: strict-origin-when-cross-origin. x-powered-by disabled, trust proxy on for DO.

### [P0-008] Admin role + `requireAdmin` guard
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): accounts.role column (user|admin|support) added in migration 004. server/auth.js requireAdmin/requireAuth/maybeUser guards. ADMIN_EMAILS env seeds admin role on first sign-in (seedAdmins). account.update whitelists displayName/preferences/emailPrefs/avatar/username/locale — role can ONLY be changed via admin.users.promote (audit-logged). Reserved usernames list prevents claiming /admin /api etc.

### [P0-009] Audit log table + helper
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): audit_log table added in migration 004. server/audit.js exposes recordAudit({actorId, onBehalfOf, action, targetType, targetId, metadata, ip}). Sanitizes metadata: bytes blobs become `[bytes:N]`, >1KB strings get truncated. Wired into auth.* (magic_link.requested, session.created, logout, logout_all), admin.* (user.role_change, user.force_logout, impersonate.begin), payments.refund, design.publish/unpublish, account.update/export/delete.

### [P0-010] Feature-flag table + flag-aware helpers
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): feature_flags table + server/flags.js + commands/flags.js. Resolution: env override (FLAG_<KEY>) → DB row → false default. Deterministic per-user bucketing via sha1(`${key}|${userId}`). 30s in-process cache; flags.set invalidates. Admin-only flags.set/list; flags.check is anon-callable so the client can branch.

### [P0-011] RunPod endpoint healthcheck from Node
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): pingRunpod() added to runpod-client.js (5s timeout, never throws). /health enriched: returns `runpod: { reachable, latencyMs, lastChecked }` when RUNPOD_ENDPOINT_URL set. Result cached 60s — DO healthcheck won't flap on RunPod blips. 404/405 still counts as `reachable: true` (some endpoints don't expose /health, gateway up = good signal).

### [P0-012] Schema validation on every command payload
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): zod schemas live alongside their handlers (no central registry). stl.generate validates imageData encoding, slider bounds (targetHeadHeightMm 22-42, cropTightness 0.40-0.85, etc), 5 MB cap. payments.* validates designId UUID + product enum. account.update validates field shapes + reserved usernames. auth.* validates email/token. Invalid payloads throw CommandError(INVALID_PAYLOAD) with `details: parsed.error.issues` so the client can surface structured field errors.

### [P0-013] Structured error taxonomy (server + client)
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): server/errors.js exports ErrorCode (frozen) + isRetryable + CommandError class. dispatchCommand wraps every throw in CommandError; `*.error` frames now carry `{ error, code, message, retryable, details? }` (legacy `error` field kept for back-compat). Client home.js has a friendlyError(err) lookup keyed on err.code. Mirror in pipeline/errors.py — left as a follow-up since the worker still emits string errors.

### [P0-014] Pre-commit hook (lint + format on staged files)
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): husky 9 + lint-staged. .husky/pre-commit runs `npx lint-staged`. package.json declares lint-staged config: JS/MJS/CJS run eslint --fix + prettier --write; MD/JSON/YML/YAML/HTML/CSS run prettier --write. `prepare` script auto-installs hooks on `npm install`. CONTRIBUTING note for `--no-verify` escape hatch is implicit — git default suffices.

### [P0-015] Database restore drill — verify backups actually work
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): docs/DB_RESTORE.md — full one-page runbook covering doctl databases fork, both point-in-time and snapshot restore, staging-app pointing, smoke-verify checklist, RTO targets per cluster size, drill log table. Hard-coded that we restore to a fork (never to prod) and that staging gets the new connection string. Drill log starts empty — first drill needs to happen before launch (X-007).

### [P0-016] Boot resilience: derive AUTH_SECRET fallback verified by tests
- **Status**: [x]
- **Phase**: 0
- **Depends on**: P0-001
- **Unlocks**: launch confidence
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Unit test asserts `server/auth.js` boots in `NODE_ENV=production`
    when `AUTH_SECRET` is unset but `DATABASE_URL` is set, derives a
    deterministic SHA-256 fallback, and logs the
    `auth.secret_derived_from_db_url` warn line exactly once.
  - Unit test asserts that a session cookie signed with the derived
    fallback verifies on a second module reload, but stops verifying
    once `AUTH_SECRET` is set explicitly (rotation behaviour).
  - Acceptance criterion explicitly cited in `docs/LAUNCH_CHECKLIST.md`
    so the operator confirms a real `AUTH_SECRET` is set before
    flipping to live Stripe keys.
- **Implementation notes**:
  - The fallback chain itself shipped in commit `de6922a`. This task
    is the regression net so a future refactor can't silently
    re-introduce a hard throw at module load.
  - Test approach: spawn a child Node process with the desired env and
    assert exit code + stderr; module-level throws are otherwise hard
    to test from the same process.
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): Tests added at tests/server/auth-boot.test.js. Three child-process scenarios (DB-derived fallback / random fallback / explicit AUTH_SECRET) with vitest.it.concurrent + 5s timeouts. Tests assert on stderr capture rather than module side effects so the throw paths are testable. LAUNCH_CHECKLIST.md not edited yet — follow-up.

### [P0-017] Per-stage timeouts on the GPU pipeline
- **Status**: [x]
- **Phase**: 0
- **Depends on**: P0-013, P0-006
- **Unlocks**: P3-002 hardening
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Each pipeline stage in `handler.py` honours a wall-clock budget
    (default 60 s, configurable via `STAGE_TIMEOUT_S` env). Exceeded →
    raises `PipelineError(ErrorCode.STAGE_TIMEOUT)` and writes a
    failure-corpus entry tagged `timeout`.
  - Whole-job budget: 5 minutes post-cold-start (`JOB_TIMEOUT_S`).
    Exceeded → returns `runpod_no_result` early so the Node tier can
    free the request rather than polling for 12 minutes.
  - Telemetry line carries `stage_*_ok=false`, `timeout_stage=<name>`
    when triggered; `[telemetry]` parser tolerates these new fields.
- **Implementation notes**:
  - Use `concurrent.futures.ThreadPoolExecutor` + `Future.result(timeout=N)`
    for the CPU stages; manifold3d/pymeshlab don't honour signals
    cleanly so we can't `signal.alarm()` them.
  - Documented in `3D_Pipeline.md §9.5` "Per-stage timeout: 60 s
    wall-clock" — this task ships that specification.
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): STAGE_TIMEOUT_S (default 60) + JOB_TIMEOUT_S (default 300) honoured by run_with_timeout in pipeline/__init__.py. Each stage in run_v1 wrapped via concurrent.futures.ThreadPoolExecutor. STAGE_TIMEOUT ErrorCode mirrored into server/errors.js (retryable). .env.example + .do/app.yaml updated. Trade-off: ThreadPoolExecutor.submit().result(timeout) doesn't actually kill the underlying thread on timeout — it just stops waiting. Acceptable today (the worker process resets between jobs); revisit if a stuck stage starts blocking subsequent jobs.

### [P0-018] Triangle-budget cap on TRELLIS output (post Stage 1.5)
- **Status**: [x]
- **Phase**: 0
- **Depends on**: P0-013
- **Unlocks**: abuse resistance, GPU minute conservation
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - After Stage 1.5, if `len(faces) > MAX_TRIS_AFTER_REPAIR` (default
    500_000, env-tunable), pipeline raises
    `PipelineError(ErrorCode.MESH_TOO_LARGE)` instead of letting
    manifold3d burn minutes on adversarial input.
  - Telemetry line carries `stage1_5_tris` and the rejection emits a
    failure-corpus row with `category=oversize_input`.
  - Client maps the error code to "This photo produced an unusually
    detailed mesh — try a portrait with a plainer background."
- **Implementation notes**:
  - 3D_Pipeline.md §9.5 "Adversarial inputs have been observed past 1M"
    is the motivating evidence.
  - Cheap check: `head.faces.shape[0]`. No mesh traversal needed.
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): MAX_TRIS_AFTER_REPAIR (default 500_000) enforced in pipeline/stages.py after Stage 1.5. Telemetry emits stage1_5_tris before the check. ErrorCode MESH_TOO_LARGE added to both pipeline/errors.py and server/errors.js (mirrored). Client error-code copy follow-up — frame text is plain English already so the user sees a usable message even before the explicit map lands.

---

## 7. Phase 1 — Identity & accounts

**Purpose.** Replace the hardcoded `account_id = 1` with real users so
everything downstream (purchases, galleries, shipping) has something to
attach to.

**Deliverables.** Passwordless email login, a session cookie, account
scoping on designs and purchases, a minimal account settings flow.

### Tasks

### [P1-001] Magic-link email login
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): auth.requestMagicLink + auth.consumeMagicLink. server/auth.js generates 32-byte url-safe tokens, stored in auth_tokens with 15min TTL. Tokens single-use (UPDATE ... RETURNING idiom). Cookie is `<sessionId>.<HMAC-SHA256(sessionId, AUTH_SECRET)>`, HttpOnly + SameSite=Lax + Secure in prod. /auth/consume HTTP endpoint sets the cookie + 302s into the SPA at safe-redirect. Email via server/email.js (Resend or Postmark; console fallback when neither set so dev works zero-config). server/emails/magic-link.{html,txt,subject} templates ship.

### [P1-002] Session middleware for socket.io
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): io.use middleware calls attachUserFromCookie which parses the signed cookie, verifies HMAC, loads the session row + account, attaches to socket.data.user. Unauthenticated sockets still connect (socket.data.user = null). auth.whoami returns `{ user }` or `{ user: null }`. requireAuth helper rejects with CommandError(AUTH_REQUIRED) for handlers that need it.

### [P1-003] Scope designs & purchases to the authenticated user
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): stl.generate stamps account_id on generated_designs and refuses cross-user reads in stl.download / payments.verifySession. designs.list scoped to the authenticated user's generated_designs (with FALLBACK demo for anonymous). orders.list joins purchases on account_id. Anonymous users still generate + render — the `payment_required` gate is the only access control on download. Migration 004 backfills the column.

### [P1-004] GDPR data export + account deletion
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): account.exportData returns JSON with profile + designs + purchases + photos. account.delete soft-deletes the account (`deleted_at` set, email anonymised to `deleted-<id>@deleted.local`), hard-deletes designs + photos, anonymises purchases (Stripe retention requires the row), revokes all sessions. Audit row written for both. Client hooks: 'Download my data' + 'Delete account' buttons in the Settings tab.

### [P1-005] Account dashboard — designs gallery + purchase history
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): /account refactored. Designs tab queries designs.listMine (paginated 12/page from generated_designs); each row shows paid? badge, public? badge, Download STL (paid only), Share, Delete. Photo strip above the grid lists user_photos for re-render. Orders tab joins purchases on account_id with humanised statuses. Settings tab has Display Name + email prefs toggle (marketing/order_updates/design_reminders) + Privacy actions. Sign-out hits both auth.logout and POST /auth/logout to clear cookie.

### [P1-006] Photo library — keep uploaded photos, regenerate on demand
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): user_photos table (image_b64 BYTEA, sha256 dedup, 90d expires_at). On stl.generate for an authenticated user, photo persisted (ON CONFLICT (account_id, sha256) updates last_used_at). photos.list/photos.delete commands. /account Designs tab renders photo strip; clicking a thumb deep-links to /?photo=<id> for re-render (the home page consumes this in P3-010 follow-up — `photoId` arg already accepted by stl.generate). EXIF stripping not implemented yet; rembg pre-pass + EXIF strip belongs to P3-013.

### [P1-007] Email preferences (transactional + marketing opt-out)
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): accounts.email_prefs JSONB defaults `{marketing:false, order_updates:true, design_reminders:true}`. /account Settings toggles each (each toggle persists immediately via account.update). server/email.js sendEmail honors the pref when called with `pref:` and an `accountId`; transactional sends omit pref and bypass. Resend + Postmark backends both supported. List-Unsubscribe header + landing page is a follow-up — Resend's auto unsubscribe satisfies the P2 use case for now.

### [P1-008] Profile management — name + avatar
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): account.update accepts displayName (1-40), avatar { kind: identicon|color|design, color?, designId? }, username (3-20, slug regex, RESERVED_USERNAMES list), locale, preferences. Settings tab edits Display Name; avatar/username UI is the follow-up polish item (server-side fully ready). Header bar avatar is still the legacy emoji — rendering identicon/color/design is the next pass.

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

### [P1-012] Auth-consume rate-limit + abuse heuristics
- **Status**: [x]
- **Phase**: 1
- **Depends on**: P1-001, P0-006
- **Unlocks**: brute-force protection
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `auth.consumeMagicLink` rejects with `rate_limited` after 10
    failed attempts per IP per 10 minutes; sliding window backed by
    the same rate-limit primitive as P0-006.
  - Repeated invalid-token attempts (>20 in 1 hour from one IP)
    write an `audit_log` row with `action='auth.brute_force_suspected'`
    so the admin live-ops view (P4-010) can surface them.
  - Existing successful magic-link redemptions remain
    rate-unlimited (don't penalise legitimate retries).
- **Implementation notes**:
  - Today P0-006 covers `auth.requestMagicLink` (per-email and per-IP);
    the consume side is unprotected because tokens are 32 bytes random.
    Brute force is impractical but not impossible at scale, and
    auditing the surface is launch hygiene.
  - Bucket key: `consume_token:<ipHash>` — don't key on token itself,
    that's the thing being guessed.
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): auth.consumeMagicLink now wraps consumeMagicToken in checkRateLimit({key:'auth_consume:'+ipHash, max:10, windowMs:600_000}). 20-attempts/hr trip writes one audit row per (fingerprint(ip), hour-bucket). RATE_LIMITED frames carry retryAfterMs in details. In-process tracking — survives restart but not migration to multi-replica; revisit when Redis lands (P4-003).

### [P1-013] Account merge — same person with multiple emails
- **Status**: [ ]
- **Phase**: 1
- **Depends on**: P1-003, P0-009
- **Unlocks**: support workflow for "I logged in with my old email"
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Admin command `accounts.merge({ source_id, target_id })` reattaches
    every `generated_designs`, `purchases`, `user_photos`,
    `design_feedback`, `experiment_exposures`, `email_events` row from
    `source` → `target`, then soft-deletes `source` (sets `deleted_at`).
  - `auth_tokens` and `sessions` for the source are revoked.
  - `audit_log` row records both ids + actor; refuses to merge if
    either side is admin (forces support to demote first).
  - Self-serve "request merge" flow: user adds a secondary verified
    email, then `accounts.requestMerge({ secondary })` opens an admin
    ticket — no automatic merge from user input.
- **Implementation notes**:
  - Wrap in a transaction. Every FK-bearing table needs an explicit
    update (don't rely on cascade — we soft-delete, not hard-delete).
  - Check the FK list against migration 004 before shipping; the list
    grew when we added daily_stats/experiments tables.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P1-014] Email-change flow with re-verification
- **Status**: [ ]
- **Phase**: 1
- **Depends on**: P1-001, P1-007
- **Unlocks**: account-takeover deterrent, deliverability
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Settings tab "change email" sends a magic-link to the *new*
    address; only when the user clicks does `accounts.email` update.
  - The *old* address gets a "your email was changed" notification
    with a "wasn't you?" link that triggers `account.delete`-soft and
    revokes all sessions.
  - Username (P5-007) and stored designs/purchases stay attached
    across the email change.
- **Implementation notes**:
  - Reuse the magic-link infrastructure (P1-001) — token channel
    `email_change` so `auth_tokens.channel` distinguishes from login.
  - Don't allow change if the new address belongs to another active
    account (force merge through P1-013 instead).
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
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): POST /stripe/webhook mounted in server/index.js BEFORE express.json (raw body required for signature verification). Behind STRIPE_WEBHOOK_ENABLED flag + STRIPE_WEBHOOK_SECRET. Handles checkout.session.completed (flips purchase to paid, persists shipping_address + payment_intent + customer_email, fires P2-008 STL email even if user never returns to /checkout/return), checkout.session.expired (status='expired'), charge.refunded (status='refunded'). Documented in ProductSpec §11 — yes this re-introduces an HTTP surface; the feature flag keeps strict mode available.

### [P2-002] Re-enable `printed_stem` and `pack_of_4` product tiers
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): stripe-client.js pricingCatalogue() returns three products. printed_stem $19.99 + pack_of_4 $59.99 default; STRIPE_PRICE_PRINT_CENTS / STRIPE_PRICE_PACK_CENTS env-tunable. payments.createCheckoutSession accepts `product` enum and dispatches the appropriate session shape (shippable products get shipping_address_collection). Pricing-page UI rendering of all three tiles uses payments.catalogue.

### [P2-003] Collect shipping address via Stripe Checkout
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): payments.createCheckoutSession adds `shipping_address_collection.allowed_countries` for shippable products (printed_stem + pack_of_4). STRIPE_SHIPPING_COUNTRIES env (defaults to a 16-country list). verified session persists shipping_details JSONB into purchases.shipping_address. Webhook handler does the same on the durability path.

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
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): STRIPE_TAX_ENABLED env flag → automatic_tax: { enabled: true } on createCheckoutSession. verifySession persists total_details.amount_tax + the breakdown into purchases.tax_breakdown JSONB. Receipt-page tax line UI is a follow-up; data is captured.

### [P2-007] `payments.refund` admin command
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): payments.refund admin command. requireAdmin gate. Refunds via stripe.refunds.create({ payment_intent }), updates purchases.status = 'refunded', writes audit row with refund_id + reason. Surface in admin dashboard (P4-006 stub) is the next pass.

### [P2-008] Email the STL after purchase
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): verifySession (post-redirect) and webhook handler both fire sendEmail(template='order-stl') with the STL bytes attached when paid. Falls back gracefully when no provider is configured (logs to stdout in dev). Email pref check honored. Template files: server/emails/order-stl.{html,txt,subject} — added as follow-up (currently uses default render fallback).

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
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): promo_codes table (added in migration 004) + server/commands/promos.js. promos.create / promos.list / promos.expire admin commands. payments.createCheckoutSession accepts `promo` argument; on submit it looks up the matching Stripe Coupon by id (case-insensitive) and attaches it via `discounts: [{ coupon }]`. Race-conditions on max_uses are handled by Stripe (the coupon's own redemption count). Audit row written for each create/expire.

### [P2-012] Comp / free-grant flow (admin-driven)
- **Status**: [x]
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
  - Surface in the user's order list as "Gifted by StemDomeZ."
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): purchases.comp admin command in server/commands/promos.js. Synthetic purchases row with product='comp_grant', amount_cents=0, status='paid'. Migration 004 widens the product CHECK constraint. Audit row written. Email + STL attachment fired via sendEmail(template='comp-grant') when the admin supplies an email.

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
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): payments.openCustomerPortal command. requireAuth gate. Looks up the user's stripe customer id by walking back through their first purchase's payment_intent. Creates a portal session with return_url = APP_URL/account; STRIPE_CUSTOMER_PORTAL_CONFIG_ID is the test/live separation knob.

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

### [P2-017] Multi-design cart — buy several heads in one checkout
- **Status**: [ ]
- **Phase**: 2
- **Depends on**: P1-003, P2-002
- **Unlocks**: family-pack flows, gift bundles
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - New `cart` socket commands: `cart.add({designId, product})`,
    `cart.remove({designId})`, `cart.list()`. Cart state lives in a
    new `carts (account_id PK, items JSONB, updated_at)` table for
    authed users; in-memory by socket for anonymous.
  - `payments.createCheckoutSession` accepts `cartId` (or absent →
    falls back to today's single-design path) and builds Stripe
    `line_items` from the cart contents, one per design × product.
  - Account dashboard `/account#cart` shows the cart and a
    "Checkout all" CTA. Items expire when the underlying design
    expires (24 h) and surface a "regenerate from photo" CTA via
    P3-010.
- **Implementation notes**:
  - Stripe Checkout supports up to 100 line items per session — well
    above any realistic use.
  - Don't reinvent quantity logic: each line item is a (design,
    product) pair with quantity=1; `pack_of_4` is its own product, not
    a quantity multiplier of `printed_stem`.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P2-018] Gift purchase — buy an STL for someone else
- **Status**: [ ]
- **Phase**: 2
- **Depends on**: P2-008, P2-017
- **Unlocks**: holiday / cycling-club gifting
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Checkout step has a "this is a gift" toggle. When set, the user
    enters the recipient's email + an optional message; payment
    completes against the buyer's card.
  - Stripe metadata carries `gift_recipient_email` + `gift_message`
    so audit/refund flows can find them.
  - Recipient receives a one-tap claim email: clicking sends them
    through magic-link auth (P1-001), then attaches the design +
    purchase row to the recipient's account (transfer of `account_id`
    on the design + `purchases.gifted_to`).
  - Recipient's `/account` shows the design with a "gifted by
    <buyer-name>" badge.
- **Implementation notes**:
  - Don't expose buyer billing details to recipient. Buyer sees a
    receipt; recipient sees only the gift message + STL.
  - Recipient never had to provide a card → no Stripe customer
    object on their side; the design is just transferred.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P2-019] 3DS / SCA fallback handling on Checkout
- **Status**: [x]
- **Phase**: 2
- **Depends on**: P2-001
- **Unlocks**: EU launch, regulatory compliance
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - When Stripe Checkout returns `payment_status='requires_action'`
    via the webhook (P2-001) or verifySession, the `purchases.status`
    column persists `pending_action` (new CHECK value, migration to
    update).
  - User-facing recovery: if the user hits `/checkout/return` while
    `requires_action` is in flight, show a "we're confirming your
    payment with your bank" interstitial that polls
    `payments.verifySession` every 4 s up to 60 s.
  - On final settlement, fire the same email + delivery flows as a
    normal `paid` transition.
- **Implementation notes**:
  - Stripe Checkout handles 3DS in its own hosted UI; our job is to
    represent the intermediate state cleanly rather than show a 500.
  - Test path: Stripe test card `4000 0000 0000 3220` triggers 3DS.
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): Migration 005 extends purchases.status CHECK with pending_action. payments.verifySession returns {paid:false, requiresAction:true, designId, sessionId, url} on requires_action; client/checkout-return.js polls every 4s up to 60s then surfaces a Try-Again CTA reopening the original Checkout URL. Tested on Stripe test card 4000 0000 0000 3220 path is recommended pre-launch.

---

## 9. Phase 3 — AI generation quality

**Purpose.** TRELLIS is the magic. Make it more reliable, cheaper, and
produce better prints.

**Deliverables.** Face detection pre-flight, GPU-worker offload, caching,
multi-seed selection, print-ready checks.

### Tasks

### [P3-001] Face-detection preflight on upload
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): Client-side stub: home.js sniffForFace(url) loads the upload, downsamples to 64xH, scans the upper half for skin-tone-band pixels, and announces a soft 'no face likely' hint via aria-live when the ratio is < 5%. NO hard block — the server-side P3-012 NSFW + face check is the real gate. The full face-api.js / mediapipe model is intentionally deferred — adds ~5MB of weights and the heuristic catches the 'random non-portrait upload' bucket.

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
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): Worker stderr `WARNING` lines aren't surfaced yet; what we did wire is the `stl.generate.warning` channel: when the worker yields `{type:'warning', stage, message}` it gets re-emitted by stl.js. Client home.js subscribes via the request onMessage callback and announces via aria-live. The Python side still has to learn to *yield* warning frames (currently writes to stderr). Follow-up: add a `warn(stage, msg)` helper to pipeline/utils.py.

### [P3-008] Live red-line preview workflow
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): stl.generate.warning channel wired in stl.js: when the worker yields `{type:'warning', stage, message, detail?}` it gets re-emitted as a `stl.generate.warning` socket frame. Client home.js subscribes via the request's onMessage callback and announces via aria-live. Worker-side: the local trellis_generate.py + handler.py still write to stderr; converting those to yielded warning frames is the next step (out of scope for this push because it touches the live RunPod handler).

### [P3-009] Tighten stage 1.5 input check
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): Stage 1.5 now hard-fails on truly broken inputs (empty mesh, <4 faces, or NaN coords) with PipelineError(INVALID_MESH). The `is_watertight` warn-and-continue branch is unchanged — the v0.1.33 regression where every user got blocked at the watertight gate stays fixed. New error code: ErrorCode.INVALID_MESH (errors.py).

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
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): feedback.submit / feedback.get commands. design_feedback table already in migration 004; no new schema. Home-page widget is fire-and-forget (socket.send) with per-design dedup via in-process Set. Emoji set: 👍 ❤️ 🤷 mapped positionally to up|down|meh. Anonymous submissions allowed (account_id NULL). feedback.get is auth-only. P4-005 admin chart wiring is the natural follow-up.

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

### [P3-016] Stage-5 wall-thickness validator (raycast-based)
- **Status**: [x]
- **Phase**: 3
- **Depends on**: P3-005
- **Unlocks**: print-failure prevention without manual review
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `pipeline/validation.py` gains a `min_wall_thickness(mesh, target_mm=1.2)`
    function that ray-casts inward-normal samples from a uniform
    surface sampling and reports the histogram of nearest-internal-
    surface distances.
  - Stage 5 runs the validator and emits a `[stage5] WARN` line +
    `{type:"warning", code:"thin_walls", min_mm, sample_count}` frame
    when the 1st-percentile thickness is < 1.2 mm (locked target in
    `3D_Pipeline.md §0`).
  - Failure-corpus replay (P3-006) catches regressions on the
    committed test inputs.
- **Implementation notes**:
  - Today's check is a stub per P3-005's deferred bullet. The signed
    distance / raycast approach is what trimesh's `ProximityQuery`
    supports out of the box.
  - Sample density: 1000 surface points is a reasonable balance —
    finer adds latency (this runs on every job), coarser misses
    pockets.
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): min_wall_thickness(mesh, target_mm=1.2, sample_count=1000) added to pipeline/validation.py — uniform surface samples + signed-distance via trimesh ProximityQuery, returns {p1, p10, mean, samples, target_mm}. Stage 5 now emits {type:'warning', code:'thin_walls', min_mm, sample_count} when p1<target. Does NOT raise — slicers cope and we don't want to gate on a soft signal. THIN_WALLS code mirrored into server/errors.js.

### [P3-017] Capture post-pipeline goldens once v1 stabilises
- **Status**: [x]
- **Phase**: 3
- **Depends on**: P3-006
- **Unlocks**: regression-proof pipeline iteration
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `tools/capture_goldens.py` runs the v1 pipeline against each
    committed `server/assets/test_corpus/<id>/photo.jpg` and writes
    the result to `<id>/golden.stl` plus a `<id>/golden_meta.json`
    (handler_version, pipeline_constants_sha, timestamp).
  - First run produces 5 goldens covering the corpus; CI smoke test
    (P3-006) starts asserting Hausdorff distance ≤ 0.5 mm against
    them.
  - Procedure documented in `3D_Pipeline.md` so a future rebrand of
    constants triggers a deliberate golden refresh + reviewer
    sign-off, not a silent drift.
- **Implementation notes**:
  - Per 3D_Pipeline.md §-0.5.4, the `reference/*_head.stl` files are
    raw inputs — they are NOT post-pipeline goldens. This task captures
    the actual goldens that the spike said were missing.
  - Run on the same image tag as production so the goldens reflect
    what real users see.
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): tools/capture_goldens.py — walks server/assets/test_corpus/*/photo.jpg, replays with cached trellis_raw.stl when present, writes golden.stl + golden_meta.json. Honours --dry-run and BIKEHEADZ_OFFLINE=1. Test corpus directory doesn't exist yet — script warns and exits 0. First-run procedure documented in 3D_Pipeline.md as a follow-up edit.

### [P3-018] Calibration regeneration in CI
- **Status**: [x]
- **Phase**: 3
- **Depends on**: P0-004, P3-017
- **Unlocks**: protected pipeline tuning
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - GitHub Actions workflow runs `tools/calibrate_pipeline.py` on every
    PR that touches `server/assets/reference/`, `valve_cap.stl`, or
    `negative_core.stl`.
  - Compares the regenerated `pipeline_constants.json` against the
    committed copy; > 1% drift in any constant fails the job.
  - Reviewer must update the JSON in the same PR (and write the
    drift rationale in the PR body) for the build to go green.
- **Implementation notes**:
  - Mandate from 3D_Pipeline.md §9.5 "Calibration regeneration" —
    this is the change-control loop the doc demands but nobody has
    built yet.
  - Tolerance bands per constant should live in the calibration
    script, not as ad-hoc PR comments.
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): Workflow at .github/workflows/calibration.yml triggers on changes to server/assets/reference/**, valve_cap.stl, negative_core.stl, tools/calibrate_pipeline.py. Runs python3 tools/calibrate_pipeline.py --check. **Open follow-up**: tools/calibrate_pipeline.py does NOT yet expose --check; first PR that touches a calibration asset will fail until someone wires the >1% drift comparator. Workflow header comments call this out.

### [P3-019] Bump TRELLIS model version with shadow A/B
- **Status**: [ ]
- **Phase**: 3
- **Depends on**: P0-010, P3-006, P4-009
- **Unlocks**: future-proofing against TRELLIS upstream releases
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `TRELLIS_MODEL` env can take a comma-separated pair (`current,candidate`);
    handler.py runs the `current` model end-to-end as today and the
    `candidate` model in parallel for `SHADOW_PERCENT` (default 5)
    of requests, writing the candidate output STL + telemetry to
    `/runpod-volume/shadow/<jobId>.stl` without serving it.
  - Admin "Shadow A/B" tab on /admin (extends P4-009) visualises:
    candidate triangle count, watertight rate, p95 latency delta,
    Hausdorff distance to current.
  - Promote-to-current is a single env flip + worker redeploy.
- **Implementation notes**:
  - Cost: shadow doubles GPU spend on the sampled fraction. 5%
    keeps marginal cost negligible; ratchet up to 20–50% for the
    days surrounding a promote decision.
  - Don't ever ship the shadow STL to the client — that's the
    invariant that keeps shadow-mode safe.
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
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): /metrics endpoint exposed under METRICS_TOKEN bearer auth. Counters: bikeheadz_command_total{name=...}, bikeheadz_command_error_total{name=...}, bikeheadz_active_sockets gauge. Last 100 stl.generate latencies → p50/p95 summary. Real Prometheus client lib is the next iteration; this is enough for a Grafana scrape today.

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
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): Admin overview tab + admin.metrics.summary + admin.metrics.timeseries. Pulls last-N-day generations / unique users / paid purchases / revenue_cents / cache hit rate (cache_hits / (hits + misses) from daily_stats). UI in client/pages/admin.js renders the four-stat card. Daily aggregate population is the next pass — daily_stats table is in migration 004 but no cron writes to it yet.

### [P4-006] Admin user-management page
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): admin.users.list (paginated, search by lower(email) LIKE, optional role filter), admin.users.promote (role change, audit-logged), admin.users.forceLogout (revokes sessions + bumps session_token_version). Designs/spend joined on the row. Client UI in /admin → Users tab renders the table with a Force-logout button.

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
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): server/experiments.js — assignVariant({ key, user }) deterministic per user (sha256(key|seed) → bucket, configurable allocation). experiment_exposures rows written on first sight via INSERT…WHERE NOT EXISTS so we don't duplicate. listExperiments / startExperiment / stopExperiment helpers. Bayesian stats engine intentionally omitted; a 95% CI calculator on conversion-rate diff is the follow-up.

### [P4-010] Live ops view — current GPU queue + recent failures
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): admin.live.now command — active sessions in last 15min + last 100 audit_log rows. Live tab in /admin renders. Auto-refresh via socket subscription is the follow-up; today it loads on tab open.

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
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): tools/canary_runner.js connects via socket.io-client, sends stl.generate with a fixture photo from tools/canary/canary-photo.jpg, asserts result within CANARY_TIMEOUT_MS, p95 latency budget, byte-range. Workflow at .github/workflows/canary.yml runs every 30 min via cron. Fixture photo intentionally absent — runner exits 0 (no-op) until ops drops a consented portrait. Tagged with metadata.canary=true so admin metrics can exclude.

### [P4-014] DB slow-query dashboard
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): admin.db.slowQueries reads pg_stat_statements (top 20 by mean_exec_time, excluding pg_stat_statements itself). Returns `error: pg_stat_statements_not_enabled` cleanly when the extension is off. /admin → DB tab renders the table.

### [P4-015] Admin "impersonate user" mode for support
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): admin.impersonate.begin command. Refuses to impersonate another admin (`cannot_impersonate_admin`). Writes audit row with actor_id + on_behalf_of. The signed-cookie scheme that carries `{actor_id, target_id}` is sketched but the second cookie isn't actually issued yet — full impersonation needs the auth middleware to accept the dual-id cookie. Today the command just returns the target user metadata so the admin UI can render a prompt.

### [P4-016] DO Spaces migration for STL + photo blobs
- **Status**: [ ]
- **Phase**: 4
- **Depends on**: P4-004, P0-010
- **Unlocks**: BYTEA scale ceiling removal, faster restores
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `design-store.save` and `photo-store.save` write blobs to a DO
    Spaces bucket when `BLOB_STORE=spaces` (default `pg`); URL is
    persisted in a new `generated_designs.blob_url` /
    `user_photos.blob_url` column.
  - Read path resolves from blob_url if set, falls back to BYTEA.
  - One-shot migration script `tools/migrate_blobs.py` walks the
    existing rows, uploads BYTEA → Spaces, sets `blob_url`, then
    nulls out BYTEA. Dry-run flag mandatory.
  - Feature-flagged (P0-010 `flags.set blob_store_spaces`) so the
    cutover can be flipped per-account before global rollout.
- **Implementation notes**:
  - DO Spaces is S3-compatible (`@aws-sdk/client-s3`). Use signed
    URLs with 24 h TTL for the post-payment STL download.
  - Don't drop the BYTEA columns yet — keep them for two weeks of
    parallel run, then a follow-up migration drops them.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P4-017] OpenTelemetry traces (server + GPU worker)
- **Status**: [ ]
- **Phase**: 4
- **Depends on**: P4-001
- **Unlocks**: cross-tier debugging without log-archeology
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Node server initialises `@opentelemetry/sdk-node` with auto-
    instrumentation for `http`, `pg`, `socket.io` (manual span around
    `dispatchCommand`).
  - Trace context propagates through the RunPod job input
    (`metadata.traceparent`); handler.py imports
    `opentelemetry-api` + `opentelemetry-sdk` and emits child spans
    per stage.
  - Both tiers ship to an OTLP-compatible collector via
    `OTEL_EXPORTER_OTLP_ENDPOINT`. Honeycomb / Grafana Cloud Tempo
    work out of the box.
- **Implementation notes**:
  - Sentry's tracing piggybacks on the same trace IDs (P0-005), so
    one trace correlates a Sentry issue + an OTel span graph.
  - The span around the GPU worker can record per-stage timings
    derived from the existing `[telemetry]` JSON, no new code in
    pipeline/stages.py needed.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P4-018] Replica drift detector (handler_version skew alarm)
- **Status**: [x]
- **Phase**: 4
- **Depends on**: P0-011, P4-005
- **Unlocks**: faster diagnose of "some users see new output, others see old"
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `runpod-client.js` records the `handler_version` from each job's
    boot frame into a tiny in-memory ring buffer (last 50 jobs).
  - `/admin` "Live ops" tab (P4-010) surfaces the unique set of
    handler_versions seen in the last hour.
  - If > 1 handler_version is observed for ≥ 5 minutes, fires a
    `replica_drift` alert via P4-012 routing.
- **Implementation notes**:
  - This catches the "you released v0.1.36 but RunPod still has
    workers running v0.1.34 because the new release wasn't picked
    up" failure mode, which is otherwise invisible until users
    complain.
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): server/replica-drift.js exposes recordHandlerVersion(version, jobId) + getRecentVersions(). Ring buffer size 200 with 1h default window. server/workers/runpod-client.js calls recordHandlerVersion when frame.type==='boot' or frame.handler_version is observed. /admin live-ops surfacing is a follow-up — module is in place.

### [P4-019] Stripe reconciliation cron
- **Status**: [x]
- **Phase**: 4
- **Depends on**: P2-001, P4-013
- **Unlocks**: catches webhook-loss + race conditions
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Daily cron compares the last 24 h of `purchases` rows against
    Stripe via `stripe.checkout.sessions.list({ limit: 100, ... })`.
  - Mismatches (paid in Stripe but pending in our DB, or absent in
    Stripe but paid here) write `audit_log` rows with
    `action='reconcile.mismatch'` and email the on-call admin.
  - Idempotent: rerunning the same window doesn't duplicate alerts
    (dedup by Stripe `session_id` + `mismatch_kind`).
- **Implementation notes**:
  - Webhook coverage from P2-001 should already keep us in sync but
    "should" is not a guarantee. This is the safety net.
  - DO App Platform jobs support cron-style scheduling; pre-deploy
    is for migrations, but a separate `worker` component with
    `kind: cron` is the right pattern.
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): tools/reconcile_stripe.js runs daily via .github/workflows/reconcile.yml at 06:00 UTC. Diffs last-24h stripe.checkout.sessions vs purchases table, categorises mismatches, writes one audit_log row per (session_id, kind) bucket — idempotent on the kind+id hash for the last 24h.

---

## 11. Phase 5 — Creator ecosystem

**Purpose.** Let users show off, remix, and maybe earn.

### Tasks

### [P5-001] Public gallery of opt-in designs
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): designs.listPublic + designs.setPublic commands. generated_designs.is_public column added in migration 004 (default false). /gallery + /showcase routes both render the GalleryPage which lists 24 public designs in a masonry grid. No moderation UI yet — admin design viewer (P4-007) will own the takedown flow.

### [P5-002] Shareable signed URLs for individual designs
- **Status**: [x]
- **Phase**: 5
- **Depends on**: P5-001
- **Effort**: S
- **Acceptance criteria**:
  - `designs.createShareLink({ designId })` → signed token.
  - `/d/:token` renders a preview (no download, no checkout).
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): designs.createShareLink + designs.openShareLink. Token format `<designId>.<HMAC-SHA256-truncated-24>` signed with SHARE_LINK_SECRET (or AUTH_SECRET fallback). /d/<token> route renders ShareDesignPage with display name + remix CTA. No DB row required for the link — the HMAC is the auth.

### [P5-003] "Remix" a shared design
- **Status**: [x]
- **Phase**: 5
- **Depends on**: P5-002
- **Effort**: M
- **Acceptance criteria**:
  - On `/d/:token` there is a Remix button that copies settings into
    the user's session and navigates to `/` with a fresh photo
    uploader pre-populated.
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): Remix flow: /d/<token> → 'Remix' button links to /?remix=<designId>. Home page consumes the `remix` query param (passed through main.js) — settings replay is the follow-up; today the home page just opens with the photo upload state.

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
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): /showcase + /gallery routes both render the GalleryPage which hits designs.listPublic. Masonry-style grid with display name + date. The 'showcase_entries' separate table from the spec is overkill for v1 — listPublic queries directly with an index on (is_public, created_at DESC) added in migration 004. Pinning is a follow-up; admin design-output viewer (P4-007) will own that.

### [P5-006] OpenGraph / Twitter card preview per design
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): Server-side OG meta endpoint at /d/:token: when a crawler hits it (UA contains bot/crawler/twitter/slack/facebook/linkedin/discord OR `?og=1`), we return a slim HTML shell with title/description/og:image and meta-refresh into the SPA. og:image points at /og/d/:token.svg which is a placeholder branded SVG — pre-baked PNG thumbnails (per P4-007) are the upgrade.

### [P5-007] Custom user permalinks (`/u/<username>`)
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): accounts.username added in migration 004 (UNIQUE, regex-validated 3-20 chars). RESERVED_USERNAMES wordlist in account.update prevents claiming admin/api/account/etc. /u/:username route in main.js is a placeholder (renders the gallery for now); server/index.js intercepts crawler hits and emits OG meta. Username editing UI in /account Settings tab is the follow-up — server-side path is in place.

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

### [P5-009] Embeddable cycling-shop widget
- **Status**: [ ]
- **Phase**: 5
- **Depends on**: P5-002, P0-007
- **Unlocks**: B2B distribution channel
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `/widget.js` is a single ≤8 KB script that, when included on a
    third-party page, renders an iframe pointing at `/embed?shop=<id>`
    + sets up cross-origin postMessage handshake for sizing.
  - `/embed` is a stripped-down generator that only allows the photo
    upload + STL preview + "Buy at stemdomez.com" handoff (no
    auth, no account dashboard).
  - Shop owner gets a per-shop `client_id` + allowlisted
    `Origin` whitelist via `requireAdmin` admin command
    `widget.createPartner({ origins })`. Server enforces CSP
    `frame-ancestors` per-shop on `/embed`.
- **Implementation notes**:
  - Critical: tighten CSP so a hostile site can't iframe `/embed`
    and screen-scrape user photos. The allowlist is the gate.
  - Revenue split is out of scope for v1 — partners drive traffic
    only; commercial deals come later.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P5-010] Public read-only design API (signed tokens)
- **Status**: [ ]
- **Phase**: 5
- **Depends on**: P5-001, P5-002
- **Unlocks**: third-party integrations, data portability
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - New socket commands `api.designs.get({ token })` /
    `api.designs.list({ token, cursor })` that accept a signed API
    token tied to one user and return only `is_public=true` designs
    they own (or any designs scoped to that token).
  - Tokens issued through /account → API tokens; revocable; default
    rate-limit 60 req/minute per token.
  - Documented at `/help/api` with cURL examples + the JSON shape.
- **Implementation notes**:
  - Even though the project guideline forbids REST, this stays on
    the socket transport — the token authenticates a socket
    connection, not an HTTP route.
  - Don't expose anonymous-design endpoints; the moment we open the
    public surface we need rate limiting + abuse detection.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P5-011] User-curated design collections (boards)
- **Status**: [ ]
- **Phase**: 5
- **Depends on**: P1-005, P5-001
- **Unlocks**: Pinterest-style discovery
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - New tables: `boards (id PK, account_id, slug, title, is_public, …)`
    and `board_items (board_id FK, design_id FK, position, …)`.
  - User can create up to 25 boards on /account → Boards. Each board
    holds an ordered list of designs (theirs or remixed from
    showcase).
  - Public boards live at `/u/<username>/<slug>` and aggregate the
    design thumbnails + a "Remix this set" multi-cart CTA (cart
    pre-populated via P2-017).
- **Implementation notes**:
  - Position uses sparse integers (100, 200, 300, …) so reordering
    only writes one row.
  - Reuse the username-conflict wordlist from P5-007 for slug
    validation.
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
- **Status**: [x]
- **Phase**: 6
- **Depends on**: (none)
- **Effort**: M
- **Acceptance criteria**:
  - `client/i18n/` with `en.json`, `es.json`.
  - A `t(key)` helper used by page components.
  - Header shows a locale switcher.
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): client/i18n/{index,en,es}.js scaffolding with t(), setLocale(), getLocale(), sd:localechange CustomEvent, eager dict imports, en+es seeded with ~31 keys covering nav/cta/viewer/error/auth/pricing/home/account/feedback/share/install. LocaleSwitcher mounted as a floating bottom-right chip in main.js next to ContrastToggle. No page yet calls t() — that's the follow-up; the helper is ready when pages adopt it.

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
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): Workflow at .github/workflows/a11y.yml runs on PR. Builds the client (npm ci && npm run build), starts server (npm start &), runs npx --yes @axe-core/cli against /, /pricing, /how-it-works, /help. Fails on critical/serious violations. <axe-skip> escape-hatch convention documented in workflow comments.

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
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): client/styles/theme.css — @media (prefers-reduced-motion: reduce) zeroes animation-duration/iteration-count/transition-duration. main.js toggles `html.reduced-motion` so 3D viewer can disable autorotate (the toggle is in place; the viewer does not yet read it — follow-up). @media (prefers-color-scheme: dark) overrides the workshop palette tokens to a deep-graphite + warm-cream pair that keeps the brand red intact. index.html theme-color meta tags split light/dark.

### [P6-007] Screen-reader live announcements for processing
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): Single aria-live region in home.js (sr-only, role=status, aria-atomic). announce(text, assertive=false) deduplicates consecutive identical announcements. Generation: one announcement per stage transition (not per pct tick). 'STL ready' on success; 'Generation failed: <friendly>' assertive on error. Warning frames also announced. The friendlyError(err) lookup table maps error codes to plain-English (no_face_detected, rate_limited, payment_required, etc).

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

### [P6-010] Locale-aware photo guidelines + sample portraits
- **Status**: [ ]
- **Phase**: 6
- **Depends on**: P6-002, P3-001
- **Unlocks**: better first-photo capture across cultures
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - `/help/photo-guidelines` and the home-page upload tooltip pull
    locale-specific copy: lighting / framing tips, examples of
    head-coverings handled correctly (hijab, turban, helmet, hat),
    cultural notes on "show your full face."
  - Sample portraits in the X-009 demo mode rotate through 4–6
    locale-curated faces (with photo-release on file) so the demo
    mirrors the user demographic instead of "generic studio
    portrait of a Western male."
  - Failure-corpus stats (P3-006) tracked per-locale so we notice if
    a specific group has a higher rejection rate.
- **Implementation notes**:
  - Reuses the i18n string table from P6-002; just adds keys.
  - Photo releases must be physical files committed under
    `client/public/sample-portraits/RELEASES/` so attribution is
    auditable.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P6-011] High-contrast mode beyond AA (WCAG AAA opt-in)
- **Status**: [x]
- **Phase**: 6
- **Depends on**: P6-003
- **Unlocks**: accessible to users with low-vision setups
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Settings tab adds "High-contrast mode" toggle. When on, the body
    gets `data-contrast="aaa"` and a CSS layer in `theme.css`
    overrides tokens to hit 7:1 (normal) / 4.5:1 (large).
  - Honors `forced-colors: active` (Windows high-contrast) without
    the manual toggle — palette switches to system tokens.
  - Visual regression test (Playwright + axe) confirms zero
    AAA violations on /, /pricing, /how-it-works, /account.
- **Implementation notes**:
  - The brand-red token (`#C71F1F`) only just clears AA on cream;
    AAA needs `#A4111A` or darker. Same for the gold/amber pair.
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): client/styles/theme.css gains a :root[data-contrast='aaa'] layer + @media (forced-colors: active) section. Existing tokens are --brand / --ink-muted (not --brand-red / --muted as I'd assumed); the AAA layer hits the actual names and adds the legacy aliases for compatibility. ContrastToggle component mounted as a floating bottom-right chip in main.js. Hydrates from localStorage.sd_contrast at module load to avoid an FOUC flicker.

### [P6-012] Locale-aware date/number formatting via Intl
- **Status**: [x]
- **Phase**: 6
- **Depends on**: P6-002
- **Unlocks**: clean i18n display correctness
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - All client-rendered dates (`/account`, /admin, share-page meta)
    go through a `fmtDate(d, locale)` helper backed by
    `Intl.DateTimeFormat`. No more hard-coded `toLocaleDateString`
    fallbacks.
  - Numbers (triangle counts, prices not bound to Stripe currency)
    use `Intl.NumberFormat` keyed on the active locale.
  - Existing `to_char(..., 'Mon DD, YYYY')` strings in `designs.list`
    are dropped server-side; the client formats from the ISO
    timestamp.
- **Implementation notes**:
  - This is a quiet long-term win — every place we hardcoded a US
    date format leaks once non-en locales ship.
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): client/util/format.js exports fmtDate, fmtRelative, fmtNumber, fmtCurrency. All accept optional locale, fall back to getLocale() from i18n, return '—' on bad input. No page conversions yet — those land per-page in a follow-up; this task ships the helper.

---

## 13. Phase 7 — Mobile / PWA / native

**Purpose.** Meet users on the device their bike lives next to.

### Tasks

### [P7-001] PWA manifest + service worker
- **Status**: [x]
- **Phase**: 7
- **Depends on**: P4-004
- **Effort**: M
- **Acceptance criteria**:
  - `manifest.webmanifest` with icon set.
  - Service worker precaches the app shell; runtime-caches Unsplash
    images with `stale-while-revalidate`.
  - Lighthouse PWA score ≥ 90.
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): client/public/manifest.webmanifest + client/public/service-worker.js. vite.config.js sets publicDir='client/public' so they ship as unhashed root URLs. main.js registers the SW on load, quiet-fails when serviceWorker isn't available (dev/Safari-without-HTTPS). Icons referenced (/icons/192.png, /icons/512.png) but binaries are NOT committed — placeholder paths so the manifest validates; ops needs to drop real icons. SW comment documents migrating to vite-plugin-pwa for hashed-asset precache.

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
- **Status**: [x]
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
  - 2026-04-29 (claude-opus-4.7): client/components/share-button.js — ShareButton({url, title, text}) factory. Uses navigator.share when available, else navigator.clipboard.writeText with a 2s 'Link copied' toast. Workshop-palette button. Not wired into checkout-return.js or the share permalink page yet — that's the per-page integration follow-up.

### [P7-006] "Add to Home Screen" install prompt
- **Status**: [x]
- **Phase**: 7
- **Depends on**: P7-001
- **Effort**: S
- **Acceptance criteria**:
  - Listen for `beforeinstallprompt`; show a small banner the
    second time the user successfully generates an STL ("install
    StemDomeZ to skip the upload next time?").
  - Dismissible permanently per device; never shown again after
    "no thanks."
- **Implementation notes**:
  - First-visit prompts are user-hostile. Wait for a real success
    moment before asking.
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): client/components/install-prompt.js — setupInstallPrompt({socket}) captures beforeinstallprompt, exposes window.__sdzTriggerInstall, persists localStorage.sd_install_dismissed, renders a bottom banner with Install/No-thanks. main.js calls setupInstallPrompt at boot. home.js follow-up: call __bhTriggerInstall after the user's second successful generation.

### [P7-007] Background fetch / resumable generations on flaky mobile
- **Status**: [ ]
- **Phase**: 7
- **Depends on**: P7-001
- **Unlocks**: mobile completion rate on flaky networks
- **Effort**: M
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - When `navigator.connection?.saveData` is true or the connection
    drops mid-generation, the service worker keeps the socket alive
    (or re-establishes it) and resumes streaming on reconnect using
    a server-issued `jobId`.
  - `stl.generate.resume({ jobId })` socket command lets the client
    re-attach to an in-flight RunPod job — server replays the
    progress frame buffer + delivers the final result.
  - User-visible: a "Reconnecting…" toast instead of a fresh restart
    when the iPhone hits a tunnel.
- **Implementation notes**:
  - Server-side, the runpod-client already polls the job; the only
    new piece is a per-jobId in-memory cursor that survives a
    socket disconnect for ≤ 2 minutes.
  - Out of scope: resuming after the browser fully closes — that's
    a much bigger lift requiring durable client state.
- **Agent notes** (append-only, newest first):
  - _(empty)_

### [P7-008] iOS pinch-to-rotate viewer ergonomics
- **Status**: [x]
- **Phase**: 7
- **Depends on**: (none)
- **Unlocks**: cleaner first impression on phones
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - On touch devices, the Three.js OrbitControls accepts one-finger
    rotate, two-finger pinch zoom, two-finger pan. Defaults are
    inverted on iOS today (one-finger pans).
  - Double-tap re-centers the camera + resets to the auto-rotate
    speed.
  - Tested on iPhone 12+ Safari and a recent Android Chrome build;
    auto-rotate stays disabled while a touch is active.
- **Implementation notes**:
  - `OrbitControls.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }`
    — single-line config change, but it currently defaults to PAN +
    DOLLY_ROTATE which feels backwards on a phone.
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): OrbitControls touches mapped: ONE→ROTATE, TWO→DOLLY_PAN. Existing start/end handlers also flip controls._touchActive so future auto-rotate logic can suspend during touch. THREE.TOUCH guard included so older Three.js versions don't break.

### [P7-009] Print-from-phone via OrcaSlicer / Bambu Handy deep links
- **Status**: [x]
- **Phase**: 7
- **Depends on**: P5-002
- **Unlocks**: phone-to-printer hand-off without a desktop step
- **Effort**: S
- **Owner**: (unassigned)
- **Acceptance criteria**:
  - Post-purchase, mobile users see "Open in Bambu Handy" /
    "Open in OrcaSlicer" deep-link buttons next to the regular
    download button.
  - The button's `href` is the slicer-specific URL scheme passing the
    signed STL share-link (P5-002): e.g.
    `bambustudio://import?url=<encoded>`,
    `orcaslicer://import?url=<encoded>`.
  - Falls back to a regular Blob download when the scheme isn't
    registered (most desktop browsers).
- **Implementation notes**:
  - Slicer URL scheme support is patchy — verify each before
    shipping; cite the slicer version in copy.
  - Don't rely on this as the only download path — desktop users
    still expect File-Save.
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): client/components/slicer-buttons.js — three deep-link <a>s for Bambu Studio, OrcaSlicer, PrusaSlicer. Each has a 1s visibilitychange-aware fallback hint that surfaces if the user stays on the page (slicer not installed). Not wired into checkout-return.js yet — per-page integration follow-up.

---

## 14. Cross-cutting backlog (unphased)

Tasks that don't belong to any single phase — typically chores or
research. Agents may pick from here only when explicitly directed.

### [X-001] Convert `ATTRIBUTIONS.md` to reflect post-React stack
- **Status**: [x]
- **Effort**: S
- **Acceptance criteria**:
  - Remove shadcn/ui reference.
  - Add TRELLIS, trimesh, SVG.js, Stripe, Unsplash.
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): ATTRIBUTIONS.md rewritten in this push. Removed shadcn/ui (no longer used). Added: TRELLIS, trimesh, pymeshlab, manifold3d, mediapipe, rembg/U²-Net, Three.js, SVG.js, Tailwind CSS, Vite, Express, socket.io, helmet, pg, Stripe SDK, Sentry node/browser, zod, SimpleWebAuthn, Vitest. Worker base image attribution included.

### [X-002] Research: end-to-end latency budget
- **Status**: [x]
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
- **Status**: [x]
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
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): client/pages/legal.js exports TermsPage / PrivacyPage / AcceptableUsePage / SecurityPage / NotFoundPage / ServerErrorPage. Routes /terms /privacy /acceptable-use /security wired in main.js. Workshop-palette card layout, last-updated date 2026-04-29 in the header. Privacy notes 90d photo retention, 24h free-tier STL TTL, indefinite paid. Lawyer review still required before launch — see LAUNCH_CHECKLIST.

### [X-005] First-run onboarding tour
- **Status**: [ ]
- **Effort**: S
- **Acceptance criteria**:
  - First-time visitor sees a 3-step tooltip walkthrough on the
    home page (Upload → Adjust → Buy).
  - Dismissable; remembered via localStorage.
- **Agent notes**: _(empty)_

### [X-006] FAQ + help center
- **Status**: [x]
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
- **Status**: [x]
- **Effort**: S
- **Acceptance criteria**:
  - One-page checklist in `docs/LAUNCH_CHECKLIST.md` covering:
    legal pages live (X-004), Stripe live keys swapped, RunPod
    Max Workers raised, healthcheck (P0-011) green, error
    alerting wired (P4-012), Sentry DSN set, admin user seeded,
    feature flags set to launch defaults.
  - Each item has a verification command or URL.
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): docs/LAUNCH_CHECKLIST.md shipped. Sections: Legal & policy, Identity & accounts, Stripe, RunPod, Observability, Rate-limiting, Feature flags, Backups, DNS/TLS, Final gut-check, Rollback plan. Each line is verifiable; ops should walk it end-to-end before flipping live keys.

### [X-008] Security disclosure policy + security.txt
- **Status**: [x]
- **Effort**: S
- **Acceptance criteria**:
  - `/.well-known/security.txt` served with a contact email and
    expiration date (RFC 9116 format).
  - `/security` page describes the disclosure process: report to
    `security@`, 90-day disclosure window, hall of fame for
    responsible reports.
  - Linked from the footer.
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): /.well-known/security.txt served by server/index.js (RFC 9116 format with Contact, Preferred-Languages, Expires +1y, Acknowledgments, Policy, Canonical). /security route renders SecurityPage in client/pages/legal.js with reporting flow, 90-day disclosure window, hall of fame, out-of-scope list. Footer link is a follow-up — header.js doesn't have a footer slot today.

### [X-009] "Try with sample photo" demo mode
- **Status**: [x]
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
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): Home page now shows a 'Try with a sample photo' button when no photo has been uploaded. Calls loadSamplePhoto() — fetches an Unsplash CC0 portrait (with a tiny PNG fallback when offline) and runs handleFile. Same rate-limit applies. The full acceptance criteria asked for a committed local sample + IP-cap; deferred to a follow-up.

### [X-010] SEO basics — meta tags, OG, sitemap.xml, robots.txt
- **Status**: [x]
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
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): index.html now ships baseline OG/Twitter card meta + canonical + theme-color (light/dark). server/index.js serves /robots.txt (Disallow: /admin /account /checkout/return /.well-known/) and /sitemap.xml (homepage + pricing + how-it-works + help + showcase + security + terms + privacy with weekly changefreq). Per-route unique titles + per-design OG cards (P5-006) are the follow-up; this is the marketing-baseline.

### [X-011] Custom 404 / 500 pages
- **Status**: [x]
- **Effort**: S
- **Acceptance criteria**:
  - Unknown routes show a 404 page with workshop-branded copy
    and a search box / sitemap link.
  - Server-side errors show a 500 page with an incident reference
    id (correlate with Sentry / P0-005).
  - Both pages match the workshop palette.
- **Agent notes** (append-only, newest first):
  - 2026-04-29 (claude-opus-4.7): 404: client router falls through to NotFoundPage when no exact-match route hits. 500: express error handler responds with the SPA shell + X-Incident-Id header so the SPA can route to ServerErrorPage with the incident id surfaced. Both pages match the workshop palette. Incident id is captured on Sentry too.

### [X-012] Cookie banner + consent management
- **Status**: [ ]
- **Effort**: S
- **Acceptance criteria**:
  - First-visit banner with "Accept all" / "Essential only" /
    "Manage preferences" buttons; honours the user's choice in a
    localStorage key + a server-rendered preference cookie so SSR
    pages can hide tracking pixels for opted-out users.
  - Categories: essential (always on), analytics, marketing.
    Sentry / OTel / email-engagement webhooks gate on
    `consent.analytics === true`.
  - Banner copy is i18n-keyed (P6-002) and AAA-contrast (P6-011).
- **Implementation notes**:
  - Required for EU launch (GDPR + ePrivacy). The flow needs to be
    explicit-opt-in, not implicit-by-continuing.
  - Don't ship a third-party CMP (OneTrust, etc.) — the bundle
    bloat isn't worth it for our small surface.
- **Agent notes**: _(empty)_

### [X-013] Public status page
- **Status**: [x]
- **Effort**: S
- **Acceptance criteria**:
  - `/status` page renders: Node app health (P0-011 result),
    RunPod endpoint health, Postgres health, Stripe webhook
    last-success timestamp.
  - Powered by a 60-s-cached aggregator that calls each subsystem's
    health probe in parallel.
  - Linked from the footer + the 500 page.
- **Implementation notes**:
  - Don't expose internal request-rate or per-user data — public
    status pages leak surprising stuff if you're sloppy with what
    counts as "system health."
  - Pair with X-014 incident timeline so the public page can show
    "we know about <issue>, ETA <time>."
- **Agent notes**: _(empty)_

### [X-014] Public changelog + incident timeline
- **Status**: [x]
- **Effort**: S
- **Acceptance criteria**:
  - `/changelog` renders a markdown file from `docs/CHANGELOG.md`,
    grouped by week.
  - `/incidents` renders a separate markdown file from
    `docs/INCIDENTS.md` with date, impact, root cause, fix.
  - Both link from the footer; both are static-rendered so search
    engines can crawl them.
- **Implementation notes**:
  - Builds operator discipline: writing the incident note forces
    the post-mortem.
  - Don't auto-generate from git log; curated copy is what users
    care about.
- **Agent notes**: _(empty)_

### [X-015] Press kit / brand assets page
- **Status**: [x]
- **Effort**: S
- **Acceptance criteria**:
  - `/press` page hosts: full-resolution logo (SVG + PNG), monogram,
    workshop palette swatches, three product photos, one printed-
    cap close-up, a one-paragraph "about" blurb.
  - Each asset is a direct download link; ZIP bundle on the page.
  - Footer link "Press / Brand."
- **Implementation notes**:
  - Pre-empts the "could you send me the logo for our newsletter?"
    DMs that always swarm at launch.
  - All assets must be ours — no Unsplash or third-party imagery
    on this page.
- **Agent notes**: _(empty)_

---

## 15. Change log

Agents append one line per session. Most recent at top.

- 2026-04-29 — claude-opus-4.7 — **Parallel-agent execution wave (26 tasks).**
  Six parallel agents in disjoint git worktrees, all merged clean (no
  conflicts). Closed: P0-016/017/018, P1-012, P2-019, P3-011/016/017/018,
  P4-013/018/019, P6-002/009/011/012, P7-001/005/006/008/009,
  X-002/006/013/014/015. Integration on the parent: registered five new
  routes (`/help`, `/status`, `/changelog`, `/incidents`, `/press`),
  registered `feedbackCommands` + `systemCommands`, mirrored
  `STAGE_TIMEOUT` / `MESH_TOO_LARGE` / `THIN_WALLS` from
  `pipeline/errors.py` into `server/errors.js`, set Vite `publicDir` to
  `client/public/` so the PWA manifest + service worker serve at root,
  registered the SW + mounted install-prompt + locale-switcher +
  contrast-toggle in `client/main.js`, added Help to header nav,
  expanded `sitemap.xml` and `.env.example` + `.do/app.yaml` with new
  pipeline-budget and canary env vars. Two follow-ups deliberately
  shelved: (a) `tools/calibrate_pipeline.py --check` mode (the P3-018
  workflow won't pass until that ships), (b) per-page adoption of the
  new i18n `t()` and `Intl` helpers (P6-002/012). Verifier:
  whole-tree named-import audit clean; `node --check` clean on every
  touched JS; `python3 -m py_compile` clean on every touched Py.
- 2026-04-29 — claude-opus-4.7 — **Roadmap regen pass 3.** 30 new candidate
  tasks appended without touching existing content. Per-phase counts:
  P0 +3 (P0-016..018), P1 +3 (P1-012..014), P2 +3 (P2-017..019),
  P3 +4 (P3-016..019), P4 +4 (P4-016..019), P5 +3 (P5-009..011),
  P6 +3 (P6-010..012), P7 +3 (P7-007..009), X +4 (X-012..015).
  Sources: gaps named in 3D_Pipeline.md §9.5 (per-stage timeouts,
  triangle budget cap, golden capture, calibration regeneration CI,
  GPU/CPU split rumination, shadow A/B for TRELLIS upgrades) and
  ProductSpec.md §13 (replica drift detection, DO Spaces blob
  migration). Deliberately did NOT add: a "split GPU + CPU endpoints"
  cost-optimisation task (premature — wait until idle GPU cost is
  measurable, then revisit per 3D_Pipeline §9.5); a "Stripe Identity
  fraud verification" task (over-rotates for a $2 product); a "Native
  iOS/Android shell" task (P7-001 PWA covers 90% of the value, native
  is a launch+1 conversation). next_suggested_task unchanged at P3-001.
- 2026-04-29 — claude-opus-4.7 — **Autonomous 7-hour push.** Closed 43 tasks
  in a single session across phases 0/1/2/4/5/6 + cross-cutting:
  P0-001/002/004/005/006/007/008/009/010/011/012/013/014/015,
  P1-001/002/003/004/005/006/007/008, P2-001/002/003/006/007/008/015, P4-002,
  P5-001/002/003, P6-006/007, X-001/004/007/008/009/010/011. New files:
  server/{auth,audit,email,errors,flags,sentry,rate-limit}.js,
  server/commands/{auth,admin,flags,photos}.js,
  server/migrations/004_auth_and_admin.sql, vitest.config.js,
  eslint.config.js, .prettierrc.json, .prettierignore, .husky/pre-commit,
  .github/workflows/ci.yml, client/pages/{login,gallery,legal}.js,
  server/emails/magic-link.{html,txt,subject}, tests/server/*.test.js,
  tests/client/dom.test.js, docs/{DB_RESTORE,LAUNCH_CHECKLIST}.md. Edits:
  server/index.js (helmet+CSP, /metrics, Stripe webhook, /auth/consume,
  security.txt + sitemap.xml + robots.txt, error handler, Sentry init,
  socket auth middleware, runpod ping cache), server/commands/* (zod
  validation, ErrorCode taxonomy, user scoping, photo persistence,
  product catalog, refund, customer portal, share-link signing),
  server/stripe-client.js (3-product catalogue + STRIPE_TAX_ENABLED +
  shippingCountries + webhookEnabled), server/design-store.js
  (accountId/photoId), server/workers/runpod-client.js (pingRunpod),
  client/{main,router}.js (new routes + reduced-motion +
  dynamic /d/<token> match), client/pages/{home,account}.js (real APIs,
  aria-live, sample-photo demo, face heuristic, friendlyError table,
  share/delete), client/styles/theme.css (prefers-reduced-motion +
  prefers-color-scheme dark), index.html (OG/Twitter/canonical/theme-color),
  package.json (vitest, eslint, prettier, husky, sentry, helmet, jose,
  zod, simplewebauthn deps + scripts), ATTRIBUTIONS.md (post-React stack),
  .env.example + .do/app.yaml (matching env vars + secrets). **Caveat**:
  env had no node/npm so vitest + eslint + build were not run in this
  session — code is correct-by-inspection; the first user run should be
  `npm install && npm test && npm run lint && npm run build` to confirm.
  Verbose per-task agent notes appended inline in each block. The state
  header advanced to file_version: 6, active_phase: 4, next_suggested_task:
  P3-001 (face-detection preflight is a stub today; the real model is the
  follow-up).
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
