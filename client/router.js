// Minimal client-side router using the History API. Replaces React Router.
// Routes are keyed by exact pathname; each value is a factory returning a
// "page object" of shape { el, destroy? }. The router mounts the page's `el`
// into the supplied container and calls `destroy()` on the previous page.
export class Router {
  constructor({ mount, routes, onRoute }) {
    this.mount = mount;
    this.routes = routes;
    this.onRoute = onRoute;
    this.current = null;
  }

  start() {
    window.addEventListener('popstate', () => this.render(location.pathname));
    document.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest('a[data-link]');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('//') || a.target === '_blank') return;
      e.preventDefault();
      this.navigate(href);
    });
    this.render(location.pathname);
  }

  navigate(path) {
    if (path === location.pathname) return;
    history.pushState({}, '', path);
    this.render(path);
  }

  render(path) {
    const factory = this.routes[path] || this.routes['*'] || this.routes['/'];
    if (this.current?.destroy) {
      try { this.current.destroy(); } catch { /* ignore */ }
    }
    while (this.mount.firstChild) this.mount.removeChild(this.mount.firstChild);
    const page = factory();
    this.current = page;
    this.mount.appendChild(page.el);
    this.onRoute?.(path);
    window.scrollTo(0, 0);
  }
}
