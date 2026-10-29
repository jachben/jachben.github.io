// Tabulka střihu – service worker.
// Soubory aplikace jdou vždy nejdřív ze sítě (uložená kopie jen bez internetu).
// Data tabulek se sem neukládají vůbec: chodí přímo z databáze, takže nikdy nejsou zastaralá.
// Nová verze se nainstaluje na pozadí a aktivuje se, až uživatel klepne na „Obnovit“.
const CACHE = 'tabulka-v4';
const SHELL = ['/k/', '/admin/', '/config.js', '/vendor/supabase.js', '/ikony/icon-192.png', '/ikony/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
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
  const key = new URL(req.url);
  key.search = ''; // token v adrese do klíče neukládáme
  try {
    const res = await fetch(req, { cache: 'no-store' });
    if (res.ok) cache.put(key.href, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(key.href);
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
    if (url.pathname.startsWith('/ikony/') || url.pathname.startsWith('/nahledy/')) e.respondWith(cacheFirst(req));
    else if (req.mode === 'navigate' || /\.(html|js|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/')) e.respondWith(networkFirst(req));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirst(req));
  }
  // požadavky do databáze (supabase.co) service worker nikdy nepřebírá ani neukládá
});
