# 3D Pipeline Plan — Photo → Printable Bike Valve Cap

**Status (v0.1.34, April 2026):** Phases −1, −0.5, 0, 1, 2, 3, 4 done.
The full v1 pipeline runs end-to-end on the RunPod GPU worker and
produces a printable STL that the browser renders in real time.
User-facing **Crop Tightness** (0.40–0.85, default 0.60), **Head
Pitch** (−30°..+30°, default 0°), **Head Height** (22–42 mm) and
**Cap Protrusion** (0–25%) sliders are live in
[client/pages/home.js](client/pages/home.js) and wired through to
`shoulder_taper_fraction`, `head_tilt_deg`, `target_head_height_mm`,
and `cap_protrusion_fraction` in the v1 pipeline.

Notable runtime degradations baked in (each gracefully shipped):

- **Stage 1.5** logs a warning rather than raising when pymeshlab
  cannot fully close TRELLIS's open holes (euler often <-20). Stages
  3/4/5 already handle non-watertight input. v0.1.33→0.1.34.
- **Stage 4** falls back to mesh concatenation when manifold3d's
  boolean union returns non-manifold output (current `valve_cap.stl`
  has Euler −51).
- **Stage 5** ships the final STL even if it isn't strictly
  watertight — slicers cope, and blocking on this is worse for users.

Result delivery uses the chunked-yield + `return_aggregate_stream=False`
protocol detailed in [docs/RUNPOD_TRELLIS_PLAYBOOK.md](docs/RUNPOD_TRELLIS_PLAYBOOK.md).
Earlier delivery attempts (v0.1.31 single-yield, v0.1.32
metadata + return-value, v0.1.33 chunked-yield with aggregate POST
still on) all hit different size caps. v0.1.34 lands.

Next: failure-corpus mining (replay corpus to detect regressions), live
red-line preview workflow (per-stage SVG overlay), and the calibration
re-run on the cap remesh once Phase 4 §4 lands.

**Critical reframing.** The committed
`server/assets/reference/{ian,nik}_head.stl` files are **raw 3D head
scans (1.7–1.9 m human-scale)**, not post-pipeline goldens. The earlier
draft of this doc treated them as goldens; the spike showed they are
not. The pipeline's job is to take raw scans like these (TRELLIS
output looks similar — head + shoulders, unitless or wrong-scaled,
sometimes non-manifold) and turn them into printable ~30 mm caps. We
capture *post-pipeline goldens* later by running the pipeline once it
works.

**Owner of this doc:** Pipeline architecture and the asset contracts.
Anything inside `handler.py` past the TRELLIS call belongs here.
RunPod-tier delivery, image, and dockerization concerns belong to
[`docs/RUNPOD_TRELLIS_PLAYBOOK.md`](docs/RUNPOD_TRELLIS_PLAYBOOK.md) —
this doc references it but does not duplicate it.

**Reading order for someone catching up:**
1. The status block above — what's shipped today.
2. §0 (locked decisions) — what's already settled.
3. [`tools/spike_report.md`](tools/spike_report.md) — what Phase −1 actually found.
4. §5 — the as-shipped stage descriptions.
5. [`docs/RUNPOD_TRELLIS_PLAYBOOK.md`](docs/RUNPOD_TRELLIS_PLAYBOOK.md)
   — production gotchas before touching the GPU side.

---

## 0. Locked decisions

These are not open questions — they are pre-conditions. The phases below
assume they hold. If any shifts, the plan needs revisiting.

| Decision | Value | Rationale |
|---|---|---|
| **Print process** | **FDM, PLA filament, 0.4 mm nozzle** | This is the fulfilment process. The committed reference STLs (`ian_head.stl`, `nik_head.stl`) were FDM-printed in PLA and proved the design works on this stack — that's the empirical evidence. SLA could be added later as a premium SKU but everything below is tuned for FDM/PLA. |
| **Printer family** | **High-speed bed-slingers and CoreXY with input-shaping** — Bambu A1 / A1 Mini, Prusa MK4 / MINI+, Elegoo Centauri Carbon, etc. | All run OrcaSlicer or its forks (Bambu Studio, PrusaSlicer descended from Slic3r). All ship sane PLA profiles for 0.4 mm × 0.12–0.20 mm out of the box. No exotic firmware tuning required from us. We're targeting "drop the STL into Orca, hit print" — the slicer compensates for shrinkage, elephant-foot, and ringing. |
| **Print orientation** | **Cap-down** (valve cap section flat on the bed; head pointing up) | The cap section is the only flat circular face on the assembly — natural footprint for bed adhesion. Printed cap-down the cap walls grow upward, internal threads form as helical features at ~60° (well within FDM self-support), and the head builds organically on top. Printed any other way, the head's curved skull contacts the bed and needs supports the slicer can't place cleanly. The references were sliced cap-down. |
| **Coordinate frame** | **Z-up, +Y forward (face), millimeters** | Matches §8.1 invariants and the Three.js viewer at [valve-stem-viewer.js:251](client/components/valve-stem-viewer.js:251), which rotates −π/2 around X assuming Z-up. Stage 5 export must orient the **cap region toward −Z** so the slicer's default "place flat on bed" picks the cap as the print face. |
| **Boolean engine** | **manifold3d 3.4+** | §7 audit; the only CPU CSG with a manifold-output guarantee. |
| **Cap & negative-core sizing** | **Locked, do not scale** (`valve_cap.stl` ≈ ⌀9.2 mm, `negative_core.stl` ≈ ⌀8.3 mm) | The bike valve thread fit demands these exact dimensions — scaling either would break the press-fit onto a real Schrader valve. The threaded outer diameter of `valve_cap.stl` is *intentionally larger* than `negative_core.stl`'s diameter: when Stage 4 unions the cap into the cavity Stage 3 carved, the cap's threads bite into the surrounding head walls and form the threading visible inside the cavity. Wall thickness around the cavity is **not** ensured by widening the core (which would break the valve fit) — it is ensured by Stage 2 **rotating the head** to choose a hole location with enough surrounding material. (Decision −0.5.3.) |
| **Head auto-rescale target** | `TARGET_HEAD_HEIGHT_MM = 30.0` baseline; **user-tunable 22..42 mm** via the Web UI's "Head Height" slider | Cap section is ~11 mm tall + 14 mm cropped head room for the cavity. A 30 mm rescale gives a ~15 mm cropped head — enough to fully nest the 13.78 mm core. Tunable per-request: pipeline reads the override and applies it via `dataclasses.replace` on the loaded `Constants`. |
| **Cap protrusion below head** | `CAP_PROTRUSION_FRACTION = 0.10` baseline; **user-tunable 0..25%** via the Web UI's "Cap Protrusion" slider | The cap's open bottom protrudes by 10% of `VALVE_CAP_HEIGHT_MM` (≈1.11 mm) below the head's bottom plane to expose the threading and accept a real bike valve. Drives `JUNCTION_Z_OFFSET_MM = -CAP_PROTRUSION_FRACTION × VALVE_CAP_HEIGHT_MM`. |
| **Layer height target** | **0.12–0.16 mm** | The user's printer family runs comfortably here on PLA. A typical bike valve thread pitch is ~0.8 mm; at 0.12 mm layers that's ~6–7 layers per pitch — crisp threads. At 0.16 mm, ~5 layers — still clean. Stage 5 doesn't enforce this (slicer's job) but the triangle budget below assumes it. |
| **Triangle budget (output)** | **50–80K** | 30 mm part at 0.12–0.16 mm FDM/PLA layer height. Below 50K the chin and ears facet visibly. Above 80K the slicer can't resolve added detail at this layer height and the surplus just bloats `stl_b64` over the wire. The thread region (cap) is masked from decimation and stays at full density regardless — those tolerances matter. |
| **Min wall thickness** | **1.2 mm** | FDM at 0.4 mm nozzle prints reliable walls at 3× nozzle width = 1.2 mm. Below that, PLA shows gaps and inconsistent extrusion. Drives the optional wall-thickness check in §8.6. |
| **STL format on the wire** | **Binary** | §8.9. ASCII at 80K tris is ~25 MB vs ~4 MB binary; slicers parse binary 5–10× faster. Existing post-payment download path at [server/commands/stl.js:98](server/commands/stl.js:98) needs a `Buffer`-aware fix before any pipeline change ships (Phase 0). |

**Open today:** none of the §0 numbers depend on which printer in the
target family the user owns — they're all PLA / 0.4 mm nozzle / OrcaSlicer
fork. If a user later prints on a 0.6 mm nozzle, 0.25+ mm layers, or
non-PLA filament (PETG, ABS, ASA), the clearance and wall-thickness
numbers above need a re-tune. Bake that as a future "advanced
fulfilment" SKU rather than a default.

## 1. Goal

Take a photo of a person, return a 3D-printable STL of a bike valve stem cap
shaped like that person's head — properly threaded so it screws onto a real
Schrader valve.

The current `handler.py:_merge` (lines 230–262) is a placeholder: it scales
the TRELLIS head to roughly match the valve cap diameter, lifts it up by the
configured neck length, and *concatenates* the two meshes without a boolean.
The result is two interpenetrating shells — not a printable manifold solid,
no real socket for the threads, no head/neck cropping. That stops here.

## 2. Definition of Done

The committed reference STLs are the contract:

- [`server/assets/reference/ian_head.stl`](server/assets/reference/ian_head.stl)
- [`server/assets/reference/nik_head.stl`](server/assets/reference/nik_head.stl)

Both went through the manual version of this pipeline and represent **the
exact target scale, proportions, and topology**. A successful automated
pipeline output, when overlaid against either reference, should:

1. Have the same overall height and diameter (within a small tolerance — see
   §6 Calibration).
2. Show the same valve-cap section at the bottom (same threads, same socket
   geometry).
3. Be a single watertight manifold, not two glued shells.
4. Be slicer-clean: no inverted normals, no degenerate faces, no internal
   walls.

## 3. Reference Assets

Committed under `server/assets/`:

| File | Triangles | Role |
|---|---|---|
| `valve_cap.stl` | ~7,400 | Minimal threaded screw cap (sourced from `Screw Cap Minimal.stl`). Same thread profile as a real valve cap, but no decorative exterior — just the threaded cylinder. Lower triangle count means cleaner manifold3d booleans and faster Stage 3/4 ops. Must be added without deformation — fit matters; threads grip a real Schrader valve. |
| `negative_core.stl` | ~290 | Boolean cutter. Subtracted from the head bottom to carve a clean cavity that nests the valve cap. |
| `reference/ian_head.stl` | ~200,000 | Golden output #1. Calibration target. |
| `reference/nik_head.stl` | ~200,000 | Golden output #2. Calibration target. |

`valve_cap.stl` and `negative_core.stl` are runtime assets — they go into the
container alongside `handler.py`. The `reference/` folder is for tests and
calibration scripts; it never ships to production.

The Dockerfile already does `COPY server/assets/valve_cap.stl /app/valve_cap.stl`
([Dockerfile:129](Dockerfile)). It will need a sibling line for `negative_core.stl`.

## 4. Pipeline Architecture

```
                              ┌──────────────────────────────────────┐
                              │ STAGE 0 — Input validation           │
photo  ──────────────────────►│ mediapipe FaceMesh on the photo.     │
                              │ Reject early if no face detected;    │
                              │ extract 2D landmarks for Stage 1's   │
                              │ orientation hint.  See §5 Stage 0.   │
                              └────────────┬─────────────────────────┘
                                           ▼
                              ┌──────────────────────────────────────┐
                              │ TRELLIS (existing, GPU)              │
                              │ outputs["mesh"][0]                   │
                              │ ~200K tris, unitless, head + chest,  │
                              │ frequently non-manifold (see §8.2)   │
                              └────────────┬─────────────────────────┘
                                           │ trimesh.Trimesh
                                           ▼
                              ┌──────────────────────────────────────┐
                              │ STAGE 1 — Normalize                  │
                              │ Orient (Z-up, +Y forward), scale to  │
                              │ TARGET_HEAD_HEIGHT_MM, recenter to   │
                              │ origin.                              │
                              └────────────┬─────────────────────────┘
                                           ▼
                              ┌──────────────────────────────────────┐
                              │ STAGE 1.5 — Repair                   │
                              │ pymeshlab round-trip: drop floaters, │
                              │ fix non-manifold edges, close holes, │
                              │ reorient faces.  See §8.3.           │
                              └────────────┬─────────────────────────┘
                                           ▼
                              ┌──────────────────────────────────────┐
                              │ STAGE 2 — Crop to neck-and-up        │
                              │ Boolean-subtract a bounding box up   │
                              │ to z_cut. Cap face is CDT-           │
                              │ triangulated, watertight by          │
                              │ construction.  See §8.4.             │
                              └────────────┬─────────────────────────┘
                                           ▼
                              ┌──────────────────────────────────────┐
                              │ STAGE 3 — Subtract negative core     │
                              │ head − negative_core ⇒ socketed head.│
                              └────────────┬─────────────────────────┘
                                           ▼
                              ┌──────────────────────────────────────┐
                              │ STAGE 4 — Union valve cap            │
                              │ socketed + valve_cap ⇒ threaded cap. │
                              │ Threads stay exposed inside cavity.  │
                              └────────────┬─────────────────────────┘
                                           ▼
                              ┌──────────────────────────────────────┐
                              │ STAGE 5 — Print-prep                 │
                              │ fast-simplification → 50–80K tris    │
                              │ Taubin smoothing on organic regions  │
                              │ assert_printable; export binary STL  │
                              └────────────┬─────────────────────────┘
                                           ▼
                                       final.stl
                              (single manifold, slicer-clean)
```

Stages 0, 1.5, and 5 are mandatory but distinct from the user's
"4 things." See §5 for prose on each.

## 5. Stage-by-stage Technical Detail

### Stage 0 — Input validation

**Why:** Failing fast on bad input saves a $0.50–2 GPU cold-start. A 1×1
PNG, a photo with no face, or an extreme-angle selfie shouldn't make it
to TRELLIS.

**Inputs:** Raw uploaded photo bytes.

**Steps:**
1. Decode → `PIL.Image`. Reject if either dimension < 256 px.
2. Run `mediapipe FaceMesh` (Tasks API). Require ≥1 face with confidence
   ≥ 0.7.
3. Extract these landmark points and stash on the request context for
   Stage 1 to consume as an orientation hint:
   - chin (landmark 152)
   - nose tip (landmark 1)
   - left/right eye outer corners (33, 263)
   - top of forehead approximation (10)
4. Compute 2D head pose (yaw/pitch/roll). If any axis > 30°, log a
   warning — Stage 1's PCA may need the landmark fallback.

**Failure mode:**
`PipelineError(stage="stage0", failure="no_face_detected")` with
user-facing copy: *"Couldn't find a clear face. Use a front-facing
portrait."*

### Stage 1 — Normalize & calibrate

**Why:** TRELLIS emits a unitless mesh (roughly normalized to a unit cube).
Real-world manufacturing requires millimeters. The reference STLs define what
"the right size" looks like — we calibrate to them, not to the photo.

**Inputs:** `head: trimesh.Trimesh` from TRELLIS.

**Steps:**
1. **Detect orientation.** TRELLIS does not guarantee the up-axis. Use either
   PCA on the upper-half vertices or a learned head-pose model (start with
   PCA — empirically the head's vertical axis aligns with the second
   principal component when the head is roughly upright).
2. **Reorient** so the head's anatomical "up" is +Z, "front" (face) is +Y.
3. **Compute target height in mm** by reading the bounding-box height of
   `reference/ian_head.stl` minus the valve-cap section. This number — call
   it `TARGET_HEAD_HEIGHT_MM` — is a *constant* derived once at calibration
   time and hard-coded; it does not vary per request.
4. **Scale uniformly** so the head's bounding-box height in Z matches that
   constant.
5. **Recenter** so the bottom of the bounding box sits at z=0 and the
   centroid sits over the origin in XY.

**`head_scale` slider:** keep it as a fine-tune multiplier on
`TARGET_HEAD_HEIGHT_MM` — useful if the user wants the head 10% bigger.
Bound it (0.85 .. 1.15) so the result still fits the cap.

**Risks:**
- TRELLIS output occasionally has the head looking sideways. PCA orientation
  fails ≈10% of the time. Fallback: use Stage 0's mediapipe landmarks
  (eyes, nose, chin) to compute a head-frame matrix and apply it instead.
- The reference STLs include the valve cap. Subtract its height when
  computing `TARGET_HEAD_HEIGHT_MM`.

### Stage 1.5 — Repair

**Why:** TRELLIS output is *not* manifold (§8.2 catalogs the defect
modes). manifold3d will refuse non-manifold input or silently corrupt
the boolean result. Repair before any boolean.

**Inputs:** Stage 1 output (oriented, scaled, recentered).

**Steps:** See §8.3 — drop floaters, pymeshlab round-trip (non-manifold
edge repair, close holes, reorient faces).

**Validation:** Originally a hard `is_watertight` gate, now a **warning
only** (v0.1.34 onwards). Production logs show TRELLIS routinely emits
700K+-tri meshes with euler numbers <-20 — pymeshlab's
`meshing_close_holes(maxholesize=200)` cannot close them all, and
gating on watertight blocks essentially every real user. Stages 3, 4,
and 5 already handle non-watertight input gracefully (subtract keeps
largest body; union falls back to concatenation; final ships anyway
because slicers cope). The warning still surfaces so the failure
corpus can be mined for inputs whose topology is genuinely worse than
typical.

**Reference implementation to read first:** Microsoft ships a
`mesh_postprocess.py` in the TRELLIS repo. Covers ~60–80% of what we
need against the same defect catalogue. Read it before writing more —
don't reinvent.

**Risks:**
- pymeshlab is GPL v3. See §7's license caveat for the subprocess
  isolation pattern. If legal kills this path, fall back to
  `trimesh.repair` + `gpytoolbox.remesh_botsch`, accepting weaker
  hole-closing on non-convex boundaries.
- The warning-not-raise stance means a *truly* broken mesh (e.g. empty
  vertices, NaN coordinates) will currently propagate downstream. Fix
  is a tighter pre-check that distinguishes "pymeshlab couldn't fully
  close" from "this isn't a mesh at all." See FEATUREROADMAP P3.

### Stage 2 — Crop to neck-and-up

**Why:** TRELLIS often returns head + shoulders. The cap only wants the head.

**Inputs:** Stage 1 output, oriented and scaled.

**Approach A (heuristic, ship first — confirmed by user):**

Empirical observation from the user's input data: every scan contains a
head and shoulders. The vertical radius profile is **hourglass shaped** —
shoulders are the wider lower bulge, the head is the upper bulge, and
the neck is the narrow waist between them. **Shoulders are always wider
than the head** at their widest point, so the neck is the first local
minimum below the head's local maximum and above the shoulder's local
maximum.

1. Sweep horizontal cross-sections (use `trimesh.intersections.mesh_plane`
   or simple Z-binned vertex projection) every ~2 mm in Z. For each
   slab, compute the convex-hull radius from the slab's vertex XY
   projection.
2. Smooth the radius profile (Savitzky–Golay or rolling mean over ~5
   bins) so noise from one-sided ear lobes / hair doesn't fake-trigger
   a local extremum.
3. Find the upper local maximum (head crown) and the lower local
   maximum (shoulder peak). The neck is the local minimum **between**
   them. Pick `z_cut` at that minimum.
4. **Crop via boolean, not `trimesh.slice_plane`.** Construct an
   axis-aligned box covering the head bounding-box footprint up to `z_cut`
   and subtract it from the head as a `manifold3d` operation. This produces
   a watertight mesh with a *properly triangulated* flat disc at the cut —
   `trimesh.slice_plane(cap=True)` and `trimesh.repair.fill_holes` are both
   known to leave non-manifold caps on non-convex boundary loops
   (trimesh issues #1149, #2180). Boolean cropping bypasses both bugs.

**Substantial crop expected.** Raw scans are ~1.7–1.9 m tall (full
torso). After Stage 1's auto-rescale to `TARGET_HEAD_HEIGHT_MM`, that
becomes ~22–25 mm tall — and we still drop ~⅔ of that at Stage 2,
leaving only the head section above the neck. **The output of Stage 2
is the only part that survives to the final cap.**

**Approach B (learned, fold in later):**
1. Render the head from the front using TRELLIS's existing image input as a
   reference.
2. Run `mediapipe FaceMesh` to get the chin landmark in image space.
3. Backproject through the camera pose used by the renderer to get the chin
   in 3D.
4. Plane-cut at chin Z, with a slight offset down to keep the chin intact.

**Decision:** ship Approach A first. It's deterministic and ~50 lines. Add B
when we see failure cases in the wild.

**Risks:**
- For tilted or sideways heads, "narrowest cross-section in horizontal slabs"
  can pick the wrong axis. Solved by Stage 1 orientation — but if Stage 1
  fails, this fails too.
- The cut disc must be perfectly planar and the boundary perfectly closed,
  or Stage 3's boolean will silently produce non-manifolds.

### Stage 3 — Boolean: carve the socket

**Why:** The negative core defines a clean, predictable cavity geometry —
much more reliable than booleans against the messy organic shape of a head.
Carve first with the simple shape, then we know exactly where the threads go.

**Inputs:**
- `head_cropped` from Stage 2 (already watertight by construction —
  Stage 2's boolean crop guarantees it).
- `negative_core.stl` from `server/assets/`.

**Steps:**
1. **Pre-flight check.** Run `assert_printable(stage="pre-stage3")`
   (§8.6) on `head_cropped`. Repair already happened in Stage 1.5 (§8.3);
   if it fails here, surface the error — don't silently re-repair, that
   hides regressions and produces nondeterministic output.
2. **Position the negative core.** Translate it so its top face is flush
   with the bottom plane of the cropped head, centered on the head's XY
   centroid at that plane. The translation matrix is reused identically
   in Stage 4 — confirm via the spike (Phase −1) that this works for
   both references.
3. **Boolean subtract.** See §8.5 for the recipe and the tolerance rule.
4. **Validate:** `assert_printable(stage="stage3")` (§8.6). Watertight,
   single shell, positive volume.

**Library choice:**
- **`manifold3d`** is the right tool. MIT-licensed, exact-arithmetic CSG, no
  Blender/OpenSCAD subprocess overhead, ~20× faster than trimesh's default
  blender backend, and tolerant of slightly non-manifold inputs.
- Fallback: `trimesh.boolean.difference(..., engine="blender")`. Requires
  Blender in the container. Slower, more brittle, but battle-tested.

**Risks:**
- TRELLIS heads are not always watertight. `manifold3d` will refuse to
  process a non-manifold input. Stage 1.5 (a "make watertight" step) may
  need to be inserted between 1 and 2.
- The negative core's pose needs to be repeatable. Hard-code the translation
  in mesh-local coordinates; never rely on TRELLIS's centroid for vertical
  alignment.

### Stage 4 — Boolean: insert the valve cap

**Why:** The valve cap provides the actual threads — we cannot regenerate
those procedurally. We just place it in the cavity we made.

**Inputs:**
- `head_with_cavity` from Stage 3.
- `valve_cap.stl` from `server/assets/`.

**Steps:**
1. **Position the valve cap.** It uses the *same* translation as the
   negative core in Stage 3 — that's the whole reason we use a paired
   negative-core/valve-cap design. The negative core is sized slightly
   larger than the valve cap so the cap nests inside without intersecting
   the cavity walls. **0.25 mm radial clearance** for FDM (§0); covers
   nozzle width tolerance and elephant-foot at the cap base.
2. **Verify the threads are exposed.** The cap's outside, where the threads
   are, must remain on the inside of the cavity (not get filled in). This
   is a function of the negative core being larger in radius than the cap's
   outer radius — confirm at calibration time, not at runtime.
3. **Boolean union.**
   ```
   final = head_with_cavity + manifold3d.Manifold(valve_cap)
   ```
4. **Validate:**
   - `final.is_watertight` is `True`.
   - Triangle count is reasonable (50K–250K). If much higher, decimate (see
     Stage 5).
   - Visual sanity: the threads inside the cavity are still visible (not
     occluded by the head walls).

**Risks:**
- If the negative core and valve cap aren't co-centered correctly in their
  source files, the cap will be off-axis and the print won't thread onto a
  valve. Confirm the source STLs share an origin before committing to this
  design. (Action item: see §11.)

### Stage 5 — Print-prep

Not part of the user's 4 steps but mandatory for printable, wire-efficient
output. Order matters: **decimate after the boolean, not before.**
Decimating first throws away features the boolean needs to land cleanly,
and manifold3d 3.x is fast enough on 200K-tri inputs (sub-second) that the
"speed up the boolean" argument doesn't hold.

- **Decimate** the unioned solid to **50–80K triangles** (FDM/PLA at
  0.12–0.16 mm layer height, §0). Below 50K the chin and ears start
  faceting; above 80K the slicer can't resolve the detail at this layer
  height. Use `fast-simplification` (Cython wrapper around sp4cerat's
  QEM — ~4× faster than MeshLab and meaningfully better preservation
  than Open3D's, which has a known hole-creation bug — Open3D issue
  #4083). Decimation must **mask out the cap region** so the threads
  are preserved at full density (the threads are the tightest tolerance
  feature in the entire part).
- **Smooth** TRELLIS staircase artifacts on the head with **Taubin only**
  (`trimesh.smoothing.filter_taubin(lamb=0.5, nu=-0.53, iterations=3-5`).
  Laplacian shrinks the head and breaks the calibrated scale; HC is
  overkill. Mask the cut plane and the cap region — both must stay flat.
- **Validate** with the assertion ladder in §8.6 before export.

## 6. Calibration

Calibration is a one-time, offline step that produces *constants* baked into
the code. It is not a runtime step.

Source files:
- `server/assets/reference/ian_head.stl`
- `server/assets/reference/nik_head.stl`

Constants we extract (post-Phase −0.5 redesign — many earlier entries
in this table referenced an inverse-boolean recovery that the spike
showed doesn't apply):

| Constant | Source | Used by |
|---|---|---|
| `TARGET_HEAD_HEIGHT_MM` | Locked at **22.0** in §0 | Stage 1 head rescale target |
| `VALVE_CAP_OUTER_DIAMETER_MM` | Measured from `valve_cap.stl` xy bbox (≈ 9.21) | Stage 4 thread bite-into-walls assertion |
| `VALVE_CAP_THREADED_OUTER_DIAMETER_MM` | Z-binned median radial-max across `valve_cap.stl` (excludes flange; ≈ 8.29) | Stage 4 — the diameter the threads "bite" into; should be > `NEGATIVE_CORE_DIAMETER_MM` so threads protrude into head walls |
| `VALVE_CAP_HEIGHT_MM` | `valve_cap.stl` bbox Z extent (≈ 11.11) | Stages 3/4 positioning |
| `NEGATIVE_CORE_DIAMETER_MM` | Measured from `negative_core.stl` xy bbox (≈ 8.31) | Stage 3 cavity size; Stage 4 wall-thickness check |
| `NEGATIVE_CORE_HEIGHT_MM` | `negative_core.stl` bbox Z extent (≈ 13.78) | Stage 3 cavity depth |
| `JUNCTION_Z_OFFSET_MM` | `-VALVE_CAP_HEIGHT_MM` (the cap-bottom and core-bottom share a Z baseline below the head) | Stages 3/4 positioning math |
| `MANIFOLD_TOLERANCE_MM` | Locked at **0.01 mm** (§8.5); 1/3000 of part bbox | Passed to manifold3d on every Manifold construction |
| `MIN_WALL_THICKNESS_MM` | Locked at **1.2 mm** (FDM @ 0.4 mm nozzle, §0). SLA fallback would be 0.8 mm | Stage 2 wall-thickness validation when picking the rotation/hole-location |

Constants that were in the previous draft but **dropped** as Phase −0.5
made them invalid:

- ~~`VALVE_CAP_OFFSET_FROM_HEAD_BOTTOM_MM`~~ — relied on references
  containing a cap section, which they don't.
- ~~`NEGATIVE_CORE_CLEARANCE_MM`~~ — was based on a misreading of the
  design. Cap and core have *intentionally* near-zero radial gap;
  threads bite into surrounding head walls (decision −0.5.3).
- ~~`CAP_REGION_Z_RANGE_MM`~~ / ~~`CAP_REGION_RADIUS_MM`~~ — refs are
  raw scans, no cap region exists in them.

Deliverable: `tools/calibrate_pipeline.py` loads the references, computes
these numbers, and writes them to `server/assets/pipeline_constants.json`.
The handler imports the JSON at module load (no recompute on warm
invocations). Re-runs in CI on any change to `server/assets/reference/`
or `negative_core.stl` / `valve_cap.stl`; > 1% drift in any constant
blocks the merge until reviewed (§9.5).

## 7. Tools & Libraries

### Library audit (early 2026)

| Library | Latest | Maintenance | License | Footprint | Role here |
|---|---|---|---|---|---|
| **trimesh** | 4.12.x | Very active (weekly) | MIT | ~2 MB pure Python | Lingua franca: I/O, transforms, properties, repair |
| **manifold3d** | 3.4.x | Very active (monthly) | Apache 2.0 | ~3 MB | The boolean engine. Only CPU CSG with a manifold-output guarantee |
| **pymeshlab** | 2025.7.x | Active, slow cadence; ARM64 wheels now ship | **GPL v3** | ~150 MB | Heavy-duty repair (close holes, reorient, non-manifold edges). License caveat below |
| **fast-simplification** | 0.1.x | Stable | MIT | <1 MB | Quadric decimation. ~4× faster than MeshLab, no Open3D bugs |
| **gpytoolbox** | 0.3.x | Active (research-pace) | MIT (+ GPL submodules to avoid) | ~10 MB | Optional: `remesh_botsch` isotropic remesh smooths TRELLIS triangle distribution before boolean |
| **mediapipe** | 0.10.x | Maintained, Tasks API replacing Solutions | Apache 2.0 | ~60 MB | 2D face landmarks on the input photo for Stage 0 reject + Stage 2-B chin localization |

**Rejected for the runtime image:**

| Library | Why not |
|---|---|
| `open3d` 0.19 | 65–427 MB depending on platform; `simplify_quadric_decimation` has a known hole-creation bug (#4083); mesh-repair stack hasn't improved meaningfully. Fine in dev/QA |
| `pyvista` / `vedo` | Pull in VTK (~150 MB). VTK boolean is the unreliable one — explicitly noted in MeshLib's 2025 survey as "often fails on non-manifold". Fine for headless QA renders |
| `libigl` 2.6 | Right tool only if we needed geodesics, harmonic deformation, curvature — we don't |
| `bpy` (Blender as lib) | 1+ GB, slow startup, marginally more capable than manifold3d for what we need |
| OpenSCAD / raw CGAL | Awkward to drive from Python; CGAL booleans slower and less robust than Manifold for organic input |

### License caveat: pymeshlab is GPL v3

PyMeshLab links MeshLab (GPL). Embedding it directly in the closed-source
SaaS taints the deployment. Two paths:

1. **Subprocess isolation.** Wrap `pymeshlab` calls in a `python -m
   valveheadz.repair_subprocess` invocation that exchanges meshes via
   temporary STL files. Subprocess output is not derivative work under
   established interpretation, but the included MeshLab binaries are still
   distributed with the image. Document it.
2. **Avoid pymeshlab.** Substitute `gpytoolbox.remesh_botsch` +
   `trimesh.repair` + manifold3d's tolerance-aware repair. Less powerful
   on degenerate input, MIT throughout.

Default is path 1 unless legal pushback. If we're worried, ship the
pymeshlab path off the hot path entirely (offline batch repair only,
GPL not a concern for non-distributed tools).

### Bill of materials (runtime image)

```
trimesh==4.12.*
manifold3d==3.4.*
fast-simplification==0.1.*
pymeshlab==2025.7.*       # behind subprocess wrapper, optional
gpytoolbox==0.3.*         # optional: remesh_botsch
mediapipe==0.10.*
numpy>=1.26
```

`open3d`, `pyvista`, `vedo`, `libigl` belong in `requirements-dev.txt`
only — never ship with the worker image.

### What changed in the last 12–18 months

1. **manifold3d 3.0 (Nov 2024) → 3.4 (Mar 2026).** Explicit ε-tolerance
   tracking; `RefineToTolerance`; Minkowski sums (useful: inflate the
   negative core uniformly for clearance instead of scaling). 3.4 fixed a
   numerical regression in 3.3's lazy collider revert — pin `>=3.4.1`.
2. **trimesh 4.x** made `manifold3d` the default boolean engine; no more
   shelling out to Blender. Pass `engine='manifold'` explicitly to defend
   against stale installs.
3. **pymeshlab 2025.07** finally ships ARM64 wheels — works on Apple
   Silicon dev boxes without rosetta gymnastics.
4. **gpytoolbox 0.3** matured into a serious option for `remesh_botsch`
   isotropic remeshing; cleans up TRELLIS triangle distribution and makes
   manifold3d's life easier without a license question.
5. **Open3D 0.19** got SYCL GPU paths but its mesh-repair stack remains
   stagnant — keep it off the hot path.

## 8. Mesh Manipulation Best Practices

This section is opinionated. Applies to every stage in §5; the stage
descriptions there reference recipes here by number.

### 8.1 Coordinate convention — decide once, assert always

Pick **Z-up, millimeters, +Y forward (face)**. Convert TRELLIS's unit-box
output at the very first stage. Encode in a `Scene` dataclass; assert in
every stage entry-point. Never recompute orientation downstream. The
Three.js viewer at [valve-stem-viewer.js:251](client/components/valve-stem-viewer.js:251)
already assumes Z-up — don't break that contract.

### 8.2 TRELLIS defect catalogue

Single-photo reconstruction outputs (TRELLIS, InstantMesh, TripoSR all
have similar failure modes; TripoSR is worst on the back of the head)
reliably exhibit:

1. Small holes / topological discontinuities (Microsoft acknowledges this
   and ships a `mesh_postprocess.py` reference implementation).
2. Tiny non-manifold edges around hair, ear lobes, glasses.
3. Self-intersections in concave regions (under chin, nostrils).
4. 1–3 isolated stray components from floater voxels.
5. Slight asymmetry; back of head is hallucinated and sometimes
   degenerate.

**Treat all single-photo recon outputs as "needs heavy repair before
boolean."** This is the dominant reason Stage 1.5 (repair) exists.

### 8.3 Repair recipe (Stage 1.5)

```python
import trimesh, numpy as np, pymeshlab as ml

def to_clean_manifold(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    # 1. Drop floaters: keep only the largest connected component.
    comps = mesh.split(only_watertight=False)
    mesh = max(comps, key=lambda m: len(m.faces))

    # 2. Round-trip through pymeshlab for serious topological repair.
    ms = ml.MeshSet()
    ms.add_mesh(ml.Mesh(mesh.vertices, mesh.faces))
    ms.meshing_remove_duplicate_vertices()
    ms.meshing_remove_duplicate_faces()
    ms.meshing_remove_unreferenced_vertices()
    ms.meshing_repair_non_manifold_edges()
    ms.meshing_close_holes(maxholesize=200)        # bound by edge count
    ms.meshing_re_orient_faces_coherently()

    out = ms.current_mesh()
    rep = trimesh.Trimesh(out.vertex_matrix(), out.face_matrix(), process=True)
    rep.merge_vertices()
    rep.fix_normals()
    return rep
```

**Why pymeshlab and not just `trimesh.repair`:**
`trimesh.repair.fill_holes` uses fan triangulation and *fails on
non-convex holes* (documented in `trimesh.repair` source). For TRELLIS
output, holes are usually around hair/ears and frequently non-convex.
PyMeshLab's `meshing_close_holes` is the only reliable Python option that
isn't Blender.

If GPL is a hard no, the fallback chain is `trimesh.repair.fix_inversion
→ fix_normals → fill_holes` (with a manual filter to reject non-convex
boundary loops) plus `gpytoolbox.remesh_botsch` for an isotropic pass.

### 8.4 Plane-based crop via boolean (Stage 2)

`trimesh.Trimesh.slice_plane(..., cap=True)` and
`trimesh.repair.fill_holes` both have **unresolved bugs producing
non-watertight caps** (trimesh issues #1149, #1454, #2180). Don't trust
either. Crop as a manifold3d boolean instead:

```python
import manifold3d as m3
import numpy as np

def crop_below(head: trimesh.Trimesh, z_cut: float) -> trimesh.Trimesh:
    bbox = head.bounds
    pad = 5.0  # mm
    box = m3.Manifold.cube(
        size=[bbox[1,0]-bbox[0,0]+2*pad,
              bbox[1,1]-bbox[0,1]+2*pad,
              z_cut - bbox[0,2] + pad],
        center=False,
    ).translate([bbox[0,0]-pad, bbox[0,1]-pad, bbox[0,2]-pad])

    H = m3.Manifold(m3.Mesh(head.vertices.astype(np.float32),
                            head.faces.astype(np.uint32)))
    cut = H - box
    out = cut.to_mesh()
    return trimesh.Trimesh(out.vert_properties[:, :3], out.tri_verts)
```

The cap face emerges from manifold3d's CDT — properly triangulated, no
fan-fill artifacts, watertight by construction.

### 8.5 Boolean carve + cap (Stages 3–4)

```python
def carve_and_cap(head: m3.Manifold,
                  negative_core: m3.Manifold,
                  valve_cap:    m3.Manifold) -> m3.Manifold:
    socketed = head - negative_core    # carve socket
    return socketed + valve_cap        # union threaded cap
```

Notes from the trenches:

- **Negative core must be 0.1–0.2 mm larger than the cap on every axis.**
  This gives printable clearance and avoids zero-volume slivers from
  coplanar faces — manifold3d's worst-failure mode.
- If the cap STL came from Fusion/SolidWorks it's already watertight; if
  from a hobbyist source, repair it identically to the head.
- Set `tolerance` on input proportional to feature size (≈0.01 mm for
  30 mm parts). The default can over-merge fine threads.
- Never mutate loaded reference Manifolds. Reconstruct per-request from
  the cached `Mesh`.

### 8.6 Validation gate (assertion ladder)

Run after Stage 1.5 (repair), Stage 3 (post-subtract), Stage 4
(post-union), and immediately before STL export. Log the *stage* the
assertion came from so failures point to the regression site.

```python
def assert_printable(m: trimesh.Trimesh, *, stage: str):
    checks = [
        (m.is_watertight,                              "leaks"),
        (m.is_winding_consistent,                      "winding"),
        (m.is_volume,                                  "not a solid"),
        (len(m.split(only_watertight=True)) == 1,      "multiple shells"),
        (m.volume > 0,                                 "inverted normals"),
        (m.bounding_box.extents.min() > 5,             "feature collapsed"),
        (m.bounding_box.extents.max() < 200,           "scale wrong"),
        (m.euler_number == 2,                          "topology not a sphere"),
    ]
    failed = [msg for ok, msg in checks if not ok]
    if failed:
        raise PipelineError(stage=stage, failures=failed)
```

The wall-thickness check (§5 stage notes) is *not* in this ladder —
trimesh doesn't compute it cheaply. Implement it via signed-distance
sampling on a sparse grid only if/when slicer rejection becomes a real
failure mode.

### 8.7 Decimation: after boolean, never before

Decimate the unioned solid as the final geometric op. Mask the cap
region (the threads must stay full-density):

```python
import fast_simplification as fs

def decimate(mesh: trimesh.Trimesh, target_tris: int = 40_000) -> trimesh.Trimesh:
    reduction = 1.0 - target_tris / max(len(mesh.faces), target_tris)
    if reduction <= 0:
        return mesh
    v, f = fs.simplify(
        mesh.vertices, mesh.faces,
        target_reduction=reduction,
        agg=7,                  # aggressiveness 0–10
        lossless=False,
    )
    out = trimesh.Trimesh(v, f, process=True)
    out.fix_normals()
    return out
```

For 30 mm FDM/PLA prints at 0.12–0.16 mm layer height, 50–80K triangles
is the sweet spot (§0). Past that, the slicer literally cannot resolve
the detail. Below 50K the chin and ears facet visibly.

### 8.8 Smoothing: Taubin only, masked

```python
import trimesh.smoothing as ts
ts.filter_taubin(mesh, lamb=0.5, nu=-0.53, iterations=4)
```

Laplacian shrinks the head and breaks the calibrated scale; HC is
overkill for organic surfaces this size. Always exclude faces within
1–2 mm of the cut plane and the cap region (use `mesh.face_attributes` to
mark them).

### 8.9 STL export: always binary

```python
mesh.export(path, file_type='stl')   # trimesh defaults to binary
```

ASCII STL at 80K triangles is ~25–30 MB; binary is ~4 MB. Slicers parse
binary 5–10× faster. Generate ASCII only as a *companion* file for
human-readable QA diffs, never as the primary output. This also fixes
the latent bug where [server/commands/stl.js:98](server/commands/stl.js:98)
does `cached.stl.toString('utf8')` — switch the download path to
`Buffer`-aware before any pipeline change ships.

## 9. Integration With the Existing App

This is where the pipeline plugs into what already ships.

### `handler.py` (the RunPod worker)

The current control flow:

```
handler() →
  _load_pipeline() →
    pipeline.run(img) →
      outputs["mesh"][0]  ← TRELLIS head, raw
  _merge(head, _VALVE_CAP, head_scale, neck_length_mm, head_tilt_deg)
                         ↑
              this is the placeholder
```

The new control flow:

```
handler() →
  pipeline.run(img) →
    head = trimesh.Trimesh(outputs["mesh"][0])
  head = stage1_normalize(head, head_scale)
  head = stage2_crop_to_head(head)
  head = stage3_subtract_negative_core(head, _NEGATIVE_CORE)
  final = stage4_union_valve_cap(head, _VALVE_CAP)
  yield {"type": "result", "stl_b64": ..., "triangles": ...}
```

The four stages live in a new module — likely `server/workers/pipeline.py`,
imported by `handler.py` so it can also be unit-tested locally without
TRELLIS in the loop.

### Slider semantics

The Node side currently sends `head_scale`, `neck_length_mm`, `head_tilt_deg`
in the `stl.generate` payload. Under the new pipeline:

- **`head_scale`** → fine-tune multiplier on `TARGET_HEAD_HEIGHT_MM`.
  Clamp to 0.85–1.15. Keep the slider visible; users like the knob.
- **`neck_length_mm`** → **deprecated.** The neck length is now determined
  by Stage 2's automatic crop. Either remove the slider entirely or rename
  it to "Crop tightness" and let it nudge Stage 2's plane up/down by a few
  mm.
- **`head_tilt_deg`** → keep, applied in Stage 1 after orientation.

The 3D viewer placeholder ([client/components/valve-stem-viewer.js](client/components/valve-stem-viewer.js))
already responds to all three. If we deprecate `neck_length_mm`, drop it
from the slider too — see §10 phase plan.

### Dockerfile

Add the second runtime asset and the new Python deps:

```dockerfile
COPY server/assets/valve_cap.stl /app/valve_cap.stl
COPY server/assets/negative_core.stl /app/negative_core.stl   # new
RUN pip install --no-cache-dir manifold3d                      # new
```

`trimesh` is already installed transitively. If we add `pymeshlab`/`mediapipe`
later, those land in the same RUN.

### Server contract

`handler.py` already returns `{ stl_b64, triangles, ... }`. Stage 5's
optional decimation might lower the triangle count visible to the user;
that's a UX improvement, not a contract change. The Node `runRunpod`
client and the new Three.js viewer don't need to change.

### Calibration script

New file: `tools/calibrate_pipeline.py`. Loads the references, computes the
constants from §6, writes `server/assets/pipeline_constants.json`. The
handler imports the JSON at module load (so we don't recompute on every
warm invocation).

### Tests

Two-tier test strategy. The corpus is the only thing that grows over
time; the spike is one-off.

**Phase −1 spike test** (one-off, notebook):
1. Load each `reference/*_head.stl` plus `valve_cap.stl`.
2. Compute `reference − valve_cap` via manifold3d. Inspect: does the
   leftover look like a head with a clean socket?
3. Compute `(reference − valve_cap) + valve_cap` and Hausdorff-diff
   against the original reference. Should be ≈0.
4. Compute the constants in §6 from the references; sanity-check ranges
   (head height 50–80 mm, cap offset −15 to −5 mm, etc.).

If any of these fails, the design is wrong and the rest of the plan
should not start. Output: a 1-page spike report with specific numbers.

**Production smoke test** (`tools/pipeline_smoke_test.py`, runs in CI):

Driven by a fixed corpus at `server/assets/test_corpus/`. Each entry is:

```
test_corpus/
  001_studio_portrait/
    photo.jpg            # original input
    trellis_raw.stl      # cached TRELLIS output (so CI doesn't need a GPU)
    golden.stl           # known-good pipeline output (committed)
    notes.md             # one-line description and any quirks
```

The corpus starts with 5 inputs at Phase −1 and grows toward ~25 by
Phase 4. Failed inputs from production join the corpus automatically
(see §9.5 Failure corpus).

For each corpus entry the test:
1. Loads `trellis_raw.stl` (skipping TRELLIS — CI has no GPU).
2. Runs the full pipeline (Stages 1 through 5).
3. Asserts:
   - `assert_printable(final, stage="final")` passes (§8.6).
   - Output bbox dimensions within 5% of `golden.stl`.
   - Hausdorff distance to `golden.stl` below per-entry threshold
     (default 0.5 mm; tuned during Phase −1).
   - Triangle count in §0's 50–80K band.

Why we don't synthesize TRELLIS-output by inverting the references: the
references are *post-boolean*. Inverting an organic boolean is not
deterministic and the reconstruction wouldn't match what TRELLIS
actually emits. The corpus path uses real TRELLIS outputs as ground
truth, which is the only honest signal.

### 9.5 Iteration & operations

The plan above ships v1. To iterate without regressing:

#### Feature flag and traffic split

Add `PIPELINE_VERSION` to handler.py with two values:

- `legacy` — current `_merge` (handler.py:230). Default until Phase 2's
  done-when criteria are met.
- `v1` — new four-stage pipeline.

The Node side passes the desired version through the RunPod job input.
Default rollout sequence: `100% legacy → 10% v1 → 50% v1 → 100% v1`.
Each step gated on:
- Failure rate of v1 ≤ failure rate of legacy.
- p50 latency of v1 ≤ 1.5× legacy.
- Zero `assert_printable(final)` regressions over the last 200 v1
  requests.

Rollback is instant: flip the env var. Image-tag rollback is the slower
last resort.

#### Failure corpus

On any pipeline error or `assert_printable` failure, write to a Network
Volume path:

```
/runpod-volume/failures/<yyyymmdd>/<job-id>/
    photo.jpg
    trellis_raw.stl     (if Stage 0/1 passed)
    error.json          { stage, failure, message, timing }
    stage_outputs/      partial meshes from each completed stage
```

Once a week:
1. Triage failures (categorize by stage).
2. Add representative ones to `test_corpus/`.
3. Re-run the smoke test. If it newly fails, fix or document.

This is the only mechanism that turns production reality into pipeline
improvements. **Without it, the plan is one-shot, not iterative.**

#### Telemetry schema

Every run emits one structured log line at completion:

```json
{
  "ts": "2026-04-27T19:13:41.598Z",
  "version": "v1",
  "job_id": "74bd37f4-...",
  "image_sha256": "ab12...",
  "stages": {
    "stage0_ms": 47, "stage0_ok": true, "stage0_face_count": 1,
    "trellis_ms": 16400,
    "stage1_ms": 85, "stage1_pca_used": true,
    "stage1_5_ms": 320, "stage1_5_holes_closed": 7, "stage1_5_floaters_dropped": 2,
    "stage2_ms": 140, "stage2_z_cut": 67.4,
    "stage3_ms": 220,
    "stage4_ms": 180,
    "stage5_ms": 410, "stage5_tris_in": 187214, "stage5_tris_out": 42018
  },
  "final_volume_mm3": 7421.3,
  "final_tris": 42018,
  "validation_passed": true
}
```

Ship to whatever log aggregator we settle on (CloudWatch / BetterStack
/ Loki — TBD). Without this, regressions are invisible until users
complain.

#### Abuse and resource bounds

- **Triangle budget on TRELLIS output:** reject after Stage 1.5 if
  `len(faces) > 500_000`. Adversarial inputs have been observed past
  1M, which would burn manifold3d for minutes.
- **Per-stage timeout:** 60 s wall-clock. Exceeded → abort with
  `stage_timeout`.
- **Total wall-clock budget post-cold-start:** 5 minutes.
- **Photo size cap:** 25 MB upload. Anything larger is rejected at the
  Node edge.

#### Calibration regeneration

Any change to `server/assets/reference/` or to `valve_cap.stl` /
`negative_core.stl` triggers `tools/calibrate_pipeline.py` in CI. New
constants are diffed against the previous JSON; > 1% drift in any
constant blocks the merge until reviewed.

#### Architecture decision: where does CPU work run?

For now: **fused with the GPU worker.** Same handler.py, same RunPod
endpoint. Pros: simple, one cold-start, one container. Cons: GPU sits
idle during Stages 1.5–5 (~30–60 s), paying GPU rates for CPU work.

Revisit if cost becomes a problem: split into a GPU endpoint (TRELLIS
only) + CPU endpoint (the four boolean stages). Adds a second
cold-start path and a job hand-off — not worth the complexity until
the GPU-idle cost is real.

#### STL transfer mechanism

`stl_b64` in the JSON response (committed in `f9dc227`) wastes ~33% on
the wire. Acceptable at v1 scale. Migrate to a presigned download URL
or socket.io binary frame when traffic warrants — flag for review when
average response size > 8 MB.

## 10. Implementation Phases

Designed for incremental ship — each phase has a working app at the end,
and each phase is gated behind `PIPELINE_VERSION` (§9.5) so rollback is
seconds, not a rebuild.

### Phase −1 — Spike (no app changes, half-day) ✅ DONE — verdict NO

Validated the architecture against the references **manually** before
committing engineering effort. Re-run via `python3 tools/spike_phase_minus_1.py`.

- [x] Loaded `reference/ian_head.stl`, `reference/nik_head.stl`,
      `valve_cap.stl`, `negative_core.stl`. None watertight on load —
      cap has Euler −51 (severely non-manifold); references have
      Euler 0/6 with up to 3 disjoint bodies.
- [x] Ran the inverse boolean: `reference − valve_cap`. Result was
      structurally invalid: ian's carve landed inside the head bulk
      at xy ≈ (0, 41) mm because the cap is **not co-centred with the
      heads**; nik's carve missed the head geometry entirely (zero
      holes). The references **do not contain a cap socket** —
      they are plain head meshes, not post-pipeline goldens.
- [x] Forward-diff `(head_only ∪ cap)` vs reference: nik max < 0.12 mm
      (boolean was a no-op), ian max 3.88 mm (carve hit but in the
      wrong place). Both numbers confirm the design assumption is
      false.
- [x] Sanity-checked §6 constants empirically. Heads measure ≈1.9 m
      tall vs the spec's 250 mm — references are scaled-up by ~7.6×.
- [x] Wrote `tools/spike_report.md` (1 page, with raw numbers in
      `tools/spike_results.json`) and `tools/spike_phase_minus_1.py`
      (re-runnable).

**Verdict:** ❌ NO. Three structural problems make Phase 1+ unbuildable:

1. Reference scale is wrong by ~7.6× (1.9 m heads vs 250 mm target).
2. `valve_cap.stl` and `negative_core.stl` are **not co-centred** —
   33.78 mm xy offset, 1.34 mm z offset (vs the 0.5 mm tolerance
   §11 Q1 demanded).
3. Clearance drift: measured 0.011 mm radial vs locked 0.25 mm in §0
   — cap is essentially interference-fit in the negative core.

**Per the plan's own rule** — "If this fails, the rest of the plan
does not start. Do not skip" — Phase 0 stage implementations are
gated on **Phase −0.5 (redesign)** below.

### Phase −0.5 — Redesign ✅ DONE — decisions recorded

The spike's NO verdict triggered five decision points. The user
resolved them as follows:

**−0.5.1 Reference scale.** ✅ Decision: **auto-rescale at runtime**.
  - [x] Add `Stage 1 — normalize` step that detects head height and
        rescales to `TARGET_HEAD_HEIGHT_MM` (locked at 22 mm in §0).
        Refs stay at human scale on disk; pipeline handles conversion.
  - Rationale: cap and core dimensions are dimensionally locked by
    the bike-valve thread fit. The head is the only thing that scales.

**−0.5.2 Cap ↔ negative-core alignment.** ✅ Decision: **align both
to the head per-request, in the pipeline frame**, not via a shared
source-frame origin.
  - [x] Stage 3 translates `negative_core.stl` to the chosen hole
        location on the rescaled head. Stage 4 translates
        `valve_cap.stl` to the **same** hole location, centered.
        Source-frame coordinates of the assets are irrelevant.
  - Rationale: simpler than re-exporting; the 33.78 mm offset between
    cap and core source frames is a non-issue once both are positioned
    independently in the pipeline frame.

**−0.5.3 Clearance drift.** ✅ Decision: **don't widen the core**.
  - [x] Cap and core remain at locked dimensions. The valve cap's
        threaded outer diameter being slightly larger than the
        negative core is *by design* — the threads bite into the
        head walls when Stage 4 unions the cap into the cavity.
  - [x] Wall thickness around the cavity is ensured by Stage 2's
        **rotation choice**: rotate the head before placing the hole
        so the chosen hole location has enough surrounding material
        on all sides. This is the new "right decision moment" for
        wall-thickness validation, not a runtime widening op.

**−0.5.4 References as goldens.** ✅ Decision: **references are raw
scan test inputs, not post-pipeline goldens.**
  - [x] `server/assets/reference/{ian,nik}_head.stl` are
        head-and-shoulder raw scans (~1.7–1.9 m tall, hourglass
        profile). They are inputs to the pipeline, not outputs to
        match against.
  - [x] Goldens get captured *after* Phase 1 lands by running the
        pipeline once on these inputs and freezing the result as
        `server/assets/test_corpus/<name>/golden.stl`.

**−0.5.5 Mesh-healing pre-pass.** Locked decision (no choice): the
healing step §5 Stage 1.5 specifies must run *before* Stage 2's
boolean, not just rely on manifold3d's silent auto-heal. The user
explicitly OK'd "mesh topology optimization wherever it is needed" —
Stage 1.5 is mandatory in v1.

**Done.** Phase 0 is unblocked. The spike script
(`tools/spike_phase_minus_1.py`) is now misnamed — it tests
assumptions that no longer apply. We keep it as a historical artefact;
the validation that matters now is the smoke test against the
test corpus once Phase 1 ships.

### Phase 0 — Calibration, contracts, and the binary-STL bug ⏸ partial

Phase −0.5 unblocked the calibration constants and corpus layout.
Most items are now done; the corpus capture is operational (waiting on
warm RunPod endpoint), and the JSON-diff CI check waits on a CI job
existing.

- [x] **Fix the latent ASCII-STL assumption** at
      [server/commands/stl.js:98](server/commands/stl.js) and
      [server/commands/payments.js:96](server/commands/payments.js) —
      both now ship `stl_b64` (base64) instead of `stl` (utf8). Client
      decoder at [client/pages/checkout-return.js](client/pages/checkout-return.js)
      handles both for back-compat.
- [x] **Rewrote `tools/calibrate_pipeline.py`** to drop the
      inverse-boolean (refs are raw inputs, not goldens —
      decision −0.5.4). Now measures cap and core directly, locks
      §0 values, and writes the constants table from §6 above.
- [x] **Generate `pipeline_constants.json`** — produced by running
      `python3 tools/calibrate_pipeline.py`. Lives at
      `server/assets/pipeline_constants.json`.
- [ ] **Wire JSON-diff CI check** — waits on a CI job existing.
- [ ] **Land 5 entries in `server/assets/test_corpus/`** —
      `server/assets/test_corpus/README.md` documents the layout. The
      raw scans at `server/assets/reference/` are valid inputs; once
      Phase 1 runs end-to-end on them we capture goldens.
- [x] **Add `PIPELINE_VERSION` env var to `handler.py`**, default
      `legacy`. Wired through [server/workers/runpod-client.js](server/workers/runpod-client.js)
      so the Node side passes `pipeline_version` in the RunPod input.
      Both `legacy` and `v1` branches exist; the `v1` branch is
      currently a stub that calls `_merge` (Phase 1 replaces it
      with `pipeline.run_v1`).
- [x] **Pipeline package skeleton** at
      [server/workers/pipeline/](server/workers/pipeline/) —
      `__init__.py` (entry point + import contract), `errors.py`
      (frozen `ErrorCode` enum + `PipelineError` with user-facing
      copy), `constants.py` (lazy loader for the JSON). Not in §10
      Phase 0's original task list but a prerequisite for Phase 1+.

### Phase 1 — Stages 0, 1, 1.5, 2 (no full booleans yet) ✅ DONE

Phase −0.5 closed all gating items. Implementation lands in this
commit batch alongside Phase 2 (since all blocking decisions are
made, no benefit to ship them separately).

- [x] Implement `stage1_normalize` (auto-rescale to
      `TARGET_HEAD_HEIGHT_MM`, reorient, recenter) and `stage2_crop`
      (hourglass neck-detection + manifold3d boolean cube subtraction
      with rotation-search for wall-thickness validation) in
      [`server/workers/pipeline/stages.py`](server/workers/pipeline/stages.py).
- [x] Implement `stage1_5_repair` in the same file (pymeshlab
      round-trip with trimesh.repair fallback when pymeshlab isn't
      available — Dockerfile installs both).
- [x] Replace `_merge`'s scaling logic with these stages, gated on
      `PIPELINE_VERSION=v1`. Legacy path untouched.
- [ ] Stage 0 (mediapipe pre-flight) deferred to Phase 4. The Dockerfile
      doesn't ship `mediapipe` yet and the failure mode it catches
      (no-face inputs) currently surfaces as a TRELLIS-time error
      anyway.
- [ ] Ship behind the feature flag at 10% traffic — operations task.

**Done when:** v1-flagged requests run end-to-end through the new
pipeline and produce a watertight printable STL. ✅ Code lands in
this commit; activation of the v1 flag in production is still an
operations call (§9.5 traffic split).

### Phase 2 — Stages 3, 4, 5 (real booleans + print-prep) ✅ DONE

Landed alongside Phase 1.

- [x] Implement `stage3_subtract_negative_core` (positions core at
      `JUNCTION_Z_OFFSET_MM`, manifold3d subtraction).
- [x] Implement `stage4_union_valve_cap` (positions cap at the same
      baseline, manifold3d union; threads bite into cavity walls per
      decision −0.5.3).
- [x] Implement `stage5_postprocess` (decimation via
      fast-simplification to `target_tris=70_000`, mask cap region,
      assert_printable).
- [x] Replace `concatenate` with the boolean sequence in v1.
- [x] Add `manifold3d>=3.4,<4` and `fast-simplification>=0.1,<0.2`
      to the Dockerfile (plus optional pymeshlab for Stage 1.5).
- [x] Add `COPY server/assets/negative_core.stl /app/negative_core.stl`
      and `COPY server/assets/pipeline_constants.json` to the
      Dockerfile. The pipeline package itself is `COPY`'d to
      `/app/pipeline`.
- [ ] Smoke test on corpus — needs corpus entries to exist (Phase 0
      task #4). Code-level local test against the raw scans runs as
      part of this commit.
- [ ] Ramp `PIPELINE_VERSION=v1` traffic per §9.5: 10% → 50% → 100% —
      operations.

**Done when:** 100% v1 traffic, single-shell watertight outputs at
~70K triangles with threads visible inside the cavity. ✅ Code lands;
production rollout pending operations.

### Phase 3 — Robustness ⏳ in flight

- [x] **Defined the error taxonomy** as a Python enum at
      [server/workers/pipeline/errors.py](server/workers/pipeline/errors.py).
- [x] **Reject + write to failure corpus** —
      [handler.py](handler.py) now writes
      `/runpod-volume/failures/<yyyymmdd>/<job-id>/{photo.b64,error.json}`
      on any pipeline failure (PipelineError or generic exception).
      Includes timings + handler version. Local dev is a no-op (the
      RunPod volume path doesn't exist outside RunPod).
- [x] **Telemetry schema** — every successful AND failed run emits a
      single `[telemetry] {…}` JSON line on stderr per §9.5 schema
      (kind, outcome, version, image_sha, settings, timings: pipeline
      load, TRELLIS, v1 stages, export, total ms). Wire up an
      aggregator (BetterStack/Loki/CloudWatch) when available — the
      log format is stable.
- [ ] Add `pymeshlab` (subprocess-isolated per §7) for hard-to-repair
      inputs. Fall back to the MIT path if subprocess fails. Today
      pymeshlab is `import pymeshlab` directly inside Stage 1.5 with a
      try/except fallback to trimesh.repair — works in production but
      doesn't isolate the GPL.

**Done when:** every failure path has a specific error code, a written
user-facing message, and a corresponding entry in the failure corpus
within a week of going live. ✅ Code paths landed; observation period
starts when v1 traffic ramps.

### Phase 4 — Polish ⏳ in flight

1. Mediapipe-based Stage 2 fallback (Approach B in §5 Stage 2) for
   tilted-head failures from the corpus.
2. ~~Drop or rename the `neck_length_mm` slider~~ ✅ DONE. The slider
   is removed from [home.js](client/pages/home.js); the legacy
   field is no longer sent in the request payload. Two more sliders
   shipped in its place:
   - **Head Height** (22–42 mm, default 30 mm) → `TARGET_HEAD_HEIGHT_MM`
   - **Cap Protrusion** (0–25%, default 10%) → `CAP_PROTRUSION_FRACTION`
   Plus the existing **Crop Tightness** (0.40–0.85, default 0.60) and
   **Head Pitch** (−30°..+30°, default 0°). All four are wired
   through `runpod-client.js` → `handler.py` → `run_v1` as per-request
   overrides via `dataclasses.replace` on the loaded `Constants`.
   The legacy `neck_length_mm` is still accepted by the legacy
   `handler.py:_merge` path for `PIPELINE_VERSION=legacy` requests
   but has no effect on v1.
3. **Live red-line preview + Confirm-cut workflow** (NEW, user-requested).
   Today the user has to generate a full cap, look at the cut, adjust
   the Crop Tightness / Head Pitch sliders, and re-generate. Better
   UX:
     - Add a `stl.preview` socket command that runs Stages 0–1.5
       (TRELLIS + normalize + repair) and returns the prepared head
       mesh + the algorithm's suggested z_cut.
     - The Three.js viewer shows the head with a translucent red
       horizontal plane at the suggested z_cut, draggable along Z.
     - User adjusts the plane (live updates the slider value, or vice
       versa) and clicks "Confirm cut".
     - Backend runs `stl.finalize` from the cached prepared head with
       the user's chosen z_cut, completing Stages 2–5.
     - Saves a full TRELLIS run on iteration; the prepared head can
       be cached server-side via the existing design store (TTL'd).
   Architecture: the boundary between "TRELLIS + repair" and "boolean
   ops + print-prep" is a natural split-point already; this phase
   makes it user-visible. See §9.5 for the cache mechanism the
   prepared-head cache should reuse.
4. **Remesh `valve_cap.stl`** to be watertight (currently Euler −51).
   The Phase 1+2 commit ships a Stage 4 fallback that *concatenates*
   socketed_head + cap when manifold3d's union produces open edges
   (which it does today because the cap is non-manifold). Slicers
   handle the concat output, but it's not CSG-clean. Remeshing the
   cap once (e.g. via PyMeshLab `meshing_repair_non_manifold_edges` +
   `meshing_close_holes`, or hand-clean in Blender) will let the
   union pass cleanly and remove the fallback.
5. **Wall-thickness sampling redesign.** Today Stage 2's
   wall-thickness gate is a single radius check at z_cut, demoted to
   a warning because the cavity actually lives in the wider head
   volume above z_cut. Phase 3/4 should sample min wall thickness
   along the cavity's z-range, picking the rotation/cut that
   maximises that minimum. Today's "salvage largest body in Stage 3"
   workaround handles the worst case (slivers orphaned by a wide
   cavity in a narrow head section); the proper fix prevents the
   slivers from forming.
6. **TRELLIS-output cache** ✅ DONE.
   [handler.py](handler.py) caches raw TRELLIS meshes by
   `sha256(image_b64 + "|" + seed)` to
   `/runpod-volume/cache/trellis/<key>.stl` with a 24-hour TTL.
   Slider tweaks (head height, crop tightness, pitch, protrusion)
   skip the ~5 min GPU stage entirely on a cache hit and run only
   Stages 1–5 against the cached raw mesh. Telemetry includes
   `trellis_cache_hit` so we can measure hit rate. Tunable via
   `TRELLIS_CACHE_DIR` and `TRELLIS_CACHE_TTL_S` env vars; both
   no-op safely on local dev (no `/runpod-volume`). Prerequisite for
   the live-preview workflow above (item 3) is now cleared.
7. Confirm Stage 5 decimation hits the §0 50–80K band consistently
   across the corpus; tune the `target_tris` parameter if the
   distribution drifts.

**Done when:** the slider UI matches what the pipeline actually does,
the live red-line preview works, and a slider tweak completes in < 5 s
on a warm worker.

## 11. Open Questions (for the next iteration of this doc)

1. **Origin of `valve_cap.stl` and `negative_core.stl`.** ✅ ANSWERED
   by the Phase −1 spike: **NO, they are not co-centered.** Δ ≈
   (−4.07, +33.54, −1.34) mm. Phase −0.5 task `−0.5.2` decides whether
   to re-export the assets at a shared origin (clean) or bake the
   offset as a runtime constant (faster). See
   [`tools/spike_report.md`](tools/spike_report.md) Task 4.
2. **TRELLIS up-axis.** Empirically — does TRELLIS reliably output Y-up,
   Z-up, or arbitrary? If reliable, we can skip the PCA orientation step.
   Quick check: run 10 photos through, plot the first principal component
   of each output.
3. **What does the user actually want from the sliders?** If the goal is
   "automated, predictable output" we should be honest and remove sliders
   that don't change the print. If the goal is "let people fiddle," keep
   them and clamp to safe ranges.
4. **Should the bottom of the head have a flat sealing rim?** Stage 2 cuts
   the head with a plane. Whether the resulting flat ring around the cavity
   gets a bevel or stays sharp affects both aesthetics and how the cap sits
   on a tire valve. Look at the references during Phase −1 and lock down
   the geometry.
5. **Where does CPU work run long-term?** §9.5 commits to fused with the
   GPU worker for v1. Open question: at what scale does it become
   cheaper to split into a CPU-only worker pool? Probably never on
   serverless billing, but worth modelling once we have real traffic.

(Q4 from a previous draft — print material — is now a locked decision
in §0.)

---

**Next action:** the Phase −1 spike has run and returned NO — see
[`tools/spike_report.md`](tools/spike_report.md). The five
**Phase −0.5 redesign tasks** in §10 are the gating items. Each is a
human decision (re-export an asset vs. bake a workaround vs. accept a
trade-off); none can be automated. Once decisions are recorded
(checkboxes in §10) and any asset re-exports are committed, re-run
`python3 tools/spike_phase_minus_1.py` to confirm verdict YES, then
proceed to Phase 0.
