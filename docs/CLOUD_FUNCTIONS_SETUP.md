# v0.7.0 Cloud Functions 設定教學

v0.7.0 是 Cloud Functions 正式防作弊版。這版不能只上傳 GitHub Pages，還要部署 `functions/`。

## 一、你需要準備

```txt
Firebase Project
Firebase Authentication：Anonymous 已啟用
Cloud Firestore 已建立
Firebase CLI
Node.js 20 或新版
```

## 二、安裝 Firebase CLI

在電腦終端機執行：

```bash
npm install -g firebase-tools
firebase login
```

## 三、設定專案

在解壓縮後的專案根目錄執行：

```bash
firebase use --add
```

選你的 Firebase Project。完成後會產生 `.firebaserc`。

可以參考 `.firebaserc.example`，但請注意 `.firebaserc.example` 只是範例。

## 四、安裝 Cloud Functions 套件

```bash
cd functions
npm install
npm run lint
npm test
cd ..
```

## 五、部署 Cloud Functions

在專案根目錄執行：

```bash
firebase deploy --only functions
```

v0.7.0 預設區域是：

```txt
asia-east1
```

前端設定在：

```txt
src/firebase-config.js
```

後端設定在：

```txt
functions/index.js
```

兩邊區域要一致。

## 六、更新 Firestore Rules

打開：

```txt
firestore.rules
```

到 Firebase Console：

```txt
Firestore Database → Rules → 貼上 firestore.rules → Publish
```

v0.7.0 的 Rules 會禁止前端直接寫入房間：

```txt
allow create, update, delete: if false;
```

這是正常的，因為所有房間寫入都要透過 Cloud Functions。

## 七、上傳 GitHub Pages

請把專案根目錄內的這些檔案上傳到 GitHub：

```txt
index.html
src/
styles/
docs/
functions/
firestore.rules
firebase.json
package.json
README.md
VERSION.md
.gitignore
```

不要上傳：

```txt
node_modules/
functions/node_modules/
.env
.env.local
serviceAccountKey.json
firebase-adminsdk.json
```

## 八、測試順序

```txt
1. 打開 GitHub Pages 網頁
2. 輸入暱稱 Fox
3. 建立房間
4. 另一台手機或無痕視窗用邀請連結加入
5. 補 AI 空位
6. 開始多人遊戲
7. 出牌 / Pass
8. 玩到結束
9. 按下一局
```

## 九、常見錯誤

### 1. 點建立房間出現 functions not found

通常代表還沒有部署 Cloud Functions，請執行：

```bash
firebase deploy --only functions
```

### 2. 點建立房間出現 permission denied

請確認：

```txt
Authentication → Sign-in method → Anonymous → Enabled
```

### 3. 網頁可以開，但建立房間失敗

請確認：

```txt
src/firebase-config.js 已填入正確 Firebase Web App 設定
cloudFunctionsRegion 與 functions/index.js 的 region 一致
Cloud Functions 已部署成功
```

### 4. 舊房間不能玩

v0.7.0 改成後端權威版，建議重新建立新房間測試，不要沿用 v0.6.x 舊房間。
