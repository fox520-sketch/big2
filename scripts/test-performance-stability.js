import fs from 'node:fs';

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles/base.css', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const room = fs.readFileSync(new URL('../src/firebase-room.js', import.meta.url), 'utf8');

const requiredIndex = [
  'viewport-fit=cover',
  'networkStatusBar',
  'retryConnectionBtn',
  'cleanupRoomsBtn',
  'styles/base.css?v=0.8.4',
  'src/main.js?v=0.8.4'
];
for (const token of requiredIndex) {
  if (!index.includes(token)) throw new Error(`缺少上線穩定標記：${token}`);
}

const requiredCss = [
  '--app-height: 100dvh',
  'env(safe-area-inset-bottom)',
  '.hand-section .hand::after',
  'touch-action: pan-x',
  '.network-status-bar',
  'position: static;',
  'var(--app-height, 100dvh)'
];
for (const token of requiredCss) {
  if (!css.includes(token)) throw new Error(`缺少手機回歸 CSS：${token}`);
}

const requiredMain = [
  'window.visualViewport',
  'bindViewportAndNetworkEvents',
  "window.addEventListener('offline'",
  "window.addEventListener('online'",
  'refreshActiveRoomConnection',
  'cleanupExpiredOwnedRooms',
  'expectedGameNo'
];
for (const token of requiredMain) {
  if (!main.includes(token)) throw new Error(`缺少網路或視窗穩定功能：${token}`);
}

const requiredRoom = [
  'HEARTBEAT_INTERVAL_MS = 25000',
  'RECONCILE_INTERVAL_MS = 30000',
  'STALE_PLAYER_MS = 180000',
  'roomRenderSignature',
  'signature === latestRoomSignature',
  'room.hostUid !== currentUser.uid',
  'cleanupExpiredOwnedRooms',
  'refreshActiveRoomConnection',
  '目前牌局仍在進行，不能重複洗牌或開始下一局'
];
for (const token of requiredRoom) {
  if (!room.includes(token)) throw new Error(`缺少 Firebase 效能或下一局保護：${token}`);
}

console.log('Mobile regression and performance stability tests passed.');
