"""Calibration constants loader.

Reads ``server/assets/pipeline_constants.json`` (produced by
``tools/calibrate_pipeline.py``) once at import time. Stages reference
the resulting ``CONSTANTS`` namespace by attribute lookup
(``CONSTANTS.TARGET_HEAD_HEIGHT_MM``).

Why module-load instead of per-request:

* The constants don't change per request. Reading the JSON twenty
  times a minute on a warm worker is wasteful.
* Failing fast at module load makes "constants file missing" a clear
  cold-start error rather than an obscure first-request error.

Why a frozen namespace and not a plain dict:

* Stages should not mutate constants. ``types.SimpleNamespace`` plus
  immutability via __setattr__ guard surfaces accidents at runtime.
* IDE autocomplete works against attribute access, not dict-key access.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, fields
from pathlib import Path
from typing import Tuple

# Resolution order:
#   1. PIPELINE_CONSTANTS_PATH env var (test/dev override)
#   2. /app/pipeline_constants.json (Dockerfile COPY destination)
#   3. <repo>/server/assets/pipeline_constants.json (local dev)
DEFAULT_CANDIDATES = (
    "/app/pipeline_constants.json",
    str(Path(__file__).resolve().parents[3] / "server/assets/pipeline_constants.json"),
)


@dataclass(frozen=True)
class Constants:
    """Strongly-typed view of pipeline_constants.json.

    Mirrors the keys produced by ``tools/calibrate_pipeline.py``. Adding
    a field here without updating the calibrate script (or vice versa)
    is a CI failure — see ``tools/calibrate_pipeline.py`` and the §6
    drift-check.
    """

    TARGET_HEAD_HEIGHT_MM: float
    VALVE_CAP_OFFSET_FROM_HEAD_BOTTOM_MM: float
    NEGATIVE_CORE_DIAMETER_MM: float
    VALVE_CAP_OUTER_DIAMETER_MM: float
    NEGATIVE_CORE_CLEARANCE_MM: float
    MANIFOLD_TOLERANCE_MM: float
    CAP_REGION_Z_RANGE_MM: Tuple[float, float]
    CAP_REGION_RADIUS_MM: float
    MIN_WALL_THICKNESS_MM: float


def _resolve_path() -> str:
    env = os.environ.get("PIPELINE_CONSTANTS_PATH")
    candidates = (env,) if env else ()
    candidates += DEFAULT_CANDIDATES
    for candidate in candidates:
        if candidate and os.path.exists(candidate):
            return candidate
    raise FileNotFoundError(
        "pipeline_constants.json not found. Run "
        "`python3 tools/calibrate_pipeline.py` to generate it. "
        f"Looked in: {candidates}"
    )


def load() -> Constants:
    path = _resolve_path()
    with open(path, "r", encoding="utf-8") as fh:
        doc = json.load(fh)
    raw = doc.get("constants") or {}
    expected = {f.name for f in fields(Constants)}
    missing = expected - raw.keys()
    if missing:
        raise ValueError(
            f"pipeline_constants.json missing keys: {sorted(missing)} (from {path})"
        )
    extra = raw.keys() - expected
    if extra:
        # Forward-compat: tolerate extra keys, log via stderr the
        # caller can capture. Using print() to keep this module
        # dependency-free.
        import sys
        sys.stderr.write(
            f"[pipeline.constants] ignoring unknown keys in constants.json: "
            f"{sorted(extra)}\n"
        )
    # Normalise CAP_REGION_Z_RANGE_MM into a tuple of two floats.
    z_range = raw["CAP_REGION_Z_RANGE_MM"]
    if isinstance(z_range, list):
        if len(z_range) != 2:
            raise ValueError("CAP_REGION_Z_RANGE_MM must be [zmin, zmax]")
        raw = {**raw, "CAP_REGION_Z_RANGE_MM": (float(z_range[0]), float(z_range[1]))}
    return Constants(**{k: raw[k] for k in expected})


# Cached constants — loaded on first call to `get()`. We don't load at
# module-import time because legacy code paths (and the failure-corpus
# tooling) want to `from pipeline import ErrorCode` without needing
# pipeline_constants.json to exist. v1 stages call `get()` explicitly.
_CACHED: Constants | None = None


def get() -> Constants:
    """Lazy accessor. Loads the JSON on first call, caches thereafter."""
    global _CACHED
    if _CACHED is None:
        _CACHED = load()
    return _CACHED


def reset() -> None:
    """Test hook — drop the cache so a subsequent ``get()`` reloads."""
    global _CACHED
    _CACHED = None
