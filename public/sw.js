const CACHE_PREFIX = 'course-calendar'
const CACHE_NAME = `${CACHE_PREFIX}-shell-v1`
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icons/app-icon-192.png',
  '/icons/app-icon-512.png',
  '/icons/app-icon-maskable-512.png'
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // 登录态和课程数据必须始终访问网络，不能由 Service Worker 缓存。
  if (url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!response.ok) return response

          const copy = response.clone()
          return caches.open(CACHE_NAME)
            .then((cache) => cache.put('/', copy))
            .catch(() => undefined)
            .then(() => response)
        })
        .catch(async () => (
          await caches.match('/') || new Response('当前处于离线状态，请连接网络后重试。', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          })
        ))
    )
    return
  }

  if (['script', 'style', 'font', 'image'].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached

        return fetch(request).then((response) => {
          if (!response.ok || response.type !== 'basic') return response

          const copy = response.clone()
          return caches.open(CACHE_NAME)
            .then((cache) => cache.put(request, copy))
            .catch(() => undefined)
            .then(() => response)
        })
      })
    )
  }
})
