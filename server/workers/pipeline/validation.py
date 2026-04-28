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
