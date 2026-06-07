# Firebase 用量與安全操作指南

## 本版使用範圍
- Firebase Authentication：匿名登入
- Cloud Firestore：房間、座位、手牌、回合、分數與 presence
- 不使用 Cloud Functions，不需要 Blaze

## 降低讀寫
- 房內只維持一個即時 listener。
- 頁面在背景時降低心跳頻率。
- 最近房間列表有查詢快取與筆數限制。
- 離房時解除 listener 與計時器。
- 只有需要時才執行 presence 整理；房主失聯時其他成員可觸發轉移。

## Rules 安全邊界
v1.0.1 Rules 阻擋非房內成員修改既有房間，只允許等待／結束狀態的新玩家加入單一座位。因為牌局仍由前端更新，Rules 無法完整驗證牌型、洗牌與每一步遊戲邏輯。

## 建議監看
- Firebase Console → Usage 檢查 Firestore reads／writes。
- 遊戲「多人同步偵錯面板」檢查 listener 啟停差額。
- 大量測試後清理自己建立的過期等待房間。
