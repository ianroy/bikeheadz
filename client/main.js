import './styles/index.css';
import { el } from './dom.js';
import { Router } from './router.js';
import { SocketClient } from './socket.js';
import { HeaderComponent } from './components/header.js';
import { HomePage } from './pages/home.js';
import { GeneratorPage } from './pages/generator.js';
import { HowItWorksPage } from './pages/how-it-works.js';
import { AccountPage } from './pages/account.js';
import { PricingPage } from './pages/pricing.js';
import { CheckoutReturnPage } from './pages/checkout-return.js';
import { LoginPage } from './pages/login.js';
import { AdminPage } from './pages/admin.js';
import { GalleryPage, ShareDesignPage } from './pages/gallery.js';
import { HelpPage } from './pages/help.js';
import { StatusPage } from './pages/status.js';
import { ChangelogPage, IncidentsPage } from './pages/changelog.js';
import { PressPage } from './pages/press.js';
import {
  TermsPage,
  PrivacyPage,
  AcceptableUsePage,
  SecurityPage,
  NotFoundPage,
  ServerErrorPage,
} from './pages/legal.js';
import { setupInstallPrompt } from './components/install-prompt.js';
import { LocaleSwitcher } from './components/locale-switcher.js';
import { ContrastToggle } from './components/contrast-toggle.js';

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
    '/how-it-works': () => HowItWorksPage({ socket }),
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
  const [pathname] = url.split('?');
  const dMatch = pathname.match(/^\/d\/([\w.-]+)$/);
  if (dMatch) {
    if (this.current?.destroy) try { this.current.destroy(); } catch { /* ignore */ }
    while (this.mount.firstChild) this.mount.removeChild(this.mount.firstChild);
    const page = ShareDesignPage({ socket, designId: dMatch[1] });
    this.current = page;
    this.mount.appendChild(page.el);
    this.onRoute?.(pathname);
    window.scrollTo(0, 0);
    return;
  }
  _origRender(url);
};

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

// P6-002 / P6-011 — mount locale switcher + AAA-contrast toggle as a floating
// bottom-right chip cluster. Header-right would be more discoverable but
// crowds the nav; revisit when the toolbar gets a redesign pass.
const settingsChip = el(
  'div',
  {
    class: 'fixed bottom-3 right-3 z-50 flex items-center gap-2',
    role: 'group',
    'aria-label': 'Site settings',
  },
  ContrastToggle().el,
  LocaleSwitcher().el
);
document.body.appendChild(settingsChip);
