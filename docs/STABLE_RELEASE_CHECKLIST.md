# v1.0.1 正式穩定版發布檢查

## 程式與版本

- [ ] 首頁顯示 v1.0.1 正式穩定版
- [ ] `package.json`、`src/constants.js`、`src/pwa.js`、`service-worker.js` 皆為 1.0.1
- [ ] `npm test` 全部通過
- [ ] repository 不包含 `functions/`、`node_modules/`、`.env` 或私人金鑰

## Firebase

- [ ] `src/firebase-config.js` 保留正式設定
- [ ] Anonymous Authentication 已啟用
- [ ] v1.0.1 `firestore.rules` 已 Publish
- [ ] 可以建立房間、加入房間、補 AI、開始遊戲
- [ ] 離開房間後 listener 正常解除

## 多人遊戲

- [ ] 2 真人＋2 AI 至少完成 3 局
- [ ] 下一局保留名稱、座位、總分與勝場
- [ ] 玩家斷線後 AI 接管，回線後可取回
- [ ] 房主斷線後可轉移
- [ ] 排名顯示實際玩家名稱

## PWA 與手機

- [ ] Android／桌機可安裝
- [ ] iPhone Safari 可加入主畫面
- [ ] 發布新版後更新提示正常
- [ ] 離線可進入首頁與單人模式
- [ ] 手牌可完整滑動，選牌不被裁切
- [ ] 出牌與 Pass 不會遮住牌面

## 發布與備份

- [ ] Git tag `v1.0.1` 已建立
- [ ] GitHub Release 已發布
- [ ] v1.0.1 壓縮檔已備份
- [ ] v0.8.4 或目前可用版本仍可回復
- [ ] Firebase Rules 備份已保存
