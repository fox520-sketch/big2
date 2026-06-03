# v0.7.0 防作弊架構

v0.7.0 將多人牌局核心改為 Cloud Functions 後端權威架構。

## v0.6.x 的限制

v0.6.x 是朋友休閒版，雖然前端有 transaction 與 revision 檢查，但懂程式的人仍可能直接嘗試修改 Firestore 牌局資料。

## v0.7.0 的改法

前端不能直接改 `rooms/{roomId}`。

所有核心操作改由 Cloud Functions 執行：

```txt
createRoom
joinRoom
fillAISeats
startGame
submitPlay
submitPass
runAITurnCallable
syncPresence
reconcilePresence
leaveRoom
```

## 後端驗證

Cloud Functions 會檢查：

```txt
是否已登入
是否在房間座位內
是否為房主
是否輪到該玩家
是否真人座位
選牌是否真的在手牌裡
牌型是否合法
第一手是否含起始牌
是否能壓過上一手
是否可以 Pass
revision 是否過期
gameId 是否仍是同一局
```

## Firestore Rules

v0.7.0 的 `firestore.rules`：

```txt
rooms/{roomId} 只允許登入玩家 read
rooms/{roomId} 不允許前端 create / update / delete
actions 子集合只允許 read，不允許前端 write
```

Cloud Functions 使用 Admin SDK，所以可以寫入 Firestore。

## 審計紀錄

每次重要操作會寫入：

```txt
rooms/{roomId}/actions/{actionId}
```

內容包含：

```txt
actionType
uid
seat
status
gameId
revision
createdAt
backendVersion
```

之後如果多人同步有問題，可以查看 actions 判斷是哪個操作被後端接受。

## 還可以再強化的項目

v0.7.0 已比朋友版安全很多，但如果未來要做競技或公開服務，還可以加：

```txt
App Check
更嚴格的 action rate limit
房間過期自動清理
只允許同房玩家讀取該房間
手牌加密或拆成 private player document
Cloud Scheduler 清理舊房間
```
