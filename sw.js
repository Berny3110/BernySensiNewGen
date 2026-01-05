const CACHE_VERSION = 'v2'; // change juste ce numéro quand tu veux forcer une mise à jour
const CACHE_NAME = `sensitrack-cache-${CACHE_VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './js/app.js',
  './js/uiManager.js',
  './js/dataManager.js',
  './js/cycleComputer.js',
  './js/chartRenderer.js'
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
