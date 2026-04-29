# Canary fixture

The synthetic-canary workflow (`P4-013`, see `tools/canary_runner.js`) needs a
real portrait JPG to round-trip through `stl.generate`. We do **not** commit a
real face: photos in this repo would (a) ship PII into a public-by-default
artefact and (b) potentially baseline our STL pipeline against a single
biometric the operator never explicitly consented to publishing.

## How to provision

Drop a consented portrait JPG into this directory named exactly:

```
tools/canary/canary-photo.jpg
```

Constraints:

- Single human face, well-lit, looking at the camera.
- Roughly 800×800 to 2000×2000 pixels.
- File size under `MAX_IMAGE_BYTES` (default 5 MiB; see `server/commands/stl.js`).
- The subject must have signed the consent form on file at
  `docs/consent/` (or its successor) before the file lands here.

## Behaviour when missing

`tools/canary_runner.js` reads this file at runtime. If the file is **absent**
the runner logs a structured "skipped" line on stdout and exits `0` so the
scheduled GitHub Actions workflow stays green. This is the intended default
in CI — an empty repo plus a no-op canary is preferable to an alarming red
build.

## Privacy

This file path is in `.gitignore` semantics by convention: do not commit
`canary-photo.jpg` itself. Only this README is tracked.
