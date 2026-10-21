/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Forcer l'activation immédiate de tout nouveau Service Worker sans bloquer
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Écouter le message SKIP_WAITING du client pour forcer l'activation immédiate
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 1. GESTION DES CLICS SUR LES NOTIFICATIONS (Crucial pour Android PWA)
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  console.log('[SW] Notification cliquée:', event.notification);
  event.notification.close();

  const notificationData = event.notification.data || {};
  const targetUrl = notificationData.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si un onglet/fenêtre est déjà ouvert, le ramener au premier plan
      for (const client of clientList) {
        if ('focus' in client) {
          if (targetUrl && targetUrl !== '/' && 'navigate' in client) {
            try {
              (client as any).navigate(targetUrl);
            } catch (e) {}
          }
          return client.focus();
        }
      }
      // Sinon ouvrir une nouvelle fenêtre
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// 2. GESTION DES ÉVÉNEMENTS PUSH D'ARRIÈRE-PLAN
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || 'DPS65 Notification';
    const options: NotificationOptions = {
      body: payload.body || payload.message || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: payload.tag || 'dps65-notification',
      renotify: true,
      requireInteraction: payload.requireInteraction || payload.category === 'ALERTE_GEN',
      data: payload.data || { url: '/' },
      // @ts-ignore
      vibrate: payload.vibrate || [200, 100, 200, 100, 200, 100, 400],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('DPS65 Notification', {
        body: text,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png'
      })
    );
  }
});

// 3. CACHE STRATEGIES
registerRoute(
  /^https:\/\/[a-c]\.tile\.openstreetmap\.org\/.*/i,
  new StaleWhileRevalidate({
    cacheName: 'osm-tiles',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 1000,
        maxAgeSeconds: 60 * 60 * 24 * 30
      })
    ]
  })
);

registerRoute(
  /^https:\/\/[a-c]\.tile\.opentopomap\.org\/.*/i,
  new StaleWhileRevalidate({
    cacheName: 'opentopo-tiles',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 1000,
        maxAgeSeconds: 60 * 60 * 24 * 30
      })
    ]
  })
);

registerRoute(
  /^https:\/\/esm\.sh\/.*/i,
  new StaleWhileRevalidate({
    cacheName: 'esm-sh-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }),
      new CacheableResponsePlugin({ statuses: [0, 200] })
    ]
  })
);

registerRoute(
  /^https:\/\/unpkg\.com\/.*/i,
  new CacheFirst({
    cacheName: 'unpkg-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] })
    ]
  })
);

registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] })
    ]
  })
);

registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] })
    ]
  })
);

registerRoute(
  /^https:\/\/cdn\.tailwindcss\.com\/.*/i,
  new CacheFirst({
    cacheName: 'tailwind-cdn-cache',
    plugins: [
      new ExpirationPlugin({ maxAgeSeconds: 60 * 60 * 24 * 30 }),
      new CacheableResponsePlugin({ statuses: [0, 200] })
    ]
  })
);
