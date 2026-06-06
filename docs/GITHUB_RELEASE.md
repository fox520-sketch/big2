# GitHub Release 建立方式（v1.0.0）

## 建議標籤

```text
v1.0.0
```

## 建議 Release 標題

```text
台灣大老二 Big2 TW v1.0.0 正式穩定版
```

## 建議 Release 內容

```markdown
## 台灣大老二 Big2 TW v1.0.0

第一個正式穩定版本，支援單人 AI、Firebase 好友房間、AI 補位、連續對戰、排行榜、手機 UI 與 PWA 安裝。

### 主要特色
- AI 難度 1～20 級
- 2～4 位真人與 AI 補位
- 邀請連結、QR Code、房間密碼
- 斷線重連、AI 接管、房主轉移
- PWA 安裝、離線單人、更新與上一版回復
- 13 種主題、音效、動畫與行動裝置優化

### 部署需求
- GitHub Pages
- Firebase Authentication 匿名登入
- Cloud Firestore
- 不需要 Cloud Functions 或 Blaze

### 注意
這是朋友休閒版，前端驗證不等同可信任後端防作弊。上傳時請保留自己的 `src/firebase-config.js`。
```

## GitHub 操作步驟

1. 將 v1.0.0 檔案 Commit 並 Push 到 `main`。
2. 到 repository 的 **Releases**。
3. 點 **Draft a new release**。
4. 建立新標籤 `v1.0.0`，目標選 `main`。
5. 貼上上方 Release 標題與內容。
6. 附加 `big2-tw-v1.0.0.zip` 作為 Source code 以外的方便下載檔。
7. 發布前再次確認壓縮檔不包含 Firebase 私鑰、`.env`、`node_modules` 或 `functions/`。
