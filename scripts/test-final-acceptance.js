import fs from 'node:fs';
const exists=(f)=>fs.existsSync(new URL(`../${f}`,import.meta.url));
for (const file of ['docs/FINAL_ACCEPTANCE_CHECKLIST.md','docs/TROUBLESHOOTING.md','docs/DIAGNOSTIC_REPORT.md']) if(!exists(file)) throw new Error(`缺少正式驗收文件：${file}`);
const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
if(pkg.version!=='0.8.2') throw new Error('package 版本不是 0.8.2');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
if(!index.includes('正式上線驗收與問題回報')||!index.includes('docs/FINAL_ACCEPTANCE_CHECKLIST.md')) throw new Error('首頁缺少正式驗收區塊');
console.log('Final acceptance tests passed.');
