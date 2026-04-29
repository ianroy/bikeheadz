# ValveHeadZ — Brand Standards

> One-page reference. **Mongoose BMX palette + retro-90s skate-shop
> vocabulary.** Race day at the trails, 1993. Neon purple is the brand;
> fluoro green is the loud second; magenta is the third for halftones,
> errors, and splatter.

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

The Z is the brand cue. Whenever the wordmark appears split-color the
trailing Z is **always** in `--brand` (neon purple); every other
letter sits in `--ink`. **Italic** with a fluoro-green drop shadow
wherever the canvas allows. This is non-negotiable.

## 2. Monogram

`VHZ` — three letters, all caps, italic, drop-shadowed. Used where
the wordmark won't fit: favicons over 16px, social-avatar squares,
stickers, t-shirt tags.

In the monogram the **Z is oversized** relative to V and H, and
shifted up so its top-bar nests over the shoulder of the H. The Z is
neon purple; V and H are ink; both carry the green drop shadow.

Files:
- `client/public/press/logo-monogram.svg` (canonical vector)
- `client/public/press/logo-monogram.png` (800×800 PNG, ships with
  the press kit + GitHub avatar)

## 3. Mongoose BMX palette (LOCKED)

Six tokens. All swatches: `client/public/press/palette.png`.

| Token         | Hex        | CSS var       | Role                                                       |
|---------------|------------|---------------|------------------------------------------------------------|
| Paper         | `#F5F2E5`  | `--paper`     | Page ground. Off-white, slightly warm.                     |
| Paper soft    | `#E5E0CC`  | `--paper-soft`| Card / inset surfaces / kraft accents.                     |
| Ink           | `#0E0A12`  | `--ink`       | Default body type, head silhouette in marks.               |
| Ink muted     | `#3D2F4A`  | `--ink-muted` | Secondary text, captions, dates. Reads as "deep mauve."    |
| **Brand**     | `#7B2EFF`  | `--brand`     | **The Z. Primary CTAs.** Cap fill in marks.                |
| Brand dark    | `#5A1FCE`  | `--brand-dim` | Hover/pressed state for primary CTAs.                      |
| Brand light   | `#A267FF`  | `--brand-light`| Cap top-rim highlight in marks.                            |
| **Accent 2**  | `#2EFF8C`  | `--accent2`   | **Fluoro green.** Memphis offset shadows. Drop shadow on the wordmark. Active nav underline. |
| Accent 2 dim  | `#1FCE6E`  | `--accent2-dim`| AAA-mode + dark variant.                                   |
| **Accent 3**  | `#FF2EAB`  | `--accent3`   | **Hot magenta.** Halftone fields, splatter dots, error-state chips. |
| Accent 3 dim  | `#CE1F8B`  | `--accent3-dim`| AAA-mode + dark variant.                                   |
| Gold (legacy) | `#D89E2F`  | `--gold`      | Hot yellow — used only for warning surfaces.               |

### Don't introduce

- A 4th accent. The CMY-style trio (purple / green / magenta) is the
  brand. New chips reuse one of those three.
- Pure black `#000` or pure white `#FFF`. Use `--ink` and `--paper`.

### AAA opt-in (P6-011)

When `<html data-contrast="aaa">` is set: brand → `#5A1FCE`, ink →
`#050307`, accent2 → `#1FCE6E`, accent3 → `#CE1F8B`.

### Forced colors (Windows high-contrast)

`@media (forced-colors: active)` aliases palette tokens to system
keywords (`CanvasText`, `Canvas`, `GrayText`).

## 4. Typography

Headlines and the wordmark are **italic black** for the period
display feel. System font stack only — no web fonts ship.

- **Display / wordmark**: `-apple-system, BlinkMacSystemFont,
  'Segoe UI', system-ui, 'Inter', 'Helvetica Neue', sans-serif`,
  `font-style: italic`, `font-weight: 900`, letter-spacing `-0.02em`.
- **Body**: same stack, weight 400/500.
- **Mono** (logs, error frames, mm scale callouts): `ui-monospace,
  'SF Mono', 'JetBrains Mono', monospace`.

Helper classes (in `client/styles/theme.css`):

- `.vhz-display` — italic-black display heading.
- `.vhz-wordmark` — italic + drop-shadow + green-accented `.z` span.

## 5. The cap-and-head mark

The graphic mark abstracts the actual product (chrome 3D-printed
head wearing glasses, riding on a Schrader valve cap):

1. **Cylindrical cap** — side wall in `--brand`, elliptical top in
   `--brand-light`, bottom shadow ellipse in `--brand-dim`, three
   threading bands in `--brand-dim`.
2. **¾-profile head silhouette** in `--ink` — rounded skull, brow,
   nose-tip protrusion, chin, jaw curve, back-of-skull. ~25 vertices.
3. **Glasses** as paper-cream cutouts across the brow line, with an
   inner ink rect for the lens.

Geometry never changes. Only color (per palette context — primary
brand vs. inverse vs. forced-colors) varies.

## 6. 90s graphic vocabulary

These are the period gestures. Use sparingly — the mark + wordmark
already do most of the work; vocabulary elements are seasoning.

- **Italic wordmark with drop shadow** (always, every surface).
- **Memphis offset boxes** — flat colored shadow rect 6px down+right
  behind cards, CTAs, and image tiles. Helper: `.vhz-memphis`.
- **Halftone dot fields** in `--accent3` magenta, density falling off
  radially. Helper: `.vhz-halftone`.
- **Zigzag accent strips** in `--accent3` along the top/bottom of
  hero sections. Helper: `.vhz-zigzag`.
- **Checker strips** (ink × fluoro green) at the very top of the
  header / OG card / nav. Helper: `.vhz-checker`.
- **CMY splatter dots** (purple / green / magenta) sprinkled near the
  wordmark area. Helper: `.vhz-splatter`.

## 7. CTAs

```css
.vhz-cta              /* primary — brand fill, white text, ink border */
.vhz-cta-secondary    /* outlined — paper fill, ink text */
.vhz-chip             /* fluoro-green pill chip (default) */
.vhz-chip-magenta     /* hot-magenta pill */
.vhz-chip-purple      /* neon-purple pill */
```

Primary CTA labels are italic + uppercase + tracked.

## 8. Files & where they live

```
client/public/
├── favicon.svg / favicon.png       (256×256)
├── manifest.webmanifest             PWA manifest
├── og.png                           (1200×630) Open Graph default card
├── icons/
│   ├── icon.svg                    (512×512 source)
│   ├── icon-maskable.svg           (Android safe-zone)
│   ├── 192.png   / 512.png         (PWA app icons)
│   └── maskable-512.png            (round-mask-safe app icon)
└── press/
    ├── logo-wordmark.svg / .png    (1600×400)
    ├── logo-monogram.svg / .png    (800×800)
    ├── palette.svg / .png          (1200×700 reference)
    ├── product-1-cap-on-valve.svg / .png   (1600×900)
    ├── product-2-cap-closeup.svg / .png    (1600×900)
    ├── product-3-pack-of-four.svg / .png   (1600×900)
    └── palette-options/             6 alt-palette comparison cards +
                                     contact sheet (kept for reference)
```

## 9. Build pipeline

```bash
python3 tools/render_brand.py
```

The PIL renderer is the source of truth for the shipped PNGs because
macOS `qlmanage` ignores SVG `textLength` / `lengthAdjust` — wordmark
typography drifts otherwise. SVG sources track the same geometry +
palette so designers can edit them in Illustrator / Figma / Inkscape.

CI hook: rerun the script whenever a press SVG changes; commit the
PNGs alongside.

## 10. Copy & voice

- **Tagline**: *Your face on a Schrader valve cap.* Always
  capitalize "Schrader."
- **Subhead**: *$2 STL · printable on any FDM/PLA setup.*
- **Tone**: 90s skate-shop — direct, italic-leaning, mildly hyped.
  Imagine the catalog copy in a 1995 Performance Bicycle insert.
- **Print process** is locked and named explicitly: FDM, PLA, 0.4 mm
  nozzle, 0.12–0.16 mm layer height. See [3D_Pipeline.md §0].

## 11. Don'ts

- Don't substitute pure red (#C71F1F or otherwise) anywhere. Brand
  red is gone — the brand is neon purple.
- Don't typeset the name in upright (non-italic) display sizes.
- Don't replace the cap mark with just a skull, just the Z, or just
  the cap.
- Don't recolor the head silhouette — it's `--ink`.
- Don't introduce a 4th accent.

## 12. Inverse / dark variants

`@media (prefers-color-scheme: dark)` swaps the page ground to a
near-black violet (`#110A1E`) with cream type. Brand stays neon
purple; the wordmark drop shadow shifts to magenta for higher
contrast on the dark ground.

## 13. Press kit usage

`/press` page in the SPA exposes every asset for download. The
"Download all (ZIP)" button is wired but disabled until launch
(roadmap **X-015**). External press requests should be pointed at
`/press` or this brand-standards file.

## 14. Logo / palette rotation history

| Date         | Change                                                          |
|--------------|------------------------------------------------------------------|
| 2026-04-29   | **Palette swap** to Mongoose BMX (neon purple + fluoro green +   |
|              | hot magenta) on warm cream. Italic wordmark with green drop      |
|              | shadow becomes the canonical treatment. Memphis offset, halftone,|
|              | zigzag, checker, splatter all added as utilities.                |
| 2026-04-29   | Brand name **renamed BikeHeadz → ValveHeadZ**. Trailing-Z        |
|              | signature established. Monogram BH → VHZ.                        |
| 2026-04-29   | Mark redesign — cylindrical cap + ¾-profile head + glasses cue,  |
|              | abstracting the chrome 3D product reference.                     |
| 2026-04-29   | Initial workshop-cream palette (signal-red brand) established —  |
|              | superseded same day.                                             |

---

When in doubt, ask: *does the Z stay neon purple, italic, with a
green drop shadow?* If yes, you're on brand. If no, fix it.
