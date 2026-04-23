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

VALVE_CAP_PATH = os.environ.get("VALVE_CAP_PATH", "/app/valve_cap.stl")
TRELLIS_MODEL = os.environ.get("TRELLIS_MODEL", "microsoft/TRELLIS-image-large")

# ---- Module-level, loaded once per warm worker -----------------------------

_PIPELINE = None


def _load_pipeline():
    global _PIPELINE
    if _PIPELINE is not None:
        return _PIPELINE
    from trellis.pipelines import TrellisImageTo3DPipeline  # heavy
    _PIPELINE = TrellisImageTo3DPipeline.from_pretrained(TRELLIS_MODEL)
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
