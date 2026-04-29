# StemDomeZ — Brand Standards

> One-page reference. **Mongoose BMX palette + retro-90s skate-shop
> vocabulary.** Race day at the trails, 1993. Neon purple is the brand;
> fluoro green is the loud second; magenta is the third for halftones,
> errors, and splatter.

Last updated: 2026-04-29 · Maintainer: Ian Roy.

---

## 1. Name

- **StemDomeZ** — capital S, capital D, capital Z. One word, no
  space, no hyphen.
- **Lowercase form** (slugs, package names, env keys, URLs, file
  paths): `stemdomez`.
- **Plural / possessive** stays case-true: "your StemDomeZ", "all
  StemDomeZ caps."
- **Don't write**: Stemdomez, stemDomeZ, STEMDOMEZ in body copy.
  "SDZ" is the monogram only — never use it as a standalone name.
- **Don't reference the prior names** (BikeHeadz, ValveHeadZ) outside
  of historical context — those are previous identities, not aliases.

Domain: **stemdomez.com** (owned 2026-04-29). The `.app` is also
held; both point at the same DO App Platform deployment.

The Z is the brand cue. Whenever the wordmark appears split-color the
trailing Z is **always** in `--brand` (neon purple); every other
letter sits in `--ink`. **Italic** with a fluoro-green drop shadow
wherever the canvas allows. This is non-negotiable.

## 2. Monogram

`SDZ` — three letters, all caps, italic, drop-shadowed. Used where
the wordmark won't fit: favicons over 16px, social-avatar squares,
stickers, t-shirt tags.

In the monogram the **Z is oversized** relative to S and D, and
shifted up so its top-bar nests over the shoulder of the D. The Z is
neon purple; S and D are ink; both carry the green drop shadow.

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
| Gold          | `#7C5E1F`  | `--gold`      | Used only for warning text/icons. Was `#D89E2F` — failed AA on cream (2.11:1); darkened to `#7C5E1F` (5.38:1 ✓). Dark mode keeps `#D89E2F` since it passes 8.15:1 against the dark violet ground. |

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

- `.sdz-display` — italic-black display heading.
- `.sdz-wordmark` — italic + drop-shadow + green-accented `.z` span.

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
  behind cards, CTAs, and image tiles. Helper: `.sdz-memphis`.
- **Halftone dot fields** in `--accent3` magenta, density falling off
  radially. Helper: `.sdz-halftone`.
- **Zigzag accent strips** in `--accent3` along the top/bottom of
  hero sections. Helper: `.sdz-zigzag`.
- **Checker strips** (ink × fluoro green) at the very top of the
  header / OG card / nav. Helper: `.sdz-checker`.
- **CMY splatter dots** (purple / green / magenta) sprinkled near the
  wordmark area. Helper: `.sdz-splatter`.

## 7. CTAs

```css
.sdz-cta              /* primary — brand fill, white text, ink border */
.sdz-cta-secondary    /* outlined — paper fill, ink text */
.sdz-chip             /* fluoro-green pill chip (default) */
.sdz-chip-magenta     /* hot-magenta pill */
.sdz-chip-purple      /* neon-purple pill */
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
- **Don't put fluoro-green (`#2EFF8C`) text on cream paper.** Contrast
  is 1.18:1 — invisible. Fluoro is for backdrops, Memphis-shadows,
  and chip fills only.
- **Don't use `--brand-light` for body text.** It clears AA only
  at large sizes (≥18pt or ≥14pt bold). For inline references,
  use `--brand`.
- **Don't tokenize the CTA or chip backgrounds with `var()`.** Both
  are pinned to literal hexes intentionally — see §14 *Pinned-literal
  surfaces*. Theming them re-introduces dark-mode AA failures the
  audit caught.
- **Don't rebrand the system traffic-light colors** on `/status`
  (red / amber / green dots). They're functional indicators, not
  brand surface — see §15.

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

## 14. Accessibility — every documented pairing passes WCAG AA

The Mongoose BMX palette is **AA-compliant by construction across
light · dark · AAA opt-in**. The single source of truth is
[`tools/audit_a11y.py`](tools/audit_a11y.py); it runs in CI later
(roadmap **P6-009**) and exits non-zero on any failure. Re-run after
*any* token edit:

```bash
python3 tools/audit_a11y.py
```

### Ratio reference (light theme, body type / 4.5:1 minimum)

| Surface                       | FG ↔ BG               | Ratio   |
|-------------------------------|-----------------------|---------|
| Body text on paper            | ink ↔ paper           | **17.48** ✓ |
| Body text on soft card        | ink ↔ paper-soft      | 14.82 ✓ |
| Soft heading                  | ink-soft ↔ paper      | 14.95 ✓ |
| Muted secondary text          | ink-muted ↔ paper     | 10.98 ✓ |
| Faint meta text               | ink-faint ↔ paper     | 5.44 ✓  |
| Brand link / Z                | brand ↔ paper         | 5.09 ✓  |
| Brand-dim hover               | brand-dim ↔ paper     | 7.42 ✓  |
| Primary CTA label             | white ↔ #7B2EFF       | 5.71 ✓  |
| Fluoro chip — ink             | ink ↔ #2EFF8C         | 14.75 ✓ |
| Magenta chip — ink            | ink ↔ #FF2EAB         | 5.82 ✓  |
| Purple chip — white           | white ↔ #7B2EFF       | 5.71 ✓  |
| Gold/warning text             | #7C5E1F ↔ paper       | 5.38 ✓  |

**Decorative-only — no AA threshold, but call out for awareness:**

| Surface                          | Ratio | Note |
|----------------------------------|-------|------|
| Fluoro green text on paper       | 1.18  | **Never use accent2 for text on paper.** Backdrop / Memphis-shadow / chip-bg only. |
| Hot magenta text on paper        | 3.00  | OK as **large-text only** (≥18pt or ≥14pt bold). Not for body. |
| Brand-light text on paper        | 3.16  | OK as large-text only. The wordmark Z qualifies because it's italic-black and oversized; mid-paragraph references must use `--brand`. |

### Hover-state rule (the audit caught this — design rule for future)

> **Light mode hover darkens. Dark mode hover lightens.**

In light theme, the brand starts at `#7B2EFF` (5.09:1 against cream)
and the hover state darkens to `#5A1FCE` (7.42:1) — more contrast on
hover, classic.

In dark theme, the brand starts at `#A267FF` (5.45:1 against the
dark violet) and hover **lightens** to `#C99EFF` (9.04:1) — darker
hover would push under the AA floor (3.39:1 ✗). Same applies to any
brand-colored chrome: in dark mode, hover always lightens relative
to base.

### Pinned-literal surfaces (don't theme these)

Three surfaces deliberately bypass `var()` and pin literal hexes so
they look identical across light / dark / AAA modes:

- `.sdz-cta` — primary CTA. `background: #7B2EFF; color: #FFFFFF;`
  (5.71:1 ✓ everywhere). Without pinning, dark-mode `--brand`
  lightens to `#A267FF` and white text on it fails AA at 3.55:1.
- `.sdz-cta:hover` — `background: #5A1FCE` (darker, fixed).
- `.sdz-chip` family — chip backgrounds (`#2EFF8C` / `#FF2EAB` /
  `#7B2EFF`) and chip text (`#0E0A12` ink or `#FFFFFF` white) are
  all literal. Chips are vivid stickers, not body type — they
  should NOT track the page theme.

If you find yourself adding a 4th vivid surface (badge, banner,
status pill), follow the same pattern: hard-code the colors, then
add the pair to `tools/audit_a11y.py::PAIRINGS` with `chip-fg-*` /
`chip-bg-*` style aliases so the audit covers it.

## 15. System-semantic colors (intentionally outside the palette)

A small set of colors live **outside** the Mongoose BMX palette by
design. They're functional indicators, not brand surface — replacing
them with brand colors would actively hurt usability.

### `/status` page traffic-light tiles

| Tile  | bg      | border  | dot      | Meaning                  |
|-------|---------|---------|----------|--------------------------|
| green | `#E6F4EA` | `#86C5A0` | `#2F855A` | system OK                |
| amber | `#FAF1DC` | `#D8B665` | `#D89E2F` | warning / degraded       |
| red   | `#FBE9E9` | `#E89A9A` | `#B91C1C` | system down              |
| grey  | `#F1ECE2` | `#D7CFB6` | `#3D2F4A` | unknown / not configured |

A "down" indicator must read as RED at-a-glance — substituting
brand purple confuses the affordance. **Don't refactor these.** They
already pass AA against ink body text on the tile (16:1+).

### 3D viewer materials

`#9CA3AF` (chrome material), `#D4B896` (head color default), and
`#2A1F3D` (viewer backdrop) are functional colors used by the
Three.js viewer to render the STL. They're not brand surface —
leave alone unless the viewer aesthetic itself is being redesigned.

### Where the boundary lives

`tools/audit_a11y.py`'s allowlist documents both sets. New
system-semantic colors go in the allowlist with a comment justifying
why they live outside the brand palette.

## 16. Pending rebrand candidates (if StemDomeZ.com is taken)

There's a pre-existing **stemdomez.com** doing a similar product.
If trademark / domain conflicts force a rename, these are the 10
candidates that fit our DNA (one-word camelcase + trailing punch
letter + Schrader-cap-with-your-face product fit + 90s skate-shop
vibe). Domain availability + USPTO trademark search are *owner*
work — none of these have been verified.

| # | Name | Why it works | Vibe |
|---|---|---|---|
| 1 | **AirHeadZ** | Bike valves contain *air*; "airhead" is iconic 90s slang. Double meaning, Z signature lands clean. | **Strongest pick** (broad-market) |
| 2 | **StemDomeZ** | Stem = bike component (valve stem cap) + dome = peak 90s skater slang for skull. Both syllables earn it. Insider-coded but readable. *(Owner-suggested 2026-04-29.)* | **Strongest pick** (skate-coded) |
| 3 | **StemHeadZ** | Most product-literal: "valve **stem** cap" + head. Bike-shop vocabulary, no slang. | Most accurate |
| 4 | **PumpHeadZ** | Bike pump connects to the valve; "pump" = effort/hyped. | Pure cycling |
| 5 | **RimHeadZ** | Rim is where the valve lives. Alliterative. | Cycling-native |
| 6 | **CapHeadZ** | The product *is* a cap with a head on it. | Plainspoken |
| 7 | **DomeStemZ** | Inverse of #2 — emphasizes head over component. Reads slightly less brandable. | 90s skate-shop |
| 8 | **MugStemZ** | "Mug" = old-school slang for face. Stem = component. | Slightly mature |
| 9 | **CrankFaceZ** | Bike crank + 90s slang ("crank" = grumpy). | Playful |
| 10 | **TopperZ** | "Topper" = thing that sits on top of another. | Approachable |
| 11 | **NubHeadZ** | "Nub" = bike-shop slang for the cap nipple. | Insider |

**Two recommendations, by audience:**

- **AirHeadZ** if you want broad-market reach. Every syllable does
  double duty (bike valve = air; "airhead" = period slang as
  affection-insult). Most people get the joke instantly.
- **StemDomeZ** if you want the skate-shop crowd to nod when they
  read it. "Dome" is true-period vocabulary that signals "for
  people like us." Slightly more product-literal too — "stem" is
  bike-correct, "dome" is the head, and the trailing Z stays.

For a niche maker-product targeting cyclists + 3D-printer hobbyists,
the insider read of **StemDomeZ** is probably the better fit — the
audience is more likely to land on the brand through skate / BMX /
maker channels than through general retail. AirHeadZ wins if you
ever plan to ship to non-cyclists.

Check the domain + social handles either way:
`stemdomez.com` / `stemdomez.app` / @stemdomez vs.
`airheadz.com` / `airheadz.app` / @airheadz.

If a rename does happen, the rebrand pipeline is:
1. Run a Python find-replace pass with the same shape as the
   `bikeheadz → stemdomez` migration (commit `c21278c`).
2. Update token usage in `theme.css` only if the `Z` signature
   shifts.
3. Re-render PNG assets via `python3 tools/render_brand.py`.
4. Re-run `python3 tools/audit_a11y.py` — palette didn't change so
   it should still pass.
5. Update §1 Name, §2 Monogram, §16 here, §0.5 in the workplan ledger.

## 17. Logo / palette rotation history

| Date         | Change                                                          |
|--------------|------------------------------------------------------------------|
| 2026-04-29   | **Brand renamed ValveHeadZ → StemDomeZ.** valveheadz.com was    |
|              | already taken by an existing site doing similar work. Owner     |
|              | suggested **StemDomeZ** ("stem" = bike component, "dome" = 90s |
|              | skater slang for skull). DNS sniff confirmed both stemdomez.com|
|              | and stemdomez.app open; owner purchased the .com 2026-04-29.   |
|              | Wordmark "ValveHead" → "StemDome", monogram VHZ → SDZ, cookie  |
|              | rotation vh_* → sd_*, CSS class rotation .vhz-* → .sdz-*,       |
|              | Prometheus metric prefix valveheadz_* → stemdomez_*. Rename    |
|              | pipeline same shape as the prior BikeHeadz → ValveHeadZ pass.   |
|              | Palette didn't change — Mongoose BMX is the brand.              |
| 2026-04-29   | **WCAG AA conformance pass.** Tools/audit_a11y.py written; 14   |
|              | initial failures fixed. Gold token darkened `#D89E2F → #7C5E1F` |
|              | (5.38:1 ✓). Dark-mode brand lightened to `#A267FF`; hover       |
|              | lightens further to `#C99EFF` (hover-direction rule established).|
|              | CTAs and chips pinned to literal hexes so they don't theme. 43  |
|              | legacy-color stragglers swept across 12 pages. Status-page red  |
|              | dot restored from clobbered #7B2EFF → `#B91C1C`. **Every        |
|              | documented text/UI pair now passes AA in light + dark + AAA.**  |
| 2026-04-29   | **Palette swap** to Mongoose BMX (neon purple + fluoro green +   |
|              | hot magenta) on warm cream. Italic wordmark with green drop      |
|              | shadow becomes the canonical treatment. Memphis offset, halftone,|
|              | zigzag, checker, splatter all added as utilities.                |
| 2026-04-29   | Brand name **renamed BikeHeadz → StemDomeZ**. Trailing-Z        |
|              | signature established. Monogram BH → SDZ.                        |
| 2026-04-29   | Mark redesign — cylindrical cap + ¾-profile head + glasses cue,  |
|              | abstracting the chrome 3D product reference.                     |
| 2026-04-29   | Initial workshop-cream palette (signal-red brand) established —  |
|              | superseded same day.                                             |

---

When in doubt, ask: *does the Z stay neon purple, italic, with a
green drop shadow?* If yes, you're on brand. If no, fix it.
