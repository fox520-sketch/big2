import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles/base.css'), 'utf8');

const tableStart = index.indexOf('<section class="table-area"');
const lastPlay = index.indexOf('class="last-play-panel"', tableStart);
const hand = index.indexOf('class="hand-section"', tableStart);
const action = index.indexOf('class="action-panel', tableStart);
const tableEnd = index.indexOf('<section id="resultPanel"', tableStart);

if ([tableStart, lastPlay, hand, action, tableEnd].some((value) => value < 0)) {
  throw new Error('找不到牌桌、手牌、操作或結果區塊。');
}

if (!(tableStart < lastPlay && lastPlay < hand && hand < action && action < tableEnd)) {
  throw new Error('手機牌局 DOM 順序必須是：牌桌／上一手 → 我的手牌 → 操作。');
}

const cssNeeds = [
  'grid-template-areas:',
  '"last action"',
  '"hand hand"',
  '"last"\n      "hand"\n      "action"',
  '.score-strip .player-card',
  "body[data-gameplay-focus='on'] .seat-grid",
  '.last-play-panel .card-row',
  'overflow-x: visible',
  'position: sticky'
];

for (const text of cssNeeds) {
  if (!css.includes(text)) {
    throw new Error(`手機牌桌 CSS 缺少：${text}`);
  }
}

if (!index.includes('styles/base.css?v=0.8.3') || !index.includes('src/main.js?v=0.8.3')) {
  throw new Error('GitHub Pages 快取版本參數未更新為 v0.8.3。');
}

console.log('Mobile table layout tests passed.');
