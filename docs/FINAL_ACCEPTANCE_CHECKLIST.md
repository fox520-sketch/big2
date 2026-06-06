# v0.8.3 正式上線驗收清單

## 一、發布前
- [ ] GitHub Pages 根目錄有 `index.html`、`service-worker.js`、`manifest.webmanifest`、`.nojekyll`。
- [ ] 保留已填妥的 `src/firebase-config.js`，沒有上傳私鑰、`.env`、`node_modules/` 或 `functions/`。
- [ ] Firebase Anonymous Authentication 已啟用，Firestore Rules 使用免 Cloud Functions 版本。
- [ ] `npm test` 全部通過。

## 二、PWA 安裝與更新
- [ ] Android Chrome、Windows Chrome／Edge 可安裝。
- [ ] iPhone／iPad Safari 可加入主畫面。
- [ ] 桌面圖示啟動為獨立視窗。
- [ ] 發布新版後能檢查並套用更新。
- [ ] 「一鍵修復 PWA」後版本、快取與離線首頁正常。
- [ ] 離線可進首頁與單人模式；多人按鈕不會誤送出。

## 三、多人連續實戰
- [ ] 2 真人＋2 AI，連續 5 局。
- [ ] 3 真人＋1 AI，連續 3 局。
- [ ] 4 真人，連續 3 局。
- [ ] 房主離線後轉移房主。
- [ ] 玩家鎖螢幕、切換 App、重新整理後能回房。
- [ ] 斷網後不能送出，恢復網路後重新同步。
- [ ] 下一局保留玩家名稱、座位、總分與勝場。

## 四、手機 UI
- [ ] 320、360、390、430px 寬度可操作。
- [ ] 選中牌不裁切，最左與最右牌可完整滑入。
- [ ] 操作區不遮手牌，鍵盤開啟時房號與密碼欄可見。
- [ ] iPhone 安全區、Android 網址列伸縮與橫向牌桌正常。

## 五、問題回報
- [ ] 「複製問題回報」可貼出 JSON。
- [ ] 「下載診斷檔」會產生含版本、PWA、Firebase 與錯誤紀錄的文字檔。
- [ ] 真實裝置問題回報時附上診斷檔、截圖、操作步驟與發生時間。

> 自動測試不能取代 Android、iPhone 與真實 Firebase 多人實機驗收，正式公開前仍應逐項人工確認。
