// StemDomeZ — landing page.
//
// This is the marketing/about page. The actual generator (photo upload
// → STL viewer → checkout) is now mounted at /stemdome-generator and
// exported from client/pages/generator.js.
//
// Sections, top to bottom:
//   1. Hero          — wordmark, tagline, primary "Make yours" CTA.
//   2. How it works  — 3-step card row (drop photo → generate → print).
//   3. Video demo    — placeholder slot. Drop an mp4 at /demo/landing.mp4
//                      and the page picks it up automatically; otherwise
//                      a static poster keeps the layout intact.
//   4. About         — workshop / 90s-skate-shop voice.
//   5. Product spec  — pulled-from-ProductSpec.md §0 + 3D_Pipeline.md §0
//                      "locked print invariants" rewritten for riders.
//   6. Pricing tease — three-tier strip with link to /pricing.
//   7. Showcase tease — link to /showcase.
//   8. Footer        — link cluster (Help / Press / Status / legal).
//
// Voice: italic, mildly hyped, period-90s catalog. The brand cap+head
// mark + the trailing-Z signature do most of the visual work; copy stays
// lean.

import { el } from '../dom.js';
import { getCachedAppConfig } from '../util/app-config.js';

export function HomePage({ socket: _socket }) {
  const cfg = getCachedAppConfig();
  const paymentsOff = !cfg.paymentsEnabled;
  const printingOff = !cfg.printingEnabled;
  const root = el('div', { class: 'flex flex-col gap-0' });

  // ── 1. HERO ───────────────────────────────────────────────────────
  const hero = el(
    'section',
    {
      class: 'relative overflow-hidden',
      style: {
        background: 'var(--paper)',
        borderBottom: '3px solid var(--ink)',
      },
    },
    // halftone backdrop in the lower-right corner — period detail
    el('div', {
      class: 'sdz-halftone absolute pointer-events-none',
      style: {
        right: '0',
        top: '20%',
        width: '60%',
        height: '80%',
        opacity: '0.5',
      },
    }),
    // CMY splatter dots
    el('div', {
      class: 'sdz-splatter absolute pointer-events-none',
      style: { left: '10%', top: '20%', width: '60%', height: '40%' },
    }),
    el(
      'div',
      { class: 'relative max-w-6xl mx-auto px-6 py-20 md:py-28 grid md:grid-cols-[1fr_1fr] gap-10 items-center' },
      // left column — wordmark + tagline + CTAs
      el(
        'div',
        { class: 'flex flex-col gap-6' },
        el(
          'h1',
          {
            class: 'sdz-display sdz-wordmark',
            style: {
              fontSize: 'clamp(3rem, 8vw, 5.5rem)',
              lineHeight: '0.9',
              margin: '0',
            },
          },
          'StemDome',
          el('span', { class: 'z' }, 'Z')
        ),
        el(
          'p',
          {
            style: {
              fontSize: 'clamp(1.1rem, 2.2vw, 1.5rem)',
              fontStyle: 'italic',
              fontWeight: 600,
              color: 'var(--ink)',
              maxWidth: '34ch',
              lineHeight: '1.3',
              position: 'relative',
            },
          },
          'Your face on a Schrader valve cap. ',
          paymentsOff
            ? el(
                'span',
                { style: { display: 'inline' } },
                el(
                  'span',
                  { class: 'sdz-graffiti-strike', style: { color: 'var(--brand)' } },
                  '$2 STL'
                ),
                el(
                  'span',
                  { style: { color: 'var(--brand)' } },
                  ' · printable on any FDM/PLA setup.'
                )
              )
            : el(
                'span',
                { style: { color: 'var(--brand)' } },
                '$2 STL · printable on any FDM/PLA setup.'
              )
        ),
        // "Free download!" graffiti tag — lives in its own block
        // BELOW the subhead so the spray paint never blocks the
        // copy. Slight rotation + fluoro stencil sit on top of the
        // strikethrough'd "$2 STL" line above.
        paymentsOff
          ? el(
              'div',
              {
                style: {
                  marginTop: '0.5rem',
                  height: '1.4em',
                  lineHeight: '1',
                },
              },
              el(
                'span',
                {
                  class: 'sdz-graffiti-tag',
                  style: {
                    fontSize: 'clamp(1.4rem, 3.5vw, 2rem)',
                    whiteSpace: 'nowrap',
                  },
                  role: 'img',
                  'aria-label': 'Free download',
                },
                'Free download!'
              )
            )
          : null,
        el(
          'div',
          { class: 'flex items-center gap-4 flex-wrap mt-2' },
          el(
            'a',
            {
              href: '/stemdome-generator',
              'data-link': '',
              class: 'sdz-cta',
              style: { fontSize: '1.05rem', padding: '1rem 1.75rem' },
            },
            'MAKE YOURS  →'
          ),
          el(
            'a',
            {
              href: '/showcase',
              'data-link': '',
              class: 'sdz-cta sdz-cta-secondary',
              style: { fontSize: '1.05rem', padding: '1rem 1.75rem' },
            },
            'SEE EXAMPLES'
          )
        ),
        // micro-features strip
        el(
          'div',
          {
            class: 'flex items-center gap-3 flex-wrap mt-2',
            style: { fontSize: '0.78rem' },
          },
          el('span', { class: 'sdz-chip' }, 'FDM · PLA'),
          el('span', { class: 'sdz-chip sdz-chip-purple' }, '0.4 mm nozzle'),
          el('span', { class: 'sdz-chip sdz-chip-magenta' }, 'Schrader fit')
        )
      ),
      // right column — big monogram render
      el(
        'div',
        { class: 'flex justify-center md:justify-end' },
        el('img', {
          src: '/press/logo-monogram.png',
          alt: 'StemDomeZ monogram — cap, head, and the SDZ letterform',
          style: {
            width: 'min(360px, 80%)',
            height: 'auto',
            transform: 'rotate(-4deg)',
          },
        })
      )
    ),
    // zigzag bottom border
    el('div', {
      class: 'sdz-zigzag',
      style: { height: '14px', width: '100%' },
    })
  );
  root.appendChild(hero);

  // ── 2. HOW IT WORKS ────────────────────────────────────────────────
  const how = el(
    'section',
    { class: 'max-w-6xl mx-auto px-6 py-16 md:py-20' },
    el(
      'h2',
      {
        class: 'sdz-display',
        style: {
          fontSize: '2rem',
          color: 'var(--ink)',
          textShadow: '4px 4px 0 var(--accent2)',
          marginBottom: '2rem',
        },
      },
      'How it works.'
    ),
    el(
      'div',
      { class: 'grid md:grid-cols-3 gap-6' },
      stepCard(
        '01',
        'Drop a photo',
        'Front-facing portrait. Good light, clean background. PNG or JPEG, up to 5 MB. Drag in or click to upload.',
        'var(--brand)'
      ),
      stepCard(
        '02',
        'Generator does the work',
        'Microsoft TRELLIS generates a 3D head from your photo. A 7-stage CAD pipeline grafts it onto a Schrader valve cap. ~30–60 s on a warm worker.',
        'var(--accent3)'
      ),
      stepCard(
        '03',
        paymentsOff ? 'Print it free' : 'Print or buy printed',
        paymentsOff
          ? (printingOff
              ? 'Sign in and grab the STL — free for a limited time. Print it on your own FDM/PLA setup.'
              : 'Sign in and grab the STL — free for a limited time. Print it yourself, or order one printed and shipped soon.')
          : '$2 grabs the STL. $19.99 ships you a printed cap. $59.99 a pack of four for the crew.',
        'var(--accent2-dim)'
      )
    ),
    architectureBlock()
  );
  root.appendChild(how);

  // ── 3. VIDEO DEMO ──────────────────────────────────────────────────
  // The page checks for a real demo video at /demo/landing.mp4. If it
  // exists, it auto-plays muted-loop; otherwise the static poster card
  // explains "demo coming soon" and the layout stays intact.
  const videoSection = el(
    'section',
    {
      class: 'relative',
      style: {
        background: 'var(--paper-soft)',
        borderTop: '3px solid var(--ink)',
        borderBottom: '3px solid var(--ink)',
      },
    },
    el(
      'div',
      { class: 'max-w-6xl mx-auto px-6 py-16 md:py-20 grid md:grid-cols-[1fr_1.4fr] gap-10 items-center' },
      el(
        'div',
        {},
        el(
          'h2',
          {
            class: 'sdz-display',
            style: { fontSize: '2rem', color: 'var(--ink)', marginBottom: '0.5rem' },
          },
          'See it ride.'
        ),
        el(
          'p',
          {
            style: {
              color: 'var(--ink-muted)',
              fontSize: '1rem',
              fontStyle: 'italic',
              maxWidth: '32ch',
              lineHeight: '1.5',
            },
          },
          'Photo in. STL out. ~60 seconds end-to-end on a warm worker. Output prints clean on a Bambu A1 / Prusa MK4 / Elegoo Centauri at 0.4 mm nozzle.'
        )
      ),
      videoTile()
    )
  );
  root.appendChild(videoSection);

  // ── 4. ABOUT ────────────────────────────────────────────────────────
  const about = el(
    'section',
    { class: 'max-w-6xl mx-auto px-6 py-16 md:py-20' },
    el(
      'div',
      { class: 'grid md:grid-cols-[1fr_2fr] gap-10' },
      el(
        'div',
        {},
        el(
          'h2',
          {
            class: 'sdz-display',
            style: {
              fontSize: '2rem',
              color: 'var(--ink)',
              textShadow: '4px 4px 0 var(--accent3)',
              marginBottom: '1rem',
            },
          },
          'About.'
        ),
        el('span', { class: 'sdz-chip sdz-chip-purple' }, 'WORKSHOP-MADE')
      ),
      el(
        'div',
        {
          class: 'flex flex-col gap-4',
          style: { fontSize: '1.05rem', lineHeight: '1.6', color: 'var(--ink)' },
        },
        el(
          'p',
          {},
          'StemDomeZ is a small-batch maker product for cyclists who like fiddling with their bike. ',
          'Schrader valve cap. Your face. PLA. Done.'
        ),
        el(
          'p',
          {},
          'We started this because every other valve cap is the same matte-black blob — and we figured a cyclist with a 3D printer should be able to put their kid, their dog, or their own glasses-wearing dome on top of every wheel they own. ',
          el(
            'span',
            { style: { fontStyle: 'italic', color: 'var(--brand)' } },
            'Race day at the trails, 1993,'
          ),
          ' but the trails are now and the printer is the one in your garage.'
        ),
        paymentsOff
          ? el(
              'p',
              {},
              'No subscriptions. No upsells. ',
              el('strong', { class: 'sdz-graffiti-strike' }, '$2 STL'),
              ' ',
              el(
                'span',
                {
                  class: 'sdz-graffiti-tag sdz-graffiti-tag-magenta',
                  style: { fontSize: '1.05em', display: 'inline-block', verticalAlign: 'baseline' },
                },
                'Free!'
              ),
              ' for a limited time — sign in and the STL is yours.'
            )
          : el(
              'p',
              {},
              'No subscriptions. No upsells. ',
              el('strong', {}, '$2 STL'),
              ' if you print it yourself, ',
              el('strong', {}, '$19.99'),
              ' if you want it shipped, ',
              el('strong', {}, '$59.99'),
              ' for the four-pack.'
            )
      )
    )
  );
  root.appendChild(about);

  // ── 5. PRODUCT SPEC ────────────────────────────────────────────────
  // Pulled from ProductSpec.md §0 ("Locked decisions") + 3D_Pipeline.md
  // §0 (locked print invariants), rewritten for riders.
  //
  // Pinned-literal background per brandstandards.MD §14: this is an
  // always-dark zone so the fluoro-green disclaimer text stays at
  // 14.75:1 in light + dark + AAA modes. Without pinning, dark mode
  // flips var(--ink) to cream and the green falls to 1.18:1.
  const spec = el(
    'section',
    {
      class: 'relative overflow-hidden',
      style: {
        background: '#0E0A12',
        color: '#F5F2E5',
        borderTop: '3px solid #0E0A12',
      },
    },
    // multi-color CMY splatter on the dark backdrop
    el('div', {
      class: 'sdz-splatter absolute pointer-events-none',
      style: { left: '0', top: '0', width: '100%', height: '100%', opacity: '0.6' },
    }),
    el(
      'div',
      { class: 'relative max-w-6xl mx-auto px-6 py-16 md:py-20' },
      el(
        'h2',
        {
          class: 'sdz-display',
          style: { fontSize: '2rem', color: '#F5F2E5', marginBottom: '0.5rem' },
        },
        'Print spec.'
      ),
      el(
        'p',
        {
          style: {
            color: '#2EFF8C',
            fontSize: '0.95rem',
            fontWeight: 600,
            fontStyle: 'italic',
            marginBottom: '2rem',
          },
        },
        'Locked. Designed for FDM/PLA on a 0.4 mm nozzle. Not negotiable; everything below depends on these.'
      ),
      el(
        'div',
        { class: 'grid sm:grid-cols-2 lg:grid-cols-3 gap-4' },
        specTile('PROCESS', 'FDM · PLA filament', 'var(--accent2)'),
        specTile('NOZZLE', '0.4 mm', 'var(--accent2)'),
        specTile('LAYER HEIGHT', '0.12 – 0.16 mm', 'var(--accent2)'),
        specTile('ORIENTATION', 'Cap-down on bed', 'var(--brand-light)'),
        specTile('VALVE FIT', 'Schrader (8 mm × 32 TPI)', 'var(--brand-light)'),
        specTile('SIZE', '~30 mm tall · 22–42 mm tunable', 'var(--brand-light)'),
        specTile('TRIANGLES', '50 – 80 K', 'var(--accent3)'),
        specTile('MIN WALL', '1.2 mm', 'var(--accent3)'),
        specTile('FILE FORMAT', 'Binary STL · slicer-ready', 'var(--accent3)')
      ),
      el(
        'p',
        {
          style: {
            color: '#2EFF8C',
            fontStyle: 'italic',
            marginTop: '2rem',
            fontSize: '0.9rem',
          },
        },
        'Slicer profile: drop the STL into Bambu Studio, OrcaSlicer, or PrusaSlicer. Add a 5 mm brim, 0 mm brim-object gap. Hit print.'
      )
    )
  );
  root.appendChild(spec);

  // ── 6. PRICING TEASE ───────────────────────────────────────────────
  const pricingSection = el('section', { class: 'max-w-6xl mx-auto px-6 py-16 md:py-20 relative' });

  pricingSection.appendChild(
    el(
      'h2',
      {
        class: 'sdz-display',
        style: {
          fontSize: '2rem',
          color: 'var(--ink)',
          textShadow: '4px 4px 0 var(--brand)',
          marginBottom: '2rem',
          position: 'relative',
          display: 'inline-block',
        },
      },
      paymentsOff
        ? el(
            'span',
            { style: { position: 'relative' } },
            el('span', { class: 'sdz-graffiti-strike' }, 'Pricing.')
          )
        : 'Pricing.'
    )
  );

  // Tiers — conditionally hide printing-only tiers, and X them out
  // when payments are off so the user sees what *was* charged.
  const tiers = [];
  tiers.push({ label: 'STL', price: '$2', body: 'Just the file. Print it yourself.', primary: false });
  if (!printingOff) {
    tiers.push({ label: 'PRINTED', price: '$19.99', body: 'One cap, printed + shipped.', primary: true });
    tiers.push({ label: 'PACK OF 4', price: '$59.99', body: 'Your crew on four valves.', primary: false });
  }
  const tierGrid = el(
    'div',
    {
      class:
        tiers.length === 3 ? 'grid md:grid-cols-3 gap-6' : tiers.length === 2 ? 'grid md:grid-cols-2 gap-6' : 'grid md:grid-cols-1 gap-6',
    },
    ...tiers.map((t) => {
      const card = tierCard(t.label, t.price, t.body, t.primary);
      if (paymentsOff) {
        // Wrap the card so we can layer the graffiti X on top of it
        // without disturbing its internal Memphis-shadow geometry.
        return el(
          'div',
          { class: 'sdz-graffiti-x', style: { position: 'relative' } },
          card
        );
      }
      return card;
    })
  );
  pricingSection.appendChild(tierGrid);

  if (paymentsOff) {
    // "Free for a limited time" graffiti tag, sprayed across the tier
    // grid like a hand-tagged stencil. Sits in the corner above the
    // X'd-out cards so the eye lands on it before reading the prices.
    pricingSection.appendChild(
      el(
        'div',
        {
          style: {
            display: 'flex',
            justifyContent: 'center',
            marginTop: '2rem',
            position: 'relative',
            zIndex: 4,
          },
        },
        el(
          'span',
          {
            class: 'sdz-graffiti-tag',
            style: {
              fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
              padding: '0.25em 0.5em',
            },
            role: 'img',
            'aria-label': 'Free for a limited time',
          },
          'Free for a limited time!'
        )
      )
    );
  } else {
    pricingSection.appendChild(
      el(
        'div',
        { class: 'mt-8 flex justify-center' },
        el(
          'a',
          {
            href: '/pricing',
            'data-link': '',
            class: 'sdz-cta sdz-cta-secondary',
          },
          'VIEW PRICING DETAIL  →'
        )
      )
    );
  }
  root.appendChild(pricingSection);

  // ── 7. SHOWCASE TEASE ──────────────────────────────────────────────
  const showcase = el(
    'section',
    {
      class: 'relative',
      style: { background: 'var(--paper-soft)', borderTop: '3px solid var(--ink)' },
    },
    el(
      'div',
      { class: 'max-w-6xl mx-auto px-6 py-12 md:py-16 flex flex-wrap items-center justify-between gap-6' },
      el(
        'div',
        {},
        el(
          'h2',
          {
            class: 'sdz-display',
            style: { fontSize: '1.6rem', color: 'var(--ink)', marginBottom: '0.5rem' },
          },
          'See what others made.'
        ),
        el(
          'p',
          { style: { color: 'var(--ink-muted)', fontStyle: 'italic', maxWidth: '40ch' } },
          'Opt-in showcase wall. Riders, dogs, kids. Some classics, some weirdos.'
        )
      ),
      el(
        'a',
        {
          href: '/showcase',
          'data-link': '',
          class: 'sdz-cta',
        },
        'OPEN THE SHOWCASE  →'
      )
    )
  );
  root.appendChild(showcase);

  // ── 8. FOOTER ──────────────────────────────────────────────────────
  // Pinned-literal background per brandstandards.MD §14: footer is
  // an always-dark zone so accent2 (fluoro green) text stays at
  // 14.75:1 in light + dark + AAA modes. Without this, dark mode
  // flips var(--ink) to cream and every accent2 footer surface
  // (column titles, "Race day at the trails 1993", copyright,
  // security.txt link) drops to 1.18:1 — invisible.
  const footer = el(
    'footer',
    {
      style: {
        background: '#0E0A12',
        color: '#F5F2E5',
        borderTop: '3px solid #0E0A12',
        padding: '2.5rem 0 3rem',
      },
    },
    el(
      'div',
      { class: 'max-w-6xl mx-auto px-6' },
      el(
        'div',
        { class: 'grid md:grid-cols-4 gap-8 mb-8' },
        footerCol('Product', [
          ['Make yours', '/stemdome-generator'],
          // When payments are off, the "Pricing" footer link inherits
          // the graffiti treatment — magenta strike + fluoro tag —
          // so the navigation reads consistent everywhere.
          ['Pricing', '/pricing', paymentsOff ? { graffiti: 'free' } : null],
          ['Showcase', '/showcase'],
          ['How it works', '/how-it-works'],
        ]),
        footerCol('Help', [
          ['FAQ', '/help'],
          ['Status', '/status'],
          ['Changelog', '/changelog'],
          ['Press kit', '/press'],
        ]),
        footerCol('Legal', [
          ['Terms', '/terms'],
          ['Privacy', '/privacy'],
          ['Acceptable use', '/acceptable-use'],
          ['Security', '/security'],
        ]),
        el(
          'div',
          {},
          el(
            'div',
            {
              class: 'sdz-display sdz-wordmark',
              style: {
                color: '#F5F2E5',
                fontSize: '1.6rem',
                textShadow: '3px 3px 0 #2EFF8C',
              },
            },
            'StemDome',
            el('span', { class: 'z' }, 'Z')
          ),
          el(
            'p',
            {
              style: {
                color: '#2EFF8C',
                fontStyle: 'italic',
                fontSize: '0.85rem',
                marginTop: '0.75rem',
              },
            },
            'Race day at the trails, 1993.'
          )
        )
      ),
      el(
        'div',
        {
          class: 'pt-6 flex flex-wrap items-center justify-between gap-2',
          style: {
            borderTop: '1px solid #2EFF8C',
            fontSize: '0.78rem',
            color: '#2EFF8C',
          },
        },
        el('span', {}, '© ' + new Date().getFullYear() + ' StemDomeZ. Made in a workshop.'),
        el(
          'span',
          {},
          'stemdomez.com · ',
          el(
            'a',
            {
              href: '/.well-known/security.txt',
              style: { color: '#2EFF8C', textDecoration: 'underline' },
            },
            'security.txt'
          )
        )
      )
    )
  );
  root.appendChild(footer);

  return { el: root };
}

// ── Component helpers ────────────────────────────────────────────────

// Brand-styled architecture diagram. Slots in under the "How it works"
// 3-step cards. Captures the same four zones as architecture.svg
// (Browser → DigitalOcean App Platform → Postgres → RunPod GPU)
// + Stripe-as-external, but in the Mongoose-BMX palette + Memphis
// offsets + italic display labels per brandstandards.MD §6. Inline
// SVG so we don't ship an extra asset; halftone field backdrop
// behind the diagram echoes the hero/spec sections.
function architectureBlock() {
  return el(
    'div',
    {
      class: 'mt-16 relative overflow-hidden',
      style: {
        background: 'var(--paper-soft)',
        border: '3px solid var(--ink)',
        borderRadius: '18px',
        padding: '2rem 1.5rem 2.5rem',
      },
    },
    // Halftone backdrop — magenta dots fading off, period detail.
    el('div', {
      class: 'sdz-halftone absolute pointer-events-none',
      style: { right: '0', top: '0', width: '50%', height: '100%', opacity: '0.35' },
    }),
    el('div', { class: 'relative' },
      el(
        'div',
        { class: 'flex items-baseline justify-between flex-wrap gap-2 mb-2' },
        el(
          'h3',
          {
            class: 'sdz-display',
            style: {
              fontSize: '1.4rem',
              color: 'var(--ink)',
              textShadow: '3px 3px 0 var(--accent3)',
            },
          },
          'How it really works.'
        ),
        el(
          'span',
          { class: 'sdz-chip sdz-chip-purple' },
          'TECH STACK'
        )
      ),
      el(
        'p',
        {
          style: {
            color: 'var(--ink-muted)',
            fontStyle: 'italic',
            fontSize: '0.92rem',
            maxWidth: '60ch',
            marginBottom: '1.25rem',
          },
        },
        'Photo in, STL out — here is the whole pipeline. ',
        'Browser fires a single socket.io command, the DO app dispatches it, RunPod’s GPU runs TRELLIS + a 7-stage CAD pipeline, the binary STL streams back in 700 KB chunks.'
      ),
      // The diagram itself — 1280×360 viewBox, scales down responsively.
      el('div', {
        style: {
          background: 'var(--paper)',
          border: '3px solid var(--ink)',
          borderRadius: '14px',
          padding: '1rem',
          overflow: 'auto',
        },
        html: architectureSvg(),
      }),
      el(
        'div',
        {
          class: 'flex flex-wrap gap-x-5 gap-y-2 mt-4',
          style: { fontSize: '0.78rem', color: 'var(--ink-muted)', fontStyle: 'italic' },
        },
        legendDot('var(--brand)', 'socket.io · command pattern'),
        legendDot('var(--accent3)', 'RunPod chunked-yield'),
        legendDot('var(--accent2-dim)', 'Postgres TLS · 24h TTL'),
        legendDot('var(--gold)', 'Build / release')
      )
    )
  );
}

function legendDot(color, label) {
  return el(
    'span',
    { class: 'flex items-center gap-1.5' },
    el('span', {
      style: {
        width: '10px',
        height: '10px',
        borderRadius: '999px',
        background: color,
        border: '1.5px solid var(--ink)',
        display: 'inline-block',
      },
    }),
    label
  );
}

// Inline SVG: 4 zones (Browser · Server · Postgres · GPU) + Stripe.
// Mongoose-BMX palette only. Memphis-offset rects (a paper rect sits
// on top of a slightly-shifted accent rect) so each box carries the
// same period vocabulary as the rest of the site.
function architectureSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 380" width="100%" preserveAspectRatio="xMidYMid meet" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif">
  <defs>
    <marker id="arrSdzBrand" markerWidth="11" markerHeight="11" refX="9" refY="3.2" orient="auto">
      <path d="M0,0 L0,6.4 L9,3.2 z" fill="#7B2EFF"/>
    </marker>
    <marker id="arrSdzMagenta" markerWidth="11" markerHeight="11" refX="9" refY="3.2" orient="auto">
      <path d="M0,0 L0,6.4 L9,3.2 z" fill="#FF2EAB"/>
    </marker>
    <marker id="arrSdzGreen" markerWidth="11" markerHeight="11" refX="9" refY="3.2" orient="auto">
      <path d="M0,0 L0,6.4 L9,3.2 z" fill="#1FCE6E"/>
    </marker>
    <marker id="arrSdzGold" markerWidth="11" markerHeight="11" refX="9" refY="3.2" orient="auto">
      <path d="M0,0 L0,6.4 L9,3.2 z" fill="#7C5E1F"/>
    </marker>
  </defs>

  <!-- Memphis-offset zone backgrounds: shadow rect first, paper rect on top -->
  <!-- Browser zone (brand purple shadow) -->
  <rect x="34" y="44" width="270" height="280" rx="14" fill="#7B2EFF"/>
  <rect x="28" y="38" width="270" height="280" rx="14" fill="#F5F2E5" stroke="#0E0A12" stroke-width="3"/>
  <text x="48" y="68" font-style="italic" font-weight="800" font-size="13" fill="#7B2EFF" letter-spacing="0.06em">BROWSER</text>
  <text x="48" y="86" font-style="italic" font-weight="900" font-size="18" fill="#0E0A12">Vanilla JS · SPA</text>

  <rect x="48" y="100" width="230" height="60" rx="10" fill="#FFFFFF" stroke="#0E0A12" stroke-width="2"/>
  <text x="163" y="124" text-anchor="middle" font-size="12" font-weight="700" fill="#0E0A12">Tailwind v4 + router</text>
  <text x="163" y="142" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">command-pattern client</text>

  <rect x="48" y="170" width="230" height="60" rx="10" fill="#FFFFFF" stroke="#0E0A12" stroke-width="2"/>
  <text x="163" y="194" text-anchor="middle" font-size="12" font-weight="700" fill="#0E0A12">Three.js viewer</text>
  <text x="163" y="212" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">STLLoader · OrbitControls</text>

  <rect x="48" y="240" width="230" height="60" rx="10" fill="#FFFFFF" stroke="#0E0A12" stroke-width="2"/>
  <text x="163" y="264" text-anchor="middle" font-size="12" font-weight="700" fill="#0E0A12">Stripe Checkout</text>
  <text x="163" y="282" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">hosted redirect (when on)</text>

  <!-- DO App Platform (fluoro-green shadow, the loud second) -->
  <rect x="356" y="44" width="320" height="280" rx="14" fill="#2EFF8C"/>
  <rect x="350" y="38" width="320" height="280" rx="14" fill="#F5F2E5" stroke="#0E0A12" stroke-width="3"/>
  <text x="370" y="68" font-style="italic" font-weight="800" font-size="13" fill="#1FCE6E" letter-spacing="0.06em">DIGITALOCEAN APP</text>
  <text x="370" y="86" font-style="italic" font-weight="900" font-size="18" fill="#0E0A12">Node 22 · Express · socket.io</text>

  <rect x="370" y="100" width="280" height="62" rx="10" fill="#FFFFFF" stroke="#0E0A12" stroke-width="2"/>
  <text x="510" y="124" text-anchor="middle" font-size="12" font-weight="700" fill="#0E0A12">command dispatcher</text>
  <text x="510" y="142" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">stl · payments · designs · admin</text>

  <rect x="370" y="172" width="280" height="62" rx="10" fill="#FFFFFF" stroke="#0E0A12" stroke-width="2"/>
  <text x="510" y="196" text-anchor="middle" font-size="12" font-weight="700" fill="#0E0A12">runpod-client</text>
  <text x="510" y="214" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">/run · /stream · 700 KB chunks</text>

  <rect x="370" y="244" width="280" height="62" rx="10" fill="#FFFFFF" stroke="#0E0A12" stroke-width="2"/>
  <text x="510" y="268" text-anchor="middle" font-size="12" font-weight="700" fill="#0E0A12">design-store</text>
  <text x="510" y="286" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">BYTEA STL · 24h TTL · LRU fallback</text>

  <!-- Postgres (accent2-dim green dashed pill) -->
  <rect x="704" y="118" width="220" height="100" rx="14" fill="#2EFF8C"/>
  <rect x="698" y="112" width="220" height="100" rx="14" fill="#F5F2E5" stroke="#0E0A12" stroke-width="3" stroke-dasharray="6 4"/>
  <text x="808" y="142" text-anchor="middle" font-style="italic" font-weight="800" font-size="13" fill="#1FCE6E" letter-spacing="0.06em">POSTGRES 18</text>
  <text x="808" y="166" text-anchor="middle" font-size="12" font-weight="700" fill="#0E0A12">accounts · designs</text>
  <text x="808" y="184" text-anchor="middle" font-size="12" font-weight="700" fill="#0E0A12">purchases · feature_flags</text>
  <text x="808" y="202" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">migrations PRE_DEPLOY</text>

  <!-- RunPod GPU (magenta shadow, period highlight) -->
  <rect x="976" y="44" width="280" height="280" rx="14" fill="#FF2EAB"/>
  <rect x="970" y="38" width="280" height="280" rx="14" fill="#F5F2E5" stroke="#0E0A12" stroke-width="3"/>
  <text x="990" y="68" font-style="italic" font-weight="800" font-size="13" fill="#FF2EAB" letter-spacing="0.06em">RUNPOD GPU</text>
  <text x="990" y="86" font-style="italic" font-weight="900" font-size="18" fill="#0E0A12">handler.py · TRELLIS</text>

  <rect x="990" y="100" width="240" height="100" rx="10" fill="#FFFFFF" stroke="#0E0A12" stroke-width="2"/>
  <text x="1110" y="124" text-anchor="middle" font-size="12" font-weight="700" fill="#0E0A12">TRELLIS-image-large</text>
  <text x="1110" y="142" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">~30s warm · ~5–10 min cold</text>
  <text x="1110" y="160" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">~780k-tri raw head mesh</text>
  <text x="1110" y="180" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">cached on /runpod-volume</text>

  <rect x="990" y="210" width="240" height="100" rx="10" fill="#FFFFFF" stroke="#0E0A12" stroke-width="2"/>
  <text x="1110" y="234" text-anchor="middle" font-size="12" font-weight="700" fill="#0E0A12">7-stage CAD pipeline</text>
  <text x="1110" y="252" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">normalize · repair · crop</text>
  <text x="1110" y="270" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">cavity · union cap · simplify</text>
  <text x="1110" y="290" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">manifold3d · trimesh · pymeshlab</text>

  <!-- Arrows -->
  <!-- Browser ⇄ DO (brand purple, socket.io) -->
  <path d="M298 168 L350 168" stroke="#7B2EFF" stroke-width="3" fill="none" marker-end="url(#arrSdzBrand)"/>
  <text x="324" y="160" text-anchor="middle" font-size="11" fill="#7B2EFF" font-weight="800" font-style="italic">socket.io</text>

  <path d="M350 200 L298 200" stroke="#7B2EFF" stroke-width="3" fill="none" marker-end="url(#arrSdzBrand)"/>
  <text x="324" y="218" text-anchor="middle" font-size="11" fill="#7B2EFF" font-weight="800" font-style="italic">progress · result</text>

  <!-- DO ⇄ Postgres (fluoro green dim, TLS) -->
  <path d="M650 200 L700 162" stroke="#1FCE6E" stroke-width="3" fill="none" marker-end="url(#arrSdzGreen)"/>
  <text x="690" y="195" text-anchor="end" font-size="11" fill="#1FCE6E" font-weight="800" font-style="italic">SQL · TLS</text>

  <!-- DO ⇄ RunPod (magenta, chunked yield) -->
  <path d="M650 130 L968 130" stroke="#FF2EAB" stroke-width="3" fill="none" marker-end="url(#arrSdzMagenta)"/>
  <text x="809" y="120" text-anchor="middle" font-size="11" fill="#FF2EAB" font-weight="800" font-style="italic">POST /run</text>

  <path d="M968 270 L650 270" stroke="#FF2EAB" stroke-width="3" fill="none" marker-end="url(#arrSdzMagenta)"/>
  <text x="809" y="288" text-anchor="middle" font-size="11" fill="#FF2EAB" font-weight="800" font-style="italic">/stream · 700 KB chunks</text>

  <!-- Build pipeline strip across the bottom (gold) -->
  <line x1="48" y1="350" x2="1230" y2="350" stroke="#7C5E1F" stroke-width="2" stroke-dasharray="6 4"/>
  <text x="48" y="368" font-size="11" fill="#7C5E1F" font-weight="800" font-style="italic">git push → GitHub Actions → GHCR → RunPod release · DO auto-deploys on main</text>
</svg>`;
}

function stepCard(num, title, body, accent) {
  return el(
    'div',
    {
      class: 'sdz-memphis relative',
      style: {
        '--memphis-offset': '8px',
        '--memphis-color': accent,
        background: 'var(--paper)',
        border: '3px solid var(--ink)',
        borderRadius: '14px',
        padding: '1.5rem',
      },
    },
    el(
      'div',
      {
        class: 'sdz-display',
        style: {
          fontSize: '2.6rem',
          color: accent,
          lineHeight: '1',
          marginBottom: '0.5rem',
        },
      },
      num
    ),
    el(
      'h3',
      {
        class: 'sdz-display',
        style: { fontSize: '1.2rem', color: 'var(--ink)', marginBottom: '0.5rem' },
      },
      title
    ),
    el(
      'p',
      { style: { color: 'var(--ink-muted)', fontSize: '0.95rem', lineHeight: '1.5' } },
      body
    )
  );
}

function specTile(label, value, accent) {
  return el(
    'div',
    {
      class: 'sdz-memphis',
      style: {
        '--memphis-offset': '6px',
        '--memphis-color': accent,
        background: 'var(--paper)',
        color: 'var(--ink)',
        border: '3px solid var(--paper)',
        borderRadius: '12px',
        padding: '1rem 1.25rem',
      },
    },
    el(
      'div',
      {
        style: {
          fontSize: '0.7rem',
          fontStyle: 'italic',
          fontWeight: 800,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
          marginBottom: '0.25rem',
        },
      },
      label
    ),
    el(
      'div',
      {
        class: 'sdz-display',
        style: { fontSize: '1.2rem', color: 'var(--ink)' },
      },
      value
    )
  );
}

function tierCard(label, price, body, primary = false) {
  return el(
    'div',
    {
      class: primary ? 'sdz-memphis sdz-memphis-magenta' : 'sdz-memphis',
      style: {
        '--memphis-offset': primary ? '10px' : '6px',
        background: primary ? 'var(--brand)' : 'var(--paper)',
        color: primary ? '#FFFFFF' : 'var(--ink)',
        border: '3px solid var(--ink)',
        borderRadius: '14px',
        padding: '2rem 1.5rem',
      },
    },
    el(
      'div',
      {
        class: 'sdz-chip ' + (primary ? 'sdz-chip-magenta' : ''),
        style: { marginBottom: '1rem' },
      },
      label
    ),
    el(
      'div',
      {
        class: 'sdz-display',
        style: {
          fontSize: '3rem',
          color: primary ? '#FFFFFF' : 'var(--brand)',
          lineHeight: '1',
          marginBottom: '0.5rem',
        },
      },
      price
    ),
    el(
      'p',
      {
        style: {
          color: primary ? 'rgba(255,255,255,0.85)' : 'var(--ink-muted)',
          fontStyle: 'italic',
          fontSize: '0.95rem',
        },
      },
      body
    )
  );
}

function footerCol(title, links) {
  // Pinned-literal colors throughout — the footer surface is forced
  // dark above (brandstandards.MD §14), so the text colors here
  // mirror that pin to stay consistent across light/dark/AAA modes.
  return el(
    'div',
    {},
    el(
      'div',
      {
        style: {
          fontSize: '0.75rem',
          fontWeight: 800,
          fontStyle: 'italic',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: '#2EFF8C',
          marginBottom: '0.75rem',
        },
      },
      title
    ),
    el(
      'ul',
      {
        style: {
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
        },
      },
      ...links.map(([label, href, opts]) => {
        const linkEl = el(
          'a',
          {
            href,
            'data-link': '',
            style: {
              color: '#F5F2E5',
              textDecoration: 'none',
              fontSize: '0.95rem',
              transition: 'color 0.15s ease',
              position: opts?.graffiti ? 'relative' : undefined,
              paddingTop: opts?.graffiti ? '1.1rem' : undefined,
              display: opts?.graffiti ? 'inline-block' : undefined,
            },
            onMouseenter: (e) => {
              e.target.style.color = '#A267FF';
            },
            onMouseleave: (e) => {
              e.target.style.color = '#F5F2E5';
            },
          }
        );
        if (opts?.graffiti === 'free') {
          linkEl.appendChild(el('span', { class: 'sdz-graffiti-strike' }, label));
          linkEl.appendChild(
            el(
              'span',
              {
                class: 'sdz-graffiti-tag',
                style: {
                  position: 'absolute',
                  top: '-0.1rem',
                  left: '0',
                  fontSize: '0.85rem',
                  whiteSpace: 'nowrap',
                  zIndex: 2,
                },
              },
              'FREE!'
            )
          );
        } else {
          linkEl.appendChild(document.createTextNode(label));
        }
        return el('li', {}, linkEl);
      })
    )
  );
}

// Video tile — checks for /demo/landing.mp4 once on load. If it exists,
// auto-plays muted/looping; otherwise renders a static poster card with
// the cap mark + "demo coming soon" copy.
function videoTile() {
  // Pinned literal dark hex so the poster fallback stays readable in
  // dark mode — the fluoro caption inside relies on a true dark
  // ground for contrast (brandstandards.MD §14).
  const tile = el('div', {
    class: 'sdz-memphis',
    style: {
      '--memphis-offset': '10px',
      '--memphis-color': 'var(--accent3)',
      background: '#0E0A12',
      border: '3px solid #0E0A12',
      borderRadius: '14px',
      aspectRatio: '16 / 9',
      width: '100%',
      position: 'relative',
      overflow: 'hidden',
    },
  });
  // Try to load the demo video; fall back to a static poster on error/404.
  const video = el('video', {
    src: '/demo/landing.mp4',
    autoplay: true,
    muted: true,
    loop: true,
    playsinline: true,
    style: { width: '100%', height: '100%', objectFit: 'cover', display: 'none' },
  });
  video.addEventListener('loadeddata', () => {
    video.style.display = 'block';
    posterCard.style.display = 'none';
  });
  // Static poster — visible until/unless the video loads. Pinned
  // literal hexes per brandstandards.MD §14 so the gradient stays
  // dark and the fluoro caption keeps 14.75:1 in dark mode.
  const posterCard = el(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '0.75rem',
        color: '#F5F2E5',
        background: 'linear-gradient(135deg, #0E0A12 0%, #221830 100%)',
      },
    },
    el('img', {
      src: '/icons/512.png',
      alt: '',
      style: { width: '50%', maxWidth: '180px', height: 'auto' },
    }),
    el(
      'div',
      {
        style: {
          fontSize: '0.85rem',
          fontStyle: 'italic',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#2EFF8C',
        },
      },
      'Demo reel · drop landing.mp4 in /demo/'
    )
  );
  tile.append(posterCard, video);
  return tile;
}
