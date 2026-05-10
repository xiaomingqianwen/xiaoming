// 童童岛奇遇记 Service Worker
// 缓存策略：首次访问后所有资源缓存，后续完全离线
const CACHE_NAME = 'kidquest-v1';
const RUNTIME_CACHE = 'kidquest-runtime';

// 必须缓存的核心资源（不缓存就无法运行）
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// 安装时预缓存核心资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('SW precache error:', err))
  );
});

// 激活时清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// 网络请求拦截：cache-first 策略（先看缓存，没有才请求网络）
self.addEventListener('fetch', (event) => {
  // 只处理 GET 请求
  if (event.request.method !== 'GET') return;

  // 跨域请求（CDN）使用 stale-while-revalidate 策略
  const url = new URL(event.request.url);
  const isCrossOrigin = url.origin !== location.origin;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // 缓存命中
      if (cached) {
        // 后台异步更新缓存（不阻塞）
        if (isCrossOrigin) {
          fetch(event.request).then((response) => {
            if (response && response.status === 200) {
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, response));
            }
          }).catch(() => {});
        }
        return cached;
      }

      // 缓存未命中：去网络请求并缓存
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200) return response;
        const responseToCache = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      }).catch(() => {
        // 网络失败：返回离线提示（HTML 请求时）
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
