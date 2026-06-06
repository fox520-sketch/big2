import fs from 'node:fs';

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles/base.css', import.meta.url), 'utf8');

for (const id of ['errorLogRows', 'errorLogBadge', 'listenerHealthBadge', 'copyErrorLogBtn', 'downloadErrorLogBtn', 'clearErrorLogBtn', 'retryListenerBtn']) {
  if (!index.includes(`id="${id}"`)) throw new Error(`缺少錯誤紀錄中心元件：${id}`);
}

for (const token of ['ERROR_LOG_KEY', 'RUNTIME_ERROR_LIMIT = 20', 'persistRuntimeErrors', 'recordRuntimeError', 'renderErrorCenter', 'downloadErrorLog']) {
  if (!main.includes(token)) throw new Error(`缺少錯誤紀錄邏輯：${token}`);
}

for (const token of ['roomId', 'gameId', 'currentTurnSeat', 'online', 'visibility', 'lastUserAction']) {
  if (!main.includes(token)) throw new Error(`錯誤內容缺少上下文：${token}`);
}

if (!css.includes('.error-log-list') || !css.includes('.error-log-item')) throw new Error('缺少錯誤紀錄中心樣式');

console.log('v0.8.3 error center tests passed.');
