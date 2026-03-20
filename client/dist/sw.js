// FitCure Service Worker
const CACHE_NAME = 'fitcure-v2'; // Updated version to force refresh
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
  
  // CRITICAL: Skip caching for API calls (especially image uploads)
  // This prevents service worker from interfering with POST requests
  if (url.pathname.startsWith('/api/')) {
    // Just pass through to network, don't cache
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Skip caching for chrome-extension and other non-http schemes
  if (!event.request.url.startsWith('http')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // For other requests, use network first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful GET requests
        if (event.request.method === 'GET' && response.status === 200) {
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            })
            .catch((err) => {
              // Silently fail cache writes (prevents chrome-extension errors)
              console.log('Cache write failed:', err.message);
            });
        }
        
        return response;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(event.request);
      })
  );
});
