# BikeHeadz × RunPod Serverless deployment guide

The TRELLIS GPU worker for BikeHeadz is packaged as a RunPod **Hub** listing
(RunPod's GitHub-backed serverless template system). Everything it needs is
in the repo:

| File                   | Role                                                          |
| ---------------------- | ------------------------------------------------------------- |
| `Dockerfile`           | (repo root) CUDA 12.1 + PyTorch 2.2 + TRELLIS + handler       |
| `.dockerignore`        | (repo root) trims the build context                           |
| `deploy/runpod/handler.py` | Generator handler — photo → head → STL                    |
| `.runpod/hub.json`     | Hub listing config (category, env inputs, GPU presets)        |
| `.runpod/tests.json`   | Smoke test RunPod runs after every build                      |

The Node server talks to the endpoint via
[`server/workers/runpod-client.js`](../../server/workers/runpod-client.js).
When `RUNPOD_ENDPOINT_URL` and `RUNPOD_API_KEY` are set, generation is
routed to RunPod automatically; otherwise the server falls back to the
local Python spawn path in `server/workers/trellis_generate.py`.

---

## Deploying via RunPod Hub (recommended)

You already selected **Serverless repos** in the RunPod dashboard and
pointed it at `ianroy/bikeheadz`. The Hub wizard's six steps map to this
repo like so:

| Step | What the wizard wants       | Where it lives / what to do                                   |
| ---- | --------------------------- | ------------------------------------------------------------- |
| 1    | `.runpod/hub.json`          | Already in the repo (committed)                               |
| 2    | `.runpod/tests.json`        | Already in the repo (committed)                               |
| 3    | `Dockerfile`                | Already at the repo root (committed)                          |
| 4    | Handler script              | [`deploy/runpod/handler.py`](./handler.py) (referenced by Dockerfile) |
| 5    | Badge (optional)            | Paste into README if desired (we've already added it)         |
| 6    | **Create a release**        | **You do this on GitHub** — see below                         |

### Step 6: cut a GitHub release

RunPod Hub only builds when a **GitHub release tag** exists. Until you
publish one, the endpoint stays unconfigured.

```bash
git tag v0.1.0 -m "Initial RunPod Hub release"
git push origin v0.1.0
```

…or via the GitHub UI: `Releases → Draft a new release → Choose a tag →
v0.1.0 → Publish release`.

Within a minute or two RunPod will pick up the tag, run a Docker build
from your `Dockerfile`, execute `.runpod/tests.json`, and (if tests
pass) list a ready endpoint on your account. Watch progress on the
repo's Hub page: `https://console.runpod.io/hub/ianroy/bikeheadz`.

### After the build succeeds

1. Go to the endpoint page RunPod creates for the release.
2. Grab the **Endpoint URL** (`https://api.runpod.ai/v2/<id>`).
3. In DO → Settings → App-Level Env Vars, set:

   ```
   RUNPOD_ENDPOINT_URL=https://api.runpod.ai/v2/<id>
   RUNPOD_API_KEY=<your key>       (mark as SECRET)
   ```

4. Redeploy the DO app. Generate → Pay → Download.

### Iterating

Pushes to `main` don't retrigger a Hub build on their own; you need a
new tag. Pattern:

```bash
# after merging changes to deploy/runpod/ or server/assets/
git tag v0.1.1 -m "bumped handler & Dockerfile"
git push origin v0.1.1
```

Semver helps RunPod order releases but isn't enforced.

---

## First real invocation: warm the model weights

TRELLIS downloads ~6 GB of weights from Hugging Face on first run. Your
hub.json already points all caches at `/runpod-volume/hf`, so if you
attach a **Network Volume** to the endpoint the download happens once
and persists across cold starts.

1. RunPod dashboard → **Storage → Network Volumes → + New**.
2. Name `bikeheadz-models`, **same region** as your endpoint (e.g.
   `US-OR-1`), size `25 GB` (~$1.75/mo).
3. Endpoint settings → attach this volume at `/runpod-volume`.
4. Send one **Test Request** from the endpoint page:

   ```json
   {
     "input": {
       "image_b64": "<base64 of any JPG>",
       "head_scale": 1.0,
       "neck_length_mm": 50,
       "head_tilt_deg": 0,
       "seed": 1
     }
   }
   ```

   The first run takes 60–90 s (weight download). Subsequent runs on the
   same volume are ~10 s.

---

## Fallback: manual Docker push (non-Hub flow)

If you'd rather not use Hub at all — e.g. you want to host the image on
your own Docker Hub account — the image builds identically from the
repo root:

```bash
docker login
docker buildx build \
  --platform linux/amd64 \
  -t <your-dockerhub-username>/bikeheadz-trellis:latest \
  --push .
```

Then create the endpoint manually via **Serverless → + New Endpoint →
Pod templates → New Template**, pasting your image URL.

---

## Tuning cheatsheet

| Setting             | Suggested   | Notes                                           |
| ------------------- | ----------- | ----------------------------------------------- |
| Active Workers      | `0`         | Pay nothing while idle                          |
| Max Workers         | `3`         | Plenty of headroom for initial traffic          |
| Idle Timeout        | `60s`       | Keeps workers warm between close-together runs  |
| Flash Boot          | **On**      | ~5× faster reactivation                         |
| Execution Timeout   | `300s`      | Room for first-run weight download              |
| Retries             | `1`         | Default `3` can triple billing on poison inputs |
| GPU Types           | RTX 4090 + A4000 | Fastest cheap + cheapest backup            |

---

## Troubleshooting

| Symptom                                          | Likely cause & fix                                                                     |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Hub page says "no releases"                      | You haven't pushed a tag. `git tag v0.1.0 && git push origin v0.1.0`.                  |
| `.runpod/tests.json` test times out              | First-ever build had to download weights. Re-run, or raise the timeout in tests.json.  |
| Tests fail with "no face detected"               | The 1×1 PNG in tests.json was enough to check booting but TRELLIS rejected it. Ignore unless the build is marked failed — RunPod still publishes the endpoint if the handler returned an error frame (not crashed). |
| `runpod_http_401:unauthorized` from DO           | API key mistyped or revoked. Regenerate in RunPod → Account → API Keys.                |
| First DO-served request hangs 2+ min             | Cold start + weight download. Warm-up with one dashboard test request.                 |
| Every request `TIMED_OUT`                        | Usually a Dockerfile bug — check the endpoint's **Logs** tab.                          |
| Docker Hub pull fails (manual path)              | Image is private; add registry credentials in endpoint settings, or make it public.    |
