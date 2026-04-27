# Phase −1 Spike Report — 3D Pipeline Design Validation

**Date:** 2026-04-27
**Repo:** `bikeheadz` @ `main` (e50901e)
**Script:** `tools/spike_phase_minus_1.py` (re-runnable)
**Raw data:** `tools/spike_results.json`

---

## Inputs

| File | Path | Tris | Verts | Watertight | Bodies | Euler | Bbox extents (x,y,z) mm |
|---|---|---|---|---|---|---|---|
| `ian_head` | `server/assets/reference/ian_head.stl` | 200 000 | 99 994 | **No** | 3 | 0 | 1726.18 × 1190.30 × **1899.37** |
| `nik_head` | `server/assets/reference/nik_head.stl` | 200 000 | 99 995 | **No** | 1 | 6 | 1899.15 × 1146.91 × **1881.56** |
| `valve_cap` | `server/assets/valve_cap.stl` | 7 436 | 3 297 | **No** | 1 | −51 | 9.21 × 9.21 × 11.11 |
| `negative_core` | `server/assets/negative_core.stl` | 288 | 98 | **No** | 1 | 2 | 8.31 × 8.31 × 13.78 |

> **Critical:** none of the four input STLs is watertight as loaded. The cap (Euler −51) is severely non-manifold. The references are also non-closed (Euler 0/6, ian has 3 disjoint bodies). manifold3d still consumes them, internally welds, and emits closed output — but the structural assumption "inputs are already watertight" in the plan is **false**.

---

## Test results

### Task 1 — Bbox & comparison

`max |ian.extents − nik.extents| = 172.98 mm` on the X axis (ratio 0.91). The two references disagree by **~10 % on width**, so calibration tolerance has to be ≥ 200 mm if we trust raw bboxes. More importantly, **both heads measure ~1.9 m tall** — the references appear to be in mm but with model coordinates that are ~7.6× the spec's `TARGET_HEAD_HEIGHT_MM ≈ 250 mm`. Either:
- TRELLIS exports happen to be in metres × 1000 (unlikely — the relative dims are head-shaped, not metric-scaled), or
- These references are scaled-up renders for visual review and need to be downscaled (likely ÷7.6) before any pipeline math is meaningful.

Centroids land near origin in xy (`ian≈[14.6, 8.0]`, `nik≈[6.1, 20.2]`), but Z floors are essentially `0` and tops are `~1900`. The references stand on the build plate already; only the absolute scale is wrong.

### Task 2 — Reverse boolean `(ref − cap)`

| | ian_head | nik_head |
|---|---|---|
| head_only tris | 207 094 | 199 978 |
| head_only watertight | **Yes** | **Yes** |
| head_only bodies | 13 | 1 |
| head_only volume mm³ | 1 297 377 560 | 1 122 324 409 |
| Bottom-slab outer area mm² | 1 307 387 | 262.4 |
| Bottom-slab outer circularity | 0.802 | 0.447 |
| Bottom-slab hole count | **1** | **0** |
| Hole area mm² (ian only) | 66.41 | — |
| Hole circularity (ian only) | **0.999** | — |
| z-offset(head_only.min − ref.min) | 0.000 | 0.000 |

**What this means.** The boolean executes — manifold3d auto-heals and emits a closed mesh — but the cap's physical position (xy ≈ −0.46, 40.90 in cap-frame mm) lands somewhere inside ian's huge volume, so the carve produces a perfectly circular ⌀9.2 mm hole *somewhere in the middle of the head bulk* rather than a clean socket on the head's bottom plane. For nik, the same xy lands outside the head's geometry at that altitude, so the boolean produces zero holes — the carve missed the head entirely. The bottom Z plane is unchanged in both cases (`z_offset = 0.0` mm), confirming the cap is **not** subtracted at the bottom of the head.

Bottom-slab circularities of 0.80 and 0.45 are the head silhouettes themselves, not socket discs. **The plan's assumption — that the cap sits centred on the head's bottom plane — is not satisfied by the supplied references.**

### Task 3 — Forward boolean `(head_only ∪ cap)` vs reference

| | mean (mm) | p95 (mm) | p99 (mm) | max (mm) |
|---|---|---|---|---|
| ian recombined | 0.00012 | 0.00000 | 0.04076 | **3.879** |
| nik recombined | 0.00001 | 0.00000 | 0.00000 | **0.118** |

For nik the round-trip is essentially exact (max < 0.12 mm) because the boolean was effectively a no-op. For ian, max distance = 3.88 mm — confirming a real geometric edit took place. p95 ≈ 0 means the deviation is concentrated entirely in a tiny region (the carved-out hole). This is the **boolean smoking gun**: when the carve hits, recombination round-trips cleanly except in the swapped region, and within that region distances reach mm scale because the cap geometry is replacing real head bulk.

### Task 4 — Origin alignment of cap & negative_core

| | x | y | z |
|---|---|---|---|
| `valve_cap` bbox centre | −0.458 | **40.898** | 5.556 |
| `negative_core` bbox centre | −4.524 | **7.363** | 6.892 |
| Δ (cap − neg) | −4.066, 33.535, −1.336 | | |

`‖Δ_xy‖ = 33.78 mm`, `Δ_z = −1.34 mm`. **Not aligned.** They are far from co-centred — by an order of magnitude more than the 0.5 mm tolerance.

The negative_core also extends 13.78 mm tall vs the cap's 11.11 mm — the core is 2.67 mm taller (probably to ensure it fully cuts the threaded region). Both sit on z = 0 baselines, so z-axis stacking is OK; only xy alignment fails.

### Task 5 — Empirical calibration constants

The constants below are computed from the references **as-loaded** (i.e. metres-scale heads). They are mathematically derived but most are **not usable** for the pipeline until the scale and frame issues are resolved.

```json
{
  "TARGET_HEAD_HEIGHT_MM": 1890.4633,
  "VALVE_CAP_OFFSET_FROM_HEAD_BOTTOM_MM": 0.0,
  "NEGATIVE_CORE_DIAMETER_MM": 8.3104,
  "NEGATIVE_CORE_HEIGHT_MM": 13.7832,
  "VALVE_CAP_OUTER_DIAMETER_MM_BBOX": 9.209,
  "VALVE_CAP_THREADED_OUTER_DIAMETER_MM": 8.2892,
  "VALVE_CAP_HEIGHT_MM": 11.112,
  "NEGATIVE_CORE_CLEARANCE_MM": 0.0106,
  "NEGATIVE_CORE_CLEARANCE_LOCKED_MM": 0.25,
  "CAP_REGION_Z_MIN_MM": 0.0201,
  "CAP_REGION_Z_MAX_MM": 0.0201,
  "CAP_REGION_HEIGHT_MM": 0.0,
  "CAP_REGION_RADIUS_MM": 0.0
}
```

Interpretation:
- **`TARGET_HEAD_HEIGHT_MM = 1890`** — clearly wrong vs the spec's ~250 mm. Multiply by 0.132 to land in the right neighbourhood.
- **`VALVE_CAP_OFFSET_FROM_HEAD_BOTTOM_MM = 0`** — derived correctly from the data but it falsely implies the cap is flush at z = ref.bounds[0,2]. Since the cap is *not* actually at the bottom centre of the head, this number describes an artefact, not a feature.
- **`NEGATIVE_CORE_CLEARANCE_MM = 0.0106 mm`** vs the locked 0.25 mm in §0. The threaded outer diameter of the cap is 8.289 mm and the negative_core is 8.310 mm → only **0.011 mm radial clearance**, not 0.25 mm. The two parts are functionally tight-fit, almost zero clearance. Either the negative_core needs to be widened by ~0.48 mm in diameter, or the cap was fabricated tighter than spec.
- **`CAP_REGION_HEIGHT_MM = 0`** and **`CAP_REGION_RADIUS_MM = 0`** — there is no cap region on the heads, because no pre-existing cap was carved into the references. The references appear to be stylised heads only, no socket or cap stub.
- The `VALVE_CAP_THREADED_OUTER_DIAMETER_MM` of 8.289 mm was extracted by Z-binning the cap and taking the median radial max across 20 bins; this excludes any flange. No flange bins exceeded the threaded radius by >5 %, so the cap effectively has no flange (or a very small one).

---

## Empirical calibration constants — **flagged for redesign**

```json
{
  "TARGET_HEAD_HEIGHT_MM": "INVALID — measured 1890 mm; spec ≈ 250 mm. Reference scale is wrong by ~7.6×.",
  "VALVE_CAP_OFFSET_FROM_HEAD_BOTTOM_MM": "UNDETERMINED — references contain no carved socket.",
  "NEGATIVE_CORE_DIAMETER_MM": 8.3104,
  "NEGATIVE_CORE_HEIGHT_MM": 13.7832,
  "VALVE_CAP_OUTER_DIAMETER_MM": 9.209,
  "VALVE_CAP_THREADED_OUTER_DIAMETER_MM": 8.2892,
  "VALVE_CAP_HEIGHT_MM": 11.112,
  "NEGATIVE_CORE_CLEARANCE_MM_MEASURED": 0.0106,
  "NEGATIVE_CORE_CLEARANCE_MM_SPEC": 0.25,
  "CLEARANCE_DRIFT_MM": -0.2394,
  "CAP_REGION_Z_RANGE_MM": "UNKNOWN — references don't contain a cap region.",
  "CAP_REGION_RADIUS_MM": "UNKNOWN — references don't contain a cap region."
}
```

Cap and negative-core dimensions are individually consistent and useful as-is. Everything that ties cap geometry to head geometry is broken.

---

## Verdict

**NO — the design as drafted does not survive the references provided.**

Three structural problems:

1. **Reference scale is wrong by ~7.6×.** Heads measure 1.9 m tall; the spec assumes ~250 mm. Either the source TRELLIS pipeline produces metres-scale output (and Phase 0 must add a normalisation step), or these particular reference STLs are scaled-up review copies and we need correctly-scaled inputs.

2. **References contain no cap socket and no head/cap registration.** The plan in §5 assumes "reverse-boolean a reference to recover the head-only mesh." But these references are *plain heads* with no cap stub or carved socket. Hausdorff(head_only ∪ cap, ref) for nik is ~0 because the cap doesn't intersect the head at all. The reverse-boolean test is therefore not a valid recovery — it is a no-op. The pipeline can't be calibrated against these refs.

3. **`valve_cap` and `negative_core` are not co-centred.** They sit ~33.78 mm apart in xy in their source frames. A ~0.011 mm radial clearance between them (vs the 0.25 mm spec) means the cap fits the negative core almost interference-fit. Stage-4 **must** apply a registration transform (translate the negative_core by Δ ≈ (+4.07, −33.54, +1.34) mm to land on the cap centre) or the boolean for the printable socket will land in the wrong place.

In addition: **none of the four STLs is watertight on load**. The cap especially (Euler −51) is severely non-manifold. The pipeline must apply a robust mesh-healing pre-pass before any boolean. manifold3d masks this by auto-welding, but downstream tools (slicers, Hausdorff against post-healed copies) will not.

**Recommended path forward (Phase 0 redesign tasks):**

1. **Acquire correct references.** Either (a) re-pull TRELLIS output and normalise to a fixed `TARGET_HEAD_HEIGHT_MM = 250` (auto-rescale by `250 / mesh.extents[2]`), or (b) get reference STLs that already contain a cap stub and known head/cap registration.
2. **Bake the cap↔core alignment offset.** Until source frames are unified, hard-code `NEGATIVE_CORE_OFFSET_FROM_CAP_MM = (-4.066, +33.535, -1.336)` (cap−core delta) and apply when assembling. Document this in §5 Stage 4. Re-derive after any new core/cap export.
3. **Resolve the clearance drift.** Either accept the measured 0.011 mm radial clearance (interference fit, may need lubricant/heat for assembly) or scale the negative_core by 1.030× in xy to restore the spec's 0.25 mm clearance. Confirm with a test print before locking.
4. **Add a healing pre-pass** (`trimesh.repair.fill_holes`, `merge_vertices`, `fix_inversion`, `fix_normals`) before Stage 1 of the pipeline. Reject inputs that remain non-watertight. Add unit tests with the existing broken refs as known failure cases.
5. **Synthesise a calibration golden set.** Generate a synthetic head-shape (sphere or simple capsule) at the correct 250 mm scale, attach the actual `valve_cap.stl` at known origin, and use that as the calibration reference instead of TRELLIS output. Phase 0 then verifies all booleans against ground truth before Phase 1 turns on real refs.

---

## Surprises & follow-ups for Phase 0+

- **manifold3d silently heals non-watertight inputs** during the boolean. Output is a closed manifold even when both inputs are open. This is convenient but masks data-quality issues — Phase 0 must check inputs *before* the boolean, not infer health from the output.
- **ian_head has 3 disjoint bodies** (Euler 0). After boolean it has **13 bodies**. The carve produced ~10 detached fragments. Pipeline should select the largest body by volume after every boolean and discard the rest, or fail loudly if a single output body isn't ≥ 99.9 % of total volume.
- **nik_head bottom-slab circularity 0.447** indicates a non-circular cross-section at the heel — slicers that assume a circular footprint for support generation may need an oriented-bounding-box sanity check.
- **Cap's Euler −51** suggests a lot of internal threads and flange edges shared by multiple faces (non-2-manifold). manifold3d copes; OpenSCAD or older booleans will not. If we ever swap engines, we need a re-mesh of `valve_cap.stl` first.
- The `ian_head` bbox center xy is essentially origin (`−0.012, +0.971`), but `nik_head` is also near origin. The cap is at xy `(−0.458, +40.898)`. So the cap is centred ~40 mm off the head's z-axis. **The cap's source frame is not the head's source frame.** This needs explicit alignment, not assumed.
- The pipeline plan needs a "registration step" early in Stage 1 that aligns all four meshes to a common frame (origin at head bottom-centre, +Z up). Without it, every downstream measurement is meaningless.
- Add `tools/spike_phase_minus_1.py` to CI so Phase 0 changes are validated on every PR.
