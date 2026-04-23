#!/usr/bin/env python3
"""
TRELLIS → valve stem compositor.

Invoked by the Node socket.io server for each `stl.generate` command. Reads a
single JSON config line from stdin, runs Microsoft TRELLIS on the supplied
photo, merges the resulting head mesh on top of the supplied valve cap STL,
and writes the combined ASCII STL to the requested output path. Progress is
streamed back to Node as one JSON object per stdout line; everything else
goes to stderr so it is visible in server logs but not mistaken for progress.

Request format (stdin, one JSON object followed by a newline):
    {
      "image_path":        str,      # photo to stylise as a head
      "valve_cap_path":    str,      # base valve cap STL (fixed geometry)
      "output_path":       str,      # where to write the merged STL
      "head_scale":        float,    # 0.5..1.5
      "neck_length_mm":    float,    # 20..80
      "head_tilt_deg":     float,    # -15..15
      "seed":              int       # TRELLIS seed (optional)
    }

Progress / result frames (stdout, JSON per line):
    {"type": "progress", "step": "Loading pipeline…", "pct": 5}
    {"type": "progress", "step": "Merging with stem base…", "pct": 85}
    {"type": "result",   "path": "<output_path>",  "triangles": 12345}
    {"type": "error",    "error": "<message>"}

Environment:
    TRELLIS_PATH        — directory containing the cloned TRELLIS repo.
                          Added to sys.path when trellis isn't pip-installed.
    TRELLIS_MODEL       — HuggingFace model id (default: microsoft/TRELLIS-image-large)
    TRELLIS_DEVICE      — 'cuda' | 'cpu' (default: cuda if available)
    TRELLIS_ENABLED     — 'false' falls back to a procedural sphere head,
                          useful for CI and GPU-less dev.
"""

from __future__ import annotations

import json
import os
import sys
import traceback
from pathlib import Path

import numpy as np


# ---------------------------------------------------------------------------
# IO helpers
# ---------------------------------------------------------------------------

def emit(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload) + "\n")
    sys.stdout.flush()


def progress(step: str, pct: int) -> None:
    emit({"type": "progress", "step": step, "pct": int(pct)})


def log(msg: str) -> None:
    sys.stderr.write(f"[trellis_generate] {msg}\n")
    sys.stderr.flush()


# ---------------------------------------------------------------------------
# TRELLIS pipeline (lazy import — heavy deps)
# ---------------------------------------------------------------------------

_PIPELINE = None


def _ensure_trellis_on_path() -> None:
    path = os.environ.get("TRELLIS_PATH")
    if path and path not in sys.path:
        sys.path.insert(0, path)


def load_pipeline():
    """Load the Trellis image→3D pipeline. Cached in-process."""
    global _PIPELINE
    if _PIPELINE is not None:
        return _PIPELINE
    _ensure_trellis_on_path()
    os.environ.setdefault("SPCONV_ALGO", "native")
    from trellis.pipelines import TrellisImageTo3DPipeline  # noqa: E402

    model = os.environ.get("TRELLIS_MODEL", "microsoft/TRELLIS-image-large")
    _PIPELINE = TrellisImageTo3DPipeline.from_pretrained(model)

    device = os.environ.get("TRELLIS_DEVICE", "cuda")
    if device == "cuda":
        _PIPELINE.cuda()
    return _PIPELINE


def run_trellis(image_path: str, seed: int):
    """Run TRELLIS and return a trimesh.Trimesh representing the head."""
    from PIL import Image  # noqa: E402
    import trimesh  # noqa: E402

    pipeline = load_pipeline()
    image = Image.open(image_path).convert("RGB")
    outputs = pipeline.run(image, seed=seed)

    # TRELLIS returns several asset types; `mesh` is a list of MeshExtractResult.
    mesh_result = outputs["mesh"][0]
    vertices = np.asarray(mesh_result.vertices)
    faces = np.asarray(mesh_result.faces)

    head = trimesh.Trimesh(vertices=vertices, faces=faces, process=True)
    head.fix_normals()
    return head


# ---------------------------------------------------------------------------
# Fallback head generator — used when TRELLIS_ENABLED=false.
# Produces a UV sphere so the rest of the pipeline can be exercised on CI.
# ---------------------------------------------------------------------------

def procedural_head():
    import trimesh  # noqa: E402
    sphere = trimesh.creation.icosphere(subdivisions=4, radius=1.0)
    # A short cylindrical neck stub so the bottom of the head doesn't hover.
    neck = trimesh.creation.cylinder(radius=0.35, height=0.6, sections=32)
    neck.apply_translation([0, 0, -0.9])
    combined = trimesh.util.concatenate([sphere, neck])
    combined.process()
    return combined


# ---------------------------------------------------------------------------
# Merge head onto the valve cap. The valve cap STL is the source of truth
# for stem geometry — we do not touch its scale. The head is translated so
# its lowest point sits just above the valve cap's top.
# ---------------------------------------------------------------------------

def merge(head, valve, head_scale: float, neck_length_mm: float, head_tilt_deg: float):
    import trimesh  # noqa: E402

    # Orient head so +Z is up.
    head = head.copy()

    # Normalise the head's bounding box to unit scale (largest dim = 1) then
    # apply the user's head_scale. We clamp to sensible bounds so bogus inputs
    # don't produce kilometre-tall prints.
    bb = head.extents
    longest = float(max(bb)) or 1.0
    head.apply_scale(1.0 / longest)

    # Target head diameter: roughly 1.6× the top diameter of the valve cap.
    valve_top_z = float(valve.bounds[1][2])
    valve_top_slab = valve.slice_plane(
        plane_origin=[0, 0, valve_top_z - 0.5],
        plane_normal=[0, 0, -1],
    )
    if valve_top_slab is not None and len(valve_top_slab.vertices):
        top_bb = valve_top_slab.extents
        top_diameter = max(float(top_bb[0]), float(top_bb[1]))
    else:
        top_diameter = max(float(valve.extents[0]), float(valve.extents[1])) * 0.3
    head_target_diameter = max(top_diameter * 1.6, 6.0) * float(head_scale)
    head.apply_scale(head_target_diameter)

    # Tilt the head forward/back around the Y axis.
    if head_tilt_deg:
        rot = trimesh.transformations.rotation_matrix(
            np.deg2rad(head_tilt_deg), [0, 1, 0], point=head.centroid
        )
        head.apply_transform(rot)

    # Drop the head so its bottom sits `neck_length_mm` above the valve top.
    head_min_z = float(head.bounds[0][2])
    lift = valve_top_z + float(neck_length_mm) * 0.5 - head_min_z
    head.apply_translation([0, 0, lift])

    combined = trimesh.util.concatenate([valve, head])
    combined.process()
    return combined


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

def main() -> int:
    try:
        raw = sys.stdin.readline()
        if not raw:
            emit({"type": "error", "error": "empty_stdin"})
            return 1
        cfg = json.loads(raw)

        image_path = cfg["image_path"]
        valve_cap_path = cfg["valve_cap_path"]
        output_path = cfg["output_path"]
        head_scale = float(cfg.get("head_scale", 1.0))
        neck_length_mm = float(cfg.get("neck_length_mm", 50.0))
        head_tilt_deg = float(cfg.get("head_tilt_deg", 0.0))
        seed = int(cfg.get("seed", 1))

        trellis_enabled = os.environ.get("TRELLIS_ENABLED", "true").lower() != "false"

        progress("Loading valve cap base…", 5)
        import trimesh  # noqa: E402
        valve = trimesh.load_mesh(valve_cap_path)
        if isinstance(valve, trimesh.Scene):
            valve = trimesh.util.concatenate(tuple(valve.geometry.values()))

        if trellis_enabled:
            progress("Loading TRELLIS pipeline…", 15)
            load_pipeline()
            progress("Analyzing facial geometry…", 30)
            head = run_trellis(image_path, seed)
            progress("Extracting head mesh…", 65)
        else:
            progress("Generating placeholder head (TRELLIS disabled)…", 40)
            head = procedural_head()

        progress("Scaling to valve dimensions…", 78)
        merged = merge(head, valve, head_scale, neck_length_mm, head_tilt_deg)

        progress("Exporting STL…", 92)
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        merged.export(output_path, file_type="stl")

        emit({"type": "result", "path": output_path, "triangles": int(len(merged.faces))})
        return 0
    except Exception as err:  # noqa: BLE001 — top-level safety net
        log(traceback.format_exc())
        emit({"type": "error", "error": str(err)})
        return 1


if __name__ == "__main__":
    sys.exit(main())
