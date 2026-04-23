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
# Notes:
# - We deliberately skip TRELLIS's interactive ./setup.sh and install only
#   the pip-installable bits. If a requirement fails to build on first
#   deploy, iterate here rather than inside the serverless container.
# - Flash-attn pins are CUDA/PyTorch-sensitive; the values below match the
#   base image. If you change the base tag, re-verify compatibility on the
#   flash-attn release page.

FROM runpod/pytorch:2.2.0-py3.11-cuda12.1.1-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PIP_NO_CACHE_DIR=1 \
    SPCONV_ALGO=native \
    TORCH_HOME=/runpod-volume/torch \
    HF_HOME=/runpod-volume/hf \
    HUGGINGFACE_HUB_CACHE=/runpod-volume/hf \
    TRANSFORMERS_CACHE=/runpod-volume/hf \
    PYTHONUNBUFFERED=1

# System deps. libgl1 + libglib2.0-0 satisfy Pillow/OpenCV; ninja + build-essential
# are needed for flash-attn / spconv wheels to compile if prebuilt ones are missed.
RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        build-essential \
        ninja-build \
        libgl1 \
        libglib2.0-0 \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Clone TRELLIS. Pinning a sha keeps builds reproducible; update as upstream moves.
WORKDIR /opt
RUN git clone --depth 1 https://github.com/Microsoft/TRELLIS.git

# Python deps. Install TRELLIS's own requirements first, then the extras the
# inference path needs. `--no-build-isolation` for flash-attn uses the outer
# torch; saves 3+ GB of duplicated build env.
WORKDIR /opt/TRELLIS
RUN pip install --upgrade pip setuptools wheel \
    && pip install -r requirements.txt \
    && pip install "xformers==0.0.27.post2" \
    && pip install "spconv-cu121" \
    && pip install "flash-attn==2.7.0.post2" --no-build-isolation \
    && pip install runpod trimesh pillow numpy

# App payload.
WORKDIR /app
COPY handler.py /app/handler.py
COPY server/assets/valve_cap.stl /app/valve_cap.stl

# RunPod Serverless imports and calls `handler`, but starting explicitly lets
# you smoke-test the image locally with `docker run --gpus all <img>`.
CMD ["python", "-u", "/app/handler.py"]
