import './styles/index.css';
import { el } from './dom.js';
import { Router } from './router.js';
import { SocketClient } from './socket.js';
import { HeaderComponent } from './components/header.js';
import { HomePage } from './pages/home.js';
import { GeneratorPage } from './pages/generator.js';
import { AccountPage } from './pages/account.js';
import { PricingPage } from './pages/pricing.js';
import { CheckoutReturnPage } from './pages/checkout-return.js';
import { LoginPage } from './pages/login.js';
import { AdminPage } from './pages/admin.js';
import { GalleryPage, ShareDesignPage } from './pages/gallery.js';
import { HelpPage } from './pages/help.js';
import { mountTweaksPanel, applyPersistedTweaks } from './components/tweaks-panel.js';
import { createSiteFooter } from './components/site-footer.js';
import './sdz-radical.js';
import { StatusPage } from './pages/status.js';
import { ChangelogPage, IncidentsPage } from './pages/changelog.js';
import { PressPage } from './pages/press.js';
import {
  TermsPage,
  PrivacyPage,
  AcceptableUsePage,
  DmcaPage,
  CookiePolicyPage,
  RefundPolicyPage,
  PhotoPolicyPage,
  SecurityPage,
  NotFoundPage,
  ServerErrorPage,
} from './pages/legal.js';
import { setupInstallPrompt } from './components/install-prompt.js';
import { LocaleSwitcher } from './components/locale-switcher.js';
import { ContrastToggle } from './components/contrast-toggle.js';
import { getAppConfig, getCachedAppConfig, onAppConfigChange } from './util/app-config.js';

const root = document.getElementById('root');
Object.assign(root.style, {
  minHeight: '100vh',
  // Mongoose-BMX tokens — see client/styles/theme.css.
  background: 'var(--paper)',
  color: 'var(--ink)',
  display: 'flex',
  flexDirection: 'column',
});

// P6-006 — surface user motion preference as a CSS class on <html> so any
// stylesheet can branch on it without a media query when scripting matters
// (e.g. WebGL auto-rotate). The actual `prefers-reduced-motion` rules in
// styles/index.css zero animation durations on their own.
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
function applyReducedMotion() {
  document.documentElement.classList.toggle('reduced-motion', !!reducedMotion?.matches);
}
applyReducedMotion();
reducedMotion?.addEventListener?.('change', applyReducedMotion);

const socket = new SocketClient();

const header = HeaderComponent({ socket });
root.appendChild(header.el);

const main = el('main', { class: 'flex-1' });
root.appendChild(main);

// Global site footer — mounted once below the router's <main> so it
// shows on every page without each page re-rendering it. The host
// element survives route changes; only its contents get swapped when
// the runtime config (payments_enabled / printing_enabled) changes
// so the Pricing graffiti treatment stays in sync.
const footerHost = el('div');
root.appendChild(footerHost);
function renderSiteFooter() {
  while (footerHost.firstChild) footerHost.removeChild(footerHost.firstChild);
  const cfg = (typeof getCachedAppConfigSafe === 'function' ? getCachedAppConfigSafe() : { paymentsEnabled: true });
  footerHost.appendChild(createSiteFooter({ paymentsOff: !cfg.paymentsEnabled }));
}
function getCachedAppConfigSafe() {
  try { return getCachedAppConfig(); } catch { return { paymentsEnabled: true }; }
}
renderSiteFooter();

const router = new Router({
  mount: main,
  onRoute: (path) => header.setActive(path),
  routes: {
    // Marketing landing page — about, product spec, video demo, pricing
    // tease. The actual generator (photo upload → STL viewer → checkout)
    // lives at /stemdome-generator now.
    '/': () => HomePage({ socket }),
    '/stemdome-generator': ({ query }) => GeneratorPage({ socket, remix: query.remix }),
    // Legacy alias — earlier deploys had the generator at /. Redirect any
    // bookmarks/inbound links so they don't 404.
    '/generator': ({ query }) => GeneratorPage({ socket, remix: query.remix }),
    '/generate': ({ query }) => GeneratorPage({ socket, remix: query.remix }),
    '/account': () => AccountPage({ socket }),
    '/pricing': ({ query }) => PricingPage({ socket, cancelled: query.cancelled === '1' }),
    '/checkout/return': ({ query }) => CheckoutReturnPage({ socket, sessionId: query.session_id }),
    '/login': ({ query }) => LoginPage({ socket, query }),
    '/admin': () => AdminPage({ socket }),
    '/showcase': () => GalleryPage({ socket }),
    '/gallery': () => GalleryPage({ socket }),
    '/help': () => HelpPage({ socket }),
    '/status': () => StatusPage({ socket }),
    '/changelog': () => ChangelogPage({ socket }),
    '/incidents': () => IncidentsPage({ socket }),
    '/press': () => PressPage({ socket }),
    '/terms': () => ({ el: TermsPage() }),
    '/privacy': () => ({ el: PrivacyPage() }),
    '/acceptable-use': () => ({ el: AcceptableUsePage() }),
    '/dmca': () => ({ el: DmcaPage() }),
    '/cookies': () => ({ el: CookiePolicyPage() }),
    '/refunds': () => ({ el: RefundPolicyPage() }),
    '/photo-policy': () => ({ el: PhotoPolicyPage() }),
    '/security': () => ({ el: SecurityPage() }),
    '/500': () => ({ el: ServerErrorPage({ incidentId: null }) }),
    // X-011 — fallback. The legacy `'/'` fallback is now an explicit 404.
    '*': ({ matched }) => (matched ? null : { el: NotFoundPage() }),
    // P5-002 — share permalink. Routes like `/d/<id>` are matched by
    // prefix; the router's exact-match strategy doesn't cover this so we
    // intercept in the link-click handler and re-render manually.
  },
});

// P5-002 — match `/d/<token>` and `/u/<username>` dynamically.
const _origRender = router.render.bind(router);
router.render = function patchedRender(url) {
  // Strip any #fragment from the URL before route matching so links like
  // `/#how` resolve to `/` and we can scroll to the in-page anchor afterwards.
  const [pathAndQuery, hash = ''] = url.split('#');
  const [pathname] = pathAndQuery.split('?');
  const dMatch = pathname.match(/^\/d\/([\w.-]+)$/);
  if (dMatch) {
    if (this.current?.destroy) try { this.current.destroy(); } catch { /* ignore */ }
    while (this.mount.firstChild) this.mount.removeChild(this.mount.firstChild);
    const page = ShareDesignPage({ socket, designId: dMatch[1] });
    this.current = page;
    this.mount.appendChild(page.el);
    this.onRoute?.(pathname);
    window.scrollTo(0, 0);
    initRadicalAfterRender();
    if (hash) scrollToHash(hash);
    return;
  }
  _origRender(pathAndQuery);
  initRadicalAfterRender();
  if (hash) scrollToHash(hash);
};

// Scroll to an in-page anchor after a route renders. We retry a couple of
// frames since the page DOM may still be settling (image loads, marquee
// fills, etc. can shift layout).
function scrollToHash(hash) {
  const id = hash.replace(/^#/, '');
  if (!id) return;
  let attempts = 0;
  const tryScroll = () => {
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (attempts++ < 8) {
      requestAnimationFrame(tryScroll);
    }
  };
  requestAnimationFrame(tryScroll);
}

// Wire `sdzr-*` decorations (wordmark splatter, draggable stickers, etc.)
// after each route mount. The radical layer is namespaced so it's a no-op
// on routes that don't include any `sdzr-*` markup.
function initRadicalAfterRender() {
  if (!window.SDZRadical?.init) return;
  // Wait one frame so the new page DOM is committed before we wire it.
  requestAnimationFrame(() => {
    try { window.SDZRadical.init(document); } catch { /* ignore */ }
  });
}

// Apply persisted Tweaks settings on first paint (hero variant + CSS
// vars) regardless of whether the panel itself mounts. Then mount the
// panel only if ?tweaks=1 or localStorage flag is set.
applyPersistedTweaks();
mountTweaksPanel();

// Calm-mode floating toggle — bottom-left. Toggles `html.sdz-calm`
// which freezes all `sdzr-*` motion (and respects prefers-reduced-
// motion automatically). Persists in localStorage via SDZRadical.setCalm.
(function mountCalmToggle() {
  if (!window.SDZRadical) return;
  // Honor stored preference on first paint so animations don't flash on.
  try { window.SDZRadical.setCalm(window.SDZRadical.getCalm()); } catch { /* ignore */ }
  const btn = el('button', {
    type: 'button',
    'aria-label': 'Toggle calm mode (pause animations)',
    title: 'Pause / play animations',
    style: {
      position: 'fixed',
      left: '16px',
      bottom: '16px',
      zIndex: '40',
      width: '44px',
      height: '44px',
      borderRadius: '999px',
      background: 'var(--paper)',
      border: '2px solid var(--ink)',
      boxShadow: '3px 3px 0 var(--ink)',
      cursor: 'pointer',
      fontFamily: 'ui-monospace, monospace',
      fontSize: '1.1rem',
      lineHeight: '1',
      color: 'var(--ink)',
      display: 'grid',
      placeItems: 'center',
    },
  });
  function syncLabel() {
    const calm = window.SDZRadical.getCalm();
    btn.textContent = calm ? '▶' : '∥';
    btn.setAttribute('aria-pressed', calm ? 'true' : 'false');
  }
  syncLabel();
  btn.addEventListener('click', () => {
    window.SDZRadical.setCalm(!window.SDZRadical.getCalm());
    syncLabel();
  });
  document.body.appendChild(btn);
})();

// Prime the runtime config (payments / printing / aaaToggle) once,
// then re-render the active route so pages branch on the resolved
// values + sync the AAA chip visibility.
getAppConfig({ socket }).then((cfg) => {
  syncAaaChip(cfg);
  renderSiteFooter();
  router.render(location.pathname + location.search);
});
onAppConfigChange((cfg) => {
  syncAaaChip(cfg);
  renderSiteFooter();
  router.render(location.pathname + location.search);
});

router.start();

window.__router = router;
window.__socket = socket;

// P7-001 — register the service worker (file shipped from client/public/).
// Quiet-fail in dev environments where SW isn't registered (Safari without
// HTTPS, etc.) — we want the app to keep working even if PWA features don't.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  });
}

// P7-006 — listen for `beforeinstallprompt` and stash it so home.js can
// trigger the banner after the user's second successful generation.
setupInstallPrompt({ socket });

// P6-002 / P6-011 — floating bottom-right chip cluster.
//
// LocaleSwitcher mounts unconditionally. ContrastToggle only mounts
// when the admin has flipped `aaa_toggle_enabled` ON via /admin —
// the chip otherwise clutters the chrome for visitors who never
// need it. When flipped on/off at runtime, we re-render the cluster
// and force-clear `<html data-contrast="aaa">` so a stale localStorage
// state can't keep AAA visually applied after the toggle disappears.
function mountSettingsChip() {
  const existing = document.getElementById('sdz-settings-chip');
  if (existing) existing.remove();
  const cfg = getAppConfig._cached || null; // not available — fall back to cache
  const chip = el(
    'div',
    {
      id: 'sdz-settings-chip',
      class: 'fixed bottom-3 right-3 z-50 flex items-center gap-2',
      role: 'group',
      'aria-label': 'Site settings',
    },
    LocaleSwitcher().el
  );
  return chip;
}

const settingsChip = mountSettingsChip();
document.body.appendChild(settingsChip);

function syncAaaChip(cfg) {
  const aaaOn = !!cfg?.aaaToggleEnabled;
  const chip = document.getElementById('sdz-settings-chip');
  if (!chip) return;
  // Strip any existing ContrastToggle child so we can rebuild idempotently.
  const existing = chip.querySelector('[data-aaa-toggle]');
  if (existing) existing.remove();
  if (aaaOn) {
    const t = ContrastToggle().el;
    t.dataset.aaaToggle = '1';
    chip.insertBefore(t, chip.firstChild);
  } else {
    // Admin disabled the toggle — clear any stale data-contrast attr
    // so a returning visitor doesn't stay locked in AAA mode.
    delete document.documentElement.dataset.contrast;
    try { localStorage.removeItem('sd_contrast'); } catch { /* ignore */ }
  }
}
