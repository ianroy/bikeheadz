"""P3-017 — Capture post-pipeline golden STLs for the regression corpus.

Walks ``server/assets/test_corpus/<entry>/photo.jpg``, runs the v1
pipeline against each, and writes ``golden.stl`` + ``golden_meta.json``
into the same directory. The smoke test in ``tools/pipeline_smoke_test.py``
(future) replays these in CI to detect regressions.

Usage
-----
    python3 tools/capture_goldens.py                  # default corpus dir
    python3 tools/capture_goldens.py --corpus-dir X   # override
    python3 tools/capture_goldens.py --dry-run        # plan, no writes

If a sibling ``trellis_raw.stl`` already exists next to the photo, the
script uses it directly and skips the GPU-bound TRELLIS step — letting
this run on a CPU-only machine. Otherwise the script falls back to
loading TRELLIS via the same import path as ``handler.py`` (which
requires CUDA + the model download; not what CI does).

Design notes
------------
* ``BIKEHEADZ_OFFLINE=1`` — short-circuits the pipeline call. The
  script still walks the corpus and prints what it WOULD do; nothing
  is written. This is the CI mode: we want to confirm the inventory
  is sane without actually running the mesh stages.
* Missing corpus directory is a *warning*, not an error. The smoke test
  is gated on ≥5 corpus entries (per ``test_corpus/README.md``); until
  that lands, capture_goldens is a planned-but-empty operation.
* Exit code is 0 on dry-run / offline / missing-corpus / all-success.
  Any per-entry failure returns 2 with a JSON dump of the error.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import sys
import time
from pathlib import Path
from typing import Optional

# Project paths. The script is invoked as `python3 tools/capture_goldens.py`
# from the repo root, so paths-relative-to-cwd are stable. We compute
# the repo root once for safety.
_REPO_ROOT = Path(__file__).resolve().parents[1]
_DEFAULT_CORPUS = _REPO_ROOT / "server" / "assets" / "test_corpus"
_DEFAULT_CONSTANTS = _REPO_ROOT / "server" / "assets" / "pipeline_constants.json"


def _sha256_file(path: Path) -> str:
    """Hex SHA-256 of a file's contents. Returns 'missing' if not present."""
    if not path.exists():
        return "missing"
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(64 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _handler_version() -> str:
    """Read the HANDLER_VERSION constant out of handler.py without
    importing it (handler.py imports torch + runpod which we don't want
    pulled in for a corpus-walking script)."""
    handler = _REPO_ROOT / "handler.py"
    if not handler.exists():
        return "unknown"
    try:
        for line in handler.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("HANDLER_VERSION"):
                _, _, val = line.partition("=")
                return val.strip().strip('"').strip("'")
    except OSError:
        return "unknown"
    return "unknown"


def _iso_utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def _emit(record: dict) -> None:
    """Single-line JSON log to stdout — easy to grep across runs."""
    sys.stdout.write(json.dumps(record) + "\n")
    sys.stdout.flush()


def _list_entries(corpus_dir: Path) -> list[Path]:
    """Each entry is a subdir of ``corpus_dir`` containing photo.jpg.

    Order is sorted by directory name so re-runs produce stable logs.
    Subdirs without photo.jpg are silently skipped (room for a
    notes-only README dir, etc.).
    """
    if not corpus_dir.exists() or not corpus_dir.is_dir():
        return []
    out: list[Path] = []
    for child in sorted(corpus_dir.iterdir()):
        if not child.is_dir():
            continue
        if (child / "photo.jpg").exists():
            out.append(child)
    return out


def _plan(entry: Path, *, dry_run: bool, offline: bool) -> dict:
    """Describe what would happen for one entry. Used by --dry-run AND
    by the live path for telemetry."""
    photo = entry / "photo.jpg"
    trellis_raw = entry / "trellis_raw.stl"
    return {
        "entry": entry.name,
        "photo_exists": photo.exists(),
        "trellis_raw_cached": trellis_raw.exists(),
        "would_run_trellis": (not trellis_raw.exists()) and not (dry_run or offline),
        "would_write_golden": not (dry_run or offline),
        "out_stl": str(entry / "golden.stl"),
        "out_meta": str(entry / "golden_meta.json"),
    }


def _run_pipeline_for_entry(entry: Path) -> dict:
    """Real pipeline execution path. Imports lazily so dry-run / offline
    paths don't pull in heavy deps (trimesh, torch, etc.)."""
    import trimesh  # noqa: PLC0415 — lazy by design

    # Make `pipeline` importable. On the worker image this is at /app,
    # but locally the package lives at server/workers/pipeline.
    sys.path.insert(0, str(_REPO_ROOT / "server" / "workers"))
    from pipeline import run_v1  # noqa: PLC0415

    photo = entry / "photo.jpg"
    trellis_raw = entry / "trellis_raw.stl"

    timings: dict = {}

    if trellis_raw.exists():
        # Cached TRELLIS path — replay the raw mesh.
        t = time.perf_counter()
        head = trimesh.load_mesh(str(trellis_raw))
        if isinstance(head, trimesh.Scene):
            head = trimesh.util.concatenate(tuple(head.geometry.values()))
        timings["trellis_load_ms"] = int((time.perf_counter() - t) * 1000)
    else:
        # No cached output — invoke TRELLIS. Only works on CUDA boxes;
        # without a GPU this raises. Caller should use the cached path.
        from handler import _load_pipeline, _to_numpy  # noqa: PLC0415
        from PIL import Image  # noqa: PLC0415

        t = time.perf_counter()
        pipeline = _load_pipeline()
        timings["pipeline_load_ms"] = int((time.perf_counter() - t) * 1000)

        t = time.perf_counter()
        img = Image.open(str(photo)).convert("RGB")
        outputs = pipeline.run(img, seed=1)
        timings["trellis_ms"] = int((time.perf_counter() - t) * 1000)
        mesh_result = outputs["mesh"][0]
        head = trimesh.Trimesh(
            vertices=_to_numpy(mesh_result.vertices),
            faces=_to_numpy(mesh_result.faces),
            process=True,
        )
        head.fix_normals()

    # Reference assets — same paths the handler uses, but local.
    valve_cap_path = _REPO_ROOT / "server" / "assets" / "valve_cap.stl"
    negative_core_path = _REPO_ROOT / "server" / "assets" / "negative_core.stl"
    valve_cap = trimesh.load_mesh(str(valve_cap_path))
    negative_core = trimesh.load_mesh(str(negative_core_path))
    if isinstance(valve_cap, trimesh.Scene):
        valve_cap = trimesh.util.concatenate(tuple(valve_cap.geometry.values()))
    if isinstance(negative_core, trimesh.Scene):
        negative_core = trimesh.util.concatenate(tuple(negative_core.geometry.values()))

    stage_timings: dict[str, int] = {}

    def _progress(label: str, pct: int) -> None:
        # `label` is like "stage1_normalize"; record running total so
        # we can show "wall-clock per stage" if useful later.
        stage_timings[label] = int((time.perf_counter() - run_started) * 1000)

    run_started = time.perf_counter()
    final = run_v1(
        head,
        valve_cap,
        negative_core,
        head_scale=1.0,
        head_tilt_deg=0.0,
        progress=_progress,
    )
    timings["run_v1_ms"] = int((time.perf_counter() - run_started) * 1000)
    timings["stage_timings_ms"] = stage_timings

    out_stl = entry / "golden.stl"
    final.export(str(out_stl), file_type="stl")
    return {"timings": timings, "tris": int(len(final.faces))}


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--corpus-dir",
        type=Path,
        default=_DEFAULT_CORPUS,
        help="Directory containing entry subdirs with photo.jpg (default: %(default)s)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the planned operations without writing.",
    )
    args = parser.parse_args(argv)

    offline = os.environ.get("BIKEHEADZ_OFFLINE", "") == "1"

    corpus = args.corpus_dir
    if not corpus.exists():
        _emit({
            "kind": "capture_goldens.warn",
            "msg": "corpus directory missing — nothing to do",
            "corpus_dir": str(corpus),
        })
        return 0

    entries = _list_entries(corpus)
    if not entries:
        _emit({
            "kind": "capture_goldens.warn",
            "msg": "no entries with photo.jpg in corpus",
            "corpus_dir": str(corpus),
        })
        return 0

    handler_version = _handler_version()
    constants_sha = _sha256_file(_DEFAULT_CONSTANTS)

    failures = 0
    for entry in entries:
        plan = _plan(entry, dry_run=args.dry_run, offline=offline)
        _emit({"kind": "capture_goldens.plan", **plan})

        if args.dry_run or offline:
            continue

        try:
            t0 = time.perf_counter()
            result = _run_pipeline_for_entry(entry)
            wall_s = time.perf_counter() - t0

            meta = {
                "entry": entry.name,
                "handler_version": handler_version,
                "pipeline_constants_sha256": constants_sha,
                "captured_at": _iso_utc_now(),
                "wall_seconds": round(wall_s, 3),
                "final_tris": result["tris"],
                "timings": result["timings"],
            }
            with (entry / "golden_meta.json").open("w", encoding="utf-8") as fh:
                json.dump(meta, fh, indent=2)
            _emit({"kind": "capture_goldens.ok", "entry": entry.name, "wall_seconds": round(wall_s, 3)})
        except Exception as exc:  # noqa: BLE001 — surface anything as a failure record
            failures += 1
            _emit({
                "kind": "capture_goldens.fail",
                "entry": entry.name,
                "error": f"{type(exc).__name__}: {exc}",
            })

    if failures:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
