const CACHE_VERSION = 'v37';
const CACHE_NAME = `sensitrack-cache-${CACHE_VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './maskable_icon_x192_v4.png',
  './maskable_icon_x512_v4.png',
  './js/app.js',
  './js/uiManager.js',
  './js/dataManager.js',
  './js/cycleComputer.js',
  './js/paperRenderer.js',
  './js/wheelManager.js',
  './js/notificationManager.js'
];

// Force le nouveau SW à prendre le contrôle IMMÉDIATEMENT
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS).catch(err => {
      console.warn('Erreur mise en cache initiale:', err);
    }))
  );
});

// Nettoie les anciens caches au activate
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch : network first + mise en cache
self.addEventListener('fetch', event => {
  // Ignorer les requêtes non GET ou externes si besoin
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request).then(response => {
      if (response && response.status === 200 && response.type === 'basic') {
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});

// Réception d'une notification Push distante
self.addEventListener('push', event => {
  let data = { title: 'SensiTrack', body: 'Pensez à saisir votre température ou vos observations du cycle.' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || 'Pensez à saisir votre température ou vos observations du cycle.',
    icon: './maskable_icon_x192_v4.png',
    badge: './maskable_icon_x192_v4.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || './'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'SensiTrack', options)
  );
});

// Clic sur la notification
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
