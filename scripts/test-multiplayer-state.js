import assert from 'node:assert/strict';
import { createGameFromSeats, playCards, passTurn } from '../src/game-state.js';
import { getLegalMoves } from '../src/rules.js';
import { calculateResults } from '../src/scoring.js';

const seats = [
  { seat: 0, name: 'Fox', uid: 'u1', isAI: false, connected: true },
  { seat: 1, name: '良', uid: 'u2', isAI: false, connected: true },
  { seat: 2, name: 'AI 3', uid: 'ai-seat-2', isAI: true, connected: false },
  { seat: 3, name: 'AI 4', uid: 'ai-seat-3', isAI: true, connected: false }
];

const game = createGameFromSeats(seats, { aiLevel: 12, gameId: 'test-game' });
assert.equal(game.players.length, 4);
assert.equal(game.players.reduce((sum, player) => sum + player.hand.length, 0), 52);
assert.equal(new Set(game.players.flatMap((player) => player.hand.map((card) => card.id))).size, 52);
assert.equal(game.players[0].name, 'Fox');
assert.equal(game.players[1].name, '良');
assert.equal(game.players[2].isAI, true);
assert.equal(game.players[3].isAI, true);
assert.equal(game.mode, 'multiplayer');

const firstPlayer = game.players[game.currentTurnSeat];
const firstMoves = getLegalMoves(firstPlayer.hand, null, {
  rules: game.rules,
  requireCardId: game.rules.firstCardId
});
assert.ok(firstMoves.length > 0, '持有梅花 3 的玩家必須有合法起手');

const afterPlay = playCards(game, game.currentTurnSeat, firstMoves[0].cards);
assert.equal(afterPlay.isFirstPlay, false);
assert.ok(afterPlay.lastPlay);

if (afterPlay.currentTurnSeat !== afterPlay.leadSeat) {
  const afterPass = passTurn(afterPlay, afterPlay.currentTurnSeat);
  assert.ok(afterPass.passCount >= 1 || afterPass.lastPlay === null);
}

const customResults = calculateResults([
  { seat: 0, name: 'Fox', uid: 'u1', isAI: false, hand: [{ id: 'D3' }, { id: 'H4' }] },
  { seat: 1, name: '良', uid: 'u2', isAI: false, hand: [] },
  { seat: 2, name: 'AI 3', uid: 'ai-seat-2', isAI: true, hand: [{ id: 'C5' }] },
  { seat: 3, name: 'AI 4', uid: 'ai-seat-3', isAI: true, hand: [{ id: 'S6' }, { id: 'S7' }, { id: 'S8' }] }
], 1);
assert.deepEqual(customResults.map((row) => row.name), ['良', 'AI 3', 'Fox', 'AI 4']);
assert.equal(customResults[0].score, 6);
assert.equal(customResults[0].remaining, 0);
assert.equal(customResults.find((row) => row.name === 'Fox').remaining, 2);

console.log('Multiplayer state tests passed.');
