import { cardLabel, cardLongName, getSuitInfo, sortCards } from './cards.js';
import { getAILevelDescription, getAILevelLabel } from './ai.js';
import { THEMES } from './themes.js';
import { canPass, describePlay, detectHandType } from './rules.js';

const selectedCardIds = new Set();

function el(id) {
  return document.getElementById(id);
}

function makeCardElement(card, options = {}) {
  const suit = getSuitInfo(card);
  const button = document.createElement(options.clickable ? 'button' : 'div');
  button.className = `playing-card ${suit.color}`;
  button.dataset.cardId = card.id;
  button.setAttribute('aria-label', cardLongName(card));
  if (options.clickable) button.type = 'button';
  if (selectedCardIds.has(card.id)) button.classList.add('selected');
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

function getLocalSeat(gameState) {
  return Number.isInteger(gameState.localSeat) ? gameState.localSeat : 0;
}

export function getSelectedCards(gameState) {
  const localSeat = getLocalSeat(gameState);
  const hand = gameState.players[localSeat]?.hand || [];
  return sortCards(hand.filter((card) => selectedCardIds.has(card.id)));
}

export function toggleCardSelection(cardId) {
  if (selectedCardIds.has(cardId)) selectedCardIds.delete(cardId);
  else selectedCardIds.add(cardId);
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
  lastPlayCards.innerHTML = '';

  if (!gameState.lastPlay) {
    lastPlayType.textContent = gameState.isFirstPlay ? '梅花 3 起手' : '領出新一輪';
    lastPlayCards.className = 'card-row empty';
    lastPlayCards.textContent = gameState.isFirstPlay ? '等待梅花 3 起手' : '目前無上一手，可自由領出。';
    return;
  }

  lastPlayType.textContent = `${gameState.lastPlay.playerName}｜${gameState.lastPlay.name}`;
  lastPlayCards.className = 'card-row';
  for (const card of gameState.lastPlay.cards) {
    lastPlayCards.appendChild(makeCardElement(card));
  }
}

function renderHand(gameState) {
  const hand = el('humanHand');
  const localSeat = getLocalSeat(gameState);
  const localPlayer = gameState.players[localSeat] || gameState.players[0];
  hand.innerHTML = '';

  for (const card of localPlayer.hand) {
    const cardEl = makeCardElement(card, { clickable: true });
    cardEl.addEventListener('click', () => {
      toggleCardSelection(card.id);
      render(gameState);
    });
    hand.appendChild(cardEl);
  }

  el('handCount').textContent = `${localPlayer.hand.length} 張`;
  const title = document.querySelector('.hand-section h2');
  if (title) title.textContent = gameState.mode === 'multiplayer' ? `我的手牌｜座位 ${localSeat + 1}` : '我的手牌';
}

function renderSelectedInfo(gameState) {
  const selected = getSelectedCards(gameState);
  if (selected.length === 0) {
    el('selectedInfo').textContent = '請選擇手牌後出牌。';
    return;
  }

  const type = detectHandType(selected, gameState.rules);
  const labels = selected.map(cardLabel).join(' ');
  el('selectedInfo').textContent = type
    ? `已選 ${selected.length} 張：${type.name}｜${labels}`
    : `已選 ${selected.length} 張：不是合法牌型｜${labels}`;
}

function renderControls(gameState) {
  const localSeat = getLocalSeat(gameState);
  const localPlayer = gameState.players[localSeat];
  const isHumanTurn = gameState.currentTurnSeat === localSeat && !gameState.finished && !localPlayer?.isAI;
  el('playBtn').disabled = !isHumanTurn;
  el('passBtn').disabled = !isHumanTurn || !canPass(gameState);
  el('turnBadge').textContent = gameState.finished
    ? '本局結束'
    : `輪到 ${gameState.players[gameState.currentTurnSeat].name}`;
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
  const rows = gameState.results.map((row) => `
    <tr>
      <td>第 ${row.rank} 名</td>
      <td>${row.name}</td>
      <td>${row.remaining}</td>
      <td>${row.score > 0 ? '+' : ''}${row.score}</td>
    </tr>
  `).join('');

  panel.innerHTML = `
    <div class="panel-heading">
      <h2>本局結果</h2>
      <span class="pill">${gameState.players[gameState.winnerSeat].name} 勝出</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>排名</th>
          <th>玩家</th>
          <th>剩餘張數</th>
          <th>本局分數</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
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
  el('statusText').textContent = gameState.message;
  renderPlayerStatus(gameState);
  renderLastPlay(gameState);
  renderHand(gameState);
  renderSelectedInfo(gameState);
  renderControls(gameState);
  renderResults(gameState);
  renderHistory(gameState);
  renderAIInfo(gameState);
}

export function describeCurrentSelection(gameState) {
  const selected = getSelectedCards(gameState);
  if (!selected.length) return '尚未選牌';
  const type = detectHandType(selected, gameState.rules);
  return type ? describePlay(type) : '不是合法牌型';
}
