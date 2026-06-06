# v0.8.4 錯誤紀錄中心

## 會記錄的內容

- JavaScript 全域錯誤。
- 未處理的 Promise rejection。
- Firebase 建立／加入房間、同步、出牌、Pass、下一局、清理房間等操作錯誤。
- 錯誤時間、功能、錯誤代碼、房號、gameId、座位、目前回合、網路狀態、頁面前景／背景狀態及最近操作。

## 儲存與隱私

- 最多保留最近 20 筆。
- 使用瀏覽器 `localStorage`，只保存在目前裝置。
- 不會自動送至 GitHub、Firebase 或其他伺服器。
- 使用「清除紀錄」或清除網站資料即可移除。

## listener 健康資訊

中心會顯示：
- 目前是否有 active room listener。
- listener 啟動／停止次數。
- 收到的快照數。
- 心跳寫入數。
- Firestore 文件讀取／寫入計數。

正常情況：
- 未加入房間：active listener 為 0。
- 已加入一個房間：active listener 為 1。
- 離開房間：active listener 回到 0。

若監聽警告持續出現，可按「重建房間同步」，再下載錯誤紀錄與完整診斷檔。
