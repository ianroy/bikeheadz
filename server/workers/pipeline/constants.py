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
#
# The dev-fallback path uses parents[3], which is valid for the dev
# layout (server/workers/pipeline/constants.py — four levels up = repo
# root) but IndexErrors on the production worker, where the file lives
# at /app/pipeline/constants.py (only two parent levels). Wrap the
# resolution in a try/except so module import never crashes; on the
# worker we just rely on /app/pipeline_constants.json (Dockerfile COPY).
def _dev_fallback_path() -> str | None:
    try:
        return str(
            Path(__file__).resolve().parents[3]
            / "server/assets/pipeline_constants.json"
        )
    except (IndexError, OSError):
        return None


_DEV_FALLBACK = _dev_fallback_path()
DEFAULT_CANDIDATES: Tuple[str, ...] = ("/app/pipeline_constants.json",)
if _DEV_FALLBACK:
    DEFAULT_CANDIDATES = DEFAULT_CANDIDATES + (_DEV_FALLBACK,)


@dataclass(frozen=True)
class Constants:
    """Strongly-typed view of pipeline_constants.json.

    Mirrors the keys produced by ``tools/calibrate_pipeline.py``. Adding
    a field here without updating the calibrate script (or vice versa)
    is a CI failure — see ``tools/calibrate_pipeline.py`` and the §6
    drift-check.

    Schema reflects the post-Phase −0.5 design: refs are raw inputs
    (no cap-region constants), there's no core/cap "clearance" (cap
    intentionally larger than core; threads bite into head walls),
    and head height is auto-rescaled to TARGET_HEAD_HEIGHT_MM.
    """

    # Locked design (§0).
    TARGET_HEAD_HEIGHT_MM: float
    MANIFOLD_TOLERANCE_MM: float
    MIN_WALL_THICKNESS_MM: float
    # Fraction of VALVE_CAP_HEIGHT_MM the cap protrudes below the head's
    # bottom plane — creates the bike-valve entry opening.
    CAP_PROTRUSION_FRACTION: float

    # Measured cap.
    VALVE_CAP_OUTER_DIAMETER_MM: float
    VALVE_CAP_THREADED_OUTER_DIAMETER_MM: float
    VALVE_CAP_HEIGHT_MM: float

    # Measured negative core.
    NEGATIVE_CORE_DIAMETER_MM: float
    NEGATIVE_CORE_HEIGHT_MM: float

    # Derived: cap-bottom and core-bottom Z baseline relative to head's
    # bottom plane (z=0). Equals -CAP_PROTRUSION_FRACTION × VALVE_CAP_HEIGHT_MM.
    JUNCTION_Z_OFFSET_MM: float


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
    return Constants(**{k: float(raw[k]) for k in expected})


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
