import assert from 'node:assert/strict';
import { detectHandType, canBeat, getLegalMoves } from '../src/rules.js';
import { DEFAULT_RULES } from '../src/constants.js';

function c(id) {
  const suit = id[0];
  const rank = id.slice(1);
  return { id, suit, rank };
}

const singleC3 = detectHandType([c('C3')]);
const singleD3 = detectHandType([c('D3')]);
const singleS2 = detectHandType([c('S2')]);
assert.equal(singleC3.name, '單張');
assert.equal(canBeat(singleD3, singleC3), true);
assert.equal(canBeat(singleS2, singleD3), true);

const pair4 = detectHandType([c('C4'), c('D4')]);
const pair5 = detectHandType([c('C5'), c('D5')]);
assert.equal(pair4.name, '對子');
assert.equal(canBeat(pair5, pair4), true);

const triple7 = detectHandType([c('C7'), c('D7'), c('H7')]);
assert.equal(triple7.name, '三條');

const straight = detectHandType([c('C3'), c('D4'), c('H5'), c('S6'), c('C7')], DEFAULT_RULES);
assert.equal(straight.name, '順子');

const flush = detectHandType([c('C3'), c('C6'), c('C8'), c('CJ'), c('CA')], DEFAULT_RULES);
assert.equal(flush.name, '同花');
assert.equal(canBeat(flush, straight), true);

const fullHouse = detectHandType([c('C9'), c('D9'), c('H9'), c('CK'), c('DK')]);
assert.equal(fullHouse.name, '葫蘆');
assert.equal(canBeat(fullHouse, flush), true);

const fourKind = detectHandType([c('C10'), c('D10'), c('H10'), c('S10'), c('CA')]);
assert.equal(fourKind.name, '鐵支');
assert.equal(canBeat(fourKind, fullHouse), true);

const straightFlush = detectHandType([c('S8'), c('S9'), c('S10'), c('SJ'), c('SQ')]);
assert.equal(straightFlush.name, '同花順');
assert.equal(canBeat(straightFlush, fourKind), true);

const invalidStraightWithTwo = detectHandType([c('S10'), c('SJ'), c('SQ'), c('SK'), c('S2')], DEFAULT_RULES);
assert.equal(invalidStraightWithTwo?.name, '同花');

const hand = [c('C3'), c('D3'), c('H4'), c('S5'), c('C6'), c('D7')];
const firstMoves = getLegalMoves(hand, null, { rules: DEFAULT_RULES, requireCardId: 'C3' });
assert.ok(firstMoves.every((move) => move.cards.some((card) => card.id === 'C3')));
assert.ok(firstMoves.length > 0);

console.log('All rule tests passed.');
