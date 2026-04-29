/* P7-001 — StemDomeZ service worker.
 *
 * Strategy:
 *   • Precache the app shell (`/` + `/manifest.webmanifest`) so the home
 *     route is reachable offline once the SW has installed.
 *   • Runtime-cache Unsplash hero imagery with stale-while-revalidate
 *     so first paint is instant on repeat visits but we still pull in
 *     fresh images in the background.
 *
 * Note for the parent: this file lives in `/public` and ships unhashed.
 * Vite hashes built JS/CSS asset URLs, so we don't try to enumerate a
 * build manifest here — that would invalidate every release. When the
 * project is ready for a real PWA story, swap this for `vite-plugin-pwa`
 * which handles the precache manifest injection automatically.
 */

const CACHE_VERSION = 'bh-v1';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const UNSPLASH_HOST = 'images.unsplash.com';

const SHELL_ASSETS = [
  '/',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((k) => !k.startsWith(CACHE_VERSION))
        .map((k) => caches.delete(k)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Runtime: Unsplash hero/source imagery — stale-while-revalidate.
  if (url.host === UNSPLASH_HOST) {
    event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
    return;
  }

  // Same-origin navigation requests fall back to the cached shell when
  // the network is unreachable. This is what makes the app load offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/').then((r) => r || Response.error())),
    );
    return;
  }

  // Cache-first for the manifest itself; otherwise pass-through.
  if (url.origin === self.location.origin && url.pathname === '/manifest.webmanifest') {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req)),
    );
  }
});

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && res.status === 200 && res.type !== 'opaqueredirect') {
        cache.put(req, res.clone()).catch(() => {});
      }
      return res;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}
