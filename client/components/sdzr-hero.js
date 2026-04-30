// Alternate landing-page hero variants lifted from the GumBall Assets
// prototype index.html. The Tweaks panel writes localStorage['sdz-hero']
// and the home page reads it to pick which variant to mount; default
// keeps the existing /home hero unchanged.
//
// Variants:
//   'cap'    — hero with a CSS-3D spinning valve cap (drag-to-spin
//              wired by SDZRadical.init via the .sdzr-cap class)
//   'card'   — single trading-card centerpiece
//   'sheet'  — die-cut sticker-sheet collage (draggable stickers)
//
// All three reuse the existing `--brand` / `--accent*` / `--paper` /
// `--ink` tokens — no pinned hexes leaking from the prototype's tokens.

import { el } from '../dom.js';

export const HERO_VARIANTS = ['default', 'cap', 'card', 'sheet'];

const STORAGE_KEY = 'sdz-hero';

export function getHeroVariant() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return HERO_VARIANTS.includes(v) ? v : 'default';
  } catch { return 'default'; }
}

export function setHeroVariant(variant) {
  if (!HERO_VARIANTS.includes(variant)) return;
  try { localStorage.setItem(STORAGE_KEY, variant); } catch { /* ignore */ }
  document.body.dataset.hero = variant;
}

function capRender() {
  // Pure CSS-3D dome — wired to drag-to-spin by SDZRadical.init.
  return el('div', { class: 'cap-shell' },
    el('div', { class: 'sdzr-cap', title: 'drag to spin' },
      el('div', { class: 'cap-cyl' },
        el('div', { class: 'cap-cyl__side' }),
        el('div', { class: 'cap-cyl__top' }),
      ),
      el('div', { class: 'cap-head' }),
      el('div', { class: 'cap-glasses' }),
    ),
  );
}

function variantCap() {
  return el('section', { class: 'sdzr-hero sdzr-hero--cap sdzr-bg-paper sdzr-grain' },
    el('svg', { class: 'sdzr-splatter absolute pointer-events-none', 'aria-hidden': 'true', style: { inset: '0', width: '100%', height: '100%' } }),
    el('div', { class: 'sdzr-hero__inner' },
      el('div', null,
        el('span', { class: 'sdzr-eyebrow' }, 'EST. 1993 · DROP 001 · STEMDOMEZ.COM'),
        el('h1', { class: 'sdzr-hero__title sdzr-display sdzr-shadow-tri' },
          'YOUR FACE.',
          el('br'),
          'ON A VALVE',
          el('br'),
          'CAP.',
        ),
        el('p', { class: 'sdzr-hero__sub' }, 'Drop a portrait. Microsoft TRELLIS sculpts your dome. We graft it onto a Schrader thread. Print STL. Screw on rim. Roll out.'),
        el('div', { style: { display: 'flex', gap: '0.8rem', flexWrap: 'wrap' } },
          el('a', { class: 'sdzr-cta', href: '/stemdome-generator', 'data-link': '' }, 'Make Yours →'),
          el('a', { class: 'sdzr-cta sdzr-cta--ghost', href: '/how-it-works', 'data-link': '' }, 'How it works'),
        ),
        el('div', { style: { marginTop: '1.5rem', display: 'flex', gap: '0.55rem', flexWrap: 'wrap' } },
          el('span', { class: 'sdzr-sticker sdzr-sticker--green', 'data-rot': '-4' }, '$2 STL'),
          el('span', { class: 'sdzr-sticker sdzr-sticker--magenta', 'data-rot': '3' }, 'FDM · PLA'),
          el('span', { class: 'sdzr-sticker sdzr-sticker--purple', 'data-rot': '-2' }, '0.4mm NOZZLE'),
          el('span', { class: 'sdzr-sticker sdzr-sticker--ink', 'data-rot': '5' }, 'SCHRADER FIT ✓'),
        ),
      ),
      el('div', { class: 'sdzr-cap-stage' },
        capRender(),
        el('div', { style: { position: 'absolute', bottom: '0', left: '0', right: '0', textAlign: 'center' } },
          el('span', { class: 'sdzr-eyebrow', style: { justifyContent: 'center' } }, 'DRAG TO SPIN ↻'),
        ),
      ),
    ),
  );
}

function variantCard() {
  return el('section', { class: 'sdzr-hero sdzr-hero--card sdzr-bg-magenta' },
    el('div', { class: 'sdzr-hero__inner' },
      el('div', { class: 'trading' },
        el('div', { class: 'sdzr-checker', style: { height: '10px', margin: '-0.3rem -0.3rem 0.6rem', border: '2px solid var(--ink)' } }),
        el('div', { class: 'trading__top' },
          el('span', { class: 'trading__rarity' }, '★ HOLOGRAPHIC ★'),
          el('span', { class: 'trading__no' }, '№ 001 / ∞'),
          el('div', { class: 'cap-shell', style: { width: '72%', height: '84%' } },
            el('div', { class: 'sdzr-cap', title: 'drag to spin' },
              el('div', { class: 'cap-cyl' },
                el('div', { class: 'cap-cyl__side' }),
                el('div', { class: 'cap-cyl__top' }),
              ),
              el('div', { class: 'cap-head' }),
              el('div', { class: 'cap-glasses' }),
            ),
          ),
        ),
        el('div', { class: 'trading__bot' },
          el('div', null,
            el('div', { class: 'sdzr-eyebrow' }, 'MONGOOSE BMX SERIES · 1993'),
            el('h1', {
              class: 'sdz-display sdzr-shadow-green',
              style: { fontSize: 'clamp(2.6rem, 7vw, 4.6rem)', margin: '0.5rem 0 0' },
            },
              'STEMDOME',
              el('span', { style: { color: 'var(--brand)' } }, 'Z'),
            ),
            el('p', {
              style: { margin: '0.6rem 0 0', maxWidth: '38ch', fontSize: '0.98rem', color: 'var(--ink)' },
            }, 'Trading-card-grade selfie cap. Photo in, STL out. Print, screw on, ride.'),
          ),
          el('a', { class: 'sdzr-cta', href: '/stemdome-generator', 'data-link': '' }, 'PULL ONE →'),
        ),
      ),
    ),
  );
}

function variantSheet() {
  return el('section', { class: 'sdzr-hero sdzr-hero--sheet sdzr-bg-paper-soft' },
    el('div', { class: 'sdzr-hero__inner' },
      el('div', { class: 'sheet', id: 'sheet' },
        el('div', { style: { position: 'absolute', top: '1rem', left: '1.5rem' } },
          el('span', { class: 'sdzr-eyebrow' }, 'DIE-CUT · PEEL N STICK · DROP 001'),
          el('h1', {
            class: 'sdz-display sdzr-shadow-tri',
            style: { fontSize: 'clamp(3rem, 8vw, 6rem)', margin: '0.4rem 0 0' },
          },
            'STICKER',
            el('br'),
            'SHEET.',
          ),
          el('p', { style: { maxWidth: '36ch', margin: '0.8rem 0', color: 'var(--ink)' } },
            'Drag stickers anywhere. Build your own catalog page.'),
          el('a', { class: 'sdzr-cta', href: '/stemdome-generator', 'data-link': '' }, 'Make Yours →'),
        ),
        // Stickers — wired draggable by SDZRadical.init
        el('span', { class: 'sdzr-sticker sdzr-sticker--green', style: { left: '50%', top: '12%' }, 'data-rot': '-8' }, 'RAD ✓'),
        el('span', { class: 'sdzr-sticker sdzr-sticker--magenta sdzr-sticker--circle', style: { left: '70%', top: '20%' }, 'data-rot': '6' }, 'PRINT IT YOURSELF'),
        el('span', { class: 'sdzr-sticker sdzr-sticker--purple sdzr-sticker--star', style: { left: '80%', top: '50%' }, 'data-rot': '-12' }, '$2 ONLY'),
        el('span', { class: 'sdzr-sticker sdzr-sticker--ink', style: { left: '55%', top: '60%' }, 'data-rot': '3' }, 'SCHRADER FIT'),
        el('span', {
          class: 'sdzr-sticker sdzr-sticker--green sdzr-sticker--circle',
          style: { left: '38%', top: '75%' },
          'data-rot': '14',
          html: 'FDM PLA<br>0.4mm',
        }),
        el('span', { class: 'sdzr-sticker sdzr-sticker--magenta', style: { left: '70%', top: '78%' }, 'data-rot': '-5' }, 'DROP 001'),
      ),
    ),
  );
}

export function SdzrHero({ variant }) {
  switch (variant) {
    case 'cap':   return variantCap();
    case 'card':  return variantCard();
    case 'sheet': return variantSheet();
    default:      return null;
  }
}
