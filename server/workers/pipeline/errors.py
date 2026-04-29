"""Error taxonomy for the StemDomeZ mesh pipeline.

Every failure path in the pipeline raises a ``PipelineError`` with one
of the codes below. The handler turns these into the
``{"type":"error","error":...}`` frame the Node side already understands;
the runtime ``code`` / ``stage`` / ``user_message`` fields let the Node
side surface user-friendly copy without parsing strings.

Why this lives in its own module:

* The plan in ``3D_Pipeline.md`` §10 Phase 3 enumerates exact error
  codes. Keeping them in one place makes that audit trivial.
* The Node side at ``server/commands/stl.js`` and the Three.js viewer
  at ``client/components/valve-stem-viewer.js`` will eventually branch
  on ``error.code`` rather than a stringified message. Stable codes are
  a prerequisite.
* The failure corpus (§9.5) categorises by ``code`` × ``stage`` so we
  can see at a glance which code is regressing. Treat ``ErrorCode``
  values like a public API: don't rename them casually, only add new
  ones.

When you add a new code:

1. Append to ``ErrorCode`` with a stable string value.
2. Append a ``USER_MESSAGES`` entry — that copy is what the user sees.
3. Bump ``CODE_SCHEMA_VERSION`` if the addition changes Node-side
   handling (rare; mostly we just teach Node about the new code).
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional

CODE_SCHEMA_VERSION = 1


class ErrorCode(str, Enum):
    """Stable codes consumed by the Node server and the failure corpus."""

    # Stage 0 — Input validation (mediapipe pre-flight).
    NO_FACE_DETECTED = "no_face_detected"
    LOW_IMAGE_QUALITY = "low_image_quality"          # <256 px or extreme blur
    HEAD_POSE_AMBIGUOUS = "head_pose_ambiguous"      # yaw/pitch/roll > 30°

    # TRELLIS / Stage 1 (orientation).
    TRELLIS_FAILED = "trellis_failed"
    ORIENTATION_AMBIGUOUS = "orientation_ambiguous"  # PCA + landmark fallback both failed

    # Stage 1.5 (repair).
    NON_MANIFOLD_INPUT_UNREPAIRABLE = "non_manifold_input_unrepairable"
    REPAIR_TIMEOUT = "repair_timeout"
    INVALID_MESH = "invalid_mesh"  # P3-009 — empty / NaN / <4 faces; truly broken input

    # Stage 2 (crop).
    NECK_NOT_FOUND = "neck_not_found"                # heuristic couldn't pick z_cut

    # Stages 3 / 4 (booleans).
    BOOLEAN_FAILED = "boolean_failed"

    # Stage 5 (post-process).
    OUTPUT_NOT_WATERTIGHT = "output_not_watertight"
    OUTPUT_DIMENSIONS_OUT_OF_RANGE = "output_dimensions_out_of_range"
    DECIMATION_FAILED = "decimation_failed"

    # Resource bounds (§9.5).
    TRIANGLE_BUDGET_EXCEEDED = "triangle_budget_exceeded"
    STAGE_TIMEOUT = "stage_timeout"
    TOTAL_TIMEOUT = "total_timeout"
    # P0-018: hard cap on TRELLIS post-repair triangle count. Exceeded → reject
    # before the rest of the pipeline burns CPU/memory on a runaway mesh.
    MESH_TOO_LARGE = "mesh_too_large"
    # P3-016: thin-wall warning code (used in warning frames, not raised).
    # Surfaced by the post-Stage-5 raycast validator so the Node tier can
    # re-emit a `stl.generate.warnings` frame per P3-007.
    THIN_WALLS = "thin_walls"

    # Unknown / generic — should be rare; investigate every occurrence.
    INTERNAL_ERROR = "internal_error"


# User-facing copy. Keep these short and actionable. The Node side
# delivers this string as-is; no template substitution today.
USER_MESSAGES: dict[ErrorCode, str] = {
    ErrorCode.NO_FACE_DETECTED: (
        "Couldn't find a face in your photo. Try a clearer front-facing portrait."
    ),
    ErrorCode.LOW_IMAGE_QUALITY: (
        "Photo quality is too low. Use at least 256×256 pixels and decent lighting."
    ),
    ErrorCode.HEAD_POSE_AMBIGUOUS: (
        "Head angle is too extreme. Try a photo facing the camera more directly."
    ),
    ErrorCode.TRELLIS_FAILED: (
        "Our 3D model couldn't process that photo. Try a different one."
    ),
    ErrorCode.ORIENTATION_AMBIGUOUS: (
        "Couldn't determine which way is up on the generated head. Try a clearer photo."
    ),
    ErrorCode.NON_MANIFOLD_INPUT_UNREPAIRABLE: (
        "The generated mesh has defects we couldn't repair. Try a different photo."
    ),
    ErrorCode.INVALID_MESH: (
        "The generated mesh is empty or malformed. Try a clearer, well-lit photo."
    ),
    ErrorCode.REPAIR_TIMEOUT: (
        "Mesh repair took too long. Try again, or use a different photo."
    ),
    ErrorCode.NECK_NOT_FOUND: (
        "Couldn't find a clean neckline on the generated head. Try a photo where "
        "your neck is visible."
    ),
    ErrorCode.BOOLEAN_FAILED: (
        "Could not assemble the cap geometry. This is usually a transient issue — "
        "please retry."
    ),
    ErrorCode.OUTPUT_NOT_WATERTIGHT: (
        "The generated 3D model isn't printable as-is. Please try again."
    ),
    ErrorCode.OUTPUT_DIMENSIONS_OUT_OF_RANGE: (
        "The generated 3D model came out the wrong size. Please try again."
    ),
    ErrorCode.DECIMATION_FAILED: (
        "Couldn't optimise the 3D model for printing. Please try again."
    ),
    ErrorCode.TRIANGLE_BUDGET_EXCEEDED: (
        "The generated mesh is too complex to process. Try a simpler photo."
    ),
    ErrorCode.STAGE_TIMEOUT: (
        "A processing step took too long. Please retry."
    ),
    ErrorCode.TOTAL_TIMEOUT: (
        "Generation took too long. Please retry."
    ),
    ErrorCode.MESH_TOO_LARGE: (
        "The generated mesh is too complex to print. Try a clearer photo."
    ),
    ErrorCode.THIN_WALLS: (
        "Some walls in the generated model may be too thin to print "
        "reliably. Inspect before printing."
    ),
    ErrorCode.INTERNAL_ERROR: (
        "Something went wrong on our end. Please try again."
    ),
}


@dataclass(frozen=True)
class PipelineError(Exception):
    """The single exception type the pipeline raises.

    Caller (``handler.py``) catches ``PipelineError``, emits a
    ``{"type":"error", "error": str, "code": code, "stage": stage,
    "user_message": user_message}`` frame, and writes the input to the
    failure corpus.

    ``stage`` is a free-form string ("stage0", "stage1.5", "stage3",
    "post-stage5", etc.) — used for telemetry buckets, not for
    programmatic dispatch.
    """

    code: ErrorCode
    stage: str
    detail: Optional[str] = None    # internal debugging context

    def __post_init__(self):
        # Exception's __init__ takes positional args we want to keep
        # populated for `str(err)` to be useful.
        Exception.__init__(self, self._compose_message())

    def _compose_message(self) -> str:
        msg = f"[{self.stage}] {self.code.value}"
        if self.detail:
            msg += f": {self.detail}"
        return msg

    @property
    def user_message(self) -> str:
        return USER_MESSAGES.get(self.code, USER_MESSAGES[ErrorCode.INTERNAL_ERROR])

    def to_frame(self) -> dict:
        """Serialise to the worker's error-frame shape."""
        return {
            "type": "error",
            "error": str(self),
            "code": self.code.value,
            "stage": self.stage,
            "user_message": self.user_message,
            "schema_version": CODE_SCHEMA_VERSION,
        }
