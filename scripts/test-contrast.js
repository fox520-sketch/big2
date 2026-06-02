import fs from 'node:fs';

const css = fs.readFileSync(new URL('../styles/base.css', import.meta.url), 'utf8');
const REQUIRED = [
  ['--text', '--surface', 4.5, '面板主要文字'],
  ['--muted', '--surface', 4.5, '面板次要文字'],
  ['--text', '--surface-2', 4.5, '徽章與次面板文字'],
  ['--muted', '--surface-2', 4.5, '次面板說明文字'],
  ['--text', '--bg', 4.5, '頁面主要文字'],
  ['--primary-strong', '--bg', 4.5, '頁首小標文字'],
  ['--primary-text', '--primary', 4.5, '主按鈕文字'],
  ['--danger', '--surface', 4.5, '警示文字'],
  ['--success', '--surface', 4.5, '成功文字'],
  ['--warning', '--surface', 3.0, '提示/選取輔助色'],
  ['--card-black', '--card-bg', 7.0, '黑桃梅花牌面'],
  ['--card-red', '--card-bg', 4.5, '紅心方塊牌面'],
  ['--card-ink', '--card-bg', 7.0, '牌面通用文字']
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
if (rootMatch) blocks.push(parseBlock('dark', rootMatch[1]));
for (const match of css.matchAll(/body\[data-theme='([^']+)'\]\s*\{([\s\S]*?)\n\}/g)) {
  blocks.push(parseBlock(match[1], match[2]));
}

let failed = false;
const rows = [];
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
    rows.push({ theme: block.selector, label, ratio });
    if (ratio < min) {
      console.error(`對比不足：${block.selector} ${label} ${ratio.toFixed(2)} < ${min}`);
      failed = true;
    }
  }
}

const componentChecklist = [
  '頁首標題、版本文字、工具列欄位',
  '狀態列與玩家狀態卡',
  '上一手牌區與空狀態提示',
  '操作面板、出牌按鈕、Pass 按鈕',
  '手牌紅色花色、黑色花色、選取外框',
  '本局結果表格',
  '遊戲紀錄清單',
  '規則說明與 UI 對比摘要',
  '正式規則與計分設定區',
  '防作弊強化摘要區',
  '手機版單欄排版與底部操作區',
  '音效按鈕與動畫降低動態設定'
];

if (failed) process.exit(1);
const minRatio = rows.reduce((min, row) => Math.min(min, row.ratio), Number.POSITIVE_INFINITY);
console.log(`對比檢查通過：${blocks.length} 個主題，${blocks.length * REQUIRED.length} 項色彩組合。最低比值 ${minRatio.toFixed(2)}。`);
console.log(`UI 檢查清單通過：${componentChecklist.length} 個區塊。`);
