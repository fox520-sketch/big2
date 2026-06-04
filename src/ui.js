import { cardLabel, cardLongName, cardPower, getRankInfo, getSuitInfo, sortCards } from './cards.js';
import { getAILevelDescription, getAILevelLabel } from './ai.js';
import { THEMES } from './themes.js';
import { canBeat, canPass, describePlay, detectHandType, getLegalMoves } from './rules.js';
import { totalsToSortedRows } from './scoring.js';
import { ruleSummary, scoringSummary } from './game-settings.js';
import { playSound } from './sound.js';

const selectedCardIds = new Set();
const HAND_SORT_KEY = 'big2-hand-sort-mode';
const HAND_SORT_MODES = new Set(['rank', 'suit', 'combo']);
let handSortMode = HAND_SORT_MODES.has(localStorage.getItem(HAND_SORT_KEY)) ? localStorage.getItem(HAND_SORT_KEY) : 'rank';
let actionLock = { locked: false, label: '同步中' };

function el(id) {
  return document.getElementById(id);
}

function safeSetText(id, text) {
  const node = el(id);
  if (node) node.textContent = text;
}

function makeCardElement(card, options = {}) {
  const suit = getSuitInfo(card);
  const button = document.createElement(options.clickable ? 'button' : 'div');
  button.className = `playing-card ${suit.color}`;
  button.dataset.cardId = card.id;
  button.setAttribute('aria-label', cardLongName(card));
  if (options.clickable) button.type = 'button';
  if (selectedCardIds.has(card.id)) {
    button.classList.add('selected');
    button.setAttribute('aria-pressed', 'true');
  } else if (options.clickable) {
    button.setAttribute('aria-pressed', 'false');
  }
  button.innerHTML = `
    <span class="corner"><span>${card.rank}</span><span>${suit.symbol}</span></span>
    <span class="rank">${card.rank}</span>
    <span class="suit">${suit.symbol}</span>
  `;
  return button;
}

export function clearSelection() {
  selectedCardIds.clear();
}

export function setActionLock(locked, label = '同步中') {
  actionLock = { locked: Boolean(locked), label };
}

export function getHandSortMode() {
  return handSortMode;
}

export function setHandSortMode(mode) {
  handSortMode = HAND_SORT_MODES.has(mode) ? mode : 'rank';
  localStorage.setItem(HAND_SORT_KEY, handSortMode);
  return handSortMode;
}

function pruneSelectionToCurrentHand(gameState) {
  const localSeat = getLocalSeat(gameState);
  const hand = gameState.players[localSeat]?.hand || [];
  const validCardIds = new Set(hand.map((card) => card.id));
  for (const cardId of [...selectedCardIds]) {
    if (!validCardIds.has(cardId)) selectedCardIds.delete(cardId);
  }
}

function getLocalSeat(gameState) {
  return Number.isInteger(gameState.localSeat) ? gameState.localSeat : 0;
}

function getLocalHand(gameState) {
  const localSeat = getLocalSeat(gameState);
  return gameState.players[localSeat]?.hand || [];
}

function sortBySuit(cards) {
  return [...cards].sort((a, b) => {
    const suitDiff = getSuitInfo(a).value - getSuitInfo(b).value;
    if (suitDiff !== 0) return suitDiff;
    return getRankInfo(a).value - getRankInfo(b).value;
  });
}

function sortByCombo(cards) {
  const groups = new Map();
  for (const card of sortCards(cards)) {
    if (!groups.has(card.rank)) groups.set(card.rank, []);
    groups.get(card.rank).push(card);
  }
  return [...groups.values()]
    .map((group) => sortCards(group))
    .sort((a, b) => {
      const aComboWeight = a.length >= 2 ? a.length : 0;
      const bComboWeight = b.length >= 2 ? b.length : 0;
      if (aComboWeight !== bComboWeight) return bComboWeight - aComboWeight;
      return getRankInfo(a[0]).value - getRankInfo(b[0]).value;
    })
    .flat();
}

function sortHandForDisplay(cards) {
  if (handSortMode === 'suit') return sortBySuit(cards);
  if (handSortMode === 'combo') return sortByCombo(cards);
  return sortCards(cards);
}

export function getSelectedCards(gameState) {
  const hand = getLocalHand(gameState);
  return sortCards(hand.filter((card) => selectedCardIds.has(card.id)));
}

export function toggleCardSelection(cardId) {
  if (selectedCardIds.has(cardId)) selectedCardIds.delete(cardId);
  else selectedCardIds.add(cardId);
}

function selectCards(cards) {
  selectedCardIds.clear();
  for (const card of cards || []) selectedCardIds.add(card.id);
}

function getLocalLegalMoves(gameState) {
  const hand = getLocalHand(gameState);
  const requireCardId = gameState.isFirstPlay ? gameState.rules?.firstCardId : null;
  return getLegalMoves(hand, gameState.lastPlay, { rules: gameState.rules, requireCardId });
}

export function hasPlayableMove(gameState) {
  if (!gameState || gameState.finished) return false;
  const localSeat = getLocalSeat(gameState);
  if (gameState.currentTurnSeat !== localSeat) return false;
  const localPlayer = gameState.players?.[localSeat];
  if (!localPlayer || localPlayer.isAI) return false;
  return getLocalLegalMoves(gameState).length > 0;
}

function chooseRecommendedMove(gameState, mode = 'smart') {
  const legalMoves = getLocalLegalMoves(gameState);
  if (!legalMoves.length) return null;
  if (mode === 'minimum') return legalMoves[0];

  if (gameState.isFirstPlay) {
    const firstCardId = gameState.rules?.firstCardId;
    const firstSingle = legalMoves.find((move) => move.size === 1 && move.cards.some((card) => card.id === firstCardId));
    if (firstSingle) return firstSingle;
    return legalMoves[0];
  }

  if (!gameState.lastPlay) {
    const single = legalMoves.find((move) => move.size === 1);
    if (single) return single;
  }

  return legalMoves[0];
}

export function selectRecommendedPlay(gameState, mode = 'smart') {
  const move = chooseRecommendedMove(gameState, mode);
  if (!move) return null;
  selectCards(move.cards);
  return move;
}

function describeRequiredMove(gameState) {
  if (gameState.finished) return '本局已結束。';
  if (gameState.isFirstPlay) return `第一手必須包含${gameState.rules?.firstCardName || gameState.rules?.firstCardId || '起手牌'}。`;
  if (!gameState.lastPlay) return '目前你取得領出權，可自由出單張、對子、三條或五張牌型。';
  return `上一手是 ${gameState.lastPlay.playerName || '上一家'} 的 ${gameState.lastPlay.name}，你必須出 ${gameState.lastPlay.size} 張且更大的牌，或 Pass。`;
}

export function getSelectionAnalysis(gameState) {
  const selected = getSelectedCards(gameState);
  const labels = selected.map(cardLabel).join(' ');
  const localSeat = getLocalSeat(gameState);
  const localPlayer = gameState.players?.[localSeat];
  const isTurn = gameState.currentTurnSeat === localSeat && !gameState.finished && !localPlayer?.isAI;
  const playableCount = isTurn ? getLocalLegalMoves(gameState).length : 0;

  if (!selected.length) {
    return {
      selected,
      canPlay: false,
      level: playableCount ? 'info' : 'neutral',
      text: playableCount ? `目前有 ${playableCount} 種可出牌。可按「推薦出牌」或手動選牌。` : '請選擇手牌後出牌。',
      advice: isTurn ? describeRequiredMove(gameState) : `等待 ${gameState.players?.[gameState.currentTurnSeat]?.name || '目前玩家'} 出牌。`
    };
  }

  const type = detectHandType(selected, gameState.rules);
  const baseText = type ? `已選 ${selected.length} 張：${type.name}｜${labels}` : `已選 ${selected.length} 張：不是合法牌型｜${labels}`;

  if (!type) {
    return {
      selected,
      canPlay: false,
      level: 'warn',
      text: baseText,
      advice: selected.length === 4
        ? '大老二不能直接出 4 張；鐵支需要 4 張同點數再加 1 張，總共 5 張。'
        : '請改選單張、對子、三條，或順子 / 同花 / 葫蘆 / 鐵支 / 同花順。'
    };
  }

  if (gameState.isFirstPlay && !selected.some((card) => card.id === gameState.rules?.firstCardId)) {
    return {
      selected,
      canPlay: false,
      level: 'warn',
      text: baseText,
      advice: `第一手必須包含${gameState.rules?.firstCardName || gameState.rules?.firstCardId}，請把起手牌一起選進來。`
    };
  }

  if (gameState.lastPlay) {
    if (selected.length !== gameState.lastPlay.size) {
      return {
        selected,
        canPlay: false,
        level: 'warn',
        text: baseText,
        advice: `上一手是 ${gameState.lastPlay.size} 張牌，你目前選了 ${selected.length} 張；請改出同張數、同牌型可壓過的牌，或 Pass。`
      };
    }
    if (!canBeat(type, gameState.lastPlay)) {
      return {
        selected,
        canPlay: false,
        level: 'warn',
        text: baseText,
        advice: `這手牌壓不過上一手「${gameState.lastPlay.label || gameState.lastPlay.name}」，請改選更大的牌或 Pass。`
      };
    }
  }

  if (!isTurn) {
    return {
      selected,
      canPlay: false,
      level: 'info',
      text: baseText,
      advice: `牌型正確，但還沒輪到你；目前輪到 ${gameState.players?.[gameState.currentTurnSeat]?.name || '其他玩家'}。`
    };
  }

  return {
    selected,
    canPlay: true,
    level: 'ok',
    text: `${baseText}｜可以出`,
    advice: gameState.lastPlay ? '這手牌可以壓過上一手。' : '這手牌可以領出。'
  };
}

function renderPlayerStatus(gameState) {
  const localSeat = getLocalSeat(gameState);
  for (const player of gameState.players) {
    const box = el(`playerStatus${player.seat}`);
    const active = player.seat === gameState.currentTurnSeat && !gameState.finished;
    box.classList.toggle('active', active);
    box.innerHTML = `
      <div class="player-title">
        <span>${player.name}${player.seat === localSeat ? '（你）' : ''}</span>
        <span class="pill">${player.isAI ? `AI Lv.${gameState.aiLevel}` : (player.seat === localSeat ? '玩家' : '真人')}</span>
      </div>
      <div class="player-meta">
        <span>手牌 ${player.hand.length} 張</span>
        ${active ? '<span>輪到出牌</span>' : ''}
        ${gameState.leadSeat === player.seat && gameState.lastPlay ? '<span>上一手出牌者</span>' : ''}
      </div>
    `;
  }
}

function renderLastPlay(gameState) {
  const lastPlayCards = el('lastPlayCards');
  const lastPlayType = el('lastPlayType');
  const lastPlayHint = el('lastPlayHint');
  lastPlayCards.innerHTML = '';

  if (!gameState.lastPlay) {
    lastPlayType.textContent = gameState.isFirstPlay ? `${gameState.rules?.firstCardName || '梅花 3'}起手` : '領出新一輪';
    lastPlayCards.className = 'card-row empty';
    lastPlayCards.textContent = gameState.isFirstPlay ? `等待${gameState.rules?.firstCardName || '梅花 3'}起手` : '目前無上一手，可自由領出。';
    if (lastPlayHint) lastPlayHint.textContent = describeRequiredMove(gameState);
    return;
  }

  lastPlayType.textContent = `${gameState.lastPlay.playerName}｜${gameState.lastPlay.name}`;
  lastPlayCards.className = 'card-row';
  for (const card of gameState.lastPlay.cards) {
    lastPlayCards.appendChild(makeCardElement(card));
  }
  if (lastPlayHint) {
    lastPlayHint.textContent = `上一手：${gameState.lastPlay.playerName} 出了 ${describePlay(gameState.lastPlay)}。你要出 ${gameState.lastPlay.size} 張更大的牌，或 Pass。`;
  }
}

function renderHand(gameState) {
  const hand = el('humanHand');
  const localSeat = getLocalSeat(gameState);
  const localPlayer = gameState.players[localSeat] || gameState.players[0];
  hand.innerHTML = '';

  for (const card of sortHandForDisplay(localPlayer.hand)) {
    const cardEl = makeCardElement(card, { clickable: true });
    cardEl.addEventListener('click', () => {
      toggleCardSelection(card.id);
      playSound('select');
      render(gameState);
    });
    hand.appendChild(cardEl);
  }

  safeSetText('handCount', `${localPlayer.hand.length} 張`);
  const sortSelect = el('handSortSelect');
  if (sortSelect) sortSelect.value = handSortMode;
  const title = document.querySelector('.hand-section h2');
  if (title) title.textContent = gameState.mode === 'multiplayer' ? `我的手牌｜座位 ${localSeat + 1}` : '我的手牌';
}

function renderSelectedInfo(gameState) {
  const analysis = getSelectionAnalysis(gameState);
  const info = el('selectedInfo');
  if (info) {
    info.textContent = analysis.text;
    info.dataset.level = analysis.level;
  }
  const advice = el('selectionAdvice');
  if (advice) {
    advice.textContent = analysis.advice;
    advice.dataset.level = analysis.level;
  }
}

function renderControls(gameState) {
  const localSeat = getLocalSeat(gameState);
  const localPlayer = gameState.players[localSeat];
  const isHumanTurn = gameState.currentTurnSeat === localSeat && !gameState.finished && !localPlayer?.isAI;
  const analysis = getSelectionAnalysis(gameState);
  const playableCount = isHumanTurn ? getLocalLegalMoves(gameState).length : 0;
  const playBtn = el('playBtn');
  const passBtn = el('passBtn');
  playBtn.disabled = !isHumanTurn || actionLock.locked || !analysis.canPlay;
  passBtn.disabled = !isHumanTurn || !canPass(gameState) || actionLock.locked;
  playBtn.textContent = actionLock.locked ? '同步中...' : (analysis.canPlay ? '出牌' : '出牌');
  passBtn.textContent = actionLock.locked ? '等待同步' : 'Pass';
  playBtn.setAttribute('aria-busy', actionLock.locked ? 'true' : 'false');
  passBtn.setAttribute('aria-busy', actionLock.locked ? 'true' : 'false');

  const recommendBtn = el('recommendPlayBtn');
  const minBtn = el('minPlayableBtn');
  const clearBtn = el('clearSelectionBtn');
  if (recommendBtn) recommendBtn.disabled = !isHumanTurn || actionLock.locked || playableCount === 0;
  if (minBtn) minBtn.disabled = !isHumanTurn || actionLock.locked || playableCount === 0;
  if (clearBtn) clearBtn.disabled = actionLock.locked || selectedCardIds.size === 0;

  const passHelp = el('passHelp');
  if (passHelp) {
    if (!isHumanTurn) passHelp.textContent = `目前輪到 ${gameState.players[gameState.currentTurnSeat]?.name || '其他玩家'}。`;
    else if (!canPass(gameState)) passHelp.textContent = '你正在領出新一輪，不能 Pass。';
    else if (playableCount > 0) passHelp.textContent = `你還有 ${playableCount} 種可出牌；按 Pass 前會提醒確認。`;
    else passHelp.textContent = '目前沒有可壓過上一手的牌，可以 Pass。';
  }

  safeSetText('turnBadge', gameState.finished
    ? '本局結束'
    : actionLock.locked
      ? `${actionLock.label}｜輪到 ${gameState.players[gameState.currentTurnSeat].name}`
      : `輪到 ${gameState.players[gameState.currentTurnSeat].name}`);
}

function renderHistory(gameState) {
  const list = el('historyList');
  list.innerHTML = '';
  for (const item of gameState.history) {
    const li = document.createElement('li');
    li.textContent = item;
    list.appendChild(li);
  }
}

function renderResults(gameState) {
  const panel = el('resultPanel');
  if (!gameState.finished || !gameState.results) {
    panel.classList.add('hidden');
    panel.innerHTML = '';
    return;
  }

  panel.classList.remove('hidden');
  const totals = gameState.totalScores || gameState.results.reduce((map, row) => {
    map[row.seat] = {
      seat: row.seat,
      name: row.name,
      totalScore: row.score,
      wins: row.rank === 1 ? 1 : 0,
      games: 1,
      latestRank: row.rank,
      latestScore: row.score,
      latestRemaining: row.remaining
    };
    return map;
  }, {});

  const rows = gameState.results.map((row) => {
    const total = totals[row.seat] || totals[String(row.seat)] || {};
    return `
      <tr>
        <td>第 ${row.rank} 名</td>
        <td>${row.name}</td>
        <td>${row.remaining}</td>
        <td>${row.score > 0 ? '+' : ''}${row.score}</td>
        <td>${row.penaltyLabel || (row.multiplier > 1 ? `${row.multiplier} 倍` : '一般')}</td>
        <td>${Number(total.totalScore || row.score) > 0 ? '+' : ''}${Number(total.totalScore || row.score)}</td>
        <td>${Number(total.wins || (row.rank === 1 ? 1 : 0))}</td>
      </tr>
    `;
  }).join('');

  const totalRows = totalsToSortedRows(totals).map((row) => `
    <tr>
      <td>第 ${row.totalRank} 名</td>
      <td>${row.name}</td>
      <td>${Number(row.totalScore || 0) > 0 ? '+' : ''}${Number(row.totalScore || 0)}</td>
      <td>${Number(row.wins || 0)}</td>
      <td>${Number(row.games || 0)}</td>
    </tr>
  `).join('');

  panel.innerHTML = `
    <div class="panel-heading">
      <h2>本局結果${gameState.gameNo ? `｜第 ${gameState.gameNo} 局` : ''}</h2>
      <span class="pill">${gameState.players[gameState.winnerSeat].name} 勝出</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>排名</th>
          <th>玩家名稱</th>
          <th>剩餘張數</th>
          <th>本局分數</th>
          <th>倍率</th>
          <th>累計總分</th>
          <th>勝場</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="panel-heading compact total-heading">
      <h2>累計總排名</h2>
      <span class="pill">同一房間連續統計</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>總排名</th>
          <th>玩家名稱</th>
          <th>累計總分</th>
          <th>勝場</th>
          <th>局數</th>
        </tr>
      </thead>
      <tbody>${totalRows}</tbody>
    </table>
  `;
}

function renderRulePanel(gameState) {
  const grid = document.querySelector('.rules-panel .rules-grid');
  if (!grid) return;
  const rules = gameState.rules || {};
  const scoringRules = gameState.scoringRules || {};
  grid.innerHTML = `
    <div><strong>起手</strong><span>${rules.firstCardName || rules.firstCardId || '梅花 3'}</span></div>
    <div><strong>點數</strong><span>${rules.cardOrderText || '2 最大，3 最小'}</span></div>
    <div><strong>花色</strong><span>${rules.suitOrderText || '黑桃 > 紅心 > 方塊 > 梅花'}</span></div>
    <div><strong>五張牌型</strong><span>${rules.fiveCardText || '順子 < 同花 < 葫蘆 < 鐵支 < 同花順'}</span></div>
    <div><strong>順子設定</strong><span>${rules.allowStraightWithTwo ? '可含 2' : '不可含 2'}；${rules.allowWheelStraight ? '允許 A2345' : '不開 A2345'}</span></div>
    <div><strong>計分</strong><span>${scoringRules.shortName || scoringRules.name || '標準'}</span></div>
    <div><strong>規則摘要</strong><span>${ruleSummary(rules)}</span></div>
    <div><strong>計分摘要</strong><span>${scoringSummary(scoringRules)}</span></div>
  `;
}

function renderAIInfo(gameState) {
  const label = getAILevelLabel(gameState.aiLevel);
  const desc = getAILevelDescription(gameState.aiLevel);
  const badge = el('aiLevelBadge');
  const text = el('aiLevelDescription');
  if (badge) badge.textContent = label;
  if (text) text.textContent = desc;
}

export function renderThemeNote(themeName) {
  const noteEl = el('themeNote');
  if (!noteEl) return;
  const theme = THEMES[themeName] ?? THEMES.dark;
  noteEl.textContent = `${theme.name}：${theme.note}`;
}

export function render(gameState) {
  pruneSelectionToCurrentHand(gameState);
  safeSetText('statusText', gameState.message);
  renderPlayerStatus(gameState);
  renderLastPlay(gameState);
  renderHand(gameState);
  renderSelectedInfo(gameState);
  renderControls(gameState);
  renderResults(gameState);
  renderHistory(gameState);
  renderAIInfo(gameState);
  renderRulePanel(gameState);
}

export function describeCurrentSelection(gameState) {
  const selected = getSelectedCards(gameState);
  if (!selected.length) return '尚未選牌';
  const type = detectHandType(selected, gameState.rules);
  return type ? describePlay(type) : '不是合法牌型';
}
