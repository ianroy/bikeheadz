import { el, clear } from '../dom.js';
import { icon } from '../icons.js';

const COPY = {
  highlight: 'Most popular',
  bullets: [
    'AI-scanned head merged onto a real valve cap',
    'Manifold STL ready for FDM or resin',
    'Instant download after payment',
  ],
  color: '#C71F1F',
  cta: 'Download for $2',
};

export function PricingPage({ socket, designId: initialDesignId = null, cancelled = false } = {}) {
  const root = el('div.max-w-xl.mx-auto.px-4.py-10');
  const state = {
    designId: initialDesignId || sessionStorage.getItem('valveheadz.designId'),
    item: null,
    enabled: false,
    busy: false,
    error: null,
  };

  root.appendChild(
    el('div.text-center', { class: 'mb-10' },
      el('h1.mb-3', {
        style: { fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.04em' },
      },
        'Download your ',
        el('span', { style: { color: '#C71F1F' } }, 'valve stem'),
      ),
      el('p.max-w-2xl.mx-auto', {
        style: { color: '#6B6157', fontSize: '1rem' },
      },
        'Pay once, keep the STL. No subscription.',
      ),
    ),
  );

  const banner = el('div');
  root.appendChild(banner);

  const card = el('div');
  root.appendChild(card);

  const footer = el('div', { class: 'mt-8 text-center', style: { color: '#6B6157', fontSize: '0.78rem' } },
    'Payments are processed by Stripe. We never see your card details.',
  );
  root.appendChild(footer);

  function renderBanner() {
    clear(banner);
    if (cancelled) {
      banner.appendChild(el('div', {
        class: 'mb-6 rounded-xl px-4 py-3 border',
        style: { background: 'rgba(194,65,12,0.08)', borderColor: 'rgba(194,65,12,0.25)', color: '#7C2D12', fontSize: '0.85rem' },
      }, 'Checkout was cancelled. Your design is still here — try again whenever you\u2019re ready.'));
    }
    if (state.error) {
      banner.appendChild(el('div', {
        class: 'mb-6 rounded-xl px-4 py-3 border',
        style: { background: 'rgba(185,28,28,0.08)', borderColor: 'rgba(185,28,28,0.25)', color: '#7F1D1D', fontSize: '0.85rem' },
      }, state.error));
    }
    if (!state.enabled) {
      banner.appendChild(el('div', {
        class: 'mb-6 rounded-xl px-4 py-3 border',
        style: { background: 'rgba(255,214,0,0.05)', borderColor: 'rgba(255,214,0,0.2)', color: '#7C5E1F', fontSize: '0.85rem' },
      }, 'Stripe is not configured in this environment (STRIPE_SECRET_KEY missing). Checkout is disabled.'));
    }
    if (!state.designId) {
      banner.appendChild(el('div', {
        class: 'mb-6 rounded-xl px-4 py-3 border flex items-center justify-between gap-3 flex-wrap',
        style: { background: '#FFFFFF', borderColor: '#E5DFD3' },
      },
        el('span', { style: { color: '#3D3A36', fontSize: '0.85rem' } },
          'You need to generate a design before you can download it.',
        ),
        el('a', {
          href: '/',
          'data-link': '',
          class: 'px-4 py-2 rounded-xl transition-all',
          style: { background: '#C71F1F', color: '#FFFFFF', fontWeight: 700, fontSize: '0.8rem' },
        }, 'Start generating'),
      ));
    }
  }

  function renderCard() {
    clear(card);
    if (!state.item) {
      card.appendChild(el('div', {
        style: { color: '#6B6157', padding: '2rem', textAlign: 'center' },
      }, 'Loading pricing…'));
      return;
    }

    const item = state.item;
    const disabled = !state.enabled || state.busy || !state.designId;

    card.appendChild(el('div', {
      class: 'rounded-2xl p-6 border flex flex-col gap-4 relative overflow-hidden',
      style: { background: '#FFFFFF', borderColor: 'rgba(199,31,31,0.35)' },
    },
      el('span', {
        class: 'absolute px-2 py-0.5 rounded-full',
        style: {
          top: '12px', right: '12px',
          background: 'rgba(199,31,31,0.12)',
          color: '#C71F1F',
          fontSize: '0.65rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        },
      }, COPY.highlight),
      el('div',
        el('h3', { style: { fontWeight: 700, fontSize: '1.1rem' } }, item.name),
        el('p.mt-1', { style: { color: '#6B6157', fontSize: '0.82rem', lineHeight: 1.5 } }, item.description),
      ),
      el('div.flex.items-baseline.gap-1',
        el('span', {
          style: { color: '#C71F1F', fontWeight: 800, fontSize: '2rem' },
        }, formatMoney(item.unitAmount, item.currency)),
        el('span', { style: { color: '#6B6157', fontSize: '0.75rem' } }, 'one-time'),
      ),
      el('ul.flex.flex-col.gap-2',
        ...COPY.bullets.map((b) =>
          el('li.flex.items-start.gap-2',
            el('span', {
              class: 'inline-block rounded-full',
              style: { width: '6px', height: '6px', background: COPY.color, marginTop: '8px' },
            }),
            el('span', { style: { color: '#3D3A36', fontSize: '0.82rem', lineHeight: 1.5 } }, b),
          )
        ),
      ),
      el('button', {
        class: 'mt-auto w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all',
        style: {
          background: disabled ? '#E5DFD3' : 'linear-gradient(135deg, #C71F1F, #B91C1C)',
          color: disabled ? '#6B6157' : '#000',
          fontWeight: 700,
          fontSize: '0.9rem',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.7 : 1,
        },
        disabled,
        onClick: startCheckout,
      },
        icon('creditCard', { size: 16, color: disabled ? '#6B6157' : '#000' }),
        state.busy ? 'Redirecting…' : COPY.cta,
      ),
    ));
  }

  async function startCheckout() {
    if (state.busy || !state.enabled || !state.designId) return;
    state.busy = true;
    state.error = null;
    renderCard();

    try {
      const { url } = await socket.request('payments.createCheckoutSession', {
        designId: state.designId,
      });
      if (!url) throw new Error('no_checkout_url');
      window.location.assign(url);
    } catch (err) {
      state.busy = false;
      state.error = err.message || 'Unable to start checkout.';
      renderBanner();
      renderCard();
    }
  }

  async function load() {
    try {
      const res = await socket.request('payments.catalogue');
      state.item = res.item || null;
      state.enabled = !!res.enabled;
    } catch (err) {
      state.error = err.message || 'Failed to load pricing.';
    }
    renderBanner();
    renderCard();
  }

  renderBanner();
  renderCard();
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
