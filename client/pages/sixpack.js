// Sadie's Sixpack — /sixpack
//
// 6 free-download lore valve caps lifted from the Gumball Assets handoff.
// No auth, no Stripe; the STLs are static assets at /valve-models/<slug>.stl.
// Each card lazy-mounts a real Three.js viewer (createValveStemViewer) when
// it scrolls into view; only N (default 2) viewers are kept alive at once.
//
// Cards intentionally show the lore poster PNG until the viewer boots, then
// fade the poster out and let the WebGL canvas take over.

import { el } from '../dom.js';
import { createValveStemViewer } from '../components/valve-stem-viewer.js';

const CARDS = [
  {
    n: '01',
    slug: 'professor',
    name: 'The Professor',
    sub: 'Bald · spectacles · mustache',
    lore: 'Builds software architectures the way a luthier builds guitars — slowly, with feeling. Three monitors, infinite tabs, all of them a chainline.',
    chip: 'FDM · 0.12mm',
    color: 'purple',
  },
  {
    n: '02',
    slug: 'captain',
    name: 'The Captain',
    sub: 'Beard · flat brim · long stare',
    lore: 'Founded the shop with a wrench, a coffee can of bolts, and a horizon-line stare. Every regular here is a regular because of him.',
    chip: 'FDM · 0.12mm',
    color: 'green',
  },
  {
    n: '03',
    slug: 'big-mick',
    name: 'Big Mick',
    sub: 'Stacked tires · sash · undefeated',
    lore: 'Local Schrader-class champion. Wears the sash on race day. Tells you you’re running too low PSI and is always right.',
    chip: 'FDM · supports off',
    color: 'magenta',
  },
  {
    n: '04',
    slug: 'the-wooly',
    name: 'Little Space Bear',
    sub: 'Hairy · wide-eyed · cryptid',
    lore: 'Lives behind the rear-wheel rack. Eats stripped bolts. Comes out when the shop is empty and rearranges the allen keys by feel.',
    chip: 'FDM · 0.16mm fuzzy',
    color: 'purple',
  },
  {
    n: '05',
    slug: 'old-reliable',
    name: 'Old Reliable',
    sub: 'Ribbed · mushroom flange · shop-grade',
    lore: 'The grip you bought in 2009 and never replaced. Outlasts the bike, the trends, the owner. Built to be ridden, not photographed.',
    chip: 'FDM · TPU optional',
    color: 'green',
  },
  {
    n: '06',
    slug: 'the-cobra',
    name: 'Sasquatch Foot',
    sub: 'Diamond skin · bent neck · OG',
    lore: 'The first cap Sadie’s ever made for a customer’s stem. Diamond-pattern, gooseneck bend, looks like it might bite the rim. The reason this whole project exists.',
    chip: 'FDM · 0.12mm',
    color: 'magenta',
  },
];

const MAX_LIVE_VIEWERS = 2;

export function SixpackPage({ socket: _socket }) {
  const viewerLru = []; // { slug, hero, viewer, controller, abort }

  const grid = el('div', { class: 'sixpack-grid' });
  const cardEls = CARDS.map((card) => {
    const corner = el('div', { class: 'sixcard__corner' }, '№ ' + card.n);
    const poster = el('img', {
      class: 'sixcard__poster',
      src: '/valve-models/thumbs/' + card.slug + '.png',
      alt: card.name + ' — Sadie’s Sixpack lore poster',
      loading: 'lazy',
      decoding: 'async',
    });
    const viewerHost = el('div', { class: 'sixcard__viewer', 'aria-hidden': 'true' });
    const hero = el('div', {
      class: 'sixcard__hero',
      'data-viewer-active': 'false',
      'data-stl-url': '/valve-models/' + card.slug + '.stl',
      'data-slug': card.slug,
    }, poster, viewerHost);

    const downloadBtn = el('a', {
      class: 'sixcard__btn',
      href: '/valve-models/' + card.slug + '.stl',
      download: 'sadie-sixpack-' + card.slug + '.stl',
      rel: 'noopener',
    }, '↓ STL');

    const article = el('article', { class: 'sixcard', 'data-color': card.color },
      corner,
      hero,
      el('div', { class: 'sixcard__name' }, card.name),
      el('div', { class: 'sixcard__sub' }, card.sub),
      el('p', { class: 'sixcard__lore' }, card.lore),
      el('div', { class: 'sixcard__foot' },
        el('span', { class: 'sixcard__chip' }, card.chip),
        downloadBtn,
      ),
    );
    grid.appendChild(article);
    return { card, hero, viewerHost, article };
  });

  // ── Viewer lifecycle ──────────────────────────────────────────────
  function evictOldestIfNeeded() {
    while (viewerLru.length > MAX_LIVE_VIEWERS) {
      const oldest = viewerLru.shift();
      try { oldest.abort?.abort(); } catch { /* ignore */ }
      try { oldest.viewer?.destroy?.(); } catch { /* ignore */ }
      if (oldest.hero) {
        oldest.hero.setAttribute('data-viewer-active', 'false');
        // Clear the old canvas so the next mount starts clean.
        const host = oldest.hero.querySelector('.sixcard__viewer');
        if (host) while (host.firstChild) host.removeChild(host.firstChild);
      }
    }
  }

  async function bootViewer(entry) {
    if (entry.booted) return;
    entry.booted = true;
    const { hero, viewerHost, card } = entry;
    const url = '/valve-models/' + card.slug + '.stl';
    const ctl = new AbortController();
    let viewer = null;
    let record = null;
    try {
      const res = await fetch(url, { signal: ctl.signal });
      if (!res.ok) throw new Error('http_' + res.status);
      const buf = await res.arrayBuffer();
      if (ctl.signal.aborted) return;
      viewer = createValveStemViewer({
        container: viewerHost,
        initial: { stlData: buf, materialType: 'chrome' },
      });
      hero.setAttribute('data-viewer-active', 'true');
      record = { slug: card.slug, hero, viewer, abort: ctl };
      viewerLru.push(record);
      evictOldestIfNeeded();
    } catch (err) {
      if (err.name === 'AbortError') return;
      // Leave the poster up and reset so a future scroll-in can retry.
      entry.booted = false;
      console.warn('sixpack: viewer boot failed', card.slug, err);
    }
  }

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const slug = e.target.getAttribute('data-slug');
      const hit = cardEls.find((c) => c.card.slug === slug);
      if (hit) bootViewer(hit);
      io.unobserve(e.target);
    }
  }, { rootMargin: '200px 0px', threshold: 0.05 });

  cardEls.forEach((c) => io.observe(c.hero));

  // ── Page chrome ───────────────────────────────────────────────────
  const head = el('div', { class: 'sixpack-head' },
    el('div', null,
      el('span', { class: 'sixpack-eyebrow' }, 'SADIE’S SIXPACK · DROP 002 · FREE STLs'),
      el('h1', { class: 'sixpack-title' }, 'SADIE’S SIXPACK.'),
      el('p', { class: 'sixpack-lede' },
        'Six valve caps printed from Sadie’s Bikes lore — every regular, every rumor, every bolt-eating creature in the back. Pop a quarter in the gumball machine: you get one of these. Want the other five? Or your own face on a cap? Hit ',
        el('strong', null, 'StemDome'),
        el('span', {
          style: {
            color: 'var(--sdzr-brand)',
            fontStyle: 'italic',
            fontWeight: '900',
            textShadow: '2px 2px 0 var(--accent2)',
          },
        }, 'Z'),
        ' below and roll your own.',
      ),
      el('div', { class: 'sixpack-quicklinks' },
        el('a', { href: '/stemdome-generator', 'data-link': '' }, '→ Open the generator'),
        el('span', null, '·'),
        el('a', { href: '/account', 'data-link': '' }, '→ Your account'),
      ),
    ),
    el('span', { class: 'sdzr-sticker sdzr-sticker--magenta', 'data-rot': '-7', style: { whiteSpace: 'nowrap' } }, 'FREE · NO CHECKOUT'),
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
      el('div', { class: 'sixpack-eyebrow', style: { color: 'var(--sdzr-accent2)' } }, 'DROP 003 · YOUR FACE'),
      el('h2', { class: 'sixpack-cta__head' }, 'Now make ', el('em', null, 'yours'), '.'),
      el('p', { class: 'sixpack-cta__lede' },
        'The Sixpack is the lore. ',
        el('strong', null, 'StemDomeZ'),
        ' is the press. Drop a portrait. The pipeline does the rest. Free during launch — use code ',
        el('code', null, 'SADYSBIKES'),
        ' after.',
      ),
      el('a', { class: 'sixpack-cta__btn', href: '/stemdome-generator', 'data-link': '' }, 'MINT YOUR OWN ↗'),
    ),
    el('div', { class: 'sixpack-cta__art', 'aria-hidden': 'true' }, orbit),
  );

  const wrap = el('div', { class: 'sixpack-wrap' }, head, grid, cta);
  const root = el('section', { class: 'sixpack-page sdzr-bg-paper-soft' }, wrap);

  return {
    el: root,
    destroy() {
      try { io.disconnect(); } catch { /* ignore */ }
      while (viewerLru.length) {
        const r = viewerLru.shift();
        try { r.abort?.abort(); } catch { /* ignore */ }
        try { r.viewer?.destroy?.(); } catch { /* ignore */ }
      }
    },
  };
}
