# Test corpus

This directory holds **frozen TRELLIS outputs** plus their **golden
post-pipeline outputs**, used by `tools/pipeline_smoke_test.py` to verify
the mesh pipeline (`server/workers/pipeline/`) does not regress.

The corpus is the only thing in the project that grows over time. It is
the *single source of truth* for what "the pipeline works" means.

## Layout

```
test_corpus/
  001_studio_portrait/
    photo.jpg            # original input photo
    trellis_raw.stl      # cached TRELLIS output (skipping GPU in CI)
    golden.stl           # known-good final pipeline output
    notes.md             # one-line description and any quirks
  002_…
  …
```

## Why we cache `trellis_raw.stl`

CI doesn't have a GPU. Running TRELLIS in CI is a non-starter. So we
cache its output once (manually, on a dev box that *does* have a GPU)
and replay it through the pipeline in CI. That makes the smoke test a
pure CPU/mesh test and keeps the feedback loop fast.

## Why we don't synthesise inputs from the references

`server/assets/reference/{ian,nik}_head.stl` are the post-pipeline
goldens. They were produced *by* the manual pipeline. To use them as
inputs we'd have to invert the boolean ops, which is non-trivial and
non-deterministic (organic boolean inversion isn't well defined).
Instead we keep both: the references are calibration targets for §6;
the test corpus is for regression testing.

## Adding a corpus entry

1. Pick a representative input photo (front-facing portrait, decent
   lighting, no occlusions). Add as `photo.jpg`.
2. On a dev box with the RunPod worker running locally OR via the
   live endpoint with `PIPELINE_VERSION=legacy`, capture the raw
   TRELLIS mesh as `trellis_raw.stl`. The handler logs the mesh just
   before `_merge` is called — wire a `MESH_DUMP_PATH` env var if you
   need to.
3. Run the pipeline with `PIPELINE_VERSION=v1` (eventually). Save the
   final STL as `golden.stl`. Visually inspect in any 3D viewer
   (Bambu Studio, OrcaSlicer, MeshLab) — confirm it would print.
4. Write a `notes.md` describing what's interesting about this entry
   (lighting, head pose, glasses, hat, etc.).

## Adding production failures

Per `3D_Pipeline.md` §9.5, failed pipeline runs in production write
their inputs to `/runpod-volume/failures/<yyyymmdd>/<job-id>/`. Once a
week, triage and add representative ones here so the smoke test catches
them next time.

## Phase 0 starter set

Phase 0 of the rollout (see `3D_Pipeline.md` §10) requires ≥5 entries
before Phase 1 ships. Until they exist, the smoke test is a no-op.
Capturing those is gated on the RunPod endpoint being reliably warm —
not blocked on code, blocked on operations.
