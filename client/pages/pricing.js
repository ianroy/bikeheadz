import { el, clear } from '../dom.js';
import { icon } from '../icons.js';

const COPY = {
  stl_download: {
    highlight: 'Most popular',
    bullets: [
      'AI-scanned head merged onto a real valve cap',
      'Manifold STL ready for FDM or resin',
      'Instant download after payment',
    ],
    color: '#b4ff45',
    cta: 'Download for $2',
  },
  printed_stem: {
    bullets: [
      'Chrome, matte, or gloss finish',
      'Ships in 3–5 business days',
      'Printed on calibrated FDM + post-processed',
    ],
    color: '#4d9fff',
    cta: 'Print & ship',
  },
  pack_of_4: {
    bullets: [
      'Four printed stems — mix materials',
      'Great for group rides',
      'Free shipping included',
    ],
    color: '#ff6b30',
    cta: 'Buy the pack',
  },
};

export function PricingPage({ socket, designId: initialDesignId = null, cancelled = false } = {}) {
  const root = el('div.max-w-5xl.mx-auto.px-4.py-10');
  const state = {
    designId: initialDesignId || sessionStorage.getItem('bikeheadz.designId'),
    items: [],
    enabled: false,
    busy: null,
    error: null,
  };

  root.appendChild(
    el('div.text-center', { class: 'mb-10' },
      el('h1.text-white.mb-3', {
        style: { fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.04em' },
      },
        'Pricing for your ',
        el('span', { style: { color: '#b4ff45' } }, 'valve stem'),
      ),
      el('p.max-w-2xl.mx-auto', {
        style: { color: '#808098', fontSize: '1rem' },
      },
        'Pay once, keep the STL. No subscription. Printed stems ship worldwide.',
      ),
    ),
  );

  const banner = el('div');
  root.appendChild(banner);

  const grid = el('div', {
    class: 'grid grid-cols-1 md:grid-cols-3 gap-4',
  });
  root.appendChild(grid);

  const footer = el('div', { class: 'mt-8 text-center', style: { color: '#606080', fontSize: '0.78rem' } },
    'Payments are processed by Stripe. We never see your card details.',
  );
  root.appendChild(footer);

  function renderBanner() {
    clear(banner);
    if (cancelled) {
      banner.appendChild(el('div', {
        class: 'mb-6 rounded-xl px-4 py-3 border',
        style: { background: 'rgba(255,107,48,0.08)', borderColor: 'rgba(255,107,48,0.25)', color: '#ffc2a7', fontSize: '0.85rem' },
      }, 'Checkout was cancelled. Your design is still here — try again whenever you\u2019re ready.'));
    }
    if (state.error) {
      banner.appendChild(el('div', {
        class: 'mb-6 rounded-xl px-4 py-3 border',
        style: { background: 'rgba(255,48,48,0.08)', borderColor: 'rgba(255,48,48,0.25)', color: '#ffb2b2', fontSize: '0.85rem' },
      }, state.error));
    }
    if (!state.enabled) {
      banner.appendChild(el('div', {
        class: 'mb-6 rounded-xl px-4 py-3 border',
        style: { background: 'rgba(255,214,0,0.05)', borderColor: 'rgba(255,214,0,0.2)', color: '#e6cc6a', fontSize: '0.85rem' },
      }, 'Stripe is not configured in this environment (STRIPE_SECRET_KEY missing). Checkout is disabled.'));
    }
    if (!state.designId) {
      banner.appendChild(el('div', {
        class: 'mb-6 rounded-xl px-4 py-3 border flex items-center justify-between gap-3 flex-wrap',
        style: { background: '#111120', borderColor: '#1e1e35' },
      },
        el('span', { style: { color: '#b0b0c8', fontSize: '0.85rem' } },
          'You need to generate a design before you can download it.',
        ),
        el('a', {
          href: '/',
          'data-link': '',
          class: 'px-4 py-2 rounded-xl transition-all',
          style: { background: '#b4ff45', color: '#000', fontWeight: 700, fontSize: '0.8rem' },
        }, 'Start generating'),
      ));
    }
  }

  function renderGrid() {
    clear(grid);
    if (!state.items.length) {
      grid.appendChild(el('div', {
        style: { color: '#606080', padding: '2rem', textAlign: 'center', gridColumn: '1 / -1' },
      }, 'Loading pricing…'));
      return;
    }
    for (const item of state.items) {
      const meta = COPY[item.productId] || { bullets: [], color: '#808098', cta: 'Buy' };
      const isStl = item.productId === 'stl_download';
      const disabled = !state.enabled || state.busy || (isStl && !state.designId);

      grid.appendChild(el('div', {
        class: 'rounded-2xl p-6 border flex flex-col gap-4 relative overflow-hidden',
        style: {
          background: '#111120',
          borderColor: meta.highlight ? 'rgba(180,255,69,0.35)' : '#1e1e35',
        },
      },
        meta.highlight
          ? el('span', {
              class: 'absolute px-2 py-0.5 rounded-full',
              style: {
                top: '12px', right: '12px',
                background: 'rgba(180,255,69,0.12)',
                color: '#b4ff45',
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              },
            }, meta.highlight)
          : null,
        el('div',
          el('h3.text-white', { style: { fontWeight: 700, fontSize: '1.1rem' } }, item.name),
          el('p.mt-1', { style: { color: '#808098', fontSize: '0.82rem', lineHeight: 1.5 } }, item.description),
        ),
        el('div.flex.items-baseline.gap-1',
          el('span', {
            style: { color: '#b4ff45', fontWeight: 800, fontSize: '2rem' },
          }, formatMoney(item.unitAmount, item.currency)),
          el('span', { style: { color: '#606080', fontSize: '0.75rem' } }, 'one-time'),
        ),
        el('ul.flex.flex-col.gap-2',
          ...meta.bullets.map((b) =>
            el('li.flex.items-start.gap-2',
              el('span', {
                class: 'inline-block rounded-full',
                style: { width: '6px', height: '6px', background: meta.color, marginTop: '8px' },
              }),
              el('span', { style: { color: '#b0b0c8', fontSize: '0.82rem', lineHeight: 1.5 } }, b),
            )
          ),
        ),
        el('button', {
          class: 'mt-auto w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all',
          style: {
            background: disabled ? '#252545' : isStl ? 'linear-gradient(135deg, #b4ff45, #7fc718)' : meta.color,
            color: disabled ? '#808098' : isStl ? '#000' : '#fff',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.7 : 1,
          },
          disabled,
          onClick: () => startCheckout(item.productId),
        },
          icon('creditCard', { size: 16, color: disabled ? '#808098' : isStl ? '#000' : '#fff' }),
          state.busy === item.productId ? 'Redirecting…' : meta.cta,
        ),
      ));
    }
  }

  async function startCheckout(productId) {
    if (state.busy || !state.enabled) return;
    if (productId === 'stl_download' && !state.designId) return;
    state.busy = productId;
    state.error = null;
    renderGrid();

    try {
      const { url } = await socket.request('payments.createCheckoutSession', {
        product: productId,
        designId: productId === 'stl_download' ? state.designId : null,
      });
      if (!url) throw new Error('no_checkout_url');
      window.location.assign(url);
    } catch (err) {
      state.busy = null;
      state.error = err.message || 'Unable to start checkout.';
      renderBanner();
      renderGrid();
    }
  }

  async function load() {
    try {
      const res = await socket.request('payments.catalogue');
      state.items = res.items || [];
      state.enabled = !!res.enabled;
    } catch (err) {
      state.error = err.message || 'Failed to load pricing.';
    }
    renderBanner();
    renderGrid();
  }

  renderBanner();
  renderGrid();
  load();

  return { el: root };
}

function formatMoney(cents, currency) {
  const amount = (Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}
