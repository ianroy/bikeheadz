// Minimal client-side router using the History API. Replaces React Router.
// Routes are keyed by exact pathname; each value is a factory receiving a
// `context` object with { path, query } and returning a page object of shape
// { el, destroy? }. The router mounts the page's `el` into the supplied
// container and calls `destroy()` on the previous page.
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
    if (this.current?.destroy) {
      try { this.current.destroy(); } catch { /* ignore */ }
    }
    while (this.mount.firstChild) this.mount.removeChild(this.mount.firstChild);
    const query = parseQuery(search);
    const page = factory({ path: pathname, query });
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
