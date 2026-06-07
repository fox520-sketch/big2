# v1.0.1 PWA 正式發布檢查清單

## 必須上傳到 repository 根目錄

- `.nojekyll`
- `index.html`
- `manifest.webmanifest`
- `service-worker.js`
- `offline.html`
- `privacy.html`
- `robots.txt`
- `sitemap.xml`
- `assets/`
- `src/`
- `styles/`
- `docs/`
- `scripts/`
- `firestore.rules`
- `package.json`
- `README.md`
- `VERSION.md`

不要把整個 `big2-tw-v1.0.1` 資料夾再包在 repository 裡。

## Firebase

- 保留已設定好的 `src/firebase-config.js`，不要被 `PASTE_...` 範例覆蓋。
- Authentication 必須啟用 Anonymous。
- 首次部署或權限錯誤時，把本版 `firestore.rules` 貼到 Firestore Rules 並 Publish。
- v1.0.1 沒有新增 Firestore 欄位；v0.7.5 之後多人正常時通常不用重貼 Rules。
- 不使用 Cloud Functions，不需要 Blaze。

## PWA

- GitHub Pages 必須使用 HTTPS。
- `manifest.webmanifest` 與 `service-worker.js` 必須可直接開啟，不能回傳 404 HTML。
- Service Worker scope 應為 `/big2/`。
- Android／桌機測試安裝；iPhone 使用 Safari 加入主畫面。
- 發布新版後按「檢查更新」，再按更新提示的「立即更新」。
- 若仍是舊版，可按「更新離線檔案」或從瀏覽器網站設定清除快取。

## 分享與 SEO

- canonical、Open Graph 與 sitemap 使用正式網址 `https://fox520-sketch.github.io/big2/`。
- `assets/social/og-big2.png` 必須可公開讀取。
- `privacy.html`、`robots.txt`、`sitemap.xml` 均須正常開啟。

## 實機與無障礙

依 `docs/PWA_ONLINE_VERIFICATION.md` 完成：

- Android、iPhone、平板、桌機 UI。
- 安裝、離線、更新。
- 2～4 位真人多人實戰、AI 補位、斷線重連與下一局。
- 鍵盤焦點、跳至主要內容、減少動態效果、200% 文字縮放與高對比。

## 不要上傳

- `functions/`
- `node_modules/`
- `.env`、`.env.local`
- `serviceAccountKey.json`
- `firebase-adminsdk*.json`
- 任何私鑰、管理員憑證或其他服務密碼
