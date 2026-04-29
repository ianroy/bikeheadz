# Design decisions log

Append-only record of design decisions that shaped what shipped. Each
entry should answer: *what was the choice, what alternatives did we
consider, what's the reason we landed where we did.* The roadmap
captures **what to build**; this file captures **why it looks the way
it does**.

Entries newest-first. Don't edit old entries — append corrections as
new entries.

---

## 2026-04-29 — Workshop palette, Schrader rebrand, viewer IBL

### Why a new look at all
Live-site review surfaced two things: "the visual style and colors
are awful" and "the 3D viewer is so dark you can't see contours." The
underlying mismatch: the previous palette was a generic
dark-mode-with-lime-green that read as developer-tool aesthetic. The
product is a *tactile* 3D-printed bike valve cap — the brand should
feel like a cycling workshop, not a CLI.

### Color palette: "workshop"

| Token | Value | Notes |
|---|---|---|
| `--background` | `#FAF7F2` | Cream paper. Warmer than `#FFFFFF`; softer on the eye. |
| `--foreground` | `#1A1614` | Deep ink. ~14:1 on cream — locks AAA-level body-text contrast. |
| `--card` | `#FFFFFF` | Clean white card on cream gives layering without a heavy border. |
| `--primary` (brand) | `#C71F1F` | Signal red — the canonical jersey color in cycling. Bumped from `#DC2626` for AA at small bold sizes (5.32 vs 4.47). |
| `--brand-dim` | `#B91C1C` | Deeper red for gradients + hover. |
| `--muted-foreground` | `#6B6157` | Warm gray for sub-labels. Lifted from `#8B8278` (3.4:1 fail). |
| `--ink-soft` | `#3D3A36` | Graphite for headers + UI labels. |
| `--paper-soft` | `#F5F1E8` | Section bg, slightly darker than page. |
| `--paper-edge` | `#E5DFD3` | Hairline borders. |
| `--viewer-bg` | `#4A453F` | Workshop graphite for the 3D viewer backdrop — see "viewer" section below. |

**Considered and rejected:**

- *Hi-vis yellow on slate* — too "construction site," not "premium
  bike accessory." Also yellow-on-slate forces dark-mode framing
  which is what we were trying to leave.
- *Studio yellow on white* — looked like a discount product.
  Premium accent didn't read.
- *Keep dark mode but swap lime for orange/red* — patches the
  symptom (the green) without fixing the bigger issue (the
  generic-dev-tool framing).

### Schrader, not Presta
Earlier copy claimed the product fits a *Presta* valve. It doesn't —
the actual thread spec on `valve_cap.stl` (8 mm × 32 TPI) matches
**Schrader**, which is the wider sprung valve common on mountain
bikes / hybrids / kids' bikes / car tires. Presta is the narrower
threaded valve on road and gravel bikes; building a Presta cap is a
separate SKU we haven't shipped.

Rebranded across every user-facing surface and every doc. The
`schraderPara()` copy in [client/pages/how-it-works.js](../client/pages/how-it-works.js)
now describes Schrader's actual properties instead of repeating the
Presta description with a swapped name.

### 3D viewer: IBL is what mattered
Two iterations of "boost the lights" didn't fix the "too dark"
complaint because we were pushing on the wrong knob. Metallic
materials in PBR rendering are dominated by **reflections of their
environment**, not by direct light contribution — chrome reads as
"flat dark" when the environment is a uniform dark color, regardless
of how many DirectionalLights you stack on it.

The fix was a procedural environment map:

```js
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const pmrem = new THREE.PMREMGenerator(renderer);
const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envMap;
```

`RoomEnvironment` is three.js's built-in procedural studio scene —
no HDR file needed in the bundle, baked once at startup, applies to
every PBR material via `scene.environment`. After that, the direct
lights get to play their proper role (defining contour, kicking
silhouettes) instead of trying to *be* the entire illumination.

Other knobs we tuned alongside (each had a marginal effect; none
were the actual fix):

- Backdrop `#2D2A26` → `#4A453F`. Lighter graphite.
- Tone-mapping exposure `1.25` → `1.6`.
- Ambient `0.65` → `0.9`, hemi `0.85` → `1.1`, key `2.2` → `2.6`,
  fill `0.85` → `1.2`, rim `1.1` → `1.5`.
- Added a side rim at `1.1` for back-contour readability during
  auto-rotate.

If the viewer ever feels dark again, **don't** reach for the light
intensities first — verify the IBL is still wired. That's where the
fix actually lives.

### Removed the home-page designs gallery
The right-sidebar "Previous 3D Designs" gallery was a hardcoded
mock-data section that didn't tie to anything real (no auth shipped
yet, so "your designs" was inherently misleading). Replaced with two
cards:

1. **Pricing card** (promoted from sidebar bottom — it was the only
   real content there).
2. **3D Printing Tips** card with the brim guidance (`5 mm brim,
   0 mm brim-object gap`) and the *why* — the cap is tall+narrow and
   shears off the bed without a brim. Includes concrete slicer paths
   for Bambu Studio / OrcaSlicer / PrusaSlicer because users print on
   whichever they have.

When real auth + designs storage land (P1-005), the gallery moves to
`/account` where it belongs, scoped to the actual user.

### Accessibility (WCAG AA)

Pass-by-pass measurements on cream `#FAF7F2`:

| Token | Old → New | Ratio | Passes |
|---|---|---|---|
| Brand red text | `#DC2626` → `#C71F1F` | 4.47 → 5.32 | AA normal ✓ |
| Muted body text | `#8B8278` → `#6B6157` | 3.42 → 5.51 | AA normal ✓ |
| Gold (text/icon) | `#A88735` → `#7C5E1F` | 2.86 → 6.45 | AA normal ✓ |
| Button text on red | `#000` → `#FFFFFF` (on `#C71F1F`) | 4.38 → 5.74 | AA normal ✓ |
| H1/H2/body | white-via-Tailwind → `#1A1614` (foreground) | 1.06 → ~14 | AAA ✓ |

The Tailwind `.text-white` class was the silent killer. It was
applied to every page H1 and many body sections, rendering invisible
white-on-cream text. Search-and-removed everywhere except the header
logo (which sits on the red gradient bg where white is correct).

`#A88735` was kept *only* as a 8×8 px legend-swatch dot in
[client/pages/home.js](../client/pages/home.js) because the dot
represents the actual color of the valve and is informational, not
text. WCAG's 3:1 graphical-objects threshold doesn't apply to color
samples whose entire purpose is to *be* that color.

The CI/axe-core regression net is split into [P6-009] so this manual
pass can close cleanly.

---

## 2026-04-28 — return_aggregate_stream=False + lenient stage 1.5 (v0.1.34)

Both the worker delivery saga and the pipeline gate softening are
captured in [`docs/RUNPOD_TRELLIS_PLAYBOOK.md`](RUNPOD_TRELLIS_PLAYBOOK.md).
Short version of why we landed where we did:

- **Delivery via chunked yields, `return_aggregate_stream=False`**.
  Runpod's per-frame `/job-stream` cap *and* the aggregate-POST cap
  both bit us. Five versions of attempts before this combination
  worked. The playbook is the durable record.

- **Stage 1.5 lenient (warn, don't raise)**. TRELLIS reliably emits
  700 K+ tri meshes with non-closeable holes. Failing hard at the
  watertight check blocked every real user. Stages 3, 4, 5 already
  had fallback paths for non-watertight input — let them do their
  jobs.

---

## 2026-04-23 — Three.js viewer over SVG.js

Original UI used [SVG.js](https://svgjs.dev) for a parametric
2D-pseudo-3D valve preview. Once the v1 pipeline produced real STL
output, SVG.js had no way to render it — and a flat 2D illustration
of "your head" wasn't going to feel real at the moment of purchase.

Swapped in Three.js + STLLoader + OrbitControls. Added ~600 KB
minified to the bundle (~200 KB gzipped); paid for it because the
preview is the moment the user decides whether to spend $2.

The placeholder (parametric stem + sphere) is preserved for the
pre-generation state so the sliders feel live before the user
commits.

---

## 2026-04-23 — `socket.io` + single command event, no REST

House rule, locked in
[ProductSpec.md §11](../ProductSpec.md). One transport, one event
shape (`{id, name, payload}`). Trades a bit of expressiveness for:

- One connection lifecycle to reason about.
- One auth boundary.
- Trivially correlated request/response via `id`.
- Inspectable end-to-end in DevTools → Network → WS → Messages.

Stripe is the lone HTTP touchpoint and even there we don't run a
webhook — verification happens on the redirect-return via
`payments.verifySession`.

---

## 2026-04-23 — RunPod Serverless for the GPU tier

DigitalOcean App Platform has no GPU sizes. Running TRELLIS on a
dedicated GPU droplet is wasteful (idle 99% of the time). Considered
options:

| Option | Cost shape | Cold start | Verdict |
|---|---|---|---|
| Dedicated GPU droplet | flat hourly, expensive | none | rejected — 99% idle |
| RunPod Serverless | per-second of GPU use | ~30–60s warm, ~5–10min cold | **chosen** |
| Replicate | per-prediction | ~30s | rejected — less control over the image |
| Modal | per-second | similar | rejected — newer; RunPod's `/run` + `/stream` shape fit our generator pattern cleanly |
| Self-host on EC2 g5 | flat hourly | none | rejected — too much ops overhead at MVP |

RunPod's `/run` + `/stream/<id>` polling fits the Python-generator
shape directly. Local Python fallback preserved for dev/CI when
`RUNPOD_ENDPOINT_URL` isn't set, so contributors don't need a GPU.
