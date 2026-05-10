// 小铭奇遇记 Service Worker（v2 - 修复缓存更新问题）
// 策略：HTML 用 network-first（保证更新），其他资源 cache-first（保证离线）

const CACHE_NAME = 'kidquest-v2';      // ⚠️ 每次发新版必须改这个版本号
const RUNTIME_CACHE = 'kidquest-runtime-v2';

const PRECACHE_URLS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// 安装：预缓存静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('SW precache error:', err))
  );
});

// 激活：清理所有旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME && key !== RUNTIME_CACHE)
            .map((key) => {
              console.log('🗑️ 删除旧缓存:', key);
              return caches.delete(key);
            })
      );
    }).then(() => self.clients.claim())
  );
});

// 判断是否是 HTML 文档请求
const isHtmlRequest = (request) => {
  return request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');
};

// 拦截请求
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // 🌐 HTML 文档：network-first（先要新的，失败用缓存）
  if (isHtmlRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // 网络成功：更新缓存并返回
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // 网络失败：用缓存（离线模式）
          return caches.match(event.request).then(cached => cached || caches.match('./'));
        })
    );
    return;
  }

  // 📦 其他资源（图标、CDN 等）：cache-first（节省流量、保证离线）
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, clone));
        return response;
      }).catch(() => undefined);
    })
  );
});

// 监听消息：允许页面主动触发更新
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
