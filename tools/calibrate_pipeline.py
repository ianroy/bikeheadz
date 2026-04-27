#!/usr/bin/env python3
"""
calibrate_pipeline.py — produce server/assets/pipeline_constants.json
=====================================================================

Purpose
-------
Compute the calibration constants defined in `3D_Pipeline.md` §6 from the
committed reference STLs and write them to
``server/assets/pipeline_constants.json``. The handler imports that JSON
at module load (no recompute on warm invocations); this script is the
*only* writer.

When this runs
--------------
* **Manually** — after design changes touch any of:
  ``server/assets/valve_cap.stl``, ``server/assets/negative_core.stl``,
  ``server/assets/reference/*.stl``.
* **CI** — the §9.5 "calibration regeneration" check re-runs this on PR
  and diffs the resulting JSON. >1% drift in any constant blocks the
  merge until reviewed (see §6 last paragraph).

Relationship to the rest of the plan
------------------------------------
This script is the deliverable for Phase 0 task #2 (§10). It is **not**
on the runtime path. The runtime handler reads the JSON it produces;
that's the only contract between this script and the rest of the system.
Re-running the spike from Phase −1 is an explicit prerequisite — if the
spike says "design doesn't work", these numbers are meaningless and
shouldn't be regenerated.

Inputs
------
* ``server/assets/reference/ian_head.stl``  (golden output #1, ~200K tris)
* ``server/assets/reference/nik_head.stl``  (golden output #2, ~200K tris)
* ``server/assets/valve_cap.stl``           (~7.4K tris)
* ``server/assets/negative_core.stl``       (~290 tris)

Outputs
-------
* ``server/assets/pipeline_constants.json`` — the calibration artifact.

Exit codes
----------
* 0 — constants written, all internal-consistency checks passed.
* 1 — internal-consistency check failed, or in ``--strict`` mode any
  warning was emitted. JSON is **not** written in this case.

Flags
-----
* ``--dry-run``  Print JSON to stdout, do not write the file.
* ``--strict``   Promote warnings to errors. Useful in CI.

Conventions
-----------
Stdlib only except for ``trimesh``, ``manifold3d``, ``numpy`` (per the
runtime BoM in §7). Z-up, +Y forward, millimeters everywhere (§8.1).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import trimesh

# manifold3d is the boolean engine (§0, §7). Imported eagerly so a
# missing wheel fails fast with a clear traceback rather than mid-run.
import manifold3d as m3


# --------------------------------------------------------------------------
# Repo layout — paths are resolved relative to the repo root, which is the
# parent of this `tools/` directory. We intentionally do *not* take the cwd
# into account; the script must be runnable from any directory (CI runs it
# from the repo root, but a local dev re-run from `tools/` should also work).
# --------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parent.parent
ASSETS_DIR = REPO_ROOT / "server" / "assets"
REFERENCE_DIR = ASSETS_DIR / "reference"

VALVE_CAP_PATH = ASSETS_DIR / "valve_cap.stl"
NEGATIVE_CORE_PATH = ASSETS_DIR / "negative_core.stl"
REFERENCE_PATHS = [
    REFERENCE_DIR / "ian_head.stl",
    REFERENCE_DIR / "nik_head.stl",
]
OUTPUT_PATH = ASSETS_DIR / "pipeline_constants.json"


# --------------------------------------------------------------------------
# Locked constants from §0. The script must *write* them into the JSON,
# not derive them — they are a contract, not a measurement. Keeping them
# here (rather than hardcoded inline) makes it obvious to a reader where
# they came from and what would change if §0 ever shifted.
# --------------------------------------------------------------------------
LOCKED_MANIFOLD_TOLERANCE_MM = 0.01     # §8.5: 1/3000 of a 30 mm part.
LOCKED_MIN_WALL_THICKNESS_MM = 1.2      # §0: FDM at 0.4 mm nozzle, 3× nozzle.
LOCKED_NEGATIVE_CORE_CLEARANCE_MM = 0.25  # §0: FDM/PLA radial clearance.

# Calibration tolerances — both expressed as fractions of the locked target.
REFERENCE_BBOX_AGREEMENT_TOLERANCE = 0.05   # 5 % per spec point #6.
CLEARANCE_DRIFT_WARN_THRESHOLD = 0.20       # 20 % per spec point #6.
DRIFT_FROM_LOCKED_NOTE_THRESHOLD = 0.01     # 1 % per §6 last paragraph.


# --------------------------------------------------------------------------
# Diagnostics — printed to stderr so stdout stays clean for --dry-run JSON.
# --------------------------------------------------------------------------
def log(msg: str) -> None:
    """Emit a status line to stderr. Stdout is reserved for --dry-run JSON."""
    print(msg, file=sys.stderr, flush=True)


def warn(msg: str, *, strict: bool, notes: list[str]) -> None:
    """
    Emit a warning. In --strict mode it raises; otherwise it's appended to
    `calibration_notes` so reviewers see it in the JSON diff.
    """
    line = f"WARN: {msg}"
    log(line)
    notes.append(msg)
    if strict:
        raise SystemExit(f"--strict: {msg}")


# --------------------------------------------------------------------------
# Asset loading & basic validation
# --------------------------------------------------------------------------
def sha256_of(path: Path) -> str:
    """SHA-256 of file bytes. Embedded in the JSON so a future reader can
    tell at a glance whether the input changed without re-running this
    script. Streamed in 1 MiB chunks because the references are ~10 MB."""
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_stl(path: Path) -> trimesh.Trimesh:
    """
    Load an STL into a single ``trimesh.Trimesh``. We assert the result is
    actually a Trimesh (not a Scene), non-empty, and has finite vertices.
    This is the closest the calibration step gets to mesh repair — Stage
    1.5 in the runtime pipeline does the heavy lifting.
    """
    if not path.exists():
        raise SystemExit(f"missing input asset: {path}")

    # process=False keeps the original triangle count for honest reporting.
    # We don't want trimesh's auto-merge to skew the tris-on-disk count.
    mesh = trimesh.load(path, force="mesh", process=False)

    if not isinstance(mesh, trimesh.Trimesh):
        raise SystemExit(f"{path} did not load as a Trimesh (got {type(mesh).__name__})")
    if len(mesh.faces) == 0:
        raise SystemExit(f"{path} loaded with zero triangles")
    if not np.isfinite(mesh.vertices).all():
        raise SystemExit(f"{path} has non-finite vertices")

    return mesh


# --------------------------------------------------------------------------
# trimesh ↔ manifold3d bridge
# --------------------------------------------------------------------------
def to_manifold(mesh: trimesh.Trimesh) -> m3.Manifold:
    """
    Convert a trimesh.Trimesh into a manifold3d Manifold. Per §8.5 we set
    a part-scale tolerance on construction so manifold3d's snap-rounding
    doesn't over-merge fine threads on the cap.

    Note: we don't repair here. If the reference is too damaged to import
    cleanly into manifold3d, the script should fail loudly — that's a
    signal the references themselves regressed, not a bug to paper over.
    """
    verts = np.asarray(mesh.vertices, dtype=np.float32)
    faces = np.asarray(mesh.faces, dtype=np.uint32)

    # DECISION: manifold3d's Python API has shifted between 3.0 and 3.4
    # over how Mesh-from-arrays is constructed (positional vs. kwarg vs.
    # `MeshGL`). We try the most common 3.4 form first and fall back to
    # the older signature so the script keeps working across the pin
    # range declared in §7 (manifold3d 3.4.x).
    try:
        mesh_obj = m3.Mesh(vert_properties=verts, tri_verts=faces)
    except TypeError:
        mesh_obj = m3.Mesh(verts, faces)  # older positional form

    return m3.Manifold(mesh_obj)


def from_manifold(manifold: m3.Manifold) -> trimesh.Trimesh:
    """
    Convert a manifold3d Manifold back into a trimesh.Trimesh. Used to
    inspect the bbox of the boolean-subtracted "head minus cap" result.
    """
    out = manifold.to_mesh()
    # The Manifold API returns vert_properties as (V, 3+N) where the
    # first three columns are XYZ. Slice defensively in case future
    # versions add normals/colors.
    verts = np.asarray(out.vert_properties)[:, :3]
    faces = np.asarray(out.tri_verts)
    return trimesh.Trimesh(verts, faces, process=False)


def boolean_subtract(a: trimesh.Trimesh, b: trimesh.Trimesh) -> trimesh.Trimesh:
    """
    Compute ``a − b`` as a manifold3d boolean and return a Trimesh. This
    is exactly the inverse-boolean trick from Phase −1 (§10): if the cap
    geometry shares an origin with the reference, ``reference − valve_cap``
    yields a head with a clean socket, which we use to:
      1. Estimate ``TARGET_HEAD_HEIGHT_MM`` from the head-only bbox.
      2. Find ``VALVE_CAP_OFFSET_FROM_HEAD_BOTTOM_MM`` from the head's
         bottom plane vs. the cap's reference origin.
    """
    A = to_manifold(a)
    B = to_manifold(b)
    diff = A - B
    return from_manifold(diff)


# --------------------------------------------------------------------------
# Geometric measurements
# --------------------------------------------------------------------------
def bbox_extents(mesh: trimesh.Trimesh) -> tuple[float, float, float]:
    """Return (dx, dy, dz) bounding-box extents in mm."""
    lo, hi = mesh.bounds
    dx, dy, dz = (hi - lo).tolist()
    return float(dx), float(dy), float(dz)


def max_xy_diameter(mesh: trimesh.Trimesh) -> float:
    """
    Largest XY-plane bounding-box dimension. Used as a "diameter" proxy
    for the negative core and the valve cap, both of which are roughly
    cylindrical and origin-centered. We deliberately use the bbox max
    rather than 2× max-radius-from-origin — bbox is robust to small
    asymmetries in the source STL where 'origin' may not be exactly
    centered after slicing.
    """
    dx, dy, _ = bbox_extents(mesh)
    return max(dx, dy)


def cap_region_in_reference(
    reference: trimesh.Trimesh,
    valve_cap: trimesh.Trimesh,
    *,
    tolerance_mm: float,
) -> tuple[tuple[float, float], float]:
    """
    Locate the cap region inside a reference mesh and return:
      * ``(z_min, z_max)`` — Z range of vertices the reference shares
        with the valve cap.
      * ``radius_mm`` — max XY radius of those shared vertices.

    Method: KDTree nearest-neighbour from cap vertices into the reference
    vertex cloud. Any reference vertex within ``tolerance_mm`` of a cap
    vertex is considered "co-located" — i.e. it's a vertex the manual
    pipeline placed where the cap geometry ended up.

    DECISION: we use vertex-proximity rather than face-by-face matching
    because the references and the cap are independently tessellated.
    Matching faces would require remeshing both to a common density. The
    proximity test is cheap, robust, and what §6's "Z range of cap-section
    faces" amounts to in practice once you account for the differing
    triangulation.
    """
    try:
        from scipy.spatial import cKDTree  # type: ignore
    except ImportError:
        # DECISION: scipy isn't in §7's BoM, but it's a transitive dep
        # of trimesh in practice. If it's genuinely missing, fall back
        # to a brute-force search — slow but correct, and the calibration
        # script is offline anyway.
        return _cap_region_brute(reference, valve_cap, tolerance_mm=tolerance_mm)

    tree = cKDTree(reference.vertices)
    # Query each cap vertex for the nearest reference vertex.
    dists, idxs = tree.query(valve_cap.vertices, k=1)
    matched_mask = dists <= tolerance_mm
    matched_indices = np.unique(idxs[matched_mask])

    if matched_indices.size < 8:
        # Fewer than ~8 shared vertices means the cap and the reference
        # are not meaningfully co-located. The calibration cannot proceed
        # and the caller will surface this as a hard error.
        raise SystemExit(
            "cap region not located in reference: "
            f"only {matched_indices.size} vertices within {tolerance_mm} mm "
            "(check that the cap and reference share an origin)."
        )

    matched = reference.vertices[matched_indices]
    z_min = float(matched[:, 2].min())
    z_max = float(matched[:, 2].max())
    radius = float(np.max(np.sqrt(matched[:, 0] ** 2 + matched[:, 1] ** 2)))

    return (z_min, z_max), radius


def _cap_region_brute(
    reference: trimesh.Trimesh,
    valve_cap: trimesh.Trimesh,
    *,
    tolerance_mm: float,
) -> tuple[tuple[float, float], float]:
    """Brute-force fallback for `cap_region_in_reference` if scipy is absent."""
    tol2 = tolerance_mm ** 2
    matched_indices: list[int] = []
    cap_verts = valve_cap.vertices
    ref_verts = reference.vertices

    # Chunk the cap vertices to keep the broadcast within memory (10K cap
    # verts × 200K reference verts × 3 floats = ~24 GB if done at once).
    chunk = 256
    for start in range(0, cap_verts.shape[0], chunk):
        block = cap_verts[start : start + chunk]
        for cv in block:
            d2 = np.sum((ref_verts - cv) ** 2, axis=1)
            hits = np.nonzero(d2 <= tol2)[0]
            if hits.size:
                matched_indices.extend(hits.tolist())

    matched_indices_arr = np.unique(np.asarray(matched_indices, dtype=np.int64))
    if matched_indices_arr.size < 8:
        raise SystemExit(
            "cap region not located in reference (brute-force path): "
            f"only {matched_indices_arr.size} vertices within {tolerance_mm} mm."
        )

    matched = ref_verts[matched_indices_arr]
    z_min = float(matched[:, 2].min())
    z_max = float(matched[:, 2].max())
    radius = float(np.max(np.sqrt(matched[:, 0] ** 2 + matched[:, 1] ** 2)))

    return (z_min, z_max), radius


# --------------------------------------------------------------------------
# Main calibration routine
# --------------------------------------------------------------------------
def calibrate(*, strict: bool) -> dict[str, Any]:
    """
    Load all four assets, compute every §6 constant, run the §6
    internal-consistency assertions, and return the fully-populated
    JSON-serializable dict the script is going to write.
    """
    notes: list[str] = []

    # ----- Load -----
    log("Loading assets...")
    valve_cap = load_stl(VALVE_CAP_PATH)
    negative_core = load_stl(NEGATIVE_CORE_PATH)
    references = [(p, load_stl(p)) for p in REFERENCE_PATHS]

    # ----- Per-asset diagnostics to stderr -----
    def report(name: str, mesh: trimesh.Trimesh) -> None:
        log(
            f"  {name}: "
            f"{len(mesh.faces):>8d} tris, "
            f"watertight={mesh.is_watertight}, "
            f"winding_consistent={mesh.is_winding_consistent}"
        )

    report(VALVE_CAP_PATH.name, valve_cap)
    report(NEGATIVE_CORE_PATH.name, negative_core)
    for path, mesh in references:
        report(f"reference/{path.name}", mesh)

    # ----- Per-reference: head-only bbox via inverse boolean -----
    # Per §10 Phase −1 step 3: `reference − valve_cap` is the inverse-boolean
    # trick. If the cap is well-placed in the reference, the result is the
    # head with a clean socket — and the bbox of *that* gives the head-only
    # height (cap section subtracted out).
    log("Computing head-only meshes via inverse boolean (reference − valve_cap)...")
    head_only_heights_mm: list[float] = []
    head_only_bottoms_z: list[float] = []
    head_bbox_extents: list[tuple[float, float, float]] = []
    for path, ref in references:
        # NB: this can take 10–30 s per reference at ~200K tris. That's
        # fine for an offline script.
        head_only = boolean_subtract(ref, valve_cap)
        if len(head_only.faces) == 0:
            raise SystemExit(
                f"{path.name} − valve_cap produced an empty mesh; "
                "the cap and reference may not share an origin."
            )
        dx, dy, dz = bbox_extents(head_only)
        head_only_heights_mm.append(dz)
        head_bbox_extents.append((dx, dy, dz))
        head_only_bottoms_z.append(float(head_only.bounds[0, 2]))
        log(
            f"  {path.name} head-only: "
            f"bbox=({dx:.2f}, {dy:.2f}, {dz:.2f}) mm, "
            f"z_bottom={head_only_bottoms_z[-1]:.2f} mm"
        )

    target_head_height_mm = float(np.mean(head_only_heights_mm))

    # ----- Valve cap offset from head bottom -----
    # The "cap's reference origin" is taken to be the centroid of the cap
    # geometry's Z range. Manual builds place the cap such that the
    # threaded section terminates at the head's bottom plane plus some
    # known offset — we recover that offset here.
    #
    # DECISION: §6 specifies "Z offset between head bottom plane and the
    # cap's reference origin". We interpret "cap's reference origin" as
    # z=0 in the cap's local frame (which is how Fusion/SolidWorks export
    # most threaded parts) translated by however the cap sits inside the
    # reference. Because the cap STL is committed in the same frame as
    # the reference, we measure cap's bbox-Z-min in *its own STL* and
    # subtract from the head's bottom Z. A negative result means the cap
    # extends below the head bottom, which matches the §0 "cap-down"
    # print orientation.
    valve_cap_z_min_in_own_frame = float(valve_cap.bounds[0, 2])
    offsets = [
        valve_cap_z_min_in_own_frame - head_z_bottom
        for head_z_bottom in head_only_bottoms_z
    ]
    valve_cap_offset_from_head_bottom_mm = float(np.mean(offsets))

    # ----- Diameters -----
    negative_core_diameter_mm = max_xy_diameter(negative_core)
    valve_cap_outer_diameter_mm = max_xy_diameter(valve_cap)

    # ----- Derived clearance -----
    # NEGATIVE_CORE_CLEARANCE_MM = (core_radius − cap_outer_radius) × 2.
    # The ×2 is *not* a unit-conversion — it expresses the clearance as a
    # diametric figure to match how OrcaSlicer reports tolerance. Per §0,
    # the locked value is 0.25 mm radial; we report the actual measured
    # diametric-equivalent so a reader can compare against §0 directly.
    negative_core_radius = negative_core_diameter_mm / 2.0
    valve_cap_outer_radius = valve_cap_outer_diameter_mm / 2.0
    measured_clearance_mm = (negative_core_radius - valve_cap_outer_radius) * 2.0

    # ----- Cap region in references -----
    # Average the cap-region Z range and radius across both references so
    # one outlier reference can't skew the mask used by §8.7 decimation
    # and §8.8 smoothing.
    log("Locating cap region in references via vertex-proximity match...")
    cap_z_ranges: list[tuple[float, float]] = []
    cap_radii: list[float] = []
    for path, ref in references:
        z_range, radius = cap_region_in_reference(
            ref, valve_cap, tolerance_mm=LOCKED_MANIFOLD_TOLERANCE_MM * 5.0
        )
        cap_z_ranges.append(z_range)
        cap_radii.append(radius)
        log(
            f"  {path.name} cap region: "
            f"z=[{z_range[0]:.2f}, {z_range[1]:.2f}] mm, "
            f"radius={radius:.2f} mm"
        )

    cap_region_z_range_mm = [
        float(np.mean([r[0] for r in cap_z_ranges])),
        float(np.mean([r[1] for r in cap_z_ranges])),
    ]
    cap_region_radius_mm = float(np.mean(cap_radii))

    # ----- Build the constants block -----
    constants = {
        "TARGET_HEAD_HEIGHT_MM": round(target_head_height_mm, 4),
        "VALVE_CAP_OFFSET_FROM_HEAD_BOTTOM_MM": round(
            valve_cap_offset_from_head_bottom_mm, 4
        ),
        "NEGATIVE_CORE_DIAMETER_MM": round(negative_core_diameter_mm, 4),
        "VALVE_CAP_OUTER_DIAMETER_MM": round(valve_cap_outer_diameter_mm, 4),
        "NEGATIVE_CORE_CLEARANCE_MM": round(measured_clearance_mm, 4),
        "MANIFOLD_TOLERANCE_MM": LOCKED_MANIFOLD_TOLERANCE_MM,
        "CAP_REGION_Z_RANGE_MM": [
            round(cap_region_z_range_mm[0], 4),
            round(cap_region_z_range_mm[1], 4),
        ],
        "CAP_REGION_RADIUS_MM": round(cap_region_radius_mm, 4),
        "MIN_WALL_THICKNESS_MM": LOCKED_MIN_WALL_THICKNESS_MM,
    }

    # ------------------------------------------------------------------
    # Internal consistency — these are the §6 spec assertions.
    # ------------------------------------------------------------------

    # 1. Cap nests inside core volume.
    if not (negative_core_diameter_mm > valve_cap_outer_diameter_mm):
        raise SystemExit(
            "negative core diameter is not larger than the valve cap outer "
            f"diameter ({negative_core_diameter_mm:.3f} vs "
            f"{valve_cap_outer_diameter_mm:.3f}). Cap cannot nest inside core."
        )

    # 2. Both references' bboxes agree within 5 %.
    if len(head_bbox_extents) >= 2:
        a = np.array(head_bbox_extents[0])
        b = np.array(head_bbox_extents[1])
        # Per-axis relative difference normalised by the larger of the two,
        # which avoids a divide-by-zero on the off-chance an axis is small.
        max_rel_diff = float(np.max(np.abs(a - b) / np.maximum(a, b)))
        if max_rel_diff > REFERENCE_BBOX_AGREEMENT_TOLERANCE:
            raise SystemExit(
                "reference bounding boxes disagree by "
                f"{max_rel_diff * 100:.1f}% (limit: "
                f"{REFERENCE_BBOX_AGREEMENT_TOLERANCE * 100:.0f}%). "
                "Investigate ian_head.stl vs nik_head.stl scaling."
            )

    # 3. Computed clearance within 20 % of the locked 0.25 mm.
    clearance_drift = (
        abs(measured_clearance_mm - LOCKED_NEGATIVE_CORE_CLEARANCE_MM)
        / LOCKED_NEGATIVE_CORE_CLEARANCE_MM
    )
    if clearance_drift > CLEARANCE_DRIFT_WARN_THRESHOLD:
        warn(
            f"computed NEGATIVE_CORE_CLEARANCE_MM ({measured_clearance_mm:.3f} mm) "
            f"drifted {clearance_drift * 100:.1f}% from the §0 locked "
            f"{LOCKED_NEGATIVE_CORE_CLEARANCE_MM} mm "
            f"(>{CLEARANCE_DRIFT_WARN_THRESHOLD * 100:.0f}% threshold).",
            strict=strict,
            notes=notes,
        )

    # 4. All constants are positive numbers.
    # CAP_REGION_Z_RANGE_MM may legitimately contain negatives (cap sits
    # below the head's reference origin in cap-down builds), and
    # VALVE_CAP_OFFSET_FROM_HEAD_BOTTOM_MM is signed. Skip those two.
    positive_only_keys = {
        "TARGET_HEAD_HEIGHT_MM",
        "NEGATIVE_CORE_DIAMETER_MM",
        "VALVE_CAP_OUTER_DIAMETER_MM",
        "NEGATIVE_CORE_CLEARANCE_MM",
        "MANIFOLD_TOLERANCE_MM",
        "CAP_REGION_RADIUS_MM",
        "MIN_WALL_THICKNESS_MM",
    }
    for key in positive_only_keys:
        v = constants[key]
        if not (isinstance(v, (int, float)) and v > 0):
            raise SystemExit(
                f"constant {key} is not a positive number: {v!r}"
            )

    # ------------------------------------------------------------------
    # §6 last paragraph: any constant that drifted >1 % from a §0 locked
    # value goes into calibration_notes so reviewers see it in the JSON
    # diff.
    # ------------------------------------------------------------------
    def note_drift(name: str, measured: float, locked: float) -> None:
        if locked == 0:
            return
        drift = abs(measured - locked) / abs(locked)
        if drift > DRIFT_FROM_LOCKED_NOTE_THRESHOLD:
            notes.append(
                f"{name} drifted {drift * 100:.2f}% from §0 locked "
                f"{locked} (measured {measured:.4f})."
            )

    note_drift(
        "NEGATIVE_CORE_CLEARANCE_MM",
        measured_clearance_mm,
        LOCKED_NEGATIVE_CORE_CLEARANCE_MM,
    )

    # ------------------------------------------------------------------
    # Source assets manifest — sha256 + tris for every input. Lets a
    # reader verify (or a CI step diff) which inputs produced this JSON.
    # ------------------------------------------------------------------
    def manifest_entry(path: Path, mesh: trimesh.Trimesh) -> dict[str, Any]:
        return {
            # Path is recorded as a POSIX-style repo-relative string —
            # makes the JSON portable between dev (mac) and CI (linux).
            "path": path.relative_to(REPO_ROOT).as_posix(),
            "sha256": sha256_of(path),
            "tris": int(len(mesh.faces)),
        }

    payload: dict[str, Any] = {
        "version": 1,
        "generated_at": datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z"),
        "source_assets": {
            "valve_cap": manifest_entry(VALVE_CAP_PATH, valve_cap),
            "negative_core": manifest_entry(NEGATIVE_CORE_PATH, negative_core),
            "references": [
                manifest_entry(p, m) for p, m in references
            ],
        },
        "constants": constants,
        "calibration_notes": notes,
    }

    return payload


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------
def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Compute pipeline calibration constants from the committed "
            "reference STLs and write server/assets/pipeline_constants.json."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the JSON to stdout instead of writing the file.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Promote warnings to errors (use in CI).",
    )
    args = parser.parse_args(argv)

    payload = calibrate(strict=args.strict)

    # Pretty-print with sorted keys *inside* `constants` only — top-level
    # field order is part of the human-facing schema and shouldn't be
    # alphabetized. json.dumps with indent=2 + a trailing newline matches
    # the project convention for committed JSON artifacts.
    rendered = json.dumps(payload, indent=2) + "\n"

    if args.dry_run:
        # Stdout is reserved for this (every other status line went to
        # stderr) so the script is composable with `| jq` etc.
        sys.stdout.write(rendered)
    else:
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT_PATH.write_text(rendered, encoding="utf-8")

    # Final summary — the spec demands this exact phrasing.
    drift_summary_parts: list[str] = []
    measured_clearance = payload["constants"]["NEGATIVE_CORE_CLEARANCE_MM"]
    drift_summary_parts.append(
        f"clearance={measured_clearance} mm "
        f"(locked {LOCKED_NEGATIVE_CORE_CLEARANCE_MM} mm)"
    )
    drift_summary_parts.append(
        f"head_height={payload['constants']['TARGET_HEAD_HEIGHT_MM']} mm"
    )
    if payload["calibration_notes"]:
        drift_summary_parts.append(
            f"{len(payload['calibration_notes'])} note(s)"
        )
    drift_summary = "; ".join(drift_summary_parts)

    target = "stdout" if args.dry_run else str(
        OUTPUT_PATH.relative_to(REPO_ROOT).as_posix()
    )
    log(f"Constants written to {target}. Drift summary: {drift_summary}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
