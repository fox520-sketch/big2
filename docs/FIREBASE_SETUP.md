# Firebase 設定教學：Big2 TW v0.3.0

本版使用 Firebase Authentication 匿名登入 + Cloud Firestore 房間同步。

> v0.3.0 是休閒測試版，只同步房間座位、房號、邀請連結與 AI 補位，不把手牌放到 Firestore。完整多人出牌同步會在後續版本處理。

---

## 1. 建立 Firebase 專案

1. 開啟 Firebase Console。
2. 點「新增專案 / Add project」。
3. 專案名稱可填：`big2-tw`。
4. Google Analytics 可先關閉，之後需要再開。
5. 建立專案。

---

## 2. 建立 Web App

1. 進入剛建立的 Firebase 專案。
2. 在專案總覽頁點 `</>` Web 圖示。
3. App nickname 可填：`big2-tw-web`。
4. 先不用勾選 Firebase Hosting。
5. 點「Register app」。
6. 複製畫面中的 `firebaseConfig`。

---

## 3. 貼上 firebaseConfig

開啟：

```txt
src/firebase-config.js
```

把下方 PASTE 開頭的內容換成 Firebase Console 給你的值：

```js
export const firebaseConfig = {
  apiKey: '你的 apiKey',
  authDomain: '你的專案.firebaseapp.com',
  projectId: '你的專案 ID',
  storageBucket: '你的 storageBucket',
  messagingSenderId: '你的 messagingSenderId',
  appId: '你的 appId'
};
```

不要上傳這些檔案：

```txt
serviceAccountKey.json
firebase-adminsdk.json
.env
.env.local
任何私人金鑰
```

---

## 4. 啟用匿名登入

1. Firebase Console 左側選單點「Authentication」。
2. 點「Get started」。
3. 進入「Sign-in method」。
4. 找到「Anonymous / 匿名」。
5. 點進去後啟用。
6. 儲存。

---

## 5. 建立 Cloud Firestore

1. Firebase Console 左側選單點「Firestore Database」。
2. 點「Create database」。
3. 模式建議先選「Production mode」。
4. 區域可選靠近台灣的區域，例如 `asia-east1` 或 Firebase 介面提供的亞洲區域。
5. 建立資料庫。

---

## 6. 發佈 Firestore Rules

1. 進入 Firestore Database。
2. 點上方「Rules」。
3. 刪除原本內容。
4. 複製專案根目錄的 `firestore.rules` 內容貼上。
5. 點「Publish」。

目前規則只允許已登入使用者讀寫 `rooms/{roomId}`，而且 create/update 欄位有限制。這是 v0.3.0 休閒測試版規則，後續正式多人出牌同步要再強化。

---

## 7. 本機測試

在專案資料夾執行：

```bash
npm test
```

再用簡單伺服器開啟網頁：

```bash
python -m http.server 8080
```

瀏覽器開：

```txt
http://localhost:8080
```

測試流程：

1. 輸入暱稱。
2. 按「建立房間」。
3. 看到 6 碼房號。
4. 按「複製邀請連結」。
5. 開另一個無痕視窗貼上連結。
6. 確認會顯示「正在自動加入房間...」。
7. 確認座位列表會新增玩家。
8. 按「顯示 QR Code」，手機掃描測試。

---

## 8. GitHub Pages 上傳

請把壓縮檔解開後，將 `big2-tw-v0.3.0` 資料夾內的檔案全部放到 GitHub repository 根目錄。

正確：

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

不要變成：

```txt
big2-tw-v0.3.0/index.html
```

否則 GitHub Pages 可能找不到首頁。

---

## 9. 邀請連結格式

本版產生的邀請連結格式如下：

```txt
https://fox520-sketch.github.io/big2/?room=ABC123&join=1
```

程式會做兩件事：

1. 讀取 `room=ABC123`，自動帶入房號。
2. 看到 `join=1`，在 Firebase 匿名登入完成後自動執行 `joinRoom()`。

這次不只是帶入房號，會真的呼叫加入房間流程。
