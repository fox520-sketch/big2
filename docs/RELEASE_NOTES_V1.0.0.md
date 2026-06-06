# Big2 TW v1.0.0 正式發布說明

發布日期：2026-06-06

## 版本定位

v1.0.0 是第一個正式穩定版本，核心遊戲功能已凍結。適合部署到 GitHub Pages，供朋友以單人模式或 Firebase 房間進行休閒對戰。

## 正式版內容

- 台灣大老二規則與規則變體
- AI 難度 1～20 級
- 2～4 位真人與 AI 補位
- Firebase 房間、密碼、邀請連結與 QR Code
- 多人出牌、Pass、下一局、累計分數與排行榜
- 斷線重連、AI 接管與房主轉移
- 手機牌桌、PWA 安裝、離線單人、更新與回復
- 13 種主題、音效、動畫、成就、戰績與遊戲紀錄
- 問題回報、診斷匯出與實機驗收工具

## 部署架構

- GitHub Pages
- Firebase Authentication 匿名登入
- Cloud Firestore
- 不使用 Cloud Functions
- 不需要 Blaze

## 安全定位

此版本是朋友休閒版。由於牌局狀態仍由前端 transaction 驗證與更新，無法提供可信任後端等級的防作弊。

## 升級方式

1. 備份目前 repository 與 Firebase Rules。
2. 保留已填好的 `src/firebase-config.js`。
3. 更新其餘檔案。
4. 發布本版 `firestore.rules`。
5. 確認網站與 PWA 顯示 v1.0.0。
6. 完成 `STABLE_RELEASE_CHECKLIST.md`。
