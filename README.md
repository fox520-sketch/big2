# 台灣大老二 Big2 TW

v0.3.0：Firebase 建立房間 + 加入房間 + 邀請連結 + QR Code + 自動加入房間。

這是一個可上傳 GitHub Pages 的純前端台灣大老二網頁遊戲。目前已支援單人 AI 對戰與 Firebase 房間大廳。完整多人同步出牌會在後續版本加入。

## 功能

- 台灣大老二規則引擎。
- 單人模式：玩家 + 3 家 AI。
- AI 難度 1～20 級。
- 13 種主題風格。
- UI 對比檢查清單。
- Firebase 匿名登入。
- Firebase 建立房間。
- Firebase 加入房間。
- 邀請連結：`?room=房號&join=1`。
- QR Code 加入房間。
- 邀請連結自動加入房間。
- 房主可補 AI 空位。

## 檔案結構

```txt
index.html
src/
  ai.js
  cards.js
  constants.js
  firebase-config.js
  firebase-room.js
  game-state.js
  main.js
  rules.js
  scoring.js
  themes.js
  ui.js
styles/
  base.css
docs/
  FIREBASE_SETUP.md
  UI_CONTRAST_CHECKLIST.md
scripts/
  test-ai.js
  test-contrast.js
  test-rules.js
firestore.rules
VERSION.md
README.md
package.json
```

## Firebase 設定

請先看：

```txt
docs/FIREBASE_SETUP.md
```

最重要的步驟：

1. 建立 Firebase Project。
2. 建立 Web App。
3. 啟用 Authentication 的 Anonymous 匿名登入。
4. 建立 Cloud Firestore。
5. 將 Firebase Console 的 `firebaseConfig` 貼到 `src/firebase-config.js`。
6. 將 `firestore.rules` 貼到 Firestore Rules 並 Publish。

## 本機測試

```bash
npm test
python -m http.server 8080
```

打開：

```txt
http://localhost:8080
```

## GitHub Pages 注意事項

請把專案內容放在 repository 根目錄，不要多包一層資料夾。

正確：

```txt
index.html
src/
styles/
docs/
```

錯誤：

```txt
big2-tw-v0.3.0/index.html
```

## 不要上傳到 GitHub 的檔案

```txt
serviceAccountKey.json
firebase-adminsdk.json
.env
.env.local
任何私人金鑰
```

`firebaseConfig` 是前端 Web App 設定，不是 service account 私鑰；實際安全性要靠 Firestore Rules、Authentication、後續 App Check 與 Cloud Functions。
