"""BikeHeadz mesh pipeline — the v1 codepath.

This package replaces the placeholder ``_merge`` in ``handler.py``
(repo-root) with the seven-stage pipeline documented in
``3D_Pipeline.md``:

    Stage 0 — Input validation (pre-TRELLIS, mediapipe pre-flight)
    Stage 1 — Normalize    (orient + scale + recenter)
    Stage 1.5 — Repair     (pymeshlab round-trip; topology fixes)
    Stage 2 — Crop         (boolean cube subtraction; cap-disc closure)
    Stage 3 — Subtract     (carve socket with negative_core)
    Stage 4 — Union        (insert valve_cap)
    Stage 5 — Print-prep   (decimate, smooth, validate, export binary STL)

Why a package, not a single file: each stage carries its own risks and
its own configuration. Splitting them keeps individual stages
unit-testable, the validation gate (`pipeline.validation`) reusable,
and the constants surface (`pipeline.constants`) cleanly imported once
at module load.

Public surface — ONLY ``run_v1`` and ``ErrorCode`` / ``PipelineError``
are stable. Stage-level functions are internal; their signatures will
shift as Phase 1 → 4 progresses.

Import contract (from ``handler.py`` at /app):

    from pipeline import run_v1
    final_mesh = run_v1(head, valve_cap, negative_core,
                        head_scale=1.0, head_tilt_deg=0.0,
                        progress=lambda step, pct: ...)

For local-fallback `trellis_generate.py`, a sibling ``sys.path`` shim
is needed (the local Python worker isn't bundled in /app like the
RunPod one is).
"""

from __future__ import annotations

from typing import Callable, Optional

import trimesh

from .constants import get as _get_constants
from .errors import CODE_SCHEMA_VERSION, ErrorCode, PipelineError, USER_MESSAGES
from .stages import (
    stage1_5_repair,
    stage1_normalize,
    stage2_crop,
    stage3_subtract_negative_core,
    stage4_union_valve_cap,
    stage5_postprocess,
)

__all__ = [
    "run_v1",
    "ErrorCode",
    "PipelineError",
    "USER_MESSAGES",
    "CODE_SCHEMA_VERSION",
]


# Progress percentages match what handler.py re-emits on the wire —
# downstream consumers (the Three.js viewer, the Node-side polling
# loop) already expect monotonic increases. These are the v1 contract.
_PROGRESS_STAGE1 = ("stage1_normalize", 20)
_PROGRESS_STAGE1_5 = ("stage1_5_repair", 30)
_PROGRESS_STAGE2 = ("stage2_crop", 50)
_PROGRESS_STAGE3 = ("stage3_subtract_negative_core", 65)
_PROGRESS_STAGE4 = ("stage4_union_valve_cap", 80)
_PROGRESS_STAGE5 = ("stage5_postprocess", 92)
_PROGRESS_DONE = ("run_v1.done", 100)


def run_v1(
    head: trimesh.Trimesh,
    valve_cap: trimesh.Trimesh,
    negative_core: trimesh.Trimesh,
    *,
    head_scale: float = 1.0,
    head_tilt_deg: float = 0.0,
    shoulder_taper_fraction: float = 0.60,
    progress: Optional[Callable[[str, int], None]] = None,
) -> trimesh.Trimesh:
    """Run the v1 mesh pipeline end-to-end.

    Orchestrates Stage 1 → Stage 5 (Stage 0 is mediapipe pre-TRELLIS,
    not in this entry point). The two reference STLs (``valve_cap``
    and ``negative_core``) are loaded once at module init in
    ``handler.py`` and passed in by reference here — never mutated.

    Parameters
    ----------
    head
        Raw TRELLIS-style mesh, head + shoulders, in arbitrary scale.
    valve_cap
        The locked threaded screw cap STL. Dimensionally fixed.
    negative_core
        The locked boolean cutter STL. Dimensionally fixed.
    head_scale
        User knob; clamped to 0.85..1.15 inside Stage 1.
    head_tilt_deg
        User knob; pitch about +X axis applied in Stage 1 (positive =
        chin tilts up). Range -30..+30; the user uses this to put the
        Stage 2 cut plane through the back of the neck.
    shoulder_taper_fraction
        User knob; controls Stage 2's neck-cut location on the
        shoulders→head taper. 0.40 = aggressive crop, 0.85 = loose.
        Default 0.60 (calibrated across 4 test scans).
    progress
        Optional callback ``(step_label, pct) -> None`` invoked at each
        stage boundary. Use it to bridge to the RunPod progress frames.

    Returns
    -------
    trimesh.Trimesh
        Single watertight printable solid, ~50–80K triangles, oriented
        cap-down per §0 (cap region toward −Z).

    Raises
    ------
    PipelineError
        Any stage failure — see ``errors.ErrorCode`` for the taxonomy.
    """
    C = _get_constants()

    def _emit(stage_label: str, pct: int) -> None:
        if progress is not None:
            progress(stage_label, pct)

    head = stage1_normalize(head, head_scale, head_tilt_deg, C)
    _emit(*_PROGRESS_STAGE1)

    head = stage1_5_repair(head, C)
    _emit(*_PROGRESS_STAGE1_5)

    cropped, _info = stage2_crop(
        head, C, shoulder_taper_fraction=shoulder_taper_fraction,
    )
    _emit(*_PROGRESS_STAGE2)

    socketed = stage3_subtract_negative_core(cropped, negative_core, C)
    _emit(*_PROGRESS_STAGE3)

    final = stage4_union_valve_cap(socketed, valve_cap, C)
    _emit(*_PROGRESS_STAGE4)

    final = stage5_postprocess(final, C)
    _emit(*_PROGRESS_STAGE5)

    _emit(*_PROGRESS_DONE)
    return final
