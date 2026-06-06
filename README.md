# 台灣大老二 Big2 TW v0.8.2

台灣大老二網頁遊戲，支援單人與 3 家 AI 對戰、Firebase 好友房間、AI 難度 1～20 級、13 種主題、連續對戰、排行榜、手機牌桌與 PWA 安裝。

本版維持 **免 Cloud Functions、不需要 Blaze** 的 GitHub Pages + Firebase 休閒版架構。

## v0.8.2 正式上線驗收與問題回報修正版

- 新增「一鍵修復 PWA」：檢查新版、清除 Big2 舊快取、重建離線檔案並重新載入。
- 新增「立即套用新版」、「清除舊版快取」與「重新載入遊戲」獨立工具。
- 問題回報可複製或下載診斷文字檔，包含裝置、PWA、Service Worker、快取、Firebase listener／心跳、房間與最近錯誤。
- Firebase 房間列表加入 15 秒本機查詢快取，降低連續刷新造成的讀取。
- 頁面在背景時將心跳降為 75 秒，離線判定放寬為 180 秒；回到前景後立即恢復 25 秒心跳與房主狀態整理。
- 離開房間或切換 listener 時會解除監聽與計時器，並在診斷資料中顯示讀寫與監聽計數。
- 過期房間清理會回報刪除數量，以及略過目前房間、進行中、近期與時間未知房間的數量。
- 新增 `docs/FINAL_ACCEPTANCE_CHECKLIST.md`、`docs/TROUBLESHOOTING.md` 與 `docs/DIAGNOSTIC_REPORT.md`。
- 維持免 Cloud Functions、不需要 Blaze。

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
big2/big2-tw-v0.8.2/index.html   ← 錯誤
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
- PWA 上線驗證：`docs/PWA_ONLINE_VERIFICATION.md`
- 正式上線驗收：`docs/FINAL_ACCEPTANCE_CHECKLIST.md`
- 疑難排解：`docs/TROUBLESHOOTING.md`
- 診斷資訊說明：`docs/DIAGNOSTIC_REPORT.md`
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

測試包含規則、AI、多人狀態、計分、主題對比、手機 UI、PWA 修復與診斷匯出、Firebase 查詢快取與背景心跳、GitHub Pages scope、Service Worker 更新策略、SEO、無障礙與正式驗收檔案完整性。
