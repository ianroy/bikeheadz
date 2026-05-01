// StemDomeZ — landing page.
//
// Section flow lifted 1:1 from the GumBall Assets prototype
// (/Users/ianroy/Library/CloudStorage/Dropbox/Sadys Bikes/GumBall Assets/_handoff/for-claude-code/index.html):
//
//   1. Top marquee  (sdzr-marquee, default magenta)
//   2. Hero — cap   (sdzr-bg-paper sdzr-grain, spinning CSS-3D cap)
//   3. Mid marquee  (sdzr-marquee--purple, reversed)
//   4. How it works (sdzr-bg-paper, 3 steps with hand-drawn SVG)
//   5. Architecture (sdzr-bg-violet sdzr-grain, "How it really works.")
//   6. Marquee 3    (sdzr-marquee--magenta)
//   7. Sixpack      (sdzr-bg-paper-soft, 6 lore cards + Mint CTA)
//   8. Pricing      (sdzr-bg-paper, $2 STL graffiti'd, "FREE FOR A LIMITED TIME!")
//   9. Print spec   (sdzr-bg-ink, locked invariants grid)
//  10. About        (sdzr-bg-green, MADE FOR A GUMBALL MACHINE.)
//  11. Footer       (existing brand-styled, ink ground)
//
// All landing CSS is in client/styles/sdzr-landing.css (lifted from
// the prototype's <style> block) and client/styles/sdz-radical.css
// (the namespaced sdzr-* utility layer). Theme tokens are pinned via
// var(--sdzr-*) so the page renders the same in light + dark mode.

import { el } from '../dom.js';
import { getCachedAppConfig } from '../util/app-config.js';

export function HomePage({ socket: _socket }) {
  const cfg = getCachedAppConfig();
  const paymentsOff = !cfg.paymentsEnabled;
  const printingOff = !cfg.printingEnabled;
  const root = el('div');

  root.appendChild(topMarquee());
  root.appendChild(heroCap({ paymentsOff }));
  root.appendChild(midMarquee());
  root.appendChild(howSection({ paymentsOff, printingOff }));
  root.appendChild(architectureSection());
  root.appendChild(marqueeMagenta());
  root.appendChild(sixpackSection());
  root.appendChild(pricingSection({ paymentsOff }));
  root.appendChild(printSpecSection());
  root.appendChild(aboutSection());
  // Footer is mounted globally in client/main.js so every route shows it.

  return { el: root };
}

// ────────────────────────────────────────────────────────────────────
//  MARQUEES
// ────────────────────────────────────────────────────────────────────

function buildMarquee(items, { variantClass = '', reverse = false } = {}) {
  const REPEAT = 6;
  const track = el('div', {
    class: 'sdzr-marquee__track' + (reverse ? ' sdzr-marquee__track--rev' : ''),
  });
  for (let i = 0; i < REPEAT; i++) {
    items.forEach((label) => {
      track.appendChild(el('span', null, label));
      track.appendChild(el('span', { class: 'sdzr-marquee__sep' }, '●'));
    });
  }
  return el('div', { class: 'sdzr-marquee ' + variantClass, 'aria-hidden': 'true' }, track);
}

function topMarquee() {
  return buildMarquee([
    'STEMDOMEZ DROP 001', '$2 STL · NO CAD', 'YOUR FACE · YOUR VALVE',
    'FDM · PLA · 0.4mm NOZZLE', 'PRINT IT · RIDE IT', 'SCHRADER FIT ✓',
  ]);
}

function midMarquee() {
  return buildMarquee([
    'SHIPPED FROM THE WORKSHOP', '7-STAGE CAD PIPELINE',
    'TRELLIS IMAGE→3D', 'MONGOOSE BMX PALETTE', 'EST. 2026 · SOFTLY',
  ], { variantClass: 'sdzr-marquee--purple', reverse: true });
}

function marqueeMagenta() {
  return buildMarquee([
    'DROP 002 LOADING', 'NEW DOMEZ EVERY FRIDAY',
    'STEMDOMEZ.COM/PRESS', 'NEON PURPLE FOREVER',
  ], { variantClass: 'sdzr-marquee--magenta' });
}

// ────────────────────────────────────────────────────────────────────
//  HERO — cap variant (spinning CSS-3D dome on the right)
// ────────────────────────────────────────────────────────────────────

function heroCap({ paymentsOff }) {
  const stickers = el('div', { style: { display: 'flex', gap: '0.55rem', flexWrap: 'wrap', marginTop: '1.5rem' } },
    el('span', { class: 'sdzr-sticker sdzr-sticker--green', 'data-rot': '-4' }, '$2 STL'),
    el('span', { class: 'sdzr-sticker sdzr-sticker--magenta', 'data-rot': '3' }, 'FDM · PLA'),
    el('span', { class: 'sdzr-sticker sdzr-sticker--purple', 'data-rot': '-2' }, '0.4mm NOZZLE'),
    el('span', { class: 'sdzr-sticker sdzr-sticker--ink', 'data-rot': '5' }, 'SCHRADER FIT ✓'),
  );

  const ctas = el('div', { style: { display: 'flex', gap: '0.8rem', flexWrap: 'wrap' } },
    el('a', { class: 'sdzr-cta', href: '/stemdome-generator', 'data-link': '' }, 'Make Yours →'),
    el('a', { class: 'sdzr-cta sdzr-cta--ghost', href: '/#how', 'data-link': '' }, 'How it works'),
  );

  // The "$2" line gets a graffiti strikethrough when payments are off.
  const subPrice = paymentsOff
    ? el('span', null,
        el('span', { class: 'sdz-graffiti-strike' }, '$2 STL'),
        ' ',
        el('span', { class: 'sdz-graffiti-tag', style: { fontSize: '0.85em' } }, 'Free!'),
      )
    : el('span', null, '$2 STL · 3D printable on any FDM/PLA setup.');

  // Splatter dots — must be a real SVGElement (createElementNS), otherwise
  // the painted <circle> children won't render. SDZRadical.init paints
  // them once the element is in the DOM via refreshSplatter().
  const splatter = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  splatter.setAttribute('class', 'sdzr-splatter');
  splatter.setAttribute('aria-hidden', 'true');
  splatter.setAttribute('data-count', '120');
  Object.assign(splatter.style, {
    position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none',
  });

  return el('section', { class: 'hero hero--cap sdzr-bg-paper sdzr-grain' },
    splatter,
    el('div', { class: 'wrap hero__inner' },
      el('div', null,
        el('span', { class: 'sdzr-eyebrow' }, 'EST. 2026 · DROP 001 · STEMDOMEZ.COM'),
        el('h1', { class: 'hero__title sdzr-display sdzr-shadow-tri' },
          'YOUR FACE.',
          el('br'),
          'ON A VALVE',
          el('br'),
          'CAP.',
        ),
        el('p', { class: 'hero__sub' },
          'Drop in a portrait. A GPU running TRELLIS sculpts your dome in 3D. We graft it into a Schrader thread. 3D Print the STL. Screw on your tire valve. Roll out.',
          el('br'),
          el('span', { style: { color: 'var(--sdzr-brand)', fontStyle: 'italic', fontWeight: 700 } }, subPrice),
        ),
        ctas,
        stickers,
      ),
      el('div', { class: 'sdzr-cap-stage' },
        el('div', { class: 'cap-shell' },
          el('div', { class: 'sdzr-cap', title: 'drag to spin' },
            el('div', { class: 'cap-cyl' },
              el('div', { class: 'cap-cyl__side' }),
              el('div', { class: 'cap-cyl__top' }),
            ),
            el('div', { class: 'cap-head' }),
            el('div', { class: 'cap-glasses' }),
          ),
        ),
        el('div', { style: { position: 'absolute', bottom: '0', left: '0', right: '0', textAlign: 'center' } },
          el('span', { class: 'sdzr-eyebrow', style: { justifyContent: 'center' } }, 'DRAG TO SPIN ↻'),
        ),
      ),
    ),
  );
}

// ────────────────────────────────────────────────────────────────────
//  HOW IT WORKS — 3 steps with hand-drawn SVG illustrations
// ────────────────────────────────────────────────────────────────────

function howSection({ paymentsOff, printingOff }) {
  const printBody = paymentsOff
    ? (printingOff
        ? 'Sign in and grab the STL file — free for a limited time. Print it on your own 3D Printer.'
        : 'Sign in and grab the STL file — free for a limited time. Print it on your own 3D Printer, or order one printed and shipped soon.')
    : '$2 grabs the STL. $19.99 ships you a printed cap. $59.99 a pack of four for the crew.';

  return el('section', { class: 'section sdzr-bg-paper', id: 'how' },
    el('div', { class: 'wrap' },
      el('div', { class: 'section__head' },
        el('div', null,
          el('span', { class: 'sdzr-eyebrow' }, 'PROCESS · 3 STEPS · 90 SECONDS'),
          el('h2', { class: 'section__title sdzr-display sdzr-shadow-green' }, 'PHOTO → STL → CAP.'),
          el('p', { class: 'section__lede' }, 'A 7-stage CAD pipeline runs on a serverless GPU. You see the mesh before you pay.'),
        ),
        el('span', { class: 'sdzr-sticker sdzr-sticker--magenta', 'data-rot': '6' }, 'NO CAD REQUIRED'),
      ),
      el('div', { class: 'steps' },
        stepCard('01', 'UPLOAD', 'Drop a photo.',
          'Front-facing portrait from the shoulders up. Good light, clean background. PNG or JPEG, up to 5 MB. Drag in or click to upload. Your data stays on our private server and never goes to any AI in the cloud for processing.',
          'var(--sdzr-accent2)', STEP_ART_UPLOAD),
        stepCard('02', 'SCULPT', 'Generator does the work.',
          'Our privately hosted TRELLIS generates a 3D head from your photo. A 7-stage CAD pipeline grafts it onto a Schrader valve cap. ~30–60 s on a GPU-powered private server.',
          'sdzr-halftone-purple', STEP_ART_SCULPT, true),
        stepCard('03', 'PRINT', paymentsOff ? 'Print it free.' : 'Print or buy printed.',
          printBody,
          'var(--sdzr-accent3)', STEP_ART_PRINT),
      ),
    ),
  );
}

function stepCard(num, eyebrow, title, body, bgOrClass, svgMarkup, useClass = false) {
  const iconAttrs = { class: 'step__icon' + (useClass ? ' ' + bgOrClass : '') };
  if (!useClass) iconAttrs.style = { background: bgOrClass };
  const icon = el('div', iconAttrs);
  icon.innerHTML = svgMarkup; // sets the SVG only
  icon.insertBefore(el('span', { class: 'step__chip' }, num), icon.firstChild);
  return el('div', { class: 'step' },
    icon,
    el('span', { class: 'step__no' }, eyebrow),
    el('h3', { class: 'step__title' }, title),
    el('p', { style: { margin: '0' } }, body),
  );
}

// ────────────────────────────────────────────────────────────────────
//  ARCHITECTURE — "How it really works." (#gallery in prototype)
// ────────────────────────────────────────────────────────────────────

function architectureSection() {
  const cols = el('div', { class: 'archdiagram__cols' },
    archcol({ kind: 'brand', title: 'Browser (Client)', sub: 'Vite · vanilla JS' }, [
      archbox('Vanilla JS UI', 'Tailwind v4 · router · command pattern'),
      archbox('Three.js viewer', 'STLLoader · OrbitControls'),
      archbox('socket.io client — single "command" event', '{ id, name, payload } · request/response correlated by id', 'accent'),
      archbox('Stripe Checkout (hosted redirect)', 'verified server-side on redirect-return — no webhook required'),
      archbox('Stripe (external)', 'hosted Checkout · returns on success<br>flag-gated by payments_enabled — off in MVP launch', 'ghost'),
    ]),
    archcol({ kind: 'paper', title: 'DigitalOcean App Platform', sub: 'Node 22 · Express · socket.io · helmet CSP · graceful SIGTERM' }, [
      archbox('server/index.js', 'Express + socket.io · GET /health · /metrics<br>command dispatcher (single \'command\' event)<br>stl / payments / designs / orders / account / admin / flags'),
      archbox('workers/runpod-client.js', 'POST /run · GET /stream/&lt;id&gt; (1.5s polling, 12 min cap)<br>indexes result_chunk frames; reassembles base64<br>/status fallback for dropped streams'),
      archbox('design-store.js', 'stl_bytes BYTEA in Postgres · 24h TTL · in-memory fallback<br>prune job runs every 15 min'),
      archbox('stripe-client.js · app-config.js', 'SDK factory · pricing catalogue<br>payments_enabled · printing_enabled · aaa_toggle_enabled'),
      archbox('Managed Postgres 18', 'accounts · generated_designs · purchases · feature_flags<br>migrations applied on PRE_DEPLOY<br>TLS connection · BYTEA STL with 24h TTL', 'dashed'),
    ]),
    archcol({ kind: 'magenta', title: 'RunPod Serverless GPU', sub: 'image: ghcr.io/<owner>/<repo>:vX.Y.Z' }, [
      archbox('handler.py (generator)', '[stemdomez] handler.py vX.Y.Z booting<br>module-load probes · failure corpus<br>return_aggregate_stream=False<br>yields: progress · result_chunk × N · result<br>CHUNK_SIZE = 700 KB'),
      archbox('TRELLIS-image-large', '~30s warm · ~5–10 min cold<br>~780K tri load mesh, often non-manifold<br>cached on /runpod-volume/cache/trellis'),
      archbox('v1 mesh pipeline (pipeline/stages.py)',
        '<em>stage 1</em> · normalize, orient z-up, rescale to 30 mm<br>' +
        '<em>stage 1.5</em> · repair: pymeshlab close holes (warns)<br>' +
        '<em>stage 2</em> · crop to neck (boolean cut, CDT triangulate)<br>' +
        '<em>stage 3</em> · subtract negative_core.stl (carve cavity)<br>' +
        '<em>stage 4</em> · union valve_cap.stl (fall back to concat)<br>' +
        '<em>stage 5</em> · simplify 50–80k tris, Taubin smooth, STL', 'accent'),
      archbox('user sliders', 'Crop Tightness · Head Pitch · Head Height · Cap Protrusion<br>manifold3d 3.4 · trimesh 4.x · pymeshlab fast-simplification'),
      archbox('/runpod-volume (network)', 'hf/ — TRELLIS + dinov2 + u2net weights<br>torch/ — torch.hub cache<br>cache/trellis/ — slicer-break fast path<br>failures/&lt;date&gt;/&lt;jobId&gt;/ — corpus', 'dashed'),
      archbox('assets baked into image', '/app/valve_cap.stl · /app/negative_core.stl<br>/app/pipeline/pipeline_constants.json'),
    ]),
  );

  const lane = el('div', { class: 'archlane' },
    el('div', { class: 'archlane__title' }, 'Build & release pipeline'),
    el('div', { class: 'archlane__steps' },
      archlaneStep('git push + gh release', 'vX.Y.Z tag triggers GHA<br>bump HANDLER_VERSION in same commit'),
      el('span', { class: 'archlane__arrow' }, '→'),
      archlaneStep('GitHub Actions', 'build-runpod-image.yml<br>~17–25 min cold<br>cache-from: type=gha'),
      el('span', { class: 'archlane__arrow' }, '→'),
      archlaneStep('GHCR registry', 'ghcr.io/<owner>/<repo>:vX.Y.Z + :latest<br>multi-GB image'),
      el('span', { class: 'archlane__arrow' }, '→'),
      archlaneStep('RunPod release', 'Manage → New Release<br>paste GHCR URL · verify boot banner'),
    ),
  );

  const legend = el('div', { class: 'archlegend' },
    el('strong', null, 'KEY DATA FLOWS'),
    el('span', { class: 'archlegend__item' }, el('span', { class: 'dot dot--brand' }), 'socket.io (command pattern, no REST)'),
    el('span', { class: 'archlegend__item' }, el('span', { class: 'dot dot--magenta' }), 'RunPod HTTP poll (chunked-yield protocol)'),
    el('span', { class: 'archlegend__item' }, el('span', { class: 'dot dot--green' }), 'Postgres TLS (BYTEA STL · 24h TTL)'),
    el('span', { class: 'archlegend__item' }, el('span', { class: 'dot dot--yellow' }), 'Build / release path (image lifecycle)'),
    el('p', null, 'See README.md, ProductSpec.md, 3D_Pipeline.md, docs/RUNPOD_TRELLIS_PLAYBOOK.md for the prose.'),
  );

  const builtWith = el('div', { style: { marginTop: '2rem' } },
    el('div', {
      class: 'sdzr-eyebrow',
      style: { color: 'var(--sdzr-paper)', marginBottom: '0.85rem' },
    }, 'BUILT WITH — TAP ANY CHIP TO OPEN THE PROJECT ↗'),
    el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '0.6rem' } },
      ...[
        ['⚡ Vite', 'https://vitejs.dev/'],
        ['▲ Three.js', 'https://threejs.org/'],
        ['≋ Tailwind CSS', 'https://tailwindcss.com/'],
        ['💬 Socket.IO', 'https://socket.io/'],
        ['⬢ Node.js', 'https://nodejs.org/'],
        ['»» Express', 'https://expressjs.com/'],
        ['◉ DigitalOcean', 'https://www.digitalocean.com/'],
        ['🐘 PostgreSQL', 'https://www.postgresql.org/'],
        ['▶ RunPod', 'https://www.runpod.io/'],
        ['▦ Microsoft TRELLIS', 'https://github.com/microsoft/TRELLIS'],
        ['◇ manifold3d', 'https://github.com/elalish/manifold'],
        ['△ trimesh', 'https://trimesh.org/'],
        ['▥ PyMeshLab', 'https://pymeshlab.readthedocs.io/'],
        ['⚙ GitHub Actions', 'https://github.com/features/actions'],
        ['▣ GHCR', 'https://github.com/features/packages'],
        ['▮▮▮ Stripe', 'https://stripe.com/'],
      ].map(([label, href]) => el('a', { class: 'sdzr-chip', href, target: '_blank', rel: 'noopener noreferrer' }, label)),
    ),
  );

  const subFlow = el('div', {
    style: {
      fontFamily: 'ui-monospace, monospace',
      fontSize: '0.82rem',
      color: 'var(--sdzr-accent2)',
      marginBottom: '1rem',
      letterSpacing: '0.04em',
    },
  }, 'photo → TRELLIS → 7-stage CAD pipeline → chunked-yield delivery → Three.js viewer → Stripe Checkout → STL download');

  return el('section', { class: 'section sdzr-bg-violet sdzr-grain', id: 'gallery', style: { paddingTop: '5rem' } },
    el('div', { class: 'wrap' },
      el('div', { style: { marginBottom: '1.2rem' } },
        el('span', { class: 'sdzr-eyebrow', style: { color: 'var(--sdzr-accent2)' } }, 'TECH STACK'),
        el('h2', { class: 'section__title sdzr-display sdzr-shadow-magenta' }, 'HOW IT REALLY', el('br'), 'WORKS.'),
        el('p', { class: 'section__lede', style: { color: 'var(--sdzr-paper)' } },
          'Photo in, STL out — here is the whole pipeline. Browser fires a single socket.io command, the DO app dispatches it, RunPod’s GPU runs TRELLIS + a 7-stage CAD pipeline, the binary STL streams back in 700 KB chunks. Build → release lifecycle runs out of GitHub Actions → GHCR → RunPod releases.'),
        el('div', { style: { marginTop: '1rem' } },
          el('span', { class: 'sdzr-sticker sdzr-sticker--green', 'data-rot': '-6' }, 'SOURCED FROM ARCHITECTURE.SVG'),
        ),
      ),
      subFlow,
      el('article', { class: 'archdiagram' }, cols, lane, legend),
      builtWith,
    ),
  );
}

function archcol({ kind, title, sub }, boxes) {
  return el('div', { class: 'archcol archcol--' + kind },
    el('div', { class: 'archcol__head' },
      el('span', { class: 'archcol__title' }, title),
      el('span', { class: 'archcol__sub' }, sub),
    ),
    ...boxes,
  );
}

function archbox(strongText, htmlSpan, mod) {
  const cls = 'archbox' + (mod ? ' archbox--' + mod : '');
  const span = el('span');
  span.innerHTML = htmlSpan;
  return el('div', { class: cls }, el('strong', null, strongText), span);
}

function archlaneStep(strongText, htmlSpan) {
  const span = el('span');
  span.innerHTML = htmlSpan;
  return el('div', { class: 'archlane__step' }, el('strong', null, strongText), span);
}

// ────────────────────────────────────────────────────────────────────
//  SIXPACK — full inline gallery (mirrors the prototype #sixpack)
// ────────────────────────────────────────────────────────────────────

const SIXPACK_CARDS = [
  { n: '01', slug: 'captain', name: 'The Captain', sub: 'Beard · flat brim · long stare', lore: 'Founded the shop with a wrench, a coffee can of bolts, and a horizon-line stare. Every regular here is a regular because of him.', chip: 'FDM · 0.12mm', color: 'green' },
  { n: '02', slug: 'big-mick', name: 'Big Mick', sub: 'Stacked tires · sash · undefeated', lore: 'Local Schrader-class champion. Wears the sash on race day. Tells you you’re running too low PSI and is always right.', chip: 'FDM · supports off', color: 'magenta' },
  { n: '03', slug: 'the-wooly', name: 'Little Space Bear', sub: 'Hairy · wide-eyed · cryptid', lore: 'Lives behind the rear-wheel rack. Eats stripped bolts. Comes out when the shop is empty and rearranges the allen keys by feel.', chip: 'FDM · 0.16mm fuzzy', color: 'purple' },
  { n: '04', slug: 'old-reliable', name: 'Old Reliable', sub: 'Ribbed · mushroom flange · shop-grade', lore: 'The grip you bought in 2009 and never replaced. Outlasts the bike, the trends, the owner. Built to be ridden, not photographed.', chip: 'FDM · TPU optional', color: 'green' },
  { n: '05', slug: 'the-cobra', name: 'Sasquatch Foot', sub: 'Diamond skin · bent neck · OG', lore: 'The first cap Sadie’s ever made for a customer’s stem. Diamond-pattern, gooseneck bend, looks like it might bite the rim. The reason this whole project exists.', chip: 'FDM · 0.12mm', color: 'magenta' },
  { n: '06', slug: 'professor', name: 'The Professor', sub: 'Bald · spectacles · mustache', lore: 'Builds software architectures the way a luthier builds guitars — slowly, with feeling. Three monitors, infinite tabs, all of them a chainline.', chip: 'FDM · 0.12mm', color: 'purple' },
];

function sixpackSection() {
  const grid = el('div', { class: 'sixpack-grid' },
    ...SIXPACK_CARDS.map((c) => el('article', { class: 'sixcard', 'data-color': c.color },
      el('div', { class: 'sixcard__corner' }, '№ ' + c.n),
      el('div', { class: 'sixcard__hero' },
        el('img', {
          src: '/valve-models/thumbs/' + c.slug + '.png',
          alt: c.name + ' — Sadie’s Sixpack lore poster',
          loading: 'lazy',
          decoding: 'async',
        }),
      ),
      el('div', { class: 'sixcard__name' }, c.name),
      el('div', { class: 'sixcard__sub' }, c.sub),
      el('p', { class: 'sixcard__lore' }, c.lore),
      el('div', { class: 'sixcard__foot' },
        el('span', { class: 'sixcard__chip' }, c.chip),
        el('a', {
          class: 'sixcard__btn',
          href: '/valve-models/' + c.slug + '.stl',
          download: 'sadie-sixpack-' + c.slug + '.stl',
          rel: 'noopener',
        }, '↓ STL'),
      ),
    )),
  );

  const orbit = el('div', { class: 'cta-orbit' },
    el('span', { class: 'cta-orbit__center' }, 'YOU'),
    el('span', { class: 'cta-orbit__dot', style: { '--a': '0' } }, 'PRO'),
    el('span', { class: 'cta-orbit__dot', style: { '--a': '60' } }, 'CAP'),
    el('span', { class: 'cta-orbit__dot', style: { '--a': '120' } }, 'MICK'),
    el('span', { class: 'cta-orbit__dot', style: { '--a': '180' } }, 'WOOL'),
    el('span', { class: 'cta-orbit__dot', style: { '--a': '240' } }, 'REL'),
    el('span', { class: 'cta-orbit__dot', style: { '--a': '300' } }, 'SAS'),
  );

  const cta = el('div', { class: 'sixpack-cta' },
    el('div', { class: 'sixpack-cta__copy' },
      el('div', { class: 'sdzr-eyebrow', style: { color: 'var(--sdzr-paper)' } }, 'DROP 003 · YOUR FACE'),
      el('h3', { class: 'sixpack-cta__head' }, 'Now make ', el('em', null, 'yours'), '.'),
      el('p', { class: 'sixpack-cta__lede' },
        'The Sixpack is the lore. ',
        el('strong', null, 'StemDomeZ'),
        ' is the press. Drop a portrait. The pipeline does the rest. Free during launch — use code ',
        el('code', null, 'SADYSBIKES'),
        ' after.',
      ),
      el('a', { class: 'sdzr-cta', href: '/stemdome-generator', 'data-link': '', style: { marginTop: '0.6rem' } }, 'MINT YOUR OWN ↗'),
    ),
    el('div', { class: 'sixpack-cta__art', 'aria-hidden': 'true' }, orbit),
  );

  return el('section', { class: 'section sdzr-bg-paper-soft', id: 'sixpack', style: { position: 'relative' } },
    el('div', { class: 'wrap' },
      el('div', { style: { marginBottom: '1.2rem' } },
        el('span', { class: 'sdzr-eyebrow' }, 'SADIE’S SIXPACK · DROP 002 · FREE STLs'),
        el('h2', { class: 'section__title sdzr-display sdzr-shadow-tri' }, 'SADIE’S SIXPACK.'),
        el('p', { class: 'section__lede' },
          'Six valve caps printed from Sadie’s Bikes lore — every regular, every rumor, every bolt-eating creature in the back. Pop a quarter in the gumball machine: you get one of these. Want the other five? Or your own face on a cap? Hit ',
          el('strong', null, 'StemDome'),
          el('span', { style: { color: 'var(--sdzr-brand)', fontStyle: 'italic', fontWeight: 900 } }, 'Z'),
          ' below and roll your own.',
        ),
        el('div', { style: { marginTop: '1rem' } },
          el('span', { class: 'sdzr-sticker sdzr-sticker--magenta', 'data-rot': '-7', style: { whiteSpace: 'nowrap' } }, 'FREE · NO CHECKOUT'),
        ),
      ),
      grid,
      cta,
    ),
  );
}

// ────────────────────────────────────────────────────────────────────
//  PRICING — single $2 STL card, graffiti'd out, FREE FOR A LIMITED TIME
// ────────────────────────────────────────────────────────────────────

function pricingSection({ paymentsOff }) {
  const card = el('article', {
    class: 'price-x-card' + (paymentsOff ? ' spray-x-card' : ''),
  },
    el('span', { class: 'price-x-pill' }, 'STL'),
    el('div', { class: 'price-x-amt' }, '$2'),
    el('p', { class: 'price-x-sub' }, 'Just the file. Print it yourself.'),
  );

  const heading = paymentsOff
    ? el('span', { class: 'spray-strike' }, 'Pricing.')
    : 'Pricing.';

  const note = paymentsOff
    ? el('p', { id: 'freeNote', style: {
        margin: '1.5rem auto 0', maxWidth: '60ch',
        fontFamily: 'ui-monospace, monospace', fontSize: '0.82rem',
        color: 'var(--sdzr-ink-muted)',
      } },
        'MVP launch is in ',
        el('strong', { style: { color: 'var(--sdzr-ink)', background: 'var(--sdzr-accent2)', padding: '0 0.2em' } }, 'free mode'),
        ' for a limited time. After launch, drop the code ',
        el('strong', { style: { background: 'var(--sdzr-accent3)', color: 'var(--sdzr-ink)', padding: '0 0.4em', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.04em' } }, 'SADYSBIKES'),
        ' at checkout to keep yours free.',
      )
    : null;

  return el('section', { class: 'section sdzr-bg-paper', id: 'pricing' },
    el('div', { class: 'wrap', style: { textAlign: 'center' } },
      el('h2', { class: 'section__title sdzr-display', style: { display: 'inline-block', textAlign: 'left' } }, heading),
      el('div', { class: 'price-x-wrap' }, card),
      paymentsOff ? el('div', { class: 'free-graffiti', 'aria-label': 'Free for a limited time' }, 'FREE FOR A LIMITED TIME!') : null,
      note,
      paymentsOff ? el('span', { class: 'sdzr-sticker sdzr-sticker--green', 'data-rot': '-4', style: { marginTop: '1rem', display: 'inline-block' } }, 'FREE MODE: ON') : null,
    ),
  );
}

// ────────────────────────────────────────────────────────────────────
//  PRINT SPEC — locked invariants
// ────────────────────────────────────────────────────────────────────

function printSpecSection() {
  const cells = [
    ['Process', 'FDM · PLA filament'],
    ['Nozzle', '0.4 mm'],
    ['Layer height', '0.12 – 0.16 mm'],
    ['Orientation', 'Cap-down on bed'],
    ['Valve fit', 'Schrader (8 mm × 32 TPI)'],
    ['Size', '~30 mm tall · 22–42 mm tunable'],
    ['Triangles', '50 – 80 K'],
    ['Min wall', '1.2 mm'],
    ['File format', 'Binary STL · slicer-ready'],
  ];
  return el('section', { class: 'section sdzr-bg-ink', id: 'spec' },
    el('div', { class: 'wrap' },
      el('span', { class: 'sdzr-eyebrow', style: { color: 'var(--sdzr-accent2)' } }, 'PRINT SPEC'),
      el('h2', { class: 'section__title sdzr-display sdzr-shadow-green', style: { color: 'var(--sdzr-paper)' } }, 'Print spec.'),
      el('p', { style: { fontFamily: 'ui-monospace, monospace', color: 'var(--sdzr-accent2)', margin: '0.5rem 0 0', fontSize: '0.92rem' } },
        el('em', { style: { fontStyle: 'italic' } }, 'Locked. Designed for FDM/PLA on a 0.4 mm nozzle. Not negotiable; everything below depends on these.'),
      ),
      el('div', { class: 'spec-grid' },
        ...cells.map(([k, v]) => el('div', { class: 'spec-cell' },
          el('div', { class: 'spec-cell__k' }, k),
          el('div', { class: 'spec-cell__v' }, v),
        )),
      ),
      el('p', { style: { fontFamily: 'ui-monospace, monospace', color: 'var(--sdzr-accent2)', marginTop: '1.5rem', fontSize: '0.92rem', fontStyle: 'italic' } },
        'Slicer profile: drop the STL into Bambu Studio, OrcaSlicer, or PrusaSlicer. Add a 5 mm brim, 0 mm brim-object gap. Hit print.'),
    ),
  );
}

// ────────────────────────────────────────────────────────────────────
//  ABOUT — Made for a Gumball Machine.
// ────────────────────────────────────────────────────────────────────

function aboutSection() {
  return el('section', { class: 'section sdzr-bg-green', id: 'about' },
    el('div', { class: 'wrap about-copy' },
      el('span', { class: 'sdzr-eyebrow' }, 'ABOUT'),
      el('h2', { class: 'section__title sdzr-display', style: { fontSize: 'clamp(2.4rem, 6vw, 4.4rem)' } },
        'MADE FOR A',
        el('br'),
        'GUMBALL MACHINE.',
      ),
      el('p', null,
        'StemDomeZ was built for the ',
        el('strong', null, 'Gumball Machine Takeover'),
        ' — a curatorial residency run by ',
        el('a', {
          href: 'https://www.instagram.com/sadiesbikes/',
          target: '_blank',
          rel: 'noopener noreferrer',
          style: {
            color: 'var(--sdzr-ink)',
            textDecoration: 'underline',
            textDecorationColor: 'var(--sdzr-brand)',
            textDecorationThickness: '3px',
          },
        }, 'Sadie’s Bikes'),
        ' out of Great (Turners) Falls, Massachusetts. The brief: come up with 200 things that fit inside a 2″ capsule, and sell each one for 50¢.',
      ),
      el('p', null,
        'So I made a working e-commerce site that prints custom valve-stem caps from a photo of your face, packed it into capsules at ',
        el('strong', null, 'Waterway Arts'),
        ', and pointed people at the URL on the card inside. The machine is the flyer. The capsule is the box. The cap is the product. The site is real and it ships.',
      ),
      el('p', null,
        'Opens First Friday with snacks. ',
        el('strong', null, 'Anything left over rides around in the grab-bag machine'),
        ' at The Wagon Wheel and The Upper Bend until the capsules run out. Big thanks to ',
        el('strong', null, 'Nik Perry'),
        ' for the invitation and the constraints — both of which made the work better.',
      ),
    ),
  );
}

// ────────────────────────────────────────────────────────────────────
//  Hand-drawn step illustrations (inline SVG, lifted from prototype)
// ────────────────────────────────────────────────────────────────────

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
  </svg>`;

const STEP_ART_SCULPT = `
  <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-label="Generator turns photo into 3D mesh">
    <g transform="translate(32 75) rotate(-4)">
      <rect x="-22" y="-26" width="44" height="52" fill="#F5F2E5" stroke="#0E0A12" stroke-width="2.5"/>
      <rect x="-18" y="-22" width="36" height="32" fill="#2EFF8C"/>
      <circle cx="0" cy="-7" r="9" fill="#FFD400" stroke="#0E0A12" stroke-width="2"/>
      <circle cx="-3" cy="-9" r="1.4" fill="#0E0A12"/>
      <circle cx="3" cy="-9" r="1.4" fill="#0E0A12"/>
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
    </g>
    <path d="M 138 75 L 156 75" stroke="#0E0A12" stroke-width="3" stroke-linecap="round"/>
    <polygon points="154,70 162,75 154,80" fill="#0E0A12"/>
    <g transform="translate(180 75)">
      <ellipse cx="0" cy="0" rx="16" ry="20" fill="#7B2EFF" stroke="#0E0A12" stroke-width="2.5"/>
      <path d="M -16 0 Q 0 -3 16 0" stroke="#2EFF8C" stroke-width="0.9" fill="none"/>
      <path d="M -15 -8 Q 0 -10 15 -8" stroke="#2EFF8C" stroke-width="0.9" fill="none"/>
      <path d="M -15 8 Q 0 10 15 8" stroke="#2EFF8C" stroke-width="0.9" fill="none"/>
      <path d="M 0 -20 Q 3 0 0 20" stroke="#2EFF8C" stroke-width="0.9" fill="none"/>
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
      <ellipse cx="0" cy="-8" rx="14" ry="10" fill="#F5F2E5" stroke="#0E0A12" stroke-width="2"/>
      <circle cx="-3" cy="-9" r="1.2" fill="#0E0A12"/>
      <circle cx="3" cy="-9" r="1.2" fill="#0E0A12"/>
    </g>
    <g transform="translate(160 65)">
      <polygon points="0,-14 3,-4 14,-4 5,2 8,12 0,6 -8,12 -5,2 -14,-4 -3,-4" fill="#FF2EAB" stroke="#0E0A12" stroke-width="2"/>
      <text x="0" y="2" text-anchor="middle" font-family="Anton, sans-serif" font-style="italic" font-size="7" fill="#F5F2E5">DING!</text>
    </g>
  </svg>`;
