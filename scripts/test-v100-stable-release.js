import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (file) => fs.readFileSync(file, 'utf8');
const pkg = JSON.parse(read('package.json'));
const index = read('index.html');
const constants = read('src/constants.js');
const sw = read('service-worker.js');
const readme = read('README.md');

assert.equal(pkg.version, '1.0.0');
assert.match(constants, /VERSION = '1\.0\.0'/);
assert.match(constants, /RELEASE_CHANNEL = 'stable'/);
assert.match(constants, /FEATURE_FREEZE = true/);
assert.match(sw, /APP_VERSION = '1\.0\.0'/);
assert.match(index, /v1\.0\.0 正式穩定/);
assert.match(index, /id="advancedSupportPanel"/);
assert.match(index, /進階支援與診斷/);
assert.match(index, /功能凍結/);
assert.match(index, /docs\/GITHUB_RELEASE\.md/);
assert.match(index, /docs\/BACKUP_AND_RECOVERY\.md/);
assert.match(readme, /v1\.0\.0 正式穩定版/);
for (const file of [
  'docs/RELEASE_NOTES_V1.0.0.md',
  'docs/GITHUB_RELEASE.md',
  'docs/STABLE_RELEASE_CHECKLIST.md',
  'docs/BACKUP_AND_RECOVERY.md',
  'docs/FEATURE_FREEZE_POLICY.md',
  'docs/KNOWN_LIMITATIONS.md',
  'docs/ROLLBACK_GUIDE.md'
]) assert.ok(fs.existsSync(file), `${file} missing`);
for (const forbidden of ['functions', 'node_modules', '.env', '.env.local', 'firebase.json', '.firebaserc']) {
  assert.ok(!fs.existsSync(forbidden), `${forbidden} should not be included`);
}
console.log('v1.0.0 stable release tests passed.');
