// P7-005 — Native Web Share API button.
//
// Uses navigator.share when available (mobile + Safari + recent Chrome),
// otherwise falls back to clipboard + a transient toast. The button keeps
// the workshop palette: cream surface, ink text, red accent on hover.
//
//   const { el } = ShareButton({ url, title, text });

import { el } from '../dom.js';

export function ShareButton({ url, title, text } = {}) {
  const shareUrl = url || (typeof location !== 'undefined' ? location.href : '');
  const shareTitle = title || 'ValveHeadZ';
  const shareText = text || 'Check out my custom valve cap from ValveHeadZ.';

  let toast = null;
  let toastTimer = 0;

  const button = el('button', {
    type: 'button',
    class:
      'inline-flex items-center gap-2 px-4 py-2 rounded-lg border '
      + 'transition-colors duration-150 cursor-pointer text-sm font-semibold',
    style: {
      background: '#FAF7F2',
      color: '#1A1614',
      borderColor: '#E5DFD3',
    },
    onMouseenter: () => {
      button.style.background = '#FFFFFF';
      button.style.borderColor = '#C71F1F';
      button.style.color = '#C71F1F';
    },
    onMouseleave: () => {
      button.style.background = '#FAF7F2';
      button.style.borderColor = '#E5DFD3';
      button.style.color = '#1A1614';
    },
    onClick: handleClick,
  },
    iconShare(),
    el('span', {}, 'Share'),
  );

  const root = el('div.relative.inline-block', {}, button);

  async function handleClick() {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        return;
      } catch (err) {
        // User cancellation (AbortError) is silent; fall through on real errors.
        if (err && err.name === 'AbortError') return;
      }
    }
    // Fallback — clipboard.
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        showToast('Link copied');
      } else {
        showToast('Copy not supported');
      }
    } catch {
      showToast('Copy failed');
    }
  }

  function showToast(message) {
    if (toast) {
      toast.remove();
      toast = null;
      clearTimeout(toastTimer);
    }
    toast = el('div', {
      class: 'absolute left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 rounded-md text-xs font-medium shadow-lg whitespace-nowrap',
      style: {
        top: '100%',
        background: '#1A1614',
        color: '#FAF7F2',
        zIndex: 50,
      },
    }, message);
    root.appendChild(toast);
    toastTimer = setTimeout(() => {
      toast?.remove();
      toast = null;
    }, 2000);
  }

  return { el: root };
}

function iconShare() {
  // Inline SVG keeps the component self-contained (no icons.js dep needed).
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.innerHTML = '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>';
  return svg;
}
