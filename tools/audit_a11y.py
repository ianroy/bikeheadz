#!/usr/bin/env python3
"""
StemDomeZ — WCAG 2.2 contrast audit.

Computes the relative-luminance contrast ratio for every documented
text/background pairing in the Mongoose BMX palette across:
  • light theme (default)
  • dark theme (prefers-color-scheme: dark)
  • AAA opt-in ([data-contrast="aaa"])

WCAG thresholds:
  • Normal text (<18pt regular / <14pt bold)  AA  ≥ 4.5  ·  AAA ≥ 7.0
  • Large text (≥18pt regular / ≥14pt bold)   AA  ≥ 3.0  ·  AAA ≥ 4.5
  • UI components / non-text                   AA  ≥ 3.0
  • Decorative / pure-graphic                  no requirement

Exits non-zero if any required pair fails AA so we can wire this into
CI later (see roadmap P6-009).
"""
import sys


def _channel_linear(c):
    s = c / 255.0
    return s / 12.92 if s <= 0.03928 else ((s + 0.055) / 1.055) ** 2.4


def luminance(hex_color):
    h = hex_color.lstrip('#')
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return (0.2126 * _channel_linear(r) +
            0.7152 * _channel_linear(g) +
            0.0722 * _channel_linear(b))


def contrast(fg_hex, bg_hex):
    a, b = luminance(fg_hex), luminance(bg_hex)
    lo, hi = min(a, b), max(a, b)
    return (hi + 0.05) / (lo + 0.05)


# ── Token tables — must match client/styles/theme.css ────────────────────
LIGHT = {
    'paper':       '#F5F2E5',
    'paper-soft':  '#E5E0CC',
    'paper-edge':  '#D7CFB6',
    'card':        '#FFFFFF',
    'ink':         '#0E0A12',
    'ink-soft':    '#221A2C',
    'ink-muted':   '#3D2F4A',
    'ink-faint':   '#6B5C7B',
    'brand':       '#7B2EFF',
    'brand-dim':   '#5A1FCE',
    'brand-light': '#A267FF',
    'accent2':     '#2EFF8C',
    'accent2-dim': '#1FCE6E',
    'accent3':     '#FF2EAB',
    'accent3-dim': '#CE1F8B',
    'gold':        '#7C5E1F',  # darkened from #D89E2F (was 2.11, now 5.38)
    'white':       '#FFFFFF',
    # Chip surfaces — pinned literals (see .sdz-chip in theme.css).
    'chip-bg-fluoro':  '#2EFF8C',
    'chip-bg-magenta': '#FF2EAB',
    'chip-bg-purple':  '#7B2EFF',
    'chip-fg-ink':     '#0E0A12',
    'chip-fg-white':   '#FFFFFF',
    'cta-bg':          '#7B2EFF',
    'cta-fg':          '#FFFFFF',
}
DARK = {
    'paper':       '#110A1E',
    'paper-soft':  '#1B1228',
    'paper-edge':  '#3A2D54',
    'card':        '#1B1228',
    'ink':         '#F5F2E5',
    'ink-soft':    '#E2D6F2',
    'ink-muted':   '#BBA8D1',
    'ink-faint':   '#8C7BA8',
    'brand':       '#A267FF',  # lightened in dark mode (was #7B2EFF, only 3.39:1)
    'brand-dim':   '#C99EFF',  # hover lightens FURTHER (9.04:1 ✓)
    'brand-light': '#C99EFF',
    'accent2':     '#2EFF8C',
    'accent2-dim': '#1FCE6E',
    'accent3':     '#FF2EAB',
    'accent3-dim': '#CE1F8B',
    'gold':        '#D89E2F',
    'white':       '#FFFFFF',
    # Chip colors are pinned to literal hexes (see .sdz-chip rules in
    # theme.css) so they look identical in light + dark. Audit them
    # here as fixed surfaces, not as theme-tokens.
    'chip-bg-fluoro':  '#2EFF8C',
    'chip-bg-magenta': '#FF2EAB',
    'chip-bg-purple':  '#7B2EFF',
    'chip-fg-ink':     '#0E0A12',
    'chip-fg-white':   '#FFFFFF',
    # CTA surface is also pinned to literals (see .sdz-cta).
    'cta-bg':          '#7B2EFF',
    'cta-fg':          '#FFFFFF',
}
AAA = {
    **LIGHT,
    'brand':       '#5A1FCE',
    'brand-dim':   '#3D1494',
    'accent2':     '#1FCE6E',
    'accent3':     '#CE1F8B',
    'ink':         '#050307',
    'ink-soft':    '#14091F',
    'ink-muted':   '#2A1A40',
    # Chips stay at full saturation across all themes — that's what
    # the .sdz-chip rules in theme.css actually do (literal hexes,
    # not vars). Auditing them as theme-stable.
    'chip-bg-fluoro':  '#2EFF8C',
    'chip-bg-magenta': '#FF2EAB',
    'chip-bg-purple':  '#7B2EFF',
    # CTA also pinned to literals.
    'cta-bg':          '#7B2EFF',
    'cta-fg':          '#FFFFFF',
}

# ── Pairings to verify ──────────────────────────────────────────────────
# Each entry: (label, fg_token, bg_token, kind)
#   kind ∈ {'normal', 'large', 'ui', 'decorative'}
#   normal     → AA 4.5
#   large      → AA 3.0
#   ui         → AA 3.0  (component / icon / outline)
#   decorative → no threshold (still reported)
PAIRINGS = [
    # ── Body type ─────────────────────────────────────────────────────
    ('Body text',                          'ink',         'paper',       'normal'),
    ('Body text on soft card',             'ink',         'paper-soft',  'normal'),
    ('Body text on card',                  'ink',         'card',        'normal'),
    ('Soft heading',                       'ink-soft',    'paper',       'normal'),
    ('Muted secondary text',               'ink-muted',   'paper',       'normal'),
    ('Muted on soft card',                 'ink-muted',   'paper-soft',  'normal'),
    ('Faint meta text',                    'ink-faint',   'paper',       'normal'),

    # ── Brand-colored type ────────────────────────────────────────────
    ('Brand link / Z',                     'brand',       'paper',       'normal'),
    ('Brand-dim hover',                    'brand-dim',   'paper',       'normal'),
    ('Brand-light (large display only)',   'brand-light', 'paper',       'large'),

    # ── CTA button surfaces (literal-pinned, see .sdz-cta) ────────────
    ('Primary CTA label',                  'cta-fg',      'cta-bg',      'normal'),
    ('Secondary CTA label (ink on paper)', 'ink',         'paper',       'normal'),

    # ── Accent chips (pinned literal colors, see .sdz-chip rules) ─────
    ('Chip — fluoro / ink',                'chip-fg-ink',   'chip-bg-fluoro',  'normal'),
    ('Chip — magenta / ink',               'chip-fg-ink',   'chip-bg-magenta', 'normal'),
    ('Chip — purple / white',              'chip-fg-white', 'chip-bg-purple',  'normal'),

    # ── Decorative on cream (no AA requirement, but report) ───────────
    ('Fluoro green text on paper (decor)', 'accent2',     'paper',       'decorative'),
    ('Hot magenta text on paper',          'accent3',     'paper',       'large'),
    ('Gold/warning text on paper',         'gold',        'paper',       'normal'),

    # ── UI / non-text (3:1 AA) ────────────────────────────────────────
    ('Border/outline ink on paper',        'ink',         'paper',       'ui'),
    ('Active-nav indicator (brand bar)',   'brand',       'paper',       'ui'),
    ('Cap mark — brand on paper',          'brand',       'paper',       'ui'),
]

THRESHOLDS = {
    'normal':     ('AA 4.5',  4.5),
    'large':      ('AA 3.0',  3.0),
    'ui':         ('AA 3.0',  3.0),
    'decorative': ('—',       0.0),
}


def report(palette_name, palette):
    print(f'\n=== {palette_name} ===')
    print(f'{"PAIR":48} {"FG":9} {"BG":9} {"RATIO":>7} {"REQ":>7} {"STATUS":>6}')
    fails = []
    for label, fg, bg, kind in PAIRINGS:
        if fg not in palette or bg not in palette:
            continue
        fg_h, bg_h = palette[fg], palette[bg]
        ratio = contrast(fg_h, bg_h)
        thr_label, thr = THRESHOLDS[kind]
        if kind == 'decorative':
            status = '—'
        elif ratio >= thr:
            status = '✓'
        else:
            status = '✗'
            fails.append((label, fg, bg, ratio, thr_label, palette_name))
        print(f'{label:48} {fg_h:9} {bg_h:9} {ratio:7.2f}  {thr_label:>6}  {status:>6}')
    return fails


def main():
    print('StemDomeZ — WCAG 2.2 contrast audit')
    all_fails = []
    for name, pal in [('LIGHT', LIGHT), ('DARK', DARK), ('AAA opt-in', AAA)]:
        all_fails.extend(report(name, pal))

    print()
    if all_fails:
        print(f'FAIL — {len(all_fails)} pairing(s) below AA:')
        for label, fg, bg, ratio, thr_label, scheme in all_fails:
            print(f'  [{scheme}] {label}: {fg} on {bg} = {ratio:.2f} (need {thr_label})')
        sys.exit(1)
    else:
        print('PASS — every documented pairing meets AA.')
        sys.exit(0)


if __name__ == '__main__':
    main()
