# 台灣大老二 Big2 TW v1.0.1 正式穩定版

## 正式版本

台灣大老二網頁遊戲，支援單人與 3 家 AI 對戰，也可使用 Firebase 建立好友房間；不足四人時由 AI 補位。可直接部署到 GitHub Pages，並支援安裝成 PWA。

> v1.0.1 已凍結核心功能。後續 1.0.x 僅進行錯誤修正、安全維護與瀏覽器相容性改善。

## 主要功能

- 台灣常用大老二規則、規則變體與多種計分方式
- 單人模式與 AI 難度 1～20 級
- Firebase 匿名登入、建立房間、邀請連結、QR Code、房間密碼
- 2～4 位真人對戰，不足人數由 AI 補位
- 連續對戰、下一局、累計總分、勝場與排行榜
- 斷線重連、離線 AI 接管與房主轉移
- 手機牌桌、選牌提示、出牌輔助、音效、動畫與 13 種主題
- PWA 安裝、離線單人、更新、一鍵修復與上一版回復
- 本機錯誤紀錄、診斷匯出與實機驗收工具

## 架構與限制

本版使用：

```text
GitHub Pages
Firebase Authentication（匿名登入）
Cloud Firestore
```

不使用 Cloud Functions，也不需要 Blaze。這讓部署成本較低，但屬於朋友休閒版；前端驗證無法提供競技級防作弊。請先閱讀 [`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md)。

## 上傳 GitHub Pages

1. 解壓縮本版檔案。
2. 保留 GitHub 上已設定好的 `src/firebase-config.js`，不要被範例設定覆蓋。
3. 將資料夾**裡面的內容**上傳到 repository 根目錄。
4. 將本版 `firestore.rules` 貼到 Firebase Console → Firestore Database → Rules，然後 Publish。
5. 開啟網站並確認頁面版本顯示 `v1.0.1`。
6. PWA 仍顯示舊版時，使用遊戲內「檢查新版」或「一鍵修復 PWA」。

正確：

```text
big2/index.html
big2/src/
big2/styles/
```

錯誤：

```text
big2/big2-tw-v1.0.1/index.html
```

## 不要上傳

```text
functions/
node_modules/
.env
.env.local
serviceAccountKey.json
firebase-adminsdk.json
任何私人金鑰或管理員憑證
```

## 測試

```bash
npm test
```

自動測試涵蓋規則、AI、多人狀態、計分、主題對比、手機 UI、PWA、Service Worker、Firebase listener、錯誤紀錄、Rules 安全檢查與正式發布檔案。

自動測試不能取代真實 Android、iPhone、桌機 PWA 與多人連線實測。

## 正式發布文件

- [v1.0.1 發布說明](docs/RELEASE_NOTES_V1.0.1.md)
- [GitHub Release 建立方式](docs/GITHUB_RELEASE.md)
- [正式穩定版發布檢查](docs/STABLE_RELEASE_CHECKLIST.md)
- [備份與回復](docs/BACKUP_AND_RECOVERY.md)
- [功能凍結政策](docs/FEATURE_FREEZE_POLICY.md)
- [已知限制](docs/KNOWN_LIMITATIONS.md)
- [疑難排解](docs/TROUBLESHOOTING.md)
- [Firebase 設定](docs/FIREBASE_SETUP.md)
- [隱私與資料使用](docs/PRIVACY_AND_DATA.md)

## 版本

目前正式版：**v1.0.1**  
發布日期：**2026-06-06**
