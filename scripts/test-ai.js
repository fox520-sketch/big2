import assert from 'node:assert/strict';
import { chooseAIMove, getAILevelDescription, getAILevelLabel } from '../src/ai.js';
import { DEFAULT_RULES } from '../src/constants.js';
import { detectHandType } from '../src/rules.js';

function c(id) {
  return { id, suit: id[0], rank: id.slice(1) };
}

const leadHand = ['C3', 'D4', 'H5', 'S6', 'C7', 'D9', 'HQ', 'S2'].map(c);
const responseHand = ['C4', 'D6', 'H8', 'S10', 'CQ', 'DK', 'HA', 'C2'].map(c);
const unbeatableSingle = { ...detectHandType([c('S2')], DEFAULT_RULES), cards: [c('S2')], seat: 0, playerName: 'Fox' };

for (let level = 1; level <= 20; level += 1) {
  assert.ok(getAILevelLabel(level).includes(`Lv.${level}`));
  assert.equal(typeof getAILevelDescription(level), 'string');

  const leadGame = {
    rules: DEFAULT_RULES,
    players: [
      { seat: 0, name: 'Fox', hand: [c('D3'), c('H3')] },
      { seat: 1, name: 'AI 測試', hand: leadHand },
      { seat: 2, name: '良', hand: [c('C5'), c('D5'), c('H5')] },
      { seat: 3, name: 'AI 4', hand: [c('C6')] }
    ],
    currentTurnSeat: 1,
    lastPlay: null,
    isFirstPlay: true
  };
  const leadDecision = chooseAIMove(leadGame, leadHand, level);
  assert.equal(leadDecision.type, 'PLAY');
  assert.ok(leadDecision.play.cards.some((card) => card.id === 'C3'), `level ${level} first play must include C3`);

  const responseGame = {
    rules: DEFAULT_RULES,
    players: [
      { seat: 0, name: 'Fox', hand: [c('D3')] },
      { seat: 1, name: 'AI 測試', hand: responseHand },
      { seat: 2, name: '良', hand: [c('C5'), c('D5')] },
      { seat: 3, name: 'AI 4', hand: [c('C6'), c('D6')] }
    ],
    currentTurnSeat: 1,
    lastPlay: unbeatableSingle,
    isFirstPlay: false
  };
  const responseDecision = chooseAIMove(responseGame, responseHand, level);
  assert.equal(responseDecision.type, 'PASS');
}

console.log('AI level tests passed.');
