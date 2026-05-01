"""StemDomeZ mesh pipeline — the v1 codepath.

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
    stage1_7_watertight_head,
    stage1_normalize,
    stage2_crop,
    stage2_crop_flat,
    stage3_subtract_negative_core,
    stage4_union_valve_cap,
    stage5_postprocess,
    stage6_print_repair,
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
    "run_v1_head_only",
    "run_v1_finalize",
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
_PROGRESS_STAGE1_5 = ("stage1_5_repair", 28)
_PROGRESS_STAGE1_7 = ("stage1_7_watertight_head", 38)
_PROGRESS_STAGE2 = ("stage2_crop", 50)
_PROGRESS_STAGE3 = ("stage3_subtract_negative_core", 65)
_PROGRESS_STAGE4 = ("stage4_union_valve_cap", 80)
_PROGRESS_STAGE5 = ("stage5_postprocess", 90)
_PROGRESS_STAGE6 = ("stage6_print_repair", 96)
_PROGRESS_DONE = ("run_v1.done", 100)


def _apply_overrides(C, target_head_height_mm, cap_protrusion_fraction):
    """Per-request overrides without mutating the cached Constants."""
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
    return C


def run_v1_head_only(
    head: trimesh.Trimesh,
    *,
    head_scale: float = 1.0,
    head_tilt_deg: float = 0.0,
    target_head_height_mm: Optional[float] = None,
    progress: Optional[Callable[[str, int], None]] = None,
) -> trimesh.Trimesh:
    """Run stages 1, 1.5, 1.7 — produces a watertight head ready for booleans.

    This is the "salvage" output. If the boolean stages downstream fail
    (which happens regularly on iPhone selfies with awkward neck
    geometry), the rider still walks away with their face as a printable
    STL. The valve-stem hole / threaded cap / chamfer all come later in
    ``run_v1_finalize``; nothing in this function touches the cap asset
    or runs CSG against it.

    No overrides for ``cap_protrusion_fraction`` here — that knob only
    affects stage 4's union geometry, which is downstream of this call.
    """
    C = _get_constants()
    C = _apply_overrides(C, target_head_height_mm, None)

    def _emit(stage_label: str, pct: int) -> None:
        if progress is not None:
            progress(stage_label, pct)

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

    head = run_with_timeout(
        "stage1_7_watertight_head", stage1_7_watertight_head,
        head, C,
        timeout_s=stage_budget, job_remaining_s=_remaining(),
    )
    _emit(*_PROGRESS_STAGE1_7)

    return head


def run_v1_finalize(
    head_clean: trimesh.Trimesh,
    valve_cap: trimesh.Trimesh,
    negative_core: trimesh.Trimesh,
    *,
    shoulder_taper_fraction: float = 0.60,
    target_head_height_mm: Optional[float] = None,
    cap_protrusion_fraction: Optional[float] = None,
    progress: Optional[Callable[[str, int], None]] = None,
) -> trimesh.Trimesh:
    """Run stages 2 → 6 against a head that already passed stage 1.7.

    The risky half of the pipeline. ``head_clean`` MUST come from
    ``run_v1_head_only`` — booleans against an unrepaired head fall back
    to mesh concat and the rider gets a multi-shell mess. If any stage
    here raises ``PipelineError``, the caller is expected to surface the
    head-only STL it already has and report ``final_failed=true`` to the
    UI.
    """
    C = _get_constants()
    C = _apply_overrides(C, target_head_height_mm, cap_protrusion_fraction)

    def _emit(stage_label: str, pct: int) -> None:
        if progress is not None:
            progress(stage_label, pct)

    stage_budget = _stage_timeout_s()
    job_budget = _job_timeout_s()
    job_started = time.perf_counter()

    def _remaining() -> float:
        return max(1.0, job_budget - (time.perf_counter() - job_started))

    head = head_clean
    # v0.1.43 — object-mode tracking. Set true if we fall back to the
    # flat-bottom crop because the input wasn't a head + shoulders
    # (TRELLIS will mesh anything: a coffee mug, a sticker, a cat).
    # The handler reads ``final.metadata["sdz_object_mode_used"]`` and
    # surfaces it as ``object_mode_used`` on the wire so the UI can
    # label the panel "object mode" instead of "head + cap".
    object_mode_used = False

    # Crop + cavity carve. Same auto-retry logic as the original run_v1.
    def _run_crop_and_carve(taper: float):
        c, _ = run_with_timeout(
            "stage2_crop", stage2_crop,
            head, C, shoulder_taper_fraction=taper,
            timeout_s=stage_budget, job_remaining_s=_remaining(),
        )
        s = run_with_timeout(
            "stage3_subtract_negative_core", stage3_subtract_negative_core,
            c, negative_core, C,
            timeout_s=stage_budget, job_remaining_s=_remaining(),
        )
        return c, s

    # Object-mode fallback. When neck-finding can't get a clean cut on
    # ANY attempt, we trim a thin slice off the bottom of the bbox
    # (stage2_crop_flat) and let stages 3-6 union the cap onto whatever
    # TRELLIS produced. The cap may end up on the bottom of a mug, a
    # cat's belly, or a blob — that's fine, the rider asked for it.
    def _run_flat_crop_and_carve():
        c, _ = run_with_timeout(
            "stage2_crop_flat", stage2_crop_flat,
            head, C,
            timeout_s=stage_budget, job_remaining_s=_remaining(),
        )
        s = run_with_timeout(
            "stage3_subtract_negative_core", stage3_subtract_negative_core,
            c, negative_core, C,
            timeout_s=stage_budget, job_remaining_s=_remaining(),
        )
        return c, s

    try:
        cropped, socketed = _run_crop_and_carve(shoulder_taper_fraction)
    except PipelineError as exc:
        if exc.code != ErrorCode.NECK_NOT_FOUND:
            raise
        relaxed_first = max(0.40, float(shoulder_taper_fraction) - 0.15)
        if abs(relaxed_first - shoulder_taper_fraction) > 1e-6:
            sys.stderr.write(
                f"[run_v1_finalize] stage2 raised NECK_NOT_FOUND; auto-retrying "
                f"stage2+stage3 with shoulder_taper_fraction "
                f"{shoulder_taper_fraction:.2f} → {relaxed_first:.2f}\n"
            )
            try:
                cropped, socketed = _run_crop_and_carve(relaxed_first)
            except PipelineError as exc2:
                if exc2.code != ErrorCode.NECK_NOT_FOUND:
                    raise
                # Both head-mode attempts exhausted. Object-mode fallback.
                sys.stderr.write(
                    "[run_v1_finalize] head-mode crop exhausted (relaxed taper "
                    "also raised NECK_NOT_FOUND); engaging object-mode flat crop. "
                    "Final mesh will glue the cap onto whatever shape TRELLIS produced.\n"
                )
                cropped, socketed = _run_flat_crop_and_carve()
                object_mode_used = True
        else:
            # Already at minimum taper; no retry possible. Go straight
            # to object-mode fallback.
            sys.stderr.write(
                "[run_v1_finalize] stage2 raised NECK_NOT_FOUND at minimum taper "
                "(no head-mode retry possible); engaging object-mode flat crop.\n"
            )
            cropped, socketed = _run_flat_crop_and_carve()
            object_mode_used = True
    _emit(*_PROGRESS_STAGE2)

    thin = float(getattr(socketed, "metadata", {}).get("sdz_thin_wall_min_mm", 0.0) or 0.0)
    if 0.0 < thin < 5.0:
        relaxed = max(0.40, float(shoulder_taper_fraction) - 0.15)
        if abs(relaxed - shoulder_taper_fraction) > 1e-6:
            sys.stderr.write(
                f"[run_v1_finalize] thin-wall ({thin:.3f} mm) detected; auto-retrying "
                f"stage2+stage3 with shoulder_taper_fraction "
                f"{shoulder_taper_fraction:.2f} → {relaxed:.2f}\n"
            )
            try:
                cropped, socketed = _run_crop_and_carve(relaxed)
            except Exception as exc:  # noqa: BLE001
                sys.stderr.write(
                    f"[run_v1_finalize] auto-retry crashed: {type(exc).__name__}: {exc}; "
                    f"shipping the first-attempt mesh anyway.\n"
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

    final = run_with_timeout(
        "stage6_print_repair", stage6_print_repair,
        final, C,
        timeout_s=stage_budget, job_remaining_s=_remaining(),
    )
    _emit(*_PROGRESS_STAGE6)

    # Stamp object-mode marker onto the final mesh's metadata so the
    # handler can read it and surface ``object_mode_used`` on the wire.
    # trimesh.Trimesh.metadata is a plain dict; safe to write.
    if object_mode_used:
        try:
            final.metadata["sdz_object_mode_used"] = True
        except Exception:  # noqa: BLE001
            # Defensive: if metadata is somehow read-only on this trimesh
            # version, swallow — the handler defaults to False on read.
            pass

    _emit(*_PROGRESS_DONE)
    return final


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
    # Back-compat wrapper: now just chains the two split phases.
    # New callers (handler.py v0.1.42+) should call run_v1_head_only +
    # run_v1_finalize directly so they can ship the head STL even if
    # finalize raises. This wrapper preserves the all-or-nothing
    # semantics of the original API for any external caller still on it.
    head_clean = run_v1_head_only(
        head,
        head_scale=head_scale,
        head_tilt_deg=head_tilt_deg,
        target_head_height_mm=target_head_height_mm,
        progress=progress,
    )
    return run_v1_finalize(
        head_clean, valve_cap, negative_core,
        shoulder_taper_fraction=shoulder_taper_fraction,
        target_head_height_mm=target_head_height_mm,
        cap_protrusion_fraction=cap_protrusion_fraction,
        progress=progress,
    )
