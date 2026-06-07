# v1.0.1 回復指南

完整備份與回復步驟請看 [`BACKUP_AND_RECOVERY.md`](BACKUP_AND_RECOVERY.md)。

## 快速回復

1. 先使用遊戲內「進階支援與診斷」→「回復上一版」。
2. 若只有單一裝置異常，使用「一鍵修復 PWA」。
3. 若所有裝置皆異常，將 GitHub repository 回復到最後可用的 Commit 或 tag。
4. 若建立／加入房間被拒絕，檢查並回復 Firebase Rules。
5. 回復後建立新房間測試，不要只沿用舊房間。

## 建議保留

- `v1.0.1` tag
- 發布前的 `v0.8.4` 備份 tag
- 每次正式發布的 zip
- 對應版本的 `firestore.rules`
