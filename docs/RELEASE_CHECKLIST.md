# v0.7.4 發布檢查清單

## 1. GitHub Pages 上傳檢查

- 解壓縮 `big2-tw-v0.7.4.zip`。
- 只上傳資料夾裡面的檔案到 repository 根目錄。
- 確認 GitHub 根目錄可以看到 `index.html`、`src/`、`styles/`、`docs/`、`firestore.rules`、`README.md`、`VERSION.md`。
- 不要把整個 `big2-tw-v0.7.4/` 資料夾再包一層上傳。

## 2. Firebase Config 檢查

- 打開 `src/firebase-config.js`。
- 確認不是 `PASTE_YOUR_API_KEY` 這類占位文字。
- Firebase Console 已啟用 Authentication 的 Anonymous 登入。
- Firestore Database 已建立。

## 3. Firestore Rules 檢查

- 到 Firebase Console → Firestore Database → Rules。
- 貼上本版 `firestore.rules`。
- 按 Publish。
- 不要貼 Cloud Functions 防作弊版 Rules；本版是免 Cloud Functions 版。

## 4. 多人測試檢查

- Fox 建立房間。
- 朋友用邀請連結或 QR Code 加入。
- 測試密碼房是否需要輸入密碼。
- 房主補 AI 空位。
- 房主開始多人遊戲。
- 測試出牌、Pass、推薦出牌、最小可出。
- 測試一局結束後下一局。
- 測試重新整理後能否回房。
- 測試手機直向與橫向操作。

## 5. 不要上傳的檔案

請不要上傳：

```txt
functions/
firebase.json
.firebaserc
.firebaserc.example
node_modules/
functions/node_modules/
.env
.env.local
serviceAccountKey.json
firebase-adminsdk.json
任何 private key
```

## 6. 發布後檢查

- 打開 GitHub Pages 網址。
- 確認頁面顯示 v0.7.4。
- 按「執行 Firebase 檢查」。
- 確認 Firebase Config、匿名登入、Firestore 寫入可用。
- 建立新房間測試，不沿用舊版房間。
