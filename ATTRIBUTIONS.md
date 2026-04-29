# Attributions

BikeHeadz is built on the shoulders of several open-source projects and
content licenses. Thank you to all the maintainers below.

## Code & libraries

- [TRELLIS](https://github.com/microsoft/TRELLIS) (Microsoft, MIT) —
  image-conditioned 3D mesh generation.
- [trimesh](https://github.com/mikedh/trimesh) (MIT) — mesh loading,
  inspection, repair.
- [pymeshlab](https://github.com/cnr-isti-vclab/PyMeshLab) (GPL-3.0) —
  hole filling + remeshing in the print-prep pipeline.
- [manifold3d](https://github.com/elalish/manifold) (Apache 2.0) —
  watertight boolean operations.
- [mediapipe](https://github.com/google-ai-edge/mediapipe) (Apache 2.0) —
  face landmark detection.
- [rembg](https://github.com/danielgatis/rembg) / U²-Net (MIT) —
  background removal pre-pass.
- [Three.js](https://github.com/mrdoob/three.js) (MIT) — 3D viewer.
- [SVG.js](https://github.com/svgdotjs/svg.js) (MIT) — SVG rendering for
  the live red-line preview (P3-008).
- [Tailwind CSS](https://tailwindcss.com) (MIT) — utility-class styling.
- [Vite](https://vitejs.dev) (MIT) — frontend build tool.
- [Express](https://expressjs.com) (MIT) — Node HTTP framework.
- [socket.io](https://socket.io) (MIT) — two-way command transport.
- [helmet](https://helmetjs.github.io) (MIT) — security headers
  middleware.
- [pg](https://node-postgres.com) (MIT) — PostgreSQL client.
- [Stripe Node SDK](https://github.com/stripe/stripe-node) (MIT) — Stripe
  API access.
- [@sentry/node, @sentry/browser](https://sentry.io) (MIT) — error
  reporting.
- [zod](https://zod.dev) (MIT) — runtime payload validation.
- [@simplewebauthn/server, @simplewebauthn/browser](https://simplewebauthn.dev)
  (MIT) — passkey support (P1-009).
- [Vitest](https://vitest.dev) (MIT) — unit tests.

## Content & assets

- Photos from [Unsplash](https://unsplash.com) used under their
  [license](https://unsplash.com/license).
- BikeHeadz wordmark, illustrations, and the workshop palette are © 2026
  BikeHeadz Ltd.

## Worker images

- [pytorch/pytorch:2.4.0-cuda12.1-cudnn9-devel](https://hub.docker.com/r/pytorch/pytorch)
  (BSD-style) — base image for the GPU worker (deploy/runpod).

## Removed (no longer used)

- ~~[shadcn/ui](https://ui.shadcn.com/)~~ — removed when the React-based
  UI was replaced by the SVG.js + hyperscript stack.
