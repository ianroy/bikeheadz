# BikeHeadz × RunPod Serverless deployment guide

This directory contains everything the TRELLIS GPU worker needs on RunPod:

| File            | Role                                                          |
| --------------- | ------------------------------------------------------------- |
| `Dockerfile`    | Container image with CUDA 12.1, PyTorch 2.2, TRELLIS deps     |
| `handler.py`    | RunPod Serverless generator handler — photo → head → STL      |
| `.dockerignore` | Keeps the build context lean (repo root is the context)       |

The Node server talks to the endpoint via
[`server/workers/runpod-client.js`](../../server/workers/runpod-client.js).
When `RUNPOD_ENDPOINT_URL` and `RUNPOD_API_KEY` are set, generation is
routed to RunPod automatically; otherwise the server falls back to the
local Python spawn path in `server/workers/trellis_generate.py`.

---

## Next steps on your side

You've already got a RunPod account and an API key. Remaining steps:

### 1. Push the image to a registry

RunPod can pull from Docker Hub, GHCR, or a private RunPod registry.
Docker Hub is simplest.

```bash
# From the repo root (important — the Dockerfile COPYs from server/assets)
docker login
docker buildx build \
  --platform linux/amd64 \
  -f deploy/runpod/Dockerfile \
  -t <your-dockerhub-username>/bikeheadz-trellis:latest \
  --push .
```

On Apple Silicon, `--platform linux/amd64` is mandatory (RunPod GPUs are
x86_64). The first build takes 10–15 min mostly because of `flash-attn`
compiling. Later builds are fast thanks to layer caching.

> **If a build step fails on TRELLIS / flash-attn**: iterate on the
> Dockerfile. The most common culprits are CUDA/PyTorch/flash-attn
> version drift. Pin to known-good combinations (or try
> `runpod/pytorch:2.1.0-py3.11-cuda12.1.0-devel-ubuntu22.04` which has
> more prebuilt wheels). Errors compiling extensions inside the image
> almost always mean the base CUDA doesn't match what the extension
> expects.

### 2. Create a Network Volume for model weights

TRELLIS downloads ~6 GB of model weights from HuggingFace on first run. A
Network Volume persists them across cold starts for cents per month.

1. RunPod dashboard → **Storage → Network Volumes → + New**.
2. Name: `bikeheadz-models`.
3. Datacenter: pick the **same region** you'll deploy the endpoint in
   (e.g. `US-OR-1`). RunPod won't mount a volume from a different region.
4. Size: **25 GB** (plenty of headroom for TRELLIS + future models).
5. Create. Cost: ~$1.75/month.

The Dockerfile already points all HF/PyTorch caches at
`/runpod-volume/…` so mounting this volume at `/runpod-volume` is the
only wiring needed.

### 3. Create the Serverless Endpoint

Dashboard → **Serverless → + New Endpoint**.

| Field                | Value                                                     |
| -------------------- | --------------------------------------------------------- |
| Name                 | `bikeheadz-trellis`                                       |
| Container Image      | `<your-dockerhub-username>/bikeheadz-trellis:latest`      |
| Container Registry Credentials | (none for public Docker Hub repo)               |
| Container Disk       | `20 GB`                                                   |
| Network Volume       | `bikeheadz-models` mounted at `/runpod-volume`            |
| GPU Types            | ✅ `RTX 4090` (preferred) · ✅ `RTX A4000` (fallback)       |
| Active Workers (min) | `0`                                                       |
| Max Workers          | `3`                                                       |
| Idle Timeout         | `60` seconds                                              |
| Flash Boot           | **On**                                                    |
| Execution Timeout    | `300` seconds (cold-start insurance)                      |
| Scaler Type          | Request Count                                             |
| Scaler Value         | `1` (one concurrent request per worker)                   |
| Env Variables        | _(none required; add `TRELLIS_MODEL=` to override model)_ |

Hit **Deploy**. RunPod will pull the image and warm-test it. First pull
is slow (~3 min). When status is `Ready`, copy:

- **Endpoint ID** — shown as `Endpoint: <id>` at the top.
- **API URL** — clickable, it's
  `https://api.runpod.ai/v2/<endpoint-id>`.

### 4. Warm the network volume once

The very first real invocation downloads TRELLIS weights into
`/runpod-volume/hf`. You don't want a paying user to wait for that. Burn
one hot invocation now:

**Option A — dashboard**:
Endpoint → **Requests → + Send Test Request** → paste:

```json
{
  "input": {
    "image_b64": "<paste base64 of any JPG here>",
    "head_scale": 1.0,
    "neck_length_mm": 50,
    "head_tilt_deg": 0,
    "seed": 1
  }
}
```

Click **Send**. Watch logs. The first run writes weights to the volume
(60–90 s). Subsequent runs on the same volume are ~10 s.

**Option B — terminal**:

```bash
IMG_B64=$(base64 -i path/to/selfie.jpg)
curl -X POST https://api.runpod.ai/v2/<ENDPOINT_ID>/runsync \
  -H "Authorization: Bearer $RUNPOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"input\":{\"image_b64\":\"$IMG_B64\",\"head_scale\":1}}"
```

`runsync` blocks until the job completes — handy for CI-style smoke
tests. Expect a `~/tmp` 1-minute wait on first run, ~10s thereafter.

### 5. Point the DO App Platform at the endpoint

In DO dashboard → your app → **Settings → App-Level Environment
Variables**, add as **Secret**:

```
RUNPOD_API_KEY=<the key you created>
RUNPOD_ENDPOINT_URL=https://api.runpod.ai/v2/<endpoint-id>
```

(You already did this — verify the URL exactly matches the endpoint
page, no trailing slash.)

### 6. Redeploy DO and test end-to-end

Trigger a fresh deploy (push a commit or use the "Deploy" button). Then:

1. Open your production URL.
2. Upload a photo, click **Generate**.
3. Watch progress frames advance — they should read "Loading TRELLIS
   pipeline… → Analyzing facial geometry… → … → Exporting STL".
4. Pay $2 with Stripe test card `4242 4242 4242 4242`.
5. STL downloads.

Cross-check in RunPod dashboard → Endpoint → **Requests** — you should
see the job and its per-frame log output.

---

## Tuning

### Cold start vs cost

| `min_workers` | Pay | Cold-start risk for users |
| ------------- | --- | ------------------------- |
| `0` (current) | $0 when idle | First request after 60 s idle waits ~40 s |
| `1` | ~$144/mo on RTX 4090 | None (always hot) |

Start at `0`. Upgrade to `1` if the first-hit latency costs conversions.

### Choose a cheaper GPU

The handler runs fine on RTX A4000 (~$0.20/hr instead of $0.44/hr for
RTX 4090). Inference is ~2× slower. Flip the dashboard dropdown to
A4000-only if cost pressure beats speed.

### Execution timeout

300 s is generous. Real inference is 10–40 s. If you see `TIMED_OUT`
jobs it's almost always a misbehaving handler — check the **Logs** tab.

### Retry behaviour

By default RunPod retries failed jobs 3×. For a billing-sensitive app
this can triple cost on a poison request. Drop retries to **1** in the
endpoint settings.

---

## Local smoke test (optional)

You need an NVIDIA GPU with CUDA 12.1 drivers and Docker with the
NVIDIA Container Toolkit.

```bash
docker buildx build --load --platform linux/amd64 \
  -f deploy/runpod/Dockerfile \
  -t bikeheadz-trellis:dev .

docker run --rm --gpus all -p 8000:8000 \
  -e RUNPOD_DEBUG=1 \
  bikeheadz-trellis:dev
```

RunPod's `runpod` Python SDK doesn't expose a local dev server out of
the box — the image runs the handler module. For local iteration of
just the merge logic use `server/workers/trellis_generate.py` with
`TRELLIS_ENABLED=false`.

---

## Troubleshooting

| Symptom                                          | Likely cause & fix                                                                     |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `runpod_http_401:unauthorized`                   | API key mistyped or revoked. Regenerate in Account → API Keys.                         |
| `runpod_start_failed:{"error":"endpoint not found"}` | Wrong endpoint ID, or endpoint deleted.                                            |
| First request hangs for 2+ min                   | Cold start + weight download. Do the warm-up in step 4; subsequent runs are fast.      |
| Every request `TIMED_OUT`                        | Usually a Dockerfile bug — check endpoint Logs. Common: missing CUDA ext or OOM.       |
| Jobs complete but STL is empty                   | TRELLIS returned 0 faces; check the input image is a front-facing face.                |
| Progress frames never arrive                     | `return_aggregate_stream` not set, or client hitting `/runsync` instead of `/run`.     |
| Docker Hub pull fails on deploy                  | Image is private; add registry credentials in endpoint settings OR make it public.     |
