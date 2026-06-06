const APP_VERSION = '1.0.0';
const CACHE_PREFIX = 'big2-tw-';
const STATIC_CACHE = `${CACHE_PREFIX}static-v${APP_VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-v${APP_VERSION}`;
const META_CACHE = `${CACHE_PREFIX}meta`;
const ROLLBACK_META_URL = new URL('./__pwa_rollback__.json', self.registration.scope).href;
const OFFLINE_URL = new URL('./offline.html', self.registration.scope).href;
const INDEX_URL = new URL('./index.html', self.registration.scope).href;
const SCOPE_PATH = new URL(self.registration.scope).pathname;

const APP_SHELL_PATHS = [
  './',
  './index.html',
  './offline.html',
  './privacy.html',
  './docs/KNOWN_LIMITATIONS.md',
  './docs/STABLE_RELEASE_CHECKLIST.md',
  './docs/BACKUP_AND_RECOVERY.md',
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

async function versionedStaticCaches() {
  const keys = await caches.keys();
  return keys.filter((key) => key.startsWith(`${CACHE_PREFIX}static-v`))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
}

async function readRollbackState() {
  const cache = await caches.open(META_CACHE);
  const response = await cache.match(ROLLBACK_META_URL);
  if (!response) return { activeCache: null };
  try { return await response.json(); } catch { return { activeCache: null }; }
}

async function writeRollbackState(activeCache = null) {
  const cache = await caches.open(META_CACHE);
  if (!activeCache) {
    await cache.delete(ROLLBACK_META_URL);
    return { activeCache: null };
  }
  const payload = { activeCache, selectedAt: Date.now(), currentVersion: APP_VERSION };
  await cache.put(ROLLBACK_META_URL, new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json' } }));
  return payload;
}

async function getRollbackInfo() {
  const staticCaches = await versionedStaticCaches();
  const previousCaches = staticCaches.filter((key) => key !== STATIC_CACHE);
  const state = await readRollbackState();
  const activeCache = state.activeCache && staticCaches.includes(state.activeCache) ? state.activeCache : null;
  if (state.activeCache && !activeCache) await writeRollbackState(null);
  const previousCache = previousCaches[0] || null;
  return {
    currentVersion: APP_VERSION,
    currentCache: STATIC_CACHE,
    previousCache,
    previousVersion: previousCache?.replace(`${CACHE_PREFIX}static-v`, '') || null,
    rollbackActive: Boolean(activeCache),
    activeCache,
    activeVersion: activeCache?.replace(`${CACHE_PREFIX}static-v`, '') || APP_VERSION,
    availableCaches: staticCaches
  };
}

async function cleanupAppCaches({ includeCurrent = false, preservePrevious = true } = {}) {
  const keys = await caches.keys();
  const staticCaches = await versionedStaticCaches();
  const previousStatic = preservePrevious ? staticCaches.find((key) => key !== STATIC_CACHE) : null;
  const rollback = await readRollbackState();
  const keep = new Set(includeCurrent ? [META_CACHE] : [STATIC_CACHE, RUNTIME_CACHE, META_CACHE]);
  if (previousStatic) keep.add(previousStatic);
  if (rollback.activeCache) keep.add(rollback.activeCache);
  const targets = keys.filter((key) => key.startsWith(CACHE_PREFIX) && !keep.has(key));
  const results = await Promise.all(targets.map(async (key) => ({ key, deleted: await caches.delete(key) })));
  return results.filter((item) => item.deleted).map((item) => item.key);
}

async function rollbackNavigationResponse(cache, activeCache) {
  const source = (await cache.match(INDEX_URL)) || (await cache.match(new URL('./', self.registration.scope).href));
  if (!source) return null;
  const version = activeCache.replace(`${CACHE_PREFIX}static-v`, '');
  const html = await source.text();
  const recovery = `<div id="big2RollbackRecovery" style="position:fixed;left:8px;right:8px;top:8px;z-index:2147483647;padding:10px 12px;border-radius:12px;background:#fff3cd;color:#352a00;border:2px solid #a36b00;font:600 14px/1.45 system-ui,sans-serif;box-shadow:0 6px 22px rgba(0,0,0,.25)">目前以回復模式執行 v${version}。<button id="big2RestoreLatestInline" style="margin-left:8px;padding:7px 12px;border:1px solid #352a00;border-radius:8px;background:#352a00;color:#fff;font:inherit">恢復最新版 v${APP_VERSION}</button></div><script>(function(){var b=document.getElementById('big2RestoreLatestInline');if(!b)return;b.onclick=function(){b.disabled=true;var c=new MessageChannel();c.port1.onmessage=function(e){if(e.data&&e.data.ok)location.reload();else{b.disabled=false;alert((e.data&&e.data.message)||'恢復最新版失敗');}};navigator.serviceWorker.controller.postMessage({type:'RESTORE_CURRENT_VERSION'},[c.port2]);};})();</script>`;
  const body = html.includes('</body>') ? html.replace('</body>', `${recovery}</body>`) : `${html}${recovery}`;
  const headers = new Headers(source.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(body, { status: source.status, statusText: source.statusText, headers });
}

async function matchRollback(request, { navigation = false } = {}) {
  const state = await readRollbackState();
  if (!state.activeCache) return null;
  const cache = await caches.open(state.activeCache);
  if (navigation) return rollbackNavigationResponse(cache, state.activeCache);
  return (await cache.match(request)) || (await cache.match(normalizedRequest(request)));
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
  if (type === 'GET_ROLLBACK_STATE') {
    event.waitUntil((async () => {
      try { event.ports?.[0]?.postMessage({ ok: true, ...(await getRollbackInfo()) }); }
      catch (error) { event.ports?.[0]?.postMessage({ ok: false, message: error?.message || String(error) }); }
    })());
    return;
  }
  if (type === 'ROLLBACK_TO_PREVIOUS') {
    event.waitUntil((async () => {
      try {
        const info = await getRollbackInfo();
        if (!info.previousCache) throw new Error('這台裝置沒有可回復的上一版快取。');
        await writeRollbackState(info.previousCache);
        event.ports?.[0]?.postMessage({ ok: true, activeCache: info.previousCache, version: info.previousVersion });
      } catch (error) { event.ports?.[0]?.postMessage({ ok: false, message: error?.message || String(error) }); }
    })());
    return;
  }
  if (type === 'RESTORE_CURRENT_VERSION') {
    event.waitUntil((async () => {
      try {
        await writeRollbackState(null);
        await precacheAppShell();
        event.ports?.[0]?.postMessage({ ok: true, version: APP_VERSION });
      } catch (error) { event.ports?.[0]?.postMessage({ ok: false, message: error?.message || String(error) }); }
    })());
    return;
  }
  if (type === 'REPAIR_PWA') {
    event.waitUntil((async () => {
      try {
        await writeRollbackState(null);
        const deleted = await cleanupAppCaches({ includeCurrent: true, preservePrevious: false });
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
  const rollback = await matchRollback(request, { navigation: true });
  if (rollback) return rollback;
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
  const rollback = await matchRollback(request);
  if (rollback) return rollback;
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
  const rollback = await matchRollback(request);
  if (rollback) return rollback;
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
