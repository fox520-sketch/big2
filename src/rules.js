import { DEFAULT_RULES, HAND_TYPES } from './constants.js';
import {
  cardLabel,
  cardPower,
  getRankInfo,
  getSuitInfo,
  groupByRank,
  hasCard,
  sortCards,
  sortCardsDesc
} from './cards.js';

function unique(values) {
  return [...new Set(values)];
}

function countRanks(cards) {
  return groupByRank(cards).map((group) => ({
    rank: group[0].rank,
    rankValue: getRankInfo(group[0]).value,
    cards: group,
    count: group.length
  }));
}

function isWheelStraight(cards) {
  const ranks = new Set(cards.map((card) => card.rank));
  return ranks.size === 5 && ['A', '2', '3', '4', '5'].every((rank) => ranks.has(rank));
}

function isStraight(cards, rules = DEFAULT_RULES) {
  if (cards.length !== 5) return false;
  const rankValues = sortCards(cards).map((card) => getRankInfo(card).value);
  const uniqueRanks = unique(rankValues);
  if (uniqueRanks.length !== 5) return false;

  const wheelStraight = isWheelStraight(cards);
  if (wheelStraight) return Boolean(rules.allowWheelStraight);

  const hasTwo = cards.some((card) => card.rank === '2');
  if (hasTwo && !rules.allowStraightWithTwo) return false;

  const min = Math.min(...uniqueRanks);
  const max = Math.max(...uniqueRanks);
  return max - min === 4 && uniqueRanks.every((value, index) => value === min + index);
}

function getStraightHigh(cards, rules = DEFAULT_RULES) {
  if (rules.allowWheelStraight && isWheelStraight(cards)) {
    const fiveCards = cards.filter((card) => card.rank === '5');
    return Math.max(...fiveCards.map((card) => cardPower(card)));
  }
  return Math.max(...cards.map((card) => cardPower(card)));
}

function getFlushTieValues(cards) {
  return sortCardsDesc(cards).map((card) => cardPower(card));
}

function compareValueArrays(aValues, bValues) {
  const length = Math.max(aValues.length, bValues.length);
  for (let i = 0; i < length; i += 1) {
    const a = aValues[i] ?? -1;
    const b = bValues[i] ?? -1;
    if (a !== b) return a - b;
  }
  return 0;
}

export function detectHandType(cards, rules = DEFAULT_RULES) {
  const sorted = sortCards(cards);
  const size = sorted.length;
  const rankGroups = countRanks(sorted);
  const rankCounts = rankGroups.map((group) => group.count).sort((a, b) => a - b).join(',');
  const isFlush = size === 5 && sorted.every((card) => card.suit === sorted[0].suit);
  const straight = size === 5 && isStraight(sorted, rules);

  if (size === 1) {
    const high = sorted[0];
    return {
      ...HAND_TYPES.SINGLE,
      cards: sorted,
      mainValue: cardPower(high),
      tieValues: [cardPower(high)],
      label: `${HAND_TYPES.SINGLE.name} ${cardLabel(high)}`
    };
  }

  if (size === 2 && rankGroups.length === 1) {
    const high = sortCardsDesc(sorted)[0];
    return {
      ...HAND_TYPES.PAIR,
      cards: sorted,
      mainValue: cardPower(high),
      tieValues: [cardPower(high)],
      label: `${HAND_TYPES.PAIR.name} ${cardLabel(high)}`
    };
  }

  if (size === 3 && rankGroups.length === 1) {
    const high = sortCardsDesc(sorted)[0];
    return {
      ...HAND_TYPES.TRIPLE,
      cards: sorted,
      mainValue: getRankInfo(high).value,
      tieValues: [getRankInfo(high).value],
      label: `${HAND_TYPES.TRIPLE.name} ${cardLabel(high)}`
    };
  }

  if (size !== 5) return null;

  if (straight && isFlush) {
    return {
      ...HAND_TYPES.STRAIGHT_FLUSH,
      cards: sorted,
      mainValue: getStraightHigh(sorted, rules),
      tieValues: [getStraightHigh(sorted, rules)],
      label: HAND_TYPES.STRAIGHT_FLUSH.name
    };
  }

  if (rankCounts === '1,4') {
    const fourGroup = rankGroups.find((group) => group.count === 4);
    const high = sortCardsDesc(fourGroup.cards)[0];
    return {
      ...HAND_TYPES.FOUR_KIND,
      cards: sorted,
      mainValue: getRankInfo(high).value,
      tieValues: [getRankInfo(high).value],
      label: `${HAND_TYPES.FOUR_KIND.name} ${getRankInfo(high).label}`
    };
  }

  if (rankCounts === '2,3') {
    const tripleGroup = rankGroups.find((group) => group.count === 3);
    const high = sortCardsDesc(tripleGroup.cards)[0];
    return {
      ...HAND_TYPES.FULL_HOUSE,
      cards: sorted,
      mainValue: getRankInfo(high).value,
      tieValues: [getRankInfo(high).value],
      label: `${HAND_TYPES.FULL_HOUSE.name} ${getRankInfo(high).label}`
    };
  }

  if (isFlush) {
    const tieValues = getFlushTieValues(sorted);
    return {
      ...HAND_TYPES.FLUSH,
      cards: sorted,
      mainValue: tieValues[0],
      tieValues,
      label: HAND_TYPES.FLUSH.name
    };
  }

  if (straight) {
    return {
      ...HAND_TYPES.STRAIGHT,
      cards: sorted,
      mainValue: getStraightHigh(sorted, rules),
      tieValues: [getStraightHigh(sorted, rules)],
      label: HAND_TYPES.STRAIGHT.name
    };
  }

  return null;
}

export function comparePlays(playA, playB) {
  if (!playA || !playB) return 0;
  if (playA.size !== playB.size) return Number.NEGATIVE_INFINITY;

  if (playA.size === 5 && playA.id !== playB.id) {
    return playA.fivePower - playB.fivePower;
  }

  return compareValueArrays(playA.tieValues, playB.tieValues);
}

export function canBeat(candidate, lastPlay) {
  if (!candidate) return false;
  if (!lastPlay) return true;
  return comparePlays(candidate, lastPlay) > 0;
}

function combinations(cards, pickCount) {
  const results = [];
  const current = [];

  function dfs(start) {
    if (current.length === pickCount) {
      results.push([...current]);
      return;
    }
    for (let i = start; i <= cards.length - (pickCount - current.length); i += 1) {
      current.push(cards[i]);
      dfs(i + 1);
      current.pop();
    }
  }

  dfs(0);
  return results;
}

export function getAllCandidatePlays(hand, rules = DEFAULT_RULES) {
  const sorted = sortCards(hand);
  const candidates = [];
  const sizes = [1, 2, 3, 5];

  for (const size of sizes) {
    for (const cards of combinations(sorted, size)) {
      const type = detectHandType(cards, rules);
      if (type) candidates.push(type);
    }
  }

  return candidates.sort((a, b) => {
    if (a.size !== b.size) return a.size - b.size;
    if (a.size === 5 && a.fivePower !== b.fivePower) return a.fivePower - b.fivePower;
    return compareValueArrays(a.tieValues, b.tieValues);
  });
}

export function getLegalMoves(hand, lastPlay, options = {}) {
  const rules = options.rules ?? DEFAULT_RULES;
  const requireCardId = options.requireCardId ?? null;
  return getAllCandidatePlays(hand, rules).filter((candidate) => {
    if (requireCardId && !hasCard(candidate.cards, requireCardId)) return false;
    return canBeat(candidate, lastPlay);
  });
}

export function validateHumanPlay(cards, gameState) {
  const uniqueCardIds = new Set(cards.map((card) => card.id));
  if (uniqueCardIds.size !== cards.length) {
    return { ok: false, message: '選牌中有重複牌，請重新選擇。' };
  }

  const currentPlayer = gameState.players?.[gameState.currentTurnSeat];
  if (currentPlayer?.hand && cards.some((card) => !hasCard(currentPlayer.hand, card.id))) {
    return { ok: false, message: '選牌不在目前玩家手牌中，已阻擋異常出牌。' };
  }

  const play = detectHandType(cards, gameState.rules);
  if (!play) {
    return { ok: false, message: '這不是合法牌型。' };
  }

  if (gameState.isFirstPlay && !hasCard(cards, gameState.rules.firstCardId)) {
    return { ok: false, message: `第一手必須包含${gameState.rules.firstCardName || gameState.rules.firstCardId}。` };
  }

  if (gameState.lastPlay && !canBeat(play, gameState.lastPlay)) {
    return { ok: false, message: `必須出同張數且大於上一手：${gameState.lastPlay.label}。` };
  }

  return { ok: true, play };
}

export function describePlay(play) {
  if (!play) return '尚未出牌';
  const cards = play.cards.map(cardLabel).join(' ');
  return `${play.label}｜${cards}`;
}

export function canPass(gameState) {
  return Boolean(gameState.lastPlay) && !gameState.isFirstPlay;
}

export function suitText(card) {
  return getSuitInfo(card).symbol;
}
