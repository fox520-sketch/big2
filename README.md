# 台灣大老二 Big2 TW v0.7.0

v0.7.0 是 **Cloud Functions 正式防作弊版**。這版把多人遊戲最重要的牌局操作改到 Firebase 後端執行：洗牌、發牌、開始下一局、驗證出牌、Pass、AI 接管、離線接管與累計總分，都由 Cloud Functions 寫入 Firestore。

## v0.7.0 重點

- 後端洗牌、後端發牌
- 後端指定起手玩家
- 後端驗證真人出牌：
  - 是否輪到該座位
  - 是否為真人座位
  - 選牌是否真的在該玩家手牌內
  - 牌型是否合法
  - 第一手是否包含起始牌
  - 是否能壓過上一手
  - revision / gameId / turnSeat 是否仍為最新狀態
- 後端驗證 Pass
- 後端 AI 補位與離線 AI 接管
- 後端累計總分與勝場
- Firestore Rules 改為：前端只能讀房間，不能直接寫入 `rooms/{roomId}`
- 新增後端審計紀錄：`rooms/{roomId}/actions/{actionId}`
- 新增 `functions/` Cloud Functions 專案
- 新增 `docs/CLOUD_FUNCTIONS_SETUP.md`
- 新增 `scripts/test-cloud-functions-logic.js`

## 專案結構

```txt
index.html
src/
styles/
functions/
  index.js
  lib/game-engine.js
  package.json
docs/
  CLOUD_FUNCTIONS_SETUP.md
  ANTI_CHEAT.md
  FIREBASE_SETUP.md
firestore.rules
firebase.json
README.md
VERSION.md
package.json
```

## 重要提醒

v0.7.0 不是只上傳 GitHub Pages 就能用，還需要部署 Cloud Functions。

前端 GitHub Pages 負責：

```txt
畫面顯示
玩家操作
監聽 Firestore 房間狀態
呼叫 Cloud Functions
```

Cloud Functions 負責：

```txt
建立房間
加入房間
補 AI 空位
洗牌
發牌
驗證出牌
驗證 Pass
AI 出牌
離線接管
累計總分
寫入審計紀錄
```

Firestore Rules 負責：

```txt
允許登入玩家讀房間
禁止前端直接寫入房間
禁止前端直接改 game / hand / score
```

## 測試

在專案根目錄可執行：

```bash
npm test
```

Cloud Functions 語法檢查：

```bash
cd functions
npm install
npm run lint
npm test
```

## 部署順序

1. 填好 `src/firebase-config.js`
2. 啟用 Firebase Authentication Anonymous
3. 建立 Firestore Database
4. 安裝 Firebase CLI
5. 在專案根目錄執行 `firebase login`
6. 執行 `firebase use --add`
7. 執行 `firebase deploy --only functions`
8. 到 Firebase Console 貼上新版 `firestore.rules` 並 Publish
9. 上傳 GitHub Pages 檔案
10. 重新開啟網頁測試多人模式

詳細步驟請看：

```txt
docs/CLOUD_FUNCTIONS_SETUP.md
```

## GitHub 上傳注意

可以上傳：

```txt
index.html
src/
styles/
functions/
docs/
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
任何私人金鑰
```

`functions/package.json` 可以上傳，`functions/node_modules/` 不要上傳。

## v0.7.0 多人測試建議

```txt
1. Fox 建立房間
2. 良 用邀請連結加入
3. 房主補 AI 空位
4. 房主開始多人遊戲
5. 確認第一手只能由持有起始牌的玩家出牌
6. 測試 Fox 出牌 / Pass
7. 測試 良 出牌 / Pass
8. 測試 AI 是否由後端驗證後接管
9. 測試一局結束後下一局
10. 測試手機重新整理後取回原座位
```
