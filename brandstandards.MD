# ValveHeadZ — Brand Standards

> One-page reference. Workshop palette + the trailing-Z signature are
> the brand. Everything else (typography, imagery, voice) flows from
> those two ideas.

Last updated: 2026-04-29 · Maintainer: Ian Roy.

---

## 1. Name

- **ValveHeadZ** — capital V, capital H, capital Z. One word, no
  space, no hyphen.
- **Lowercase form** (slugs, package names, env keys, URLs, file
  paths): `valveheadz`.
- **Plural / possessive** stays case-true: "your ValveHeadZ", "all
  ValveHeadZ caps."
- **Don't write**: ValveHeadz, Valveheadz, valveheadZ, VALVEHEADZ in
  body copy, "Valve Headz", "VHZ" as a name (VHZ is the monogram only).

The Z is the brand cue. When the logotype is split-color the trailing
Z **always** renders in `--brand` red — every other letter sits in
`--ink`. This is non-negotiable.

## 2. Monogram

`VHZ` — three letters, all caps. Used where the wordmark won't fit:
favicons over 16px, social-avatar squares, stickers, t-shirt tags.

In the monogram the **Z is oversized** relative to V and H, and
shifted up so its top-bar nests over the shoulder of the H. The Z is
brand-red; V and H are ink.

Files:
- `client/public/press/logo-monogram.svg` (source-of-truth, vector)
- `client/public/press/logo-monogram.png` (800×800, ships with the
  press kit)

## 3. Workshop palette

The palette is locked. Six tokens. All palette swatches are visible
at `client/public/press/palette.png`.

| Token        | Hex      | CSS var       | Usage                                          |
|--------------|----------|---------------|------------------------------------------------|
| Paper        | `#FAF7F2`| `--paper`     | Default page ground. Workshop cream.           |
| Paper soft   | `#F2EDE3`| `--paper-soft`| Cards / inset surfaces / kraft accents.        |
| Brand red    | `#C71F1F`| `--brand`     | The Z. CTAs. Pricing chips. Threading bands.   |
| Ink          | `#1A1614`| `--ink`       | Default text. Head silhouette in marks.        |
| Ink muted    | `#6B6157`| `--ink-muted` | Secondary text, captions, dates.               |
| Gold         | `#7C5E1F`| `--gold`      | Reserved accent — currently only on the
                                            Step-4 indicator + info banners. AA on cream. |

### AAA opt-in (P6-011)

When `<html data-contrast="aaa">` is set the tokens darken further:
brand red → `#A4111A`, ink → `#0A0907`, gold → `#5C4716`. See
`client/styles/theme.css`.

### Forced colors (Windows high-contrast)

`@media (forced-colors: active)` aliases the palette to system
tokens (`CanvasText`, `Canvas`, `GrayText`).

## 4. Typography

- **Wordmark / display**: `-apple-system, BlinkMacSystemFont,
  'Segoe UI', system-ui, 'Inter', 'Helvetica Neue', sans-serif`,
  weight 900, letter-spacing `-2`. The system stack is intentional —
  no web-font ships with the SPA.
- **Body**: same stack, weight 400/500.
- **Mono** (logs, error frames, scale callouts): `ui-monospace,
  'SF Mono', 'JetBrains Mono', monospace`.

Type scale (px) — used by the existing components:

```
160  hero headline
80   page title
56   section title
40   subhead / nav-bar at hover
32   default heading
22   tagline / chip / caption
18   secondary body
14   meta / footnote
```

## 5. The Schrader cap mark

The graphic mark is a **Schrader valve cap viewed from the front**:

- **Cap body** — rounded rectangle in `--brand`, ~ratio 5:2.
- **Three threading bands** in `--brand-dark` (#9E1818) at the base.
- **Top rim highlight** in `--brand-light` (#E04A4A) at the cap's
  top edge — implies the chamfered crown.
- **Head silhouette** in `--ink` riding on top: circle (skull),
  trapezoid (jaw taper), small rounded rect (neck).

The mark **never separates** from this construction. Rotation, color
inversion, and scale are allowed — geometry isn't.

Why Schrader? The product fits a Schrader valve (not Presta). Calling
it Schrader is a copy invariant — see [docs/DESIGN_DECISIONS.md].

## 6. Files & where they live

```
client/public/
├── favicon.svg / favicon.png           (256×256)
├── manifest.webmanifest                 PWA manifest, references icons/
├── og.png                               (1200×630) Open Graph default card
├── icons/
│   ├── icon.svg                        (512×512 source)
│   ├── icon-maskable.svg               (Android safe-zone variant)
│   ├── 192.png   / 512.png             (PWA app icons)
│   └── maskable-512.png                (round-mask-safe app icon)
└── press/
    ├── logo-wordmark.svg / .png        (1600×360)
    ├── logo-monogram.svg / .png        (800×800)
    ├── palette.svg / .png              (1200×700 reference card)
    ├── product-1-cap-on-valve.svg / .png   (1600×900)
    ├── product-2-cap-closeup.svg / .png    (1600×900)
    └── product-3-pack-of-four.svg / .png   (1600×900)
```

## 7. Build pipeline (SVG → PNG)

Designers edit `client/public/**/*.svg`. The build step is:

```bash
python3 tools/render_brand.py
```

This composites the PNGs from PIL primitives so typography is
deterministic across machines (qlmanage on macOS ignores SVG
`textLength` / `lengthAdjust`, which broke wordmark layout pre-
2026-04-29). The script reads the source palette tokens from this
file and re-emits every PNG listed under §6.

CI hook: rerun the script whenever a press SVG changes; commit the
PNGs alongside.

## 8. Copy & voice

- **Tagline**: *Your face on a Schrader valve cap.* Always lowercase
  except `Schrader`.
- **Subhead**: *$2 STL · printable on any FDM/PLA setup.*
- **Tone**: workshop-direct. No exclamation marks. No "transform your
  rides!!!" energy. Imagine a bike-shop owner who's done this fifty
  times explaining it once.
- **Print process** is locked and called out explicitly in copy: FDM,
  PLA, 0.4 mm nozzle, 0.12–0.16 mm layer height. See
  [3D_Pipeline.md §0].

## 9. Don'ts

- Don't replace the cap mark with a stylized silhouette of just the
  Z, just the head, or just the cap.
- Don't use brand red as page background — it doesn't pass AA on
  long-form text.
- Don't recolor the head silhouette. It's `--ink`. Always.
- Don't typeset the name in italics.
- Don't introduce a third accent color. Six tokens is the budget.

## 10. Inverse / dark variants

Pending — see roadmap **P6-006** (`prefers-color-scheme: dark`). Until
that lands, the cream-paper palette is the only sanctioned ground.

## 11. Press kit usage

`/press` page in the SPA exposes every asset for download. The
"download all (ZIP)" button is wired but disabled until launch (see
roadmap **X-015**). External press requests should be pointed at
`/press` or this brand-standards file.

## 12. Logo rotation history

| Date         | What changed                                                    |
|--------------|-----------------------------------------------------------------|
| 2026-04-29   | Brand name **renamed BikeHeadz → ValveHeadZ**. New trailing-Z   |
|              | signature in red. Monogram BH → VHZ. PNG build pipeline moved   |
|              | to `tools/render_brand.py` (PIL) for typographic determinism.   |
| 2026-04-29   | Initial workshop palette + cap-and-head mark established.        |

---

When in doubt, ask: *does the Z stay red?* If yes, you're probably on
brand. If no, fix it.
