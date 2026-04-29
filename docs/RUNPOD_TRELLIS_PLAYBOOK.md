# RunPod × TRELLIS playbook

Battle-tested patterns for shipping a TRELLIS image-to-3D handler on
RunPod Serverless. Everything here was learned the expensive way during
the v0.1.27 → v0.1.34 stabilization run on valveheadz; future agents
should read this **before** touching `handler.py` or `Dockerfile`.

If a single rule had to survive: **don't trust the success path until
you've watched the bytes arrive in the browser.** Every layer between
your generator and the user's network has its own size cap, its own
buffering behavior, and its own way of failing silently.

---

## Contents

1. [The architecture you're actually running](#1-the-architecture-youre-actually-running)
2. [The version-banner discipline](#2-the-version-banner-discipline)
3. [Result delivery — the cap that ate a week](#3-result-delivery--the-cap-that-ate-a-week)
4. [`return_aggregate_stream`: false by default](#4-return_aggregate_stream-false-by-default)
5. [Chunked-yield protocol](#5-chunked-yield-protocol)
6. [Pipeline stage gates: warn, don't raise](#6-pipeline-stage-gates-warn-dont-raise)
7. [Cold-start mitigation: Network Volume + warm pipeline](#7-cold-start-mitigation-network-volume--warm-pipeline)
8. [TRELLIS-output cache (the slider-tweak optimization)](#8-trellis-output-cache-the-slider-tweak-optimization)
9. [The Dockerfile gotchas](#9-the-dockerfile-gotchas)
10. [Boot-time diagnostic probes](#10-boot-time-diagnostic-probes)
11. [Failure corpus](#11-failure-corpus)
12. [GHA build pipeline](#12-gha-build-pipeline)
13. [Diagnosing in production](#13-diagnosing-in-production)
14. [Symptom → cause cheatsheet](#14-symptom--cause-cheatsheet)

---

## 1. The architecture you're actually running

```
Browser (socket.io)
   │
   ▼
DigitalOcean App Platform — Node 22 + Express + socket.io
   │
   │  server/workers/runpod-client.js
   │  POST /v2/<endpoint>/run    body: {input:{image_b64, …}}
   │  GET  /v2/<endpoint>/stream/<jobId>     (1.5 s polling, 12 min cap)
   │
   ▼
RunPod Serverless endpoint  ──pulls──▶  ghcr.io/<owner>/<repo>:<tag>
   │                                     (built by GHA on release tag)
   │  starts a worker container
   ▼
handler.py (generator)
   │  yields {"type":"progress",…}        ──▶ /stream
   │  yields {"type":"result_chunk",…}    ──▶ /stream
   │  yields {"type":"result", chunks=N}  ──▶ /stream
   │
   ▼
/runpod-volume   (Network Volume, mounted; survives worker recycles)
   ├── hf/                                  HuggingFace model cache
   ├── torch/                               torch.hub cache (dinov2, u2net)
   ├── cache/trellis/                       TRELLIS-output cache (Phase 4 #6)
   └── failures/<yyyymmdd>/<jobId>/         per-job failure corpus
```

The Node tier polls `/stream/<jobId>` every 1.5 seconds. Each poll
returns frames yielded since the last call. Frames flow into
`runpod-client.js`, which:

- Re-emits `progress` frames as `stl.generate.progress` socket events.
- Indexes `result_chunk` frames by `index` until all `total` arrive.
- Reassembles base64 → bytes when the count matches.
- Falls back to `/status/<jobId>` if `/stream` ever drops something.

**No webhook. No long-lived HTTP request to the worker.** The worker
yields, RunPod buffers, the Node tier polls. Three boundaries, three
size caps to respect.

---

## 2. The version-banner discipline

Print the handler version from `sys.stderr` at module load. Every time.

```python
HANDLER_VERSION = "v0.1.34"
sys.stderr.write(f"[valveheadz] handler.py {HANDLER_VERSION} booting (pid={os.getpid()})\n")
sys.stderr.flush()
```

Why: RunPod's "deploy a new release" UI is a one-line text field where
you paste an image tag. If you paste the wrong tag, or the image cache
is stale, or you forgot to actually click Save — the worker boots the
old image and you spend an hour debugging code that isn't running.

The first thing you grep for in worker logs is the banner. If it doesn't
match what you expected, **stop debugging the code** and fix the
deployment.

Bump `HANDLER_VERSION` in the same commit as any handler change. Treat
version + git tag + GHCR tag + RunPod release as a single transaction.

---

## 3. Result delivery — the cap that ate a week

There are at least three independent size caps between your generator's
`yield` and the user's browser. Knowing which one bit you is half the
fix.

| Layer | What's capped | Symptom when exceeded |
|---|---|---|
| Per-frame `/job-stream` POST (worker → RunPod) | ~1 MB per yielded frame | Worker log: `Failed to return job results. \| 400, message='Bad Request'` with `isStream=true` URL. Job still completes. Client sees `runpod_no_result`. |
| Aggregate `/job-stream` POST at generator finish (with `return_aggregate_stream=True`) | smaller than per-frame in practice | Worker log: `Failed to return job results. \| 400, message='Bad Request'` with `isStream=false` URL. Same client symptom. **This is the one v0.1.32–33 didn't notice.** |
| Per-poll `/stream/<id>` GET response (RunPod → Node) | uncertain; appears to be on the response body, not per-frame | Frames silently missing from polling output. Status flips to COMPLETED with chunks never delivered. |
| Socket.IO frame size (Node → Browser) | `maxHttpBufferSize`, default 1 MB | Browser sees the connection close mid-frame. Easy to spot in DevTools → Network → WS → Messages. |

**The base64 of a typical 60 K-tri binary STL is ~4 MB.** That's over
every per-request cap above. You cannot ship the result as a single
frame, period. You must either chunk it (§5) or upload it to S3/R2 and
return only a URL.

The chunked-yield path is what we landed on; it works because each
individual `result_chunk` frame stays under the per-frame cap, and
`return_aggregate_stream=False` prevents the SDK from re-bundling them
into a single oversized POST at the end.

---

## 4. `return_aggregate_stream`: false by default

```python
runpod.serverless.start({
    "handler": handler,
    "return_aggregate_stream": False,  # ← critical for chunked protocols
})
```

With `True`, the runpod SDK collects every yielded item and POSTs the
whole array back to `/job-stream/.../...?isStream=false` when the
generator finishes. For tiny payloads this is convenient — `/status`
returns the aggregate as the job output. For chunked protocols it is
**always** wrong: ~4 MB of base64 in one POST exceeds the cap, the POST
400s, and the user sees no result.

With `False`, individual frames continue streaming via `/stream/<id>`
exactly as they did before. The only thing that changes is the final
aggregate POST, which simply doesn't happen. `/status` output becomes
the value of the last `yield` (handy for metadata), not the array.

**Heuristic:** if any single yielded frame is bigger than ~32 KB, or the
total of all yields adds up to >100 KB, you want `False`. The exception
is true streams of telemetry where you only care about the latest
value — there `True` keeps the API simpler.

---

## 5. Chunked-yield protocol

Pattern that survives the per-frame cap:

```python
stl_b64 = base64.b64encode(stl_bytes).decode("ascii")
CHUNK_SIZE = 700_000   # bytes of base64 per frame, well under 1 MB
total_chunks = (len(stl_b64) + CHUNK_SIZE - 1) // CHUNK_SIZE

for idx in range(total_chunks):
    yield {
        "type":  "result_chunk",
        "index": idx,
        "total": total_chunks,
        "data":  stl_b64[idx * CHUNK_SIZE : (idx + 1) * CHUNK_SIZE],
    }

yield {
    "type":           "result",
    "triangles":      int(len(merged.faces)),
    "chunks":         total_chunks,
    "stl_bytes_len":  len(stl_bytes),
}
```

Client side (Node, in `runpod-client.js`):

```js
const stlChunks = [];
let stlChunkTotal = null;

for (const frame of frames) {
  const out = frame?.output;
  if (out?.type === "result_chunk" && Number.isInteger(out.index)) {
    stlChunks[out.index] = out.data;
    if (Number.isInteger(out.total)) stlChunkTotal = out.total;
  } else if (out?.type === "result" && Number.isInteger(out.chunks)) {
    stlChunkTotal = out.chunks;
  }
}

// Reassemble in every poll iteration so we can deliver as soon as the
// last chunk lands — don't wait for status=COMPLETED, which can race.
if (stlChunkTotal && stlChunks.filter(Boolean).length === stlChunkTotal) {
  const stl_b64 = stlChunks.join("");
  stlBytes = Buffer.from(stl_b64, "base64");
}
```

Index by `index` (not insertion order). RunPod's polling can return
frames out-of-order across batches.

**Don't pick a chunk size larger than ~700 KB.** The cap may be lower
than 1 MB once you account for JSON envelope overhead. 700 KB has been
stable across two months of production use.

**Don't go too small either.** At 50 KB chunks, a typical STL needs ~80
yields. Each yield costs a small RunPod-internal coordination overhead.
Keep chunks at the largest size the cap allows.

---

## 6. Pipeline stage gates: warn, don't raise

TRELLIS-image-large reliably emits 700 K+ triangle meshes with euler
numbers below -20 — non-trivial topology defects (open holes around
hair, ears, occluded regions, glasses). pymeshlab's
`meshing_close_holes(maxholesize=200)` cannot close them all.

If a pipeline stage hard-raises on `mesh.is_watertight == False`, it
will block essentially every real user. Your downstream stages are
already designed to degrade — let them.

**The pattern that works** (`pipeline/stages.py:stage1_5_repair`):

```python
if not bool(head.is_watertight):
    sys.stderr.write(
        f"[stage1.5] WARNING: post-repair mesh still not watertight "
        f"(faces={len(head.faces)}, euler={int(head.euler_number)}); "
        f"shipping to stage 2. Stages 3/4 will fall back to non-CSG paths.\n"
    )
return head
```

Stages 3/4/5 already handle this case:

- Stage 3 (subtract): keeps the largest body if subtract returns multiple.
- Stage 4 (union): falls back to mesh concatenation if manifold3d's
  output is non-manifold.
- Stage 5 (export): notes non-watertight and ships anyway because
  slicers handle it.

**Reserve hard raises** for inputs the downstream stages truly cannot
recover from: empty mesh, NaN coordinates, file unreadable, model crash.
Not "non-watertight."

---

## 7. Cold-start mitigation: Network Volume + warm pipeline

**Cold start without volume:** ~5–10 minutes (TRELLIS = 2.5 GB of
safetensors + dinov2 = 1.1 GB + u2net = 176 MB downloaded fresh, then
4 decoders constructed before the first inference).

**Cold start with volume + warm pipeline:** ~30–60 seconds to first
result (model already on disk, just GPU load + inference).

### Network Volume setup

1. RunPod Console → Storage → Network Volumes → + New.
2. **Same region as the endpoint.** Cross-region attach is impossible.
3. Size 25 GB minimum (~$1.75/mo at the time of writing).
4. Endpoint settings → attach at `/runpod-volume`.
5. Set caches to point at the volume:
   ```python
   os.environ.setdefault("HF_HOME",         "/runpod-volume/hf")
   os.environ.setdefault("TRANSFORMERS_CACHE","/runpod-volume/hf")
   os.environ.setdefault("TORCH_HOME",      "/runpod-volume/torch")
   ```

### Warm pipeline pattern

Module-level singletons that survive across warm invocations on the same
worker:

```python
_PIPELINE = None         # TRELLIS pipeline + decoders
_VALVE_CAP = _load_valve_cap()  # static asset, loaded at import
_NEGATIVE_CORE = None    # lazy: only legacy callers don't need it

def _load_pipeline():
    global _PIPELINE
    if _PIPELINE is not None:
        return _PIPELINE
    # … snapshot_download(local_dir=...) + from_pretrained …
    _PIPELINE.cuda()
    return _PIPELINE
```

**Don't `_load_pipeline()` at module load.** RunPod's serverless cold
start has a separate "boot" budget from the first job's budget. Loading
the pipeline at handler-call time means the first job pays the cost,
but subsequent jobs on the same warm worker pay zero.

### `local_dir` over `cache_dir`

`huggingface_hub.snapshot_download(repo_id, cache_dir=…)` writes
files into a blobs tree with symlinks. If any LFS download misses, you
get dangling symlinks; the next `from_pretrained` then tries to fetch
each missing file as a standalone HF repo and 401s. We've seen this fail
silently for individual checkpoint files.

Use `local_dir` instead. It materializes every file as a real file in a
flat directory; re-runs are idempotent (already-downloaded files are
skipped).

```python
snapshot_download(
    repo_id=TRELLIS_MODEL,
    local_dir=os.path.join(cache_root, "trellis-image-large"),
    token=os.environ.get("HF_TOKEN"),
    max_workers=4,
)
```

### Sanity-check the cache after download

Per-file inventory with realpath + size + existence — log every file in
`ckpts/`. If anything is missing or zero-bytes, raise loudly with a "rm
-rf <path>" hint so the next worker can re-download. This caught one
real corruption incident in production.

---

## 8. TRELLIS-output cache (the slider-tweak optimization)

The user's UI has Crop Tightness, Head Pitch, Head Height, Cap Protrusion
sliders. None of them change what TRELLIS produces — they only change
Stage 2/3/4 post-processing. Caching TRELLIS's raw mesh output keyed on
`sha256(image_b64) + seed` makes repeat slider-tweak generations skip
the ~30 s GPU stage entirely on a warm worker.

```python
def _trellis_cache_key(image_b64, seed):
    payload = image_b64.encode("ascii", errors="ignore") + f"|{seed}".encode()
    return hashlib.sha256(payload).hexdigest()[:32]

cached_head = _trellis_cache_load(image_b64, seed)
if cached_head is not None:
    yield {"type": "progress", "step": "Using cached TRELLIS output…", "pct": 65}
    head = cached_head
else:
    # … run TRELLIS …
    _trellis_cache_save(image_b64, seed, head)
```

Storage: `/runpod-volume/cache/trellis/<key>.stl`. TTL 24 h matches the
design store TTL.

**Watch the user-perceived TTFR.** First generation: 8 min cold start,
30 s warm. Slider tweak after that: 1–2 s. Worth the disk space.

---

## 9. The Dockerfile gotchas

### `setup.sh`'s case statement misses your CUDA wheel

TRELLIS's `setup.sh` has a case statement that picks CUDA wheels by
PyTorch version string. Our base image (`pytorch/pytorch:2.4.0-cuda12.1-cudnn9-devel`)
doesn't match any of its branches, so xformers, kaolin, spconv-cu121,
and nvdiffrast never install. The handler boots, the import succeeds,
but `pipeline.run` crashes on the first attention call.

**Fix:** explicit `pip install` lines in the Dockerfile that don't
depend on `setup.sh`'s detection:

```dockerfile
RUN pip install --no-cache-dir \
    xformers==0.0.27 \
    spconv-cu121 \
    nvdiffrast \
    kaolin
```

Then patch `setup.sh` to skip its own wheel-install step (or just not
call it).

### `libOpenGL.so.0` is missing

pymeshlab needs OpenGL libs at import time even when running headless.
The CUDA base image doesn't ship them.

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    libopengl0 libegl1 libgles2 \
    && rm -rf /var/lib/apt/lists/*
```

Symptom without this: `ImportError: libOpenGL.so.0: cannot open shared
object file`, often deferred until the first pymeshlab call rather than
at boot.

### Two attention env vars, not one

TRELLIS has two attention modules:

- `trellis.modules.attention` reads `ATTN_BACKEND`. Accepts `xformers`,
  `flash_attn`, `sdpa`, `naive`.
- `trellis.modules.sparse.attention` reads `SPARSE_ATTN_BACKEND` and
  falls back to `ATTN_BACKEND`. Accepts only `xformers` or `flash_attn`.

Set **both** in the Dockerfile / handler:

```python
os.environ.setdefault("ATTN_BACKEND",        "xformers")
os.environ.setdefault("SPARSE_ATTN_BACKEND", "xformers")
```

If you only set `ATTN_BACKEND=sdpa` thinking the sparse module will
fall back, it doesn't — sparse rejects `sdpa` and crashes.

### `nvdiffrast` is optional

The boot log will warn `nvdiffrast_context.py: Cannot import nvdiffrast`.
That's fine for the mesh-extraction path TRELLIS uses by default (Marching
Cubes → flexicubes). Don't chase it unless you actually exercise the
nvdiffrast renderer.

### `flexicubes` directory

TRELLIS's `trellis/representations/mesh/flexicubes/` ships a
`flexicubes.py` and `tables.py` but no `__init__.py` in the source tree.
Without an `__init__.py`, the import resolves to the *directory* not the
module, and you get `ModuleNotFoundError: trellis.representations.mesh.flexicubes.flexicubes`
deferred to inference.

Either add an empty `__init__.py` in the Dockerfile:

```dockerfile
RUN touch /opt/TRELLIS/trellis/representations/mesh/flexicubes/__init__.py
```

…or import the path directly via `importlib.util.spec_from_file_location`.
We chose the touch.

### Defensive `_to_numpy`

TRELLIS returns CUDA tensors. `np.asarray(cuda_tensor)` raises
`TypeError: can't convert cuda:0 device type tensor to numpy`. Walk
through this priority order:

```python
def _to_numpy(x):
    if isinstance(x, np.ndarray):
        return x
    try:
        import torch
        if isinstance(x, torch.Tensor):
            return x.detach().cpu().numpy()
    except ImportError:
        pass
    if callable(getattr(x, "numpy", None)) and hasattr(x, "cpu"):
        try:
            return x.detach().cpu().numpy()
        except Exception:
            pass
    if isinstance(x, (list, tuple)) and any(
        hasattr(el, "detach") and hasattr(el, "cpu") for el in x
    ):
        return np.asarray([_to_numpy(el) for el in x])
    return np.asarray(x)
```

The recursive case handles `vertices` returned as `[tensor]` lists,
which trip `np.asarray` the same way.

---

## 10. Boot-time diagnostic probes

Before TRELLIS can hide an import failure inside its silent fallback,
walk through every submodule the pipeline will need and print pass/fail
to stderr:

```python
def _diag_probe_imports():
    targets = [
        "trellis.modules.attention",
        "trellis.modules.sparse",
        "trellis.modules.sparse.attention",
        "trellis.representations.gaussian",
        "trellis.representations.mesh",
        "trellis.models.sparse_structure_vae",
        "trellis.models.sparse_structure_flow",
        "trellis.models.structured_latent_vae.encoder",
        "trellis.models.structured_latent_vae.decoder_mesh",
        # … all of them …
    ]
    for mod in targets:
        try:
            __import__(mod)
            sys.stderr.write(f"[probe] OK    {mod}\n")
        except Exception as e:
            sys.stderr.write(f"[probe] FAIL  {mod}  →  {type(e).__name__}: {e}\n")
    sys.stderr.flush()
```

This runs at module load — the `[probe] OK` lines appear in the worker
boot log before any job runs. When something breaks, the offending
module is named on the line above the failure, not inside a five-deep
stack trace at inference time.

Pair this with a per-asset filesystem probe (existence, size,
realpath_exists) for the model checkpoint files. We've caught one
dangling-symlink incident this way.

---

## 11. Failure corpus

Every pipeline error writes the input photo plus a structured
`error.json` to `/runpod-volume/failures/<yyyymmdd>/<jobId>/`:

```python
def _write_failure(job_id, image_b64, *, code, stage, message, extra=None):
    job_dir = _failure_corpus_dir(job_id)
    if not job_dir:
        return
    if image_b64:
        Path(job_dir, "photo.b64").write_text(image_b64)
    Path(job_dir, "error.json").write_text(json.dumps({
        "ts": datetime.now(timezone.utc).isoformat(),
        "code": code,
        "stage": stage,
        "message": message,
        "handler_version": HANDLER_VERSION,
        "extra": extra or {},
    }, indent=2))
```

When a user reports "I uploaded my photo and got nothing," you can
re-run the pipeline on the *exact* input that broke without asking the
user to re-upload. Worth the disk space.

Also emit a single structured `[telemetry]` log line per request
(success or failure) with per-stage timing, triangle counts in/out, and
input photo SHA. This is what an aggregator (BetterStack, Loki, etc.)
ingests when you wire one up.

---

## 12. GHA build pipeline

### The release-tag trigger

`.github/workflows/build-runpod-image.yml` fires on `release: [published]`,
not `push`. To ship a new image:

```bash
gh release create v0.1.34 --title "…" --notes "…"
# triggers GHA, which builds Dockerfile and pushes
# ghcr.io/<owner>/<repo>:v0.1.34 + :latest
```

A bare `git push` to `main` does nothing for the image. Bump
`HANDLER_VERSION`, commit, push, then create the release.

### Build timing

- Cold cache (first build, or after `gh cache delete`): 22–25 min.
- Warm cache: 6–10 min if Dockerfile didn't change deeply.
- The `cache-from: type=gha, cache-to: type=gha,mode=max` lines in the
  workflow are the difference. GHA cache has a 10 GB per-repo quota.
  We have hit ~5.5 GB; nowhere close to full.

### When a build dies mid-step with no log

Symptom: build #N succeeds, builds #N+1 and #N+2 die at the same step
(usually "Build and push") with no error output. We saw this once.

Diagnosis: `gh cache delete --all` and rerun. Cache corruption inside
GHA's storage was the only plausible explanation; the cache wipe fixed
it. Don't disable the cache permanently — the 22-minute cold rebuild on
every release isn't worth it.

---

## 13. Diagnosing in production

When the user reports "no 3D output," walk these layers in order:

### 1. Did the handler boot the version you think?

Worker log → grep for `[valveheadz] handler.py vX.X.X booting`. If it's
not the expected version, you have a deployment problem, not a code
problem. Stop reading code, fix the deploy.

### 2. Did the pipeline run?

Worker log → look for `head built: NNNNN tris`, `[stage3]`, `[stage4]`,
`[stage5]`. If you see the stages, the pipeline ran. If you see a
traceback before stage progress, it crashed. Read the traceback
top-down.

### 3. Did the result get yielded?

Worker log → the `for idx in range(total_chunks)` loop has no
explicit logging by default. If you don't see a 400 from /job-stream
and you don't see a `Finished running generator` line, the worker is
still running. Wait.

### 4. Did the result get delivered?

Worker log → `Failed to return job results. | 400, message='Bad
Request', url='.../job-stream/.../...?isStream=...'`. The `isStream`
query param tells you which cap you blew:

- `isStream=true` (or per-frame) → individual yield > per-frame cap.
  Reduce CHUNK_SIZE.
- `isStream=false` → aggregate POST > total cap. Set
  `return_aggregate_stream=False`.

### 5. Did the Node tier reassemble?

DigitalOcean log → `runpod.job_complete jobId=… bytes=…`. This line
appears only when `runpod-client.js` successfully reassembled the STL.
If you see `runpod_no_result (last_status=COMPLETED)` instead, the Node
tier broke out of the polling loop without all chunks. Check `/status`
fallback path; consider whether `/stream` is dropping frames.

### 6. Did the browser receive it?

DevTools → Network → WS row → Messages tab (NOT Headers). The frame
sequence should look like:

```
↓ 42[…stl.generate.progress, 10%…]
↓ 42[…stl.generate.progress, 30%…]
↓ 42[…stl.generate.progress, 65%…]
↓ 42[…stl.generate.progress, 78%…]
↓ 42[…stl.generate.progress, 92%…]
↓ 42[…stl.generate.result, designId, …]
```

If the result frame is too large for socket.io
(`maxHttpBufferSize` default is 1 MB), the connection dies mid-frame
and the user sees a hang. Bump `maxHttpBufferSize` on the server and
keep an eye on memory.

---

## 14. Symptom → cause cheatsheet

| Symptom | Layer | Likely cause | Fix |
|---|---|---|---|
| `runpod_no_result (last_status=COMPLETED)` on client, no 400 in worker log | Node ↔ RunPod | `/stream` dropped chunks; status flipped before all yields buffered | Add `/status` fallback that handles chunked array |
| `runpod_no_result (last_status=COMPLETED)` + worker log `Failed to return job results. \| 400` `isStream=false` | Worker → RunPod | Aggregate POST too big | `return_aggregate_stream: False` |
| `runpod_no_result` + worker log 400 on per-frame URL | Worker → RunPod | Single yield too big | Reduce CHUNK_SIZE; chunk the result |
| `runpod_no_result (last_status=IN_QUEUE)` after 12 min | RunPod scheduler | No worker picked up the job | Check Max Workers ≥ 1, region not throttled, image tag valid |
| `runpod_http_401` from Node | Auth | API key wrong | Regenerate; update DO env; redeploy |
| Worker log: ModuleNotFoundError on TRELLIS submodule | Image build | setup.sh case-statement miss; missing `__init__.py` in flexicubes; wheel for wrong CUDA | Pin explicit `pip install` in Dockerfile, bump version |
| Worker log: `Cannot import nvdiffrast` (warning, not error) | TRELLIS optional dep | nvdiffrast unavailable; flexicubes path used instead | Ignore unless you actually need nvdiffrast |
| Worker log: ImportError libOpenGL.so.0 | Image build | apt didn't install opengl libs | `apt-get install libopengl0 libegl1 libgles2` in Dockerfile |
| `_to_numpy` crash with cuda tensor message | Handler | TRELLIS returned tensor, np.asarray choked | Use the defensive `_to_numpy` from §9 |
| Pipeline crashes at stage1.5 with non_manifold_input_unrepairable | Pipeline gate | Hard gate too strict | Convert raise → warning; let stages 3/4/5 degrade |
| Browser: progress frames stop after 78%, then `runpod_no_result` 5 s later | Race | Worker still running; Node tier saw COMPLETED prematurely | Read worker log for the actual exception; the answer is there once the worker finishes |
| First request after deploy hangs 8 min | Cold start | Network volume not attached, weights downloading | Attach NV; warm with one dashboard test request |
| Every request TIMED_OUT | Image | Dockerfile broken; check Logs tab | Read worker logs; usually obvious |
| Endpoint test from RunPod dashboard works, browser doesn't | Node tier | DO env vars not set or stale; old code without chunk-aware client | Verify env vars, check the Node logs for backend selection |

---

## See also

- **[3D_Pipeline.md](../3D_Pipeline.md)** — the v1 mesh pipeline this
  handler runs after TRELLIS.
- **[ProductSpec.md](../ProductSpec.md)** §4.2, §13 — request lifecycle
  and observability surfaces.
- **[deploy/runpod/README.md](../deploy/runpod/README.md)** — the
  Hub-flow deployment walkthrough; this playbook complements it with
  the *why* and the failure modes.
- `handler.py` and `server/workers/runpod-client.js` — the canonical
  implementation. When in doubt, read them.

---

*Last battle: v0.1.34, 2026-04-29. The pipeline shipped a printable STL
end-to-end after a five-version delivery-bug saga. If this playbook
saves the next person two of those versions, it's earned its keep.*
