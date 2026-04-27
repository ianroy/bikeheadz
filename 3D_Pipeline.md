# 3D Pipeline Plan — Photo → Printable Bike Valve Cap

**Status:** Planning. Not implemented. Working assets are committed at
`server/assets/` so the eventual implementation has known-good inputs and
golden-output references to calibrate against.

**Owner of this doc:** Pipeline architecture and the asset contracts. Anything
inside `handler.py` past the TRELLIS call belongs here.

---

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
| `valve_cap.stl` | ~25,500 | The threaded screw cap. Must be added without deformation — fit matters; threads grip a real Presta valve. |
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
                                   ┌──────────────────────────────────┐
                                   │ TRELLIS (existing, on GPU)       │
photo  ────────►  handler.py  ───► │  outputs["mesh"][0]              │
                                   │  ~200K triangles, unitless,      │
                                   │  watertight-ish, head + chest    │
                                   └────────────┬─────────────────────┘
                                                │ trimesh.Trimesh
                                                ▼
                              ┌──────────────────────────────────────┐
                              │ STAGE 1 — Normalize & calibrate      │
                              │ Convert to mm. Scale to match the    │
                              │ canonical reference height.          │
                              │ Reorient so +Z is up, head-down at   │
                              │ the origin.                          │
                              └────────────┬─────────────────────────┘
                                           ▼
                              ┌──────────────────────────────────────┐
                              │ STAGE 2 — Crop to neck-and-up        │
                              │ Find the chin/neck transition; slice │
                              │ with a horizontal plane; close the   │
                              │ resulting hole into a flat disc.     │
                              └────────────┬─────────────────────────┘
                                           ▼
                              ┌──────────────────────────────────────┐
                              │ STAGE 3 — Boolean: subtract socket   │
                              │ Position negative_core.stl at the    │
                              │ head bottom; subtract.               │
                              │ Result: head with a clean cavity.    │
                              └────────────┬─────────────────────────┘
                                           ▼
                              ┌──────────────────────────────────────┐
                              │ STAGE 4 — Boolean: insert valve cap  │
                              │ Translate valve_cap.stl to the same  │
                              │ pose; union with the cavity head.    │
                              │ Threads must remain exposed.         │
                              └────────────┬─────────────────────────┘
                                           ▼
                                       final.stl
                              (single manifold, slicer-clean)
```

## 5. Stage-by-stage Technical Detail

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
  fails ≈10% of the time. Fallback: render the mesh from a few angles and
  pick the one with the highest face-detection confidence (mediapipe).
- The reference STLs include the valve cap. Subtract its height when
  computing `TARGET_HEAD_HEIGHT_MM`.

### Stage 2 — Crop to neck-and-up

**Why:** TRELLIS often returns head + shoulders. The cap only wants the head.

**Inputs:** Stage 1 output, oriented and scaled.

**Approach A (heuristic, ship first):**
1. Sweep horizontal cross-sections from the bottom of the bounding box
   upward. For each, compute the convex-hull radius.
2. The radius profile typically goes: *narrow (chest tapers up to neck) →
   minimum (neck) → bulges out (jaw/head) → tapers down to top of skull*.
3. Find the local minimum *below* the global maximum — that's the neck.
4. Slice with a horizontal plane at that Z. Discard the lower half.
5. Close the cut hole into a flat disc by triangulating the open boundary
   loop (`trimesh.repair.fill_holes`).

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
- `head_cropped` from Stage 2 (must be watertight; verify with
  `trimesh.repair.fill_holes` + `is_watertight`).
- `negative_core.stl` from `server/assets/`.

**Steps:**
1. **Repair** both meshes if needed:
   - `trimesh.repair.fix_normals(head_cropped)`
   - `trimesh.repair.fix_winding(head_cropped)`
   - `trimesh.repair.fill_holes(head_cropped)`
   - For TRELLIS output, also consider `trimesh.smoothing.filter_taubin` at a
     very low strength to remove staircase artifacts.
2. **Position the negative core.** Translate it so its top face is flush
   with the bottom plane of the cropped head, centered on the head's XY
   centroid at that plane.
3. **Boolean subtract.**
   ```
   head_with_cavity = manifold3d.Manifold(head_cropped) - manifold3d.Manifold(negative_core)
   ```
4. **Validate:** `head_with_cavity.is_watertight` must be `True`. If not,
   surface the failure as an error (don't ship a broken STL).

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
   the cavity walls (≈0.1–0.2 mm clearance for thermal expansion in
   resin/SLA prints).
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
  design. (Action item: see §8.)

### Stage 5 — Print-prep (optional, post-MVP)

Not part of the user's 4 steps but worth noting:

- **Decimate** to a sensible triangle budget. 200K is fine for a slicer but
  bloats the wire format. Target 50K–80K with `trimesh.simplify.simplify_quadric_decimation`.
- **Smooth** any TRELLIS staircase artifacts on the head (Taubin filter,
  low pass).
- **Repair** any post-boolean small holes one more time.
- **Validate** with `trimesh.repair.broken_faces` and reject if any.

## 6. Calibration

Calibration is a one-time, offline step that produces *constants* baked into
the code. It is not a runtime step.

Source files:
- `server/assets/reference/ian_head.stl`
- `server/assets/reference/nik_head.stl`

Constants we extract:
- `TARGET_HEAD_HEIGHT_MM` — height of the head portion only, averaged across
  references. This drives Stage 1 scaling.
- `VALVE_CAP_OFFSET_FROM_HEAD_BOTTOM_MM` — vertical offset between the head
  bottom plane and the valve cap's reference origin. Drives Stage 3/4
  positioning.
- `NEGATIVE_CORE_DIAMETER_MM` and `VALVE_CAP_OUTER_DIAMETER_MM` — verifies
  the clearance fit. (Calibration assertion, not a runtime input.)

Deliverable: a small Python script `tools/calibrate_pipeline.py` that loads
the references, prints these numbers, and writes them to a JSON file the
handler imports. Cheap to re-run if the reference set changes.

## 7. Tool Selection

**Required:**
- **`trimesh`** — already a dependency. Used for STL I/O, transforms, slicing,
  hole filling, decimation, normal repair.
- **`manifold3d`** — new dependency. Boolean ops via Manifold's exact CSG.
  Pip-installable, no native build, MIT-licensed.

**Optional (Phase 2+):**
- **`pymeshlab`** — if `trimesh.repair` isn't enough for stubborn TRELLIS
  output. Provides MeshLab's "Close Holes" and "Re-Orient Faces Coherently"
  filters. Adds ~120 MB to the container.
- **`open3d`** — only if we need point-cloud-style registration to align
  TRELLIS heads to the reference set (currently overkill).
- **`mediapipe`** — for Approach B in Stage 2 (chin landmark detection).
  ~30 MB, useful even outside this pipeline (e.g., pre-flight photo
  validation: "no face detected, please use a clearer photo").

**Rejected:**
- **Blender as a library (`bpy`)** — too heavy (1+ GB), slow startup, only
  marginally more capable than `manifold3d` for our needs.
- **OpenSCAD** — fundamentally a CSG language, awkward to drive from Python,
  and CGAL booleans are slower and less tolerant than Manifold.
- **CGAL Python bindings** — works but `manifold3d` is faster and more
  pythonic for this volume of operations.

## 8. Integration With the Existing App

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
from the slider too — see §9 phase plan.

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

New file: `tools/pipeline_smoke_test.py`. For each reference STL,
synthetically reconstruct what TRELLIS *would have* produced (e.g., crop
the reference to remove the valve cap, leaving a head-only mesh) and run
the pipeline forward. Assert:
- Output bounding box matches the reference within tolerance.
- Output is watertight.
- Hausdorff distance to the reference is below threshold.

Run it in CI on every commit that touches the pipeline.

## 9. Implementation Phases

Designed for incremental ship — each phase has a working app at the end.

### Phase 0 — Calibration & contracts (no code change to handler)
1. Write `tools/calibrate_pipeline.py`.
2. Generate `server/assets/pipeline_constants.json`.
3. Confirm `negative_core.stl` and `valve_cap.stl` share an origin and that
   the negative core is correctly oversized vs. the cap (§5 Stage 4 risk).
4. **Done when:** the constants file exists and a unit test asserts the
   geometric relationship between the two cap-related STLs is sane.

### Phase 1 — Stage 1 + Stage 2 (no booleans yet)
1. Implement `stage1_normalize` and `stage2_crop_to_head` in
   `server/workers/pipeline.py`.
2. Replace the *scaling* part of `_merge` in `handler.py` with calls to
   these stages. Keep the existing `concatenate` for now.
3. **Done when:** the live app shows correctly-scaled, neck-cropped heads
   sitting on top of the unmodified valve cap (still two shells, still not
   printable).

### Phase 2 — Stage 3 + Stage 4 (real booleans)
1. Add `manifold3d` to the Dockerfile.
2. Add the negative core to the Dockerfile COPY.
3. Implement `stage3_subtract_negative_core` and `stage4_union_valve_cap`.
4. Replace `_merge`'s `concatenate` call with the boolean sequence.
5. **Done when:** the live app outputs single-shell, watertight,
   slicer-clean STLs that look like the references when overlaid.

### Phase 3 — Robustness
1. Auto-watertight repair before Stage 3.
2. Reject (don't silently degrade) inputs that fail validation; surface
   meaningful errors to the client.
3. Implement the calibration smoke test in CI.
4. **Done when:** failure modes are explicit ("no face detected", "mesh not
   manifold after repair", "head pose ambiguous") instead of weird outputs.

### Phase 4 — Polish
1. Mediapipe-based Stage 2 fallback.
2. Decimate output to ~80K triangles.
3. Drop or rename `neck_length_mm` slider.
4. Update [client/pages/home.js](client/pages/home.js) and the viewer
   accordingly.
5. **Done when:** the slider UI matches what the pipeline actually does.

## 10. Open Questions (for the next iteration of this doc)

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
4. **Print material assumption.** Resin (SLA) prints crisp threads but is
   brittle. FDM PLA at 0.1mm prints functional threads but with looser
   tolerance. The negative core's clearance over the valve cap should be
   tuned to the dominant target — confirm with whoever's running fulfillment.
5. **Should the bottom of the head have a flat sealing rim?** Stage 2 cuts
   the head with a plane. Whether the resulting flat ring around the cavity
   gets a bevel or stays sharp affects both aesthetics and how the cap sits
   on a tire valve. Look at the references and lock down the geometry.

---

**Next action:** review this doc, refine §5 and §9, then start Phase 0 by
writing `tools/calibrate_pipeline.py` to extract the constants from the
reference STLs.
