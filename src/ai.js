import { DEFAULT_RULES, HAND_TYPES } from './constants.js';
import { cardPower, getRankInfo, removeCards, sortCards, sortCardsDesc } from './cards.js';
import { detectHandType, getAllCandidatePlays, getLegalMoves } from './rules.js';

const FIVE_TYPE_BONUS = {
  [HAND_TYPES.STRAIGHT.id]: 8,
  [HAND_TYPES.FLUSH.id]: 12,
  [HAND_TYPES.FULL_HOUSE.id]: 18,
  [HAND_TYPES.FOUR_KIND.id]: 28,
  [HAND_TYPES.STRAIGHT_FLUSH.id]: 40
};

function clampLevel(level) {
  const value = Number(level);
  if (!Number.isFinite(value)) return 1;
  return Math.min(20, Math.max(1, Math.round(value)));
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function movePower(move) {
  const base = move.tieValues?.reduce((sum, value, index) => sum + value / (index + 1), 0) ?? move.mainValue ?? 0;
  return base + (move.size === 5 ? (FIVE_TYPE_BONUS[move.id] ?? 0) : 0) + move.size * 2;
}

function cardsKey(cards) {
  return sortCards(cards).map((card) => card.id).join('|');
}

function countRanks(hand) {
  const counts = new Map();
  for (const card of hand) counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  return counts;
}

function rankGroupSize(card, rankCounts) {
  return rankCounts.get(card.rank) ?? 1;
}

function isTopCard(card) {
  return ['2', 'A', 'K'].includes(card.rank);
}

function isWeakSingle(move) {
  return move.size === 1 && getRankInfo(move.cards[0]).value <= 5;
}

function breakPenalty(move, hand, level) {
  const rankCounts = countRanks(hand);
  let penalty = 0;

  for (const card of move.cards) {
    const groupSize = rankGroupSize(card, rankCounts);
    if (move.size === 1 && groupSize >= 2) penalty += 8 + groupSize * 3;
    if (move.size === 2 && groupSize >= 3) penalty += 6;
    if (move.size === 3 && groupSize === 4) penalty += 10;
    if (isTopCard(card)) penalty += level >= 12 ? 3 : 1;
  }

  if (move.size === 5 && level >= 10) {
    penalty -= FIVE_TYPE_BONUS[move.id] ?? 0;
  }

  return penalty;
}

function remainingHandScore(hand, move, level) {
  const remaining = sortCards(removeCards(hand, move.cards));
  const candidates = getAllCandidatePlays(remaining, DEFAULT_RULES);
  const singles = remaining.length;
  const pairCount = candidates.filter((candidate) => candidate.id === HAND_TYPES.PAIR.id).length;
  const tripleCount = candidates.filter((candidate) => candidate.id === HAND_TYPES.TRIPLE.id).length;
  const fiveCount = candidates.filter((candidate) => candidate.size === 5).length;
  const highCount = remaining.filter(isTopCard).length;

  return pairCount * 5 + tripleCount * 8 + fiveCount * 4 + highCount * (level >= 12 ? 2 : 1) - singles * 0.25;
}

function smallestMove(moves) {
  return [...moves].sort((a, b) => movePower(a) - movePower(b))[0];
}

function strongestMove(moves) {
  return [...moves].sort((a, b) => movePower(b) - movePower(a))[0];
}

function chooseByScore(moves, scoreFn) {
  return [...moves]
    .map((move) => ({ move, score: scoreFn(move) }))
    .sort((a, b) => a.score - b.score)[0].move;
}

function findGoOutMove(moves, hand) {
  return moves.find((move) => move.cards.length === hand.length) ?? null;
}

function getOpponentPressure(gameState) {
  const currentSeat = gameState.currentTurnSeat;
  const nextSeat = (currentSeat + 1) % 4;
  const nextPlayer = gameState.players[nextSeat];
  const otherPlayers = gameState.players.filter((player) => player.seat !== currentSeat);
  const minCards = Math.min(...otherPlayers.map((player) => player.hand.length));
  return {
    nextCards: nextPlayer?.hand.length ?? 13,
    minCards,
    danger: minCards <= 2 || (nextPlayer?.hand.length ?? 13) <= 2,
    severe: minCards <= 1 || (nextPlayer?.hand.length ?? 13) <= 1
  };
}

function chooseLeadMove(moves, hand, level, gameState) {
  const goOut = findGoOutMove(moves, hand);
  if (goOut) return goOut;

  const pressure = getOpponentPressure(gameState);

  if (level <= 3) return randomItem(moves.slice(0, Math.min(5, moves.length)));
  if (level <= 5) return smallestMove(moves);

  const singles = moves.filter((move) => move.size === 1);
  const pairs = moves.filter((move) => move.size === 2);
  const triples = moves.filter((move) => move.size === 3);
  const fiveCards = moves.filter((move) => move.size === 5);

  if (level <= 8) {
    return smallestMove(singles.length ? singles : moves);
  }

  if (level <= 11) {
    return chooseByScore(moves, (move) => movePower(move) + breakPenalty(move, hand, level) - remainingHandScore(hand, move, level));
  }

  if (level <= 14) {
    const preferred = hand.length <= 6
      ? [...fiveCards, ...triples, ...pairs, ...singles]
      : [...singles.filter(isWeakSingle), ...pairs, ...triples, ...fiveCards, ...singles];
    if (preferred.length) return chooseByScore(preferred, (move) => movePower(move) + breakPenalty(move, hand, level) - remainingHandScore(hand, move, level));
  }

  if (level <= 17) {
    if (pressure.danger) {
      const blockingSizes = moves.filter((move) => move.size >= Math.min(2, pressure.nextCards));
      if (blockingSizes.length) return strongestMove(blockingSizes.slice(-Math.min(6, blockingSizes.length)));
    }
    return chooseByScore(moves, (move) => movePower(move) + breakPenalty(move, hand, level) - remainingHandScore(hand, move, level) * 1.35);
  }

  if (pressure.severe) {
    const hardToBeat = moves.filter((move) => move.size === 5 || move.cards.some((card) => ['2', 'A'].includes(card.rank)));
    if (hardToBeat.length) return strongestMove(hardToBeat);
  }

  const endgame = hand.length <= 5;
  return chooseByScore(moves, (move) => {
    const future = remainingHandScore(hand, move, level);
    const conserve = breakPenalty(move, hand, level);
    const tempoBonus = endgame ? -move.cards.length * 8 : 0;
    const pressureBonus = pressure.danger && movePower(move) > 25 ? -10 : 0;
    return movePower(move) + conserve - future * 1.65 + tempoBonus + pressureBonus;
  });
}

function chooseRespondMove(moves, hand, level, gameState) {
  const goOut = findGoOutMove(moves, hand);
  if (goOut) return goOut;

  const pressure = getOpponentPressure(gameState);

  if (level <= 3) {
    // 初學 AI 有時會亂 Pass，模擬低難度。
    if (Math.random() < 0.28 && gameState.lastPlay) return null;
    return randomItem(moves.slice(0, Math.min(5, moves.length)));
  }

  if (level <= 5) return smallestMove(moves);

  if (level <= 8) {
    const safeMoves = moves.filter((move) => breakPenalty(move, hand, level) <= 12);
    return smallestMove(safeMoves.length ? safeMoves : moves);
  }

  if (level <= 11) {
    return chooseByScore(moves, (move) => movePower(move) + breakPenalty(move, hand, level) - remainingHandScore(hand, move, level) * 0.8);
  }

  if (level <= 14) {
    if (hand.length <= 5) return chooseByScore(moves, (move) => movePower(move) - move.cards.length * 6 + breakPenalty(move, hand, level));
    return chooseByScore(moves, (move) => movePower(move) + breakPenalty(move, hand, level) - remainingHandScore(hand, move, level));
  }

  if (level <= 17) {
    if (pressure.danger) {
      const strongerHalf = [...moves].sort((a, b) => movePower(b) - movePower(a)).slice(0, Math.max(1, Math.ceil(moves.length / 2)));
      return chooseByScore(strongerHalf, (move) => breakPenalty(move, hand, level) - move.cards.length * 3);
    }
    return chooseByScore(moves, (move) => movePower(move) + breakPenalty(move, hand, level) - remainingHandScore(hand, move, level) * 1.2);
  }

  if (pressure.severe) return strongestMove(moves);

  return chooseByScore(moves, (move) => {
    const remaining = removeCards(hand, move.cards);
    const remainingLowSingles = remaining.filter((card) => getRankInfo(card).value <= 5).length;
    return movePower(move) + breakPenalty(move, hand, level) - remainingHandScore(hand, move, level) * 1.5 + remainingLowSingles;
  });
}

export function getAILevelLabel(level) {
  const value = clampLevel(level);
  if (value <= 3) return `Lv.${value} 新手隨機`;
  if (value <= 5) return `Lv.${value} 基礎保守`;
  if (value <= 8) return `Lv.${value} 低牌優先`;
  if (value <= 11) return `Lv.${value} 牌型保留`;
  if (value <= 14) return `Lv.${value} 節奏控制`;
  if (value <= 17) return `Lv.${value} 攔截防守`;
  return `Lv.${value} 高手判斷`;
}

export function getAILevelDescription(level) {
  const value = clampLevel(level);
  if (value <= 3) return '會隨機選擇部分合法牌，偶爾錯過壓牌機會。';
  if (value <= 5) return '以最小可出牌為主，適合剛熟悉規則。';
  if (value <= 8) return '會優先消低牌，避免浪費高牌。';
  if (value <= 11) return '會保留對子、三條與五張牌型，不輕易拆牌。';
  if (value <= 14) return '會依剩牌數調整節奏，接近尾局時加速出牌。';
  if (value <= 17) return '會觀察對手剩牌數，必要時用較強牌攔截。';
  return '會綜合剩牌、牌型完整度、尾局壓制與未來手牌彈性。';
}

export function chooseAIMove(gameState, aiHand, aiLevel = 1) {
  const level = clampLevel(aiLevel);
  const rules = gameState.rules ?? DEFAULT_RULES;
  const legalMoves = getLegalMoves(aiHand, gameState.lastPlay, {
    rules,
    requireCardId: gameState.isFirstPlay ? rules.firstCardId : null
  });

  if (legalMoves.length === 0) return { type: 'PASS', aiLevel: level, reason: '沒有合法牌可出' };

  const leadMode = !gameState.lastPlay || gameState.isFirstPlay;
  const chosen = leadMode
    ? chooseLeadMove(legalMoves, aiHand, level, gameState)
    : chooseRespondMove(legalMoves, aiHand, level, gameState);

  if (!chosen) return { type: 'PASS', aiLevel: level, reason: '低難度選擇 Pass' };

  return {
    type: 'PLAY',
    play: chosen,
    aiLevel: level,
    reason: getAILevelLabel(level)
  };
}
