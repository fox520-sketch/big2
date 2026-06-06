# v0.8.4 回復指南

## 裝置內 PWA 快速回復
1. 開啟「PWA 安裝、更新與離線驗證」。
2. 按「回復上一版」。
3. 頁面重新載入後確認版本號與基本功能。
4. 問題排除後按「恢復最新版」。

此功能只切換該裝置的 PWA 靜態快取，不會改動 GitHub repository、Firebase 房間或本機戰績。

## GitHub Pages 全站回復
1. 在 GitHub repository 找到上一個正常 commit 或 v0.8.3 備份。
2. 保留目前正式站的 `src/firebase-config.js`。
3. 將上一版其他檔案覆蓋 repository 根目錄並 commit／push。
4. 若曾發布 v0.8.4 Rules，回復程式時通常可保留較嚴格的 v0.8.4 Rules；若加入房間失敗，再依備份 Rules 回復。
5. 開啟網站後按「檢查新版」或「一鍵修復 PWA」。

## 緊急處理
- 網站空白：檢查 `index.html` 是否在 repository 根目錄。
- 新舊程式混用：執行「一鍵修復 PWA」。
- 多人完全無法寫入：檢查 Firebase 匿名登入及 Firestore Rules 發布狀態。
