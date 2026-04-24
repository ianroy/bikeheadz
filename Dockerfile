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
# Base: official pytorch/pytorch devel image — pre-built CUDA 12.1 + PyTorch
# 2.1.2 + Python 3.10 that actually exists on Docker Hub (unlike the
# made-up runpod/pytorch tag the first draft tried). flash-attn is added
# as a best-effort step so a wheel mismatch doesn't kill the whole build.

FROM pytorch/pytorch:2.1.2-cuda12.1-cudnn8-devel

ENV DEBIAN_FRONTEND=noninteractive \
    PIP_NO_CACHE_DIR=1 \
    SPCONV_ALGO=native \
    TORCH_HOME=/runpod-volume/torch \
    HF_HOME=/runpod-volume/hf \
    HUGGINGFACE_HUB_CACHE=/runpod-volume/hf \
    TRANSFORMERS_CACHE=/runpod-volume/hf \
    PYTHONUNBUFFERED=1

# System deps. libgl1 + libglib2.0-0 satisfy Pillow/OpenCV; ninja + build-essential
# are needed if pip falls back to source builds.
RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        build-essential \
        ninja-build \
        libgl1 \
        libglib2.0-0 \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Clone TRELLIS. `--depth 1` keeps the layer small.
WORKDIR /opt
RUN git clone --depth 1 https://github.com/Microsoft/TRELLIS.git

# Python deps. TRELLIS's own requirements first, then acceleration extras.
# flash-attn is wheel-only here (`--no-build-isolation` lets it reuse the
# outer torch) and wrapped in `|| true` so an incompatible wheel for the
# base image's exact CUDA/torch combo doesn't break the image — TRELLIS
# still runs without it, just slower.
WORKDIR /opt/TRELLIS
RUN pip install --upgrade pip setuptools wheel \
    && pip install -r requirements.txt \
    && pip install xformers \
    && pip install spconv-cu121 \
    && (pip install flash-attn --no-build-isolation || echo "flash-attn wheel unavailable; continuing without") \
    && pip install runpod trimesh pillow numpy

# App payload.
WORKDIR /app
COPY handler.py /app/handler.py
COPY server/assets/valve_cap.stl /app/valve_cap.stl

# RunPod Serverless imports and starts the handler at module scope; the
# explicit CMD lets you smoke-test the image locally too.
CMD ["python", "-u", "/app/handler.py"]
