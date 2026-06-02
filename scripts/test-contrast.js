import fs from 'node:fs';

const css = fs.readFileSync(new URL('../styles/base.css', import.meta.url), 'utf8');
const REQUIRED = [
  ['--text', '--surface', 4.5, '主要文字 / 面板'],
  ['--muted', '--surface', 4.5, '次要文字 / 面板'],
  ['--text', '--bg', 4.5, '主要文字 / 背景'],
  ['--primary-text', '--primary', 4.5, '主要按鈕文字 / 按鈕底色'],
  ['--card-black', '--card-bg', 4.5, '黑色牌面 / 牌底'],
  ['--card-red', '--card-bg', 4.5, '紅色牌面 / 牌底']
];

function hexToRgb(hex) {
  const value = hex.replace('#', '').trim();
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
}

function channel(c) {
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  return (high + 0.05) / (low + 0.05);
}

function parseBlock(selector, block) {
  const vars = {};
  for (const match of block.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)) {
    vars[match[1]] = match[2];
  }
  return { selector, vars };
}

const blocks = [];
const rootMatch = css.match(/:root\s*\{([\s\S]*?)\n\}/);
if (rootMatch) blocks.push(parseBlock('dark (:root)', rootMatch[1]));
for (const match of css.matchAll(/body\[data-theme='([^']+)'\]\s*\{([\s\S]*?)\n\}/g)) {
  blocks.push(parseBlock(match[1], match[2]));
}

let failed = false;
for (const block of blocks) {
  for (const [fgVar, bgVar, min, label] of REQUIRED) {
    const fg = block.vars[fgVar];
    const bg = block.vars[bgVar];
    if (!fg || !bg) {
      console.error(`缺少變數：${block.selector} ${label} ${fgVar}/${bgVar}`);
      failed = true;
      continue;
    }
    const ratio = contrast(fg, bg);
    if (ratio < min) {
      console.error(`對比不足：${block.selector} ${label} ${ratio.toFixed(2)} < ${min}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log(`對比檢查通過：${blocks.length} 個主題，${blocks.length * REQUIRED.length} 項檢查。`);
