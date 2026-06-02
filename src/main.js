import { DEFAULT_AI_LEVEL } from './constants.js';
import { createNewGame, passTurn, playCards, runAITurn, setAILevel } from './game-state.js';
import { applyTheme, getSavedTheme } from './themes.js';
import { clearSelection, getSelectedCards, render, renderThemeNote } from './ui.js';
import {
  buildInviteUrl,
  createRoom,
  fillAISeats,
  getFirebaseSetupState,
  getRoomIdFromUrl,
  joinRoom,
  leaveRoom,
  listenRoom,
  normalizeRoomId,
  passMultiplayerTurn,
  playMultiplayerCards,
  qrCodeImageUrl,
  runMultiplayerAITurn,
  saveLocalPlayerName,
  shouldAutoJoinFromUrl,
  startMultiplayerGame
} from './firebase-room.js';

const AI_LEVEL_KEY = 'big2-ai-level';
const PLAYER_NAME_KEY = 'big2-player-name';
let gameState = createNewGame({ aiLevel: getSavedAILevel() });
let aiTimer = null;
let multiplayerAiTimer = null;
let currentRoomId = null;
let latestInviteUrl = '';
let latestRoom = null;

function el(id) {
  return document.getElementById(id);
}

function getSavedAILevel() {
  const saved = Number(localStorage.getItem(AI_LEVEL_KEY));
  if (!Number.isFinite(saved)) return DEFAULT_AI_LEVEL;
  return Math.min(20, Math.max(1, Math.round(saved)));
}

function saveAILevel(level) {
  localStorage.setItem(AI_LEVEL_KEY, String(level));
}

function getPlayerName() {
  const input = el('playerNameInput');
  return saveLocalPlayerName(input?.value || localStorage.getItem(PLAYER_NAME_KEY) || '玩家');
}

function scheduleAIIfNeeded() {
  window.clearTimeout(aiTimer);
  if (gameState.mode === 'multiplayer') return;
  if (gameState.finished) return;
  const current = gameState.players[gameState.currentTurnSeat];
  if (current?.isAI || !current?.isHuman) {
    aiTimer = window.setTimeout(() => {
      gameState = runAITurn(gameState);
      clearSelection();
      render(gameState);
      scheduleAIIfNeeded();
    }, 520);
  }
}

function scheduleMultiplayerAIIfNeeded(room = latestRoom) {
  window.clearTimeout(multiplayerAiTimer);
  if (!room || !room.isHost || room.status !== 'playing' || !room.game || room.game.finished) return;
  const current = room.game.players?.[room.game.currentTurnSeat];
  if (!current?.isAI) return;

  multiplayerAiTimer = window.setTimeout(async () => {
    try {
      await runMultiplayerAITurn(room.roomId);
    } catch (error) {
      setRoomMessage(error.message || 'AI 接管出牌失敗。', 'warn');
    }
  }, 680);
}

function resetGame() {
  const aiLevel = getSavedAILevel();
  gameState = createNewGame({ aiLevel });
  clearSelection();
  render(gameState);
  scheduleAIIfNeeded();
}

function setFirebaseBadge() {
  const state = getFirebaseSetupState();
  const badge = el('firebaseStatusBadge');
  badge.textContent = state.ok ? 'Firebase 已設定' : '尚未設定';
  badge.classList.toggle('ok', state.ok);
  badge.classList.toggle('warn', !state.ok);
  setRoomMessage(state.text, state.ok ? 'ok' : 'warn');
}

function setRoomMessage(message, level = 'info') {
  const roomMessage = el('roomMessage');
  roomMessage.textContent = message;
  roomMessage.dataset.level = level;
}

function setRoomControlsConnected(connected) {
  el('copyInviteBtn').disabled = !connected;
  el('showQrBtn').disabled = !connected;
  el('leaveRoomBtn').disabled = !connected;
  el('fillAIBtn').disabled = !connected;
  el('startMultiplayerBtn').disabled = !connected;
}

function renderEmptySeats() {
  el('roomSeatList').innerHTML = [0, 1, 2, 3]
    .map((seat) => `<div class="seat-card empty">座位 ${seat + 1}｜等待玩家</div>`)
    .join('');
}

function renderRoomGame(room) {
  if (room.status === 'playing' || room.status === 'finished') {
    if (!room.game) return;
    gameState = {
      ...room.game,
      mode: 'multiplayer',
      localSeat: Number.isInteger(room.localSeat) ? room.localSeat : 0,
      totalScores: room.totalScores || room.game.totalScores || null,
      gameNo: room.gameNo || room.game.gameNo || 0
    };
    clearSelection();
    render(gameState);
    scheduleMultiplayerAIIfNeeded(room);
    return;
  }

  if (gameState.mode === 'multiplayer') {
    resetGame();
  }
}

function renderRoom(room) {
  latestRoom = room;
  if (!room) {
    currentRoomId = null;
    latestInviteUrl = '';
    el('roomBadge').textContent = '房間不存在';
    el('inviteLinkInput').value = '';
    el('qrBox').classList.add('hidden');
    setRoomControlsConnected(false);
    renderEmptySeats();
    setRoomMessage('房間不存在或已被刪除。', 'warn');
    return;
  }

  currentRoomId = room.roomId;
  latestInviteUrl = buildInviteUrl(room.roomId);
  el('roomCodeInput').value = room.roomId;
  el('roomBadge').textContent = `房號 ${room.roomId}`;
  el('inviteLinkInput').value = latestInviteUrl;
  setRoomControlsConnected(true);
  el('fillAIBtn').disabled = !room.isHost || room.status === 'playing';
  el('startMultiplayerBtn').disabled = !room.isHost || room.status === 'playing';
  el('startMultiplayerBtn').textContent = room.status === 'finished' ? '下一局 / 重新洗牌' : (room.status === 'playing' ? '牌局進行中' : '開始多人遊戲');

  const statusText = room.status === 'playing'
    ? `多人牌局進行中。你的座位：${Number.isInteger(room.localSeat) ? room.localSeat + 1 : '未入座'}。`
    : room.status === 'finished'
      ? '多人牌局已結束，房主可以按「下一局 / 重新洗牌」延續同一房間與累計總分。'
      : '房間大廳已連線，房主可補 AI 空位後開始多人遊戲。';
  setRoomMessage(room.lastEvent || statusText, 'ok');

  const seats = room.seatList || [];
  el('roomSeatList').innerHTML = seats
    .map((seat, index) => {
      if (!seat) return `<div class="seat-card empty">座位 ${index + 1}｜等待玩家</div>`;
      const tags = [];
      if (seat.host || seat.uid === room.hostUid) tags.push('房主');
      if (seat.isAI) tags.push('AI');
      else tags.push('真人');
      if (seat.uid === room.localUid) tags.push('你');
      if (seat.connected) tags.push('已連線');
      else if (!seat.isAI) tags.push('離線');
      if (seat.aiTakingOver) tags.push('AI 接管');
      const cardCount = room.game?.players?.[index]?.hand?.length;
      if (Number.isFinite(cardCount)) tags.push(`手牌 ${cardCount} 張`);
      const total = room.totalScores?.[index] || room.totalScores?.[String(index)];
      if (total) tags.push(`總分 ${Number(total.totalScore || 0)}`);
      if (total?.wins) tags.push(`勝場 ${total.wins}`);
      return `
        <div class="seat-card occupied">
          <strong>座位 ${index + 1}｜${seat.name || '玩家'}</strong>
          <span>${tags.join('｜')}</span>
        </div>
      `;
    })
    .join('');

  renderRoomGame(room);
}

async function connectRoom(roomId, mode = 'join') {
  const normalized = normalizeRoomId(roomId);
  if (!normalized) {
    setRoomMessage('請先輸入房號。', 'warn');
    return;
  }

  try {
    setRoomMessage(mode === 'auto' ? `偵測邀請連結，正在自動加入房間 ${normalized}...` : `正在加入房間 ${normalized}...`);
    const result = await joinRoom(normalized, { playerName: getPlayerName() });
    currentRoomId = result.roomId;
    latestInviteUrl = result.inviteUrl;
    await listenRoom(result.roomId, renderRoom, (error) => setRoomMessage(`房間同步失敗：${error.message}`, 'warn'));
    setRoomMessage(mode === 'auto' ? `已自動加入房間 ${result.roomId}。` : `已加入房間 ${result.roomId}。`, 'ok');
  } catch (error) {
    setRoomMessage(error.message || '加入房間失敗。', 'warn');
  }
}

async function bindRoomEvents() {
  setFirebaseBadge();
  renderEmptySeats();

  const savedName = localStorage.getItem(PLAYER_NAME_KEY) || '';
  el('playerNameInput').value = savedName;

  const urlRoomId = getRoomIdFromUrl();
  if (urlRoomId) {
    el('roomCodeInput').value = urlRoomId;
    if (shouldAutoJoinFromUrl()) {
      await connectRoom(urlRoomId, 'auto');
    }
  }

  el('roomCodeInput').addEventListener('input', (event) => {
    event.target.value = normalizeRoomId(event.target.value);
  });

  el('playerNameInput').addEventListener('change', () => {
    saveLocalPlayerName(el('playerNameInput').value);
  });

  el('createRoomBtn').addEventListener('click', async () => {
    try {
      setRoomMessage('正在建立 Firebase 房間...');
      const result = await createRoom({ playerName: getPlayerName(), aiLevel: getSavedAILevel() });
      currentRoomId = result.roomId;
      latestInviteUrl = result.inviteUrl;
      await listenRoom(result.roomId, renderRoom, (error) => setRoomMessage(`房間同步失敗：${error.message}`, 'warn'));
      setRoomMessage(`已建立房間 ${result.roomId}，可以複製連結或顯示 QR Code。`, 'ok');
    } catch (error) {
      setRoomMessage(error.message || '建立房間失敗，請檢查 Firebase 設定。', 'warn');
    }
  });

  el('joinRoomBtn').addEventListener('click', async () => {
    await connectRoom(el('roomCodeInput').value, 'join');
  });

  el('fillAIBtn').addEventListener('click', async () => {
    try {
      await fillAISeats(currentRoomId || el('roomCodeInput').value);
      setRoomMessage('已補滿 AI 空位。', 'ok');
    } catch (error) {
      setRoomMessage(error.message || '補 AI 空位失敗。', 'warn');
    }
  });

  el('startMultiplayerBtn').addEventListener('click', async () => {
    try {
      setRoomMessage(latestRoom?.status === 'finished' ? '正在開始下一局並保留累計總分...' : '正在同步洗牌、發牌並開始多人遊戲...');
      await startMultiplayerGame(currentRoomId || el('roomCodeInput').value, { aiLevel: getSavedAILevel() });
      setRoomMessage(latestRoom?.status === 'finished' ? '下一局已開始，累計總分已保留。' : '多人遊戲已開始。', 'ok');
    } catch (error) {
      setRoomMessage(error.message || '開始多人遊戲失敗。', 'warn');
    }
  });

  el('leaveRoomBtn').addEventListener('click', async () => {
    try {
      await leaveRoom(currentRoomId);
      currentRoomId = null;
      latestInviteUrl = '';
      latestRoom = null;
      el('inviteLinkInput').value = '';
      el('roomBadge').textContent = '尚未建立';
      el('qrBox').classList.add('hidden');
      setRoomControlsConnected(false);
      renderEmptySeats();
      resetGame();
      setRoomMessage('已離開房間。');
    } catch (error) {
      setRoomMessage(error.message || '離開房間失敗。', 'warn');
    }
  });

  el('copyInviteBtn').addEventListener('click', async () => {
    if (!latestInviteUrl) return;
    try {
      await navigator.clipboard.writeText(latestInviteUrl);
      setRoomMessage('已複製邀請連結。朋友打開後會自動加入房間。', 'ok');
    } catch {
      el('inviteLinkInput').select();
      setRoomMessage('瀏覽器不允許自動複製，請手動複製邀請連結。', 'warn');
    }
  });

  el('showQrBtn').addEventListener('click', () => {
    if (!latestInviteUrl) return;
    el('qrCodeImage').src = qrCodeImageUrl(latestInviteUrl);
    el('qrBox').classList.remove('hidden');
    setRoomMessage('已顯示 QR Code，手機掃描後會自動加入房間。', 'ok');
  });
}

function bindGameEvents() {
  el('newGameBtn').addEventListener('click', resetGame);

  el('playBtn').addEventListener('click', async () => {
    const selected = getSelectedCards(gameState);
    if (!selected.length) {
      gameState.message = '請先選擇要出的牌。';
      render(gameState);
      return;
    }

    if (gameState.mode === 'multiplayer' && currentRoomId) {
      try {
        await playMultiplayerCards(currentRoomId, selected);
        clearSelection();
      } catch (error) {
        gameState.message = error.message || '多人出牌失敗。';
        render(gameState);
      }
      return;
    }

    gameState = playCards(gameState, 0, selected);
    if (gameState.lastAction?.type === 'PLAY' && gameState.lastAction.seat === 0) {
      clearSelection();
    }
    render(gameState);
    scheduleAIIfNeeded();
  });

  el('passBtn').addEventListener('click', async () => {
    if (gameState.mode === 'multiplayer' && currentRoomId) {
      try {
        await passMultiplayerTurn(currentRoomId);
        clearSelection();
      } catch (error) {
        gameState.message = error.message || '多人 Pass 失敗。';
        render(gameState);
      }
      return;
    }

    gameState = passTurn(gameState, 0);
    clearSelection();
    render(gameState);
    scheduleAIIfNeeded();
  });

  const themeSelect = el('themeSelect');
  const initialTheme = applyTheme(getSavedTheme());
  themeSelect.value = initialTheme;
  renderThemeNote(initialTheme);
  themeSelect.addEventListener('change', (event) => {
    const applied = applyTheme(event.target.value);
    renderThemeNote(applied);
  });

  const aiLevelSelect = el('aiLevelSelect');
  aiLevelSelect.value = String(gameState.aiLevel);
  aiLevelSelect.addEventListener('change', (event) => {
    const aiLevel = Number(event.target.value);
    saveAILevel(aiLevel);
    if (gameState.mode !== 'multiplayer') {
      gameState = setAILevel(gameState, aiLevel);
      render(gameState);
      scheduleAIIfNeeded();
    } else {
      setRoomMessage('AI 難度會在下一次「開始多人遊戲 / 重新發牌」時套用。', 'ok');
    }
  });
}

bindGameEvents();
bindRoomEvents();
render(gameState);
scheduleAIIfNeeded();
