# v0.8.4 診斷資訊說明

「複製問題回報」與「下載診斷檔」會收集技術性資訊，目的是協助定位 PWA、Firebase 與多人同步問題。

## 包含內容
- 遊戲版本、網址、產生時間。
- 房號、座位、回合、gameId、revision、上一手與最近歷史。
- 玩家連線狀態與手牌張數；不包含玩家手牌內容。
- PWA 顯示模式、Service Worker 狀態與版本。
- Big2 Cache Storage 名稱、項目數及瀏覽器儲存空間估計。
- Firebase listener、快照、心跳、房間列表查詢、讀寫等本機計數。
- 裝置 User-Agent、語言、螢幕與 viewport。
- 最近 20 筆 JavaScript 錯誤。

## 隱私提醒
- 報告可能包含房號、匿名 Firebase UID、玩家暱稱與裝置瀏覽器資訊。
- 公開貼文前可先移除不希望公開的欄位。
- 報告不會包含房間密碼、Firebase 密碼、服務帳戶私鑰或完整手牌內容。
