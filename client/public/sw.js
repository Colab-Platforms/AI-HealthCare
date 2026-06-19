// take.health Service Worker — PWA + Firebase Cloud Messaging
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// ── Firebase Init ──────────────────────────────────────────────────────────
firebase.initializeApp({
  apiKey: "AIzaSyCDZB6aCHw3wBdJkxSBPMdEmOBOAOvgcz8",
  authDomain: "take-health-50a73.firebaseapp.com",
  projectId: "take-health-50a73",
  storageBucket: "take-health-50a73.firebasestorage.app",
  messagingSenderId: "803497738590",
  appId: "1:803497738590:web:6314c5445932793a234fcf",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || 'Health AI', {
    body: body || '',
    icon: icon || '/icon.svg',
    tag: payload.data?.type || 'general',
    data: payload.data || {},
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const actionUrl = event.notification.data?.actionUrl || '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(actionUrl);
          return;
        }
      }
      if (clients.openWindow) clients.openWindow(actionUrl);
    })
  );
});

// ── PWA Cache ──────────────────────────────────────────────────────────────
const CACHE_NAME = 'takehealth-v2';
const urlsToCache = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(cacheNames.map((name) => name !== CACHE_NAME && caches.delete(name)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.includes('/api/') || event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache)).catch(() => {});
        }
        return response;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;
        if (event.request.mode === 'navigate') {
          const indexCache = await caches.match('/index.html');
          if (indexCache) return indexCache;
        }
        return new Response('Offline: Resource not available', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      })
  );
});
