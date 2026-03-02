const CACHE_VERSION = 'v3'; // Incrémenté pour forcer le rechargement du cache
const CACHE_NAME = `sensitrack-cache-${CACHE_VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './js/app.js',
  './js/uiManager.js',
  './js/dataManager.js',
  './js/cycleComputer.js',
  './js/paperRenderer.js',
  './js/wheelManager.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});