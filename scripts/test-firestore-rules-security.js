import fs from 'node:fs';
import assert from 'node:assert/strict';
const rules = fs.readFileSync('firestore.rules', 'utf8');
assert.match(rules, /allow read: if signedIn\(\)/);
assert.match(rules, /isRoomMember\(resource\.data\) \|\| validNewMemberJoin\(\)/);
assert.match(rules, /status == 'waiting'.*status == 'finished'/s);
assert.match(rules, /affectedKeys\(\)\.size\(\) == 1/);
assert.match(rules, /resource\.data\.hostUid == request\.auth\.uid/);
console.log('Firestore Rules security review tests passed.');
