const APP_VERSION = '0.8.2';
const CACHE_PREFIX = 'big2-tw-';
const STATIC_CACHE = `${CACHE_PREFIX}static-v${APP_VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-v${APP_VERSION}`;
const OFFLINE_URL = new URL('./offline.html', self.registration.scope).href;
const INDEX_URL = new URL('./index.html', self.registration.scope).href;
const SCOPE_PATH = new URL(self.registration.scope).pathname;

const APP_SHELL_PATHS = [
  './',
  './index.html',
  './offline.html',
  './privacy.html',
  './manifest.webmanifest',
  './styles/base.css',
  './src/main.js',
  './src/pwa.js',
  './src/ai.js',
  './src/cards.js',
  './src/constants.js',
  './src/experience.js',
  './src/firebase-config.js',
  './src/firebase-room.js',
  './src/game-settings.js',
  './src/game-state.js',
  './src/rules.js',
  './src/scoring.js',
  './src/sound.js',
  './src/themes.js',
  './src/ui.js',
  './assets/icons/favicon.svg',
  './assets/icons/favicon-32.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/social/og-big2.png',
  './assets/splash/splash-portrait.png',
  './assets/splash/splash-landscape.png'
];

const APP_SHELL = APP_SHELL_PATHS.map((path) => new URL(path, self.registration.scope).href);

async function precacheAppShell() {
  const cache = await caches.open(STATIC_CACHE);
  await Promise.all(APP_SHELL.map(async (url) => {
    const response = await fetch(url, { cache: 'reload' });
    if (!response.ok) throw new Error(`無法快取 ${url}: ${response.status}`);
    await cache.put(url, response);
  }));
}

async function cleanupAppCaches({ includeCurrent = false } = {}) {
  const keys = await caches.keys();
  const targets = keys.filter((key) => key.startsWith(CACHE_PREFIX)
    && (includeCurrent || ![STATIC_CACHE, RUNTIME_CACHE].includes(key)));
  const results = await Promise.all(targets.map(async (key) => ({ key, deleted: await caches.delete(key) })));
  return results.filter((item) => item.deleted).map((item) => item.key);
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAppShell());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await cleanupAppCaches();
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable().catch(() => {});
    }
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((client) => client.postMessage({ type: 'CACHE_READY', version: APP_VERSION }));
  })());
});

self.addEventListener('message', (event) => {
  const type = event.data?.type;
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (type === 'GET_VERSION') {
    event.ports?.[0]?.postMessage({ version: APP_VERSION });
    return;
  }
  if (type === 'REFRESH_APP_SHELL') {
    event.waitUntil((async () => {
      try {
        await precacheAppShell();
        event.ports?.[0]?.postMessage({ ok: true, version: APP_VERSION });
      } catch (error) {
        event.ports?.[0]?.postMessage({ ok: false, message: error?.message || String(error) });
      }
    })());
    return;
  }
  if (type === 'CLEAR_OLD_CACHES') {
    event.waitUntil((async () => {
      try {
        const deleted = await cleanupAppCaches();
        event.ports?.[0]?.postMessage({ ok: true, deleted, version: APP_VERSION });
      } catch (error) {
        event.ports?.[0]?.postMessage({ ok: false, message: error?.message || String(error) });
      }
    })());
    return;
  }
  if (type === 'REPAIR_PWA') {
    event.waitUntil((async () => {
      try {
        const deleted = await cleanupAppCaches({ includeCurrent: true });
        await precacheAppShell();
        event.ports?.[0]?.postMessage({ ok: true, deleted, version: APP_VERSION });
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        clients.forEach((client) => client.postMessage({ type: 'CACHE_READY', version: APP_VERSION }));
      } catch (error) {
        event.ports?.[0]?.postMessage({ ok: false, message: error?.message || String(error) });
      }
    })());
  }
});

function normalizedRequest(request) {
  const url = new URL(request.url);
  url.search = '';
  url.hash = '';
  return new Request(url.href, { method: 'GET', headers: request.headers });
}

async function fetchWithTimeout(request, timeoutMs = 5500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

async function navigationNetworkFirst(event) {
  const request = event.request;
  const cacheKey = normalizedRequest(request);
  try {
    const preload = await event.preloadResponse;
    const response = preload || await fetchWithTimeout(request);
    if (response?.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(cacheKey, response.clone());
    }
    return response;
  } catch {
    const exact = await caches.match(cacheKey);
    if (exact) return exact;
    const url = new URL(request.url);
    if (url.pathname === SCOPE_PATH || url.pathname === `${SCOPE_PATH}index.html`) {
      return (await caches.match(INDEX_URL)) || (await caches.match(OFFLINE_URL));
    }
    return (await caches.match(OFFLINE_URL)) || new Response('Offline', { status: 503 });
  }
}

async function networkFirstAsset(request) {
  try {
    const response = await fetchWithTimeout(request, 7000);
    if (response?.ok && response.type === 'basic') {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request))
      || (await caches.match(normalizedRequest(request)))
      || new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function cacheFirstImage(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response?.ok && response.type === 'basic') {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/service-worker.js')) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigationNetworkFirst(event));
    return;
  }

  if (request.destination === 'script'
    || request.destination === 'style'
    || request.destination === 'manifest'
    || /\.(?:js|css|json|webmanifest)$/i.test(url.pathname)) {
    event.respondWith(networkFirstAsset(request));
    return;
  }

  if (request.destination === 'image' || /\.(?:png|svg|jpg|jpeg|webp|ico)$/i.test(url.pathname)) {
    event.respondWith(cacheFirstImage(request));
    return;
  }

  event.respondWith(networkFirstAsset(request));
});
