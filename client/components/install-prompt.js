// P7-006 — "Add to Home Screen" install prompt.
//
//   setupInstallPrompt({ socket })
//
// Captures the `beforeinstallprompt` event, exposes a global trigger so the
// home page can pop the banner on the user's *second* successful generation,
// and remembers a permanent dismiss in localStorage so we don't pester. The
// banner sits at the bottom of the viewport with workshop-palette buttons.
//
// The `socket` arg is accepted for forward-compat (we may want to log
// install rates back to the server) but is currently unused.

import { el } from '../dom.js';

const DISMISS_KEY = 'bh_install_dismissed';

export function setupInstallPrompt({ socket } = {}) {
  void socket; // reserved for future analytics

  let deferredPrompt = null;
  let banner = null;
  let bannerVisible = false;

  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideBanner();
  });

  // Global hook the home page calls after the *second* successful generation.
  window.__bhTriggerInstall = () => {
    if (isDismissed()) return false;
    if (!deferredPrompt) return false;
    showBanner();
    return true;
  };

  function isDismissed() {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  }

  function setDismissed() {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  }

  function showBanner() {
    if (bannerVisible) return;
    bannerVisible = true;

    const installBtn = el('button', {
      type: 'button',
      class: 'px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
      style: {
        background: '#C71F1F',
        color: '#FFFFFF',
        border: '1px solid #C71F1F',
      },
      onClick: async () => {
        if (!deferredPrompt) { hideBanner(); return; }
        try {
          deferredPrompt.prompt();
          await deferredPrompt.userChoice;
        } catch { /* ignore */ }
        deferredPrompt = null;
        hideBanner();
      },
    }, 'Install');

    const dismissBtn = el('button', {
      type: 'button',
      class: 'px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
      style: {
        background: 'transparent',
        color: '#1A1614',
        border: '1px solid #E5DFD3',
      },
      onClick: () => {
        setDismissed();
        hideBanner();
      },
    }, 'No thanks');

    banner = el('div', {
      role: 'dialog',
      'aria-label': 'Install BikeHeadz',
      class: 'fixed left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl',
      style: {
        bottom: '16px',
        background: '#FAF7F2',
        border: '1px solid #E5DFD3',
        zIndex: 1000,
        maxWidth: 'calc(100vw - 32px)',
      },
    },
      el('div.flex.flex-col', { style: { lineHeight: '1.2' } },
        el('span', { style: { fontWeight: 700, color: '#1A1614', fontSize: '0.95rem' } }, 'Install BikeHeadz'),
        el('span', { style: { color: '#6B6157', fontSize: '0.8rem' } }, 'Add to your home screen for fast access.'),
      ),
      el('div.flex.items-center.gap-2', {}, dismissBtn, installBtn),
    );

    document.body.appendChild(banner);
  }

  function hideBanner() {
    if (banner) {
      banner.remove();
      banner = null;
    }
    bannerVisible = false;
  }
}
