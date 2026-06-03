# 台灣大老二 Big2 TW v0.6.2

這是一個可上傳 GitHub Pages 的純前端台灣大老二網頁遊戲，支援單人 AI 對戰、Firebase 多人房間、多人同步牌局、連續對戰、規則設定、計分設定、主題切換、手機 UI、音效與動畫。

## v0.6.2 修正重點

- 強化多人回合同步：出牌 / Pass 會檢查 gameId、目前回合座位與 revision。
- 新增出牌 / Pass 防連點：Firebase transaction 完成前鎖定按鈕，避免手機連點重複送出。
- 強化下一局穩定：下一局會重新建立 gameId，上一局 lastPlay、passCount、winner、results 不會殘留。
- 強化斷線重連：離線玩家可由 AI 暫時接管，同 UID 回來可取回座位。
- 新增「多人同步偵錯面板」：截圖時可看到房號、座位、回合、revision、lastActionId 與最後同步時間。
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

1. 房主輸入暱稱後按「建立房間」。
2. 房主選擇玩法規則、計分規則、AI 難度。
3. 房主複製邀請連結或顯示 QR Code。
4. 朋友開啟連結後會自動加入房間。
5. 房主按「補 AI 空位」。
6. 房主按「開始多人遊戲」。
7. 輪到真人玩家時，該玩家才能出牌或 Pass。
8. 輪到 AI 座位時，由房主瀏覽器自動接管 AI 出牌。
9. 本局結束後，房主按「下一局 / 重新洗牌」即可保留同房間、總分與勝場繼續玩。

## Firebase 設定

請依照：

```txt
docs/FIREBASE_SETUP.md
```

v0.6.2 新增 `rules`、`scoringRules`、`securityVersion` 欄位，更新後請務必重新 Publish 新版 `firestore.rules`。

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

請把解壓縮後資料夾裡面的檔案放到 GitHub repository 根目錄，不要把整個 `big2-tw-v0.6.2` 資料夾丟上去，否則 GitHub Pages 可能找不到 `index.html`。

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
