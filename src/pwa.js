const APP_VERSION = '0.8.0';
const ONBOARDING_KEY = `big2-onboarding-${APP_VERSION}`;
const INSTALL_HELP_KEY = 'big2-install-help-seen';

let deferredInstallPrompt = null;
let pendingWorker = null;
let onboardingStep = 0;
let controllerReloadRequested = false;

function byId(id) {
  return document.getElementById(id);
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

function hideSplash() {
  const splash = byId('pwaSplash');
  if (!splash) return;
  splash.classList.add('is-hidden');
  window.setTimeout(() => splash.remove(), 500);
}

function showUpdateBanner(worker) {
  pendingWorker = worker || pendingWorker;
  byId('pwaUpdateBanner')?.classList.remove('hidden');
}

function hideUpdateBanner() {
  byId('pwaUpdateBanner')?.classList.add('hidden');
}

function updateOfflineBanner() {
  const banner = byId('pwaOfflineBanner');
  if (!banner) return;
  const offline = navigator.onLine === false;
  banner.classList.toggle('hidden', !offline);
  document.body.dataset.offline = offline ? 'true' : 'false';
  if (offline) setPwaStatus('目前離線', 'warn');
  else if (isStandalone()) setPwaStatus('已安裝', 'ok');
  else setPwaStatus('PWA 就緒', 'ok');
}

function showInstallHelp() {
  const panel = byId('pwaInstallHelp');
  const text = byId('pwaInstallHelpText');
  if (!panel || !text) return;
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
}

function openOnboarding() {
  const dialog = byId('onboardingDialog');
  if (!dialog) return;
  renderOnboardingStep(0);
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function closeOnboarding(remember = true) {
  const dialog = byId('onboardingDialog');
  if (!dialog) return;
  const rememberChecked = byId('onboardingRememberCheck')?.checked !== false;
  if (remember && rememberChecked) localStorage.setItem(ONBOARDING_KEY, '1');
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
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
  const launchParams = new URL(window.location.href).searchParams;
  const isDirectLaunch = launchParams.has('room') || launchParams.get('join') === '1' || launchParams.has('action');
  if (!localStorage.getItem(ONBOARDING_KEY) && !isDirectLaunch) {
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
    const registration = await navigator.serviceWorker.register('./service-worker.js', { scope: './' });
    if (registration.waiting && navigator.serviceWorker.controller) showUpdateBanner(registration.waiting);
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
    window.setTimeout(() => registration.update().catch(() => {}), 5000);
    setPwaStatus(isStandalone() ? '已安裝' : 'PWA 就緒', 'ok');
  } catch (error) {
    console.warn('PWA 註冊失敗', error);
    setPwaStatus('PWA 快取失敗', 'warn');
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
  });
  window.addEventListener('online', updateOfflineBanner);
  window.addEventListener('offline', updateOfflineBanner);
  window.matchMedia('(display-mode: standalone)').addEventListener?.('change', updateInstallButton);
  byId('installAppBtn')?.addEventListener('click', installApp);
  byId('shareGameBtn')?.addEventListener('click', shareGame);
  byId('closeInstallHelpBtn')?.addEventListener('click', () => byId('pwaInstallHelp')?.classList.add('hidden'));
  byId('pwaUpdateBtn')?.addEventListener('click', () => {
    controllerReloadRequested = true;
    pendingWorker?.postMessage({ type: 'SKIP_WAITING' });
  });
  byId('pwaUpdateLaterBtn')?.addEventListener('click', hideUpdateBanner);

  const themeObserver = new MutationObserver(syncThemeColor);
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
}

function init() {
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
