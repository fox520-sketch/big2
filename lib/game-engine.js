import crypto from 'node:crypto';

export const VERSION = '0.7.0';

export const SUITS = [
  { id: 'C', symbol: '♣', name: '梅花', value: 0, color: 'black' },
  { id: 'D', symbol: '♦', name: '方塊', value: 1, color: 'red' },
  { id: 'H', symbol: '♥', name: '紅心', value: 2, color: 'red' },
  { id: 'S', symbol: '♠', name: '黑桃', value: 3, color: 'black' }
];

export const RANKS = [
  { id: '3', label: '3', value: 0 },
  { id: '4', label: '4', value: 1 },
  { id: '5', label: '5', value: 2 },
  { id: '6', label: '6', value: 3 },
  { id: '7', label: '7', value: 4 },
  { id: '8', label: '8', value: 5 },
  { id: '9', label: '9', value: 6 },
  { id: '10', label: '10', value: 7 },
  { id: 'J', label: 'J', value: 8 },
  { id: 'Q', label: 'Q', value: 9 },
  { id: 'K', label: 'K', value: 10 },
  { id: 'A', label: 'A', value: 11 },
  { id: '2', label: '2', value: 12 }
];

export const HAND_TYPES = {
  SINGLE: { id: 'single', name: '單張', size: 1, fivePower: 0 },
  PAIR: { id: 'pair', name: '對子', size: 2, fivePower: 0 },
  TRIPLE: { id: 'triple', name: '三條', size: 3, fivePower: 0 },
  STRAIGHT: { id: 'straight', name: '順子', size: 5, fivePower: 1 },
  FLUSH: { id: 'flush', name: '同花', size: 5, fivePower: 2 },
  FULL_HOUSE: { id: 'fullHouse', name: '葫蘆', size: 5, fivePower: 3 },
  FOUR_KIND: { id: 'fourKind', name: '鐵支', size: 5, fivePower: 4 },
  STRAIGHT_FLUSH: { id: 'straightFlush', name: '同花順', size: 5, fivePower: 5 }
};

export const DEFAULT_RULES = {
  id: 'taiwanC3',
  name: '台灣常用：梅花 3 起手',
  shortName: '梅花 3',
  firstCardId: 'C3',
  firstCardName: '梅花 3',
  allowStraightWithTwo: false,
  allowWheelStraight: false,
  cardOrderText: '2 > A > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5 > 4 > 3',
  suitOrderText: '黑桃 > 紅心 > 方塊 > 梅花',
  fiveCardText: '順子 < 同花 < 葫蘆 < 鐵支 < 同花順',
  note: '第一手必須含梅花 3；順子不含 2。'
};

export const DEFAULT_SCORING_RULES = {
  id: 'standard',
  name: '標準：剩幾張扣幾分',
  shortName: '標準',
  mode: 'standard',
  doubleAt8: false,
  doubleAt10: false,
  tripleAt10: false,
  note: '輸家每剩 1 張扣 1 分，贏家取得所有輸家扣分總和。'
};

const rankById = new Map(RANKS.map((rank) => [rank.id, rank]));
const suitById = new Map(SUITS.map((suit) => [suit.id, suit]));
const cardById = new Map();

export function createDeck() {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ id: `${suit.id}${rank.id}`, suit: suit.id, rank: rank.id })));
}

for (const card of createDeck()) cardById.set(card.id, card);

export function normalizeRoomId(roomId) {
  return String(roomId || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export function makeRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let index = 0; index < 6; index += 1) {
    id += chars[crypto.randomInt(chars.length)];
  }
  return id;
}

export function normalizePlayerName(name, fallback = '玩家') {
  return String(name || '').trim().slice(0, 18) || fallback;
}

export function clampAILevel(level) {
  const value = Number(level);
  if (!Number.isFinite(value)) return 8;
  return Math.min(20, Math.max(1, Math.round(value)));
}

export function normalizeRules(rules = {}) {
  const base = { ...DEFAULT_RULES, ...(rules || {}) };
  const firstCardId = cardById.has(base.firstCardId) ? base.firstCardId : DEFAULT_RULES.firstCardId;
  return {
    id: String(base.id || DEFAULT_RULES.id).slice(0, 40),
    name: String(base.name || DEFAULT_RULES.name).slice(0, 60),
    shortName: String(base.shortName || DEFAULT_RULES.shortName).slice(0, 20),
    firstCardId,
    firstCardName: String(base.firstCardName || firstCardId).slice(0, 20),
    allowStraightWithTwo: Boolean(base.allowStraightWithTwo),
    allowWheelStraight: Boolean(base.allowWheelStraight),
    cardOrderText: String(base.cardOrderText || DEFAULT_RULES.cardOrderText).slice(0, 80),
    suitOrderText: String(base.suitOrderText || DEFAULT_RULES.suitOrderText).slice(0, 80),
    fiveCardText: String(base.fiveCardText || DEFAULT_RULES.fiveCardText).slice(0, 80),
    note: String(base.note || '').slice(0, 120)
  };
}

export function normalizeScoringRules(scoringRules = {}) {
  const base = { ...DEFAULT_SCORING_RULES, ...(scoringRules || {}) };
  const id = String(base.id || DEFAULT_SCORING_RULES.id).slice(0, 40);
  return {
    id,
    name: String(base.name || DEFAULT_SCORING_RULES.name).slice(0, 60),
    shortName: String(base.shortName || DEFAULT_SCORING_RULES.shortName).slice(0, 20),
    mode: String(base.mode || id || 'standard').slice(0, 40),
    doubleAt8: Boolean(base.doubleAt8),
    doubleAt10: Boolean(base.doubleAt10),
    tripleAt10: Boolean(base.tripleAt10),
    note: String(base.note || '').slice(0, 120)
  };
}

export function scoringMultiplier(remaining, scoringRules = DEFAULT_SCORING_RULES) {
  const rules = normalizeScoringRules(scoringRules);
  if (rules.tripleAt10 && remaining >= 10) return 3;
  if (rules.doubleAt10 && remaining >= 10) return 2;
  if (rules.doubleAt8 && remaining >= 8) return 2;
  if (rules.mode === 'double8' && remaining >= 8) return 2;
  if (rules.mode === 'double10' && remaining >= 10) return 2;
  if (rules.mode === 'double8Triple10' && remaining >= 10) return 3;
  if (rules.mode === 'double8Triple10' && remaining >= 8) return 2;
  return 1;
}

export function ruleSummary(rules = DEFAULT_RULES) {
  const normalized = normalizeRules(rules);
  return `規則：${normalized.shortName || normalized.name}`;
}

export function scoringSummary(scoringRules = DEFAULT_SCORING_RULES) {
  const normalized = normalizeScoringRules(scoringRules);
  return `計分：${normalized.shortName || normalized.name}`;
}

export function cardFromId(cardId) {
  const id = String(cardId || '').trim().toUpperCase();
  const card = cardById.get(id);
  if (!card) throw new Error(`未知牌面：${cardId}`);
  return { ...card };
}

export function cardsFromIds(cardIds) {
  if (!Array.isArray(cardIds)) throw new Error('出牌資料格式錯誤。');
  if (cardIds.length < 1 || cardIds.length > 5) throw new Error('一次只能出 1、2、3 或 5 張牌。');
  const seen = new Set();
  return cardIds.map((id) => {
    const normalized = String(id || '').trim().toUpperCase();
    if (seen.has(normalized)) throw new Error('選牌中有重複牌。');
    seen.add(normalized);
    return cardFromId(normalized);
  });
}

export function getRankInfo(card) {
  const rank = rankById.get(card.rank);
  if (!rank) throw new Error(`Unknown rank: ${card.rank}`);
  return rank;
}

export function getSuitInfo(card) {
  const suit = suitById.get(card.suit);
  if (!suit) throw new Error(`Unknown suit: ${card.suit}`);
  return suit;
}

export function cardPower(card) {
  return getRankInfo(card).value * 4 + getSuitInfo(card).value;
}

export function sortCards(cards) {
  return [...cards].sort((a, b) => cardPower(a) - cardPower(b));
}

export function sortCardsDesc(cards) {
  return [...cards].sort((a, b) => cardPower(b) - cardPower(a));
}

export function cardLabel(card) {
  return `${getSuitInfo(card).symbol}${getRankInfo(card).label}`;
}

export function hasCard(cards, cardId) {
  return (cards || []).some((card) => card.id === cardId);
}

export function removeCards(hand, cardsToRemove) {
  const removeIds = new Set(cardsToRemove.map((card) => card.id));
  return (hand || []).filter((card) => !removeIds.has(card.id));
}

export function shuffleDeck(deck) {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function unique(values) {
  return [...new Set(values)];
}

function groupByRank(cards) {
  const groups = new Map();
  for (const card of cards) {
    if (!groups.has(card.rank)) groups.set(card.rank, []);
    groups.get(card.rank).push(card);
  }
  return [...groups.values()].sort((a, b) => getRankInfo(a[0]).value - getRankInfo(b[0]).value);
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

function compareValueArrays(aValues, bValues) {
  const length = Math.max(aValues.length, bValues.length);
  for (let i = 0; i < length; i += 1) {
    const a = aValues[i] ?? -1;
    const b = bValues[i] ?? -1;
    if (a !== b) return a - b;
  }
  return 0;
}

function getFlushTieValues(cards) {
  return sortCardsDesc(cards).map((card) => cardPower(card));
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
    return { ...HAND_TYPES.SINGLE, cards: sorted, mainValue: cardPower(high), tieValues: [cardPower(high)], label: `${HAND_TYPES.SINGLE.name} ${cardLabel(high)}` };
  }
  if (size === 2 && rankGroups.length === 1) {
    const high = sortCardsDesc(sorted)[0];
    return { ...HAND_TYPES.PAIR, cards: sorted, mainValue: cardPower(high), tieValues: [cardPower(high)], label: `${HAND_TYPES.PAIR.name} ${cardLabel(high)}` };
  }
  if (size === 3 && rankGroups.length === 1) {
    const high = sortCardsDesc(sorted)[0];
    return { ...HAND_TYPES.TRIPLE, cards: sorted, mainValue: getRankInfo(high).value, tieValues: [getRankInfo(high).value], label: `${HAND_TYPES.TRIPLE.name} ${cardLabel(high)}` };
  }
  if (size !== 5) return null;
  if (straight && isFlush) return { ...HAND_TYPES.STRAIGHT_FLUSH, cards: sorted, mainValue: getStraightHigh(sorted, rules), tieValues: [getStraightHigh(sorted, rules)], label: HAND_TYPES.STRAIGHT_FLUSH.name };
  if (rankCounts === '1,4') {
    const fourGroup = rankGroups.find((group) => group.count === 4);
    const high = sortCardsDesc(fourGroup.cards)[0];
    return { ...HAND_TYPES.FOUR_KIND, cards: sorted, mainValue: getRankInfo(high).value, tieValues: [getRankInfo(high).value], label: `${HAND_TYPES.FOUR_KIND.name} ${getRankInfo(high).label}` };
  }
  if (rankCounts === '2,3') {
    const tripleGroup = rankGroups.find((group) => group.count === 3);
    const high = sortCardsDesc(tripleGroup.cards)[0];
    return { ...HAND_TYPES.FULL_HOUSE, cards: sorted, mainValue: getRankInfo(high).value, tieValues: [getRankInfo(high).value], label: `${HAND_TYPES.FULL_HOUSE.name} ${getRankInfo(high).label}` };
  }
  if (isFlush) {
    const tieValues = getFlushTieValues(sorted);
    return { ...HAND_TYPES.FLUSH, cards: sorted, mainValue: tieValues[0], tieValues, label: HAND_TYPES.FLUSH.name };
  }
  if (straight) return { ...HAND_TYPES.STRAIGHT, cards: sorted, mainValue: getStraightHigh(sorted, rules), tieValues: [getStraightHigh(sorted, rules)], label: HAND_TYPES.STRAIGHT.name };
  return null;
}

export function comparePlays(playA, playB) {
  if (!playA || !playB) return 0;
  if (playA.size !== playB.size) return Number.NEGATIVE_INFINITY;
  if (playA.size === 5 && playA.id !== playB.id) return playA.fivePower - playB.fivePower;
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
  const sorted = sortCards(hand || []);
  const candidates = [];
  for (const size of [1, 2, 3, 5]) {
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

export function describePlay(play) {
  if (!play) return '—';
  return play.label || `${play.size} 張牌`;
}

export function validatePlayForSeat(gameState, seat, cards) {
  if (!Number.isInteger(seat) || seat < 0 || seat > 3) throw new Error('座位狀態錯誤。');
  if (gameState.finished) throw new Error('本局已結束。');
  if (gameState.currentTurnSeat !== seat) throw new Error('現在還沒輪到你。');
  const player = gameState.players?.[seat];
  if (!player) throw new Error('玩家狀態不存在。');
  if (cards.some((card) => !hasCard(player.hand, card.id))) throw new Error('選牌不在目前玩家手牌中，已由伺服器阻擋。');
  const play = detectHandType(cards, gameState.rules);
  if (!play) throw new Error('這不是合法牌型。');
  if (gameState.isFirstPlay && !hasCard(cards, gameState.rules.firstCardId)) throw new Error(`第一手必須包含${gameState.rules.firstCardName || gameState.rules.firstCardId}。`);
  if (gameState.lastPlay && !canBeat(play, gameState.lastPlay)) throw new Error(`必須出同張數且大於上一手：${gameState.lastPlay.label}。`);
  return play;
}

export function canPass(gameState) {
  return Boolean(gameState.lastPlay) && !gameState.isFirstPlay;
}

function nextSeat(seat) {
  return (seat + 1) % 4;
}

function appendHistory(gameState, text) {
  gameState.history = [text, ...(gameState.history || [])].slice(0, 80);
}

function finishGame(gameState, winnerSeat) {
  gameState.finished = true;
  gameState.winnerSeat = winnerSeat;
  gameState.results = calculateResults(gameState.players, winnerSeat, gameState.scoringRules);
  gameState.message = `本局結束，${gameState.players[winnerSeat].name} 第一名！`;
  appendHistory(gameState, `本局結束：${gameState.players[winnerSeat].name} 出完手牌。`);
  return gameState;
}

export function playCards(gameState, seat, cards) {
  const player = gameState.players[seat];
  const play = validatePlayForSeat(gameState, seat, cards);
  player.hand = sortCards(removeCards(player.hand, cards));
  gameState.lastPlay = { ...play, seat, playerName: player.name };
  gameState.lastAction = { type: 'PLAY', seat, play: gameState.lastPlay };
  gameState.leadSeat = seat;
  gameState.passCount = 0;
  gameState.isFirstPlay = false;
  gameState.message = `${player.name} 出牌：${describePlay(gameState.lastPlay)}`;
  appendHistory(gameState, `${player.name} 出牌：${describePlay(gameState.lastPlay)}`);
  if (player.hand.length === 0) return finishGame(gameState, seat);
  gameState.currentTurnSeat = nextSeat(seat);
  return gameState;
}

export function passTurn(gameState, seat) {
  if (gameState.finished) throw new Error('本局已結束。');
  if (seat !== gameState.currentTurnSeat) throw new Error('現在還沒輪到你。');
  if (!canPass(gameState)) throw new Error('現在不能 Pass，請領出一手牌。');
  const player = gameState.players[seat];
  gameState.passCount += 1;
  gameState.lastAction = { type: 'PASS', seat };
  appendHistory(gameState, `${player.name} Pass。`);
  if (gameState.passCount >= 3) {
    const leadPlayer = gameState.players[gameState.leadSeat];
    gameState.roundNo += 1;
    gameState.currentTurnSeat = gameState.leadSeat;
    gameState.lastPlay = null;
    gameState.passCount = 0;
    gameState.message = `其他玩家都 Pass，${leadPlayer.name} 取得領出權。`;
    appendHistory(gameState, `第 ${gameState.roundNo} 輪開始，${leadPlayer.name} 領出。`);
    return gameState;
  }
  gameState.currentTurnSeat = nextSeat(seat);
  gameState.message = `${player.name} Pass。`;
  return gameState;
}

function makePlayers(basePlayers, options = {}) {
  const aiLevel = clampAILevel(options.aiLevel);
  const rules = normalizeRules(options.rules || DEFAULT_RULES);
  const scoringRules = normalizeScoringRules(options.scoringRules || DEFAULT_SCORING_RULES);
  const deck = shuffleDeck(createDeck());
  const players = basePlayers.map((player, index) => ({
    seat: index,
    name: player.name || `玩家 ${index + 1}`,
    uid: player.uid || null,
    isAI: Boolean(player.isAI || player.isHuman === false),
    isHuman: !Boolean(player.isAI || player.isHuman === false),
    connected: player.connected !== false,
    aiTakingOver: Boolean(player.aiTakingOver),
    hand: [],
    score: 0,
    rank: null
  }));
  deck.forEach((card, index) => players[index % 4].hand.push(card));
  players.forEach((player) => { player.hand = sortCards(player.hand); });
  const firstSeat = players.find((player) => hasCard(player.hand, rules.firstCardId))?.seat ?? 0;
  const firstMessage = `第 1 輪開始，${players[firstSeat].name} 持有${rules.firstCardName || rules.firstCardId}，必須先出。`;
  return {
    rules,
    players,
    currentTurnSeat: firstSeat,
    leadSeat: firstSeat,
    lastPlay: null,
    lastAction: null,
    passCount: 0,
    isFirstPlay: true,
    finished: false,
    winnerSeat: null,
    results: null,
    roundNo: 1,
    scoringRules,
    security: { revision: 0, lastActionId: null, version: 'cloud-functions-v0.7.0', serverAuthoritative: true },
    history: [firstMessage, scoringSummary(scoringRules), ruleSummary(rules), `AI 難度：Lv.${aiLevel}`],
    message: `${players[firstSeat].name} 先出，第一手必須包含${rules.firstCardName || rules.firstCardId}。`,
    aiLevel
  };
}

export function createGameFromSeats(seatList = [], options = {}) {
  const basePlayers = [];
  for (let seat = 0; seat < 4; seat += 1) {
    const seatData = seatList[seat] || null;
    basePlayers.push({
      seat,
      uid: seatData?.uid || null,
      name: seatData?.name || `AI ${seat + 1}`,
      isAI: Boolean(seatData?.isAI || !seatData),
      isHuman: !Boolean(seatData?.isAI || !seatData),
      connected: seatData?.connected !== false,
      aiTakingOver: Boolean(seatData?.aiTakingOver)
    });
  }
  const game = makePlayers(basePlayers, options);
  game.mode = 'multiplayer';
  game.gameId = options.gameId || `game-${Date.now()}`;
  game.hostUid = options.hostUid || null;
  game.version = VERSION;
  return game;
}

function movePower(move) {
  const bonus = move.size === 5 ? (move.fivePower || 0) * 20 : 0;
  return (move.tieValues || [0]).reduce((sum, value, index) => sum + value / (index + 1), 0) + move.size * 3 + bonus;
}

function chooseSmallest(moves) {
  return [...moves].sort((a, b) => movePower(a) - movePower(b))[0];
}

function chooseStrongest(moves) {
  return [...moves].sort((a, b) => movePower(b) - movePower(a))[0];
}

export function chooseAIMove(gameState, aiHand, aiLevel = 8) {
  const level = clampAILevel(aiLevel);
  const legalMoves = getLegalMoves(aiHand, gameState.lastPlay, {
    rules: gameState.rules,
    requireCardId: gameState.isFirstPlay ? gameState.rules.firstCardId : null
  });
  if (legalMoves.length === 0) return { type: 'PASS' };
  const goOut = legalMoves.find((move) => move.cards.length === aiHand.length);
  if (goOut) return { type: 'PLAY', play: goOut };
  if (level <= 5) return { type: 'PLAY', play: chooseSmallest(legalMoves) };
  const pressure = Math.min(...gameState.players.filter((p) => p.seat !== gameState.currentTurnSeat).map((p) => p.hand.length));
  if (level >= 15 && pressure <= 2 && gameState.lastPlay) return { type: 'PLAY', play: chooseStrongest(legalMoves) };
  const nonBreaking = legalMoves.filter((move) => move.cards.every((card) => {
    const sameRankCount = aiHand.filter((handCard) => handCard.rank === card.rank).length;
    return move.size > 1 || sameRankCount === 1;
  }));
  return { type: 'PLAY', play: chooseSmallest(nonBreaking.length ? nonBreaking : legalMoves) };
}

export function runAITurn(gameState) {
  if (gameState.finished) return gameState;
  const player = gameState.players[gameState.currentTurnSeat];
  if (!player?.isAI && player?.isHuman) throw new Error('目前不是 AI 或離線接管座位的回合。');
  const decision = chooseAIMove(gameState, player.hand, gameState.aiLevel);
  if (decision.type === 'PASS') return passTurn(gameState, player.seat);
  return playCards(gameState, player.seat, decision.play.cards);
}

export function calculateResults(players, winnerSeat, scoringRules = DEFAULT_SCORING_RULES) {
  const normalizedScoring = normalizeScoringRules(scoringRules);
  const rows = players.map((player, index) => {
    const remaining = player.hand.length;
    const seat = Number.isInteger(player.seat) ? player.seat : index;
    const multiplier = seat === winnerSeat ? 1 : scoringMultiplier(remaining, normalizedScoring);
    return {
      seat,
      name: player.name || `玩家 ${seat + 1}`,
      uid: player.uid || null,
      isAI: Boolean(player.isAI),
      isWinner: seat === winnerSeat,
      remaining,
      multiplier,
      penaltyLabel: seat === winnerSeat ? '勝出' : (multiplier > 1 ? `${multiplier} 倍` : '一般'),
      score: seat === winnerSeat ? 0 : -remaining * multiplier,
      rank: 0
    };
  });
  const loserPenaltyTotal = rows.filter((row) => row.seat !== winnerSeat).reduce((sum, row) => sum + Math.abs(row.score), 0);
  for (const row of rows) if (row.seat === winnerSeat) row.score = loserPenaltyTotal;
  rows.sort((a, b) => {
    if (a.seat === winnerSeat) return -1;
    if (b.seat === winnerSeat) return 1;
    if (a.remaining !== b.remaining) return a.remaining - b.remaining;
    return a.seat - b.seat;
  });
  rows.forEach((row, index) => { row.rank = index + 1; });
  return rows;
}

export function makeEmptyTotals(players = []) {
  const totals = {};
  players.forEach((player, index) => {
    const seat = Number.isInteger(player.seat) ? player.seat : index;
    totals[seat] = {
      seat,
      name: player.name || `玩家 ${seat + 1}`,
      uid: player.uid || null,
      isAI: Boolean(player.isAI),
      totalScore: 0,
      wins: 0,
      games: 0,
      latestRank: null,
      latestScore: 0,
      latestRemaining: null,
      updatedGameNo: 0
    };
  });
  return totals;
}

export function mergeSeriesTotals(currentTotals = {}, results = [], players = [], gameNo = 0) {
  const totals = { ...makeEmptyTotals(players), ...(currentTotals || {}) };
  for (const player of players) {
    const seat = Number.isInteger(player.seat) ? player.seat : players.indexOf(player);
    totals[seat] = {
      ...(totals[seat] || {}),
      seat,
      name: player.name || totals[seat]?.name || `玩家 ${seat + 1}`,
      uid: player.uid || totals[seat]?.uid || null,
      isAI: Boolean(player.isAI),
      totalScore: Number(totals[seat]?.totalScore || 0),
      wins: Number(totals[seat]?.wins || 0),
      games: Number(totals[seat]?.games || 0),
      latestRank: totals[seat]?.latestRank ?? null,
      latestScore: Number(totals[seat]?.latestScore || 0),
      latestRemaining: totals[seat]?.latestRemaining ?? null,
      updatedGameNo: Number(totals[seat]?.updatedGameNo || 0)
    };
  }
  for (const row of results) {
    const seat = Number.isInteger(row.seat) ? row.seat : results.indexOf(row);
    const previous = totals[seat] || { seat, name: row.name || `玩家 ${seat + 1}`, uid: row.uid || null, isAI: Boolean(row.isAI), totalScore: 0, wins: 0, games: 0, updatedGameNo: 0 };
    const alreadyApplied = Number(previous.updatedGameNo || 0) === Number(gameNo || 0) && gameNo !== 0;
    totals[seat] = {
      ...previous,
      seat,
      name: row.name || previous.name,
      uid: row.uid || previous.uid || null,
      isAI: Boolean(row.isAI),
      totalScore: Number(previous.totalScore || 0) + (alreadyApplied ? 0 : Number(row.score || 0)),
      wins: Number(previous.wins || 0) + (!alreadyApplied && row.rank === 1 ? 1 : 0),
      games: Number(previous.games || 0) + (alreadyApplied ? 0 : 1),
      latestRank: row.rank,
      latestScore: Number(row.score || 0),
      latestRemaining: Number(row.remaining || 0),
      updatedGameNo: Number(gameNo || previous.updatedGameNo || 0)
    };
  }
  return totals;
}

export function normalizeSeats(seats = {}) {
  const list = [];
  for (let seat = 0; seat < 4; seat += 1) {
    const data = seats[String(seat)] || seats[seat] || null;
    list.push(data ? { ...data, seat } : null);
  }
  return list;
}

export function seatsToObject(seatList) {
  const seats = {};
  for (let seat = 0; seat < 4; seat += 1) if (seatList[seat]) seats[seat] = seatList[seat];
  return seats;
}

export function makeSeatPayload({ seat, name, isAI, uid, host, connected = true, aiTakingOver = false }) {
  return {
    seat,
    name: normalizePlayerName(name, isAI ? `AI ${seat + 1}` : `玩家 ${seat + 1}`),
    isAI: Boolean(isAI),
    uid: uid || `ai-seat-${seat}`,
    host: Boolean(host),
    connected: Boolean(!isAI && connected),
    aiTakingOver: Boolean(aiTakingOver),
    lastSeen: isAI ? null : Date.now(),
    joinedAt: Date.now()
  };
}

export function makeInitialTotalsFromSeats(seatList) {
  const totals = {};
  for (let seat = 0; seat < 4; seat += 1) {
    const item = seatList[seat];
    if (!item) continue;
    totals[seat] = {
      seat,
      name: item.name || `玩家 ${seat + 1}`,
      uid: item.uid || null,
      isAI: Boolean(item.isAI),
      totalScore: 0,
      wins: 0,
      games: 0,
      latestRank: null,
      latestScore: 0,
      latestRemaining: null,
      updatedGameNo: 0
    };
  }
  return totals;
}

export function findSeatForUid(room, uid) {
  const seats = normalizeSeats(room.seats);
  const index = seats.findIndex((seat) => seat?.uid === uid);
  return index >= 0 ? index : null;
}

export function findEmptySeat(room) {
  const seats = normalizeSeats(room.seats);
  const index = seats.findIndex((seat) => !seat);
  return index >= 0 ? index : null;
}

export function findReplaceableAISeat(room) {
  if (room.status !== 'waiting' && room.status !== 'finished') return null;
  const seats = normalizeSeats(room.seats);
  const index = seats.findIndex((seat) => seat?.isAI);
  return index >= 0 ? index : null;
}

export function ensureFilledSeatList(room) {
  const seats = normalizeSeats(room.seats);
  for (let seat = 0; seat < 4; seat += 1) {
    if (!seats[seat]) seats[seat] = makeSeatPayload({ seat, name: `AI ${seat + 1}`, isAI: true, connected: false });
  }
  return seats;
}

export function isSeatStale(seat, now = Date.now(), stalePlayerMs = 45000) {
  if (!seat || seat.isAI) return false;
  const lastSeen = Number(seat.lastSeen || 0);
  return lastSeen > 0 && now - lastSeen > stalePlayerMs;
}

export function prepareSeatListForGame(room, stalePlayerMs = 45000) {
  return ensureFilledSeatList(room).map((seat, index) => {
    if (!seat) return makeSeatPayload({ seat: index, name: `AI ${index + 1}`, isAI: true, connected: false });
    if (seat.isAI) return { ...seat, isAI: true, connected: false, aiTakingOver: false };
    if (seat.connected === false || isSeatStale(seat, Date.now(), stalePlayerMs)) {
      return { ...seat, name: seat.name || `玩家 ${index + 1}`, isAI: true, connected: false, aiTakingOver: true, disconnectedAt: seat.disconnectedAt || Date.now() };
    }
    return { ...seat, isAI: false, connected: true, aiTakingOver: false, lastSeen: Date.now() };
  });
}

export function findHostSeat(seats, hostUid) {
  const index = seats.findIndex((seat) => seat?.uid === hostUid);
  return index >= 0 ? index : null;
}

export function findNextConnectedHumanSeat(seats, preferredAfter = -1) {
  for (let offset = 1; offset <= 4; offset += 1) {
    const index = (preferredAfter + offset + 4) % 4;
    const seat = seats[index];
    if (seat && !seat.isAI && seat.connected) return index;
  }
  return null;
}

export function markGameSeatAsAITakeover(game, seat, seatData) {
  if (!game?.players?.[seat]) return game;
  game.players[seat] = { ...game.players[seat], name: seatData?.name || game.players[seat].name, uid: seatData?.uid || game.players[seat].uid || null, connected: false, isAI: true, isHuman: false, aiTakingOver: true };
  appendHistory(game, `${game.players[seat].name} 已離線，由 AI 暫時接管座位 ${seat + 1}。`);
  if (game.currentTurnSeat === seat) game.message = `${game.players[seat].name} 已離線，目前由 AI 接管出牌。`;
  return game;
}

export function restoreGameSeatFromReconnect(game, seat, payload) {
  if (!game?.players?.[seat] || payload.isAI) return game;
  game.players[seat] = { ...game.players[seat], name: payload.name, uid: payload.uid, connected: true, isAI: false, isHuman: true, aiTakingOver: false };
  appendHistory(game, `${payload.name} 已重新連線，取回座位 ${seat + 1}。`);
  return game;
}

export function assertGameIntegrity(game) {
  if (!Array.isArray(game.players) || game.players.length !== 4) throw new Error('牌局玩家狀態異常。');
  if (!Number.isInteger(game.currentTurnSeat) || game.currentTurnSeat < 0 || game.currentTurnSeat > 3) throw new Error('回合座位狀態異常。');
  if (!game.players[game.currentTurnSeat]) throw new Error('目前回合玩家不存在。');
}

export function validateActionPreconditions(game, options = {}) {
  if (options.expectedGameId && game.gameId && options.expectedGameId !== game.gameId) throw new Error('牌局已換新局，請依最新手牌重新操作。');
  if (Number.isFinite(Number(options.expectedRevision))) {
    const currentRevision = Number(game.security?.revision || 0);
    if (currentRevision !== Number(options.expectedRevision)) throw new Error('牌局已更新，請確認最新回合後再出牌。');
  }
  if (Number.isInteger(options.expectedTurnSeat) && game.currentTurnSeat !== options.expectedTurnSeat) throw new Error('回合已更新，現在輪到其他玩家。');
}

export function applySecurityRevision(game, { roomId, uid, seat, actionType }) {
  game.security = {
    ...(game.security || {}),
    revision: Number(game.security?.revision || 0) + 1,
    lastActionId: `${roomId}-${Date.now()}-${actionType}-${crypto.randomBytes(3).toString('hex')}`,
    lastActorUid: uid,
    lastActorSeat: Number.isInteger(seat) ? seat : null,
    updatedAtMs: Date.now(),
    version: 'cloud-functions-v0.7.0',
    serverAuthoritative: true
  };
  return game;
}
