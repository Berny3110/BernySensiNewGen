const CACHE_VERSION = 'v23'; // Incrémenté pour forcer le rechargement du cache
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

// Force le nouveau SW à prendre le contrôle IMMÉDIATEMENT
self.addEventListener('install', event => {
  self.skipWaiting();  // ← Crucial : saute l'étape "waiting"
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

// Nettoie les anciens caches au activate
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())  // Prend le contrôle tout de suite
  );
});

// Fetch : network first + mise en cache (plus agressif)
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).then(response => {
      // Met en cache la réponse fraîche
      return caches.open(CACHE_NAME).then(cache => {
        cache.put(event.request, response.clone());
        return response;
      });
    }).catch(() => caches.match(event.request))
  );
});