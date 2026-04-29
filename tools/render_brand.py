#!/usr/bin/env python3
"""
Composite the ValveHeadZ brand PNGs from scratch via Pillow.

Why not pure SVG → PNG? `qlmanage` (the SVG→PNG renderer we have on this
build host) ignores `textLength` / `lengthAdjust`, so wordmark
typography drifts from what designers commit. PIL with the system font
gives us pixel-deterministic output.

The committed `client/public/**/*.svg` files remain the canonical
"source of truth" — designers edit those. This script is the build
step that turns them into shippable PNGs.

Outputs:
  client/public/icons/192.png
  client/public/icons/512.png
  client/public/icons/maskable-512.png
  client/public/favicon.png
  client/public/og.png
  client/public/press/logo-wordmark.png        (1600×360)
  client/public/press/logo-monogram.png        (800×800)
  client/public/press/palette.png              (1200×700)
  client/public/press/product-1-cap-on-valve.png (1600×900)
  client/public/press/product-2-cap-closeup.png  (1600×900)
  client/public/press/product-3-pack-of-four.png (1600×900)

Run:
  python3 tools/render_brand.py
"""
import pathlib, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUB = ROOT / 'client/public'
ICONS = PUB / 'icons'
PRESS = PUB / 'press'

# Workshop palette — must match client/styles/theme.css
PAPER = (250, 247, 242, 255)        # #FAF7F2
PAPER_SOFT = (242, 237, 227, 255)   # #F2EDE3
PAPER_EDGE = (201, 192, 177, 255)   # #C9C0B1
INK = (26, 22, 20, 255)             # #1A1614
INK_MUTED = (107, 97, 87, 255)      # #6B6157
BRAND = (199, 31, 31, 255)          # #C71F1F
BRAND_DARK = (158, 24, 24, 255)     # #9E1818
BRAND_LIGHT = (224, 74, 74, 255)    # #E04A4A
GOLD = (124, 94, 31, 255)           # #7C5E1F

# macOS system fonts — Helvetica.ttc has Helvetica Black at index 9 typically
def font(size, weight='black'):
    """Try heavy/black first; fall back to Bold then Regular."""
    candidates = {
        'black': [
            ('/System/Library/Fonts/HelveticaNeue.ttc', 0),
            ('/System/Library/Fonts/Helvetica.ttc', 0),
            ('/System/Library/Fonts/SFNS.ttf', 0),
            ('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 0),
        ],
        'medium': [
            ('/System/Library/Fonts/HelveticaNeue.ttc', 0),
            ('/System/Library/Fonts/Helvetica.ttc', 0),
            ('/System/Library/Fonts/SFNS.ttf', 0),
        ],
    }
    for path, idx in candidates.get(weight, candidates['black']):
        try:
            f = ImageFont.truetype(path, size, index=idx)
            # bump weight via variation if available (SFNS supports OpenType variations).
            try:
                if weight == 'black':
                    f.set_variation_by_axes([900])
                elif weight == 'medium':
                    f.set_variation_by_axes([500])
            except Exception:
                pass
            return f
        except Exception:
            continue
    return ImageFont.load_default()

def text_w(draw, text, fnt):
    """Best-effort width of `text` in pixels."""
    try:
        l, t, r, b = draw.textbbox((0, 0), text, font=fnt)
        return r - l
    except Exception:
        return draw.textsize(text, font=fnt)[0]


# ── Mark primitives — draw the cap+head on a Pillow canvas. ────────────
#
# The mark abstracts the actual product photo (`docs/brand/product-3d.jpg`):
# a ¾-profile head wearing glasses, sitting on a *cylindrical* Schrader-
# valve cap. Three deliberate gestures translate the 3D render into a
# 2D mark that reads at 16px:
#   1. Cap is drawn as a cylinder (side rect + elliptical top + bottom
#      shadow) rather than a slab — this is the brand-defining silhouette.
#   2. Head is a hand-curved ¾ profile polygon (~24 vertices), oriented
#      forward-right — features visible: forehead, brow, nose tip, chin,
#      jaw curve, back of skull.
#   3. Glasses sit on the brow as a single horizontal "spectacle" detail
#      in `--paper` so they punch out of the ink head.
def draw_cap_and_head(im, draw, ox, oy, scale=1.0):
    """ox/oy = top-left of the mark bounding box. scale 1.0 = ~290px tall."""
    s = scale
    def S(v): return int(round(v * s))

    # ── Cylindrical cap.
    # Side wall: rectangle.
    cap_l = ox + S(10); cap_t = oy + S(155); cap_w = S(220); cap_h = S(95)
    cap_r = cap_l + cap_w; cap_b = cap_t + cap_h
    draw.rectangle([cap_l, cap_t, cap_r, cap_b], fill=BRAND)
    # Top ellipse — the visible top edge of the cylinder (gives 3D cue).
    top_dh = S(18)
    draw.ellipse([cap_l, cap_t - top_dh, cap_r, cap_t + top_dh],
                 fill=BRAND_LIGHT)
    # Inner top ellipse (slightly inset, darker red) — depth cue.
    draw.ellipse([cap_l + S(6), cap_t - top_dh + S(4),
                  cap_r - S(6), cap_t + top_dh - S(4)],
                 fill=BRAND)
    # Bottom ellipse — shadow underside (the cylinder doesn't sit flat).
    draw.ellipse([cap_l, cap_b - S(8), cap_r, cap_b + top_dh],
                 fill=BRAND_DARK)
    # Three threading bands along the bottom of the side wall.
    for ty in (cap_h - 38, cap_h - 24, cap_h - 10):
        draw.rectangle([cap_l + S(2), cap_t + S(ty),
                        cap_r - S(2), cap_t + S(ty + 5)],
                       fill=BRAND_DARK)

    # ── ¾ profile head silhouette.
    # Coordinate system: relative to (head_cx, head_cy). +x = forward
    # (towards the viewer's right). The polygon is hand-tuned — keep it
    # ≤32 vertices so it scales down cleanly.
    head_cx = cap_l + cap_w // 2 + S(6)
    head_cy = cap_t - S(64)

    def H(dx, dy):
        return (head_cx + S(dx), head_cy + S(dy))

    head_points = [
        # — clockwise from crown —
        H(-12, -78),   # crown
        H(8,   -78),   # top-front
        H(28,  -72),
        H(46,  -60),   # top-front of skull (rounded)
        H(58,  -42),
        H(64,  -22),   # temple / brow ridge
        H(67,   -8),   # brow line (glasses sit here)
        H(70,    4),   # bridge of nose
        H(80,   14),   # nose tip
        H(70,   24),   # below nose
        H(72,   30),   # philtrum
        H(66,   38),   # upper lip
        H(64,   46),   # corner of mouth
        H(60,   54),   # chin (forward jut)
        H(48,   62),   # under-chin
        H(28,   66),
        H(2,    66),   # mid-jaw
        H(-22,  62),
        H(-44,  52),   # back-of-jaw curve
        H(-58,  34),
        H(-66,  10),   # back of skull (lower)
        H(-70, -16),
        H(-66, -42),   # back of skull (upper)
        H(-54, -64),
        H(-32, -76),
    ]
    draw.polygon(head_points, fill=INK)

    # ── Neck under the head, joining into the cap.
    neck_l = head_cx - S(24); neck_r = head_cx + S(24)
    neck_t = head_cy + S(60); neck_b = cap_t - S(2)
    draw.rectangle([neck_l, neck_t, neck_r, neck_b], fill=INK)

    # ── Glasses — single rounded rect across the brow with a paper-cream
    # cutout that pinches in the middle to imply two lenses.
    g_y = head_cy - S(8); g_h = S(15)
    # right lens (the dominant one in ¾ view)
    draw.rounded_rectangle(
        [head_cx + S(28), g_y, head_cx + S(60), g_y + g_h],
        radius=S(3), fill=PAPER
    )
    draw.rounded_rectangle(
        [head_cx + S(31), g_y + S(2), head_cx + S(57), g_y + g_h - S(2)],
        radius=S(2), fill=INK
    )
    # left lens (foreshortened by the ¾ angle — narrower)
    draw.rounded_rectangle(
        [head_cx + S(4), g_y, head_cx + S(22), g_y + g_h],
        radius=S(3), fill=PAPER
    )
    draw.rounded_rectangle(
        [head_cx + S(7), g_y + S(2), head_cx + S(19), g_y + g_h - S(2)],
        radius=S(2), fill=INK
    )
    # nose bridge between lenses
    draw.rectangle(
        [head_cx + S(22), g_y + S(5), head_cx + S(28), g_y + S(9)],
        fill=PAPER
    )


def render_wordmark(out_path, w=1600, h=360):
    im = Image.new('RGBA', (w, h), PAPER)
    draw = ImageDraw.Draw(im)
    # Mark on the left
    draw_cap_and_head(im, draw, ox=60, oy=70, scale=1.0)
    # Wordmark: "ValveHead" in ink + "Z" oversized in red
    fnt_main = font(170, 'black')
    fnt_z    = font(230, 'black')
    fnt_tag  = font(22,  'medium')
    text_x = 320
    base_y = 230
    main = "ValveHead"
    draw.text((text_x, base_y - 130), main, font=fnt_main, fill=INK)
    main_w = text_w(draw, main, fnt_main)
    # Z: nudge slightly to overlap stem of "d" — visual coupling
    z_x = text_x + main_w - 6
    draw.text((z_x, base_y - 165), "Z", font=fnt_z, fill=BRAND)
    # tagline
    tagline = "YOUR FACE ON A SCHRADER VALVE CAP"
    draw.text((text_x, base_y + 40), tagline, font=fnt_tag, fill=INK_MUTED)
    im.save(out_path)
    return im


def render_monogram(out_path, size=800):
    """Vertical layout: shared cap+head mark in the top half, "VHZ"
    wordmark in the bottom half (VH ink, oversized red Z)."""
    im = Image.new('RGBA', (size, size), PAPER)
    draw = ImageDraw.Draw(im)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=120, fill=PAPER)
    draw.rounded_rectangle([8, 8, size - 9, size - 9], radius=116,
                           outline=(26, 22, 20, 16), width=3)
    # Shared mark, scaled to fill ~360px of vertical space.
    mark_scale = 1.6
    mark_w = int(round(290 * mark_scale))
    ox = (size - mark_w) // 2
    oy = 70
    draw_cap_and_head(im, draw, ox=ox, oy=oy, scale=mark_scale)
    # VHZ wordmark — bottom half. VH in ink, Z oversized brand-red.
    fnt_main = font(180, 'black')
    fnt_z    = font(280, 'black')
    main = "VH"
    z = "Z"
    mw = text_w(draw, main, fnt_main)
    total_w = mw + text_w(draw, z, fnt_z) - 12
    base_x = (size - total_w) // 2
    base_y = 580
    draw.text((base_x, base_y), main, font=fnt_main, fill=INK)
    draw.text((base_x + mw - 12, base_y - 50), z, font=fnt_z, fill=BRAND)
    im.save(out_path)
    return im


def render_icon(out_path, size=512, masked=False):
    """App icon. Uses the shared cylindrical-cap + ¾-profile-head mark.

    Layout: cap centered, head riding on top with glasses cue. The
    optional VHZ stamp lives in the lower-right (skipped on the
    maskable variant — Android masks corners aggressively).
    """
    im = Image.new('RGBA', (size, size), PAPER)
    draw = ImageDraw.Draw(im)
    s = size / 512
    def S(v): return int(round(v * s))
    if not masked:
        draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=S(96), fill=PAPER)
        draw.rounded_rectangle(
            [S(6), S(6), size - 1 - S(6), size - 1 - S(6)],
            radius=S(92), outline=(26, 22, 20, 16), width=2
        )
    # Position the shared mark. Mark bbox is ~290px tall; cap_w 220px.
    mark_scale = 1.5 if not masked else 1.3
    mark_w = int(round(290 * mark_scale))
    ox = (size - mark_w) // 2
    oy = (size - int(round(330 * mark_scale))) // 2 + S(20)
    draw_cap_and_head(im, draw, ox=ox, oy=oy, scale=mark_scale)

    if not masked:
        # Lower-right VHZ stamp (V/H ink, Z brand-red).
        f = font(S(40), 'black')
        vh = "VH"; z = "Z"
        vw = text_w(draw, vh, f); zw = text_w(draw, z, f)
        bx = size - vw - zw - S(20)
        by = size - S(60)
        draw.text((bx, by), vh, font=f, fill=INK)
        draw.text((bx + vw, by), z, font=f, fill=BRAND)
    im.save(out_path)
    return im


def render_favicon(out_path, size=256):
    im = Image.new('RGBA', (size, size), PAPER)
    draw = ImageDraw.Draw(im)
    s = size / 64
    def S(v): return int(round(v * s))
    # rounded background
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=S(10), fill=PAPER)
    # cap bar
    draw.rounded_rectangle([S(6), S(32), S(58), S(54)], radius=S(4), fill=BRAND)
    # head silhouette (centered in top half)
    head_cx = size // 2
    head_cy = S(20)
    head_r = S(11)
    draw.ellipse([head_cx - head_r, head_cy - head_r,
                  head_cx + head_r, head_cy + head_r], fill=INK)
    draw.polygon(
        [(head_cx - S(11), head_cy + S(4)),
         (head_cx + S(11), head_cy + S(4)),
         (head_cx + S(11), head_cy + S(12)),
         (head_cx - S(11), head_cy + S(12))],
        fill=INK
    )
    # tiny Z bottom-right (brand cue)
    f = font(S(14), 'black')
    draw.text((size - S(14), size - S(20)), "Z", font=f, fill=PAPER)
    im.save(out_path)
    return im


def render_palette(out_path, w=1200, h=700):
    im = Image.new('RGBA', (w, h), PAPER)
    draw = ImageDraw.Draw(im)
    # title
    draw.text((60, 36), "Workshop palette", font=font(36, 'black'), fill=INK)
    draw.text((60, 86), "Six tokens. Sourced from client/styles/theme.css.",
              font=font(20, 'medium'), fill=INK_MUTED)
    swatches = [
        ("Paper",     "#FAF7F2 — --paper",     PAPER, INK,        (60, 160)),
        ("Brand red", "#C71F1F — --brand",     BRAND, PAPER,      (440, 160)),
        ("Ink",       "#1A1614 — --ink",       INK, PAPER,        (820, 160)),
        ("Paper soft","#F2EDE3 — --paper-soft",PAPER_SOFT, INK,    (60, 400)),
        ("Gold",      "#7C5E1F — --gold",      GOLD, PAPER,       (440, 400)),
        ("Ink muted", "#6B6157 — --ink-muted", INK_MUTED, PAPER,  (820, 400)),
    ]
    for label, hex_, bg, fg, (x, y) in swatches:
        draw.rounded_rectangle([x, y, x + 320, y + 220], radius=14, fill=bg)
        if bg == PAPER or bg == PAPER_SOFT:
            draw.rounded_rectangle([x, y, x + 320, y + 220], radius=14,
                                   outline=(26, 22, 20, 30), width=2)
        draw.text((x + 20, y + 150), label, font=font(22, 'black'), fill=fg)
        draw.text((x + 20, y + 180), hex_, font=font(18, 'medium'), fill=fg)
    im.save(out_path)
    return im


def render_og(out_path, w=1200, h=630):
    """OG card: cream ground + cap mark + wordmark + tagline.

    Layout: 1200×630 (Open Graph spec). Mark on the left at scale 1.5
    (380px tall). Wordmark anchored x=440, sized so 'ValveHeadZ' fully
    fits within the right margin (1140 cap).
    """
    im = Image.new('RGBA', (w, h), PAPER)
    draw = ImageDraw.Draw(im)
    # decorative diagonal threads
    for i in range(0, w, 90):
        draw.line([(i, 0), (i + h, h)], fill=(26, 22, 20, 8), width=1)
    # mark on the left
    draw_cap_and_head(im, draw, ox=60, oy=200, scale=1.5)
    # wordmark — sized so ValveHead + Z fits within (440 → 1140) = 700 px
    fnt_main = font(96, 'black')
    fnt_z = font(140, 'black')
    main = "ValveHead"
    draw.text((440, 270), main, font=fnt_main, fill=INK)
    main_w = text_w(draw, main, fnt_main)
    draw.text((440 + main_w - 4, 246), "Z", font=fnt_z, fill=BRAND)
    # tagline
    fnt_tag = font(26, 'medium')
    draw.text((440, 430), "Your face on a Schrader valve cap.",
              font=fnt_tag, fill=INK_MUTED)
    draw.text((440, 470), "$2 STL · printable on any FDM/PLA setup.",
              font=fnt_tag, fill=INK_MUTED)
    im.save(out_path)
    return im


def render_product_1_on_valve(out_path, w=1600, h=900):
    """Cap on a Schrader valve, three-quarter angle on a paper background."""
    im = Image.new('RGBA', (w, h), PAPER)
    draw = ImageDraw.Draw(im)
    # subtle paper grain
    for i in range(0, h + w, 120):
        draw.line([(i - h, 0), (i, h)], fill=(26, 22, 20, 6), width=1)
    # tire crescent (curve approximated by a wide ellipse anchored below the visible area)
    draw.pieslice([(-200, 600), (w + 200, 1700)], start=180, end=360, fill=INK)
    # rim shadow inside the tire
    draw.pieslice([(150, 720), (w - 150, 1620)], start=180, end=360, fill=(10, 9, 7, 255))
    # tread lines
    for ry in (800, 850, 880):
        draw.arc([(200, 250), (w - 200, ry + 350)], start=180, end=360,
                 fill=(45, 42, 38, 255), width=3)
    # valve stem (chrome cylinder)
    stem_x = 780; stem_y = 340
    stem_w = 40
    draw.rectangle([stem_x, stem_y, stem_x + stem_w, stem_y + 220], fill=(156, 152, 147, 255))
    draw.rectangle([stem_x + 4, stem_y + 4, stem_x + stem_w - 4, stem_y + 220], fill=(192, 188, 182, 255))
    draw.rectangle([stem_x + 14, stem_y + 4, stem_x + 20, stem_y + 220], fill=(229, 223, 211, 255))
    for ty in (148, 162, 176, 190):
        draw.rectangle([stem_x, stem_y + ty - 120, stem_x + stem_w, stem_y + ty - 116], fill=(123, 119, 112, 255))
    # printed cap (red) sitting on the stem
    cap_x = stem_x - 90; cap_y = 260
    draw.rounded_rectangle([cap_x, cap_y, cap_x + 220, cap_y + 120], radius=14, fill=BRAND)
    draw.rounded_rectangle([cap_x + 14, cap_y + 4, cap_x + 220 - 14, cap_y + 10], radius=3, fill=BRAND_LIGHT)
    for ty in (98, 108):
        draw.rectangle([cap_x, cap_y + ty, cap_x + 220, cap_y + ty + 6], fill=BRAND_DARK)
    # FDM layer lines on the cap
    for ly in range(20, 100, 12):
        draw.line([(cap_x, cap_y + ly), (cap_x + 220, cap_y + ly)], fill=(158, 24, 24, 110), width=1)
    # printed head silhouette on top of cap
    head_cx = cap_x + 110; head_cy = cap_y - 20
    draw.ellipse([head_cx - 50, head_cy - 50, head_cx + 50, head_cy + 50], fill=INK)
    draw.polygon([
        (head_cx - 42, head_cy + 30), (head_cx + 42, head_cy + 30),
        (head_cx + 38, head_cy + 60), (head_cx - 38, head_cy + 60)
    ], fill=INK)
    draw.rounded_rectangle([head_cx - 36, head_cy + 50, head_cx + 36, head_cy + 64], radius=6, fill=INK)
    # caption
    draw.text((60, 850), "PRESS KIT · PRODUCT 01 · CAP ON SCHRADER VALVE",
              font=font(18, 'medium'), fill=INK_MUTED)
    im.save(out_path)
    return im


def render_product_2_closeup(out_path, w=1600, h=900):
    im = Image.new('RGBA', (w, h), PAPER_SOFT)
    draw = ImageDraw.Draw(im)
    # workbench shadow
    draw.ellipse([(300, 700), (w - 300, 800)], fill=(26, 22, 20, 22))
    # main cap body (3/4 view emulation via rectangle + ellipse top)
    cap_x = 440; cap_y = 320
    cap_w = 720; cap_h = 380
    draw.rounded_rectangle([cap_x, cap_y + 40, cap_x + cap_w, cap_y + cap_h], radius=42, fill=BRAND)
    # right-side darker chamfer to imply 3D
    draw.polygon([
        (cap_x + cap_w - 30, cap_y + 40),
        (cap_x + cap_w, cap_y + 40),
        (cap_x + cap_w, cap_y + cap_h),
        (cap_x + cap_w - 30, cap_y + cap_h)
    ], fill=BRAND_DARK)
    # top oval (looks like 3D front-of-cap)
    draw.ellipse([cap_x, cap_y, cap_x + cap_w, cap_y + 128], fill=BRAND_LIGHT)
    draw.ellipse([cap_x + 40, cap_y + 14, cap_x + cap_w - 40, cap_y + 114], fill=PAPER)
    # threading bands at the bottom
    for ty in (370, 390, 410):
        draw.rectangle([cap_x, cap_y + ty, cap_x + cap_w, cap_y + ty + 8], fill=BRAND_DARK)
    # FDM layer lines
    for ly in range(80, 350, 24):
        draw.line([(cap_x, cap_y + ly), (cap_x + cap_w, cap_y + ly)],
                  fill=(158, 24, 24, 140), width=2)
    # printed head riding on top
    head_cx = cap_x + cap_w // 2; head_cy = cap_y - 60
    head_r = 170
    draw.ellipse([head_cx - head_r, head_cy - head_r,
                  head_cx + head_r, head_cy + head_r], fill=INK)
    draw.polygon([
        (head_cx - 158, head_cy + head_r - 30),
        (head_cx + 158, head_cy + head_r - 30),
        (head_cx + 130, head_cy + head_r + 70),
        (head_cx - 130, head_cy + head_r + 70)
    ], fill=INK)
    # head layer lines
    for ly in range(-100, 100, 28):
        draw.line([(head_cx - head_r + 20, head_cy + ly),
                   (head_cx + head_r - 20, head_cy + ly)],
                  fill=(58, 53, 48, 140), width=2)
    # 30 mm scale callout
    cx = 60; cy = 760
    draw.rounded_rectangle([cx, cy, cx + 160, cy + 44], radius=8,
                           fill=PAPER, outline=(26, 22, 20, 46), width=1)
    draw.line([(cx + 14, cy + 22), (cx + 146, cy + 22)], fill=INK, width=2)
    draw.line([(cx + 14, cy + 14), (cx + 14, cy + 30)], fill=INK, width=2)
    draw.line([(cx + 146, cy + 14), (cx + 146, cy + 30)], fill=INK, width=2)
    draw.text((cx + 80, cy + 14), "≈ 30 mm",
              font=font(14, 'medium'), fill=INK, anchor='mt')
    # caption
    draw.text((60, 850),
              "PRESS KIT · PRODUCT 02 · PRINTED CAP CLOSE-UP (FDM, PLA, 0.16 mm layers)",
              font=font(18, 'medium'), fill=INK_MUTED)
    im.save(out_path)
    return im


def render_product_3_pack(out_path, w=1600, h=900):
    im = Image.new('RGBA', (w, h), PAPER)
    draw = ImageDraw.Draw(im)
    # kraft card under the four caps
    draw.rounded_rectangle([80, 200, 1520, 700], radius=20, fill=PAPER_SOFT,
                           outline=PAPER_EDGE, width=2)
    # title across the card
    draw.text((800, 240), "PACK OF FOUR · YOUR CREW ON FOUR VALVES",
              font=font(28, 'black'), fill=INK, anchor='mt')
    # four caps lined up
    variants = [
        ('round',    180, None),
        ('hair',     500, None),
        ('profile',  820, None),
        ('glasses', 1140, None),
    ]
    for kind, x, _ in variants:
        # cap
        draw.rounded_rectangle([x, 410, x + 240, 570], radius=18, fill=BRAND)
        for ty in (530, 542):
            draw.rectangle([x, ty, x + 240, ty + 6], fill=BRAND_DARK)
        draw.rounded_rectangle([x + 14, 414, x + 240 - 14, 420], radius=3, fill=BRAND_LIGHT)
        # head (varies by `kind`)
        head_cx = x + 120; head_cy = 354
        head_r = 58
        draw.ellipse([head_cx - head_r, head_cy - head_r, head_cx + head_r, head_cy + head_r], fill=INK)
        draw.polygon([
            (head_cx - 46, head_cy + head_r - 8),
            (head_cx + 46, head_cy + head_r - 8),
            (head_cx + 42, head_cy + head_r + 22),
            (head_cx - 42, head_cy + head_r + 22)
        ], fill=INK)
        draw.rounded_rectangle([head_cx - 38, head_cy + head_r + 14,
                                head_cx + 38, head_cy + head_r + 28], radius=6, fill=INK)
        if kind == 'hair':
            # tuft on top
            draw.polygon([
                (head_cx - 28, head_cy - head_r - 4),
                (head_cx + 28, head_cy - head_r - 4),
                (head_cx + 14, head_cy - head_r - 22),
                (head_cx - 14, head_cy - head_r - 22),
            ], fill=INK)
        if kind == 'glasses':
            # tortoise frames
            draw.rounded_rectangle([head_cx - 36, head_cy - 4, head_cx - 6, head_cy + 16],
                                   radius=4, outline=PAPER, width=3)
            draw.rounded_rectangle([head_cx + 6, head_cy - 4, head_cx + 36, head_cy + 16],
                                   radius=4, outline=PAPER, width=3)
            draw.line([(head_cx - 6, head_cy + 6), (head_cx + 6, head_cy + 6)], fill=PAPER, width=3)
        if kind == 'profile':
            # paint over with a profile silhouette: mask a chunk of the right side
            draw.ellipse([head_cx - head_r + 18, head_cy - head_r + 6,
                          head_cx + head_r + 6, head_cy + head_r + 6],
                         fill=PAPER_SOFT)
            draw.ellipse([head_cx - head_r + 24, head_cy - head_r + 8,
                          head_cx + head_r + 8, head_cy + head_r + 8],
                         fill=INK)
    # caption
    draw.text((60, 850),
              "PRESS KIT · PRODUCT 03 · PACK OF FOUR ($59.99 TIER)",
              font=font(18, 'medium'), fill=INK_MUTED)
    im.save(out_path)
    return im


def main():
    PRESS.mkdir(parents=True, exist_ok=True)
    ICONS.mkdir(parents=True, exist_ok=True)
    # icons
    render_icon(ICONS / '512.png', size=512, masked=False)
    render_icon(ICONS / '192.png', size=192, masked=False)
    render_icon(ICONS / 'maskable-512.png', size=512, masked=True)
    render_favicon(PUB / 'favicon.png', size=256)
    # press
    render_wordmark(PRESS / 'logo-wordmark.png')
    render_monogram(PRESS / 'logo-monogram.png')
    render_palette(PRESS / 'palette.png')
    render_og(PUB / 'og.png')
    render_product_1_on_valve(PRESS / 'product-1-cap-on-valve.png')
    render_product_2_closeup(PRESS / 'product-2-cap-closeup.png')
    render_product_3_pack(PRESS / 'product-3-pack-of-four.png')
    print('rendered:')
    for p in [
        ICONS / '192.png', ICONS / '512.png', ICONS / 'maskable-512.png',
        PUB / 'favicon.png', PUB / 'og.png',
        PRESS / 'logo-wordmark.png', PRESS / 'logo-monogram.png',
        PRESS / 'palette.png',
        PRESS / 'product-1-cap-on-valve.png',
        PRESS / 'product-2-cap-closeup.png',
        PRESS / 'product-3-pack-of-four.png',
    ]:
        print(f'  {p}: {Image.open(p).size}')


if __name__ == '__main__':
    main()
