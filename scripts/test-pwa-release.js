import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  '.nojekyll',
  'manifest.webmanifest',
  'service-worker.js',
  'offline.html',
  'privacy.html',
  'robots.txt',
  'sitemap.xml',
  'src/pwa.js',
  'docs/PWA_RELEASE_CHECKLIST.md',
  'docs/PRIVACY_AND_DATA.md',
  'docs/PWA_ONLINE_VERIFICATION.md',
  'assets/icons/favicon.svg',
  'assets/icons/favicon-32.png',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/social/og-big2.png',
  'assets/splash/splash-portrait.png',
  'assets/splash/splash-landscape.png'
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`PWA 缺少檔案：${file}`);
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
if (manifest.name !== '台灣大老二 Big2 TW') throw new Error('manifest 名稱不正確');
if (manifest.start_url !== './?source=pwa') throw new Error('manifest start_url 必須使用 GitHub Pages 相對路徑');
if (manifest.scope !== './') throw new Error('manifest scope 必須使用 GitHub Pages 相對路徑');
if (manifest.display !== 'standalone') throw new Error('manifest display 應為 standalone');
if (!manifest.launch_handler?.client_mode?.includes('navigate-existing')) throw new Error('manifest 缺少重用既有 PWA 視窗設定');
if (!Array.isArray(manifest.icons) || manifest.icons.length < 3) throw new Error('manifest 圖示不足');
if (!manifest.icons.some((icon) => String(icon.purpose).includes('maskable'))) throw new Error('manifest 缺少 maskable icon');

function pngSize(file) {
  const data = fs.readFileSync(path.join(root, file));
  const signature = data.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') throw new Error(`${file} 不是 PNG`);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

for (const [file, width, height] of [
  ['assets/icons/icon-192.png', 192, 192],
  ['assets/icons/icon-512.png', 512, 512],
  ['assets/icons/icon-maskable-512.png', 512, 512],
  ['assets/icons/apple-touch-icon.png', 180, 180],
  ['assets/social/og-big2.png', 1200, 630]
]) {
  const size = pngSize(file);
  if (size.width !== width || size.height !== height) {
    throw new Error(`${file} 尺寸錯誤：${size.width}x${size.height}`);
  }
}

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const token of [
  'manifest.webmanifest?v=0.8.1',
  'src/pwa.js?v=0.8.1',
  'installAppBtn',
  'pwaUpdateBanner',
  'pwaOfflineBanner',
  'pwaCheckUpdateBtn',
  'pwaRefreshCacheBtn',
  'onboardingDialog',
  'openOnboardingBtn',
  'shareGameBtn',
  'class="skip-link"',
  'id="mainContent"',
  'https://fox520-sketch.github.io/big2/',
  'og:image:type',
  'og-big2.png',
  'privacy.html'
]) {
  if (!index.includes(token)) throw new Error(`index.html 缺少 PWA／SEO／無障礙標記：${token}`);
}

const pwa = fs.readFileSync(path.join(root, 'src/pwa.js'), 'utf8');
for (const token of [
  'beforeinstallprompt',
  'navigator.share',
  'serviceWorker.register',
  "updateViaCache: 'none'",
  'SKIP_WAITING',
  'REFRESH_APP_SHELL',
  'showInstallHelp',
  'openOnboarding',
  'controllerchange',
  'checkForUpdates',
  'navigator.storage?.estimate'
]) {
  if (!pwa.includes(token)) throw new Error(`src/pwa.js 缺少功能：${token}`);
}

const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
for (const token of [
  "APP_VERSION = '0.8.1'",
  'self.registration.scope',
  'APP_SHELL_PATHS',
  "self.addEventListener('install'",
  "self.addEventListener('fetch'",
  'navigationNetworkFirst',
  'networkFirstAsset',
  'REFRESH_APP_SHELL',
  'SKIP_WAITING',
  'navigationPreload'
]) {
  if (!sw.includes(token)) throw new Error(`service-worker.js 缺少功能：${token}`);
}
if (sw.includes('ignoreSearch: true')) throw new Error('Service Worker 不可再忽略版本 query，否則可能混用新舊 JS/CSS');
if (sw.includes("cache.put('./index.html'")) throw new Error('Service Worker 不可把所有導覽頁覆寫成 index.html');

for (const forbidden of ['functions', 'firebase.json', '.firebaserc']) {
  if (fs.existsSync(path.join(root, forbidden))) throw new Error(`免 Cloud Functions 版不應包含：${forbidden}`);
}

console.log('PWA release tests passed.');
