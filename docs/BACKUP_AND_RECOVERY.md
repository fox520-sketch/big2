# v1.0.0 備份與回復

## 發布前必備份

請保存三份資料：

1. GitHub repository 發布前的 Commit 或 tag
2. 可正常運作的完整壓縮檔
3. Firebase Console 目前已發布的 Firestore Rules

`src/firebase-config.js` 可另外保存於私人位置；不要把 service account 或管理員私鑰放進公開 repository。

## 建議標籤

```text
v0.8.4-rc-backup
v1.0.0
```

## 網頁程式回復

### GitHub Desktop

1. 找到最後可正常運作的 Commit 或 tag。
2. 建立回復 Commit，或將備份檔案覆蓋到 repository。
3. Commit 並 Push。
4. 等待 GitHub Pages 重新部署。

### PWA 裝置端

1. 展開「進階支援與診斷」。
2. 使用「回復上一版」。
3. 問題解除後可按「恢復最新版」。
4. 若快取損壞，使用「一鍵修復 PWA」。

## Firestore Rules 回復

1. 開啟 Firebase Console → Firestore Database → Rules。
2. 貼上備份規則。
3. 按 Publish。
4. 重新測試建立房間與加入房間。

## 回復後檢查

- 首頁版本是否正確
- 可以建立與加入新房間
- 可以開始多人遊戲
- 手機沒有持續載入舊 Service Worker
- PWA 顯示的版本與 GitHub Pages 一致
