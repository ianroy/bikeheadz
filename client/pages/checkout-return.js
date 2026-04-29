import { el, clear } from '../dom.js';
import { icon } from '../icons.js';

export function CheckoutReturnPage({ socket, sessionId }) {
  const root = el('div.max-w-2xl.mx-auto.px-4.py-14.text-center');
  const card = el('div', {
    class: 'rounded-2xl p-8 border',
    style: { background: '#FFFFFF', borderColor: '#E5DFD3' },
  });
  root.appendChild(card);

  function render(status) {
    clear(card);
    if (status.state === 'verifying') {
      card.append(
        el('div', {
          class: 'w-14 h-14 rounded-2xl mx-auto flex items-center justify-center',
          style: { background: 'rgba(199,31,31,0.1)', border: '1px solid rgba(199,31,31,0.3)' },
        }, el('span.spinner', { style: { width: '22px', height: '22px', borderColor: 'rgba(199,31,31,0.3)', borderTopColor: '#C71F1F' } })),
        el('h1.mt-5', { style: { fontWeight: 700, fontSize: '1.3rem' } }, 'Verifying your payment…'),
        el('p.mt-2', { style: { color: '#6B6157', fontSize: '0.9rem' } }, 'One moment — Stripe is confirming the charge.'),
      );
    } else if (status.state === 'requires_action') {
      // P2-019 — 3DS / SCA challenge in flight. Friendly copy + auto
      // re-poll. The CTA only appears when the polling budget runs out.
      card.append(
        el('div', {
          class: 'w-14 h-14 rounded-2xl mx-auto flex items-center justify-center',
          style: { background: 'rgba(199,31,31,0.1)', border: '1px solid rgba(199,31,31,0.3)' },
        }, el('span.spinner', { style: { width: '22px', height: '22px', borderColor: 'rgba(199,31,31,0.3)', borderTopColor: '#C71F1F' } })),
        el('h1.mt-5', { style: { fontWeight: 700, fontSize: '1.3rem' } }, 'Confirming with your bank…'),
        el('p.mt-2', { style: { color: '#6B6157', fontSize: '0.9rem' } },
          'Your bank is asking for an extra check. We’ll keep an eye on it — this usually takes a few seconds.'),
      );
    } else if (status.state === 'requires_action_timeout') {
      card.append(
        el('div', {
          class: 'w-14 h-14 rounded-2xl mx-auto flex items-center justify-center',
          style: { background: 'rgba(194,65,12,0.12)', border: '1px solid rgba(194,65,12,0.35)' },
        }, icon('x', { size: 24, color: '#C2410C' })),
        el('h1.mt-5', { style: { fontWeight: 700, fontSize: '1.25rem' } }, 'We couldn’t confirm — try again?'),
        el('p.mt-2', { style: { color: '#3D3A36', fontSize: '0.9rem' } },
          'Your bank didn’t finish the security check. You haven’t been charged.'),
        el('button', {
          class: 'mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl transition-all',
          style: { background: 'linear-gradient(135deg, #C71F1F, #B91C1C)', color: '#FFFFFF', fontWeight: 800, fontSize: '0.95rem' },
          onClick: () => { if (status.url) window.location.assign(status.url); },
        }, 'Try again'),
        el('div.mt-4',
          el('a', {
            href: '/pricing',
            'data-link': '',
            style: { color: '#6B6157', fontSize: '0.82rem' },
          }, 'Back to pricing'),
        ),
      );
    } else if (status.state === 'paid') {
      card.append(
        el('div', {
          class: 'w-14 h-14 rounded-2xl mx-auto flex items-center justify-center',
          style: { background: 'rgba(199,31,31,0.12)', border: '1px solid rgba(199,31,31,0.35)' },
        }, icon('download', { size: 24, color: '#C71F1F' })),
        el('h1.mt-5', { style: { fontWeight: 800, fontSize: '1.4rem' } }, 'Payment received!'),
        el('p.mt-2', { style: { color: '#3D3A36', fontSize: '0.95rem' } }, `Your ${formatMoney(status.amount, status.currency)} purchase is complete.`),
        status.customerEmail
          ? el('p.mt-1', { style: { color: '#6B6157', fontSize: '0.8rem' } }, `Receipt: ${status.customerEmail}`)
          : null,
        el('button', {
          class: 'mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl transition-all',
          style: { background: 'linear-gradient(135deg, #C71F1F, #B91C1C)', color: '#FFFFFF', fontWeight: 800, fontSize: '0.95rem' },
          onClick: () => triggerDownload(status.design),
        },
          icon('download', { size: 16, color: '#FFFFFF' }),
          'Download STL',
        ),
        el('div.mt-4',
          el('a', {
            href: '/',
            'data-link': '',
            style: { color: '#6B6157', fontSize: '0.82rem' },
          }, 'Back to designer →'),
        ),
      );
    } else if (status.state === 'pending') {
      card.append(
        el('h1', { style: { fontWeight: 700, fontSize: '1.25rem' } }, 'Still processing…'),
        el('p.mt-2', { style: { color: '#6B6157', fontSize: '0.9rem' } }, 'Your payment is being finalized. This page will retry automatically.'),
      );
    } else {
      card.append(
        el('div', {
          class: 'w-14 h-14 rounded-2xl mx-auto flex items-center justify-center',
          style: { background: 'rgba(194,65,12,0.12)', border: '1px solid rgba(194,65,12,0.35)' },
        }, icon('x', { size: 24, color: '#C2410C' })),
        el('h1.mt-5', { style: { fontWeight: 700, fontSize: '1.25rem' } }, 'Something went wrong'),
        el('p.mt-2', { style: { color: '#3D3A36', fontSize: '0.9rem' } }, status.error || 'We could not verify the payment. You have not been charged if this was in error.'),
        el('a', {
          href: '/pricing',
          'data-link': '',
          class: 'inline-block mt-6 px-5 py-2.5 rounded-xl transition-all',
          style: { background: '#E5DFD3', color: '#1A1614', fontSize: '0.85rem', fontWeight: 600 },
        }, 'Back to pricing'),
      );
    }
  }

  function triggerDownload(design) {
    if (!design) return;
    // The server now ships STL bytes as base64 (`stl_b64`) so binary STL
    // from the new mesh pipeline survives the JSON round-trip. We
    // continue to accept the legacy `stl` (utf8 ASCII string) field for
    // designs generated before the cutover so users with old session
    // storage don't see broken downloads.
    let bytes;
    if (typeof design.stl_b64 === 'string') {
      const bin = atob(design.stl_b64);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } else if (typeof design.stl === 'string') {
      bytes = new TextEncoder().encode(design.stl);
    } else {
      return;
    }
    const blob = new Blob([bytes], { type: 'model/stl' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = design.filename || 'BikeHeadz_ValveStem.stl';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  let retryHandle = null;
  // P2-019 — 3DS polling budget. We re-poll every 4s for up to 60s
  // before showing the friendly retry CTA. Tracked separately from the
  // generic `pending` retry so a flaky 3DS flow doesn't loop forever.
  const REQUIRES_ACTION_BUDGET_MS = 60_000;
  const REQUIRES_ACTION_INTERVAL_MS = 4_000;
  let requiresActionStartedAt = null;
  let lastCheckoutUrl = null;

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
      } else if (res.requiresAction) {
        if (res.url) lastCheckoutUrl = res.url;
        if (!requiresActionStartedAt) requiresActionStartedAt = Date.now();
        const elapsed = Date.now() - requiresActionStartedAt;
        if (elapsed >= REQUIRES_ACTION_BUDGET_MS) {
          render({ state: 'requires_action_timeout', url: lastCheckoutUrl });
        } else {
          render({ state: 'requires_action' });
          retryHandle = setTimeout(verify, REQUIRES_ACTION_INTERVAL_MS);
        }
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
