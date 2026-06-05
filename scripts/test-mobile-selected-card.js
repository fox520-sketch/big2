import fs from 'node:fs';

const css = fs.readFileSync(new URL('../styles/base.css', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const required = [
  '/* v0.7.5 手機選牌裁切修正',
  '.hand-section .hand {',
  'padding-top: 1.25rem;',
  'overflow-y: hidden;',
  '.hand-section .hand .playing-card.selected {',
  'transform: translateY(-0.58rem) scale(1.025);',
  '.hand-section .hand .playing-card.selected::after {',
  'top: 0.08rem;',
  'right: 0.08rem;'
];

for (const text of required) {
  if (!css.includes(text)) {
    throw new Error(`缺少手機選牌裁切修正：${text}`);
  }
}

if (!index.includes('styles/base.css?v=0.8.0') || !index.includes('src/main.js?v=0.8.0')) {
  throw new Error('GitHub Pages 快取版本參數未更新為 v0.8.0。');
}

console.log('Mobile selected card clipping tests passed.');
