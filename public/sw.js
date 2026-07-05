// sw.js — 미러온 Service Worker
// 셸 Cache-First / API·시그널링 Network-Only / WebRTC 미개입

const CACHE_NAME = 'mirroron-v3';
const SHELL_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html',
];

// Install — 셸 캐싱
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// Activate — 구 캐시 삭제
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API, 시그널링, WebRTC → Network Only
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase') ||
    url.hostname.includes('metered') ||
    url.protocol === 'wss:'
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // 셸 → Cache First
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).catch(() => {
        // 오프라인 페이지
        if (request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
        return new Response('', { status: 503 });
      });
    })
  );
});
