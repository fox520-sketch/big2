# 台灣大老二 Big2 TW

v0.2.0 是「規則引擎 + 單人 AI 對戰版」的第二階段版本，重點是加入 **AI 難度 1～20 級**、補齊 **13 種主題風格**，並建立 **UI 對比檢查清單**。

## 目前功能

- 台灣常見大老二規則：梅花 3 起手、2 最大、3 最小。
- 支援牌型：單張、對子、三條、順子、同花、葫蘆、鐵支、同花順。
- 單人模式：玩家 + 3 家 AI。
- AI 難度 1～20 級，可在畫面上切換。
- 遊戲結束後顯示名次、剩餘張數、本局分數。
- 13 種顯示風格：
  - 深色模式
  - 電子紙模式
  - 海洋風
  - 護眼風
  - 暮光風
  - 櫻花風
  - 森林風
  - 草原風
  - 夜航風
  - 夕陽風
  - 星空風
  - 糖果風
  - 霓虹風
- 牌面紅黑花色高對比顯示。
- 手機版單欄排版。
- 適合直接上傳 GitHub Pages。

## AI 難度說明

| 難度 | 名稱 | 行為 |
|---:|---|---|
| 1～3 | 新手隨機 | 會隨機選擇部分合法牌，偶爾錯過壓牌機會 |
| 4～5 | 基礎保守 | 以最小可出牌為主 |
| 6～8 | 低牌優先 | 優先消低牌，避免浪費高牌 |
| 9～11 | 牌型保留 | 會保留對子、三條與五張牌型 |
| 12～14 | 節奏控制 | 接近尾局時加速出牌 |
| 15～17 | 攔截防守 | 觀察對手剩牌數，必要時用較強牌攔截 |
| 18～20 | 高手判斷 | 綜合剩牌、牌型完整度、尾局壓制與未來彈性 |

## 檔案結構

```txt
big2-tw-v0.2.0/
  index.html
  README.md
  VERSION.md
  .gitignore
  docs/
    UI_CONTRAST_CHECKLIST.md
  src/
    ai.js
    cards.js
    constants.js
    game-state.js
    main.js
    rules.js
    scoring.js
    themes.js
    ui.js
  styles/
    base.css
  scripts/
    test-ai.js
    test-contrast.js
    test-rules.js
```

## 本機測試

這是純前端版本，不需要安裝框架。若要跑測試，請先安裝 Node.js，然後在專案根目錄執行：

```bash
npm test
```

可分開執行：

```bash
npm run test:rules
npm run test:ai
npm run test:contrast
```

v0.2.0 測試結果：

```txt
All rule tests passed.
AI level tests passed.
對比檢查通過：13 個主題，169 項色彩組合。最低比值 4.99。
UI 檢查清單通過：9 個區塊。
```

## GitHub Pages 上傳方式

1. 解壓縮 `big2-tw-v0.2.0.zip`。
2. 進入 `big2-tw-v0.2.0` 資料夾。
3. 把資料夾裡面的所有檔案上傳到 GitHub repository 根目錄。
4. 到 GitHub repository 的 `Settings → Pages`。
5. Source 選 `Deploy from a branch`。
6. Branch 選 `main`，資料夾選 `/root`。
7. 儲存後等待 GitHub Pages 部署完成。

## 下一版建議

v0.3.0 建議開始做 Firebase 多人房間：

- Firebase 匿名登入。
- 建立房間。
- 加入房間。
- 複製邀請連結。
- QR Code。
- 從網址參數 `?room=XXXXXX&join=1` 自動加入房間。
