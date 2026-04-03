/**
 * sw.js — CountUp Service Worker
 *
 * Cache-first strategy for all static assets.
 * Falls back to network when cache misses, then caches the response.
 */

const CACHE_NAME = 'countup-v7';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './gist.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// Install: pre-cache all static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first, fall back to network
self.addEventListener('fetch', event => {
  // Only intercept same-origin GET requests (not GitHub API calls)
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.hostname !== self.location.hostname) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
