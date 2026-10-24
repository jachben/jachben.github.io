// Tabulka střihu – service worker.
// Stránky a data jdou vždy nejdřív ze sítě (klient vidí aktuální stav),
// uložená kopie se použije jen bez internetu.
const CACHE = 'tabulka-v3';
const STATIC = ['/ikony/icon-192.png', '/ikony/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req, { cache: 'no-store' });
    if (res.ok) cache.put(req.url.split('?')[0], res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req.url.split('?')[0]);
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (req.mode === 'navigate' || url.pathname.endsWith('/data.json') || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
      e.respondWith(networkFirst(req));
    } else if (url.pathname.startsWith('/ikony/') || url.pathname.startsWith('/nahledy/')) {
      e.respondWith(cacheFirst(req));
    }
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirst(req));
  }
});
