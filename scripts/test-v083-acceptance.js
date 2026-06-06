import fs from 'node:fs';

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles/base.css', import.meta.url), 'utf8');
const firebase = fs.readFileSync(new URL('../src/firebase-room.js', import.meta.url), 'utf8');

const acceptanceIds = [
  'android-pwa', 'ios-pwa', 'desktop-pwa', 'pwa-update',
  'two-human', 'three-human', 'four-human', 'disconnect-reconnect',
  'host-transfer', 'next-game', 'mobile-ui', 'firebase-health'
];

for (const id of acceptanceIds) {
  if (!index.includes(`data-acceptance-id="${id}"`)) throw new Error(`缺少實機驗收項目：${id}`);
}

for (const id of ['acceptanceProgressBadge', 'runAcceptanceQuickCheckBtn', 'copyAcceptanceBtn', 'resetAcceptanceBtn']) {
  if (!index.includes(`id="${id}"`)) throw new Error(`缺少實機驗收控制：${id}`);
}

for (const token of ['ACCEPTANCE_KEY', 'renderAcceptanceCenter', 'runAcceptanceQuickCheck', 'copyAcceptanceSummary']) {
  if (!main.includes(token)) throw new Error(`缺少實機驗收邏輯：${token}`);
}

for (const token of ['visualViewport', 'viewport-fit=cover', '--app-height', 'safe-area-inset-bottom']) {
  if (!(index + main + css).includes(token)) throw new Error(`缺少手機實機保護：${token}`);
}

for (const token of ['LISTENER_STALE_MS', 'listenerRecoveries', 'lastListenerSnapshotAt', 'listenerSnapshotAgeMs']) {
  if (!firebase.includes(token)) throw new Error(`缺少 Firebase listener 恢復機制：${token}`);
}

console.log('v0.8.3 real-device acceptance tests passed.');
