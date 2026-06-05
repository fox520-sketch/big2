# 台灣大老二 Big2 TW v0.8.0

台灣大老二網頁遊戲，支援單人與 3 家 AI 對戰、Firebase 好友房間、AI 難度 1～20 級、13 種主題、連續對戰、排行榜、手機牌桌與 PWA 安裝。

本版維持 **免 Cloud Functions、不需要 Blaze** 的 GitHub Pages + Firebase 休閒版架構。

## v0.8.0 PWA 正式公開版

- 可安裝到 Android、電腦桌面；iPhone / iPad 可透過 Safari「加入主畫面」。
- 以獨立視窗開啟，減少手機瀏覽器網址列占用。
- 新增 `manifest.webmanifest` 與 `service-worker.js`。
- 快取首頁、規則引擎、AI、牌面、主題與必要資源；離線時仍可開啟單人模式。
- 多人房間、建立房間、加入房間與同步出牌仍需要網路。
- 發現新版本時顯示更新提示，由玩家確認後重新載入，不會在牌局中強制更新。
- 新增 PWA App 圖示、maskable icon、Apple Touch Icon、favicon 與啟動畫面。
- 新增 Open Graph 分享預覽、Twitter Card、canonical URL、`robots.txt` 與 `sitemap.xml`。
- 新增四步驟首次使用導覽，可略過、不再自動顯示或從右上角重新觀看。
- 新增原生分享按鈕；不支援原生分享的瀏覽器會改為複製遊戲連結。
- 新增 `privacy.html` 與正式發布文件。

## 核心功能

- 台灣大老二規則引擎。
- 單人模式：玩家 + 3 家 AI。
- AI 難度 1～20 級。
- 台灣常用梅花 3 起手、方塊 3 變體、A2345 與順子含 2 變體。
- 標準、8 張雙倍、10 張雙倍、8 張雙倍 10 張三倍計分。
- 13 種主題與 UI 對比檢查。
- 手牌排序、出牌提示、推薦出牌、最小可出、Pass 提醒。
- 手機牌桌、橫向滑牌、安全區與動態視窗高度。
- 音效、動畫、排行榜、成就、每日戰績與遊戲紀錄。
- Firebase 匿名登入、建立房間、加入房間、房間密碼、邀請連結與 QR Code。
- 不足人數由 AI 補位。
- 多人同步洗牌、發牌、出牌、Pass、回合、下一局與累計總分。
- 玩家離線由 AI 接管；房主離線可轉移房主。
- 房主可踢除玩家、調整座位與清理自己建立的過期房間。

## PWA 安裝方式

### Android / Windows / macOS

1. 使用 Chrome 或 Edge 開啟遊戲。
2. 等待右上角出現「安裝遊戲」，或從瀏覽器選單選擇「安裝應用程式／加到主畫面」。
3. 安裝完成後，可從桌面圖示開啟。

### iPhone / iPad

1. 使用 Safari 開啟遊戲。
2. 點「分享」。
3. 選「加入主畫面」。
4. 點「新增」。

## 離線與更新

- 第一次完整開啟後，Service Worker 會快取單人遊戲所需資源。
- 離線時可開啟首頁與單人模式；Firebase 多人功能需恢復網路。
- 發現新版時會顯示「立即更新／稍後」。牌局中可先選稍後，結束後再更新。
- 若 GitHub Pages 上傳後仍看到舊版，可在更新提示按「立即更新」，或清除該網站快取後重開。

## Firebase 設定

請看：

```txt
docs/FIREBASE_SETUP.md
```

上傳新版前，請保留你已填好的：

```txt
src/firebase-config.js
```

不要用壓縮檔內的 `PASTE_...` 範例覆蓋已設定完成的 Firebase Config。

本版沒有新增 Firestore 欄位。若 v0.7.5 多人房間已正常運作，通常不需要重新發布 `firestore.rules`；首次設定或權限異常時，再依文件貼上本版規則。

## GitHub Pages 上傳

請把壓縮檔解開後，將**資料夾裡面的內容**上傳到 repository 根目錄：

```txt
.nojekyll
index.html
manifest.webmanifest
service-worker.js
offline.html
privacy.html
robots.txt
sitemap.xml
assets/
src/
styles/
docs/
scripts/
firestore.rules
package.json
README.md
VERSION.md
```

不要多包一層：

```txt
big2/big2-tw-v0.8.0/index.html   ← 錯誤
big2/index.html                  ← 正確
```

## 不要上傳

```txt
functions/
node_modules/
.env
.env.local
serviceAccountKey.json
firebase-adminsdk.json
任何私鑰或管理員金鑰
```

## 文件

- PWA 正式發布：`docs/PWA_RELEASE_CHECKLIST.md`
- 隱私與資料使用：`docs/PRIVACY_AND_DATA.md`
- Firebase 設定：`docs/FIREBASE_SETUP.md`
- 規則與計分：`docs/RULES_AND_SCORING.md`
- 手機與效能：`docs/MOBILE_PERFORMANCE_CHECKLIST.md`
- 實機測試：`docs/REAL_DEVICE_TEST_CHECKLIST.md`
- 發布檢查：`docs/RELEASE_CHECKLIST.md`
- UI 對比：`docs/UI_CONTRAST_CHECKLIST.md`

## 測試

```bash
npm test
```

測試包含規則、AI、多人狀態、計分、主題對比、手機 UI、線上準備、效能穩定，以及 PWA manifest、圖示、Service Worker、SEO 與發布檔案完整性。
