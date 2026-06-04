# 台灣大老二 Big2 TW v0.6.8

這是一個可上傳 GitHub Pages 的純前端台灣大老二網頁遊戲，支援單人 AI 對戰、Firebase 多人房間、多人同步牌局、連續對戰、規則設定、計分設定、主題切換、手機 UI、音效、動畫與出牌輔助。

## v0.6.8 修正重點

- 新增手牌排序：依點數、依花色、依牌型建議排序。
- 新增即時出牌提示：選牌後會顯示牌型、是否可出、是否能壓過上一手。
- 新增「推薦出牌」、「最小可出」、「清除選牌」。
- 新增 Pass 前提醒：若目前仍有可出的牌，按 Pass 前會先確認。
- 強化上一手顯示：顯示誰出的牌、牌型、牌面與目前需要出的張數。
- 手機選牌優化：操作區更靠近手牌、選中牌更明顯、手牌橫向滑動更順。
- 錯誤訊息白話化：例如 4 張牌不能直接出、上一手張數不符、牌型壓不過等。
- 保留 v0.6.7 的牌局專注模式，遊戲中會自動隱藏不相關設定與說明。
- 保留免 Cloud Functions 架構，不需要 Blaze 付費方案。

## 功能

- 台灣大老二規則引擎。
- 單人模式：玩家 + 3 家 AI。
- AI 難度 1～20 級。
- 13 種主題風格與 UI 對比檢查。
- 手牌排序、推薦出牌、最小可出、Pass 提醒。
- 內建規則說明頁。
- 動畫開關與手機橫向提示。
- 細部音效開關與音量調整。
- 房間列表與最近房號。
- 成就徽章與每日戰績。
- 本機最近 40 局遊戲紀錄。
- 房間密碼。
- 房主踢除玩家 / 重新安排座位。
- 排行榜與累計總排名。
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
3. 房主可選填房間密碼，再按「建立房間」。
4. 房主選擇玩法規則、計分規則、AI 難度。
5. 房主複製邀請連結或顯示 QR Code。
6. 朋友開啟連結後會自動加入房間；若是密碼房，請先輸入密碼再加入。
7. 房主按「補 AI 空位」。
8. 房主按「開始多人遊戲」。
9. 輪到真人玩家時，該玩家可以手動選牌，也可以按「推薦出牌」或「最小可出」。
10. 輪到 AI 座位時，由房主瀏覽器自動接管 AI 出牌。
11. 本局結束後，房主按「下一局 / 重新洗牌」即可保留同房間、總分與勝場繼續玩。

## Firebase 設定

請依照：

```txt
docs/FIREBASE_SETUP.md
```

v0.6.8 是免 Cloud Functions 版。請勿使用 v0.7.0 的 Firestore Rules；更新後請務必把本版 `firestore.rules` 貼到 Firebase Console → Firestore Database → Rules → Publish。

## 文件

- Firebase 設定：`docs/FIREBASE_SETUP.md`
- 規則與計分：`docs/RULES_AND_SCORING.md`
- 防作弊說明：`docs/ANTI_CHEAT.md`
- 手機 UI 檢查：`docs/MOBILE_UI_CHECKLIST.md`
- 多人穩定檢查：`docs/MULTIPLAYER_STABILITY_CHECKLIST.md`
- UI 對比檢查：`docs/UI_CONTRAST_CHECKLIST.md`
- 遊戲體驗檢查：`docs/GAME_EXPERIENCE_CHECKLIST.md`
- 實機測試清單：`docs/REAL_DEVICE_TEST_CHECKLIST.md`
- 內容強化清單：`docs/GAME_CONTENT_CHECKLIST.md`
- 出牌體驗檢查：`docs/PLAY_ASSIST_CHECKLIST.md`

## 測試

```bash
npm test
```

測試內容包含規則引擎、AI 難度、多人狀態、規則與計分設定、主題對比。

## GitHub Pages 上傳提醒

請把解壓縮後資料夾裡面的檔案放到 GitHub repository 根目錄，不要把整個 `big2-tw-v0.6.8` 資料夾丟上去，否則 GitHub Pages 可能找不到 `index.html`。

v0.6.8 不需要上傳：

```txt
functions/
firebase.json
.firebaserc
.firebaserc.example
node_modules/
```
