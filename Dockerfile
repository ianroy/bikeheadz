# BikeHeadz — TRELLIS worker image for RunPod Serverless.
#
# Lives at the repo root because:
#   (a) RunPod Hub (.runpod/hub.json) expects `Dockerfile` at the root.
#   (b) The build context needs to reach `server/assets/valve_cap.stl`
#       and `handler.py` — both repo-relative paths.
# Manual build (non-Hub path, from the repo root):
#   docker buildx build --platform linux/amd64 \
#     -t <your-registry>/bikeheadz-trellis:latest --push .
#
# Base: official pytorch/pytorch image at the exact torch/CUDA combo
# that TRELLIS's setup.sh has hard-coded wheel URLs for (torch 2.4.0 +
# CUDA 12.1 → xformers 0.0.27.post2, kaolin cu121, etc). Deviating from
# this forces setup.sh into "Unsupported PyTorch version" fallbacks.

FROM pytorch/pytorch:2.4.0-cuda12.1-cudnn9-devel

ENV DEBIAN_FRONTEND=noninteractive \
    PIP_NO_CACHE_DIR=1 \
    SPCONV_ALGO=native \
    ATTN_BACKEND=xformers \
    SPARSE_ATTN_BACKEND=xformers \
    TORCH_HOME=/runpod-volume/torch \
    HF_HOME=/runpod-volume/hf \
    HUGGINGFACE_HUB_CACHE=/runpod-volume/hf \
    TRANSFORMERS_CACHE=/runpod-volume/hf \
    PYTHONUNBUFFERED=1 \
    TORCH_CUDA_ARCH_LIST="7.0 7.5 8.0 8.6 8.9 9.0+PTX"

# System deps for building CUDA extensions + image/mesh libs at runtime.
#
# pymeshlab's filter plugins are dlopen'd at MeshSet construction. The
# `meshing_*` family (incl. meshing_close_holes used by Stage 1.5) lives
# in libfilter_meshing.so, which has a hard link against libOpenGL.so.0.
# That symbol comes from `libopengl0` (the GLVND demux library), NOT
# from libgl1. Without it, pymeshlab silently registers a MeshSet with
# the meshing-family attributes missing → AttributeError at runtime.
# `libegl1` is its peer and is sometimes pulled in by the same
# transitive dlopen path.
RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        build-essential \
        ninja-build \
        libgl1 \
        libopengl0 \
        libegl1 \
        libglib2.0-0 \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Clone TRELLIS WITH submodules. `flexicubes` (mesh extraction) is a
# submodule pointing at MaxtirError/FlexiCubes; without it, the worker
# fails at runtime with
#   No module named 'trellis.representations.mesh.flexicubes.flexicubes'.
#
# Two layers of safety:
#   1. Explicit `git submodule update --init --recursive` after the
#      clone, in case `--recurse-submodules` silently noops on a
#      shallow clone.
#   2. `touch __init__.py` so Python treats the submodule directory as
#      a package — FlexiCubes upstream doesn't ship one, so the import
#      `trellis.representations.mesh.flexicubes.flexicubes` would still
#      fail even with all files present.
WORKDIR /opt
# Clone TRELLIS, init flexicubes submodule, give it a package marker, and
# verify the file layout. We deliberately DON'T run a Python import test
# here — TRELLIS's __init__.py transitively imports easydict and other
# deps that aren't installed until setup.sh --basic runs in the next
# layer. file-presence is enough proof; the import test happens
# implicitly when the pipeline loads at runtime.
RUN git clone --depth 1 https://github.com/Microsoft/TRELLIS.git \
    && cd TRELLIS \
    && git submodule update --init --recursive --depth 1 \
    && touch trellis/representations/mesh/flexicubes/__init__.py \
    && find trellis -type d -not -path '*/\.*' \
        -exec sh -c '[ ! -f "$0/__init__.py" ] && touch "$0/__init__.py" && echo "[init] created $0/__init__.py" || true' {} \; \
    && chmod -R a+rX trellis \
    && echo "=== flexicubes contents ===" \
    && ls -la trellis/representations/mesh/flexicubes/ \
    && test -f trellis/representations/mesh/flexicubes/flexicubes.py \
    && test -f trellis/representations/mesh/flexicubes/tables.py \
    && test -f trellis/representations/mesh/flexicubes/__init__.py \
    && test -f trellis/modules/__init__.py

WORKDIR /opt/TRELLIS

# TRELLIS installs its deps by running setup.sh with flags. We let it
# drive, splitting `--basic` (required, let it fail the build) from each
# CUDA extension (individually guarded so a single wheel mismatch
# doesn't kill the image — the worker can still run, just slower).
RUN bash ./setup.sh --basic

RUN bash ./setup.sh --xformers      || echo "[build] xformers install failed; continuing"
# setup.sh's xformers logic does case "$PYTORCH_VERSION" in 2.4.0)... but
# `python -c "import torch; print(torch.__version__)"` returns
# `2.4.0+cu121` on cuda images, never matching the case. Force-install
# the right wheel directly.
RUN pip install --no-cache-dir "xformers==0.0.27.post2" --index-url https://download.pytorch.org/whl/cu121 \
    || pip install --no-cache-dir "xformers==0.0.27.post2" \
    || pip install --no-cache-dir "xformers" \
    || echo "[build] direct xformers install also failed"
RUN bash ./setup.sh --spconv        || echo "[build] spconv install failed; continuing"
# Same case-mismatch trap as xformers/kaolin — setup.sh's PYTORCH_VERSION case
# matches "2.4.0" literally but torch.__version__ is "2.4.0+cu121", so the
# spconv-cu121 wheel never installs. decoder_mesh.py builds SparseSubdivideBlock3d
# which calls sp.SparseConv3d, which imports spconv.pytorch — fatal at runtime
# without this. Pin to spconv-cu121 to match the cuda 12.1 base image.
RUN pip install --no-cache-dir spconv-cu121 \
    || pip install --no-cache-dir spconv \
    || echo "[build] direct spconv install also failed"
RUN bash ./setup.sh --flash-attn    || echo "[build] flash-attn install failed; continuing"
RUN bash ./setup.sh --diffoctreerast || echo "[build] diffoctreerast install failed; continuing"
# Mesh / Gaussian Splatting / radiance-field decoders need these. setup.sh
# has the right wheel URLs for torch 2.4.0 + cu121 specifically. Each is a
# CUDA extension build, so allow individual failures rather than killing
# the image.
RUN bash ./setup.sh --kaolin        || echo "[build] kaolin install failed; continuing"
# Same trap as xformers — setup.sh's PYTORCH_VERSION case matches "2.4.0"
# literally, but torch.__version__ on the cuda image is "2.4.0+cu121",
# so the wheel URL never fires. flexicubes.py:17 does
#   `from kaolin.utils.testing import check_tensor`
# unconditionally, so without kaolin every mesh decoder breaks.
RUN pip install --no-cache-dir kaolin -f https://nvidia-kaolin.s3.us-east-2.amazonaws.com/torch-2.4.0_cu121.html \
    || pip install --no-cache-dir kaolin \
    || echo "[build] direct kaolin install also failed"
RUN bash ./setup.sh --nvdiffrast    || echo "[build] nvdiffrast install failed; continuing"
# Same case-mismatch trap as xformers/kaolin/spconv — setup.sh's --nvdiffrast
# branch falls through to "Unsupported PyTorch version" because of the
# "2.4.0" vs "2.4.0+cu121" mismatch. nvdiffrast is needed by the mesh
# decoder's nvdiffrast_context.py; without it, mesh extraction warns
# "Cannot import nvdiffrast" and downstream rendering fails.
RUN pip install --no-cache-dir "git+https://github.com/NVlabs/nvdiffrast.git" \
    || pip install --no-cache-dir nvdiffrast \
    || echo "[build] direct nvdiffrast install also failed"
RUN bash ./setup.sh --mipgaussian   || echo "[build] mipgaussian install failed; continuing"

# Best-effort install of common TRELLIS-internal deps that aren't always
# pulled in by setup.sh --basic. plyfile is needed by representations.gaussian;
# diff-gaussian-rasterization is the CUDA extension setup.sh's --mipgaussian
# tries to install (we install it again here in case mip-splatting build
# failed but the standalone wheel works).
RUN pip install --no-cache-dir plyfile || echo "[build] plyfile install failed"
RUN pip install --no-cache-dir "git+https://github.com/graphdeco-inria/diff-gaussian-rasterization.git" \
    || echo "[build] diff-gaussian-rasterization install failed"

# Worker-side deps that aren't in setup.sh.
# (NOTE: don't aggressively pin huggingface_hub — transformers depends on the
# version setup.sh resolved, and bumping HF beyond ~0.25 breaks
# `is_offline_mode` lookups inside transformers.)
RUN pip install --no-cache-dir runpod

# pillow-heif registers libheif as a Pillow plugin so iPhone-default
# HEIC/HEIF uploads decode without the user converting to JPEG. handler.py
# guards the import behind try/except so build-failure here is non-fatal,
# but iPhone uploads will fail until this is healthy.
RUN pip install --no-cache-dir "pillow-heif>=0.18" \
    || echo "[build] pillow-heif install failed (HEIC inputs will be rejected)"

# v1 mesh-pipeline deps — the seven-stage pipeline at /app/pipeline runs
# CPU-side after TRELLIS finishes. Per 3D_Pipeline.md §7 bill of
# materials. Pinned ranges, not specific versions, since these are
# stable enough that minor bumps shouldn't break the worker.
RUN pip install --no-cache-dir \
        "manifold3d>=3.4,<4" \
        "fast-simplification>=0.1,<0.2" \
    || echo "[build] v1 pipeline deps install failed"
# pymeshlab is GPL v3 (§7 license caveat) — install but the pipeline
# uses it behind a try/except, falls back to trimesh.repair for users
# who'd rather not ship MeshLab in their image. Allow failure.
RUN pip install --no-cache-dir "pymeshlab>=2025.7" \
    || echo "[build] pymeshlab install failed (pipeline falls back to trimesh.repair)"

# App payload.
WORKDIR /app
COPY handler.py /app/handler.py
# v1 pipeline assets — both STLs go to /app so handler.py can load them
# at the same paths the local fallback worker uses.
COPY server/assets/valve_cap.stl /app/valve_cap.stl
COPY server/assets/negative_core.stl /app/negative_core.stl
# Calibration constants generated by tools/calibrate_pipeline.py.
# pipeline.constants.get() reads /app/pipeline_constants.json on the
# RunPod worker; the legacy path doesn't touch this file.
COPY server/assets/pipeline_constants.json /app/pipeline_constants.json
# v1 pipeline package. Imported by handler.py's v1 branch.
COPY server/workers/pipeline /app/pipeline

# RunPod Serverless imports handler.py and runpod.serverless.start() runs
# at module scope. The explicit CMD is also useful for local smoke tests.
CMD ["python", "-u", "/app/handler.py"]
