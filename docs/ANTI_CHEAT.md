# v0.7.4 防作弊與同步穩定說明

## 目前已完成

- 所有多人出牌、Pass、AI 接管都透過 Firestore transaction 更新，避免兩個玩家同時覆蓋狀態。
- 前端會驗證：
  - 玩家是否在房間座位內。
  - 是否輪到該座位。
  - 該座位是否已被 AI 接管。
  - 選取的牌是否真的存在於該座位手牌。
  - 第一手是否包含規則設定的起手牌。
- 每次多人動作都會寫入 `game.security.revision`、`lastActionId`、`lastActorUid`、`lastActorSeat`，方便比對同步問題。
- `firestore.rules` 限制房間文件可寫入欄位，避免任意塞入非預期資料。

## 仍然不是正式防作弊

這版是 GitHub Pages 朋友休閒版。因為完整遊戲狀態仍在前端與 Firestore 房間文件內，所以懂技術的人仍可能從瀏覽器開發者工具看到資料或嘗試改資料。

正式防作弊版本建議改成：

1. Cloud Functions 負責洗牌與發牌。
2. 每位玩家手牌放在私人路徑，例如 `rooms/{roomId}/privateHands/{uid}`。
3. 出牌請求送到 Cloud Functions 驗證，而不是由前端直接改 `game`。
4. Firestore Rules 只允許玩家讀自己的手牌，不允許前端直接寫牌局核心狀態。

## v0.7.4 定位

v0.7.4 的防作弊強化目標是「朋友休閒遊玩時降低誤操作與同步錯誤」，不是賭博或競技等級的安全架構。


## v0.7.4 新增同步保護

- 出牌 / Pass 前端會送出目前 `gameId`、`currentTurnSeat` 與 `security.revision` 作為前置條件。
- Firestore transaction 內會重新讀取房間文件並比對前置條件，避免舊畫面或連點送出過期動作。
- 每次成功動作會更新 `security.revision` 與 `security.lastActionId`，方便從偵錯面板追查同步問題。
- 這些保護能降低朋友休閒局的誤操作，但不能取代 Cloud Functions 伺服器驗證。
