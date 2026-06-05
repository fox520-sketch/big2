import { createDeck, hasCard, removeCards, shuffleDeck, sortCards } from './cards.js';
import { DEFAULT_AI_LEVEL, DEFAULT_RULES, DEFAULT_SCORING_RULES, PLAYERS } from './constants.js';
import { chooseAIMove, getAILevelLabel } from './ai.js';
import { calculateResults } from './scoring.js';
import { canPass, describePlay, validateHumanPlay } from './rules.js';
import { normalizeRules, normalizeScoringRules, ruleSummary, scoringSummary } from './game-settings.js';

function makePlayers(basePlayers, options = {}) {
  const aiLevel = Number.isFinite(Number(options.aiLevel)) ? Number(options.aiLevel) : DEFAULT_AI_LEVEL;
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
    hand: [],
    score: 0,
    rank: null
  }));

  deck.forEach((card, index) => {
    players[index % 4].hand.push(card);
  });

  players.forEach((player) => {
    player.hand = sortCards(player.hand);
  });

  const firstSeat = players.find((player) => hasCard(player.hand, rules.firstCardId))?.seat ?? 0;
  const firstCardName = rules.firstCardName || rules.firstCardId;
  const firstMessage = `第 1 輪開始，${players[firstSeat].name} 持有${firstCardName}，必須先出。`;

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
    security: { revision: 0, lastActionId: null, version: 'client-validated-v0.7.5' },
    history: [firstMessage, `計分：${scoringSummary(scoringRules)}`, `規則：${ruleSummary(rules)}`, `AI 難度：${getAILevelLabel(aiLevel)}。`],
    message: `${players[firstSeat].name} 先出，第一手必須包含${firstCardName}。`,
    aiLevel
  };
}

export function createNewGame(options = {}) {
  return makePlayers(PLAYERS, options);
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
      connected: seatData?.connected !== false
    });
  }
  const game = makePlayers(basePlayers, options);
  game.mode = 'multiplayer';
  game.gameId = options.gameId || `game-${Date.now()}`;
  game.hostUid = options.hostUid || null;
  game.localSeat = options.localSeat ?? 0;
  return game;
}

export function currentPlayer(gameState) {
  return gameState.players[gameState.currentTurnSeat];
}

function nextSeat(seat) {
  return (seat + 1) % 4;
}

function appendHistory(gameState, text) {
  gameState.history = [text, ...gameState.history].slice(0, 80);
}

function finishGame(gameState, winnerSeat) {
  gameState.finished = true;
  gameState.winnerSeat = winnerSeat;
  gameState.results = calculateResults(gameState.players, winnerSeat, gameState.scoringRules);
  gameState.message = `本局結束，${gameState.players[winnerSeat].name} 第一名！`;
  appendHistory(gameState, `本局結束：${gameState.players[winnerSeat].name} 出完手牌。`);
  return gameState;
}

export function setAILevel(gameState, aiLevel) {
  if (gameState.finished) {
    gameState.aiLevel = aiLevel;
    return gameState;
  }
  gameState.aiLevel = aiLevel;
  gameState.message = `AI 難度已調整為 ${getAILevelLabel(aiLevel)}，下一手 AI 會套用新難度。`;
  appendHistory(gameState, `AI 難度調整：${getAILevelLabel(aiLevel)}。`);
  return gameState;
}

export function playCards(gameState, seat, cards) {
  if (gameState.finished) return gameState;
  if (seat !== gameState.currentTurnSeat) {
    gameState.message = '現在還沒輪到你。';
    return gameState;
  }

  const player = gameState.players[seat];
  const validation = validateHumanPlay(cards, gameState);
  if (!validation.ok) {
    gameState.message = validation.message;
    return gameState;
  }

  player.hand = sortCards(removeCards(player.hand, cards));
  gameState.lastPlay = {
    ...validation.play,
    seat,
    playerName: player.name
  };
  gameState.lastAction = { type: 'PLAY', seat, play: gameState.lastPlay };
  gameState.leadSeat = seat;
  gameState.passCount = 0;
  gameState.isFirstPlay = false;
  gameState.message = `${player.name} 出牌：${describePlay(gameState.lastPlay)}`;
  appendHistory(gameState, `${player.name} 出牌：${describePlay(gameState.lastPlay)}`);

  if (player.hand.length === 0) {
    return finishGame(gameState, seat);
  }

  gameState.currentTurnSeat = nextSeat(seat);
  return gameState;
}

export function passTurn(gameState, seat) {
  if (gameState.finished) return gameState;
  if (seat !== gameState.currentTurnSeat) {
    gameState.message = '現在還沒輪到你。';
    return gameState;
  }

  const player = gameState.players[seat];
  if (!canPass(gameState)) {
    gameState.message = '現在不能 Pass，請領出一手牌。';
    return gameState;
  }

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

export function runAITurn(gameState) {
  if (gameState.finished) return gameState;
  const player = currentPlayer(gameState);
  if (!player?.isAI && player?.isHuman) return gameState;

  const decision = chooseAIMove(gameState, player.hand, gameState.aiLevel);
  if (decision.type === 'PASS') {
    return passTurn(gameState, player.seat);
  }

  return playCards(gameState, player.seat, decision.play.cards);
}
