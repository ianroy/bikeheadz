#!/usr/bin/env python3
"""
ValveHeadZ — retro-90s skate/BMX/surf-shop palette options.

The owner asked for a "retro 90s throwback brand — bike skate surf
shops from the era of rollerblading." Reference vocabulary:
Powell-Peralta, Mongoose BMX, Quiksilver, Stüssy, Vans, Town & Country,
World Industries, GT, Haro, Rollerblade Inc.

Every card here pairs a period-correct palette with the period
graphic vocabulary:
  - Italic/slanted heavy display type with a drop shadow.
  - Halftone-dot field behind the mark.
  - Splatter/spray dots near the wordmark.
  - Zigzag or checker accent strip.
  - Z gradient (solid for now; gradient renderer coming if picked).

Output: client/public/press/palette-options/{NN_name}.png  (1200×900)
plus a contact sheet `palette-options-contact.png` (3×2 grid).
"""
import math, pathlib, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / 'client/public/press/palette-options'
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Palettes — 6 distinct 90s sub-aesthetics.
# Order: (slug, label, tagline, paper, paper_soft, ink, ink_muted, accent, accent2, accent3)
# `accent` is the dominant brand color (the Z, CTAs).
# `accent2` is a complementary punch (chips, secondary CTAs).
# `accent3` is the third "trio" color used in halftone dots / splatters.
PALETTES = [
    (
        '01_roller_mania',
        'Roller Mania',
        'Peak rollerblade. Hot pink + electric teal + acid lime. 1995, full send.',
        '#FFF8EE',  # paper (bone)
        '#FCE9CC',  # paper soft (cream-tan)
        '#1A0E26',  # ink (cosmic eggplant)
        '#5C3F70',  # ink muted (faded purple)
        '#FF2D87',  # accent (hot pink) — the Z
        '#16D2C2',  # accent2 (electric teal)
        '#D6FF3D',  # accent3 (acid lime) — splatter
    ),
    (
        '02_mongoose_bmx',
        'Mongoose BMX',
        'Race day at the trails, 1993. Neon purple + fluoro green + magenta.',
        '#F5F2E5',  # paper (off-white)
        '#E5E0CC',  # paper soft
        '#0E0A12',  # ink (carbon)
        '#3D2F4A',  # ink muted (deep mauve)
        '#7B2EFF',  # accent (neon purple) — the Z
        '#2EFF8C',  # accent2 (fluoro green)
        '#FF2EAB',  # accent3 (magenta)
    ),
    (
        '03_powell_peralta',
        'Powell-Peralta',
        'Skate deck graphics. Splat red + hot yellow on bone, with black ink.',
        '#F2EBD9',  # paper (yellowed bone)
        '#E8DEC0',  # paper soft (aged paper)
        '#10100E',  # ink (deck black)
        '#5A4F38',  # ink muted (worn pencil)
        '#E03127',  # accent (splat red)
        '#FFC417',  # accent2 (hot yellow)
        '#0B6FA8',  # accent3 (deep cyan — for halftones)
    ),
    (
        '04_quiksilver_sunset',
        'Quiksilver Sunset',
        'Surf shop circa 1993. Sunset coral + lagoon teal + white sand.',
        '#FBF1E2',  # paper (warm cream)
        '#F2E2C8',  # paper soft (sand)
        '#221421',  # ink (deep plum)
        '#7A4E66',  # ink muted (dusty rose)
        '#FF5E3A',  # accent (sunset coral) — the Z
        '#1FBFC1',  # accent2 (lagoon teal)
        '#FFB347',  # accent3 (peach)
    ),
    (
        '05_vans_offthewall',
        'Vans Off-the-Wall',
        'Street-skate 90s, less neon. Burgundy + mustard + cream.',
        '#F4ECDB',  # paper (cream)
        '#E6DAC0',  # paper soft (kraft)
        '#1A0F0A',  # ink (chocolate black)
        '#6A554A',  # ink muted (faded leather)
        '#7C1F2D',  # accent (burgundy) — the Z
        '#D89E2F',  # accent2 (mustard)
        '#3F6A57',  # accent3 (forest)
    ),
    (
        '06_stussy_classic',
        'Stüssy Classic',
        'Streetwear 1991. Cyan + magenta + mustard on cream — CMY trio.',
        '#F8F1E0',  # paper (warm cream)
        '#EBDFC2',  # paper soft
        '#0A0A0A',  # ink (true black)
        '#5A5651',  # ink muted (concrete)
        '#1B7BD6',  # accent (process cyan) — the Z
        '#E61E73',  # accent2 (process magenta)
        '#F2C019',  # accent3 (process yellow)
    ),
]


# ── Font helpers ─────────────────────────────────────────────────────────
def font(size, weight='black', italic=False):
    candidates = [
        '/System/Library/Fonts/HelveticaNeue.ttc',
        '/System/Library/Fonts/Helvetica.ttc',
        '/System/Library/Fonts/SFNS.ttf',
        '/System/Library/Fonts/SFNSItalic.ttf' if italic else None,
    ]
    candidates = [c for c in candidates if c]
    for path in candidates:
        try:
            f = ImageFont.truetype(path, size, index=0)
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
    try:
        l, t, r, b = draw.textbbox((0, 0), text, font=fnt)
        return r - l
    except Exception:
        return draw.textsize(text, font=fnt)[0]


def hex_to_rgb(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def with_alpha(rgb, a):
    return (rgb[0], rgb[1], rgb[2], int(a * 255))


def shade(rgb_or_hex, amount):
    if isinstance(rgb_or_hex, str):
        rgb_or_hex = hex_to_rgb(rgb_or_hex)
    r, g, b = rgb_or_hex[:3]
    if amount >= 1.0:
        f = amount - 1.0
        r = int(r + (255 - r) * f); g = int(g + (255 - g) * f); b = int(b + (255 - b) * f)
    else:
        r = int(r * amount); g = int(g * amount); b = int(b * amount)
    return (max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)), 255)


def draw_italic_text(draw, xy, text, font_obj, fill, skew=0.18, shadow=None):
    """Render text into a temporary bitmap, shear-X for italic, paste."""
    # Measure
    l, t, r, b = draw.textbbox((0, 0), text, font=font_obj)
    tw = r - l + 20; th = b - t + 20
    layer = Image.new('RGBA', (tw, th), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    if shadow:
        ld.text((-l + 6, -t + 6), text, font=font_obj, fill=shadow)
    ld.text((-l + 0, -t + 0), text, font=font_obj, fill=fill)
    # Shear
    sheared = layer.transform(
        (tw + int(th * skew), th),
        Image.AFFINE,
        (1, -skew, 0, 0, 1, 0),
        resample=Image.BICUBIC,
    )
    draw._image.paste(sheared, (xy[0], xy[1]), sheared)
    return sheared.size


# ── Halftone field — Ben-Day dots in `color`, density falling off radially.
def draw_halftone_field(im, color, ox, oy, w, h, dot_min=2, dot_max=10, spacing=22):
    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    cx, cy = w // 2, h // 2
    max_d = math.hypot(cx, cy)
    for y in range(0, h, spacing):
        for x in range((y // spacing) % 2 * (spacing // 2), w, spacing):
            d = math.hypot(x - cx, y - cy)
            t = 1 - d / max_d
            r = int(dot_min + (dot_max - dot_min) * max(0, t))
            if r < 1: continue
            ld.ellipse([x - r, y - r, x + r, y + r], fill=color)
    im.paste(layer, (ox, oy), layer)


# ── Splatter / spray dots near the wordmark.
def draw_splatter(im, ox, oy, w, h, accent, accent2, seed=11):
    rng = random.Random(seed)
    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    for _ in range(80):
        x = rng.randint(0, w); y = rng.randint(0, h)
        r = rng.choice([1, 1, 2, 2, 3, 4, 6])
        c = rng.choice([accent, accent, accent2])
        c = with_alpha(c, rng.uniform(0.35, 0.95))
        ld.ellipse([x - r, y - r, x + r, y + r], fill=c)
    im.paste(layer, (ox, oy), layer)


# ── Zigzag accent strip.
def draw_zigzag(draw, x, y, w, color, height=14, period=24, width=4):
    pts = []
    cx = x
    up = True
    while cx <= x + w:
        pts.append((cx, y if up else y + height))
        cx += period // 2
        up = not up
    for i in range(len(pts) - 1):
        draw.line([pts[i], pts[i + 1]], fill=color, width=width)


# ── The cap+head mark, recolored per palette ─────────────────────────────
def draw_mark(im, draw, ox, oy, scale, paper, ink, accent, accent_dark, accent_light):
    s = scale
    def S(v): return int(round(v * s))
    cap_l = ox + S(10); cap_t = oy + S(155); cap_w = S(220); cap_h = S(95)
    cap_r = cap_l + cap_w; cap_b = cap_t + cap_h
    draw.rectangle([cap_l, cap_t, cap_r, cap_b], fill=accent)
    top_dh = S(18)
    draw.ellipse([cap_l, cap_t - top_dh, cap_r, cap_t + top_dh], fill=accent_light)
    draw.ellipse([cap_l + S(6), cap_t - top_dh + S(4), cap_r - S(6), cap_t + top_dh - S(4)], fill=accent)
    draw.ellipse([cap_l, cap_b - S(8), cap_r, cap_b + top_dh], fill=accent_dark)
    for ty in (cap_h - 38, cap_h - 24, cap_h - 10):
        draw.rectangle([cap_l + S(2), cap_t + S(ty), cap_r - S(2), cap_t + S(ty + 5)], fill=accent_dark)
    head_cx = cap_l + cap_w // 2 + S(6)
    head_cy = cap_t - S(64)
    def H(dx, dy): return (head_cx + S(dx), head_cy + S(dy))
    head_points = [
        H(-12,-78), H(8,-78), H(28,-72), H(46,-60), H(58,-42), H(64,-22),
        H(67,-8), H(70,4), H(80,14), H(70,24), H(72,30), H(66,38), H(64,46),
        H(60,54), H(48,62), H(28,66), H(2,66), H(-22,62), H(-44,52),
        H(-58,34), H(-66,10), H(-70,-16), H(-66,-42), H(-54,-64), H(-32,-76),
    ]
    draw.polygon(head_points, fill=ink)
    draw.rectangle([head_cx - S(24), head_cy + S(60), head_cx + S(24), cap_t - S(2)], fill=ink)
    g_y = head_cy - S(8); g_h = S(15)
    draw.rounded_rectangle([head_cx + S(28), g_y, head_cx + S(60), g_y + g_h], radius=S(3), fill=paper)
    draw.rounded_rectangle([head_cx + S(31), g_y + S(2), head_cx + S(57), g_y + g_h - S(2)], radius=S(2), fill=ink)
    draw.rounded_rectangle([head_cx + S(4), g_y, head_cx + S(22), g_y + g_h], radius=S(3), fill=paper)
    draw.rounded_rectangle([head_cx + S(7), g_y + S(2), head_cx + S(19), g_y + g_h - S(2)], radius=S(2), fill=ink)
    draw.rectangle([head_cx + S(22), g_y + S(5), head_cx + S(28), g_y + S(9)], fill=paper)


# ── Build one palette card with 90s chrome. ──────────────────────────────
def render_card(slug, label, tagline,
                paper_hex, paper_soft_hex, ink_hex, ink_muted_hex,
                accent_hex, accent2_hex, accent3_hex,
                out_path, w=1200, h=900):
    paper = hex_to_rgb(paper_hex)
    paper_soft = hex_to_rgb(paper_soft_hex)
    ink = hex_to_rgb(ink_hex)
    ink_muted = hex_to_rgb(ink_muted_hex)
    accent = hex_to_rgb(accent_hex)
    accent2 = hex_to_rgb(accent2_hex)
    accent3 = hex_to_rgb(accent3_hex)
    accent_dark = shade(accent_hex, 0.78)
    accent_light = shade(accent_hex, 1.18)

    im = Image.new('RGBA', (w, h), paper)
    draw = ImageDraw.Draw(im)

    # Halftone field bottom-right corner (period detail).
    draw_halftone_field(im, with_alpha(accent3, 0.55), ox=600, oy=300, w=600, h=600,
                        dot_min=1, dot_max=12, spacing=26)
    # Checker strip at the very top.
    cs_h = 24
    for i in range(0, w, cs_h):
        c = ink if (i // cs_h) % 2 == 0 else accent2
        draw.rectangle([i, 0, i + cs_h, cs_h], fill=c)
    # Zigzag under the checker strip.
    draw_zigzag(draw, x=0, y=cs_h + 6, w=w, color=accent, height=10, period=22, width=3)

    # Title strip.
    draw.text((50, 60), label.upper(), font=font(38, 'black'), fill=ink)
    draw.text((50, 110), tagline, font=font(20, 'medium'), fill=ink_muted)

    # Splatter near the wordmark area.
    draw_splatter(im, ox=20, oy=160, w=900, h=320, accent=accent, accent2=accent2, seed=hash(slug) & 0xFFFF)

    # Wordmark — italic, with drop shadow. "ValveHead" ink + oversized "Z" accent.
    fnt_main = font(120, 'black')
    main_str = "ValveHead"
    drop = with_alpha(ink, 0.22)
    draw_italic_text(draw, (50, 200), main_str, fnt_main, fill=ink, skew=0.16, shadow=drop)
    # Z accent — render large italic Z in accent.
    fnt_z = font(190, 'black')
    main_w = text_w(draw, main_str, fnt_main)
    skew_z = 0.16
    sheared_w_est = int(main_w + 190 * skew_z)
    draw_italic_text(draw, (50 + sheared_w_est - 14, 178), "Z", fnt_z, fill=accent, skew=0.16, shadow=drop)

    # Tagline below wordmark.
    fnt_tag = font(22, 'medium')
    draw.text((50, 360), 'YOUR FACE ON A SCHRADER VALVE CAP', font=fnt_tag, fill=ink_muted)

    # Mark on the right.
    draw_mark(im, draw, ox=720, oy=140, scale=1.5,
              paper=paper, ink=ink, accent=accent,
              accent_dark=accent_dark, accent_light=accent_light)

    # CTA buttons row.
    cta_x, cta_y = 50, 440
    # Primary CTA (accent fill).
    draw.rounded_rectangle([cta_x, cta_y, cta_x + 280, cta_y + 64], radius=14, fill=accent)
    # 90s Memphis offset — duplicate behind in accent2.
    draw.rounded_rectangle([cta_x + 6, cta_y + 6, cta_x + 286, cta_y + 70], radius=14, fill=accent2)
    draw.rounded_rectangle([cta_x, cta_y, cta_x + 280, cta_y + 64], radius=14, fill=accent)
    draw.text((cta_x + 24, cta_y + 18), "GENERATE  →", font=font(24, 'black'), fill=paper)
    # Secondary outlined CTA.
    s_x = cta_x + 320
    draw.rounded_rectangle([s_x, cta_y, s_x + 220, cta_y + 64], radius=14, outline=ink, width=4, fill=paper_soft)
    draw.text((s_x + 26, cta_y + 18), "PRICING", font=font(24, 'black'), fill=ink)

    # 5 swatches across the bottom (paper, accent, accent2, accent3, ink).
    swatches = [
        ('PAPER',  paper_hex,       paper, ink),
        ('ACCENT', accent_hex,      accent, paper),
        ('ACC. 2', accent2_hex,     accent2, ink if sum(accent2[:3]) > 380 else paper),
        ('ACC. 3', accent3_hex,     accent3, ink if sum(accent3[:3]) > 380 else paper),
        ('MUTED',  ink_muted_hex,   ink_muted, paper),
        ('INK',    ink_hex,         ink, paper),
    ]
    sw_w = (w - 100 - 5 * 14) // 6
    sw_h = 200
    sw_y = h - sw_h - 50
    for i, (label_, hex_, fill, fg) in enumerate(swatches):
        x = 50 + i * (sw_w + 14)
        # Memphis-style shadow box behind the swatch.
        draw.rectangle([x + 6, sw_y + 6, x + sw_w + 6, sw_y + sw_h + 6], fill=ink)
        draw.rounded_rectangle([x, sw_y, x + sw_w, sw_y + sw_h], radius=6, fill=fill)
        if fill in (paper, paper_soft):
            draw.rounded_rectangle([x, sw_y, x + sw_w, sw_y + sw_h], radius=6,
                                   outline=ink, width=2)
        draw.text((x + 12, sw_y + sw_h - 60), label_, font=font(18, 'black'), fill=fg)
        draw.text((x + 12, sw_y + sw_h - 32), hex_, font=font(15, 'medium'), fill=fg)

    # Number badge (top-right) — 90s ZINE-style.
    badge_x, badge_y = w - 130, 56
    draw.rectangle([badge_x, badge_y, badge_x + 80, badge_y + 80], fill=ink)
    draw.text((badge_x + 16, badge_y + 18), slug.split('_')[0], font=font(36, 'black'), fill=accent)

    im.save(out_path)
    return im


def main():
    cards = []
    for p in PALETTES:
        slug, label, tagline, paper, paper_soft, ink, ink_muted, accent, accent2, accent3 = p
        out = OUT_DIR / f'{slug}.png'
        render_card(slug, label, tagline, paper, paper_soft, ink, ink_muted,
                    accent, accent2, accent3, out_path=out)
        cards.append(out)
        print(f'rendered: {out}')
    # Contact sheet — 3×2 grid.
    sheet = Image.new('RGBA', (1200 * 3, 900 * 2), (255, 255, 255, 255))
    for i, p in enumerate(cards):
        col, row = i % 3, i // 3
        sheet.paste(Image.open(p), (col * 1200, row * 900))
    sheet.thumbnail((2400, 1600), Image.LANCZOS)
    sheet.save(OUT_DIR / 'palette-options-contact.png')
    print(f"contact sheet: {OUT_DIR / 'palette-options-contact.png'}")


if __name__ == '__main__':
    main()
