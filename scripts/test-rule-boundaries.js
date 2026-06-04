import assert from 'node:assert/strict';
import { chooseAIMove } from '../src/ai.js';
import { DEFAULT_RULES, HAND_TYPES } from '../src/constants.js';
import { getRulePreset } from '../src/game-settings.js';
import { calculateResults, mergeSeriesTotals } from '../src/scoring.js';
import { canBeat, canPass, detectHandType, getLegalMoves, summarizeLegalMoves, validateHumanPlay } from '../src/rules.js';
import { createGameFromSeats, passTurn, playCards } from '../src/game-state.js';

function c(id) {
  return { id, suit: id[0], rank: id.slice(1) };
}

const taiwan = getRulePreset('taiwanC3');
const friendlyWheel = getRulePreset('friendlyWheel');
const looseTwo = getRulePreset('looseTwoStraight');

// 單張 / 對子 / 三條大小與花色比較。
assert.ok(canBeat(detectHandType([c('S3')], taiwan), detectHandType([c('H3')], taiwan)));
assert.ok(canBeat(detectHandType([c('D4'), c('S4')], taiwan), detectHandType([c('C4'), c('H4')], taiwan)));
assert.ok(canBeat(detectHandType([c('C5'), c('D5'), c('H5')], taiwan), detectHandType([c('C4'), c('D4'), c('H4')], taiwan)));

// 4 張不能直接出，鐵支必須 5 張。
assert.equal(detectHandType([c('C9'), c('D9'), c('H9'), c('S9')], taiwan), null);
assert.equal(detectHandType([c('C9'), c('D9'), c('H9'), c('S9'), c('CA')], taiwan).id, HAND_TYPES.FOUR_KIND.id);

// 台灣常用不開 A2345；朋友局開啟後視為 5 高順。
const wheel = [c('SA'), c('D2'), c('C3'), c('H4'), c('C5')];
assert.equal(detectHandType(wheel, taiwan), null);
assert.equal(detectHandType(wheel, friendlyWheel).id, HAND_TYPES.STRAIGHT.id);

// 台灣常用順子不含 2；寬鬆變體可含 2。
const highTwoStraight = [c('SJ'), c('DQ'), c('HK'), c('CA'), c('D2')];
assert.equal(detectHandType(highTwoStraight, taiwan), null);
assert.equal(detectHandType(highTwoStraight, looseTwo).id, HAND_TYPES.STRAIGHT.id);

// 五張牌型順序：順子 < 同花 < 葫蘆 < 鐵支 < 同花順。
const straight = detectHandType([c('C3'), c('D4'), c('H5'), c('S6'), c('C7')], taiwan);
const flush = detectHandType([c('C4'), c('C8'), c('CJ'), c('CQ'), c('CA')], taiwan);
const fullHouse = detectHandType([c('C6'), c('D6'), c('H6'), c('D9'), c('S9')], taiwan);
const fourKind = detectHandType([c('C8'), c('D8'), c('H8'), c('S8'), c('C3')], taiwan);
const straightFlush = detectHandType([c('S8'), c('S9'), c('S10'), c('SJ'), c('SQ')], taiwan);
assert.ok(canBeat(flush, straight));
assert.ok(canBeat(fullHouse, flush));
assert.ok(canBeat(fourKind, fullHouse));
assert.ok(canBeat(straightFlush, fourKind));

// 第一手一定要包含起手牌。
const firstGame = {
  rules: taiwan,
  currentTurnSeat: 0,
  isFirstPlay: true,
  lastPlay: null,
  players: [{ hand: [c('C3'), c('D3'), c('H4')] }]
};
assert.equal(validateHumanPlay([c('D3')], firstGame).ok, false);
assert.equal(validateHumanPlay([c('C3')], firstGame).ok, true);

// Pass 流程：領出不能 Pass；有人出牌後才能 Pass；三家 Pass 後回到領出者。
const seats = [
  { seat: 0, name: 'Fox', uid: 'u1', isAI: false, connected: true },
  { seat: 1, name: '良', uid: 'u2', isAI: false, connected: true },
  { seat: 2, name: 'AI 3', uid: 'ai-2', isAI: true, connected: false },
  { seat: 3, name: 'AI 4', uid: 'ai-3', isAI: true, connected: false }
];
const game = createGameFromSeats(seats, { rules: taiwan, gameId: 'boundary-game' });
assert.equal(canPass(game), false);
const firstMoves = getLegalMoves(game.players[game.currentTurnSeat].hand, null, { rules: taiwan, requireCardId: 'C3' });
const leadSeat = game.currentTurnSeat;
playCards(game, leadSeat, firstMoves[0].cards);
assert.equal(canPass(game), true);
passTurn(game, game.currentTurnSeat);
passTurn(game, game.currentTurnSeat);
passTurn(game, game.currentTurnSeat);
assert.equal(game.currentTurnSeat, leadSeat);
assert.equal(game.lastPlay, null);
assert.equal(game.passCount, 0);

// 可出牌掃描有摘要，且無牌可壓時 Pass 不需要多餘確認邏輯。
const summary = summarizeLegalMoves([c('C4'), c('D4'), c('H9'), c('S2')], detectHandType([c('C3')], taiwan), { rules: taiwan });
assert.ok(summary.count >= 1);
assert.ok(summary.typeText.includes('單張'));
const noMoveSummary = summarizeLegalMoves([c('C4')], detectHandType([c('S2')], taiwan), { rules: taiwan });
assert.equal(noMoveSummary.count, 0);

// AI 高難度不得回傳不合法牌；對手剩 1 張時要優先攔截。
const lastPair = detectHandType([c('C7'), c('D7')], taiwan);
const aiHand = [c('C8'), c('D8'), c('H3'), c('S4'), c('CA'), c('D2')];
const aiDecision = chooseAIMove({
  rules: taiwan,
  players: [
    { seat: 0, name: 'Fox', hand: [c('C5')] },
    { seat: 1, name: 'AI', hand: aiHand },
    { seat: 2, name: '良', hand: [c('S2')] },
    { seat: 3, name: 'AI 4', hand: [c('D5'), c('H5')] }
  ],
  currentTurnSeat: 1,
  lastPlay: { ...lastPair, seat: 0, playerName: 'Fox' },
  isFirstPlay: false
}, aiHand, 20);
assert.equal(aiDecision.type, 'PLAY');
assert.equal(aiDecision.play.size, 2);
assert.ok(canBeat(aiDecision.play, lastPair));

// 結算與累計不可重複套用同一 gameNo。
const results = calculateResults([
  { seat: 0, name: 'Fox', hand: [] },
  { seat: 1, name: '良', hand: [c('C3'), c('D3')] },
  { seat: 2, name: 'AI 3', hand: [c('H4')] },
  { seat: 3, name: 'AI 4', hand: [c('S5'), c('S6'), c('S7')] }
], 0);
const totals1 = mergeSeriesTotals({}, results, seats, 3);
const totals2 = mergeSeriesTotals(totals1, results, seats, 3);
assert.equal(totals1[0].totalScore, totals2[0].totalScore);
assert.equal(totals1[0].games, totals2[0].games);

console.log('Rule boundary tests passed.');
