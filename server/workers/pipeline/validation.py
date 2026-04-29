"""Validation gate for the v1 mesh pipeline.

Implements the assertion ladder from ``3D_Pipeline.md`` §8.6. Each
stage that produces a "should be a valid printable solid" output calls
``assert_printable`` with its stage label so failures point at the
exact regression site.

Why this lives in its own module rather than inside ``stages.py``:

* Phase 3 (the Robustness phase) will add wall-thickness sampling and
  a sparse-grid signed-distance check — both meaty enough to deserve
  their own home. Splitting now keeps stages.py focused on geometry.
* The error-frame contract (``PipelineError`` from ``errors.py``) gets
  imported lazily inside the function. Top-level imports would be
  fine today, but Phase 1's ``__init__.py`` already imports
  ``validation``-touching stages indirectly, and a circular
  ``validation → errors → __init__ → validation`` chain is one refactor
  away. Defensive coding is cheap.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:  # type-only import; runtime stays lazy
    import trimesh


def assert_printable(mesh: "trimesh.Trimesh", *, stage: str) -> None:
    """Validate that ``mesh`` is a single watertight printable solid.

    Per §8.6, this runs at every "should be a closed solid" boundary —
    Stage 1.5 (post-repair, with relaxed checks per §5 Stage 1.5),
    Stage 3 (post-subtract), Stage 4 (post-union), and immediately
    before Stage 5's STL export.

    Raises
    ------
    PipelineError
        Code is :class:`ErrorCode.OUTPUT_NOT_WATERTIGHT` for topology
        failures, :class:`ErrorCode.OUTPUT_DIMENSIONS_OUT_OF_RANGE` for
        bbox/scale failures. ``stage`` is forwarded so the failure
        corpus (§9.5) buckets correctly.
    """
    # Lazy imports — `errors` would be a circular dep if `__init__.py`
    # ever pulls validation transitively (it will, via `stages`).
    from .errors import ErrorCode, PipelineError

    failures: list[str] = []

    # Topology checks. Order matters: cheap booleans first, expensive
    # split() last. trimesh evaluates these properties lazily so
    # short-circuiting still helps.
    try:
        if not bool(mesh.is_watertight):
            failures.append("not watertight (open edges)")
        if not bool(mesh.is_winding_consistent):
            failures.append("inconsistent face winding")
        if not bool(mesh.is_volume):
            failures.append("not a closed volume")
        # Single shell — `split(only_watertight=True)` returns one
        # component per closed body. Any value ≠ 1 is a multi-shell
        # problem (e.g. a stray floater survived Stage 1.5, or a
        # boolean orphaned a sliver).
        shells = mesh.split(only_watertight=True)
        if len(shells) != 1:
            failures.append(f"multiple shells ({len(shells)} bodies)")
        if float(mesh.volume) <= 0.0:
            failures.append("non-positive volume (inverted normals)")
    except Exception as exc:  # noqa: BLE001
        # trimesh raises on degenerate inputs; surface that as a
        # topology failure rather than letting it propagate untyped.
        failures.append(f"topology check raised: {exc!r}")

    if failures:
        raise PipelineError(
            code=ErrorCode.OUTPUT_NOT_WATERTIGHT,
            stage=stage,
            detail="; ".join(failures),
        )

    # Dimension checks. The §0 contract is "30 mm-ish printable cap";
    # 5 mm minimum extent rules out feature-collapse to a flat slab,
    # 200 mm maximum rules out the unscaled-input footgun. These
    # numbers come from §8.6's assertion ladder.
    extents = mesh.bounding_box.extents
    if float(extents.min()) < 5.0:
        raise PipelineError(
            code=ErrorCode.OUTPUT_DIMENSIONS_OUT_OF_RANGE,
            stage=stage,
            detail=f"bbox min extent {float(extents.min()):.3f} mm < 5.0 mm",
        )
    if float(extents.max()) > 200.0:
        raise PipelineError(
            code=ErrorCode.OUTPUT_DIMENSIONS_OUT_OF_RANGE,
            stage=stage,
            detail=f"bbox max extent {float(extents.max()):.3f} mm > 200.0 mm",
        )


# ---- P3-016 — Stage 5 wall-thickness validator (raycast) ------------------


def min_wall_thickness(
    mesh: "trimesh.Trimesh",
    target_mm: float = 1.2,
    sample_count: int = 1000,
) -> dict:
    """Sample-based wall-thickness estimator using inward raycasting.

    Uniformly samples ``sample_count`` points on the mesh surface, then
    for each sample casts a ray along the inward surface normal
    (``-normal``) and measures the distance to the next intersection
    inside the solid. The smallest distance across samples approximates
    the thinnest wall in the part — a noisy estimate, but cheap and
    good enough to flag obviously-too-thin walls (e.g. <0.6 mm on a
    1.2 mm-target FDM/PLA print) before we hand the STL off to a slicer.

    Why an empirical raycast and not analytical SDF: trimesh's
    ProximityQuery.signed_distance is exact but O(N×M) (N query points
    × M faces); for ~50–80K-tri post-pipeline meshes it's slower than
    the embree-backed ray engine. Both work; we pick rays for speed.

    Returns
    -------
    dict
        ``{"p1": float, "p10": float, "mean": float, "samples": int,
        "target_mm": float}``. ``p1`` and ``p10`` are the 1st and 10th
        percentiles of the sampled distances (mm); ``mean`` is the
        arithmetic mean. ``samples`` is the count of valid (positive,
        finite) samples — may be < ``sample_count`` if some rays missed
        a back-wall (e.g. on open-edge geometry).
    """
    # `mesh.sample` returns (points, face_index) when return_index=True;
    # we need face_index to grab per-sample face normals.
    points, face_index = mesh.sample(int(sample_count), return_index=True)
    points = np.asarray(points, dtype=np.float64)
    face_index = np.asarray(face_index, dtype=np.int64)
    normals = np.asarray(mesh.face_normals[face_index], dtype=np.float64)
    # Inward direction = -normal. Step the ray origin slightly INWARD
    # along that direction so we don't immediately re-hit the source
    # triangle (rays-from-surface is the classic self-intersection
    # footgun in trimesh — `-1e-4 mm` is the same epsilon trimesh's
    # built-in proximity helpers use).
    eps = 1e-4
    directions = -normals
    origins = points + directions * eps

    # ray.intersects_location returns (locations, index_ray, index_tri).
    # One ray can hit multiple back-faces in a thick solid; we want the
    # CLOSEST hit per ray.
    try:
        locations, index_ray, _ = mesh.ray.intersects_location(
            ray_origins=origins,
            ray_directions=directions,
            multiple_hits=True,
        )
    except Exception:  # noqa: BLE001 — embree/pyembree errors etc.
        return {
            "p1": float("nan"),
            "p10": float("nan"),
            "mean": float("nan"),
            "samples": 0,
            "target_mm": float(target_mm),
        }

    if len(locations) == 0:
        return {
            "p1": float("nan"),
            "p10": float("nan"),
            "mean": float("nan"),
            "samples": 0,
            "target_mm": float(target_mm),
        }

    # Distance from each hit back to its source point, grouped by ray.
    hit_dists = np.linalg.norm(
        locations - points[np.asarray(index_ray, dtype=np.int64)], axis=1,
    )
    # For each ray, keep the smallest positive distance (closest back-wall).
    per_ray: dict[int, float] = {}
    for ray_idx, dist in zip(np.asarray(index_ray, dtype=np.int64), hit_dists):
        d = float(dist)
        # Discard zero-length self-hits that sneak past the eps offset.
        if d <= eps:
            continue
        cur = per_ray.get(int(ray_idx))
        if cur is None or d < cur:
            per_ray[int(ray_idx)] = d

    distances = np.array(list(per_ray.values()), dtype=np.float64)
    distances = distances[np.isfinite(distances)]
    if distances.size == 0:
        return {
            "p1": float("nan"),
            "p10": float("nan"),
            "mean": float("nan"),
            "samples": 0,
            "target_mm": float(target_mm),
        }

    return {
        "p1": float(np.percentile(distances, 1)),
        "p10": float(np.percentile(distances, 10)),
        "mean": float(distances.mean()),
        "samples": int(distances.size),
        "target_mm": float(target_mm),
    }
