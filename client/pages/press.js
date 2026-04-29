// X-015 — /press kit page. Sections for Logo, Monogram, Workshop
// Palette, Product Photos, About blurb. Logo + monogram are inline
// SVG so press sites can copy-paste the markup; product photos are
// SVG silhouette placeholders until the real photo set lands under
// client/public/press/.

import { el } from '../dom.js';

const PALETTE = [
  { name: 'Workshop ink', hex: '#0E0A12', token: '--ink', light: false },
  { name: 'Workshop paper', hex: '#F5F2E5', token: '--paper', light: true },
  { name: 'Paper soft', hex: '#FFFFFF', token: '--paper-soft', light: true },
  { name: 'Brand red', hex: '#7B2EFF', token: 'red-600', light: false },
  { name: 'Workshop gold', hex: '#D89E2F', token: 'gold-700', light: false },
  { name: 'Muted clay', hex: '#3D2F4A', token: 'muted-500', light: false },
];

const ABOUT =
  'StemDomeZ is a small workshop that turns a portrait photo into a printable bike-valve cap shaped like the rider\'s head. The pipeline hands heavy work to a TRELLIS GPU worker and ships a binary STL the user can print at home on a 0.4 mm-nozzle FDM printer, or order shipped from us. The product is built for clubs, group rides, and shops that want personalisation on every bike. We are independent, based in California, and answer the phone.';

function sectionShell(title, body) {
  return el(
    'section',
    { style: { marginTop: '40px' } },
    el(
      'h2',
      {
        style: {
          fontSize: '20px',
          fontWeight: 600,
          marginBottom: '14px',
          color: '#0E0A12',
          borderBottom: '1px solid #D7CFB6',
          paddingBottom: '6px',
        },
      },
      title
    ),
    body
  );
}

function logoSvg() {
  // Wordmark: BIKE HEADZ. Workshop red, simple geometric sans, bracketed
  // by two thin chevrons.
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 360 80');
  svg.setAttribute('width', '320');
  svg.setAttribute('height', '72');
  svg.setAttribute('aria-label', 'StemDomeZ wordmark');
  svg.innerHTML = `
    <g fill="#7B2EFF">
      <path d="M14 18 L4 40 L14 62 L20 62 L12 40 L20 18 Z" />
      <path d="M346 18 L356 40 L346 62 L340 62 L348 40 L340 18 Z" />
      <text x="180" y="50" text-anchor="middle"
            font-family="Georgia, 'Times New Roman', serif"
            font-size="34" font-weight="700"
            letter-spacing="3"
            fill="#7B2EFF">STEMDOMEZ</text>
      <rect x="32" y="58" width="296" height="2" />
    </g>`;
  return svg;
}

function monogramSvg() {
  // Bold "B" with a wheel motif — initial-only monogram for favicons.
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('width', '96');
  svg.setAttribute('height', '96');
  svg.setAttribute('aria-label', 'StemDomeZ monogram');
  svg.innerHTML = `
    <circle cx="50" cy="50" r="46" fill="#7B2EFF" />
    <text x="50" y="64" text-anchor="middle"
          font-family="Georgia, 'Times New Roman', serif"
          font-size="56" font-weight="700"
          fill="#F5F2E5">B</text>
    <circle cx="50" cy="50" r="46" fill="none" stroke="#F5F2E5" stroke-width="2" stroke-dasharray="2 6" />`;
  return svg;
}

function productSilhouette(label) {
  // Generic head-and-cap silhouette so the layout is real even before
  // the photographer sends final images.
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 200 200');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', 'auto');
  svg.setAttribute('aria-label', label);
  svg.innerHTML = `
    <rect width="200" height="200" fill="#F5F2E5" />
    <ellipse cx="100" cy="86" rx="44" ry="52" fill="#0E0A12" opacity="0.85" />
    <rect x="68" y="138" width="64" height="20" rx="3" fill="#0E0A12" opacity="0.85" />
    <rect x="76" y="158" width="48" height="22" rx="3" fill="#D89E2F" />
    <rect x="76" y="158" width="48" height="3" fill="#0E0A12" opacity="0.4" />
    <rect x="76" y="166" width="48" height="3" fill="#0E0A12" opacity="0.4" />
    <rect x="76" y="174" width="48" height="3" fill="#0E0A12" opacity="0.4" />`;
  return svg;
}

function paletteSwatch({ name, hex, token, light }) {
  return el(
    'div',
    {
      style: {
        background: hex,
        color: light ? '#0E0A12' : '#FFFFFF',
        borderRadius: '10px',
        border: '1px solid #D7CFB6',
        padding: '20px 16px',
        minHeight: '110px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: '0 2px 6px rgba(34, 24, 12, 0.04)',
      },
    },
    el('span', { style: { fontWeight: 600, fontSize: '15px' } }, name),
    el(
      'div',
      { style: { fontFamily: 'monospace', fontSize: '13px', opacity: 0.85 } },
      el('div', null, hex.toUpperCase()),
      el('div', { style: { opacity: 0.7 } }, token)
    )
  );
}

function productCard(caption) {
  return el(
    'figure',
    {
      style: {
        background: '#FFFFFF',
        border: '1px solid #D7CFB6',
        borderRadius: '12px',
        padding: '14px',
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      },
    },
    el(
      'div',
      {
        style: {
          background: '#F5F2E5',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid #D7CFB6',
        },
      },
      productSilhouette(caption)
    ),
    el(
      'figcaption',
      { style: { color: '#3D2F4A', fontSize: '13px', lineHeight: 1.5 } },
      caption,
      el('br'),
      el(
        'span',
        { style: { color: '#D89E2F' } },
        'photo coming soon — replace under client/public/press/'
      )
    )
  );
}

export function PressPage() {
  const root = el('main', {
    style: {
      maxWidth: '880px',
      margin: '48px auto',
      padding: '0 24px',
      color: 'var(--ink, #0E0A12)',
    },
  });

  root.appendChild(
    el('h1', { style: { fontSize: '32px', marginBottom: '8px', color: '#7B2EFF' } }, 'Press kit')
  );
  root.appendChild(
    el(
      'p',
      { style: { color: '#3D2F4A', fontSize: '14px', marginBottom: '8px', lineHeight: 1.5 } },
      'Brand assets, palette, product photos, and a short about-us blurb. Use these freely — credit appreciated, not required.'
    )
  );

  // Logo
  root.appendChild(
    sectionShell(
      'Logo',
      el(
        'div',
        {
          style: {
            background: '#F5F2E5',
            border: '1px solid #D7CFB6',
            borderRadius: '12px',
            padding: '32px 24px',
            display: 'flex',
            justifyContent: 'center',
          },
        },
        logoSvg()
      )
    )
  );

  // Monogram
  root.appendChild(
    sectionShell(
      'Monogram',
      el(
        'div',
        {
          style: {
            background: '#F5F2E5',
            border: '1px solid #D7CFB6',
            borderRadius: '12px',
            padding: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
          },
        },
        monogramSvg(),
        el(
          'p',
          { style: { color: '#3D2F4A', fontSize: '14px', lineHeight: 1.5, margin: 0 } },
          'For favicons, app icons, and tight spaces. Background-safe at 16 px and up.'
        )
      )
    )
  );

  // Palette
  root.appendChild(
    sectionShell(
      'Workshop palette',
      el(
        'div',
        {
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '14px',
          },
        },
        ...PALETTE.map(paletteSwatch)
      )
    )
  );

  // Product photos
  root.appendChild(
    sectionShell(
      'Product photos',
      el(
        'div',
        {
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px',
          },
        },
        productCard('Cap on a road bike valve, side angle.'),
        productCard('Pair of caps in workshop palette, top-down.'),
        productCard('A printed cap held in hand for scale.')
      )
    )
  );

  // About
  root.appendChild(
    sectionShell(
      'About StemDomeZ',
      el(
        'p',
        {
          style: {
            background: '#FFFFFF',
            border: '1px solid #D7CFB6',
            borderRadius: '12px',
            padding: '20px 22px',
            lineHeight: 1.65,
            color: '#0E0A12',
            margin: 0,
          },
        },
        ABOUT
      )
    )
  );

  // Download all (disabled placeholder)
  root.appendChild(
    el(
      'div',
      { style: { marginTop: '32px', textAlign: 'center' } },
      el(
        'button',
        {
          type: 'button',
          disabled: true,
          title: 'ZIP coming after launch',
          'aria-disabled': 'true',
          style: {
            padding: '12px 24px',
            fontSize: '15px',
            background: '#D7CFB6',
            color: '#3D2F4A',
            border: '1px solid #D7CFB6',
            borderRadius: '10px',
            cursor: 'not-allowed',
            fontWeight: '600',
          },
        },
        'Download all (ZIP)'
      ),
      el(
        'p',
        { style: { color: '#3D2F4A', fontSize: '12px', marginTop: '8px' } },
        'A consolidated ZIP will be available after launch.'
      )
    )
  );

  return { el: root };
}
