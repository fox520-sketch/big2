# v0.8.4 疑難排解

## 一直顯示舊版
1. 在「PWA 安裝、更新與離線驗證」按「檢查新版」。
2. 按「立即套用新版」。
3. 仍異常時按「一鍵修復 PWA」。
4. 最後才考慮移除桌面 App、清除該網站資料後重新安裝。

## PWA 無法安裝
- 必須使用 HTTPS 或 localhost。
- Android／電腦建議 Chrome 或 Edge。
- iPhone／iPad 請用 Safari 的分享選單「加入主畫面」。
- 確認 `manifest.webmanifest`、圖示與 Service Worker 沒有 404。

## 無法建立或加入房間
- 檢查 `src/firebase-config.js` 是否仍是正式設定，不是 `PASTE_...` 範例。
- 確認 Firebase Anonymous Authentication 已啟用。
- 確認 Firestore Rules 使用免 Cloud Functions 版並已 Publish。
- 執行「Firebase 設定檢查面板」。
- 複製或下載問題回報，查看權限、網路與 listener 狀態。

## 多人卡住或不同步
- 確認所有玩家版本一致。
- 等網路狀態列顯示「網路正常」。
- 切回 App 後等待重新連線完成。
- 房主可重新整理頁面並取回原座位。
- 不要同一帳號／裝置同時操作多個相同房間分頁。

## 手機一直閃動或牌被遮住
- 先關閉動畫。
- 將瀏覽器文字大小恢復為一般後再測試。
- 橫向與直向各重新載入一次。
- 附上手機型號、瀏覽器版本、截圖與診斷檔回報。

## Firebase 讀取量偏高
- 不要連續刷新最近房間；v0.8.4 會使用 15 秒快取。
- 離開不用的房間，讓 listener 與心跳停止。
- 定期使用「清理我的過期房間」。
- 診斷檔中的 `firebasePresence.metrics` 可協助辨識重複 listener 或心跳。
