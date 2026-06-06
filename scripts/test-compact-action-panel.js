import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles/base.css'), 'utf8');

const actionStart = index.indexOf('class="action-panel compact-action-panel"');
const selectedInfo = index.indexOf('id="selectedInfo"', actionStart);
const mainActions = index.indexOf('class="button-row main-actions"', actionStart);
const assistDetails = index.indexOf('id="playAssistDetails"', actionStart);
const recommend = index.indexOf('id="recommendPlayBtn"', assistDetails);
const minPlayable = index.indexOf('id="minPlayableBtn"', assistDetails);
const clearSelection = index.indexOf('id="clearSelectionBtn"', assistDetails);
const passReminder = index.indexOf('id="passReminderToggle"', assistDetails);

if ([actionStart, selectedInfo, mainActions, assistDetails, recommend, minPlayable, clearSelection, passReminder].some((value) => value < 0)) {
  throw new Error('找不到精簡操作面板或出牌輔助內容。');
}

if (!(actionStart < selectedInfo && selectedInfo < mainActions && mainActions < assistDetails)) {
  throw new Error('操作面板必須先顯示選牌狀態與主要按鈕，再顯示可收合的出牌輔助。');
}

const detailsTag = index.slice(assistDetails - 80, assistDetails + 120);
if (!detailsTag.includes('<details') || /<details[^>]*\sopen(?:\s|=|>)/.test(detailsTag)) {
  throw new Error('出牌輔助必須使用預設收合的 details，不能預設 open。');
}

for (const text of [
  '.play-assist-details',
  '.play-assist-details summary',
  '.play-assist-details[open] summary::after',
  '.compact-action-panel .selection-info'
]) {
  if (!css.includes(text)) throw new Error(`精簡操作樣式缺少：${text}`);
}

if (!index.includes('styles/base.css?v=1.0.0') || !index.includes('src/main.js?v=1.0.0')) {
  throw new Error('GitHub Pages 快取版本參數未更新為 v1.0.0。');
}

console.log('Compact action panel tests passed.');
