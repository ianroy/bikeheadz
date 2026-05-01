// /press — press kit / brand assets / about page.
//
// Pinned-light shell using sdzr-* tokens so it renders the same in
// light and dark mode (matches /sixpack and the legal pages). Section
// flow: hero + contact → boilerplate (3 lengths) → quick facts →
// brand assets (wordmark + monogram + palette) → product imagery →
// long-form about → press contact + ZIP placeholder.

import { el } from '../dom.js';

// ── Brand palette — pinned Mongoose-BMX literals per brandstandards.MD §14
const PALETTE = [
  { name: 'Workshop ink',    hex: '#0E0A12', token: '--sdzr-ink',        light: false, note: 'Body type, borders, dark surfaces.' },
  { name: 'Workshop paper',  hex: '#F5F2E5', token: '--sdzr-paper',      light: true,  note: 'Default page background.' },
  { name: 'Paper soft',      hex: '#E5E0CC', token: '--sdzr-paper-soft', light: true,  note: 'Inset cards on operator pages (§17).' },
  { name: 'Neon purple',     hex: '#7B2EFF', token: '--sdzr-brand',      light: false, note: 'Primary brand. The trailing Z.' },
  { name: 'Fluoro green',    hex: '#2EFF8C', token: '--sdzr-accent2',    light: true,  note: 'Drop shadows. Accent stickers.' },
  { name: 'Hot magenta',     hex: '#FF2EAB', token: '--sdzr-accent3',    light: false, note: 'Secondary accent. Memphis offsets.' },
];

const BOILERPLATE_TWEET = "StemDomeZ turns a portrait photo into a 3D-printable Schrader valve cap shaped like your face. Made in a workshop. Free during launch. → stemdomez.com";

const BOILERPLATE_SHORT = "StemDomeZ is an indie maker product that takes a portrait photo and outputs a 3D-printable bike-valve cap shaped like the rider’s head. Built for the Gumball Machine Takeover residency at Sadie’s Bikes (Great Falls, MA). Free during launch.";

const BOILERPLATE_LONG = "StemDomeZ is a working e-commerce site that turns a portrait photo into a personalised, 3D-printable Schrader valve-stem cap — your face, on the rim. Built for the Gumball Machine Takeover, a curatorial residency run by Sadie's Bikes out of Great (Turners) Falls, Massachusetts, the project ships caps in 50¢ gumball-machine capsules at Waterway Arts during First Friday and points buyers to a URL inside the capsule. The pipeline runs Microsoft TRELLIS image-to-3D on a serverless GPU, then a 7-stage CAD process grafts the head onto a fixed Schrader thread. Output is a binary STL the user prints at home on a 0.4 mm-nozzle FDM printer (or orders printed and shipped). The machine is the flyer. The capsule is the box. The cap is the product. The site is real and it ships.";

const QUICK_FACTS = [
  ['Launched',      '2026 — Gumball Machine Takeover · Sadie’s Bikes'],
  ['Based in',      'Great (Turners) Falls, Massachusetts'],
  ['Maker',         'Ian Roy · ianroy.org'],
  ['Pricing',       'Free during launch · $2 STL after (use SADYSBIKES)'],
  ['Tech stack',    'Vite · Three.js · Node 22 · Express · socket.io · Postgres 18 · DigitalOcean · RunPod GPU · Microsoft TRELLIS · Stripe'],
  ['Print spec',    'FDM · PLA · 0.4 mm nozzle · 0.12–0.16 mm layer · ~30 mm tall · 50–80K tris · binary STL'],
  ['Source',        'github.com/ianroy/bikeheadz · MIT'],
  ['Contact',       'press@stemdomez.com'],
];

const ABOUT_LONG_PARAGRAPHS = [
  ['StemDomeZ was built for the ', el('strong', null, 'Gumball Machine Takeover'),
   ' — a curatorial residency run by ',
   el('a', { href: 'https://www.instagram.com/sadiesbikes/', target: '_blank', rel: 'noopener noreferrer',
            style: { color: '#0E0A12', textDecoration: 'underline', textDecorationColor: '#7B2EFF', textDecorationThickness: '3px' } },
      'Sadie’s Bikes'),
   ' out of Great (Turners) Falls, Massachusetts. The brief: come up with 200 things that fit inside a 2″ capsule, and sell each one for 50¢.'],
  ['So I made a working e-commerce site that prints custom valve-stem caps from a photo of your face, packed it into capsules at ',
   el('strong', null, 'Waterway Arts'), ', and pointed people at the URL on the card inside. The machine is the flyer. The capsule is the box. The cap is the product. The site is real and it ships.'],
  ['Opens First Friday with snacks. ', el('strong', null, 'Anything left over rides around in the grab-bag machine'),
   ' at The Wagon Wheel and The Upper Bend until the capsules run out. Big thanks to ',
   el('strong', null, 'Nik Perry'), ' for the invitation and the constraints — both of which made the work better.'],
];

// ── Style helpers — all pinned literals so dark-mode doesn't break it ─────

const PAPER     = '#F5F2E5';
const PAPER_SOFT= '#E5E0CC';
const INK       = '#0E0A12';
const INK_MUTED = '#3D2F4A';
const BRAND     = '#7B2EFF';
const ACCENT2   = '#2EFF8C';
const ACCENT3   = '#FF2EAB';

function card(children, opts = {}) {
  return el('section', {
    style: {
      position: 'relative',
      background: opts.bg || PAPER_SOFT,
      border: '2px solid ' + INK,
      borderRadius: '12px',
      padding: opts.pad || '20px 22px',
      marginTop: '20px',
      ...(opts.style || {}),
    },
  }, ...children);
}

function sectionHeading(eyebrow, title, shadowColor = ACCENT2) {
  return el('div', { style: { marginBottom: '14px' } },
    el('span', {
      style: {
        display: 'inline-block',
        fontFamily: 'ui-monospace, monospace',
        fontSize: '0.74rem',
        fontWeight: 700,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: BRAND,
        marginBottom: '4px',
      },
    }, eyebrow),
    el('h2', {
      class: 'sdz-display',
      style: {
        fontSize: 'clamp(1.6rem, 3vw, 2rem)',
        color: INK,
        textShadow: '3px 3px 0 ' + shadowColor,
        margin: '0 0 0.4rem',
        fontStyle: 'italic',
        lineHeight: '1',
        textTransform: 'uppercase',
        letterSpacing: '-0.02em',
      },
    }, title),
  );
}

function copyButton(label, value) {
  return el('button', {
    type: 'button',
    style: {
      padding: '6px 12px',
      background: INK,
      color: PAPER,
      border: '2px solid ' + INK,
      fontFamily: 'ui-monospace, monospace',
      fontSize: '0.75rem',
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      cursor: 'pointer',
      boxShadow: '3px 3px 0 ' + ACCENT3,
    },
    onClick: (e) => {
      navigator.clipboard?.writeText(value).then(() => {
        const btn = e.currentTarget;
        const orig = btn.textContent;
        btn.textContent = '✓ COPIED';
        setTimeout(() => { btn.textContent = orig; }, 1200);
      }).catch(() => {});
    },
  }, label);
}

// ── Brand assets ──────────────────────────────────────────────────────────

function wordmarkBlock() {
  return el('div', { style: { display: 'grid', gridTemplateColumns: '1fr', gap: '14px' } },
    el('div', {
      style: {
        background: PAPER,
        border: '2px solid ' + INK,
        borderRadius: '8px',
        padding: '40px 24px',
        textAlign: 'center',
      },
    },
      // Brand wordmark — italic, magenta Z + green drop shadow per §1.
      el('span', {
        class: 'sdz-display sdz-wordmark',
        style: {
          fontSize: 'clamp(3rem, 8vw, 5rem)',
          color: INK,
          textShadow: '5px 5px 0 ' + ACCENT2,
          fontStyle: 'italic',
          fontWeight: 900,
          letterSpacing: '-0.03em',
          lineHeight: '1',
        },
      },
        'StemDome',
        el('span', { style: { color: BRAND, fontStyle: 'italic', fontSize: '1.15em', marginLeft: '-0.05em' } }, 'Z'),
      ),
    ),
    el('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
      el('a', {
        href: '/press/logo-wordmark.png',
        download: 'stemdomez-wordmark.png',
        style: assetButtonStyle(),
      }, '↓ PNG'),
      el('a', {
        href: '/press/logo-wordmark.svg',
        download: 'stemdomez-wordmark.svg',
        style: assetButtonStyle(),
      }, '↓ SVG'),
      copyButton('COPY WORDMARK SPEC', 'StemDomeZ — italic, weight 900, letter-spacing -0.03em. The trailing "Z" is neon purple #7B2EFF; the wordmark sits on cream paper #F5F2E5 with a fluoro-green drop shadow #2EFF8C at 5px/5px offset.'),
    ),
  );
}

function monogramBlock() {
  return el('div', { style: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '20px', alignItems: 'center' } },
    el('div', {
      style: {
        background: PAPER,
        border: '2px solid ' + INK,
        borderRadius: '8px',
        padding: '20px',
        display: 'grid',
        placeItems: 'center',
        minWidth: '160px',
      },
    },
      el('img', {
        src: '/press/logo-monogram.png',
        alt: 'StemDomeZ monogram — cap, head, and the SDZ letterform',
        style: { width: '120px', height: 'auto', display: 'block' },
      }),
    ),
    el('div', null,
      el('p', {
        style: { color: INK, fontSize: '0.95rem', lineHeight: '1.5', margin: '0 0 10px' },
      },
        'For favicons, app icons, and tight spaces. The cap-and-head mark sits on a magenta tile with a fluoro-green Memphis offset behind it. Background-safe at 24 px and up.',
      ),
      el('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
        el('a', { href: '/press/logo-monogram.png', download: 'stemdomez-monogram.png', style: assetButtonStyle() }, '↓ PNG'),
        el('a', { href: '/press/logo-monogram.svg', download: 'stemdomez-monogram.svg', style: assetButtonStyle() }, '↓ SVG'),
      ),
    ),
  );
}

function paletteSwatch({ name, hex, token, light, note }) {
  return el('div', {
    style: {
      background: hex,
      color: light ? INK : '#FFFFFF',
      borderRadius: '8px',
      border: '2px solid ' + INK,
      padding: '16px 14px',
      minHeight: '140px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '8px',
    },
  },
    el('div', null,
      el('div', { style: { fontFamily: 'Anton, sans-serif', fontStyle: 'italic', fontWeight: 900, fontSize: '1.05rem', letterSpacing: '0.02em', textTransform: 'uppercase' } }, name),
      el('div', { style: { fontFamily: 'ui-monospace, monospace', fontSize: '0.78rem', opacity: 0.92, marginTop: '2px' } }, hex.toUpperCase()),
      el('div', { style: { fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem', opacity: 0.78 } }, token),
    ),
    el('div', { style: { fontSize: '0.72rem', lineHeight: '1.35', opacity: 0.92, fontStyle: 'italic' } }, note),
  );
}

function assetButtonStyle() {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    background: INK,
    color: ACCENT2,
    border: '2px solid ' + INK,
    padding: '8px 14px',
    fontFamily: 'Anton, sans-serif',
    fontStyle: 'italic',
    fontSize: '0.95rem',
    letterSpacing: '0.04em',
    textDecoration: 'none',
    boxShadow: '3px 3px 0 ' + ACCENT3,
  };
}

// ── Product imagery — Sixpack lore + the existing product PNGs ────────────

function productGrid() {
  const items = [
    { src: '/valve-models/thumbs/professor.png',     name: 'The Professor',     sub: 'Sixpack · № 01' },
    { src: '/valve-models/thumbs/captain.png',       name: 'The Captain',       sub: 'Sixpack · № 02' },
    { src: '/valve-models/thumbs/big-mick.png',      name: 'Big Mick',          sub: 'Sixpack · № 03' },
    { src: '/valve-models/thumbs/the-wooly.png',     name: 'Little Space Bear', sub: 'Sixpack · № 04' },
    { src: '/valve-models/thumbs/old-reliable.png',  name: 'Old Reliable',      sub: 'Sixpack · № 05' },
    { src: '/valve-models/thumbs/the-cobra.png',     name: 'Sasquatch Foot',    sub: 'Sixpack · № 06' },
    { src: '/press/product-1-cap-on-valve.png',      name: 'Cap on a valve',    sub: 'Product photo' },
    { src: '/press/product-2-cap-closeup.png',       name: 'Cap close-up',      sub: 'Product photo' },
    { src: '/press/product-3-pack-of-four.png',      name: 'Pack of four',      sub: 'Product photo' },
  ];
  return el('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: '14px',
    },
  },
    ...items.map((item) => el('figure', {
      style: {
        margin: 0,
        background: PAPER,
        border: '2px solid ' + INK,
        borderRadius: '8px',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      },
    },
      el('div', {
        style: {
          aspectRatio: '1 / 1',
          background: INK,
          border: '2px solid ' + INK,
          borderRadius: '4px',
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
        },
      },
        el('img', {
          src: item.src,
          alt: item.name,
          loading: 'lazy',
          decoding: 'async',
          style: { width: '88%', height: '88%', objectFit: 'contain' },
        }),
      ),
      el('figcaption', null,
        el('div', { style: { fontFamily: 'Anton, sans-serif', fontStyle: 'italic', fontWeight: 900, fontSize: '0.95rem', color: INK, lineHeight: '1' } }, item.name),
        el('div', { style: { fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem', color: INK_MUTED, marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.06em' } }, item.sub),
      ),
    )),
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export function PressPage() {
  const root = el('div', {
    class: 'sdzr-bg-paper-soft',
    style: { padding: '48px 0 64px', borderTop: '3px solid ' + INK, borderBottom: '3px solid ' + INK },
  });

  const wrap = el('main', {
    style: {
      maxWidth: '960px',
      margin: '0 auto',
      padding: '0 24px',
      color: INK,
      position: 'relative',
    },
  });
  root.appendChild(wrap);

  // ── Hero ──────────────────────────────────────────────────────────────
  wrap.appendChild(el('span', {
    style: {
      display: 'inline-block',
      fontFamily: 'ui-monospace, monospace',
      fontSize: '0.78rem',
      fontWeight: 700,
      letterSpacing: '0.2em',
      textTransform: 'uppercase',
      color: BRAND,
      marginBottom: '4px',
    },
  }, 'PRESS · BRAND ASSETS · BOILERPLATE'));
  wrap.appendChild(el('h1', {
    class: 'sdz-display',
    style: {
      fontSize: 'clamp(2.6rem, 6vw, 4rem)',
      color: INK,
      textShadow: '5px 5px 0 ' + ACCENT2 + ', 9px 9px 0 ' + BRAND,
      margin: '0 0 16px',
      fontStyle: 'italic',
      lineHeight: '0.92',
      textTransform: 'uppercase',
      letterSpacing: '-0.02em',
    },
  }, 'PRESS KIT.'));
  wrap.appendChild(el('p', {
    style: { color: INK, fontSize: '1.05rem', lineHeight: '1.55', maxWidth: '60ch', margin: '0 0 18px' },
  },
    'Brand assets, palette, product imagery, and three lengths of boilerplate. Use them freely — credit appreciated, not required. For interview requests, samples to print, or anything not covered here, email ',
    el('a', { href: 'mailto:press@stemdomez.com', style: { color: BRAND, fontWeight: 700, textDecoration: 'underline', textDecorationThickness: '2px' } }, 'press@stemdomez.com'),
    '.',
  ));
  // Sticker
  wrap.appendChild(el('span', {
    style: {
      position: 'absolute',
      top: '0',
      right: '24px',
      background: ACCENT3,
      color: INK,
      border: '2px solid ' + INK,
      padding: '4px 10px',
      fontFamily: 'Anton, sans-serif',
      fontStyle: 'italic',
      fontWeight: 900,
      fontSize: '0.78rem',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      transform: 'rotate(8deg)',
      boxShadow: '3px 3px 0 ' + INK,
      whiteSpace: 'nowrap',
    },
  }, 'CC0 · USE FREELY'));

  // ── Boilerplate ──────────────────────────────────────────────────────
  wrap.appendChild(card([
    sectionHeading('THE PITCH', 'BOILERPLATE.', ACCENT3),
    el('div', { style: { display: 'grid', gap: '14px' } },
      boilerplateBlock('Tweet (140 chars)', BOILERPLATE_TWEET),
      boilerplateBlock('Short (50 words)',  BOILERPLATE_SHORT),
      boilerplateBlock('Long (150 words)',  BOILERPLATE_LONG),
    ),
  ]));

  // ── Quick facts ──────────────────────────────────────────────────────
  wrap.appendChild(card([
    sectionHeading('AT A GLANCE', 'QUICK FACTS.', ACCENT2),
    el('table', {
      style: {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '0.95rem',
        color: INK,
      },
    },
      el('tbody', null,
        ...QUICK_FACTS.map(([k, v]) => el('tr', { style: { borderBottom: '1px dashed ' + INK } },
          el('th', {
            scope: 'row',
            style: {
              textAlign: 'left',
              padding: '8px 10px 8px 0',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.78rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: BRAND,
              verticalAlign: 'top',
              width: '170px',
            },
          }, k),
          el('td', { style: { padding: '8px 0', lineHeight: '1.5' } }, v),
        )),
      ),
    ),
  ]));

  // ── Brand assets ─────────────────────────────────────────────────────
  wrap.appendChild(card([
    sectionHeading('IDENTITY', 'WORDMARK.', ACCENT2),
    wordmarkBlock(),
  ]));

  wrap.appendChild(card([
    sectionHeading('IDENTITY', 'MONOGRAM.', BRAND),
    monogramBlock(),
  ]));

  wrap.appendChild(card([
    sectionHeading('PALETTE', 'MONGOOSE-BMX HEXES.', ACCENT3),
    el('p', {
      style: { color: INK, fontSize: '0.9rem', lineHeight: '1.5', margin: '0 0 14px', fontStyle: 'italic' },
    }, 'Six pinned literals — see brandstandards.MD §14. Tokens are the names exposed in client/styles/sdz-radical.css; theme-flipping equivalents (var(--brand) etc.) live in client/styles/theme.css.'),
    el('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px',
      },
    },
      ...PALETTE.map(paletteSwatch),
    ),
  ]));

  // ── Product imagery ──────────────────────────────────────────────────
  wrap.appendChild(card([
    sectionHeading('PRODUCT IMAGERY', 'CAPS ON FILE.', ACCENT2),
    el('p', {
      style: { color: INK, fontSize: '0.9rem', lineHeight: '1.5', margin: '0 0 14px', fontStyle: 'italic' },
    }, 'Six lore caps from the Sadie’s Sixpack drop + three product photos. Each is downloadable as a PNG; the Sixpack STLs are at /sixpack on the site if you’d rather print + photograph your own.'),
    productGrid(),
  ]));

  // ── Print bundle (Gumball Takeover residency assets) ────────────────
  wrap.appendChild(card([
    sectionHeading('PRINT BUNDLE', 'GUMBALL TAKEOVER · STAPLES-READY.', ACCENT3),
    el('p', {
      style: { color: INK, fontSize: '0.9rem', lineHeight: '1.5', margin: '0 0 14px', fontStyle: 'italic' },
    },
      'The print-shop-ready PDFs from the residency at ',
      el('strong', null, 'Sadie’s Bikes'),
      '. Send these to Staples or any local print shop — page sizes are flagged in each filename. The blank version is for hand-stamping on-site.',
    ),
    el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' } },
      printBundleCard({
        title: 'Flyer (11×8)',
        sub: 'Front-and-back · half-letter · color',
        href: '/press/print-bundle/stemdomez-flyer-11x8.pdf',
        download: 'stemdomez-flyer-11x8.pdf',
        sizeBytes: 6_191_549,
      }),
      printBundleCard({
        title: 'Blank flyer template',
        sub: 'Print-and-stamp on-site · color',
        href: '/press/print-bundle/stemdomez-blank.pdf',
        download: 'stemdomez-blank.pdf',
        sizeBytes: 860_250,
      }),
    ),
  ]));

  // ── About ────────────────────────────────────────────────────────────
  wrap.appendChild(card([
    sectionHeading('ABOUT', 'MADE FOR A GUMBALL MACHINE.', BRAND),
    el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px', color: INK, lineHeight: '1.6', fontSize: '1rem' } },
      ...ABOUT_LONG_PARAGRAPHS.map((children) => el('p', { style: { margin: 0 } }, ...children)),
    ),
  ]));

  // ── Contact ──────────────────────────────────────────────────────────
  wrap.appendChild(card([
    sectionHeading('CONTACT', 'GET IN TOUCH.', ACCENT3),
    el('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.95rem', color: INK } },
      el('div', null, el('strong', { style: { color: BRAND } }, 'Press inquiries: '), el('a', { href: 'mailto:press@stemdomez.com', style: { color: INK, textDecoration: 'underline' } }, 'press@stemdomez.com')),
      el('div', null, el('strong', { style: { color: BRAND } }, 'General: '),         el('a', { href: 'mailto:hello@stemdomez.com', style: { color: INK, textDecoration: 'underline' } }, 'hello@stemdomez.com')),
      el('div', null, el('strong', { style: { color: BRAND } }, 'Source code: '),     el('a', { href: 'https://github.com/ianroy/bikeheadz', target: '_blank', rel: 'noopener noreferrer', style: { color: INK, textDecoration: 'underline' } }, 'github.com/ianroy/bikeheadz')),
      el('div', null, el('strong', { style: { color: BRAND } }, 'Maker: '),           el('a', { href: 'https://ianroy.org/', target: '_blank', rel: 'noopener noreferrer', style: { color: INK, textDecoration: 'underline' } }, 'ianroy.org')),
    ),
  ]));

  // ── ZIP download placeholder ─────────────────────────────────────────
  wrap.appendChild(el('div', {
    style: {
      marginTop: '28px',
      padding: '18px 22px',
      background: PAPER,
      border: '2px dashed ' + INK,
      borderRadius: '8px',
      textAlign: 'center',
      color: INK_MUTED,
      fontSize: '0.85rem',
      fontStyle: 'italic',
    },
  },
    'A consolidated ',
    el('strong', null, 'press-kit.zip'),
    ' (logos + palette + product photos) is on the way. For now: download assets individually above, or email ',
    el('a', { href: 'mailto:press@stemdomez.com', style: { color: BRAND, textDecoration: 'underline' } }, 'press@stemdomez.com'),
    ' and we’ll send you the lot.',
  ));

  return { el: root };
}

function printBundleCard({ title, sub, href, download, sizeBytes }) {
  const sizeMb = (sizeBytes / 1024 / 1024).toFixed(1);
  return el('div', {
    style: {
      background: PAPER,
      border: '2px solid ' + INK,
      borderRadius: '8px',
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      boxShadow: '4px 4px 0 ' + ACCENT3,
    },
  },
    el('div', null,
      el('div', { style: { fontFamily: 'Anton, sans-serif', fontStyle: 'italic', fontWeight: 900, fontSize: '1.1rem', color: INK, lineHeight: '1' } }, title),
      el('div', { style: { fontFamily: 'ui-monospace, monospace', fontSize: '0.78rem', color: INK_MUTED, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' } }, sub),
    ),
    el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' } },
      el('a', {
        href, download,
        style: assetButtonStyle(),
      }, '↓ PDF · ' + sizeMb + ' MB'),
      el('span', { style: { fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem', color: INK_MUTED } }, 'Staples-ready'),
    ),
  );
}

function boilerplateBlock(label, text) {
  return el('div', {
    style: {
      background: PAPER,
      border: '2px solid ' + INK,
      borderRadius: '8px',
      padding: '14px 16px',
    },
  },
    el('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
        gap: '10px',
        flexWrap: 'wrap',
      },
    },
      el('span', {
        style: {
          fontFamily: 'ui-monospace, monospace',
          fontSize: '0.72rem',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: BRAND,
        },
      }, label),
      copyButton('COPY', text),
    ),
    el('p', {
      style: { margin: 0, color: INK, lineHeight: '1.55', fontSize: '0.95rem' },
    }, text),
  );
}
