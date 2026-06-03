import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cardsFromIds,
  createGameFromSeats,
  normalizeRules,
  playCards,
  passTurn,
  runAITurn,
  validatePlayForSeat
} from '../functions/lib/game-engine.js';

test('Cloud Functions engine creates a server-authoritative game', () => {
  const seats = [
    { seat: 0, name: 'Fox', uid: 'u1', isAI: false, connected: true },
    { seat: 1, name: '良', uid: 'u2', isAI: false, connected: true },
    { seat: 2, name: 'AI 3', uid: 'ai-seat-2', isAI: true, connected: false },
    { seat: 3, name: 'AI 4', uid: 'ai-seat-3', isAI: true, connected: false }
  ];
  const game = createGameFromSeats(seats, { aiLevel: 12, rules: normalizeRules(), gameId: 'test-game' });
  assert.equal(game.players.length, 4);
  assert.equal(game.players.reduce((sum, player) => sum + player.hand.length, 0), 52);
  assert.equal(game.security.serverAuthoritative, true);
  assert.ok(game.players.some((player) => player.hand.some((card) => card.id === game.rules.firstCardId)));
});

test('Server validation rejects cards that are not in the current player hand', () => {
  const game = createGameFromSeats([
    { seat: 0, name: 'P1', uid: 'u1', isAI: false, connected: true },
    { seat: 1, name: 'P2', uid: 'u2', isAI: false, connected: true },
    { seat: 2, name: 'AI 3', isAI: true },
    { seat: 3, name: 'AI 4', isAI: true }
  ], { gameId: 'test-game-2' });
  const seat = game.currentTurnSeat;
  const otherCard = game.players.find((player) => player.seat !== seat).hand[0];
  assert.throws(() => validatePlayForSeat(game, seat, [otherCard]), /不在目前玩家手牌/);
});

test('First play must contain the configured first card', () => {
  const game = createGameFromSeats([
    { seat: 0, name: 'P1', uid: 'u1', isAI: false, connected: true },
    { seat: 1, name: 'P2', uid: 'u2', isAI: false, connected: true },
    { seat: 2, name: 'AI 3', isAI: true },
    { seat: 3, name: 'AI 4', isAI: true }
  ], { gameId: 'test-game-3' });
  const seat = game.currentTurnSeat;
  const firstCard = game.players[seat].hand.find((card) => card.id === game.rules.firstCardId);
  assert.ok(firstCard);
  const afterPlay = playCards(game, seat, [firstCard]);
  assert.equal(afterPlay.isFirstPlay, false);
});

test('AI turn is processed through server engine', () => {
  const game = createGameFromSeats([
    { seat: 0, name: 'AI 1', isAI: true },
    { seat: 1, name: 'AI 2', isAI: true },
    { seat: 2, name: 'AI 3', isAI: true },
    { seat: 3, name: 'AI 4', isAI: true }
  ], { gameId: 'test-game-4', aiLevel: 8 });
  const beforeSeat = game.currentTurnSeat;
  const beforeCount = game.players[beforeSeat].hand.length;
  const updated = runAITurn(game);
  assert.ok(updated.players[beforeSeat].hand.length < beforeCount || updated.lastAction?.type === 'PASS');
});

console.log('Cloud Functions logic tests passed.');
