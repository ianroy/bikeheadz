// Minimal client-side router. ~50 lines of History API, replaces the
// 60kB of React Router we did not install. Routes are keyed by exact
// pathname; each value is a factory receiving `{ path, query, matched }`
// and returning a page object `{ el, destroy? }`. We mount the page's
// `el` into the container and call `destroy()` on the previous page on
// the way out — that's where pages should disconnect IntersectionObservers,
// tear down WebGL contexts, abort in-flight fetches, etc.
//
// Hash-aware: links with `/#how` patterns get the fragment stripped
// for route matching, then the page scrolls to that id once mounted
// (see main.js's `scrollToHash`). This is how /#how and /#sixpack
// work as in-page anchors instead of separate routes.
//
// If you find yourself wanting nested routes, route guards, lazy loading,
// or a `useNavigate` hook — you don't want this router. Switch to
// something heavier and accept the bundle weight as a deliberate trade.
export class Router {
  constructor({ mount, routes, onRoute }) {
    this.mount = mount;
    this.routes = routes;
    this.onRoute = onRoute;
    this.current = null;
  }

  start() {
    window.addEventListener('popstate', () => this.render(location.pathname + location.search));
    document.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest('a[data-link]');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('//') || a.target === '_blank') return;
      e.preventDefault();
      this.navigate(href);
    });
    this.render(location.pathname + location.search);
  }

  navigate(url) {
    const [pathname, search = ''] = url.split('?');
    const current = location.pathname + (location.search || '');
    const next = pathname + (search ? `?${search}` : '');
    if (next === current) return;
    history.pushState({}, '', next);
    this.render(next);
  }

  render(url) {
    const [pathname, search = ''] = url.split('?');
    const factory = this.routes[pathname] || this.routes['*'] || this.routes['/'];
    const matched = pathname in this.routes;
    if (this.current?.destroy) {
      try { this.current.destroy(); } catch { /* ignore */ }
    }
    while (this.mount.firstChild) this.mount.removeChild(this.mount.firstChild);
    const query = parseQuery(search);
    const page = factory({ path: pathname, query, matched });
    this.current = page;
    this.mount.appendChild(page.el);
    this.onRoute?.(pathname);
    window.scrollTo(0, 0);
  }
}

function parseQuery(search) {
  const out = {};
  if (!search) return out;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  for (const [k, v] of params) out[k] = v;
  return out;
}
