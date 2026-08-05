/* Linux Roadmap PWA — Service Worker (cache-first) */
const CACHE = 'linux-roadmap-v2';
const ASSETS = [
  './',
  'linux-roadmap-fa.html',
  'index.html',
  'linux-roadmap-manifest.json',
  'linux-roadmap-icon.svg',
  'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;700;800;900&display=swap',
];

self.addEventListener('install', ev => {
  ev.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', ev => {
  // skip non-GET and chrome-extension requests
  if (ev.request.method !== 'GET') return;
  if (ev.request.url.startsWith('chrome-extension://')) return;
  
  ev.respondWith(
    caches.match(ev.request).then(cached => {
      const fetchPromise = fetch(ev.request).then(res => {
        if (res && res.status < 400) {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(ev.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

/* notification click → open the app */
self.addEventListener('notificationclick', ev => {
  ev.notification.close();
  ev.waitUntil(
    clients.matchAll({ type: 'window' }).then(clients => {
      if (clients.length) {
        clients[0].focus();
        clients[0].navigate('./');
      } else {
        clients.openWindow('./');
      }
    })
  );
});
