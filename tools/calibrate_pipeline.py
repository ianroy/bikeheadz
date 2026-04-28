#!/usr/bin/env python3
"""Generate ``server/assets/pipeline_constants.json`` for the v1 mesh pipeline.

This is the deliverable for ``3D_Pipeline.md`` §6 (Calibration) and
Phase 0 task #2. Re-run any time the cap / negative core source files
change. Produces the constants the runtime pipeline at
``server/workers/pipeline/`` reads at startup via
``pipeline.constants.get()``.

Design note (post-Phase −0.5)
-----------------------------
The earlier draft of this script tried an inverse-boolean trick
(``reference − valve_cap``) to recover head-only meshes from
"goldens." Phase −1 spike showed that approach is invalid here:

* The committed references are RAW human-scale scans (1.7–1.9 m tall),
  not post-pipeline outputs.
* The cap and negative core are not co-centred with the head scans in
  any source frame.
* The cap's threaded outer diameter is intentionally LARGER than the
  negative core — the threads bite into the head walls when Stage 4
  unions the cap into the cavity Stage 3 carved.

So the new calibrate behaviour is straightforward:

1. Measure ``valve_cap.stl`` and ``negative_core.stl`` directly.
2. Lock the §0 / §6 design constants verbatim
   (``TARGET_HEAD_HEIGHT_MM``, ``MANIFOLD_TOLERANCE_MM``,
   ``MIN_WALL_THICKNESS_MM``, ``JUNCTION_Z_OFFSET_MM``).
3. Write the JSON. No reference-mesh dependence.

The script keeps a sha256 + tri-count of every input asset in the
output JSON so the §9.5 calibration regeneration trigger has something
deterministic to diff against.

Usage
-----
::

    python3 tools/calibrate_pipeline.py            # writes the JSON
    python3 tools/calibrate_pipeline.py --dry-run  # prints to stdout
    python3 tools/calibrate_pipeline.py --strict   # warnings → errors

Exit code: 0 on success, 1 on validation failure.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
import json
import sys
from pathlib import Path
from typing import Optional

import numpy as np
import trimesh


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[1]
ASSETS = REPO_ROOT / "server" / "assets"

CAP_PATH = ASSETS / "valve_cap.stl"
CORE_PATH = ASSETS / "negative_core.stl"
OUTPUT_PATH = ASSETS / "pipeline_constants.json"

# References are RAW SCANS. We hash them so calibration regeneration
# (§9.5) can detect when they change, but we don't measure them — they
# don't drive any constant.
REFERENCE_PATHS = [
    ASSETS / "reference" / "ian_head.stl",
    ASSETS / "reference" / "nik_head.stl",
]


# ---------------------------------------------------------------------------
# Locked constants (from §0)
# ---------------------------------------------------------------------------

# These are *design decisions*, not measurements. The script writes them
# verbatim so the runtime pipeline can read all constants from one
# place. If you change a §0 value, change it here and regenerate.

LOCKED = {
    "TARGET_HEAD_HEIGHT_MM": 22.0,        # §0 — head section after rescale
    "MANIFOLD_TOLERANCE_MM": 0.01,        # §8.5 — manifold3d numeric tolerance
    "MIN_WALL_THICKNESS_MM": 1.2,         # §0 — FDM @ 0.4 mm nozzle
}


# ---------------------------------------------------------------------------
# Asset measurement
# ---------------------------------------------------------------------------

def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_mesh(path: Path) -> trimesh.Trimesh:
    """Load an STL into a single Trimesh (concatenating Scene if needed)."""
    mesh = trimesh.load_mesh(str(path))
    if isinstance(mesh, trimesh.Scene):
        mesh = trimesh.util.concatenate(tuple(mesh.geometry.values()))
    return mesh


def threaded_outer_diameter(cap: trimesh.Trimesh, n_bins: int = 20) -> float:
    """Median-of-bin-max-radius across Z bins. Excludes any flange.

    The valve cap may have a small flange at its base that's wider than
    the threaded body; for the threaded-outer-diameter we want the
    representative radius along the bulk of the cap, not the flange's
    one-bin spike. Median across Z bins gives that.
    """
    verts = np.asarray(cap.vertices)
    z = verts[:, 2]
    z_min, z_max = float(z.min()), float(z.max())
    if z_max - z_min < 1e-6:
        return 0.0
    edges = np.linspace(z_min, z_max, n_bins + 1)
    bin_max_r = []
    for i in range(n_bins):
        mask = (z >= edges[i]) & (z <= edges[i + 1])
        if not mask.any():
            continue
        slab = verts[mask]
        # Use radius from the slab's own XY centroid, not global, so
        # off-axis caps don't fake-deflate the radius.
        cx, cy = slab[:, 0].mean(), slab[:, 1].mean()
        r = np.sqrt((slab[:, 0] - cx) ** 2 + (slab[:, 1] - cy) ** 2).max()
        bin_max_r.append(r)
    if not bin_max_r:
        return 0.0
    return 2.0 * float(np.median(bin_max_r))


def measure_cap(cap: trimesh.Trimesh) -> dict:
    extents = cap.extents
    diameter_xy = float(max(extents[0], extents[1]))
    return {
        "VALVE_CAP_OUTER_DIAMETER_MM": diameter_xy,
        "VALVE_CAP_THREADED_OUTER_DIAMETER_MM": threaded_outer_diameter(cap),
        "VALVE_CAP_HEIGHT_MM": float(extents[2]),
    }


def measure_core(core: trimesh.Trimesh) -> dict:
    extents = core.extents
    diameter_xy = float(max(extents[0], extents[1]))
    return {
        "NEGATIVE_CORE_DIAMETER_MM": diameter_xy,
        "NEGATIVE_CORE_HEIGHT_MM": float(extents[2]),
    }


def asset_record(path: Path, mesh: trimesh.Trimesh) -> dict:
    return {
        "path": str(path.relative_to(REPO_ROOT)),
        "sha256": sha256_of(path),
        "tris": int(len(mesh.faces)),
        "watertight": bool(mesh.is_watertight),
    }


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate(constants: dict, *, strict: bool) -> list[str]:
    """Run the §6 internal-consistency checks. Return notes for the JSON."""
    notes: list[str] = []
    errors: list[str] = []

    # Cap and core dimensions are positive.
    for k in (
        "VALVE_CAP_OUTER_DIAMETER_MM",
        "VALVE_CAP_THREADED_OUTER_DIAMETER_MM",
        "VALVE_CAP_HEIGHT_MM",
        "NEGATIVE_CORE_DIAMETER_MM",
        "NEGATIVE_CORE_HEIGHT_MM",
    ):
        if constants[k] <= 0:
            errors.append(f"{k} must be positive, got {constants[k]}")

    # The threaded outer diameter must be >= negative core diameter
    # (otherwise threads don't bite into walls — design intent broken).
    threaded = constants["VALVE_CAP_THREADED_OUTER_DIAMETER_MM"]
    core_d = constants["NEGATIVE_CORE_DIAMETER_MM"]
    if threaded < core_d:
        errors.append(
            f"VALVE_CAP_THREADED_OUTER_DIAMETER_MM ({threaded:.3f}) < "
            f"NEGATIVE_CORE_DIAMETER_MM ({core_d:.3f}); threads won't bite "
            "into head walls — boolean union will produce no thread relief."
        )
    bite = threaded - core_d
    if bite < 0.05:  # Less than 50 microns of bite is mechanically nothing.
        notes.append(
            f"thread bite into walls is only {bite*1000:.1f} µm "
            f"(threaded ⌀ {threaded:.3f} − core ⌀ {core_d:.3f}); "
            "Stage 4 may produce barely-visible threads. Consider re-checking "
            "the cap mesh."
        )

    # JUNCTION_Z_OFFSET_MM should equal -VALVE_CAP_HEIGHT_MM.
    cap_h = constants["VALVE_CAP_HEIGHT_MM"]
    if abs(constants["JUNCTION_Z_OFFSET_MM"] - (-cap_h)) > 1e-3:
        errors.append("JUNCTION_Z_OFFSET_MM must equal -VALVE_CAP_HEIGHT_MM")

    # Negative core height should be at least cap height (otherwise the
    # cavity is shallower than the cap, meaning the cap can't fit).
    core_h = constants["NEGATIVE_CORE_HEIGHT_MM"]
    if core_h < cap_h - 0.1:
        errors.append(
            f"NEGATIVE_CORE_HEIGHT_MM ({core_h:.3f}) < "
            f"VALVE_CAP_HEIGHT_MM ({cap_h:.3f}); cavity is shallower "
            "than the cap it must contain."
        )

    if errors:
        for e in errors:
            print(f"[calibrate] ERROR: {e}", file=sys.stderr)
        raise SystemExit(1)

    if strict and notes:
        for n in notes:
            print(f"[calibrate] STRICT: {n}", file=sys.stderr)
        raise SystemExit(1)

    return notes


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def build(strict: bool) -> dict:
    print("Loading assets...", file=sys.stderr)
    cap = load_mesh(CAP_PATH)
    core = load_mesh(CORE_PATH)
    print(
        f"  valve_cap:     {len(cap.faces):>6} tris, "
        f"watertight={cap.is_watertight}",
        file=sys.stderr,
    )
    print(
        f"  negative_core: {len(core.faces):>6} tris, "
        f"watertight={core.is_watertight}",
        file=sys.stderr,
    )

    cap_m = measure_cap(cap)
    core_m = measure_core(core)

    constants = {
        # Locked design values from §0.
        **LOCKED,
        # Measured cap geometry.
        **cap_m,
        # Measured core geometry.
        **core_m,
        # Derived: cap-bottom and core-bottom share a Z baseline; the
        # rescaled head sits directly on top.
        "JUNCTION_Z_OFFSET_MM": -cap_m["VALVE_CAP_HEIGHT_MM"],
    }

    notes = validate(constants, strict=strict)

    references = [
        asset_record(p, load_mesh(p))
        for p in REFERENCE_PATHS if p.exists()
    ]
    if not references:
        notes.append(
            "no reference STLs at server/assets/reference/; smoke test "
            "won't have raw inputs until they land."
        )

    return {
        "version": 2,
        "generated_at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
        "source_assets": {
            "valve_cap": asset_record(CAP_PATH, cap),
            "negative_core": asset_record(CORE_PATH, core),
            "references": references,
        },
        "constants": constants,
        "calibration_notes": notes,
    }


def main(argv: Optional[list[str]] = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    p.add_argument("--dry-run", action="store_true",
                   help="Print JSON to stdout instead of writing.")
    p.add_argument("--strict", action="store_true",
                   help="Fail on any warning, not just errors.")
    args = p.parse_args(argv)

    doc = build(strict=args.strict)
    text = json.dumps(doc, indent=2) + "\n"

    if args.dry_run:
        sys.stdout.write(text)
        return 0

    OUTPUT_PATH.write_text(text, encoding="utf-8")
    print(
        f"\nConstants written to {OUTPUT_PATH.relative_to(REPO_ROOT)}.",
        file=sys.stderr,
    )
    notes = doc["calibration_notes"]
    if notes:
        print("Calibration notes:", file=sys.stderr)
        for n in notes:
            print(f"  - {n}", file=sys.stderr)
    else:
        print("No drift / no notes.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
