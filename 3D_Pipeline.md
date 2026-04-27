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
  design. (Action item: see §11.)

### Stage 5 — Print-prep

Not part of the user's 4 steps but mandatory for printable, wire-efficient
output. Order matters: **decimate after the boolean, not before.**
Decimating first throws away features the boolean needs to land cleanly,
and manifold3d 3.x is fast enough on 200K-tri inputs (sub-second) that the
"speed up the boolean" argument doesn't hold.

- **Decimate** the unioned solid to **30–60K triangles**. At ~30 mm part
  size, more is invisible to the slicer. Use `fast-simplification`
  (Cython wrapper around sp4cerat's QEM — ~4× faster than MeshLab and
  meaningfully better preservation than Open3D's, which has a known
  hole-creation bug — Open3D issue #4083). Decimation must **mask out
  the cap region** so the threads are preserved at full density.
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

### 8.3 Repair recipe (between TRELLIS and Stage 1's scaling)

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

For 30 mm prints at 0.1–0.2 mm layer height, 30–60K triangles is the
sweet spot. Past that, the slicer literally cannot resolve the detail.

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

New file: `tools/pipeline_smoke_test.py`. For each reference STL,
synthetically reconstruct what TRELLIS *would have* produced (e.g., crop
the reference to remove the valve cap, leaving a head-only mesh) and run
the pipeline forward. Assert:
- Output bounding box matches the reference within tolerance.
- Output is watertight.
- Hausdorff distance to the reference is below threshold.

Run it in CI on every commit that touches the pipeline.

## 10. Implementation Phases

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
4. **Print material assumption.** Resin (SLA) prints crisp threads but is
   brittle. FDM PLA at 0.1mm prints functional threads but with looser
   tolerance. The negative core's clearance over the valve cap should be
   tuned to the dominant target — confirm with whoever's running fulfillment.
5. **Should the bottom of the head have a flat sealing rim?** Stage 2 cuts
   the head with a plane. Whether the resulting flat ring around the cavity
   gets a bevel or stays sharp affects both aesthetics and how the cap sits
   on a tire valve. Look at the references and lock down the geometry.

---

**Next action:** review this doc, refine §5 and §10, then start Phase 0 by
writing `tools/calibrate_pipeline.py` to extract the constants from the
reference STLs.
