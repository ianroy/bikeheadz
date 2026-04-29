"""ValveHeadZ mesh pipeline — the v1 codepath.

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

import concurrent.futures
import json
import os
import sys
import time
from typing import Any, Callable, Optional

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


# P0-017 — per-stage and total wall-clock budgets. Defaults are
# conservative bounds calibrated against the §10 Phase 1 reference runs:
# normalize ≈ <1 s, repair ≈ 2–8 s, crop ≈ 1–3 s, booleans 5–20 s each.
# 60 s per stage is roughly 3× the worst observed; 300 s total is post-
# cold-start (TRELLIS itself runs separately in handler.py).
_DEFAULT_STAGE_TIMEOUT_S = 60
_DEFAULT_JOB_TIMEOUT_S = 300


def _stage_timeout_s() -> int:
    try:
        return int(os.environ.get("STAGE_TIMEOUT_S", str(_DEFAULT_STAGE_TIMEOUT_S)))
    except ValueError:
        return _DEFAULT_STAGE_TIMEOUT_S


def _job_timeout_s() -> int:
    try:
        return int(os.environ.get("JOB_TIMEOUT_S", str(_DEFAULT_JOB_TIMEOUT_S)))
    except ValueError:
        return _DEFAULT_JOB_TIMEOUT_S


def run_with_timeout(
    stage_name: str,
    fn: Callable[..., Any],
    *args: Any,
    timeout_s: Optional[int] = None,
    job_remaining_s: Optional[float] = None,
    **kwargs: Any,
) -> Any:
    """Run ``fn(*args, **kwargs)`` with a wall-clock budget.

    Why ``ThreadPoolExecutor.submit().result(timeout=…)`` and not
    ``signal.alarm`` or ``multiprocessing``: the pipeline runs inside
    a long-lived RunPod worker that may already use signal handlers,
    and the stages share large mesh objects (forking would copy them).
    A ThreadPoolExecutor lets us bound each stage's wall-clock without
    interfering with whatever else the worker is doing — at the cost
    that a runaway numpy / C-extension call won't actually stop on
    timeout (it'll just leave the executor thread running). That's
    acceptable: RunPod kills the worker on a job-level timeout anyway,
    and we want the timeout signal to propagate as a structured error
    even if the worker process keeps the thread alive a few seconds
    longer.

    Parameters
    ----------
    stage_name
        Used in the telemetry log line emitted on timeout.
    fn
        The stage function (already-bound — pass args/kwargs through).
    timeout_s
        Per-stage budget in seconds. Defaults to ``STAGE_TIMEOUT_S``
        (env, falls back to 60 s).
    job_remaining_s
        Optional; if set, the actual budget is ``min(timeout_s,
        job_remaining_s)``. The driver passes this so the LAST stage
        can't blow past the total job budget even if its per-stage
        budget would allow it.

    Raises
    ------
    PipelineError
        ``ErrorCode.STAGE_TIMEOUT`` with ``timeout_stage=<stage_name>``
        in ``detail``.
    """
    budget = timeout_s if timeout_s is not None else _stage_timeout_s()
    if job_remaining_s is not None:
        budget = max(1, int(min(budget, job_remaining_s)))
    started = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
        fut = ex.submit(fn, *args, **kwargs)
        try:
            return fut.result(timeout=budget)
        except concurrent.futures.TimeoutError as exc:
            elapsed = time.perf_counter() - started
            sys.stderr.write(
                json.dumps({
                    "kind": "pipeline.stage_timeout",
                    "timeout_stage": stage_name,
                    "elapsed_s": round(elapsed, 2),
                    "budget_s": int(budget),
                }) + "\n"
            )
            sys.stderr.flush()
            # The thread may still be running — RunPod will recycle the
            # worker if it hangs. We surface the structured error now so
            # the Node side can branch on it without waiting.
            raise PipelineError(
                code=ErrorCode.STAGE_TIMEOUT,
                stage=stage_name,
                detail=(
                    f"timeout_stage={stage_name} elapsed_s={elapsed:.2f} "
                    f"budget_s={int(budget)}"
                ),
            ) from exc

__all__ = [
    "run_v1",
    "ErrorCode",
    "PipelineError",
    "USER_MESSAGES",
    "CODE_SCHEMA_VERSION",
    "run_with_timeout",
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
    target_head_height_mm: Optional[float] = None,
    cap_protrusion_fraction: Optional[float] = None,
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
    target_head_height_mm
        User knob; overrides Constants.TARGET_HEAD_HEIGHT_MM. The size
        the rescaled head normalizes to in Stage 1. None = use the
        loaded constant (30 mm). Range 22..42.
    cap_protrusion_fraction
        User knob; overrides Constants.CAP_PROTRUSION_FRACTION. The
        fraction of the cap that sticks out below the head's bottom
        plane to expose the bike-valve entry. None = use the loaded
        constant (0.10 = 10%). Range 0.0..0.25.
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

    # Apply per-request overrides without mutating the cached Constants.
    # `dataclasses.replace` produces a new frozen instance — the loaded
    # base stays clean for the next request. Any value the caller passes
    # as None is left at its loaded-constant default.
    overrides = {}
    if target_head_height_mm is not None:
        overrides["TARGET_HEAD_HEIGHT_MM"] = float(target_head_height_mm)
    if cap_protrusion_fraction is not None:
        cpf = float(cap_protrusion_fraction)
        overrides["CAP_PROTRUSION_FRACTION"] = cpf
        # JUNCTION_Z_OFFSET_MM is derived from CAP_PROTRUSION_FRACTION ×
        # VALVE_CAP_HEIGHT_MM. Keep them in sync per-request.
        overrides["JUNCTION_Z_OFFSET_MM"] = -cpf * C.VALVE_CAP_HEIGHT_MM
    if overrides:
        from dataclasses import replace as _replace
        C = _replace(C, **overrides)

    def _emit(stage_label: str, pct: int) -> None:
        if progress is not None:
            progress(stage_label, pct)

    # P0-017 — bound each stage and the total run by wall-clock budgets.
    # Per-stage budget is `STAGE_TIMEOUT_S` (default 60); total is
    # `JOB_TIMEOUT_S` (default 300) measured from the start of run_v1
    # (post-cold-start; TRELLIS itself runs separately upstream).
    stage_budget = _stage_timeout_s()
    job_budget = _job_timeout_s()
    job_started = time.perf_counter()

    def _remaining() -> float:
        return max(1.0, job_budget - (time.perf_counter() - job_started))

    head = run_with_timeout(
        "stage1_normalize", stage1_normalize,
        head, head_scale, head_tilt_deg, C,
        timeout_s=stage_budget, job_remaining_s=_remaining(),
    )
    _emit(*_PROGRESS_STAGE1)

    head = run_with_timeout(
        "stage1_5_repair", stage1_5_repair,
        head, C,
        timeout_s=stage_budget, job_remaining_s=_remaining(),
    )
    _emit(*_PROGRESS_STAGE1_5)

    cropped, _info = run_with_timeout(
        "stage2_crop", stage2_crop,
        head, C, shoulder_taper_fraction=shoulder_taper_fraction,
        timeout_s=stage_budget, job_remaining_s=_remaining(),
    )
    _emit(*_PROGRESS_STAGE2)

    socketed = run_with_timeout(
        "stage3_subtract_negative_core", stage3_subtract_negative_core,
        cropped, negative_core, C,
        timeout_s=stage_budget, job_remaining_s=_remaining(),
    )
    _emit(*_PROGRESS_STAGE3)

    final = run_with_timeout(
        "stage4_union_valve_cap", stage4_union_valve_cap,
        socketed, valve_cap, C,
        timeout_s=stage_budget, job_remaining_s=_remaining(),
    )
    _emit(*_PROGRESS_STAGE4)

    final = run_with_timeout(
        "stage5_postprocess", stage5_postprocess,
        final, C,
        timeout_s=stage_budget, job_remaining_s=_remaining(),
    )
    _emit(*_PROGRESS_STAGE5)

    _emit(*_PROGRESS_DONE)
    return final
