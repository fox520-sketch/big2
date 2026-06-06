import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pages = ['index.html', 'offline.html', 'privacy.html'];
const missing = [];

function checkReference(fromFile, reference) {
  if (!reference || /^(?:https?:|data:|mailto:|tel:|#|javascript:)/i.test(reference)) return;
  const clean = reference.split(/[?#]/)[0];
  if (!clean || clean === './' || clean === '/') return;
  const target = path.resolve(root, path.dirname(fromFile), clean);
  if (!fs.existsSync(target)) missing.push(`${fromFile} → ${reference}`);
}

for (const page of pages) {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) checkReference(page, match[1]);
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
for (const icon of manifest.icons || []) checkReference('manifest.webmanifest', icon.src);
for (const shortcut of manifest.shortcuts || []) {
  checkReference('manifest.webmanifest', shortcut.url);
  for (const icon of shortcut.icons || []) checkReference('manifest.webmanifest', icon.src);
}

const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const shellBlock = sw.match(/const APP_SHELL_PATHS = \[([\s\S]*?)\];/);
if (!shellBlock) throw new Error('找不到 Service Worker APP_SHELL_PATHS');
for (const match of shellBlock[1].matchAll(/['"](\.\/[^'"]+)['"]/g)) checkReference('service-worker.js', match[1]);

if (missing.length) throw new Error(`缺少靜態資源：\n${missing.join('\n')}`);
console.log('Static asset path tests passed.');
