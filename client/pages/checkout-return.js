import { el, clear } from '../dom.js';
import { icon } from '../icons.js';

export function CheckoutReturnPage({ socket, sessionId }) {
  const root = el('div.max-w-2xl.mx-auto.px-4.py-14.text-center');
  const card = el('div', {
    class: 'rounded-2xl p-8 border',
    style: { background: '#111120', borderColor: '#1e1e35' },
  });
  root.appendChild(card);

  function render(status) {
    clear(card);
    if (status.state === 'verifying') {
      card.append(
        el('div', {
          class: 'w-14 h-14 rounded-2xl mx-auto flex items-center justify-center',
          style: { background: 'rgba(180,255,69,0.1)', border: '1px solid rgba(180,255,69,0.3)' },
        }, el('span.spinner', { style: { width: '22px', height: '22px', borderColor: 'rgba(180,255,69,0.3)', borderTopColor: '#b4ff45' } })),
        el('h1.text-white.mt-5', { style: { fontWeight: 700, fontSize: '1.3rem' } }, 'Verifying your payment…'),
        el('p.mt-2', { style: { color: '#808098', fontSize: '0.9rem' } }, 'One moment — Stripe is confirming the charge.'),
      );
    } else if (status.state === 'paid') {
      card.append(
        el('div', {
          class: 'w-14 h-14 rounded-2xl mx-auto flex items-center justify-center',
          style: { background: 'rgba(180,255,69,0.12)', border: '1px solid rgba(180,255,69,0.35)' },
        }, icon('download', { size: 24, color: '#b4ff45' })),
        el('h1.text-white.mt-5', { style: { fontWeight: 800, fontSize: '1.4rem' } }, 'Payment received!'),
        el('p.mt-2', { style: { color: '#b0b0c8', fontSize: '0.95rem' } }, `Your ${formatMoney(status.amount, status.currency)} purchase is complete.`),
        status.customerEmail
          ? el('p.mt-1', { style: { color: '#606080', fontSize: '0.8rem' } }, `Receipt: ${status.customerEmail}`)
          : null,
        el('button', {
          class: 'mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl transition-all',
          style: { background: 'linear-gradient(135deg, #b4ff45, #7fc718)', color: '#000', fontWeight: 800, fontSize: '0.95rem' },
          onClick: () => triggerDownload(status.design),
        },
          icon('download', { size: 16, color: '#000' }),
          'Download STL',
        ),
        el('div.mt-4',
          el('a', {
            href: '/',
            'data-link': '',
            style: { color: '#9090b0', fontSize: '0.82rem' },
          }, 'Back to designer →'),
        ),
      );
    } else if (status.state === 'pending') {
      card.append(
        el('h1.text-white', { style: { fontWeight: 700, fontSize: '1.25rem' } }, 'Still processing…'),
        el('p.mt-2', { style: { color: '#808098', fontSize: '0.9rem' } }, 'Your payment is being finalized. This page will retry automatically.'),
      );
    } else {
      card.append(
        el('div', {
          class: 'w-14 h-14 rounded-2xl mx-auto flex items-center justify-center',
          style: { background: 'rgba(255,107,48,0.12)', border: '1px solid rgba(255,107,48,0.35)' },
        }, icon('x', { size: 24, color: '#ff6b30' })),
        el('h1.text-white.mt-5', { style: { fontWeight: 700, fontSize: '1.25rem' } }, 'Something went wrong'),
        el('p.mt-2', { style: { color: '#b0b0c8', fontSize: '0.9rem' } }, status.error || 'We could not verify the payment. You have not been charged if this was in error.'),
        el('a', {
          href: '/pricing',
          'data-link': '',
          class: 'inline-block mt-6 px-5 py-2.5 rounded-xl transition-all',
          style: { background: '#1e1e35', color: '#e0e0f0', fontSize: '0.85rem', fontWeight: 600 },
        }, 'Back to pricing'),
      );
    }
  }

  function triggerDownload(design) {
    if (!design || !design.stl) return;
    const blob = new Blob([design.stl], { type: 'model/stl' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = design.filename || 'BikeHeadz_ValveStem.stl';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  let retryHandle = null;

  async function verify() {
    if (!sessionId) {
      render({ state: 'error', error: 'Missing session id.' });
      return;
    }
    try {
      const res = await socket.request('payments.verifySession', { sessionId });
      if (res.paid) {
        render({ state: 'paid', ...res });
        sessionStorage.removeItem('bikeheadz.designId');
      } else {
        render({ state: 'pending' });
        retryHandle = setTimeout(verify, 2500);
      }
    } catch (err) {
      render({ state: 'error', error: err.message });
    }
  }

  render({ state: 'verifying' });
  verify();

  return {
    el: root,
    destroy() { if (retryHandle) clearTimeout(retryHandle); },
  };
}

function formatMoney(cents, currency) {
  const amount = (Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}
