# 台灣大老二 Big2 TW v0.6.3

這是一個可上傳 GitHub Pages 的純前端台灣大老二網頁遊戲，支援單人 AI 對戰、Firebase 多人房間、多人同步牌局、連續對戰、規則設定、計分設定、主題切換、手機 UI、音效與動畫。

## v0.6.3 修正重點

- 免 Cloud Functions：此版不需要 `functions/`，也不需要 Firebase Blaze 付費方案。
- 移除 v0.7.0 殘留疑慮：建立房間、加入房間、補 AI、開始多人遊戲都走 Firestore 前端 transaction。
- 新增「Firebase 設定檢查面板」：可檢查 Firebase Config、匿名登入、Firestore 建立 / 讀取 / 刪除暫存房間是否正常。
- 建立房間錯誤訊息更清楚：若 Rules 還停在 v0.7.0 Cloud Functions 版，會提示改貼 v0.6.3 的 `firestore.rules`。
- 修正房間區重複的「開始多人遊戲」按鈕。
- 修正重複的安全摘要項目。
- 保留 v0.6.2 的多人實戰穩定修正：回合同步、防連點、下一局穩定、斷線重連、偵錯面板。
- 保留 v0.6.1 的選牌穩定修正：Firestore 心跳 / presence 更新不會清空已選牌。

## 功能

- 台灣大老二規則引擎。
- 單人模式：玩家 + 3 家 AI。
- AI 難度 1～20 級。
- 13 種主題風格與 UI 對比檢查。
- Firebase 匿名登入、建立房間、加入房間。
- 邀請連結：`?room=房號&join=1`。
- QR Code 加入房間。
- 邀請連結自動加入房間。
- 房主可補 AI 空位。
- 房主可開始多人遊戲。
- 多人同步洗牌、發牌、出牌、Pass、回合與上一手。
- AI 補位由房主瀏覽器自動接管出牌。
- 多人一局結束後同步計分、排名與累計總分。
- 多人連續對戰與下一局。
- 玩家離線 AI 接管。
- 房主離線自動轉移。

## 多人遊戲使用流程

1. 房主輸入暱稱後按「執行 Firebase 檢查」。
2. 確認 Firebase Config、匿名登入、Firestore 寫入都通過。
3. 房主按「建立房間」。
4. 房主選擇玩法規則、計分規則、AI 難度。
5. 房主複製邀請連結或顯示 QR Code。
6. 朋友開啟連結後會自動加入房間。
7. 房主按「補 AI 空位」。
8. 房主按「開始多人遊戲」。
9. 輪到真人玩家時，該玩家才能出牌或 Pass。
10. 輪到 AI 座位時，由房主瀏覽器自動接管 AI 出牌。
11. 本局結束後，房主按「下一局 / 重新洗牌」即可保留同房間、總分與勝場繼續玩。

## Firebase 設定

請依照：

```txt
docs/FIREBASE_SETUP.md
```

v0.6.3 是免 Cloud Functions 版。請勿使用 v0.7.0 的 Firestore Rules；更新後請務必把本版 `firestore.rules` 貼到 Firebase Console → Firestore Database → Rules → Publish。

## 文件

- Firebase 設定：`docs/FIREBASE_SETUP.md`
- 規則與計分：`docs/RULES_AND_SCORING.md`
- 防作弊說明：`docs/ANTI_CHEAT.md`
- 手機 UI 檢查：`docs/MOBILE_UI_CHECKLIST.md`
- 多人穩定檢查：`docs/MULTIPLAYER_STABILITY_CHECKLIST.md`
- UI 對比檢查：`docs/UI_CONTRAST_CHECKLIST.md`

## 測試

```bash
npm test
```

測試內容包含：

- 規則引擎
- AI 難度
- 多人狀態
- 規則與計分設定
- 主題對比

## 檔案結構

```txt
index.html
src/
styles/
scripts/
docs/
firestore.rules
README.md
VERSION.md
package.json
```

## GitHub Pages 上傳提醒

請把解壓縮後資料夾裡面的檔案放到 GitHub repository 根目錄，不要把整個 `big2-tw-v0.6.3` 資料夾丟上去，否則 GitHub Pages 可能找不到 `index.html`。

v0.6.3 不需要上傳：

```txt
functions/
firebase.json
.firebaserc
.firebaserc.example
node_modules/
```

如果你的 repository 裡還有 v0.7.0 的 `functions/`，可以刪掉，因為此版不使用 Cloud Functions。

## 安全提醒

`firestore.rules` 可以上傳 GitHub，但上傳不等於已部署。請到 Firebase Console 的 Firestore Rules 頁面貼上並 Publish。

不要上傳：

```txt
.env
.env.local
serviceAccountKey.json
firebase-adminsdk.json
任何私人金鑰
```
