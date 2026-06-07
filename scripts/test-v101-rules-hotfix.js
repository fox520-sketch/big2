import fs from 'node:fs';
import assert from 'node:assert/strict';

const rules = fs.readFileSync('firestore.rules', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const constants = fs.readFileSync('src/constants.js', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

assert.equal(pkg.version, '1.0.1');
assert.match(constants, /VERSION = '1\.0\.1'/);
assert.match(sw, /APP_VERSION = '1\.0\.1'/);
assert.match(index, /v1\.0\.1/);
assert.match(rules, /get\('game', null\)/);
assert.match(rules, /get\('gameNo', 0\)/);
assert.match(rules, /get\('passwordEnabled', false\)/);
assert.match(rules, /get\('passwordHash', ''\)/);
assert.match(rules, /get\('passwordHint', ''\)/);
assert.doesNotMatch(rules, /request\.resource\.data\.game == resource\.data\.game/);
assert.ok(fs.existsSync('docs/RELEASE_NOTES_V1.0.1.md'));
console.log('v1.0.1 Firestore Rules hotfix tests passed.');
