# v0.8.0 PWA 正式發布檢查清單

## 一、上傳檔案

確認 repository 根目錄包含：

- `.nojekyll`
- `index.html`
- `manifest.webmanifest`
- `service-worker.js`
- `offline.html`
- `privacy.html`
- `robots.txt`
- `sitemap.xml`
- `assets/icons/`
- `assets/social/`
- `assets/splash/`
- `src/`
- `styles/`

不要把整個 `big2-tw-v0.8.0` 資料夾再包在 repository 裡。

## 二、Firebase

- 保留原本已填好的 `src/firebase-config.js`。
- 確認 Firebase Authentication 的 Anonymous 已啟用。
- 確認 Firestore 使用免 Cloud Functions 版本規則。
- v0.8.0 沒有新增 Firestore 欄位；v0.7.5 正常時通常不用重貼 Rules。

## 三、PWA 安裝

### Android / Chrome

- 網址使用 HTTPS。
- 開啟後可看到「安裝遊戲」或瀏覽器安裝選單。
- 安裝後桌面圖示清楚，啟動時使用獨立視窗。
- 開啟後不會顯示過期版本。

### iPhone / Safari

- 以 Safari 開啟。
- 分享 → 加入主畫面。
- 圖示與名稱正確。
- 從桌面啟動後 safe-area 不遮住內容。

## 四、離線測試

1. 在線狀態完整開啟一次遊戲。
2. 等待約數秒，確認 Service Worker 完成安裝。
3. 關閉網路後重新開啟。
4. 首頁、主題、牌面與單人遊戲可載入。
5. 多人功能顯示離線提示，不應假裝出牌成功。

## 五、版本更新測試

1. 先開啟舊版本。
2. 上傳新版並修改 Service Worker 的 `CACHE_NAME`。
3. 回到已開啟頁面，等待更新偵測。
4. 應顯示「發現新版本」。
5. 按「立即更新」後重新載入新版。
6. 按「稍後」時不可中斷目前牌局。

## 六、分享與 SEO

- 分享 LINE / Facebook 時顯示 `assets/social/og-big2.png`。
- 標題為「台灣大老二｜單人 AI 與好友連線 PWA」。
- canonical 指向 `https://fox520-sketch.github.io/big2/`。
- `robots.txt` 與 `sitemap.xml` 可正常開啟。
- `privacy.html` 可正常開啟。

## 七、安全

不要上傳：

- `functions/`
- `node_modules/`
- `.env`
- `serviceAccountKey.json`
- `firebase-adminsdk.json`
- 任何私鑰或管理員金鑰

## 八、最後實機測試

- 單人完整玩完一局。
- 兩位真人 + 兩位 AI 完整玩完一局。
- 下一局、總分、排行榜正常。
- 鎖定螢幕與切換 App 後可恢復房間。
- Android、iPhone、平板與桌機至少各測一次主要畫面。
