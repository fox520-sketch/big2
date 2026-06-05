import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles/base.css'), 'utf8');
const docs = fs.readFileSync(path.join(root, 'docs/ONLINE_TEST_FIX_CHECKLIST.md'), 'utf8');

const indexNeeds = [
  'styles/base.css?v=0.7.3',
  'src/main.js?v=0.7.3',
  '手機牌桌 UI 優化',
  'qrStatusText',
  'qrFallbackLink'
];
for (const text of indexNeeds) {
  if (!index.includes(text)) throw new Error(`index.html 缺少上線實測修正：${text}`);
}

const mainNeeds = [
  'runButtonLocked',
  'focusRoomPasswordForRetry',
  'QR Code 圖片載入失敗',
  'aria-busy',
  '建立中...',
  '加入中...'
];
for (const text of mainNeeds) {
  if (!main.includes(text)) throw new Error(`src/main.js 缺少上線防呆：${text}`);
}

const cssNeeds = ['online-fix-panel', 'secondary-link', 'button[aria-busy="true"]'];
for (const text of cssNeeds) {
  if (!css.includes(text)) throw new Error(`styles/base.css 缺少上線修正樣式：${text}`);
}

for (const text of ['GitHub Pages', '建立房間', 'QR Code', '下一局與排行榜', '手機測試建議']) {
  if (!docs.includes(text)) throw new Error(`ONLINE_TEST_FIX_CHECKLIST.md 缺少：${text}`);
}

console.log('Online readiness tests passed.');
