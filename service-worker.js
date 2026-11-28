// Service worker: offline-first (app shell v predpamäti, stale-while-revalidate) + Web Push notifikácie
const CACHE = 'spolujazda-v2';
const SHELL = [
  './', 'index.html', 'manifest.json', 'firebase-config.js', 'css/style.css',
  'js/app.js', 'js/util.js', 'js/store.js', 'js/legacy.js', 'js/calc.js', 'js/bind.js', 'js/ui.js', 'js/ride.js',
  'js/fuel.js', 'js/ocr.js', 'js/history.js', 'js/stats.js', 'js/auto.js', 'js/sync.js', 'js/push.js', 'js/push-config.js', 'js/account.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];
const CDN = /(^|\.)(jsdelivr\.net|gstatic\.com|unpkg\.com)$/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === location.origin;
  if (same && url.pathname.startsWith('/.netlify/')) return; // funkcie nikdy necachuj
  if (!same && !CDN.test(url.hostname)) return;              // Firestore/Auth API idú priamo na sieť
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: same });
    const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    return res || (req.mode === 'navigate' ? cache.match('index.html') : Response.error());
  })());
});

// ───────── push notifikácie (ako správa z Messengeru) ─────────
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Spolujazda', {
    body: d.body || '',
    tag: d.tag || 'spolujazda',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    data: { rideId: d.rideId || null },
    actions: d.rideId ? [{ action: 'edit', title: 'Upraviť údaje' }, { action: 'dismiss', title: 'Nechať' }] : [],
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  const id = e.notification.data?.rideId;
  e.waitUntil((async () => {
    const cs = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (cs[0]) { await cs[0].focus(); cs[0].postMessage({ type: 'edit', id }); }
    else await clients.openWindow('./index.html' + (id ? '?edit=' + encodeURIComponent(id) : ''));
  })());
});
