"""
RunPod Serverless handler for BikeHeadz.

Contract: one serverless invocation = one STL generation. The Node server
calls POST /v2/<endpoint>/run with `{ "input": { image_b64, head_scale,
neck_length_mm, head_tilt_deg, seed } }` and polls /stream/<id> while this
handler yields progress frames and finally a `result` frame carrying the
base64-encoded STL.

Frame shapes (identical to the local stdin/stdout worker so the Node side
can't tell them apart):

    {"type": "progress", "step": "…", "pct": 30}
    {"type": "result",   "triangles": 12345, "stl_b64": "…"}
    {"type": "error",    "error": "…"}

The TRELLIS pipeline and valve-cap mesh are loaded once at module import,
re-used across warm invocations. HuggingFace caches to /runpod-volume/hf
so model weights survive cold starts when a Network Volume is mounted.
"""

from __future__ import annotations

import base64
import io
import os
import sys
import traceback
from pathlib import Path

import numpy as np
import runpod
import trimesh
from PIL import Image

# TRELLIS is cloned into /opt/TRELLIS by the Dockerfile.
sys.path.insert(0, "/opt/TRELLIS")
os.environ.setdefault("SPCONV_ALGO", "native")
# TRELLIS has TWO independent attention modules:
#   • trellis.modules.attention reads ATTN_BACKEND, supports
#     {xformers, flash_attn, sdpa, naive}.
#   • trellis.modules.sparse.attention reads SPARSE_ATTN_BACKEND (or
#     falls back to ATTN_BACKEND), but ONLY accepts {xformers,
#     flash_attn}.  No sdpa, no naive.
# So we have to pick xformers or flash_attn — and force-install it in
# the Dockerfile because setup.sh's case statement misses our exact
# torch version string.
os.environ.setdefault("ATTN_BACKEND", "xformers")
os.environ.setdefault("SPARSE_ATTN_BACKEND", "xformers")

# Version banner — prints unconditionally at module load time so we can
# tell from the worker logs whether the running container is actually
# the image tag we think it is.
HANDLER_VERSION = "v0.1.27"
sys.stderr.write(f"[bikeheadz] handler.py {HANDLER_VERSION} booting (pid={os.getpid()})\n")
sys.stderr.flush()

# ---- Module-load-time diagnostics ------------------------------------------
# Build logs prove flexicubes/flexicubes.py and __init__.py are baked into
# the image, but the runtime worker still raises ModuleNotFoundError. Dump
# everything Python sees so the next failure log carries enough evidence to
# point a finger.
def _diag_flexicubes():
    flex_dir = "/opt/TRELLIS/trellis/representations/mesh/flexicubes"
    sys.stderr.write(f"[diag] sys.path[0:3]={sys.path[:3]}\n")
    sys.stderr.write(f"[diag] flex_dir exists: {os.path.isdir(flex_dir)}\n")
    if os.path.isdir(flex_dir):
        contents = sorted(os.listdir(flex_dir))
        sys.stderr.write(f"[diag] flex_dir contents: {contents}\n")
        for fname in ("__init__.py", "flexicubes.py", "tables.py"):
            full = f"{flex_dir}/{fname}"
            if os.path.exists(full):
                sys.stderr.write(f"[diag]   {fname}: size={os.path.getsize(full)}, readable={os.access(full, os.R_OK)}\n")
            else:
                sys.stderr.write(f"[diag]   {fname}: MISSING\n")
    # Try a clean import directly so the trace is isolated from the rest
    # of the trellis package (which pulls in heavy deps via __init__).
    import importlib
    try:
        spec = importlib.util.find_spec("trellis.representations.mesh.flexicubes.flexicubes")
        sys.stderr.write(f"[diag] find_spec(flexicubes.flexicubes) = {spec}\n")
    except Exception as e:
        sys.stderr.write(f"[diag] find_spec raised: {type(e).__name__}: {e}\n")
    sys.stderr.flush()

_diag_flexicubes()


# Eager submodule probe: import each TRELLIS submodule the pipeline will
# need, with their own try/except, BEFORE TRELLIS's loader gets a chance
# to hide the failure inside its silent fallback. Whatever's missing
# prints a `[probe]` line in the boot log we can read directly.
def _diag_probe_imports():
    targets = [
        "trellis.modules.attention",
        "trellis.modules.sparse",
        "trellis.modules.sparse.attention",
        "trellis.representations",
        "trellis.representations.gaussian",
        "trellis.representations.mesh",
        "trellis.representations.octree",
        "trellis.representations.radiance_field",
        "trellis.models.sparse_structure_vae",
        "trellis.models.sparse_structure_flow",
        "trellis.models.structured_latent_vae.encoder",
        "trellis.models.structured_latent_vae.base",
        "trellis.models.structured_latent_vae.decoder_gs",
        "trellis.models.structured_latent_vae.decoder_rf",
        "trellis.models.structured_latent_vae.decoder_mesh",
        "trellis.models.structured_latent_vae",
    ]
    for mod in targets:
        try:
            __import__(mod)
            sys.stderr.write(f"[probe] OK    {mod}\n")
        except Exception as e:
            sys.stderr.write(f"[probe] FAIL  {mod}  →  {type(e).__name__}: {e}\n")
    sys.stderr.flush()

_diag_probe_imports()


VALVE_CAP_PATH = os.environ.get("VALVE_CAP_PATH", "/app/valve_cap.stl")
TRELLIS_MODEL = os.environ.get("TRELLIS_MODEL", "microsoft/TRELLIS-image-large")

# ---- Module-level, loaded once per warm worker -----------------------------

_PIPELINE = None


def _load_pipeline():
    global _PIPELINE
    if _PIPELINE is not None:
        return _PIPELINE
    from trellis.pipelines import TrellisImageTo3DPipeline  # heavy
    from huggingface_hub import snapshot_download

    # TRELLIS's base Pipeline.from_pretrained does:
    #
    #   try:
    #       _models[k] = models.from_pretrained(f"{path}/{v}")   # local
    #   except:
    #       _models[k] = models.from_pretrained(v)               # bare HF id
    #
    # If ANY sub-checkpoint file is missing locally, the local attempt
    # raises, the bare exception is silently swallowed, and the fallback
    # tries to fetch e.g. `ckpts/ss_dec_conv3d_16l8_fp16` as a standalone
    # HF repo — which 401s. The cache_dir flavor of snapshot_download
    # uses symlinks pointing into a blobs tree; any LFS download miss
    # leaves dangling symlinks and triggers exactly that flow.
    #
    # Using local_dir materialises every file as a real file in a flat
    # directory (no symlinks, no blobs hash tree) and re-runs are
    # idempotent — already-downloaded files are skipped. Then we sanity
    # check the ckpts/ contents before instantiating the pipeline.
    cache_root = os.environ.get("HF_HOME", "/runpod-volume/hf")
    local_dir = os.path.join(cache_root, "trellis-image-large")

    sys.stderr.write(f"[trellis] downloading {TRELLIS_MODEL} → {local_dir}\n")
    sys.stderr.flush()
    # local_dir_use_symlinks=False is the old API to force real files; newer
    # huggingface_hub treats it as a no-op (already the default) but accepts
    # the kwarg. If a still-newer version drops it, we try without.
    snapshot_kwargs = dict(
        repo_id=TRELLIS_MODEL,
        local_dir=local_dir,
        token=os.environ.get("HF_TOKEN"),
        max_workers=4,
    )
    try:
        snapshot_download(**snapshot_kwargs, local_dir_use_symlinks=False)
    except TypeError:
        snapshot_download(**snapshot_kwargs)

    # Per-file diagnostic: report listing AND realpath/size/exists for each
    # ckpts file so we can prove (or refute) the dangling-symlinks theory.
    ckpts_dir = os.path.join(local_dir, "ckpts")
    sys.stderr.write(f"[trellis] ckpts inventory at {ckpts_dir}:\n")
    bad = []
    for fname in sorted(os.listdir(ckpts_dir)):
        full = os.path.join(ckpts_dir, fname)
        is_link = os.path.islink(full)
        try:
            real = os.path.realpath(full)
            real_exists = os.path.exists(real)
            sz = os.path.getsize(full) if os.path.exists(full) else -1
        except OSError as e:
            real, real_exists, sz = "?", False, -1
            sys.stderr.write(f"[trellis]   {fname}: stat error {e}\n")
        sys.stderr.write(
            f"[trellis]   {fname}: link={is_link} exists={os.path.exists(full)} "
            f"size={sz} realpath_exists={real_exists}\n"
        )
        if not os.path.exists(full) or sz == 0:
            bad.append(fname)
    sys.stderr.flush()
    if bad:
        raise RuntimeError(
            f"ckpts incomplete (dangling/empty): {bad}. "
            f"Try: rm -rf {local_dir} on the network volume to force re-download."
        )

    ckpts_dir = os.path.join(local_dir, "ckpts")
    if not os.path.isdir(ckpts_dir):
        raise RuntimeError(
            f"snapshot_download did not populate {ckpts_dir}; "
            f"local_dir contents: {sorted(os.listdir(local_dir))}"
        )
    ckpts = sorted(os.listdir(ckpts_dir))
    sys.stderr.write(f"[trellis] ckpts/ contains {len(ckpts)} files: {ckpts}\n")

    _PIPELINE = TrellisImageTo3DPipeline.from_pretrained(local_dir)
    _PIPELINE.cuda()
    return _PIPELINE


def _load_valve_cap():
    mesh = trimesh.load_mesh(VALVE_CAP_PATH)
    if isinstance(mesh, trimesh.Scene):
        mesh = trimesh.util.concatenate(tuple(mesh.geometry.values()))
    return mesh


# Loaded once at module import; never mutated. Per request the v1
# pipeline reconstructs Manifold instances from these (per §8.5).
_VALVE_CAP = _load_valve_cap()


# v1 pipeline assets — `negative_core.stl` lives next to `valve_cap.stl`
# in the Dockerfile COPY (post-Phase 0). Loaded lazily on first v1
# request so legacy invocations don't pay the I/O cost.
NEGATIVE_CORE_PATH = os.environ.get("NEGATIVE_CORE_PATH", "/app/negative_core.stl")
_NEGATIVE_CORE = None


def _load_negative_core():
    global _NEGATIVE_CORE
    if _NEGATIVE_CORE is None:
        if not os.path.exists(NEGATIVE_CORE_PATH):
            raise FileNotFoundError(
                f"negative_core.stl not found at {NEGATIVE_CORE_PATH}; "
                "the Dockerfile must COPY server/assets/negative_core.stl /app/negative_core.stl."
            )
        m = trimesh.load_mesh(NEGATIVE_CORE_PATH)
        if isinstance(m, trimesh.Scene):
            m = trimesh.util.concatenate(tuple(m.geometry.values()))
        _NEGATIVE_CORE = m
    return _NEGATIVE_CORE


# Ensure the v1 pipeline package is importable. Dockerfile copies it to
# /app/pipeline; on local-dev (where there is no Dockerfile) we let
# Python's normal cwd-based resolution find it.
if "/app" not in sys.path and os.path.isdir("/app/pipeline"):
    sys.path.insert(0, "/app")


# ---- Head ↔ valve merge (same math as server/workers/trellis_generate.py) --


def _merge(head: trimesh.Trimesh, valve: trimesh.Trimesh,
           head_scale: float, neck_length_mm: float, head_tilt_deg: float) -> trimesh.Trimesh:
    head = head.copy()
    longest = float(max(head.extents)) or 1.0
    head.apply_scale(1.0 / longest)

    valve_top_z = float(valve.bounds[1][2])
    top_slab = valve.slice_plane(
        plane_origin=[0, 0, valve_top_z - 0.5],
        plane_normal=[0, 0, -1],
    )
    if top_slab is not None and len(top_slab.vertices):
        top_bb = top_slab.extents
        top_diameter = max(float(top_bb[0]), float(top_bb[1]))
    else:
        top_diameter = max(float(valve.extents[0]), float(valve.extents[1])) * 0.3

    target = max(top_diameter * 1.6, 6.0) * float(head_scale)
    head.apply_scale(target)

    if head_tilt_deg:
        rot = trimesh.transformations.rotation_matrix(
            np.deg2rad(head_tilt_deg), [0, 1, 0], point=head.centroid
        )
        head.apply_transform(rot)

    head_min_z = float(head.bounds[0][2])
    lift = valve_top_z + float(neck_length_mm) * 0.5 - head_min_z
    head.apply_translation([0, 0, lift])

    combined = trimesh.util.concatenate([valve, head])
    combined.process()
    return combined


# ---- Handler ---------------------------------------------------------------


_VALID_PIPELINE_VERSIONS = ("legacy", "v1")


# ---- Failure corpus & telemetry --------------------------------------------
#
# Phase 3 §9.5 commits: every pipeline error writes the input photo plus a
# structured error.json to /runpod-volume/failures/<yyyymmdd>/<job-id>/
# so we can triage in batches. Every successful run emits a single
# structured JSON log line at completion with per-stage timing — that's
# what an aggregator (BetterStack/Loki/etc.) ingests once we wire one up.
#
# These functions are no-ops on local dev (where /runpod-volume doesn't
# exist); the corpus writes only fire on the actual RunPod worker. The
# telemetry log line goes to stderr regardless so it shows up in any
# `docker logs` / RunPod console.

_FAILURE_BASE = os.environ.get("FAILURE_CORPUS_DIR", "/runpod-volume/failures")


def _failure_corpus_dir(job_id):
    """Per-job directory for writing failure artefacts. Returns None if
    the parent path doesn't exist (so we don't blow up on local dev)."""
    parent = _FAILURE_BASE
    if not os.path.isdir(os.path.dirname(parent)):
        return None
    import datetime as _dt
    today = _dt.datetime.now(_dt.timezone.utc).strftime("%Y%m%d")
    day_dir = os.path.join(parent, today)
    job_dir = os.path.join(day_dir, str(job_id) if job_id else "no-job-id")
    try:
        os.makedirs(job_dir, exist_ok=True)
    except OSError:
        return None
    return job_dir


def _write_failure(job_id, image_b64, *, code, stage, message, extra=None):
    """Write the input photo + error.json into the per-job failure dir."""
    import json as _json
    import datetime as _dt
    job_dir = _failure_corpus_dir(job_id)
    if not job_dir:
        return
    try:
        if image_b64:
            with open(os.path.join(job_dir, "photo.b64"), "w", encoding="utf-8") as fh:
                fh.write(image_b64)
        with open(os.path.join(job_dir, "error.json"), "w", encoding="utf-8") as fh:
            _json.dump({
                "ts": _dt.datetime.now(_dt.timezone.utc).isoformat(),
                "code": code,
                "stage": stage,
                "message": message,
                "handler_version": HANDLER_VERSION,
                "extra": extra or {},
            }, fh, indent=2)
    except OSError as exc:
        sys.stderr.write(f"[failure-corpus] write failed: {exc}\n")


def _emit_telemetry(record):
    """One JSON-encoded line on stderr per request."""
    import json as _json
    try:
        sys.stderr.write("[telemetry] " + _json.dumps(record) + "\n")
        sys.stderr.flush()
    except Exception as exc:  # noqa: BLE001
        sys.stderr.write(f"[telemetry] encode failed: {exc}\n")


def _resolve_pipeline_version(inp):
    """Pick the pipeline branch.

    Per-request input overrides the env-var default. Unknown values
    fall back to legacy and warn — the rollout strategy in
    3D_Pipeline.md §9.5 relies on this being safe by default. Phase 0
    plumbs the field but the v1 codepath is still a stub that runs
    legacy logic; Phase 1 will replace that stub with
    server/workers/pipeline.py:run_v1.
    """
    requested = (
        inp.get("pipeline_version")
        or os.environ.get("PIPELINE_VERSION")
        or "legacy"
    ).lower()
    if requested not in _VALID_PIPELINE_VERSIONS:
        sys.stderr.write(
            f"[bikeheadz] unknown PIPELINE_VERSION={requested!r}; falling back to legacy\n"
        )
        return "legacy"
    return requested


def handler(job):
    import time as _time
    t_start = _time.perf_counter()
    timings = {}
    job_id = job.get("id") or None
    inp = job.get("input") or {}
    image_b64 = inp.get("image_b64")
    image_sha = None
    if image_b64:
        import hashlib as _h
        image_sha = _h.sha256(image_b64.encode("ascii", errors="ignore")).hexdigest()[:16]
    try:
        if not image_b64:
            yield {"type": "error", "error": "image_b64 required"}
            return

        head_scale = float(inp.get("head_scale", 1.0))
        neck_length_mm = float(inp.get("neck_length_mm", 50.0))  # legacy
        head_tilt_deg = float(inp.get("head_tilt_deg", 0.0))
        shoulder_taper_fraction = float(inp.get("shoulder_taper_fraction", 0.60))
        # Two new sliders — see 3D_Pipeline.md §0. Both are also passed
        # to run_v1 as per-request Constants overrides; defaults match
        # the locked values in pipeline_constants.json.
        target_head_height_mm = inp.get("target_head_height_mm")
        cap_protrusion_fraction = inp.get("cap_protrusion_fraction")
        # Clamp the user-facing knobs so a malformed UI can't break the
        # pipeline (e.g. negative shoulder_taper would cut at a phantom
        # location below z_min).
        shoulder_taper_fraction = max(0.40, min(0.85, shoulder_taper_fraction))
        head_tilt_deg = max(-30.0, min(30.0, head_tilt_deg))
        if target_head_height_mm is not None:
            target_head_height_mm = max(22.0, min(42.0, float(target_head_height_mm)))
        if cap_protrusion_fraction is not None:
            cap_protrusion_fraction = max(0.0, min(0.25, float(cap_protrusion_fraction)))
        seed = int(inp.get("seed", 1))
        pipeline_version = _resolve_pipeline_version(inp)
        sys.stderr.write(f"[bikeheadz] pipeline_version={pipeline_version}\n")

        yield {"type": "progress", "step": "Loading TRELLIS pipeline…", "pct": 10}
        t = _time.perf_counter()
        pipeline = _load_pipeline()
        timings["pipeline_load_ms"] = int((_time.perf_counter() - t) * 1000)

        yield {"type": "progress", "step": "Analyzing facial geometry…", "pct": 30}
        t = _time.perf_counter()
        img = Image.open(io.BytesIO(base64.b64decode(image_b64))).convert("RGB")
        outputs = pipeline.run(img, seed=seed)
        timings["trellis_ms"] = int((_time.perf_counter() - t) * 1000)

        yield {"type": "progress", "step": "Extracting head mesh…", "pct": 65}
        mesh_result = outputs["mesh"][0]
        head = trimesh.Trimesh(
            vertices=np.asarray(mesh_result.vertices),
            faces=np.asarray(mesh_result.faces),
            process=True,
        )
        head.fix_normals()
        timings["raw_head_tris"] = int(len(head.faces))

        # Branch on pipeline_version.
        if pipeline_version == "v1":
            yield {"type": "progress", "step": "Running v1 mesh pipeline…", "pct": 78}
            try:
                from pipeline import run_v1, PipelineError
            except ImportError as e:
                sys.stderr.write(f"[bikeheadz] v1 pipeline not importable: {e}\n")
                _write_failure(job_id, image_b64, code="v1_pipeline_unavailable",
                              stage="import", message=str(e))
                yield {"type": "error", "error": f"v1_pipeline_unavailable: {e}"}
                return
            try:
                t = _time.perf_counter()
                merged = run_v1(
                    head,
                    _VALVE_CAP,
                    _load_negative_core(),
                    head_scale=head_scale,
                    head_tilt_deg=head_tilt_deg,
                    shoulder_taper_fraction=shoulder_taper_fraction,
                    target_head_height_mm=target_head_height_mm,
                    cap_protrusion_fraction=cap_protrusion_fraction,
                    progress=None,  # TODO(Phase 4): thread progress frames out via a queue
                )
                timings["v1_pipeline_ms"] = int((_time.perf_counter() - t) * 1000)
            except PipelineError as e:
                # Surface the error with the user-facing copy and the
                # stable code so the Node side can branch on it. Also
                # write the input to the failure corpus for offline
                # triage (§9.5).
                sys.stderr.write(traceback.format_exc())
                _write_failure(
                    job_id, image_b64,
                    code=e.code.value, stage=e.stage,
                    message=e.detail or str(e),
                    extra={"timings": timings},
                )
                yield e.to_frame()
                return
        else:
            yield {"type": "progress", "step": "Scaling to valve dimensions…", "pct": 78}
            t = _time.perf_counter()
            merged = _merge(head, _VALVE_CAP, head_scale, neck_length_mm, head_tilt_deg)
            timings["legacy_merge_ms"] = int((_time.perf_counter() - t) * 1000)

        yield {"type": "progress", "step": "Exporting STL…", "pct": 92}
        t = _time.perf_counter()
        stl_bytes = merged.export(file_type="stl")
        timings["export_ms"] = int((_time.perf_counter() - t) * 1000)
        timings["final_tris"] = int(len(merged.faces))
        timings["total_ms"] = int((_time.perf_counter() - t_start) * 1000)

        # Single structured log line for the run. §9.5 telemetry schema.
        _emit_telemetry({
            "kind": "stl.generate",
            "outcome": "success",
            "version": pipeline_version,
            "handler_version": HANDLER_VERSION,
            "job_id": job_id,
            "image_sha": image_sha,
            "settings": {
                "head_scale": head_scale,
                "head_tilt_deg": head_tilt_deg,
                "shoulder_taper_fraction": shoulder_taper_fraction,
                "target_head_height_mm": target_head_height_mm,
                "cap_protrusion_fraction": cap_protrusion_fraction,
            },
            "timings": timings,
        })

        yield {
            "type": "result",
            "triangles": int(len(merged.faces)),
            "stl_b64": base64.b64encode(stl_bytes).decode("ascii"),
            "pipeline_version": pipeline_version,
        }
    except Exception as err:  # noqa: BLE001
        sys.stderr.write(traceback.format_exc())
        _write_failure(
            job_id, image_b64,
            code="internal_error", stage="handler",
            message=str(err),
            extra={"timings": timings},
        )
        _emit_telemetry({
            "kind": "stl.generate",
            "outcome": "internal_error",
            "version": pipeline_version if "pipeline_version" in dir() else None,
            "handler_version": HANDLER_VERSION,
            "job_id": job_id,
            "image_sha": image_sha,
            "error": str(err),
            "timings": timings,
        })
        yield {"type": "error", "error": str(err)}


# Register at module import time — RunPod Hub's handler detector scans for
# a top-level `runpod.serverless.start(...)`, so keeping this inside an
# `if __name__ == "__main__":` guard hides it and the Hub checklist stays red.
runpod.serverless.start({
    "handler": handler,
    "return_aggregate_stream": True,
})
