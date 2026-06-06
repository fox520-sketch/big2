import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const index = read('index.html');
const css = read('styles/base.css');
const pwa = read('src/pwa.js');
const main = read('src/main.js');
const room = read('src/firebase-room.js');
const sw = read('service-worker.js');
const manifest = JSON.parse(read('manifest.webmanifest'));

for (const token of [
  'rel="preconnect" href="https://www.gstatic.com"',
  'og:image:secure_url',
  'og:image:type',
  'class="skip-link" href="#mainContent"',
  'id="mainContent"',
  'pwaActionStatus',
  'pwaStorageStatus'
]) {
  if (!index.includes(token)) throw new Error(`上線驗證缺少 index 標記：${token}`);
}

for (const token of [
  '.skip-link',
  'prefers-contrast: more',
  'forced-colors: active',
  '-webkit-text-size-adjust: 100%',
  "body[data-keyboard='open']",
  '.pwa-health-actions'
]) {
  if (!css.includes(token)) throw new Error(`上線驗證缺少 CSS：${token}`);
}

for (const token of [
  'UPDATE_CHECK_INTERVAL_MS',
  "ONBOARDING_KEY = 'big2-onboarding-complete-v1'",
  'updateViaCache',
  'checkForUpdates',
  'refreshOfflineFiles',
  'pageshow',
  'visibilitychange'
]) {
  if (!pwa.includes(token)) throw new Error(`PWA 更新流程缺少：${token}`);
}

for (const token of [
  "document.body.dataset.keyboard = keyboardOpen ? 'open' : 'closed'",
  "window.addEventListener('pageshow'",
  'refreshActiveRoomConnection'
]) {
  if (!main.includes(token)) throw new Error(`手機／重連流程缺少：${token}`);
}

for (const token of [
  'sdkPromise = null',
  'sdk.firestore.enableNetwork(db)',
  'lastListenError',
  'await listenRoom(roomId, roomCallback, errorCallback)'
]) {
  if (!room.includes(token)) throw new Error(`Firebase 斷線恢復缺少：${token}`);
}

for (const token of [
  'self.registration.scope',
  'normalizedRequest',
  "request.destination === 'script'",
  'networkFirstAsset',
  'navigationPreload',
  'cache: \'no-store\''
]) {
  if (!sw.includes(token)) throw new Error(`Service Worker 路徑或更新策略缺少：${token}`);
}

if (manifest.scope !== './' || manifest.start_url !== './?source=pwa') {
  throw new Error('manifest GitHub Pages 相對路徑不正確');
}
if (!manifest.launch_handler) throw new Error('manifest 缺少 launch_handler');

console.log('PWA online verification tests passed.');
