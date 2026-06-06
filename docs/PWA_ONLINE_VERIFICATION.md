# v0.8.1 PWA 正式上線驗證與修正清單

本版維持 GitHub Pages + Firebase Auth + Cloud Firestore 的免 Cloud Functions 架構，不需要 Blaze。

## 一、GitHub Pages 路徑

- `manifest.webmanifest` 的 `start_url` 與 `scope` 必須維持相對路徑。
- Service Worker 使用 `self.registration.scope` 組合快取網址，可部署在 `https://帳號.github.io/big2/` 子目錄。
- repository 根目錄必須直接看到 `index.html`、`service-worker.js`、`manifest.webmanifest`、`assets/`、`src/`。
- 不要再多包一層 `big2-tw-v0.8.1/`。

## 二、安裝驗證

### Android Chrome / Edge

1. 以 HTTPS 的 GitHub Pages 網址開啟。
2. 等候「安裝遊戲」按鈕或使用瀏覽器選單安裝。
3. 從桌面圖示開啟，確認沒有一般瀏覽器網址列。
4. 再點相同遊戲連結，應優先回到既有 PWA 視窗。

### iPhone / iPad

1. 使用 Safari 開啟。
2. 點分享 → 加入主畫面。
3. 從主畫面圖示開啟。
4. 檢查瀏海、底部 Home Indicator 與橫向模式安全區。

### Windows / macOS

1. 使用 Chrome 或 Edge 開啟。
2. 從網址列或選單安裝。
3. 確認開始功能表／應用程式列表可啟動。

## 三、Service Worker 與更新

- 首頁導覽採網路優先，離線時才讀快取。
- JavaScript、CSS、manifest 採網路優先，不忽略版本 query，避免新首頁搭配舊程式。
- `privacy.html` 與其他導覽頁會使用自己的快取鍵，不會覆蓋首頁快取。
- 按「檢查更新」應顯示最新狀態。
- 按「更新離線檔案」應重新下載目前版本 App Shell。
- 發現新版後按「立即更新」，Service Worker 才執行 `skipWaiting` 並重新載入。
- 牌局進行中可按「稍後」，避免被強制重新整理。

## 四、離線驗證

1. 在線時完整開啟一次首頁與單人模式。
2. 關閉網路後重新開啟 PWA。
3. 確認首頁、圖示、CSS、AI 與單人遊戲可載入。
4. 多人房間操作應顯示離線提醒，不能誤顯示送出成功。
5. 恢復網路後，應重新啟用 Firebase 網路並恢復房間心跳。

## 五、Firebase 多人實戰

至少測試：

- 2 位真人 + 2 位 AI。
- 3 位真人 + 1 位 AI。
- 4 位真人。
- 連續玩 3 局，確認總分、勝場、座位與玩家名稱保留。
- 玩家鎖定螢幕、切換 App、短暫斷線後回來。
- 房主離線後轉移房主。
- 同一玩家重開頁面後取回原座位。
- SDK 首次載入失敗後，恢復網路可重新載入，不會被 rejected Promise 永久卡住。
- Firestore listener 因錯誤停止後，按重新連線可重新掛上監聽。

> 自動測試只能檢查程式結構與狀態邏輯；不同裝置、瀏覽器與真實 Firebase 專案仍需實機驗證。

## 六、手機 UI

測試寬度：320、360、390、430、768、1024 px。

- 選中牌上緣與勾勾不被裁切。
- 最右側手牌可完整滑入畫面。
- 手機鍵盤開啟時，暫時隱藏非必要提示，房號、密碼與暱稱欄位仍可見。
- 直向模式操作區不覆蓋牌面。
- 橫向短螢幕操作區可捲動。
- 網址列展開／收合不造成嚴重跳動。
- 文字放大 200% 時主要按鈕、房號與牌局資訊仍可操作。

## 七、分享與 SEO

- canonical：`https://fox520-sketch.github.io/big2/`
- Open Graph 圖片：1200×630 PNG，公開可讀。
- `og:image:secure_url` 與 `og:image:type` 已設定。
- `robots.txt` 指向正確 sitemap。
- `privacy.html` 可公開開啟。

## 八、無障礙

- Tab 第一個焦點應出現「跳至主要內容」。
- 按 Enter 可直接聚焦主要內容。
- 所有主要按鈕具有清楚焦點框。
- 狀態列使用 live region，但不應反覆朗讀純心跳更新。
- 系統開啟「減少動態效果」時，導覽、啟動畫面與牌面動畫應降低。
- 高對比／強制色彩模式下，選牌框、按鈕及輸入欄仍可辨識。

## 九、不要上傳

- `functions/`
- `node_modules/`
- `.env`、`.env.local`
- Firebase Admin SDK 金鑰
- Service Account JSON
