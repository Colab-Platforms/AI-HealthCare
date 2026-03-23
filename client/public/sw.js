// take.health Service Worker
const CACHE_NAME = 'takehealth-v1'; // Brand update to take.health
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // 1. BYPASS for API and non-GET requests
  // We NEVER want the service worker to interfere with data mutations or auth
  if (url.pathname.includes('/api/') || event.request.method !== 'GET') {
    return; // Let the browser handle it naturally
  }

  // 2. BYPASS for non-http(s)
  if (!event.request.url.startsWith('http')) {
    return;
  }
  
  // 3. Strategy: Network First, Cache Fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful GET responses
        if (response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          }).catch(() => {}); // Silence cache errors
        }
        return response;
      })
      .catch(async (err) => {
        // Network failed, try cache
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;

        // If it's a navigation request (page reload/link), return index.html
        if (event.request.mode === 'navigate') {
          const indexCache = await caches.match('/index.html');
          if (indexCache) return indexCache;
        }

        // Ultimate fallback to prevent "Failed to convert value to Response"
        return new Response('Offline: Resource not available', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        });
      })
  );
});
