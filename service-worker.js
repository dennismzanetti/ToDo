const CACHE = 'todo-v3';
const SHELL = [
  './', './index.html', './templates.html', './manifest.json',
  './css/styles.css', './css/mobile.css',
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

  const url = e.request.url;

  // Bypass everything that isn't same-origin static files
  if (!url.startsWith(self.location.origin)) return;

  // Bypass navigation to non-HTML (let browser handle)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Network-first for JS/CSS so updates land immediately
  const isAsset = /\.(js|css)$/.test(url.split('?')[0]);
  if (isAsset) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone(); // clone BEFORE returning
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for everything else (images, manifest, etc.)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.ok) {
          const copy = res.clone(); // clone BEFORE returning
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
