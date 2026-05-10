const CACHE = 'todo-v2';
const SHELL = [
  './', './index.html', './templates.html', './manifest.json',
  './css/styles.css',
  './js/app.js', './js/board.js', './js/modal.js', './js/models.js',
  './js/store.js', './js/templates-app.js', './js/templates-engine.js',
  './js/templates-page.js', './js/firebase.js', './js/firebase-config.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})
  );
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

  // Always bypass SW for Firebase, fonts, and external CDNs
  const url = e.request.url;
  if (
    url.includes('firebase') ||
    url.includes('googleapis.com') ||
    url.includes('gstatic.com') ||
    url.includes('fontshare.com')
  ) return;

  // Network-first for JS and CSS so updates land immediately
  const isAsset = url.endsWith('.js') || url.endsWith('.css');
  if (isAsset) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for HTML and other static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok && url.startsWith(self.location.origin)) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => cached || caches.match('./index.html'));
      return cached || network;
    })
  );
});
