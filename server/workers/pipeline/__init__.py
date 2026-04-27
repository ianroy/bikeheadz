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
    final_mesh = run_v1(head, valve_cap, negative_core, request_ctx)

For local-fallback `trellis_generate.py`, a sibling ``sys.path`` shim
is needed (the local Python worker isn't bundled in /app like the
RunPod one is).
"""

from __future__ import annotations

from .errors import ErrorCode, PipelineError, USER_MESSAGES, CODE_SCHEMA_VERSION

__all__ = [
    "run_v1",
    "ErrorCode",
    "PipelineError",
    "USER_MESSAGES",
    "CODE_SCHEMA_VERSION",
]


def run_v1(*args, **kwargs):
    """Entry point for the v1 mesh pipeline.

    Phase 0 stub. Phase 1 will replace this with the actual
    Stage-1+1.5+2 sequence. Phase 2 fills in Stage 3+4+5.

    Until Phase 1 ships, anyone importing ``run_v1`` and calling it
    deserves to know they hit the stub: raise loudly so a misconfigured
    feature flag can't silently degrade output.
    """
    raise PipelineError(
        code=ErrorCode.INTERNAL_ERROR,
        stage="pipeline.run_v1",
        detail=(
            "v1 pipeline not yet implemented. handler.py should still be "
            "routing pipeline_version=='v1' through the legacy _merge stub."
        ),
    )
