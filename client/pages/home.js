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
                  ' · 3D printable on any FDM/PLA setup.'
                )
              )
            : el(
                'span',
                { style: { color: 'var(--brand)' } },
                '$2 STL · 3D printable on any FDM/PLA setup.'
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
        'Front-facing portrait from the shoulders up. Good light, clean background. PNG or JPEG, up to 5 MB. Drag in or click to upload. Your data stays on our private server and never goes to any AI in the cloud for processing.',
        'var(--brand)',
        STEP_ART_UPLOAD
      ),
      stepCard(
        '02',
        'Generator does the work',
        'Our privately hosted TRELLIS generates a 3D head from your photo. A 7-stage CAD pipeline grafts it onto a Schrader valve cap. ~30–60 s on a GPU-powered private server.',
        'var(--accent3)',
        STEP_ART_SCULPT
      ),
      stepCard(
        '03',
        paymentsOff ? 'Print it free' : 'Print or buy printed',
        paymentsOff
          ? (printingOff
              ? 'Sign in and grab the STL file — free for a limited time. Print it on your own 3D Printer.'
              : 'Sign in and grab the STL file — free for a limited time. Print it on your own 3D Printer, or order one printed and shipped soon.')
          : '$2 grabs the STL. $19.99 ships you a printed cap. $59.99 a pack of four for the crew.',
        'var(--accent2-dim)',
        STEP_ART_PRINT
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
        el(
          'p',
          {},
          'Right now we’re running the ',
          el('strong', { style: { color: 'var(--brand)' } }, 'Gumball Machine Takeover'),
          ' residency at ',
          el('strong', {}, 'Sadie’s Bikes'),
          ' — drop a quarter, get a hand-modeled lore cap (a Captain, a Big Mick, a Sasquatch Foot). The six freebies live on the ',
          el('a', {
            href: '/sixpack',
            'data-link': '',
            style: { color: 'var(--brand)', textDecoration: 'underline', fontWeight: 700 },
          }, 'Sixpack page'),
          ' if you can’t make it in.'
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

  // ── 4½. SIXPACK TEASER STRIP ───────────────────────────────────────
  // Per CLAUDE_CODE_PLAN §8 — the landing should still surface a teaser
  // strip of the 6 lore caps with a "See the lore →" CTA pointing at
  // /sixpack. Tiny posters only, no Three.js — the full /sixpack route
  // owns the heavy WebGL.
  root.appendChild(sixpackTeaser());

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
          'Opt-in showcase wall. Riders, dogs, makers. Some classics, some weirdos.'
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
          ['Sadie’s Sixpack', '/sixpack'],
          ['Showcase', '/showcase'],
          ['How it works', '/how-it-works'],
          ['Account', '/account'],
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
          ['DMCA', '/dmca'],
          ['Photo policy', '/photo-policy'],
          ['Cookies', '/cookies'],
          ['Refunds', '/refunds'],
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
        el(
          'span',
          {},
          '© ' + new Date().getFullYear() + ' StemDomeZ. Made in a workshop by ',
          el(
            'a',
            {
              href: 'https://ianroy.org/',
              target: '_blank',
              rel: 'noopener noreferrer',
              style: { color: '#2EFF8C', textDecoration: 'underline', fontWeight: 600 },
            },
            'ianroy.org'
          ),
          '.'
        ),
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
            maxWidth: '64ch',
            marginBottom: '1.25rem',
          },
        },
        'Photo in, STL out — here is the whole pipeline. ',
        'Browser fires a single socket.io command, the DO app dispatches it, RunPod’s GPU runs TRELLIS + a 7-stage CAD pipeline, the binary STL streams back in 700 KB chunks. ',
        'Build → release lifecycle runs out of GitHub Actions → GHCR → RunPod releases.'
      ),
      // The diagram itself — 1280×940 viewBox, full architecture.svg
      // detail in the brand palette. Wrapper has overflow:auto so the
      // diagram scrolls horizontally on phones.
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
        legendDot('var(--gold)', 'Build / release lifecycle')
      ),
      // Logo strip — clickable Memphis-offset chips for every major
      // tech in the stack. Each chip opens the project's homepage in
      // a new tab so the architecture is browsable from the diagram.
      architectureLogos()
    )
  );
}

// Hand-authored single-colour SVG glyphs that suggest each project's
// identity through generic geometric shapes (lightning bolt, hexagon,
// triangle, waves, etc.) — NOT reproductions of trademarked logos.
// Each is rendered fluoro-green inside a pinned-dark badge so the
// chip row reads at 14.75:1 (brandstandards.MD §11 forbids fluoro
// green text on cream paper at 1.18:1).
function brandGlyph(kind, color) {
  const c = color || '#2EFF8C';
  const wrap = (body) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="22" height="22" aria-hidden="true">${body}</svg>`;
  switch (kind) {
    case 'vite': // lightning bolt
      return wrap(`<path d="M15 3 L6 16 L12 16 L11 25 L22 11 L16 11 L17 3 z" fill="${c}"/>`);
    case 'three': // triangle outline
      return wrap(`<polygon points="14,4 25,22 3,22" fill="none" stroke="${c}" stroke-width="2.4" stroke-linejoin="round"/><polygon points="14,12 21,21 7,21" fill="${c}" opacity="0.55"/>`);
    case 'tailwind': // two stacked smooth waves
      return wrap(`<path d="M3 11 Q8 6 14 11 T25 11" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/><path d="M3 19 Q8 14 14 19 T25 19" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/>`);
    case 'socketio': // chat-bubble + dots (real-time messaging)
      return wrap(`<path d="M5 6 H23 A2 2 0 0 1 25 8 V18 A2 2 0 0 1 23 20 H14 L9 24 V20 H5 A2 2 0 0 1 3 18 V8 A2 2 0 0 1 5 6 z" fill="none" stroke="${c}" stroke-width="2"/><circle cx="10" cy="13" r="1.6" fill="${c}"/><circle cx="14" cy="13" r="1.6" fill="${c}"/><circle cx="18" cy="13" r="1.6" fill="${c}"/>`);
    case 'node': // hexagon outline (no inner text)
      return wrap(`<polygon points="14,3 24,9 24,19 14,25 4,19 4,9" fill="none" stroke="${c}" stroke-width="2.6"/><polygon points="14,8 21,12 21,16 14,20 7,16 7,12" fill="${c}" opacity="0.45"/>`);
    case 'express': // route arrow / chevron sweep
      return wrap(`<path d="M5 8 L11 14 L5 20" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 8 L19 14 L13 20" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><line x1="22" y1="20" x2="25" y2="20" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>`);
    case 'do': // hollow concentric circles (cloud droplet abstraction)
      return wrap(`<circle cx="14" cy="14" r="10" fill="none" stroke="${c}" stroke-width="2.4"/><circle cx="14" cy="14" r="4.5" fill="${c}"/>`);
    case 'postgres': // database cylinder
      return wrap(`<ellipse cx="14" cy="7" rx="9" ry="3" fill="none" stroke="${c}" stroke-width="2"/><path d="M5 7 V21 A9 3 0 0 0 23 21 V7" fill="none" stroke="${c}" stroke-width="2"/><path d="M5 12 A9 3 0 0 0 23 12" fill="none" stroke="${c}" stroke-width="1.6" opacity="0.7"/><path d="M5 17 A9 3 0 0 0 23 17" fill="none" stroke="${c}" stroke-width="1.6" opacity="0.7"/>`);
    case 'runpod': // capsule pod
      return wrap(`<rect x="5" y="6" width="18" height="16" rx="8" fill="none" stroke="${c}" stroke-width="2.4"/><circle cx="14" cy="14" r="3.2" fill="${c}"/>`);
    case 'trellis': // four-square block grid
      return wrap(`<rect x="3" y="3" width="10" height="10" rx="1.5" fill="${c}"/><rect x="15" y="3" width="10" height="10" rx="1.5" fill="none" stroke="${c}" stroke-width="2"/><rect x="3" y="15" width="10" height="10" rx="1.5" fill="none" stroke="${c}" stroke-width="2"/><rect x="15" y="15" width="10" height="10" rx="1.5" fill="${c}"/>`);
    case 'manifold': // 3D wireframe cube
      return wrap(`<polygon points="14,3 24,8 24,20 14,25 4,20 4,8" fill="none" stroke="${c}" stroke-width="1.8"/><line x1="14" y1="3" x2="14" y2="25" stroke="${c}" stroke-width="1.8"/><line x1="4" y1="8" x2="24" y2="8" stroke="${c}" stroke-width="1.8"/><line x1="4" y1="20" x2="24" y2="20" stroke="${c}" stroke-width="1.8"/><line x1="4" y1="8" x2="14" y2="14" stroke="${c}" stroke-width="1.4" opacity="0.6"/><line x1="24" y1="8" x2="14" y2="14" stroke="${c}" stroke-width="1.4" opacity="0.6"/>`);
    case 'trimesh': // triangulated triangle
      return wrap(`<polygon points="14,4 24,22 4,22" fill="none" stroke="${c}" stroke-width="1.8"/><line x1="14" y1="4" x2="14" y2="22" stroke="${c}" stroke-width="1.4"/><line x1="14" y1="13" x2="4" y2="22" stroke="${c}" stroke-width="1.4"/><line x1="14" y1="13" x2="24" y2="22" stroke="${c}" stroke-width="1.4"/>`);
    case 'pymeshlab': // sliced sphere with cross-section bands
      return wrap(`<circle cx="14" cy="14" r="10" fill="none" stroke="${c}" stroke-width="2.2"/><ellipse cx="14" cy="14" rx="10" ry="3.5" fill="none" stroke="${c}" stroke-width="1.4" opacity="0.7"/><line x1="14" y1="4" x2="14" y2="24" stroke="${c}" stroke-width="1.4" opacity="0.6"/>`);
    case 'github': // round avatar + tentacle wisps (octopus abstraction)
      return wrap(`<circle cx="14" cy="13" r="9" fill="none" stroke="${c}" stroke-width="2.4"/><circle cx="11" cy="13" r="1.5" fill="${c}"/><circle cx="17" cy="13" r="1.5" fill="${c}"/><path d="M9 22 Q9 25 11 25 M14 22 Q14 25 16 25 M19 22 Q19 25 17 25" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>`);
    case 'ghcr': // package / shipping box
      return wrap(`<polygon points="14,4 24,9 24,20 14,25 4,20 4,9" fill="none" stroke="${c}" stroke-width="2"/><polyline points="4,9 14,14 24,9" fill="none" stroke="${c}" stroke-width="2"/><line x1="14" y1="14" x2="14" y2="25" stroke="${c}" stroke-width="2"/><line x1="9" y1="6.5" x2="19" y2="11.5" stroke="${c}" stroke-width="1.4" opacity="0.6"/>`);
    case 'stripe': // three vertical stripes
      return wrap(`<rect x="6" y="6" width="3" height="16" rx="1" fill="${c}"/><rect x="12.5" y="6" width="3" height="16" rx="1" fill="${c}"/><rect x="19" y="6" width="3" height="16" rx="1" fill="${c}"/>`);
    default:
      return wrap(`<rect x="5" y="5" width="18" height="18" rx="3" fill="none" stroke="${c}" stroke-width="2"/>`);
  }
}

function logoChip({ name, href, kind, accent }) {
  return el(
    'a',
    {
      href,
      target: '_blank',
      rel: 'noopener noreferrer',
      class: 'sdz-memphis',
      style: {
        '--memphis-offset': '4px',
        '--memphis-color': accent,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.4rem 0.75rem 0.4rem 0.4rem',
        background: 'var(--paper)',
        color: 'var(--ink)',
        border: '2px solid var(--ink)',
        borderRadius: '10px',
        textDecoration: 'none',
        fontSize: '0.78rem',
        fontWeight: 700,
        fontStyle: 'italic',
        letterSpacing: '0.02em',
      },
    },
    // Pinned-dark badge so the fluoro-green icon clears the §11
    // "no fluoro on cream" floor — green-on-ink reads at 14.75:1.
    el('span', {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: '30px',
        height: '30px',
        borderRadius: '7px',
        background: '#0E0A12',
      },
      html: brandGlyph(kind, '#2EFF8C'),
    }),
    el('span', {}, name)
  );
}

function architectureLogos() {
  // Grouped in stack-order so the row reads roughly left-to-right
  // matching the diagram above (Browser → Server → Hosting/DB → GPU
  // → Mesh tools → Build → Pay). Memphis-shadow accents alternate
  // through the brand trio.
  const logos = [
    // Browser / client
    { name: 'Vite',          href: 'https://vitejs.dev',                      kind: 'vite',       accent: 'var(--accent2)' },
    { name: 'Three.js',      href: 'https://threejs.org',                     kind: 'three',      accent: 'var(--accent3)' },
    { name: 'Tailwind CSS',  href: 'https://tailwindcss.com',                 kind: 'tailwind',   accent: 'var(--brand)'   },
    { name: 'Socket.IO',     href: 'https://socket.io',                       kind: 'socketio',   accent: 'var(--accent2)' },
    // Server runtime
    { name: 'Node.js',       href: 'https://nodejs.org',                      kind: 'node',       accent: 'var(--accent3)' },
    { name: 'Express',       href: 'https://expressjs.com',                   kind: 'express',    accent: 'var(--brand)'   },
    // Hosting + DB
    { name: 'DigitalOcean',  href: 'https://www.digitalocean.com/products/app-platform', kind: 'do', accent: 'var(--accent2)' },
    { name: 'PostgreSQL',    href: 'https://www.postgresql.org',              kind: 'postgres',   accent: 'var(--accent3)' },
    // GPU + model
    { name: 'RunPod',        href: 'https://www.runpod.io',                   kind: 'runpod',     accent: 'var(--brand)'   },
    { name: 'Microsoft TRELLIS', href: 'https://github.com/microsoft/TRELLIS', kind: 'trellis',   accent: 'var(--accent2)' },
    // Mesh tooling
    { name: 'manifold3d',    href: 'https://github.com/elalish/manifold',     kind: 'manifold',   accent: 'var(--accent3)' },
    { name: 'trimesh',       href: 'https://trimesh.org',                     kind: 'trimesh',    accent: 'var(--brand)'   },
    { name: 'PyMeshLab',     href: 'https://pymeshlab.readthedocs.io',        kind: 'pymeshlab',  accent: 'var(--accent2)' },
    // Build / payments
    { name: 'GitHub Actions',href: 'https://github.com/features/actions',     kind: 'github',     accent: 'var(--accent3)' },
    { name: 'GHCR',          href: 'https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry', kind: 'ghcr', accent: 'var(--brand)' },
    { name: 'Stripe',        href: 'https://stripe.com',                      kind: 'stripe',     accent: 'var(--accent2)' },
  ];
  return el(
    'div',
    {
      class: 'mt-6',
      style: { borderTop: '2px solid var(--paper-edge)', paddingTop: '1rem' },
    },
    el(
      'div',
      {
        style: {
          fontSize: '0.7rem',
          fontWeight: 800,
          fontStyle: 'italic',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'var(--ink-muted)',
          marginBottom: '0.75rem',
        },
      },
      'Built with — tap any chip to open the project ↗'
    ),
    el(
      'div',
      {
        class: 'flex flex-wrap gap-3',
      },
      ...logos.map(logoChip)
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

// Full-detail inline SVG architecture diagram. Faithful port of
// architecture.svg in the Mongoose-BMX palette. 1280×940 viewBox so
// the parent's overflow:auto wrapper handles horizontal scrolling on
// phones; on desktop it scales down to fit naturally.
//
// Zone palette mapping from architecture.svg:
//   Browser (was green)   → brand purple shadow + ink stroke
//   DO server (was blue)  → fluoro-green shadow + ink stroke
//   Postgres (dashed)     → fluoro-green dashed pill
//   RunPod GPU (purple)   → hot-magenta shadow + ink stroke
//   Build (yellow)        → gold border, paper-soft fill
//   Stripe (gray dashed)  → ink-muted dashed
// Arrow palette:
//   socket.io (was green) → brand purple
//   POST /run · /stream   → magenta
//   SQL/TLS               → fluoro-green dim
//   build chain           → gold
//   generic               → ink-muted
function architectureSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 940" width="100%" preserveAspectRatio="xMidYMid meet" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif">
  <defs>
    <marker id="arrSdzBrand"    markerWidth="11" markerHeight="11" refX="9" refY="3.2" orient="auto"><path d="M0,0 L0,6.4 L9,3.2 z" fill="#7B2EFF"/></marker>
    <marker id="arrSdzMagenta"  markerWidth="11" markerHeight="11" refX="9" refY="3.2" orient="auto"><path d="M0,0 L0,6.4 L9,3.2 z" fill="#FF2EAB"/></marker>
    <marker id="arrSdzGreen"    markerWidth="11" markerHeight="11" refX="9" refY="3.2" orient="auto"><path d="M0,0 L0,6.4 L9,3.2 z" fill="#1FCE6E"/></marker>
    <marker id="arrSdzGold"     markerWidth="11" markerHeight="11" refX="9" refY="3.2" orient="auto"><path d="M0,0 L0,6.4 L9,3.2 z" fill="#7C5E1F"/></marker>
    <marker id="arrSdzMuted"    markerWidth="11" markerHeight="11" refX="9" refY="3.2" orient="auto"><path d="M0,0 L0,6.4 L9,3.2 z" fill="#3D2F4A"/></marker>
  </defs>

  <!-- ── TITLE ─────────────────────────────────────────────────────── -->
  <text x="640" y="36" text-anchor="middle" font-size="22" font-weight="900" font-style="italic" fill="#0E0A12">StemDomeZ — full system architecture</text>
  <!-- Pipeline subtitle pinned to a dark ink pill so fluoro green
       passes 14.75:1 (brandstandards.MD §11 forbids fluoro text on
       cream paper). Width tuned to hug the string. -->
  <rect x="220" y="46" width="840" height="22" rx="11" fill="#0E0A12"/>
  <text x="640" y="61" text-anchor="middle" font-size="12" font-weight="800" font-style="italic" fill="#2EFF8C" letter-spacing="0.02em">photo → TRELLIS → 7-stage CAD pipeline → chunked-yield delivery → Three.js viewer → Stripe Checkout → STL download</text>

  <!-- ── BROWSER (CLIENT) ──────────────────────────────────────────── -->
  <rect x="46" y="96"  width="380" height="240" rx="14" fill="#7B2EFF"/>
  <rect x="40" y="90"  width="380" height="240" rx="14" fill="#F5F2E5" stroke="#0E0A12" stroke-width="3"/>
  <text x="60" y="115" font-size="14" font-weight="900" font-style="italic" fill="#7B2EFF" letter-spacing="0.06em">BROWSER (CLIENT)</text>

  <rect x="60"  y="130" width="160" height="60" rx="8" fill="#FFFFFF" stroke="#0E0A12" stroke-width="1.6"/>
  <text x="140" y="152" text-anchor="middle" font-size="12" font-weight="700" fill="#0E0A12">Vanilla JS UI</text>
  <text x="140" y="170" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">Tailwind v4 · router</text>
  <text x="140" y="184" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">command pattern</text>

  <rect x="240" y="130" width="160" height="60" rx="8" fill="#FFFFFF" stroke="#0E0A12" stroke-width="1.6"/>
  <text x="320" y="152" text-anchor="middle" font-size="12" font-weight="700" fill="#0E0A12">Three.js viewer</text>
  <text x="320" y="170" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">STLLoader</text>
  <text x="320" y="184" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">OrbitControls</text>

  <rect x="60"  y="200" width="340" height="56" rx="8" fill="#FFFFFF" stroke="#0E0A12" stroke-width="1.6"/>
  <text x="230" y="222" text-anchor="middle" font-size="12" font-weight="700" fill="#0E0A12">socket.io client — single "command" event</text>
  <text x="230" y="240" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">{ id, name, payload } · request/response correlated by id</text>

  <rect x="60"  y="266" width="340" height="50" rx="8" fill="#FFFFFF" stroke="#0E0A12" stroke-width="1.6"/>
  <text x="230" y="287" text-anchor="middle" font-size="12" font-weight="700" fill="#0E0A12">Stripe Checkout (hosted redirect)</text>
  <text x="230" y="304" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">verified server-side on redirect-return — no webhook required</text>

  <!-- ── STRIPE (EXTERNAL) ─────────────────────────────────────────── -->
  <rect x="40" y="350" width="380" height="80" rx="14" fill="#FFFFFF" stroke="#3D2F4A" stroke-width="2" stroke-dasharray="4 3"/>
  <text x="230" y="375" text-anchor="middle" font-size="14" font-weight="900" font-style="italic" fill="#0E0A12">Stripe (external)</text>
  <text x="230" y="395" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">hosted Checkout · server-side verify on return</text>
  <text x="230" y="412" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">flag-gated by payments_enabled — off in MVP launch</text>

  <!-- ── DIGITALOCEAN APP PLATFORM ─────────────────────────────────── -->
  <rect x="466" y="96"  width="380" height="540" rx="14" fill="#2EFF8C"/>
  <rect x="460" y="90"  width="380" height="540" rx="14" fill="#F5F2E5" stroke="#0E0A12" stroke-width="3"/>
  <text x="480" y="115" font-size="14" font-weight="900" font-style="italic" fill="#1FCE6E" letter-spacing="0.06em">DIGITALOCEAN APP PLATFORM</text>
  <text x="480" y="131" font-size="11" font-style="italic" fill="#3D2F4A">Node 22 · Express · socket.io · helmet CSP · graceful SIGTERM</text>

  <rect x="480" y="148" width="340" height="92" rx="8" fill="#FFFFFF" stroke="#0E0A12" stroke-width="1.6"/>
  <text x="650" y="170" text-anchor="middle" font-size="12" font-weight="700" fill="#0E0A12">server/index.js</text>
  <text x="650" y="188" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">Express + socket.io · GET /health · /metrics</text>
  <text x="650" y="206" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">command dispatcher (single 'command' event)</text>
  <text x="650" y="224" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">stl · payments · designs · orders · account · admin · flags</text>

  <rect x="480" y="252" width="340" height="92" rx="8" fill="#FFFFFF" stroke="#0E0A12" stroke-width="1.6"/>
  <text x="650" y="274" text-anchor="middle" font-size="12" font-weight="700" fill="#0E0A12">workers/runpod-client.js</text>
  <text x="650" y="292" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">POST /run · GET /stream/&lt;id&gt; (1.5s polling, 12 min cap)</text>
  <text x="650" y="308" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">indexes result_chunk frames; reassembles base64</text>
  <text x="650" y="326" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">/status fallback for dropped streams</text>

  <rect x="480" y="356" width="340" height="64" rx="8" fill="#FFFFFF" stroke="#0E0A12" stroke-width="1.6"/>
  <text x="650" y="378" text-anchor="middle" font-size="12" font-weight="700" fill="#0E0A12">design-store.js</text>
  <text x="650" y="396" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">stl_bytes BYTEA in Postgres · 24h TTL · in-memory fallback</text>
  <text x="650" y="412" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">prune job runs every 15 min</text>

  <rect x="480" y="432" width="340" height="64" rx="8" fill="#FFFFFF" stroke="#0E0A12" stroke-width="1.6"/>
  <text x="650" y="454" text-anchor="middle" font-size="12" font-weight="700" fill="#0E0A12">stripe-client.js · app-config.js</text>
  <text x="650" y="472" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">SDK factory · pricing catalogue</text>
  <text x="650" y="488" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">payments_enabled / printing_enabled / aaa_toggle_enabled</text>

  <rect x="480" y="508" width="340" height="92" rx="10" fill="#F5F2E5" stroke="#1FCE6E" stroke-width="2.5" stroke-dasharray="6 4"/>
  <text x="650" y="530" text-anchor="middle" font-size="12" font-weight="900" font-style="italic" fill="#1FCE6E" letter-spacing="0.04em">MANAGED POSTGRES 18</text>
  <text x="650" y="548" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">accounts · generated_designs · purchases · feature_flags</text>
  <text x="650" y="566" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">migrations applied PRE_DEPLOY</text>
  <text x="650" y="584" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">TLS connection · BYTEA STL with 24h TTL</text>

  <!-- ── RUNPOD SERVERLESS GPU ─────────────────────────────────────── -->
  <rect x="886" y="96"  width="360" height="700" rx="14" fill="#FF2EAB"/>
  <rect x="880" y="90"  width="360" height="700" rx="14" fill="#F5F2E5" stroke="#0E0A12" stroke-width="3"/>
  <text x="900" y="115" font-size="14" font-weight="900" font-style="italic" fill="#FF2EAB" letter-spacing="0.06em">RUNPOD SERVERLESS GPU</text>
  <text x="900" y="131" font-size="11" font-style="italic" fill="#3D2F4A">image: ghcr.io/&lt;owner&gt;/&lt;repo&gt;:vX.Y.Z</text>

  <rect x="900" y="148" width="320" height="120" rx="8" fill="#FFFFFF" stroke="#0E0A12" stroke-width="1.6"/>
  <text x="1060" y="170" text-anchor="middle" font-size="12" font-weight="900" font-style="italic" fill="#0E0A12">handler.py (generator)</text>
  <text x="1060" y="190" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">[stemdomez] handler.py vX.Y.Z booting</text>
  <text x="1060" y="207" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">module-load probes · failure corpus</text>
  <text x="1060" y="225" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">return_aggregate_stream=False ✓</text>
  <text x="1060" y="243" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">yields: progress · result_chunk × N · result</text>
  <text x="1060" y="261" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">CHUNK_SIZE = 700 KB</text>

  <rect x="900" y="280" width="320" height="76" rx="8" fill="#FFFFFF" stroke="#0E0A12" stroke-width="1.6"/>
  <text x="1060" y="300" text-anchor="middle" font-size="12" font-weight="700" fill="#0E0A12">TRELLIS-image-large</text>
  <text x="1060" y="318" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">~30s warm · ~5–10 min cold</text>
  <text x="1060" y="334" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">~780k-tri head mesh, often non-manifold</text>
  <text x="1060" y="350" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">cached on /runpod-volume/cache/trellis/</text>

  <rect x="900" y="368" width="320" height="232" rx="8" fill="#FFFFFF" stroke="#0E0A12" stroke-width="1.6"/>
  <text x="1060" y="390" text-anchor="middle" font-size="12" font-weight="900" font-style="italic" fill="#0E0A12">v1 mesh pipeline (pipeline/stages.py)</text>
  <line x1="916" y1="400" x2="1204" y2="400" stroke="#FF2EAB" stroke-width="1"/>
  <text x="916"  y="418" font-size="11" fill="#0E0A12"><tspan font-weight="800">stage 1</tspan> · normalize: orient Z-up, rescale to 30 mm</text>
  <text x="916"  y="436" font-size="11" fill="#0E0A12"><tspan font-weight="800">stage 1.5</tspan> · repair: pymeshlab close holes (warns)</text>
  <text x="916"  y="454" font-size="11" fill="#0E0A12"><tspan font-weight="800">stage 2</tspan> · crop to neck (boolean cut, CDT triangulate)</text>
  <text x="916"  y="472" font-size="11" fill="#0E0A12"><tspan font-weight="800">stage 3</tspan> · subtract negative_core.stl (carve cavity)</text>
  <text x="916"  y="490" font-size="11" fill="#0E0A12"><tspan font-weight="800">stage 4</tspan> · union valve_cap.stl (fall back to concat)</text>
  <text x="916"  y="508" font-size="11" fill="#0E0A12"><tspan font-weight="800">stage 5</tspan> · simplify 50–80k tris · Taubin smooth · STL</text>
  <line x1="916" y1="518" x2="1204" y2="518" stroke="#FF2EAB" stroke-width="1"/>
  <text x="1060" y="538" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">user sliders: Crop Tightness · Head Pitch</text>
  <text x="1060" y="556" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">Head Height · Cap Protrusion</text>
  <text x="1060" y="576" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">manifold3d 3.4 · trimesh 4.x · pymeshlab</text>
  <text x="1060" y="592" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">fast-simplification</text>

  <rect x="900" y="612" width="320" height="92" rx="10" fill="#F5F2E5" stroke="#FF2EAB" stroke-width="2.5" stroke-dasharray="6 4"/>
  <text x="1060" y="634" text-anchor="middle" font-size="12" font-weight="900" font-style="italic" fill="#FF2EAB" letter-spacing="0.04em">/RUNPOD-VOLUME (NETWORK)</text>
  <text x="1060" y="652" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">hf/ — TRELLIS + dinov2 + u2net weights</text>
  <text x="1060" y="668" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">torch/ — torch.hub cache</text>
  <text x="1060" y="684" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">cache/trellis/ — slider-tweak fast path</text>
  <text x="1060" y="700" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">failures/&lt;date&gt;/&lt;jobId&gt;/ — corpus</text>

  <rect x="900" y="716" width="320" height="64" rx="8" fill="#FFFFFF" stroke="#0E0A12" stroke-width="1.6"/>
  <text x="1060" y="738" text-anchor="middle" font-size="12" font-weight="700" fill="#0E0A12">assets baked into image</text>
  <text x="1060" y="755" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">/app/valve_cap.stl · /app/negative_core.stl</text>
  <text x="1060" y="772" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">/app/pipeline/pipeline_constants.json</text>

  <!-- ── BUILD &amp; RELEASE PIPELINE ──────────────────────────────────── -->
  <rect x="40" y="660" width="800" height="130" rx="14" fill="#F5F2E5" stroke="#7C5E1F" stroke-width="2.5"/>
  <text x="60" y="685" font-size="14" font-weight="900" font-style="italic" fill="#7C5E1F">Build &amp; release pipeline</text>

  <rect x="60"  y="700" width="190" height="74" rx="8" fill="#FFFFFF" stroke="#7C5E1F" stroke-width="1.5"/>
  <text x="155" y="722" text-anchor="middle" font-size="12" font-weight="700" fill="#0E0A12">git push + gh release</text>
  <text x="155" y="740" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">vX.Y.Z tag triggers GHA</text>
  <text x="155" y="756" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">bump HANDLER_VERSION</text>
  <text x="155" y="770" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">in same commit</text>

  <rect x="270" y="700" width="180" height="74" rx="8" fill="#FFFFFF" stroke="#7C5E1F" stroke-width="1.5"/>
  <text x="360" y="722" text-anchor="middle" font-size="12" font-weight="700" fill="#0E0A12">GitHub Actions</text>
  <text x="360" y="740" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">build-runpod-image.yml</text>
  <text x="360" y="756" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">~17–25 min cold</text>
  <text x="360" y="770" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">cache-from: type=gha</text>

  <rect x="470" y="700" width="170" height="74" rx="8" fill="#FFFFFF" stroke="#7C5E1F" stroke-width="1.5"/>
  <text x="555" y="722" text-anchor="middle" font-size="12" font-weight="700" fill="#0E0A12">GHCR registry</text>
  <text x="555" y="740" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">ghcr.io/&lt;owner&gt;/&lt;repo&gt;</text>
  <text x="555" y="756" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">:vX.Y.Z + :latest</text>
  <text x="555" y="770" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">multi-GB image</text>

  <rect x="660" y="700" width="170" height="74" rx="8" fill="#FFFFFF" stroke="#7C5E1F" stroke-width="1.5"/>
  <text x="745" y="722" text-anchor="middle" font-size="12" font-weight="700" fill="#0E0A12">RunPod release</text>
  <text x="745" y="740" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">Manage → New Release</text>
  <text x="745" y="756" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">paste GHCR URL</text>
  <text x="745" y="770" text-anchor="middle" font-size="11" font-style="italic" fill="#3D2F4A">verify boot banner</text>

  <!-- ── ARROWS ────────────────────────────────────────────────────── -->
  <!-- Browser ⇄ DO (brand purple, socket.io) -->
  <path d="M420 235 L460 235" stroke="#7B2EFF" stroke-width="2.5" fill="none" marker-end="url(#arrSdzBrand)"/>
  <text x="440" y="228" text-anchor="middle" font-size="10" fill="#7B2EFF" font-weight="800" font-style="italic">socket.io</text>
  <path d="M460 290 L420 290" stroke="#7B2EFF" stroke-width="2.5" fill="none" marker-end="url(#arrSdzBrand)"/>
  <text x="440" y="305" text-anchor="middle" font-size="10" fill="#7B2EFF" font-weight="800" font-style="italic">progress · result</text>

  <!-- DO server ⇄ Postgres (fluoro green) -->
  <path d="M650 496 L650 506" stroke="#1FCE6E" stroke-width="2.5" fill="none" marker-end="url(#arrSdzGreen)"/>

  <!-- DO ⇄ RunPod (magenta, chunked yield) -->
  <path d="M820 296 L900 200" stroke="#FF2EAB" stroke-width="2.5" fill="none" marker-end="url(#arrSdzMagenta)"/>
  <text x="877" y="240" text-anchor="middle" font-size="10" fill="#FF2EAB" font-weight="800" font-style="italic">POST /run</text>
  <path d="M900 250 L820 326" stroke="#FF2EAB" stroke-width="2.5" fill="none" marker-end="url(#arrSdzMagenta)"/>
  <text x="845" y="312" text-anchor="middle" font-size="10" fill="#FF2EAB" font-weight="800" font-style="italic">/stream/&lt;id&gt;</text>

  <!-- Browser ⇄ Stripe (gray) -->
  <path d="M230 316 L230 348" stroke="#3D2F4A" stroke-width="2" fill="none" marker-end="url(#arrSdzMuted)"/>

  <!-- DO server ⇄ Stripe (gray) -->
  <path d="M460 470 L320 410" stroke="#3D2F4A" stroke-width="2" fill="none" marker-end="url(#arrSdzMuted)"/>

  <!-- Build pipeline chain (gold) -->
  <path d="M250 737 L270 737" stroke="#7C5E1F" stroke-width="2" fill="none" marker-end="url(#arrSdzGold)"/>
  <path d="M450 737 L470 737" stroke="#7C5E1F" stroke-width="2" fill="none" marker-end="url(#arrSdzGold)"/>
  <path d="M640 737 L660 737" stroke="#7C5E1F" stroke-width="2" fill="none" marker-end="url(#arrSdzGold)"/>
  <path d="M830 737 L880 737 L880 200 L900 200" stroke="#7C5E1F" stroke-width="2" fill="none" marker-end="url(#arrSdzGold)" stroke-dasharray="4 3"/>

  <!-- ── LEGEND ────────────────────────────────────────────────────── -->
  <!-- Pinned-dark pill so the legend reads at 14.75:1 instead of the
       previous 10.98:1 ink-muted-on-cream — owner flagged it as
       low-contrast on the live site. Mirrors the title pill at top
       for visual symmetry. -->
  <rect x="32" y="822" width="1216" height="98" rx="14" fill="#0E0A12"/>
  <text x="48" y="846" font-size="14" font-weight="900" font-style="italic" fill="#2EFF8C" letter-spacing="0.04em">KEY DATA FLOWS</text>

  <line x1="48"  y1="864" x2="92"  y2="864" stroke="#7B2EFF" stroke-width="3"/>
  <text x="100" y="868" font-size="12" font-weight="700" font-style="italic" fill="#F5F2E5">socket.io (command pattern, no REST)</text>

  <line x1="318" y1="864" x2="362" y2="864" stroke="#FF2EAB" stroke-width="3"/>
  <text x="370" y="868" font-size="12" font-weight="700" font-style="italic" fill="#F5F2E5">RunPod HTTP poll (chunked-yield protocol)</text>

  <line x1="650" y1="864" x2="694" y2="864" stroke="#2EFF8C" stroke-width="3"/>
  <text x="702" y="868" font-size="12" font-weight="700" font-style="italic" fill="#F5F2E5">Postgres TLS (BYTEA STL · 24h TTL)</text>

  <line x1="958" y1="864" x2="1002" y2="864" stroke="#D89E2F" stroke-width="3"/>
  <text x="1010" y="868" font-size="12" font-weight="700" font-style="italic" fill="#F5F2E5">Build / release path (image lifecycle)</text>

  <text x="48" y="894" font-size="12" font-weight="600" font-style="italic" fill="#2EFF8C">See README.md, ProductSpec.md, 3D_Pipeline.md, docs/RUNPOD_TRELLIS_PLAYBOOK.md for the prose.</text>
  <text x="48" y="912" font-size="10" font-style="italic" fill="#A267FF">Generated by /how-it-works · sourced from architecture.svg</text>
</svg>`;
}

function sixpackTeaser() {
  // 6 lore poster thumbnails + CTA. No Three.js, no fetches — just <img>
  // tags pointing at the same /valve-models/thumbs/ assets the /sixpack
  // route uses. Vite's publicDir serves them.
  const slugs = [
    { slug: 'professor', name: 'The Professor' },
    { slug: 'captain', name: 'The Captain' },
    { slug: 'big-mick', name: 'Big Mick' },
    { slug: 'the-wooly', name: 'Little Space Bear' },
    { slug: 'old-reliable', name: 'Old Reliable' },
    { slug: 'the-cobra', name: 'Sasquatch Foot' },
  ];
  const grid = el(
    'div',
    {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: '0.75rem',
        marginTop: '1.5rem',
      },
    },
    ...slugs.map((s) =>
      el(
        'a',
        {
          href: '/sixpack',
          'data-link': '',
          'aria-label': s.name + ' — open the Sixpack',
          style: {
            position: 'relative',
            display: 'block',
            aspectRatio: '1 / 1',
            background: 'var(--ink)',
            border: '2px solid var(--ink)',
            overflow: 'hidden',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            boxShadow: '4px 4px 0 var(--brand)',
            textDecoration: 'none',
          },
          onMouseEnter: (e) => {
            e.currentTarget.style.transform = 'translate(-2px, -2px)';
            e.currentTarget.style.boxShadow = '6px 6px 0 var(--accent2)';
          },
          onMouseLeave: (e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '4px 4px 0 var(--brand)';
          },
        },
        el('img', {
          src: '/valve-models/thumbs/' + s.slug + '.png',
          alt: s.name,
          loading: 'lazy',
          decoding: 'async',
          style: {
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            padding: '6px',
            filter: 'drop-shadow(2px 2px 0 rgba(0,0,0,0.4))',
          },
        }),
      ),
    ),
  );

  return el(
    'section',
    {
      class: 'max-w-6xl mx-auto px-6 py-12 md:py-16',
      style: { borderTop: '3px dashed var(--ink)' },
    },
    el(
      'div',
      {
        class: 'grid md:grid-cols-[1fr_auto] gap-4 items-end mb-1',
      },
      el(
        'div',
        {},
        el(
          'span',
          {
            style: {
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.78rem',
              fontWeight: '700',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--brand)',
            },
          },
          'Drop 002 · Sadie’s Sixpack',
        ),
        el(
          'h2',
          {
            class: 'sdz-display',
            style: {
              fontSize: '2rem',
              color: 'var(--ink)',
              textShadow: '4px 4px 0 var(--accent3)',
              margin: '0.25rem 0 0.5rem',
            },
          },
          'Six caps. Six legends. All free.',
        ),
        el(
          'p',
          { style: { color: 'var(--ink-muted)', fontSize: '0.95rem', lineHeight: '1.5', maxWidth: '54ch' } },
          'The freebies in the gumball machine, lifted out and put online. No checkout, no auth — drop a quarter or grab the STL.',
        ),
      ),
      el(
        'a',
        {
          class: 'sdz-cta',
          href: '/sixpack',
          'data-link': '',
          style: { fontSize: '0.95rem', padding: '0.75rem 1.4rem', whiteSpace: 'nowrap' },
        },
        'See the lore  →',
      ),
    ),
    grid,
  );
}

function stepCard(num, title, body, accent, svgMarkup) {
  // Optional inline SVG illustration (hand-drawn lift from the
  // GumBall Assets prototype). Rendered in a 4:3 ink-bordered tile
  // above the step number when provided.
  const art = svgMarkup
    ? (() => {
        const tile = el('div', {
          style: {
            width: '100%',
            aspectRatio: '4 / 3',
            border: '2px solid var(--ink)',
            background: accent,
            marginBottom: '0.85rem',
            display: 'grid',
            placeItems: 'center',
            position: 'relative',
            overflow: 'hidden',
          },
        });
        tile.innerHTML = svgMarkup;
        return tile;
      })()
    : null;
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
    art,
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

// Hand-drawn step illustrations lifted verbatim from the GumBall Assets
// prototype index.html. Each is a self-contained SVG with no external
// dependencies; sized via the 4:3 .step__icon tile in stepCard.
const STEP_ART_UPLOAD = `
  <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-label="Drop a photo">
    <defs><pattern id="dotsUp" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.1" fill="#0E0A12" opacity="0.18"/></pattern></defs>
    <rect width="200" height="150" fill="url(#dotsUp)"/>
    <rect x="22" y="92" width="156" height="38" rx="3" fill="#0E0A12"/>
    <rect x="32" y="100" width="136" height="22" rx="2" fill="#7B2EFF"/>
    <text x="100" y="116" text-anchor="middle" font-family="Anton, sans-serif" font-size="13" font-style="italic" fill="#F5F2E5" letter-spacing="2">DROP HERE</text>
    <g transform="translate(100 60) rotate(-8)">
      <rect x="-32" y="-38" width="64" height="76" fill="#F5F2E5" stroke="#0E0A12" stroke-width="3"/>
      <rect x="-26" y="-32" width="52" height="48" fill="#FF2EAB"/>
      <circle cx="0" cy="-10" r="14" fill="#FFD400" stroke="#0E0A12" stroke-width="2.5"/>
      <circle cx="-5" cy="-12" r="2" fill="#0E0A12"/>
      <circle cx="5" cy="-12" r="2" fill="#0E0A12"/>
      <path d="M -6 -4 Q 0 1 6 -4" stroke="#0E0A12" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <text x="0" y="32" text-anchor="middle" font-family="Permanent Marker, cursive" font-size="9" fill="#0E0A12">YOU</text>
    </g>
    <path d="M 70 22 L 78 40" stroke="#0E0A12" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M 130 22 L 122 40" stroke="#0E0A12" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M 100 12 L 100 32" stroke="#0E0A12" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M 30 30 l 4 0 M 32 28 l 0 4" stroke="#0E0A12" stroke-width="2"/>
    <path d="M 170 35 l 5 0 M 172.5 32.5 l 0 5" stroke="#0E0A12" stroke-width="2"/>
    <path d="M 25 60 l 4 0 M 27 58 l 0 4" stroke="#0E0A12" stroke-width="2"/>
  </svg>`;

const STEP_ART_SCULPT = `
  <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-label="Generator turns photo into 3D mesh">
    <g transform="translate(32 75) rotate(-4)">
      <rect x="-22" y="-26" width="44" height="52" fill="#F5F2E5" stroke="#0E0A12" stroke-width="2.5"/>
      <rect x="-18" y="-22" width="36" height="32" fill="#2EFF8C"/>
      <circle cx="0" cy="-7" r="9" fill="#FFD400" stroke="#0E0A12" stroke-width="2"/>
      <circle cx="-3" cy="-9" r="1.4" fill="#0E0A12"/>
      <circle cx="3" cy="-9" r="1.4" fill="#0E0A12"/>
      <path d="M -4 -3 Q 0 0 4 -3" stroke="#0E0A12" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <text x="0" y="22" text-anchor="middle" font-family="Permanent Marker, cursive" font-size="6" fill="#0E0A12">.JPG</text>
    </g>
    <path d="M 60 75 L 78 75" stroke="#0E0A12" stroke-width="3" stroke-linecap="round"/>
    <polygon points="76,70 84,75 76,80" fill="#0E0A12"/>
    <g>
      <rect x="80" y="48" width="56" height="54" rx="3" fill="#FFD400" stroke="#0E0A12" stroke-width="3"/>
      <rect x="84" y="52" width="48" height="14" fill="#0E0A12"/>
      <text x="108" y="62" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="7" font-weight="700" fill="#2EFF8C" letter-spacing="1.2">TRELLIS</text>
      <circle cx="93" cy="80" r="4.5" fill="#0E0A12"/><circle cx="93" cy="80" r="1.5" fill="#FFD400"/>
      <circle cx="108" cy="86" r="6" fill="#FF2EAB" stroke="#0E0A12" stroke-width="2"/>
      <circle cx="123" cy="80" r="4.5" fill="#0E0A12"/><circle cx="123" cy="80" r="1.5" fill="#FFD400"/>
      <circle cx="84" cy="52" r="1.5" fill="#F5F2E5"/><circle cx="132" cy="52" r="1.5" fill="#F5F2E5"/>
      <circle cx="84" cy="98" r="1.5" fill="#0E0A12"/><circle cx="132" cy="98" r="1.5" fill="#0E0A12"/>
    </g>
    <path d="M 90 38 l 0 8 M 86 42 l 8 0" stroke="#FF2EAB" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M 110 32 l 0 10 M 105 37 l 10 0" stroke="#2EFF8C" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M 128 40 l 0 7 M 124.5 43.5 l 7 0" stroke="#0E0A12" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M 138 75 L 156 75" stroke="#0E0A12" stroke-width="3" stroke-linecap="round"/>
    <polygon points="154,70 162,75 154,80" fill="#0E0A12"/>
    <g transform="translate(180 75)">
      <ellipse cx="0" cy="0" rx="16" ry="20" fill="#7B2EFF" stroke="#0E0A12" stroke-width="2.5"/>
      <path d="M -16 0 Q 0 -3 16 0" stroke="#2EFF8C" stroke-width="0.9" fill="none"/>
      <path d="M -15 -8 Q 0 -10 15 -8" stroke="#2EFF8C" stroke-width="0.9" fill="none"/>
      <path d="M -15 8 Q 0 10 15 8" stroke="#2EFF8C" stroke-width="0.9" fill="none"/>
      <path d="M 0 -20 Q 3 0 0 20" stroke="#2EFF8C" stroke-width="0.9" fill="none"/>
      <path d="M -8 -19 Q -5 0 -8 19" stroke="#2EFF8C" stroke-width="0.9" fill="none"/>
      <path d="M 8 -19 Q 5 0 8 19" stroke="#2EFF8C" stroke-width="0.9" fill="none"/>
      <circle cx="-5" cy="-4" r="1.5" fill="#0E0A12"/>
      <circle cx="5" cy="-4" r="1.5" fill="#0E0A12"/>
    </g>
    <text x="180" y="125" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="6.5" font-weight="700" fill="#0E0A12">.STL</text>
  </svg>`;

const STEP_ART_PRINT = `
  <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-label="3D printer extrudes valve cap">
    <rect x="20" y="118" width="160" height="10" fill="#0E0A12"/>
    <rect x="14" y="125" width="172" height="6" fill="#7B2EFF" stroke="#0E0A12" stroke-width="2"/>
    <rect x="22" y="22" width="6" height="100" fill="#0E0A12"/>
    <rect x="172" y="22" width="6" height="100" fill="#0E0A12"/>
    <rect x="22" y="22" width="156" height="6" fill="#0E0A12"/>
    <rect x="28" y="44" width="144" height="4" fill="#0E0A12"/>
    <g transform="translate(118 46)">
      <rect x="-14" y="0" width="28" height="18" fill="#FFD400" stroke="#0E0A12" stroke-width="2.5"/>
      <polygon points="-6,18 6,18 0,30" fill="#0E0A12"/>
      <path d="M 0 -8 L 0 0" stroke="#FF2EAB" stroke-width="3" stroke-linecap="round"/>
      <text x="0" y="11" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="6" font-weight="700" fill="#0E0A12">HOT</text>
    </g>
    <path d="M 118 76 L 100 96" stroke="#FF2EAB" stroke-width="2" stroke-dasharray="2 2"/>
    <g transform="translate(100 105)">
      <ellipse cx="0" cy="8" rx="22" ry="4" fill="#2EFF8C" stroke="#0E0A12" stroke-width="2"/>
      <rect x="-22" y="-2" width="44" height="10" fill="#2EFF8C" stroke="#0E0A12" stroke-width="2"/>
      <path d="M -22 0 L 22 0 M -22 3 L 22 3 M -22 6 L 22 6" stroke="#0E0A12" stroke-width="0.6" opacity="0.5"/>
      <ellipse cx="0" cy="-8" rx="14" ry="10" fill="#F5F2E5" stroke="#0E0A12" stroke-width="2"/>
      <circle cx="-3" cy="-9" r="1.2" fill="#0E0A12"/>
      <circle cx="3" cy="-9" r="1.2" fill="#0E0A12"/>
      <path d="M -3 -5 Q 0 -3 3 -5" stroke="#0E0A12" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      <path d="M -22 0 L -18 -4 L -14 0 L -10 -4 L -6 0 L -2 -4 L 2 0 L 6 -4 L 10 0 L 14 -4 L 18 0 L 22 -4" stroke="#0E0A12" stroke-width="1" fill="none" opacity="0.4"/>
    </g>
    <g transform="translate(160 65)">
      <polygon points="0,-14 3,-4 14,-4 5,2 8,12 0,6 -8,12 -5,2 -14,-4 -3,-4" fill="#FF2EAB" stroke="#0E0A12" stroke-width="2"/>
      <text x="0" y="2" text-anchor="middle" font-family="Anton, sans-serif" font-style="italic" font-size="7" fill="#F5F2E5">DING!</text>
    </g>
    <path d="M 38 60 l 8 0 M 38 66 l 12 0" stroke="#0E0A12" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;

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
