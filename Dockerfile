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
    TORCH_HOME=/runpod-volume/torch \
    HF_HOME=/runpod-volume/hf \
    HUGGINGFACE_HUB_CACHE=/runpod-volume/hf \
    TRANSFORMERS_CACHE=/runpod-volume/hf \
    PYTHONUNBUFFERED=1 \
    TORCH_CUDA_ARCH_LIST="7.0 7.5 8.0 8.6 8.9 9.0+PTX"

# System deps for building CUDA extensions + image/mesh libs at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        build-essential \
        ninja-build \
        libgl1 \
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
    && chmod -R a+rX trellis \
    && echo "=== flexicubes contents ===" \
    && ls -la trellis/representations/mesh/flexicubes/ \
    && test -f trellis/representations/mesh/flexicubes/flexicubes.py \
    && test -f trellis/representations/mesh/flexicubes/tables.py \
    && test -f trellis/representations/mesh/flexicubes/__init__.py

WORKDIR /opt/TRELLIS

# TRELLIS installs its deps by running setup.sh with flags. We let it
# drive, splitting `--basic` (required, let it fail the build) from each
# CUDA extension (individually guarded so a single wheel mismatch
# doesn't kill the image — the worker can still run, just slower).
RUN bash ./setup.sh --basic

RUN bash ./setup.sh --xformers      || echo "[build] xformers install failed; continuing"
RUN bash ./setup.sh --spconv        || echo "[build] spconv install failed; continuing"
RUN bash ./setup.sh --flash-attn    || echo "[build] flash-attn install failed; continuing"
RUN bash ./setup.sh --diffoctreerast || echo "[build] diffoctreerast install failed; continuing"

# Worker-side deps that aren't in setup.sh.
# Pinning huggingface_hub to a modern version where snapshot_download(local_dir=...)
# materialises real files by default — older releases create symlinks into a
# blob hash tree and any partial LFS pull leaves dangling links.
RUN pip install --no-cache-dir runpod "huggingface_hub>=0.30,<1.0"

# App payload.
WORKDIR /app
COPY handler.py /app/handler.py
COPY server/assets/valve_cap.stl /app/valve_cap.stl

# RunPod Serverless imports handler.py and runpod.serverless.start() runs
# at module scope. The explicit CMD is also useful for local smoke tests.
CMD ["python", "-u", "/app/handler.py"]
