const APP_VERSION = '1.0.1';
const ONBOARDING_KEY = 'big2-onboarding-complete-v1';
const LEGACY_ONBOARDING_PREFIX = 'big2-onboarding-';
const INSTALL_HELP_KEY = 'big2-install-help-seen';
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const APP_CACHE_PREFIX = 'big2-tw-';

let deferredInstallPrompt = null;
let pendingWorker = null;
let serviceWorkerRegistration = null;
let onboardingStep = 0;
let onboardingOpener = null;
let controllerReloadRequested = false;
let updateCheckTimer = null;
let lastPwaError = null;
let repairInProgress = false;

function byId(id) {
  return document.getElementById(id);
}

function serializeError(error) {
  if (!error) return null;
  return {
    name: error.name || 'Error',
    message: error.message || String(error),
    stack: error.stack ? String(error.stack).slice(0, 2400) : null,
    at: new Date().toISOString()
  };
}

function capturePwaError(error, feature = 'PWA') {
  lastPwaError = serializeError(error);
  try {
    window.dispatchEvent(new CustomEvent('big2-pwa-error', {
      detail: { ...lastPwaError, feature }
    }));
  } catch { /* older browser */ }
  return lastPwaError;
}

async function postWorkerMessage(worker, type, payload = {}, timeoutMs = 15000) {
  if (!worker) throw new Error('Service Worker 尚未就緒。');
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => reject(new Error(`${type} 逾時`)), timeoutMs);
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timer);
      resolve(event.data || {});
    };
    worker.postMessage({ type, ...payload }, [channel.port2]);
  });
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isSafari() {
  return /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(navigator.userAgent);
}

function setPwaStatus(text, state = 'ok') {
  const badge = byId('pwaStatusBadge');
  if (!badge) return;
  badge.textContent = text;
  badge.classList.toggle('ok', state === 'ok');
  badge.classList.toggle('warn', state === 'warn');
}

function setPwaActionStatus(text, state = 'neutral') {
  const status = byId('pwaActionStatus');
  if (!status) return;
  status.textContent = text;
  status.dataset.state = state;
}

function hideSplash() {
  const splash = byId('pwaSplash');
  if (!splash) return;
  splash.classList.add('is-hidden');
  window.setTimeout(() => splash.remove(), 500);
}

async function getWorkerVersion(worker) {
  try {
    const result = await postWorkerMessage(worker, 'GET_VERSION', {}, 1600);
    return result.version || null;
  } catch {
    return null;
  }
}

async function showUpdateBanner(worker) {
  pendingWorker = worker || pendingWorker;
  const version = await getWorkerVersion(pendingWorker);
  const text = byId('pwaUpdateText');
  if (text) {
    text.textContent = version
      ? `v${version} 已可使用，重新載入即可套用最新牌桌。`
      : '發現新版本，重新載入即可套用最新牌桌。';
  }
  byId('pwaUpdateBanner')?.classList.remove('hidden');
  setPwaStatus('有新版可更新', 'warn');
}

function hideUpdateBanner() {
  byId('pwaUpdateBanner')?.classList.add('hidden');
  if (navigator.onLine !== false) setPwaStatus(isStandalone() ? '已安裝' : 'PWA 就緒', 'ok');
}

function updateOfflineBanner() {
  const banner = byId('pwaOfflineBanner');
  if (!banner) return;
  const offline = navigator.onLine === false;
  banner.classList.toggle('hidden', !offline);
  document.body.dataset.offline = offline ? 'true' : 'false';
  if (offline) {
    setPwaStatus('目前離線', 'warn');
    setPwaActionStatus('多人房間暫停；恢復網路後會重新同步。', 'warn');
  } else {
    setPwaStatus(isStandalone() ? '已安裝' : 'PWA 就緒', 'ok');
    setPwaActionStatus('網路正常，離線資源與更新檢查可用。', 'ok');
  }
}

function showInstallHelp() {
  const panel = byId('pwaInstallHelp');
  const text = byId('pwaInstallHelpText');
  if (!panel || !text) return;
  const advanced = byId('advancedSupportPanel');
  if (advanced) {
    advanced.open = true;
    advanced.classList.add('force-visible');
  }
  if (isIOS()) {
    text.textContent = isSafari()
      ? 'iPhone / iPad：點 Safari 下方或上方的「分享」圖示，再選「加入主畫面」，最後按「新增」。'
      : 'iPhone / iPad 請改用 Safari 開啟本頁，點「分享」後選「加入主畫面」。';
  } else {
    text.textContent = 'Android / 電腦：使用 Chrome 或 Edge 開啟，按瀏覽器選單中的「安裝應用程式」或「加到主畫面」。';
  }
  panel.classList.remove('hidden');
  panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  localStorage.setItem(INSTALL_HELP_KEY, '1');
}

function updateInstallButton() {
  const button = byId('installAppBtn');
  if (!button) return;
  if (isStandalone()) {
    button.classList.add('hidden');
    setPwaStatus('已安裝', 'ok');
    document.body.dataset.displayMode = 'standalone';
    return;
  }
  document.body.dataset.displayMode = 'browser';
  if (deferredInstallPrompt) {
    button.textContent = '安裝遊戲';
    button.classList.remove('hidden');
    return;
  }
  if (isIOS()) {
    button.textContent = '加入主畫面';
    button.classList.remove('hidden');
    return;
  }
  button.classList.add('hidden');
}

async function installApp() {
  if (!deferredInstallPrompt) {
    showInstallHelp();
    return;
  }
  const prompt = deferredInstallPrompt;
  deferredInstallPrompt = null;
  await prompt.prompt();
  const choice = await prompt.userChoice.catch(() => null);
  if (choice?.outcome !== 'accepted') showInstallHelp();
  updateInstallButton();
}

async function shareGame() {
  const button = byId('shareGameBtn');
  const shareUrl = new URL('./', window.location.href).href;
  const data = {
    title: '台灣大老二 Big2 TW',
    text: '一起玩台灣大老二！支援單人 AI 與 Firebase 好友連線。',
    url: shareUrl
  };
  try {
    if (navigator.share) {
      await navigator.share(data);
    } else {
      await navigator.clipboard.writeText(`${data.text}\n${data.url}`);
      if (button) button.textContent = '連結已複製';
      window.setTimeout(() => { if (button) button.textContent = '分享遊戲'; }, 1800);
    }
  } catch (error) {
    if (error?.name !== 'AbortError') {
      try {
        await navigator.clipboard.writeText(data.url);
        if (button) button.textContent = '連結已複製';
        window.setTimeout(() => { if (button) button.textContent = '分享遊戲'; }, 1800);
      } catch {
        window.prompt('請複製遊戲連結：', data.url);
      }
    }
  }
}

function renderOnboardingStep(step) {
  const steps = [...document.querySelectorAll('.onboarding-step')];
  if (!steps.length) return;
  onboardingStep = Math.max(0, Math.min(steps.length - 1, step));
  steps.forEach((element, index) => element.classList.toggle('active', index === onboardingStep));
  document.querySelectorAll('.onboarding-progress span').forEach((element, index) => {
    element.classList.toggle('active', index <= onboardingStep);
  });
  const previous = byId('onboardingPrevBtn');
  const next = byId('onboardingNextBtn');
  if (previous) previous.disabled = onboardingStep === 0;
  if (next) next.textContent = onboardingStep === steps.length - 1 ? '開始遊戲' : '下一步';
  steps[onboardingStep]?.setAttribute('tabindex', '-1');
  steps[onboardingStep]?.focus({ preventScroll: true });
}

function hasCompletedOnboarding() {
  if (localStorage.getItem(ONBOARDING_KEY)) return true;
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index) || '';
    if (key.startsWith(LEGACY_ONBOARDING_PREFIX) && localStorage.getItem(key)) {
      localStorage.setItem(ONBOARDING_KEY, '1');
      return true;
    }
  }
  return false;
}

function openOnboarding() {
  const dialog = byId('onboardingDialog');
  if (!dialog) return;
  onboardingOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  renderOnboardingStep(0);
}

function closeOnboarding(remember = true) {
  const dialog = byId('onboardingDialog');
  if (!dialog) return;
  const rememberChecked = byId('onboardingRememberCheck')?.checked !== false;
  if (remember && rememberChecked) localStorage.setItem(ONBOARDING_KEY, '1');
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
  window.setTimeout(() => onboardingOpener?.focus?.(), 0);
}

function bindOnboarding() {
  byId('openOnboardingBtn')?.addEventListener('click', openOnboarding);
  byId('closeOnboardingBtn')?.addEventListener('click', () => closeOnboarding(false));
  byId('onboardingSkipBtn')?.addEventListener('click', () => closeOnboarding(true));
  byId('onboardingPrevBtn')?.addEventListener('click', () => renderOnboardingStep(onboardingStep - 1));
  byId('onboardingNextBtn')?.addEventListener('click', () => {
    const count = document.querySelectorAll('.onboarding-step').length;
    if (onboardingStep >= count - 1) closeOnboarding(true);
    else renderOnboardingStep(onboardingStep + 1);
  });
  byId('onboardingDialog')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeOnboarding(false);
  });
  byId('onboardingDialog')?.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeOnboarding(false);
  });
  const launchParams = new URL(window.location.href).searchParams;
  const isDirectLaunch = launchParams.has('room') || launchParams.get('join') === '1' || launchParams.has('action');
  if (!hasCompletedOnboarding() && !isDirectLaunch) {
    window.setTimeout(() => {
      if (document.body.dataset.gameplayFocus !== 'on') openOnboarding();
    }, 1050);
  }
}

function applyLaunchAction() {
  const url = new URL(window.location.href);
  const action = url.searchParams.get('action');
  if (!action) return;
  window.setTimeout(() => {
    if (action === 'single') byId('quickSingleBtn')?.click();
    if (action === 'join') {
      document.querySelector('.room-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      byId('roomCodeInput')?.focus();
    }
    url.searchParams.delete('action');
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, 700);
}

function syncThemeColor() {
  const themeColors = {
    dark: '#060b14', epaper: '#ffffff', ocean: '#062d46', eye: '#eef2df', twilight: '#19132e',
    sakura: '#fff1f5', forest: '#0c2b1e', grassland: '#eef5d8', night: '#050b1f', sunset: '#401a1b',
    starry: '#080b23', candy: '#fff2f8', neon: '#05050d'
  };
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', themeColors[document.body.dataset.theme] || '#060b14');
}

async function updateStorageStatus() {
  const status = byId('pwaStorageStatus');
  if (!status || !navigator.storage?.estimate) return;
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const usageMb = usage / 1024 / 1024;
    const quotaMb = quota / 1024 / 1024;
    status.textContent = quotaMb > 0
      ? `離線快取約 ${usageMb.toFixed(1)} MB／可用 ${Math.round(quotaMb)} MB`
      : `離線快取約 ${usageMb.toFixed(1)} MB`;
  } catch {
    status.textContent = '無法讀取瀏覽器快取容量。';
  }
}

async function checkForUpdates(manual = false) {
  if (!serviceWorkerRegistration) {
    if (manual) setPwaActionStatus('Service Worker 尚未就緒，請稍後再試。', 'warn');
    return;
  }
  if (navigator.onLine === false) {
    if (manual) setPwaActionStatus('目前離線，無法檢查更新。', 'warn');
    return;
  }
  if (manual) setPwaActionStatus('正在檢查新版…', 'neutral');
  try {
    await serviceWorkerRegistration.update();
    if (serviceWorkerRegistration.waiting) {
      await showUpdateBanner(serviceWorkerRegistration.waiting);
    } else if (manual) {
      setPwaActionStatus(`目前已是最新版本 v${APP_VERSION}。`, 'ok');
    }
  } catch (error) {
    capturePwaError(error, 'PWA 檢查更新');
    if (manual) setPwaActionStatus(`檢查更新失敗：${error?.message || error}`, 'warn');
  }
}

async function refreshOfflineFiles() {
  const button = byId('pwaRefreshCacheBtn');
  const worker = navigator.serviceWorker.controller || serviceWorkerRegistration?.active;
  if (!worker) {
    setPwaActionStatus('Service Worker 尚未控制此頁，請重新整理後再試。', 'warn');
    return { ok: false };
  }
  if (navigator.onLine === false) {
    setPwaActionStatus('目前離線，無法重新下載離線檔案。', 'warn');
    return { ok: false };
  }
  if (button) button.disabled = true;
  setPwaActionStatus('正在重新整理離線檔案…', 'neutral');
  try {
    const result = await postWorkerMessage(worker, 'REFRESH_APP_SHELL');
    if (!result.ok) throw new Error(result.message || '離線檔案更新失敗');
    setPwaActionStatus(`離線檔案已更新為 v${result.version || APP_VERSION}。`, 'ok');
    await updateStorageStatus();
    return result;
  } catch (error) {
    capturePwaError(error, '重新下載離線檔案');
    setPwaActionStatus(`離線檔案更新失敗：${error?.message || error}`, 'warn');
    return { ok: false, message: error?.message || String(error) };
  } finally {
    if (button) button.disabled = false;
  }
}

async function clearOldPwaCaches({ includeCurrent = false } = {}) {
  if (!('caches' in window)) return { ok: false, deleted: [], message: '瀏覽器不支援 Cache Storage。' };
  const worker = navigator.serviceWorker?.controller || serviceWorkerRegistration?.active;
  if (!includeCurrent && worker) {
    const result = await postWorkerMessage(worker, 'CLEAR_OLD_CACHES', {}, 8000);
    await updateStorageStatus();
    await updateRollbackStatus();
    return result;
  }
  const keys = await caches.keys();
  const targets = keys.filter((key) => key.startsWith(APP_CACHE_PREFIX)
    && key !== `${APP_CACHE_PREFIX}meta`
    && (includeCurrent || !key.includes(`v${APP_VERSION}`)));
  const results = await Promise.all(targets.map(async (key) => ({ key, deleted: await caches.delete(key) })));
  const deleted = results.filter((item) => item.deleted).map((item) => item.key);
  await updateStorageStatus();
  await updateRollbackStatus();
  return { ok: true, deleted, checked: targets.length };
}

async function applyAvailableUpdate() {
  const button = byId('pwaApplyUpdateBtn');
  if (button) button.disabled = true;
  setPwaActionStatus('正在確認可套用的新版…', 'neutral');
  try {
    await serviceWorkerRegistration?.update();
    const worker = serviceWorkerRegistration?.waiting || pendingWorker;
    if (worker) {
      controllerReloadRequested = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
      setPwaActionStatus('正在套用新版並重新載入…', 'ok');
      return;
    }
    setPwaActionStatus(`目前已是最新版本 v${APP_VERSION}，正在重新載入。`, 'ok');
    window.setTimeout(() => window.location.reload(), 350);
  } catch (error) {
    capturePwaError(error, '套用 PWA 新版');
    setPwaActionStatus(`套用新版失敗：${error?.message || error}`, 'warn');
    if (button) button.disabled = false;
  }
}

async function repairPwa() {
  if (repairInProgress) return;
  const button = byId('pwaRepairBtn');
  repairInProgress = true;
  if (button) button.disabled = true;
  setPwaActionStatus('正在一鍵修復：檢查新版、清除舊快取並重建離線檔案…', 'neutral');
  try {
    if (navigator.onLine === false) throw new Error('目前離線，請恢復網路後再執行一鍵修復。');
    if (!serviceWorkerRegistration) throw new Error('Service Worker 尚未就緒，請重新整理後再試。');
    await serviceWorkerRegistration.update();
    if (serviceWorkerRegistration.waiting) {
      controllerReloadRequested = true;
      serviceWorkerRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      setPwaActionStatus('已找到新版，正在切換並重新載入…', 'ok');
      return;
    }
    const worker = navigator.serviceWorker.controller || serviceWorkerRegistration.active;
    const result = await postWorkerMessage(worker, 'REPAIR_PWA', {}, 22000);
    if (!result.ok) throw new Error(result.message || 'PWA 修復失敗');
    await updateStorageStatus();
    setPwaActionStatus(`PWA 已修復並重建為 v${result.version || APP_VERSION}，即將重新載入。`, 'ok');
    window.setTimeout(() => window.location.reload(), 700);
  } catch (error) {
    capturePwaError(error, 'PWA 一鍵修復');
    setPwaActionStatus(`一鍵修復失敗：${error?.message || error}`, 'warn');
    repairInProgress = false;
    if (button) button.disabled = false;
  }
}

async function getRollbackState() {
  const worker = navigator.serviceWorker?.controller || serviceWorkerRegistration?.active;
  if (!worker) return { ok: false, message: 'Service Worker 尚未就緒。' };
  return postWorkerMessage(worker, 'GET_ROLLBACK_STATE', {}, 5000);
}

async function rollbackToPreviousVersion() {
  const button = byId('pwaRollbackBtn');
  if (button) button.disabled = true;
  setPwaActionStatus('正在尋找上一版離線快取…', 'neutral');
  try {
    const worker = navigator.serviceWorker?.controller || serviceWorkerRegistration?.active;
    const result = await postWorkerMessage(worker, 'ROLLBACK_TO_PREVIOUS', {}, 8000);
    if (!result.ok) throw new Error(result.message || '無法回復上一版');
    setPwaActionStatus(`已切換至上一版 v${result.version || '未知'}，正在重新載入。`, 'warn');
    window.setTimeout(() => window.location.reload(), 500);
  } catch (error) {
    capturePwaError(error, 'PWA 回復上一版');
    setPwaActionStatus(`回復失敗：${error?.message || error}`, 'warn');
    if (button) button.disabled = false;
  }
}

async function restoreCurrentVersion() {
  const button = byId('pwaRestoreCurrentBtn');
  if (button) button.disabled = true;
  setPwaActionStatus('正在恢復目前正式版本…', 'neutral');
  try {
    const worker = navigator.serviceWorker?.controller || serviceWorkerRegistration?.active;
    const result = await postWorkerMessage(worker, 'RESTORE_CURRENT_VERSION', {}, 12000);
    if (!result.ok) throw new Error(result.message || '無法恢復目前版本');
    setPwaActionStatus(`已恢復 v${result.version || APP_VERSION}，正在重新載入。`, 'ok');
    window.setTimeout(() => window.location.reload(), 500);
  } catch (error) {
    capturePwaError(error, 'PWA 恢復目前版本');
    setPwaActionStatus(`恢復失敗：${error?.message || error}`, 'warn');
    if (button) button.disabled = false;
  }
}

async function updateRollbackStatus() {
  const node = byId('pwaRollbackStatus');
  if (!node) return;
  try {
    const state = await getRollbackState();
    if (!state.ok) throw new Error(state.message || '無法讀取回復狀態');
    node.textContent = state.rollbackActive
      ? `目前使用回復快取 v${state.activeVersion}；可按「恢復最新版」。`
      : state.previousVersion
        ? `可回復上一版 v${state.previousVersion}；回復只影響此裝置的 PWA 快取。`
        : '這台裝置尚無可回復的上一版快取。';
    byId('pwaRollbackBtn')?.toggleAttribute('disabled', !state.previousVersion || state.rollbackActive);
    byId('pwaRestoreCurrentBtn')?.toggleAttribute('disabled', !state.rollbackActive);
  } catch (error) {
    node.textContent = `回復狀態讀取失敗：${error?.message || error}`;
  }
}

async function getPwaDiagnostics() {
  const registrations = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistrations().catch(() => []) : [];
  const cacheNames = 'caches' in window ? await caches.keys().catch(() => []) : [];
  const cacheDetails = [];
  for (const name of cacheNames.filter((item) => item.startsWith(APP_CACHE_PREFIX))) {
    try {
      const cache = await caches.open(name);
      const requests = await cache.keys();
      cacheDetails.push({ name, entries: requests.length });
    } catch (error) {
      cacheDetails.push({ name, error: error?.message || String(error) });
    }
  }
  const estimate = navigator.storage?.estimate ? await navigator.storage.estimate().catch(() => null) : null;
  const controller = navigator.serviceWorker?.controller || null;
  const controllerVersion = await getWorkerVersion(controller);
  const rollback = await getRollbackState().catch(() => null);
  return {
    appVersion: APP_VERSION,
    rollback,
    displayMode: isStandalone() ? 'standalone' : 'browser',
    online: navigator.onLine !== false,
    secureContext: window.isSecureContext,
    serviceWorkerSupported: 'serviceWorker' in navigator,
    controller: controller ? { scriptURL: controller.scriptURL, state: controller.state, version: controllerVersion } : null,
    currentRegistration: serviceWorkerRegistration ? {
      scope: serviceWorkerRegistration.scope,
      active: serviceWorkerRegistration.active?.state || null,
      waiting: serviceWorkerRegistration.waiting?.state || null,
      installing: serviceWorkerRegistration.installing?.state || null
    } : null,
    registrationScopes: registrations.map((item) => item.scope),
    caches: cacheDetails,
    storage: estimate ? { usage: estimate.usage || 0, quota: estimate.quota || 0 } : null,
    viewport: {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      visualWidth: window.visualViewport?.width || null,
      visualHeight: window.visualViewport?.height || null,
      devicePixelRatio: window.devicePixelRatio || 1
    },
    screen: { width: screen.width, height: screen.height, orientation: screen.orientation?.type || null },
    language: navigator.language,
    platform: navigator.userAgentData?.platform || navigator.platform || null,
    userAgent: navigator.userAgent,
    lastPwaError
  };
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    setPwaStatus('瀏覽器不支援 PWA', 'warn');
    return;
  }
  if (!window.isSecureContext && location.hostname !== 'localhost') {
    setPwaStatus('需要 HTTPS', 'warn');
    return;
  }
  try {
    const registration = await navigator.serviceWorker.register('./service-worker.js', {
      scope: './',
      updateViaCache: 'none'
    });
    serviceWorkerRegistration = registration;
    if (registration.waiting && navigator.serviceWorker.controller) await showUpdateBanner(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(worker);
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!controllerReloadRequested) return;
      controllerReloadRequested = false;
      window.location.reload();
    });
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'CACHE_READY') {
        setPwaActionStatus(`離線資源已就緒（v${event.data.version || APP_VERSION}）。`, 'ok');
        updateStorageStatus();
        updateRollbackStatus();
      }
    });
    window.setTimeout(() => checkForUpdates(false), 5000);
    window.clearInterval(updateCheckTimer);
    updateCheckTimer = window.setInterval(() => checkForUpdates(false), UPDATE_CHECK_INTERVAL_MS);
    setPwaStatus(isStandalone() ? '已安裝' : 'PWA 就緒', 'ok');
    setPwaActionStatus(`Service Worker v${APP_VERSION} 已就緒。`, 'ok');
    await updateStorageStatus();
    await updateRollbackStatus();
  } catch (error) {
    capturePwaError(error, 'Service Worker 註冊');
    console.warn('PWA 註冊失敗', error);
    setPwaStatus('PWA 快取失敗', 'warn');
    setPwaActionStatus(`Service Worker 註冊失敗：${error?.message || error}`, 'warn');
  }
}

function bindPwaEvents() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallButton();
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    updateInstallButton();
    setPwaStatus('安裝完成', 'ok');
    setPwaActionStatus('遊戲已安裝到裝置。', 'ok');
  });
  window.addEventListener('online', () => {
    updateOfflineBanner();
    checkForUpdates(false);
  });
  window.addEventListener('offline', updateOfflineBanner);
  window.addEventListener('pageshow', () => {
    updateInstallButton();
    updateOfflineBanner();
    if (navigator.onLine !== false) checkForUpdates(false);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine !== false) checkForUpdates(false);
  });
  const displayMode = window.matchMedia('(display-mode: standalone)');
  if (typeof displayMode.addEventListener === 'function') displayMode.addEventListener('change', updateInstallButton);
  else displayMode.addListener?.(updateInstallButton);
  byId('installAppBtn')?.addEventListener('click', installApp);
  byId('shareGameBtn')?.addEventListener('click', shareGame);
  byId('pwaCheckUpdateBtn')?.addEventListener('click', () => checkForUpdates(true));
  byId('pwaApplyUpdateBtn')?.addEventListener('click', applyAvailableUpdate);
  byId('pwaRefreshCacheBtn')?.addEventListener('click', refreshOfflineFiles);
  byId('pwaClearCachesBtn')?.addEventListener('click', async () => {
    const result = await clearOldPwaCaches();
    setPwaActionStatus(result.deleted?.length
      ? `已清除 ${result.deleted.length} 組舊版快取。`
      : '未發現需要清除的舊版快取。', 'ok');
  });
  byId('pwaRepairBtn')?.addEventListener('click', repairPwa);
  byId('pwaReloadBtn')?.addEventListener('click', () => window.location.reload());
  byId('pwaRollbackBtn')?.addEventListener('click', rollbackToPreviousVersion);
  byId('pwaRestoreCurrentBtn')?.addEventListener('click', restoreCurrentVersion);
  byId('closeInstallHelpBtn')?.addEventListener('click', () => {
    byId('pwaInstallHelp')?.classList.add('hidden');
    byId('advancedSupportPanel')?.classList.remove('force-visible');
  });
  byId('pwaUpdateBtn')?.addEventListener('click', () => {
    controllerReloadRequested = true;
    if (pendingWorker) pendingWorker.postMessage({ type: 'SKIP_WAITING' });
    else window.location.reload();
  });
  byId('pwaUpdateLaterBtn')?.addEventListener('click', hideUpdateBanner);

  const themeObserver = new MutationObserver(syncThemeColor);
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
}

window.big2PwaApi = Object.freeze({
  version: APP_VERSION,
  getDiagnostics: getPwaDiagnostics,
  repair: repairPwa,
  clearOldCaches: clearOldPwaCaches,
  checkForUpdates,
  refreshOfflineFiles,
  getRollbackState,
  rollbackToPreviousVersion,
  restoreCurrentVersion
});

function init() {
  document.querySelectorAll('[data-app-version]').forEach((node) => { node.textContent = APP_VERSION; });
  bindPwaEvents();
  bindOnboarding();
  updateInstallButton();
  updateOfflineBanner();
  syncThemeColor();
  applyLaunchAction();
  registerServiceWorker();
  const loadedAt = performance.now();
  window.addEventListener('load', () => {
    const remaining = Math.max(0, 650 - (performance.now() - loadedAt));
    window.setTimeout(hideSplash, remaining);
  }, { once: true });
  window.setTimeout(hideSplash, 2800);
}

init();
