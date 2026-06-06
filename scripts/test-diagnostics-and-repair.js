import fs from 'node:fs';
const read=(f)=>fs.readFileSync(new URL(`../${f}`,import.meta.url),'utf8');
const index=read('index.html'), pwa=read('src/pwa.js'), main=read('src/main.js'), sw=read('service-worker.js');
for (const token of ['pwaRepairBtn','pwaApplyUpdateBtn','pwaClearCachesBtn','pwaReloadBtn','downloadDebugBtn']) if(!index.includes(token)) throw new Error(`缺少診斷／修復 UI：${token}`);
for (const token of ['repairPwa','getPwaDiagnostics','clearOldPwaCaches','window.big2PwaApi','REPAIR_PWA']) if(!pwa.includes(token)) throw new Error(`缺少 PWA 修復流程：${token}`);
for (const token of ['downloadDebugReport','runtimeErrors','firebasePresence','pwaDiagnostics']) if(!main.includes(token)) throw new Error(`缺少診斷匯出：${token}`);
for (const token of ['REPAIR_PWA','CLEAR_OLD_CACHES','cleanupAppCaches']) if(!sw.includes(token)) throw new Error(`Service Worker 缺少：${token}`);
console.log('Diagnostics and PWA repair tests passed.');
