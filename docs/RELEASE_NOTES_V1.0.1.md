# Big2 TW v1.0.1 修正發布說明

發布日期：2026-06-07

## 修正內容

- 修正朋友加入等待中房間時，Firestore Rules 因 `game` 欄位尚不存在而可能回傳 `permission-denied` 的問題。
- Rules 改以 `Map.get()` 安全比較可選欄位：`game`、`gameNo`、`passwordEnabled`、`passwordHash`、`passwordHint`。
- 保留 v1.0.0 的房間安全限制：未登入不可讀寫、非房內成員不可任意修改、新玩家只能在等待或結束狀態加入一個座位、只有房主能刪除房間。
- 更新 PWA 與 Service Worker 快取版本，避免瀏覽器混用舊版規則提示與新版程式。

## 部署方式

1. 保留線上已設定完成的 `src/firebase-config.js`。
2. 將 v1.0.1 其他檔案更新到 GitHub repository 根目錄。
3. 將本版 `firestore.rules` 完整貼到 Firebase Console → Firestore Database → Rules，按 **Publish**。
4. 關閉舊分頁與 PWA，重新開啟後確認顯示 v1.0.1。
5. 建立全新房間，再用另一台裝置或無痕視窗測試加入。

## 架構

本版仍使用 GitHub Pages、Firebase 匿名登入與 Cloud Firestore，不使用 Cloud Functions，也不需要 Blaze。
