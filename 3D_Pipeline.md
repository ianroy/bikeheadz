# 3D Pipeline Plan — Photo → Printable Bike Valve Cap

**Status:** Planning. Not implemented. Working assets are committed at
`server/assets/` so the eventual implementation has known-good inputs and
golden-output references to calibrate against.

**Owner of this doc:** Pipeline architecture and the asset contracts. Anything
inside `handler.py` past the TRELLIS call belongs here.

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
| **Negative-core clearance** | **0.25 mm radial** over the valve cap's outer profile | FDM/PLA at 0.4 mm nozzle and 0.12–0.16 mm layers leaves shrinkage (~0.2–0.3% for PLA), elephant-foot at the cap base, and extrusion-width tolerance combining to roughly 0.15 mm of slop. 0.25 mm gives clean thread clearance without slop in the assembled part. SLA would want 0.10–0.15 mm. |
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
Presta/Schrader valve.

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
| `valve_cap.stl` | ~7,400 | Minimal threaded screw cap (sourced from `Screw Cap Minimal.stl`). Same thread profile as a real valve cap, but no decorative exterior — just the threaded cylinder. Lower triangle count means cleaner manifold3d booleans and faster Stage 3/4 ops. Must be added without deformation — fit matters; threads grip a real Presta valve. |
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

**Validation:** Run `assert_printable(stage="stage1.5")` (§8.6) — but
relax the `is_volume` and `is_winding_consistent` checks since the
post-repair head isn't yet a closed solid (no socket, no cap). Tighten
those checks again at Stage 3 and 4.

**Reference implementation to read first:** Microsoft ships a
`mesh_postprocess.py` in the TRELLIS repo. Likely covers 60–80% of what
we need against the same defect catalogue. Read it before writing
ours — don't reinvent.

**Risks:**
- pymeshlab is GPL v3. See §7's license caveat for the subprocess
  isolation pattern. If legal kills this path, fall back to
  `trimesh.repair` + `gpytoolbox.remesh_botsch`, accepting weaker
  hole-closing on non-convex boundaries.

### Stage 2 — Crop to neck-and-up

**Why:** TRELLIS often returns head + shoulders. The cap only wants the head.

**Inputs:** Stage 1 output, oriented and scaled.

**Approach A (heuristic, ship first):**
1. Sweep horizontal cross-sections from the bottom of the bounding box
   upward. For each, compute the convex-hull radius.
2. The radius profile typically goes: *narrow (chest tapers up to neck) →
   minimum (neck) → bulges out (jaw/head) → tapers down to top of skull*.
3. Find the local minimum *below* the global maximum — that's `z_cut`.
4. **Crop via boolean, not `trimesh.slice_plane`.** Construct an
   axis-aligned box covering the head bounding-box footprint up to `z_cut`
   and subtract it from the head as a `manifold3d` operation. This produces
   a watertight mesh with a *properly triangulated* flat disc at the cut —
   `trimesh.slice_plane(cap=True)` and `trimesh.repair.fill_holes` are both
   known to leave non-manifold caps on non-convex boundary loops
   (trimesh issues #1149, #2180). Boolean cropping bypasses both bugs.

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

Constants we extract:

| Constant | Source | Used by |
|---|---|---|
| `TARGET_HEAD_HEIGHT_MM` | Reference bbox height minus cap section, averaged | Stage 1 scaling |
| `VALVE_CAP_OFFSET_FROM_HEAD_BOTTOM_MM` | Z offset between head bottom plane and the cap's reference origin | Stage 3/4 positioning |
| `NEGATIVE_CORE_DIAMETER_MM` | Measured from `negative_core.stl` | Calibration assertion |
| `VALVE_CAP_OUTER_DIAMETER_MM` | Measured from `valve_cap.stl` | Calibration assertion |
| `NEGATIVE_CORE_CLEARANCE_MM` | Locked at **0.25 mm** (FDM, §0); calibration verifies actual radial gap matches | Stage 3 sizing assertion |
| `MANIFOLD_TOLERANCE_MM` | Locked at **0.01 mm** (§8.5); 1/3000 of part bbox | Passed to manifold3d on every Manifold construction |
| `CAP_REGION_Z_RANGE_MM` | Z range of cap-section faces in the references (e.g. `[-12.0, -3.0]`) | Mask for §8.7 decimation and §8.8 smoothing |
| `CAP_REGION_RADIUS_MM` | XY radius around origin that bounds the cap-section faces | Same mask |
| `MIN_WALL_THICKNESS_MM` | Locked at **1.2 mm** (FDM @ 0.4 mm nozzle, §0). SLA fallback would be 0.8 mm | Optional §8.6 wall-thickness check |

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
   bikeheadz.repair_subprocess` invocation that exchanges meshes via
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

### Phase −1 — Spike (no app changes, half-day)

Validate the architecture against the references **manually** before
committing engineering effort.

1. Open a Jupyter notebook with `trimesh` + `manifold3d`.
2. Load `reference/ian_head.stl`, `reference/nik_head.stl`,
   `valve_cap.stl`, `negative_core.stl`.
3. Run the inverse boolean: `reference − valve_cap`. Inspect the result —
   should be a head with a clean socket. Confirm the socket geometry
   matches what we expect Stage 3 to produce.
4. Run `(reference − valve_cap) + valve_cap` and Hausdorff-diff against
   the original reference. Result should be ≈0 mm. If not, the
   negative-core / valve-cap pair don't share an origin and we have to
   bake in a translation offset.
5. Sanity-check the §6 calibration constants by hand on both references.
   Bounding-box agreement between the two heads tells us the calibration
   tolerance.
6. Write a 1-page spike report.

**Done when:** the report says "yes, design works" with specific
numbers, OR identifies a structural problem to redesign around.

**If this fails, the rest of the plan does not start.** Do not skip.

### Phase 0 — Calibration, contracts, and the binary-STL bug

1. Fix the latent ASCII-STL assumption at
   [server/commands/stl.js:98](server/commands/stl.js:98) — switch the
   download path to `Buffer`-aware before any pipeline change touches
   the wire. Without this, post-payment downloads will be corrupt the
   moment binary STLs ship from the new pipeline.
2. Write `tools/calibrate_pipeline.py`. Generate
   `server/assets/pipeline_constants.json` from the references.
3. Wire the JSON-diff CI check (§9.5 calibration regeneration).
4. Land 5 entries in `server/assets/test_corpus/` (capture
   `trellis_raw.stl` + `golden.stl` from manual TRELLIS runs in dev).
5. Add `PIPELINE_VERSION` env var to handler.py; default `legacy`. No
   logic branches on it yet.

**Done when:** constants file exists, ASCII-STL bug is fixed, corpus
has ≥5 entries, CI calibration check is green.

### Phase 1 — Stages 0, 1, 1.5, 2 (no full booleans yet)

1. Implement `stage0_validate`, `stage1_normalize`, `stage1_5_repair`,
   `stage2_crop` in `server/workers/pipeline.py`.
2. Replace `_merge`'s scaling logic with these stages, gated on
   `PIPELINE_VERSION=v1`. Keep the `concatenate` glue for now (still
   not printable; that's fine — Phase 2 fixes it).
3. Ship behind the feature flag at 10% traffic.

**Done when:** v1-flagged requests show correctly-scaled, neck-cropped
heads sitting on top of the unmodified valve cap. Stage 0–2 telemetry
in the logs (§9.5).

### Phase 2 — Stages 3, 4, 5 (real booleans + print-prep)

1. Add `manifold3d` and `fast-simplification` to the Dockerfile.
2. Add `negative_core.stl` to the Dockerfile COPY.
3. Implement `stage3_subtract_negative_core`, `stage4_union_valve_cap`,
   `stage5_postprocess`. Replace `concatenate` with the boolean
   sequence in v1.
4. Smoke test must pass on all corpus entries before flag flip.
5. Ramp `PIPELINE_VERSION=v1` traffic per §9.5: 10% → 50% → 100%.

**Done when:** 100% v1 traffic, single-shell watertight outputs at
50–80K triangles matching the references when overlaid.

### Phase 3 — Robustness

1. Define the error taxonomy as Python enum + Node-side handling +
   user-facing copy:
   - `no_face_detected`
   - `low_image_quality`
   - `head_pose_ambiguous`
   - `non_manifold_input_unrepairable`
   - `boolean_failed`
   - `output_not_watertight`
   - `output_dimensions_out_of_range`
   - `triangle_budget_exceeded`
   - `stage_timeout`
2. Reject (don't silently degrade) inputs that fail validation. Each
   rejection writes to the failure corpus (§9.5).
3. Add `pymeshlab` (subprocess-isolated per §7) for hard-to-repair
   inputs. Fall back to the MIT path if subprocess fails.
4. Wire the telemetry schema (§9.5) to a real log aggregator.

**Done when:** every failure path has a specific error code, a written
user-facing message, and a corresponding entry in the failure corpus
within a week of going live.

### Phase 4 — Polish

1. Mediapipe-based Stage 2 fallback (Approach B in §5 Stage 2) for
   tilted-head failures from the corpus.
2. Drop or rename the `neck_length_mm` slider (Stage 2 picks the cut
   automatically). Update [client/pages/home.js](client/pages/home.js)
   and the viewer accordingly.
3. TRELLIS-output cache: key by `sha256(image)+seed`, store on the
   Network Volume. Slider tweaks reuse the cached raw mesh and re-run
   only Stages 1.5–5. Big UX and cost win.
4. Confirm Stage 5 decimation hits the §0 50–80K band consistently
   across the corpus; tune the `target_tris` parameter if the
   distribution drifts.

**Done when:** the slider UI matches what the pipeline actually does,
and a slider tweak completes in < 5 s on a warm worker.

## 11. Open Questions (for the next iteration of this doc)

1. **Origin of `valve_cap.stl` and `negative_core.stl`.** Are they
   co-centered in their source coordinate frames? If yes, Stage 3 and
   Stage 4 use the same translation matrix — clean. If not, we need a
   one-time alignment offset baked in. Verify before Phase 0.
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

**Next action:** confirm §0 decisions (especially the FDM
filament/profile/nozzle assumptions with the print vendor), then run
**Phase −1 (the spike)** in §10. Everything else waits on the spike
report. After the spike, refine §5, §8, and §10 with whatever the spike
teaches us, and start Phase 0.
