import fs from 'node:fs';
import assert from 'node:assert/strict';

const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');
const pwa = fs.readFileSync('src/pwa.js', 'utf8');
const main = fs.readFileSync('src/main.js', 'utf8');
const room = fs.readFileSync('src/firebase-room.js', 'utf8');
const rules = fs.readFileSync('firestore.rules', 'utf8');

assert.match(index, /pwaRollbackBtn/);
assert.match(index, /rules-security/);
assert.match(index, /rollback-drill/);
assert.match(sw, /ROLLBACK_TO_PREVIOUS/);
assert.match(sw, /RESTORE_CURRENT_VERSION/);
assert.match(sw, /preservePrevious/);
assert.match(pwa, /rollbackToPreviousVersion/);
assert.match(main, /AI_TURN_LEASE_PREFIX/);
assert.match(room, /任何仍在房內的真人/);
assert.match(rules, /isRoomMember/);
assert.match(rules, /validNewMemberJoin/);
for (const file of ['docs/RC_ACCEPTANCE_CHECKLIST.md','docs/KNOWN_LIMITATIONS.md','docs/ROLLBACK_GUIDE.md','docs/FIREBASE_USAGE_GUIDE.md','docs/FIRESTORE_RULES_SECURITY_REVIEW.md']) {
  assert.ok(fs.existsSync(file), `${file} missing`);
}
console.log('v0.8.4 release candidate tests passed.');
