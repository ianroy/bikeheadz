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

# Version banner — prints unconditionally at module load time so we can
# tell from the worker logs whether the running container is actually
# the image tag we think it is.
HANDLER_VERSION = "v0.1.14"
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
    snapshot_download(
        repo_id=TRELLIS_MODEL,
        local_dir=local_dir,
        token=os.environ.get("HF_TOKEN"),
        max_workers=4,
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


_VALVE_CAP = _load_valve_cap()


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


def handler(job):
    inp = job.get("input") or {}
    try:
        image_b64 = inp.get("image_b64")
        if not image_b64:
            yield {"type": "error", "error": "image_b64 required"}
            return

        head_scale = float(inp.get("head_scale", 1.0))
        neck_length_mm = float(inp.get("neck_length_mm", 50.0))
        head_tilt_deg = float(inp.get("head_tilt_deg", 0.0))
        seed = int(inp.get("seed", 1))

        yield {"type": "progress", "step": "Loading TRELLIS pipeline…", "pct": 10}
        pipeline = _load_pipeline()

        yield {"type": "progress", "step": "Analyzing facial geometry…", "pct": 30}
        img = Image.open(io.BytesIO(base64.b64decode(image_b64))).convert("RGB")
        outputs = pipeline.run(img, seed=seed)

        yield {"type": "progress", "step": "Extracting head mesh…", "pct": 65}
        mesh_result = outputs["mesh"][0]
        head = trimesh.Trimesh(
            vertices=np.asarray(mesh_result.vertices),
            faces=np.asarray(mesh_result.faces),
            process=True,
        )
        head.fix_normals()

        yield {"type": "progress", "step": "Scaling to valve dimensions…", "pct": 78}
        merged = _merge(head, _VALVE_CAP, head_scale, neck_length_mm, head_tilt_deg)

        yield {"type": "progress", "step": "Exporting STL…", "pct": 92}
        stl_bytes = merged.export(file_type="stl")

        yield {
            "type": "result",
            "triangles": int(len(merged.faces)),
            "stl_b64": base64.b64encode(stl_bytes).decode("ascii"),
        }
    except Exception as err:  # noqa: BLE001
        sys.stderr.write(traceback.format_exc())
        yield {"type": "error", "error": str(err)}


# Register at module import time — RunPod Hub's handler detector scans for
# a top-level `runpod.serverless.start(...)`, so keeping this inside an
# `if __name__ == "__main__":` guard hides it and the Hub checklist stays red.
runpod.serverless.start({
    "handler": handler,
    "return_aggregate_stream": True,
})
