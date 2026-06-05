# Firebase 設定步驟｜Big2 TW v0.7.1 免 Cloud Functions 版

> 這版是 GitHub Pages + Firebase Auth + Cloud Firestore 的休閒穩定版，不需要 Blaze 付費方案，也不需要部署 `functions/`。

## 1. 建立 Firebase 專案

1. 進入 Firebase Console。
2. 建立專案，例如 `big2-tw`。
3. 進入專案總覽。

## 2. 建立 Web App

1. 點 `</>` Web 圖示。
2. App nickname 可填 `big2-tw-web`。
3. 取得 `firebaseConfig`。
4. 將設定貼到 `src/firebase-config.js`。

請確認不要再保留：

```js
apiKey: 'PASTE_YOUR_API_KEY'
```

## 3. 啟用匿名登入

到 Firebase Console：

```txt
Authentication → Sign-in method → Anonymous → Enable → Save
```

這樣朋友不用註冊帳號，也可以建立房間或加入房間。

## 4. 建立 Firestore Database

到 Firebase Console：

```txt
Firestore Database → Create database
```

建議選 Production mode，再用本版 `firestore.rules` 控制權限。

## 5. 貼上 Firestore Rules

1. 打開本專案的 `firestore.rules`。
2. 到 Firebase Console → Firestore Database → Rules。
3. 全部貼上。
4. 按 Publish。

若你之前測過 Cloud Functions 防作弊版，請務必改貼回本版 Rules。本版不需要 Cloud Functions，也不需要 Blaze。

## 6. 上傳 GitHub Pages

將解壓縮後的檔案放到 GitHub repository 根目錄：

```txt
index.html
src/
styles/
docs/
firestore.rules
README.md
VERSION.md
package.json
```

不要上傳：

```txt
functions/
firebase.json
.firebaserc
node_modules/
.env
serviceAccountKey.json
firebase-adminsdk.json
```

## 7. 發布後測試

1. 開啟 GitHub Pages 網址。
2. 確認頁面顯示 v0.7.1。
3. 按「執行 Firebase 檢查」。
4. 確認 Firebase Config、匿名登入、Firestore 寫入通過。
5. 建立房間，邀請朋友加入。
6. 補 AI 空位並開始多人遊戲。
7. 測試出牌、Pass、下一局與回房。

## 常見問題

### 按建立房間沒反應

請先按「執行 Firebase 檢查」。通常是 Firebase Config 未填、匿名登入未啟用，或 Firestore Rules 尚未貼上本版規則。

### 需要執行 firebase deploy --only functions 嗎？

不需要。本版是免 Cloud Functions 版。

### 需要升級 Blaze 嗎？

不需要。本版只用 GitHub Pages、Firebase Auth 與 Firestore。
