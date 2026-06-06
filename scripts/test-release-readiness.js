import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'index.html',
  'src/constants.js',
  'src/firebase-room.js',
  'styles/base.css',
  'docs/RELEASE_CHECKLIST.md',
  'docs/ONLINE_TEST_FIX_CHECKLIST.md',
  'firestore.rules',
  'README.md',
  'VERSION.md'
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    throw new Error(`缺少發布必要檔案：${file}`);
  }
}

const forbidden = ['functions', 'firebase.json', '.firebaserc', '.firebaserc.example'];
for (const item of forbidden) {
  if (fs.existsSync(path.join(root, item))) {
    throw new Error(`免 Cloud Functions 版不應包含：${item}`);
  }
}

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const text of ['v0.8.1', '首頁流程', '新手教學模式', '發布檢查清單', '免 Cloud Functions', '手機牌桌 UI 優化']) {
  if (!index.includes(text)) throw new Error(`index.html 缺少：${text}`);
}

const constants = fs.readFileSync(path.join(root, 'src/constants.js'), 'utf8');
if (!constants.includes("VERSION = '0.8.1'")) {
  throw new Error('src/constants.js 版本不是 0.8.1');
}

console.log('Release readiness tests passed.');
