const CACHE = 'todo-v1';
const SHELL = [
  './', './index.html', './templates.html', './manifest.json',
  './css/styles.css',
  './js/app.js', './js/board.js', './js/modal.js', './js/models.js',
  './js/store.js', './js/templates-app.js', './js/templates-engine.js',
  './js/templates-page.js', './js/firebase.js', './js/firebase-config.js',
  './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Always network for Firebase + font requests
  if (
    e.request.url.includes('firebase') ||
    e.request.url.includes('googleapis.com') ||
    e.request.url.includes('fontshare.com')
  ) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok && e.request.url.startsWith(self.location.origin)) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => cached || caches.match('./index.html'));
      return cached || network;
    })
  );
});
