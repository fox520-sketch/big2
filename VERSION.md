# 版本說明

## v0.7.0 - 2026-06-03

### 新增

- Cloud Functions 正式防作弊版。
- 新增 `functions/index.js`。
- 新增 `functions/lib/game-engine.js`。
- 新增 `functions/package.json`。
- 新增 `firebase.json`。
- 新增 `.firebaserc.example`。
- 新增 `docs/CLOUD_FUNCTIONS_SETUP.md`。
- 新增 `scripts/test-cloud-functions-logic.js`。
- 新增後端審計紀錄 `rooms/{roomId}/actions/{actionId}`。

### 重大改變

- 多人遊戲的核心寫入改由 Cloud Functions 處理。
- 前端不再直接寫入 `game`、`totalScores`、`gameNo`、`status` 等牌局核心欄位。
- Firestore Rules 改為禁止前端建立、更新、刪除房間文件。
- 前端只負責讀取 Firestore 狀態與呼叫 Cloud Functions。

### 後端驗證項目

- 建立房間。
- 加入房間。
- 補 AI 空位。
- 開始多人遊戲 / 下一局。
- 後端洗牌、發牌。
- 驗證目前回合。
- 驗證真人座位。
- 驗證選牌是否在該玩家手牌內。
- 驗證牌型是否合法。
- 驗證第一手是否包含起始牌。
- 驗證是否能壓過上一手。
- 驗證 Pass 是否允許。
- AI 接管出牌。
- 離線接管與重連取回座位。
- 一局結束後更新累計總分與勝場。

### Firestore Rules

- `rooms/{roomId}`：登入玩家可讀，前端不可寫。
- `rooms/{roomId}/actions/{actionId}`：登入玩家可讀，前端不可寫。
- 寫入都必須由 Cloud Functions Admin SDK 執行。

### 測試

- `scripts/test-rules.js` 通過。
- `scripts/test-ai.js` 通過。
- `scripts/test-multiplayer-state.js` 通過。
- `scripts/test-settings.js` 通過。
- `scripts/test-cloud-functions-logic.js` 通過。
- `scripts/test-contrast.js` 通過。

## v0.6.2 - 2026-06-02

### 新增

- 多人實戰穩定修正版。
- 回合同步檢查。
- 出牌 / Pass 防連點。
- 下一局穩定。
- 斷線重連。
- 多人同步偵錯面板。
