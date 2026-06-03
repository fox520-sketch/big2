import assert from 'node:assert/strict';
import { detectHandType, validateHumanPlay } from '../src/rules.js';
import { calculateResults } from '../src/scoring.js';
import { getRulePreset, getScoringPreset } from '../src/game-settings.js';

const wheelCards = [
  { id: 'SA', suit: 'S', rank: 'A' },
  { id: 'D2', suit: 'D', rank: '2' },
  { id: 'C3', suit: 'C', rank: '3' },
  { id: 'H4', suit: 'H', rank: '4' },
  { id: 'C5', suit: 'C', rank: '5' }
];

assert.equal(detectHandType(wheelCards, getRulePreset('taiwanC3')), null);
assert.equal(detectHandType(wheelCards, getRulePreset('friendlyWheel')).id, 'straight');

const fakeCard = { id: 'S2', suit: 'S', rank: '2' };
const gameState = {
  rules: getRulePreset('taiwanC3'),
  currentTurnSeat: 0,
  isFirstPlay: false,
  lastPlay: null,
  players: [{ hand: [{ id: 'C3', suit: 'C', rank: '3' }] }]
};
const invalid = validateHumanPlay([fakeCard], gameState);
assert.equal(invalid.ok, false);
assert.match(invalid.message, /不在目前玩家手牌/);

const players = [
  { seat: 0, name: '贏家', isAI: false, hand: [] },
  { seat: 1, name: '剩 8', isAI: false, hand: Array.from({ length: 8 }, (_, i) => ({ id: `C${i}`, suit: 'C', rank: '3' })) },
  { seat: 2, name: '剩 10', isAI: true, hand: Array.from({ length: 10 }, (_, i) => ({ id: `D${i}`, suit: 'D', rank: '4' })) },
  { seat: 3, name: '剩 1', isAI: true, hand: [{ id: 'H3', suit: 'H', rank: '3' }] }
];
const results = calculateResults(players, 0, getScoringPreset('double8Triple10'));
const winner = results.find((row) => row.seat === 0);
const eight = results.find((row) => row.seat === 1);
const ten = results.find((row) => row.seat === 2);
assert.equal(eight.score, -16);
assert.equal(eight.multiplier, 2);
assert.equal(ten.score, -30);
assert.equal(ten.multiplier, 3);
assert.equal(winner.score, 47);

console.log('Settings and scoring tests passed.');
