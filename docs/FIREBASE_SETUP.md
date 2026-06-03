# Firebase 設定教學：Big2 TW v0.7.0

v0.7.0 是 Cloud Functions 正式防作弊版。Firebase 設定分成三部分：

```txt
1. Firebase Web App 設定
2. Authentication / Firestore 設定
3. Cloud Functions 部署
```

Cloud Functions 部署細節請優先看：

```txt
docs/CLOUD_FUNCTIONS_SETUP.md
```

## 1. 建立 Firebase Project

到 Firebase Console 建立新專案，例如：

```txt
big2-tw
```

## 2. 建立 Web App

```txt
Project Overview → </> Web App → Register app
```

把 Firebase 顯示的設定貼到：

```txt
src/firebase-config.js
```

## 3. 啟用匿名登入

```txt
Authentication → Sign-in method → Anonymous → Enable → Save
```

## 4. 建立 Cloud Firestore

```txt
Firestore Database → Create database
```

建議先選 Production mode。

## 5. 部署 Cloud Functions

```bash
npm install -g firebase-tools
firebase login
firebase use --add
cd functions
npm install
npm run lint
npm test
cd ..
firebase deploy --only functions
```

## 6. 發佈 Firestore Rules

打開：

```txt
firestore.rules
```

貼到：

```txt
Firestore Database → Rules → Publish
```

v0.7.0 的 rules 會禁止前端直接寫入房間，這是正常的。

## 7. 上傳 GitHub Pages

請把專案根目錄內的檔案放到 GitHub repository 根目錄，不要包一層資料夾。

正確：

```txt
index.html
src/
styles/
functions/
docs/
firestore.rules
firebase.json
README.md
VERSION.md
```

錯誤：

```txt
big2-tw-v0.7.0/index.html
```

## 8. 測試

```txt
建立房間 → 加入房間 → 補 AI → 開始多人遊戲 → 出牌 / Pass → 下一局
```

若建立房間失敗，請先確認 Cloud Functions 已部署成功。
