# 台灣大老二 Big2 TW v0.6.9

這是一個可上傳 GitHub Pages 的純前端台灣大老二網頁遊戲，支援單人 AI 對戰、Firebase 多人房間、多人同步牌局、連續對戰、規則設定、計分設定、主題切換、手機 UI、音效、動畫與出牌輔助。

## v0.6.9 修正重點

- 全面補強大老二規則測試：單張、對子、三條、順子、同花、葫蘆、鐵支、同花順。
- 校正起手規則：梅花 3 起手、方塊 3 變體、第一手必須含起手牌。
- 校正順子規則：台灣常用不含 2、不開 A2345；朋友局可開 A2345；寬鬆變體可含 2。
- 強化壓牌邏輯：張數要相同，五張牌型依順子 < 同花 < 葫蘆 < 鐵支 < 同花順比較。
- 強化 Pass 流程：領出不能 Pass，三家 Pass 後回到最後出牌者。
- 強化 AI：高難度更少亂拆 2、A、K、對子與牌型，對手剩 1 張時更積極攔截。
- 強化可出牌掃描：顯示目前可出幾組，並列出可出牌型摘要。
- 強化結算與排行榜測試，避免同一局重複累加總分。
- 新增「複製偵錯資訊」按鈕，方便回報多人同步問題。
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

v0.6.9 是免 Cloud Functions 版。請勿使用 v0.7.0 的 Firestore Rules；更新後請務必把本版 `firestore.rules` 貼到 Firebase Console → Firestore Database → Rules → Publish。

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
- 規則校正與 AI 強化：`docs/RULE_CALIBRATION_CHECKLIST.md`

## 測試

```bash
npm test
```

測試內容包含規則引擎、規則邊界、AI 難度、多人狀態、規則與計分設定、主題對比。

## GitHub Pages 上傳提醒

請把解壓縮後資料夾裡面的檔案放到 GitHub repository 根目錄，不要把整個 `big2-tw-v0.6.9` 資料夾丟上去，否則 GitHub Pages 可能找不到 `index.html`。

v0.6.9 不需要上傳：

```txt
functions/
firebase.json
.firebaserc
.firebaserc.example
node_modules/
```
