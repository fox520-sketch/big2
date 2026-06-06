import { DEFAULT_AI_LEVEL, VERSION } from './constants.js';
import { createNewGame, passTurn, playCards, runAITurn, setAILevel } from './game-state.js';
import { applyTheme, getSavedTheme } from './themes.js';
import { clearSelection, getHandSortMode, getSelectedCards, hasPlayableMove, render, renderThemeNote, selectRecommendedPlay, setActionLock, setHandSortMode } from './ui.js';
import { getRulePreset, getScoringPreset, ruleSummary, scoringSummary } from './game-settings.js';
import { getSoundPreferences, isSoundEnabled, playDealSound, playSound, setSoundEnabled, setSoundPreference } from './sound.js';
import { applyAnimationPreference, clearGameRecords, clearRecentRooms, getAchievements, getDailyStats, getGameRecords, getRecentRooms, isAnimationEnabled, recordFinishedGame, rememberRecentRoom, roomStatusLabel, setAnimationEnabled } from './experience.js';
import { totalsToSortedRows } from './scoring.js';
import {
  buildInviteUrl,
  cleanupExpiredOwnedRooms,
  createRoom,
  fillAISeats,
  getFirebaseSetupState,
  getPresenceDebugInfo,
  explainFirebaseError,
  getRoomIdFromUrl,
  joinRoom,
  kickSeat,
  leaveRoom,
  listRecentRoomsFromFirestore,
  moveSeat,
  listenRoom,
  normalizeRoomId,
  passMultiplayerTurn,
  playMultiplayerCards,
  qrCodeImageUrl,
  refreshActiveRoomConnection,
  runMultiplayerAITurn,
  runFirebaseDiagnostics,
  saveLocalPlayerName,
  shouldAutoJoinFromUrl,
  startMultiplayerGame
} from './firebase-room.js';

const AI_LEVEL_KEY = 'big2-ai-level';
const PLAYER_NAME_KEY = 'big2-player-name';
const RULE_PRESET_KEY = 'big2-rule-preset';
const SCORING_PRESET_KEY = 'big2-scoring-preset';
const PASS_REMINDER_KEY = 'big2-pass-reminder-enabled';
let lastRenderedActionId = null;
let lastRenderedMultiplayerGameId = null;
let lastRecordedFinishedGameId = null;
let gameState = createNewGame({ aiLevel: getSavedAILevel(), rules: getSavedRules(), scoringRules: getSavedScoringRules() });
let aiTimer = null;
let multiplayerAiTimer = null;
let currentRoomId = null;
let latestInviteUrl = '';
let latestRoom = null;
let multiplayerActionSubmitting = false;
let latestSnapshotAt = null;
let lastSubmitStartedAt = 0;
const ACTION_COOLDOWN_MS = 650;
const SESSION_TAB_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const ACTIVE_TAB_KEY = 'big2-active-tab';
let focusPanelsExpanded = false;
let lastFocusGameKey = null;
let lastRoomMessage = '尚未連線房間。';
let reconnectInProgress = false;
let viewportRaf = null;
const RUNTIME_ERROR_LIMIT = 20;
const ERROR_LOG_KEY = 'big2-runtime-errors-v084';
const LEGACY_ERROR_LOG_KEYS = ['big2-runtime-errors-v083'];
const ACCEPTANCE_KEY = 'big2-acceptance-v084';
const LEGACY_ACCEPTANCE_KEYS = ['big2-acceptance-v083'];
const ACCEPTANCE_ITEMS = [
  'android-pwa', 'ios-pwa', 'desktop-pwa', 'pwa-update',
  'two-human', 'three-human', 'four-human', 'disconnect-reconnect',
  'host-transfer', 'next-game', 'mobile-ui', 'firebase-health',
  'rules-security', 'rollback-drill'
];
let lastUserAction = '啟動遊戲';
let errorCenterTimer = null;

function readJsonStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function migrateJsonStorage(currentKey, legacyKeys, fallback) {
  const current = readJsonStorage(currentKey, null);
  if (current !== null) return current;
  for (const legacyKey of legacyKeys) {
    const legacy = readJsonStorage(legacyKey, null);
    if (legacy !== null) {
      try { localStorage.setItem(currentKey, JSON.stringify(legacy)); } catch { /* ignore */ }
      return legacy;
    }
  }
  return fallback;
}

const storedRuntimeErrors = migrateJsonStorage(ERROR_LOG_KEY, LEGACY_ERROR_LOG_KEYS, []);
const runtimeErrors = Array.isArray(storedRuntimeErrors) ? storedRuntimeErrors : [];
runtimeErrors.splice(RUNTIME_ERROR_LIMIT);

function persistRuntimeErrors() {
  try { localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(runtimeErrors)); } catch { /* private mode / quota */ }
}

function getRuntimeContext(extra = {}) {
  const room = latestRoom || {};
  const game = gameState || room.game || {};
  return {
    feature: extra.feature || lastUserAction || '執行階段',
    code: extra.code || null,
    roomId: room.roomId || currentRoomId || null,
    roomStatus: room.status || null,
    gameId: game.gameId || null,
    gameNo: room.gameNo || game.gameNo || 0,
    localSeat: Number.isInteger(room.localSeat) ? room.localSeat : game.localSeat,
    currentTurnSeat: game.currentTurnSeat,
    online: navigator.onLine !== false,
    visibility: document.visibilityState,
    action: lastUserAction,
    ...extra
  };
}

function recordRuntimeError(kind, value, context = {}) {
  let message = '';
  if (value instanceof Error) message = value.message;
  else if (typeof value === 'string') message = value;
  else {
    try { message = JSON.stringify(value); } catch { message = String(value); }
  }
  const error = value instanceof Error ? value : new Error(message || '未知錯誤');
  const now = Date.now();
  const issue = {
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    name: error.name || 'Error',
    message: error.message || String(error),
    stack: error.stack?.slice(0, 2400) || null,
    at: new Date(now).toISOString(),
    ...getRuntimeContext(context)
  };
  const duplicate = runtimeErrors.find((item) => item.kind === issue.kind
    && item.message === issue.message
    && item.feature === issue.feature
    && now - Date.parse(item.at || 0) < 5000);
  if (!duplicate) runtimeErrors.unshift(issue);
  runtimeErrors.splice(RUNTIME_ERROR_LIMIT);
  persistRuntimeErrors();
  window.clearTimeout(errorCenterTimer);
  errorCenterTimer = window.setTimeout(renderErrorCenter, 0);
  return issue;
}

window.addEventListener('error', (event) => recordRuntimeError('JavaScript error', event.error || event.message, { feature: '全域錯誤' }));
window.addEventListener('unhandledrejection', (event) => recordRuntimeError('Unhandled rejection', event.reason, { feature: '非同步操作' }));
window.addEventListener('big2-pwa-error', (event) => {
  const detail = event.detail || {};
  const error = new Error(detail.message || 'PWA 發生錯誤');
  error.name = detail.name || 'PwaError';
  error.stack = detail.stack || error.stack;
  recordRuntimeError('PWA error', error, { feature: detail.feature || 'PWA', code: 'pwa-error' });
});

function el(id) {
  return document.getElementById(id);
}


function updateViewportMetrics() {
  if (viewportRaf) window.cancelAnimationFrame(viewportRaf);
  viewportRaf = window.requestAnimationFrame(() => {
    const viewport = window.visualViewport;
    const height = viewport?.height || window.innerHeight;
    const offsetTop = viewport?.offsetTop || 0;
    document.documentElement.style.setProperty('--app-height', `${Math.round(height)}px`);
    document.documentElement.style.setProperty('--viewport-offset-top', `${Math.round(offsetTop)}px`);
    const actionPanel = document.querySelector('.action-panel');
    const actionHeight = actionPanel && window.matchMedia('(max-width: 760px)').matches
      ? Math.ceil(actionPanel.getBoundingClientRect().height)
      : 0;
    const keyboardOpen = Boolean(viewport && window.innerHeight - height > 160);
    document.body.dataset.keyboard = keyboardOpen ? 'open' : 'closed';
    document.documentElement.style.setProperty('--action-panel-height', `${actionHeight}px`);
    viewportRaf = null;
  });
}

function renderNetworkStatus(state = navigator.onLine ? 'online' : 'offline', detail = '') {
  const bar = el('networkStatusBar');
  const title = el('networkStatusTitle');
  const text = el('networkStatusText');
  const retry = el('retryConnectionBtn');
  if (!bar || !title || !text || !retry) return;
  const normalized = ['online', 'offline', 'syncing', 'reconnected'].includes(state) ? state : 'online';
  bar.dataset.state = normalized;
  title.textContent = normalized === 'offline' ? '網路已中斷'
    : normalized === 'syncing' ? '正在重新連線'
      : normalized === 'reconnected' ? '已恢復連線'
        : '網路正常';
  text.textContent = detail || (normalized === 'offline'
    ? '單人遊戲仍可操作；多人出牌請等網路恢復後再送出。'
    : normalized === 'syncing'
      ? '正在恢復 Firebase 心跳與房間同步，請稍候。'
      : normalized === 'reconnected'
        ? '已恢復 Firebase 房間同步，可以繼續遊戲。'
        : '已連線；多人房間會自動同步。');
  retry.classList.toggle('hidden', normalized === 'online' || normalized === 'reconnected');
}

async function reconnectActiveRoom() {
  lastUserAction = '重新連線與重建房間同步';
  if (reconnectInProgress || navigator.onLine === false) return;
  reconnectInProgress = true;
  renderNetworkStatus('syncing');
  try {
    const result = await refreshActiveRoomConnection();
    renderNetworkStatus('reconnected', result?.roomId
      ? `房間 ${result.roomId} 已恢復心跳與同步。`
      : '網路已恢復；尚未加入多人房間。');
    if (result?.roomId) setRoomMessage(`已重新連線房間 ${result.roomId}。`, 'ok');
    window.setTimeout(() => renderNetworkStatus('online'), 1800);
  } catch (error) {
    renderNetworkStatus('offline', `重新連線失敗：${makeFriendlyError(error)}`);
  } finally {
    reconnectInProgress = false;
  }
}

function bindViewportAndNetworkEvents() {
  updateViewportMetrics();
  window.addEventListener('resize', updateViewportMetrics, { passive: true });
  window.addEventListener('orientationchange', () => window.setTimeout(updateViewportMetrics, 120), { passive: true });
  window.visualViewport?.addEventListener('resize', updateViewportMetrics, { passive: true });
  window.visualViewport?.addEventListener('scroll', updateViewportMetrics, { passive: true });
  window.addEventListener('offline', () => renderNetworkStatus('offline'));
  window.addEventListener('online', reconnectActiveRoom);
  window.addEventListener('pageshow', () => {
    updateViewportMetrics();
    if (navigator.onLine !== false) reconnectActiveRoom();
  });
  document.addEventListener('visibilitychange', () => {
    updateViewportMetrics();
    if (document.visibilityState === 'visible' && navigator.onLine !== false) reconnectActiveRoom();
  });
  el('retryConnectionBtn')?.addEventListener('click', reconnectActiveRoom);
  renderNetworkStatus(navigator.onLine === false ? 'offline' : 'online');
}

function getFocusGameKey() {
  const mode = gameState?.mode || 'single';
  const roomId = latestRoom?.roomId || currentRoomId || 'local';
  const gameId = gameState?.gameId || gameState?.gameNo || gameState?.history?.[0] || 'current';
  return `${mode}:${roomId}:${gameId}`;
}

function isGameplayActiveForFocus() {
  if (!gameState || gameState.finished) return false;
  if (latestRoom) {
    return latestRoom.status === 'playing' && gameState.mode === 'multiplayer';
  }
  return gameState.mode !== 'multiplayer';
}

function updateGameplayFocusMode() {
  const active = isGameplayActiveForFocus();
  const key = getFocusGameKey();
  if (active && key !== lastFocusGameKey) {
    focusPanelsExpanded = false;
    lastFocusGameKey = key;
  }
  if (!active) {
    focusPanelsExpanded = true;
    lastFocusGameKey = key;
  }
  const enabled = active && !focusPanelsExpanded;
  document.body.dataset.gameplayFocus = enabled ? 'on' : 'off';
  const button = el('focusModeToggleBtn');
  if (button) {
    button.disabled = !active;
    button.textContent = enabled ? '顯示設定' : (active ? '隱藏設定' : '設定已顯示');
    button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    button.title = enabled ? '展開規則設定、房間列表、檢查面板與說明' : '遊戲中隱藏非必要區塊，讓牌桌更清楚';
  }
}

function renderGameAndFocus() {
  render(gameState);
  updateGameplayFocusMode();
  updateViewportMetrics();
}

function getSavedAILevel() {
  const saved = Number(localStorage.getItem(AI_LEVEL_KEY));
  if (!Number.isFinite(saved)) return DEFAULT_AI_LEVEL;
  return Math.min(20, Math.max(1, Math.round(saved)));
}

function saveAILevel(level) {
  localStorage.setItem(AI_LEVEL_KEY, String(level));
}


function getSavedRulePresetId() {
  return localStorage.getItem(RULE_PRESET_KEY) || 'taiwanC3';
}

function getSavedScoringPresetId() {
  return localStorage.getItem(SCORING_PRESET_KEY) || 'standard';
}

function getSavedRules() {
  return getRulePreset(getSavedRulePresetId());
}

function getSavedScoringRules() {
  return getScoringPreset(getSavedScoringPresetId());
}

function isPassReminderEnabled() {
  return localStorage.getItem(PASS_REMINDER_KEY) !== '0';
}

function setPassReminderEnabled(enabled) {
  localStorage.setItem(PASS_REMINDER_KEY, enabled ? '1' : '0');
  const checkbox = el('passReminderToggle');
  if (checkbox) checkbox.checked = Boolean(enabled);
}

function confirmPassIfNeeded() {
  if (!isPassReminderEnabled()) return true;
  if (!hasPlayableMove(gameState)) return true;
  const ok = window.confirm('你目前還有可以出的牌，確定要 Pass 嗎？');
  if (!ok) {
    gameState.message = '已取消 Pass，可以重新選牌或按「推薦出牌」。';
    playSound('select');
    renderGameAndFocus();
  }
  return ok;
}

function applyPlayAssist(mode = 'smart') {
  const move = selectRecommendedPlay(gameState, mode);
  if (!move) {
    gameState.message = '目前沒有可出的牌，建議按 Pass。';
    playSound('error');
    renderGameAndFocus();
    return;
  }
  gameState.message = mode === 'minimum'
    ? `已選擇最小可出：${move.label}。`
    : `已推薦出牌：${move.label}。`;
  playSound('select');
  renderGameAndFocus();
}

function updateSettingsSummary() {
  const summary = el('settingsSummary');
  if (!summary) return;
  summary.textContent = `${ruleSummary(getSavedRules())}｜${scoringSummary(getSavedScoringRules())}`;
}

function updateSoundButton() {
  const button = el('soundToggleBtn');
  if (!button) return;
  const enabled = isSoundEnabled();
  button.textContent = enabled ? '音效：開' : '音效：關';
  button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
}

function renderExperienceSettings() {
  const prefs = getSoundPreferences();
  const volumeInput = el('soundVolumeInput');
  if (volumeInput) volumeInput.value = String(Math.round(Number(prefs.masterVolume ?? 0.75) * 100));
  document.querySelectorAll('.sound-option').forEach((input) => {
    input.checked = prefs[input.dataset.soundType] !== false;
  });
  const animationToggle = el('animationToggle');
  if (animationToggle) animationToggle.checked = isAnimationEnabled();
  const badge = el('experienceBadge');
  if (badge) badge.textContent = `${isSoundEnabled() ? '音效開' : '音效關'}｜${isAnimationEnabled() ? '動畫開' : '動畫關'}`;
}

function renderLeaderboard() {
  const box = el('leaderboardRows');
  const badge = el('leaderboardBadge');
  if (!box || !badge) return;
  let totals = latestRoom?.totalScores || gameState.totalScores || null;
  if (!totals && gameState.finished && Array.isArray(gameState.results)) {
    totals = gameState.results.reduce((map, row) => {
      map[row.seat] = {
        seat: row.seat,
        name: row.name,
        totalScore: Number(row.score || 0),
        wins: row.rank === 1 ? 1 : 0,
        games: 1,
        latestRank: row.rank,
        latestScore: Number(row.score || 0),
        latestRemaining: Number(row.remaining || 0)
      };
      return map;
    }, {});
  }
  if (!totals) {
    badge.textContent = '等待資料';
    box.textContent = '完成一局或加入房間後會顯示排行榜。';
    return;
  }
  const rows = totalsToSortedRows(totals).filter((row) => row.name);
  if (!rows.length) {
    badge.textContent = '尚無排名';
    box.textContent = '尚無可顯示的排行榜資料。';
    return;
  }
  const updatedText = latestSnapshotAt ? `｜更新 ${latestSnapshotAt.toLocaleTimeString()}` : '';
  badge.textContent = latestRoom?.roomId ? `房間 ${latestRoom.roomId}${updatedText}` : `本機統計${updatedText}`;
  box.innerHTML = rows.map((row) => `
    <div class="leaderboard-row">
      <strong>第 ${row.totalRank} 名｜${row.name}</strong>
      <span>總分 ${Number(row.totalScore || 0) > 0 ? '+' : ''}${Number(row.totalScore || 0)}｜勝場 ${Number(row.wins || 0)}｜局數 ${Number(row.games || 0)}${row.latestRank ? `｜上局第 ${row.latestRank} 名` : ''}</span>
    </div>
  `).join('');
}


function renderProgressAndRecords() {
  const daily = getDailyStats().today;
  const dailyBadge = el('dailyStatsBadge');
  const dailyGrid = el('dailyStatsGrid');
  const achievementList = el('achievementList');
  const recordsList = el('gameRecordsList');
  if (dailyBadge) dailyBadge.textContent = `${daily.date || ''}｜${Number(daily.games || 0)} 局`;
  if (dailyGrid) {
    const rows = [
      ['今日局數', Number(daily.games || 0)],
      ['今日勝場', Number(daily.wins || 0)],
      ['今日分數', `${Number(daily.score || 0) > 0 ? '+' : ''}${Number(daily.score || 0)}`],
      ['最佳單局', `${Number(daily.bestScore || 0) > 0 ? '+' : ''}${Number(daily.bestScore || 0)}`],
      ['多人局數', Number(daily.multiplayerGames || 0)]
    ];
    dailyGrid.innerHTML = rows.map(([label, value]) => `<div class="stat-card"><strong>${label}</strong><span>${value}</span></div>`).join('');
  }
  if (achievementList) {
    const achievements = getAchievements();
    achievementList.innerHTML = achievements.map((item) => `
      <div class="achievement-row ${item.unlocked ? 'unlocked' : 'locked'}">
        <strong>${item.unlocked ? '🏅' : '🔒'} ${item.title}</strong>
        <span>${item.text}${item.unlockedAt ? `｜${new Date(item.unlockedAt).toLocaleDateString()} 解鎖` : ''}</span>
      </div>
    `).join('');
  }
  if (recordsList) {
    const records = getGameRecords();
    recordsList.innerHTML = records.length ? records.map((record) => `
      <div class="record-row">
        <strong>${new Date(record.playedAt).toLocaleString()}｜${record.mode === 'multiplayer' ? `房間 ${record.roomId || '多人'}` : '單人'}</strong>
        <span>你第 ${record.localRank || '-'} 名｜本局 ${Number(record.localScore || 0) > 0 ? '+' : ''}${Number(record.localScore || 0)}｜勝者 ${record.winnerName || '-'}</span>
        <small>${record.resultSummary || ''}</small>
      </div>
    `).join('') : '尚無遊戲紀錄。';
  }
}

function maybeRecordFinishedGame(room = latestRoom) {
  if (!gameState?.finished || !Array.isArray(gameState.results)) return;
  const recordId = gameState.gameId || `${room?.roomId || 'local'}-${gameState.gameNo || 0}-${gameState.history?.[0] || ''}`;
  if (recordId === lastRecordedFinishedGameId) return;
  const before = getAchievements().filter((item) => item.unlocked).length;
  const result = recordFinishedGame(gameState, room);
  if (result.added) {
    lastRecordedFinishedGameId = recordId;
    const after = getAchievements().filter((item) => item.unlocked).length;
    if (after > before) playSound('achievement');
  }
  renderProgressAndRecords();
}

function renderRoomManagement(room = latestRoom) {
  const badge = el('roomManageBadge');
  const box = el('roomManagementList');
  if (!badge || !box) return;
  if (!room) {
    badge.textContent = '尚未連線';
    box.textContent = '建立或加入房間後會顯示座位管理。';
    return;
  }
  badge.textContent = room.isHost ? '房主可管理' : '只有房主可管理';
  const seats = room.seatList || [];
  box.innerHTML = seats.map((seat, index) => {
    const name = seat?.name || '空位';
    const disabled = !room.isHost ? 'disabled' : '';
    const canKick = room.isHost && seat && seat.uid !== room.localUid;
    const targetOptions = [0, 1, 2, 3].filter((target) => target !== index).map((target) => `<option value="${target}">移到座位 ${target + 1}</option>`).join('');
    return `
      <div class="management-row ${seat ? 'occupied' : 'empty'}">
        <div>
          <strong>座位 ${index + 1}｜${name}</strong>
          <span>${seat ? [seat.isAI ? 'AI' : '真人', seat.host || seat.uid === room.hostUid ? '房主' : '', seat.connected ? '已連線' : (seat.isAI ? '' : '離線')].filter(Boolean).join('｜') : '等待玩家'}</span>
        </div>
        <select class="seat-move-select" data-from-seat="${index}" ${!room.isHost || !seat ? 'disabled' : ''}>
          <option value="">重新安排座位</option>${targetOptions}
        </select>
        <button class="secondary-btn seat-kick-btn" type="button" data-seat="${index}" ${canKick ? '' : 'disabled'}>踢除</button>
      </div>
    `;
  }).join('');

  box.querySelectorAll('.seat-kick-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!confirm('確定要踢除這個座位的玩家嗎？')) return;
      try {
        await kickSeat(currentRoomId, Number(button.dataset.seat));
        playSound('move');
        setRoomMessage('已更新座位。', 'ok');
      } catch (error) {
        setRoomMessage(makeFriendlyError(error) || '踢除玩家失敗。', 'warn');
      }
    });
  });
  box.querySelectorAll('.seat-move-select').forEach((select) => {
    select.addEventListener('change', async () => {
      if (select.value === '') return;
      try {
        await moveSeat(currentRoomId, Number(select.dataset.fromSeat), Number(select.value));
        playSound('move');
        setRoomMessage('已重新安排座位。', 'ok');
      } catch (error) {
        setRoomMessage(makeFriendlyError(error) || '重新安排座位失敗。', 'warn');
      } finally {
        select.value = '';
      }
    });
  });
}

function roomListRow(room, source = 'recent') {
  const updated = room.updatedAtMs ? new Date(room.updatedAtMs).toLocaleString() : '時間未記錄';
  const host = room.hostName ? `房主 ${room.hostName}` : '房主未記錄';
  const seatInfo = Number.isFinite(room.humanCount) ? `真人 ${room.humanCount}｜AI ${room.aiCount || 0}` : `第 ${room.gameNo || 0} 局`;
  const lockText = room.passwordEnabled ? '｜有密碼' : '';
  const joinText = room.status === 'playing' ? '回房' : '加入';
  return `
    <div class="room-list-row">
      <div>
        <strong>${room.roomId}</strong>
        <span>${roomStatusLabel(room.status)}${lockText}｜${host}｜${seatInfo}</span>
        <small>${room.lastEvent || updated}</small>
      </div>
      <button class="secondary-btn room-join-btn" type="button" data-room-id="${room.roomId}" data-source="${source}">${joinText}</button>
    </div>
  `;
}

function bindRoomJoinButtons() {
  document.querySelectorAll('.room-join-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      el('roomCodeInput').value = button.dataset.roomId || '';
      await connectRoom(button.dataset.roomId || '', 'join');
    });
  });
}

function renderRoomDirectory(publicRooms = null, message = '') {
  const recentBox = el('recentRoomsList');
  const publicBox = el('publicRoomsList');
  if (recentBox) {
    const recent = getRecentRooms();
    recentBox.innerHTML = recent.length ? recent.map((room) => roomListRow(room, 'recent')).join('') : '尚無最近房號。';
    recentBox.dataset.count = String(recent.length);
  }
  if (publicBox && publicRooms) {
    publicBox.innerHTML = publicRooms.length ? publicRooms.map((room) => roomListRow(room, 'public')).join('') : '目前沒有可顯示的最近房間。';
    publicBox.dataset.count = String(publicRooms.length);
  } else if (publicBox && message) {
    publicBox.textContent = message;
  }
  bindRoomJoinButtons();
}

async function refreshPublicRooms() {
  lastUserAction = '刷新房間列表';
  const button = el('refreshRoomsBtn');
  if (button) {
    button.disabled = true;
    button.textContent = '讀取中...';
  }
  try {
    const rooms = await listRecentRoomsFromFirestore(12);
    renderRoomDirectory(rooms);
    setRoomMessage(`${rooms.cacheHit ? '已使用 15 秒快取顯示' : '已讀取'} ${rooms.length} 個最近房間；若加入進行中房間，原玩家同裝置可取回座位。`, 'ok');
  } catch (error) {
    renderRoomDirectory(null, makeFriendlyError(error) || '無法讀取房間列表，仍可用最近房號或手動輸入房號加入。');
    setRoomMessage(makeFriendlyError(error) || '讀取房間列表失敗。', 'warn');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = '刷新房間列表';
    }
  }
}

function updateAllExperienceViews() {
  updateSoundButton();
  renderExperienceSettings();
  renderLeaderboard();
  renderProgressAndRecords();
  renderRoomManagement();
  renderRoomDirectory();
}


function formatDebugValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function renderDebugPanel(room = latestRoom) {
  const panel = el('debugPanel');
  window.clearTimeout(errorCenterTimer);
  errorCenterTimer = window.setTimeout(renderErrorCenter, 0);
  if (!panel) return;
  const localSeatText = Number.isInteger(room?.localSeat) ? `座位 ${room.localSeat + 1}` : '未入座';
  const hostSeat = room?.seatList?.findIndex((seat) => seat?.uid === room?.hostUid);
  const game = room?.game || null;
  const items = [
    ['版本', `v${game?.version || room?.version || VERSION}`],
    ['房號', room?.roomId || currentRoomId || '—'],
    ['狀態', room?.status || '尚未連線'],
    ['我的座位', localSeatText],
    ['我的 UID', room?.localUid ? `${room.localUid.slice(0, 8)}...` : '—'],
    ['房主座位', hostSeat >= 0 ? `座位 ${hostSeat + 1}` : '—'],
    ['目前回合', Number.isInteger(game?.currentTurnSeat) ? `座位 ${game.currentTurnSeat + 1}` : '—'],
    ['領出座位', Number.isInteger(game?.leadSeat) ? `座位 ${game.leadSeat + 1}` : '—'],
    ['第幾局', room?.gameNo || game?.gameNo || 0],
    ['Revision', game?.security?.revision ?? 0],
    ['LastAction', game?.security?.lastActionId ? game.security.lastActionId.slice(-10) : '—'],
    ['GameId', game?.gameId ? game.gameId.slice(-18) : '—'],
    ['本機送出鎖', multiplayerActionSubmitting ? '鎖定中' : '可操作'],
    ['最後同步', latestSnapshotAt ? latestSnapshotAt.toLocaleTimeString() : '—']
  ];
  panel.innerHTML = items.map(([label, value]) => `
    <div><strong>${label}</strong><span>${formatDebugValue(value)}</span></div>
  `).join('');
}

async function buildDebugReport() {
  const room = latestRoom || {};
  const game = gameState || room.game || {};
  const localSeat = Number.isInteger(room.localSeat) ? room.localSeat : game.localSeat;
  const players = (game.players || room.game?.players || []).map((player) => ({
    seat: player.seat,
    name: player.name,
    isAI: Boolean(player.isAI),
    connected: player.connected !== false,
    handCount: player.hand?.length ?? null
  }));
  const seats = (room.seatList || []).map((seat, index) => seat ? {
    seat: index,
    name: seat.name,
    isAI: Boolean(seat.isAI),
    connected: seat.connected !== false,
    aiTakingOver: Boolean(seat.aiTakingOver),
    isHost: seat.uid === room.hostUid
  } : { seat: index, empty: true });
  let pwaDiagnostics = null;
  try {
    pwaDiagnostics = await window.big2PwaApi?.getDiagnostics?.();
  } catch (error) {
    pwaDiagnostics = { error: error?.message || String(error) };
  }
  const report = {
    generatedAt: new Date().toISOString(),
    version: `v${game.version || room.version || VERSION}`,
    url: window.location.href,
    roomId: room.roomId || currentRoomId || null,
    roomStatus: room.status || null,
    message: game.message || lastRoomMessage || null,
    roomMessage: lastRoomMessage || null,
    localSeat,
    currentTurnSeat: game.currentTurnSeat,
    leadSeat: game.leadSeat,
    roundNo: game.roundNo,
    gameNo: room.gameNo || game.gameNo || 0,
    gameId: game.gameId || null,
    revision: game.security?.revision ?? null,
    lastActionId: game.security?.lastActionId || null,
    lastPlay: game.lastPlay ? {
      playerName: game.lastPlay.playerName,
      type: game.lastPlay.name || game.lastPlay.id,
      size: game.lastPlay.size,
      cards: game.lastPlay.cards?.map((card) => card.id) || []
    } : null,
    selectedCards: getSelectedCards(game).map((card) => card.id),
    players,
    seats,
    historyTop: (game.history || []).slice(0, 12),
    latestSnapshotAt: latestSnapshotAt ? latestSnapshotAt.toISOString() : null,
    online: navigator.onLine !== false,
    visibility: document.visibilityState,
    viewport: { width: window.innerWidth, height: window.innerHeight, visualHeight: window.visualViewport?.height || null },
    userAgent: navigator.userAgent,
    firebasePresence: getPresenceDebugInfo(),
    pwa: pwaDiagnostics,
    acceptance: readAcceptanceState(),
    runtimeErrors: [...runtimeErrors]
  };
  return JSON.stringify(report, null, 2);
}

async function copyDebugReport() {
  const text = await buildDebugReport();
  try {
    await navigator.clipboard.writeText(text);
    setRoomMessage('已複製完整問題回報，包含 PWA、Firebase、裝置與最近錯誤資訊。', 'ok');
  } catch {
    window.prompt('瀏覽器不允許自動複製，請手動複製以下偵錯資訊：', text);
    setRoomMessage('已產生完整問題回報，請手動複製。', 'warn');
  }
}

async function downloadDebugReport() {
  const text = await buildDebugReport();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `big2-diagnostic-v${VERSION}-${stamp}.txt`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  setRoomMessage('已下載診斷文字檔，可直接附檔回報問題。', 'ok');
}


function escapeIssueText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function issueTimeText(value) {
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? '時間未知' : time.toLocaleString('zh-TW', { hour12: false });
}

function renderErrorCenter() {
  const rows = el('errorLogRows');
  const badge = el('errorLogBadge');
  const summary = el('errorLogSummary');
  const listenerBadge = el('listenerHealthBadge');
  const metricsBox = el('runtimeHealthGrid');
  const presence = getPresenceDebugInfo();
  const activeListenerCount = presence.listenerActive ? 1 : 0;
  const listenerBalance = (presence.metrics?.listenerStarts || 0) - (presence.metrics?.listenerStops || 0);
  const listenerHealthy = activeListenerCount <= 1 && listenerBalance <= 1;

  if (badge) {
    badge.textContent = runtimeErrors.length ? `${runtimeErrors.length} 筆` : '無錯誤';
    badge.classList.toggle('ok', runtimeErrors.length === 0);
    badge.classList.toggle('warn', runtimeErrors.length > 0);
  }
  if (listenerBadge) {
    listenerBadge.textContent = listenerHealthy ? `監聽正常 ${activeListenerCount}` : `監聽警告 ${listenerBalance}`;
    listenerBadge.classList.toggle('ok', listenerHealthy);
    listenerBadge.classList.toggle('warn', !listenerHealthy);
  }
  if (summary) {
    summary.textContent = runtimeErrors.length
      ? `保留最近 ${runtimeErrors.length} 筆本機錯誤；可複製、下載或清除。資料只存在這個瀏覽器。`
      : '尚未記錄執行錯誤。遇到 Firebase、斷線或 PWA 問題時會自動保留最近 20 筆。';
    summary.dataset.level = runtimeErrors.length ? 'warn' : 'ok';
  }
  if (metricsBox) {
    const metrics = presence.metrics || {};
    metricsBox.innerHTML = [
      ['網路', navigator.onLine === false ? '離線' : '正常'],
      ['房間監聽', activeListenerCount ? `啟用（${presence.listeningRoomId || '房間'}）` : '未啟用'],
      ['監聽啟停', `${metrics.listenerStarts || 0} / ${metrics.listenerStops || 0}`],
      ['快照次數', metrics.listenerSnapshots || 0],
      ['心跳寫入', metrics.heartbeatWrites || 0],
      ['Firestore 讀 / 寫', `${metrics.documentReads || 0} / ${metrics.writeOperations || 0}`]
    ].map(([label, value]) => `<div><strong>${escapeIssueText(label)}</strong><span>${escapeIssueText(value)}</span></div>`).join('');
  }
  if (!rows) return;
  if (!runtimeErrors.length) {
    rows.innerHTML = '<div class="error-log-empty">目前沒有錯誤紀錄。</div>';
    return;
  }
  rows.innerHTML = runtimeErrors.map((issue) => `
    <article class="error-log-item">
      <div class="error-log-head">
        <strong>${escapeIssueText(issue.feature || issue.kind || '未分類')}</strong>
        <time datetime="${escapeIssueText(issue.at)}">${escapeIssueText(issueTimeText(issue.at))}</time>
      </div>
      <p>${escapeIssueText(issue.message)}</p>
      <div class="error-log-meta">
        <span>${escapeIssueText(issue.name || issue.kind)}</span>
        ${issue.code ? `<span>代碼：${escapeIssueText(issue.code)}</span>` : ''}
        ${issue.roomId ? `<span>房號：${escapeIssueText(issue.roomId)}</span>` : ''}
        <span>${issue.online === false ? '離線' : '線上'}</span>
      </div>
    </article>`).join('');
}

function errorLogText() {
  const payload = {
    generatedAt: new Date().toISOString(),
    version: `v${VERSION}`,
    issueCount: runtimeErrors.length,
    currentContext: getRuntimeContext(),
    firebasePresence: getPresenceDebugInfo(),
    issues: runtimeErrors
  };
  return JSON.stringify(payload, null, 2);
}

async function copyErrorLog() {
  const text = errorLogText();
  try {
    await navigator.clipboard.writeText(text);
    setRoomMessage('已複製錯誤紀錄中心內容。', 'ok');
  } catch {
    window.prompt('請手動複製錯誤紀錄：', text);
  }
}

function downloadErrorLog() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const blob = new Blob([errorLogText()], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `big2-error-log-v${VERSION}-${stamp}.txt`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  setRoomMessage('已下載錯誤紀錄文字檔。', 'ok');
}

function clearErrorLog() {
  if (runtimeErrors.length && !window.confirm('確定清除這台裝置上的錯誤紀錄嗎？')) return;
  runtimeErrors.length = 0;
  persistRuntimeErrors();
  renderErrorCenter();
  setRoomMessage('已清除本機錯誤紀錄。', 'ok');
}

function readAcceptanceState() {
  const saved = migrateJsonStorage(ACCEPTANCE_KEY, LEGACY_ACCEPTANCE_KEYS, {});
  return Object.fromEntries(ACCEPTANCE_ITEMS.map((id) => [id, Boolean(saved[id])]));
}

function writeAcceptanceState(state) {
  try { localStorage.setItem(ACCEPTANCE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

function renderAcceptanceCenter() {
  const state = readAcceptanceState();
  const checked = ACCEPTANCE_ITEMS.filter((id) => state[id]).length;
  document.querySelectorAll('[data-acceptance-id]').forEach((input) => {
    input.checked = Boolean(state[input.dataset.acceptanceId]);
  });
  const badge = el('acceptanceProgressBadge');
  const progress = el('acceptanceProgress');
  const summary = el('acceptanceSummary');
  if (badge) {
    badge.textContent = `${checked}/${ACCEPTANCE_ITEMS.length}`;
    badge.classList.toggle('ok', checked === ACCEPTANCE_ITEMS.length);
    badge.classList.toggle('warn', checked > 0 && checked < ACCEPTANCE_ITEMS.length);
  }
  if (progress) {
    progress.max = ACCEPTANCE_ITEMS.length;
    progress.value = checked;
  }
  if (summary) {
    const presence = getPresenceDebugInfo();
    const listenerBalance = (presence.metrics?.listenerStarts || 0) - (presence.metrics?.listenerStops || 0);
    summary.textContent = checked === ACCEPTANCE_ITEMS.length
      ? '實機驗收項目已全部勾選，可進入正式公開與後續功能開發。'
      : `已完成 ${checked} 項，尚有 ${ACCEPTANCE_ITEMS.length - checked} 項。現在：${navigator.onLine === false ? '離線' : '線上'}、Firestore listener 差額 ${listenerBalance}。`;
  }
}

function acceptanceSummaryText() {
  const state = readAcceptanceState();
  const lines = [...document.querySelectorAll('[data-acceptance-id]')].map((input) => {
    const label = input.closest('label')?.querySelector('strong')?.textContent?.trim() || input.dataset.acceptanceId;
    return `${state[input.dataset.acceptanceId] ? '✅' : '⬜'} ${label}`;
  });
  return [`Big2 TW v${VERSION} 實機驗收`, `產生時間：${new Date().toLocaleString('zh-TW')}`, '', ...lines].join('\n');
}

async function copyAcceptanceSummary() {
  const text = acceptanceSummaryText();
  try {
    await navigator.clipboard.writeText(text);
    setRoomMessage('已複製實機驗收摘要。', 'ok');
  } catch {
    window.prompt('請手動複製驗收摘要：', text);
  }
}

async function runAcceptanceQuickCheck() {
  const state = readAcceptanceState();
  const presence = getPresenceDebugInfo();
  const listenerBalance = (presence.metrics?.listenerStarts || 0) - (presence.metrics?.listenerStops || 0);
  if ('serviceWorker' in navigator && window.isSecureContext) state['pwa-update'] = true;
  if (listenerBalance <= 1 && (presence.listenerActive ? presence.listeningRoomId : true)) state['firebase-health'] = true;
  writeAcceptanceState(state);
  renderAcceptanceCenter();
  setRoomMessage('已完成可自動判斷的 PWA 與 Firebase listener 健康檢查；真實裝置與多人局仍請手動勾選。', 'ok');
}

function bindAcceptanceAndErrorCenter() {
  document.querySelectorAll('[data-acceptance-id]').forEach((input) => {
    input.addEventListener('change', () => {
      const state = readAcceptanceState();
      state[input.dataset.acceptanceId] = input.checked;
      writeAcceptanceState(state);
      renderAcceptanceCenter();
    });
  });
  el('runAcceptanceQuickCheckBtn')?.addEventListener('click', runAcceptanceQuickCheck);
  el('copyAcceptanceBtn')?.addEventListener('click', copyAcceptanceSummary);
  el('resetAcceptanceBtn')?.addEventListener('click', () => {
    if (!window.confirm('確定重設所有實機驗收勾選狀態嗎？')) return;
    localStorage.removeItem(ACCEPTANCE_KEY);
    renderAcceptanceCenter();
  });
  el('copyErrorLogBtn')?.addEventListener('click', copyErrorLog);
  el('downloadErrorLogBtn')?.addEventListener('click', downloadErrorLog);
  el('clearErrorLogBtn')?.addEventListener('click', clearErrorLog);
  el('retryListenerBtn')?.addEventListener('click', reconnectActiveRoom);
  renderAcceptanceCenter();
  renderErrorCenter();
  window.setInterval(() => {
    renderAcceptanceCenter();
    renderErrorCenter();
  }, 10000);
}


function setMultiplayerActionSubmitting(locked, label = '同步中') {
  multiplayerActionSubmitting = Boolean(locked);
  setActionLock(multiplayerActionSubmitting, label);
  renderGameAndFocus();
  renderDebugPanel(latestRoom);
}

async function runLockedMultiplayerAction(label, action) {
  lastUserAction = label || '多人操作';
  const now = Date.now();
  if (multiplayerActionSubmitting || now - lastSubmitStartedAt < ACTION_COOLDOWN_MS) {
    gameState.message = '上一個動作仍在同步或剛送出，請稍候再按。';
    playSound('error');
    renderGameAndFocus();
    return;
  }
  lastSubmitStartedAt = now;
  setMultiplayerActionSubmitting(true, label);
  try {
    await action();
  } finally {
    const elapsed = Date.now() - lastSubmitStartedAt;
    window.setTimeout(() => {
      setMultiplayerActionSubmitting(false);
    }, Math.max(0, 220 - elapsed));
  }
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
      playSound(gameState.finished ? 'win' : (gameState.lastAction?.type === 'PASS' ? 'pass' : 'play'));
      clearSelection();
      renderGameAndFocus();
      renderLeaderboard();
      maybeRecordFinishedGame();
      scheduleAIIfNeeded();
    }, 520);
  }
}

const AI_TURN_LEASE_PREFIX = 'big2-ai-turn-lease:';
const AI_TURN_LEASE_MS = 4200;

function claimMultiplayerAITurnLease(room) {
  const game = room?.game;
  if (!room?.roomId || !game) return { acquired: false, key: null };
  const key = `${AI_TURN_LEASE_PREFIX}${room.roomId}`;
  const target = `${game.gameId || room.gameNo || 'game'}:${game.security?.revision || 0}:${game.currentTurnSeat}`;
  const now = Date.now();
  try {
    const current = JSON.parse(localStorage.getItem(key) || 'null');
    if (current?.target === target && current?.owner !== SESSION_TAB_ID && Number(current.expiresAt || 0) > now) {
      return { acquired: false, key, target };
    }
    localStorage.setItem(key, JSON.stringify({ owner: SESSION_TAB_ID, target, expiresAt: now + AI_TURN_LEASE_MS }));
    const confirmed = JSON.parse(localStorage.getItem(key) || 'null');
    return { acquired: confirmed?.owner === SESSION_TAB_ID && confirmed?.target === target, key, target };
  } catch {
    // localStorage 被禁用時仍依 Firestore transaction 的 revision 防止重複 AI 行動。
    return { acquired: true, key: null, target };
  }
}

function releaseMultiplayerAITurnLease(lease) {
  if (!lease?.key) return;
  try {
    const current = JSON.parse(localStorage.getItem(lease.key) || 'null');
    if (current?.owner === SESSION_TAB_ID && current?.target === lease.target) localStorage.removeItem(lease.key);
  } catch { /* ignore */ }
}

function scheduleMultiplayerAIIfNeeded(room = latestRoom) {
  window.clearTimeout(multiplayerAiTimer);
  if (!room || !room.isHost || room.status !== 'playing' || !room.game || room.game.finished) return;
  const current = room.game.players?.[room.game.currentTurnSeat];
  if (!current?.isAI) return;

  multiplayerAiTimer = window.setTimeout(async () => {
    const lease = claimMultiplayerAITurnLease(room);
    if (!lease.acquired) return;
    try {
      await runMultiplayerAITurn(room.roomId);
    } catch (error) {
      const text = makeFriendlyError(error, 'AI 接管出牌') || 'AI 接管出牌失敗。';
      // 另一個分頁已先完成回合時，transaction 會拒絕舊 revision；不再顯示成嚴重錯誤。
      if (!/牌局已更新|回合已更新|不是 AI/.test(text)) setRoomMessage(text, 'warn');
    } finally {
      releaseMultiplayerAITurnLease(lease);
    }
  }, 680);
}

function resetGame(options = {}) {
  const aiLevel = getSavedAILevel();
  gameState = createNewGame({ aiLevel, rules: getSavedRules(), scoringRules: getSavedScoringRules() });
  lastRenderedActionId = null;
  lastRenderedMultiplayerGameId = null;
  clearSelection();
  renderGameAndFocus();
  renderLeaderboard();
  if (options.playDealSound) playDealSound();
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
  lastRoomMessage = message || '';
  const roomMessage = el('roomMessage');
  roomMessage.textContent = message;
  roomMessage.dataset.level = level;
}

function focusRoomPasswordForRetry() {
  const input = el('roomPasswordInput');
  if (!input) return;
  input.focus();
  input.select?.();
  scrollToPanel('.room-panel', '#roomPasswordInput');
}

async function runButtonLocked(buttonId, busyText, action) {
  const button = el(buttonId);
  lastUserAction = button?.textContent?.trim() || busyText || buttonId;
  const originalText = button?.textContent || '';
  if (button?.disabled) return;
  if (button) {
    button.disabled = true;
    button.textContent = busyText;
    button.setAttribute('aria-busy', 'true');
  }
  try {
    return await action();
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
      button.removeAttribute('aria-busy');
    }
  }
}

function makeFriendlyError(error, feature = lastUserAction || '多人操作') {
  recordRuntimeError('操作失敗', error, { feature, code: error?.code || null });
  const text = explainFirebaseError(error);
  if (/密碼/.test(text)) {
    window.setTimeout(focusRoomPasswordForRetry, 60);
    return `${text} 請在「房間密碼」欄位輸入正確密碼後再按加入。`;
  }
  if (/找不到房間|不存在/.test(text)) return `${text} 請確認房號是否為 6 碼，或請房主重新複製邀請連結。`;
  if (/Firestore|Rules|權限|permission/i.test(text)) return `${text} 若剛更新版本，請重新貼上本版 firestore.rules 並 Publish。`;
  if (/網路|Failed to fetch|network/i.test(text)) return `${text} 手機請確認網路穩定，或改用瀏覽器重新開啟邀請連結。`;
  return text;
}

function renderFirebaseDiagnosticPanel(result = null) {
  const grid = el('firebaseCheckGrid');
  const summary = el('firebaseCheckSummary');
  if (!grid || !summary) return;

  if (!result) {
    const setup = getFirebaseSetupState();
    const rows = [
      { label: 'Firebase Config', ok: setup.ok, text: setup.text },
      { label: '匿名登入', ok: null, text: '按「執行檢查」後確認。' },
      { label: 'Firestore 寫入', ok: null, text: '按「執行檢查」後建立暫存房間測試。' },
      { label: 'Cloud Functions', ok: true, text: `未使用。v${VERSION} 不需要 functions/，也不需要 Blaze。` }
    ];
    grid.innerHTML = rows.map(renderFirebaseCheckItem).join('');
    summary.textContent = setup.ok ? '已偵測到 Firebase Config。可按「執行檢查」確認 Auth 與 Firestore Rules。' : '尚未填入 Firebase Config。';
    summary.dataset.level = setup.ok ? 'ok' : 'warn';
    return;
  }

  grid.innerHTML = result.checks.map(renderFirebaseCheckItem).join('');
  summary.textContent = result.summary;
  summary.dataset.level = result.ok ? 'ok' : 'warn';
}

function renderFirebaseCheckItem(item) {
  const stateClass = item.ok === true ? 'ok' : item.ok === false ? 'warn' : 'neutral';
  const stateText = item.ok === true ? '通過' : item.ok === false ? '需處理' : '未檢查';
  return `
    <div class="firebase-check-item ${stateClass}">
      <strong>${item.label}</strong>
      <span class="pill ${stateClass === 'neutral' ? '' : stateClass}">${stateText}</span>
      <p>${item.text}</p>
    </div>
  `;
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
    const incomingGameId = room.game.gameId || `${room.roomId || currentRoomId || 'room'}-${room.gameNo || 0}`;
    const isNewMultiplayerGame = incomingGameId !== lastRenderedMultiplayerGameId;
    gameState = {
      ...room.game,
      mode: 'multiplayer',
      localSeat: Number.isInteger(room.localSeat) ? room.localSeat : 0,
      totalScores: room.totalScores || room.game.totalScores || null,
      gameNo: room.gameNo || room.game.gameNo || 0
    };

    // 不要在每次 Firestore 快照更新時清空選牌。
    // v0.6.0 的心跳 / presence 更新會觸發畫面重繪，導致玩家剛選好的牌閃一下就被取消。
    // 只有真正換新局時才清空；一般同步更新只會在 render() 內移除已不在手牌中的失效選牌。
    if (isNewMultiplayerGame) {
      clearSelection();
      lastRenderedMultiplayerGameId = incomingGameId;
      playDealSound();
    }

    const actionId = gameState.security?.lastActionId || `${gameState.gameId || 'game'}:${gameState.history?.[0] || ''}`;
    const shouldPlaySound = actionId && actionId !== lastRenderedActionId;
    renderGameAndFocus();
    renderLeaderboard();
    maybeRecordFinishedGame(room);
    if (shouldPlaySound) {
      playSound(gameState.finished ? 'win' : (gameState.lastAction?.type === 'PASS' ? 'pass' : 'play'));
      lastRenderedActionId = actionId;
    }
    scheduleMultiplayerAIIfNeeded(room);
    return;
  }

  if (gameState.mode === 'multiplayer') {
    resetGame();
  }
}

function renderRoom(room) {
  latestRoom = room;
  latestSnapshotAt = new Date();
  updateDuplicateTabWarning(room);
  if (!room) {
    currentRoomId = null;
    latestInviteUrl = '';
    el('roomBadge').textContent = '房間不存在';
    el('inviteLinkInput').value = '';
    el('qrBox').classList.add('hidden');
    setRoomControlsConnected(false);
    renderEmptySeats();
    setRoomMessage('房間不存在或已被刪除。', 'warn');
    renderDebugPanel(null);
    return;
  }

  currentRoomId = room.roomId;
  rememberRecentRoom({ ...room, inviteUrl: buildInviteUrl(room.roomId) });
  renderRoomDirectory();
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
  renderDebugPanel(room);
  renderLeaderboard();
  renderRoomManagement(room);
}

async function connectRoom(roomId, mode = 'join') {
  lastUserAction = mode === 'auto' ? '邀請連結自動加入房間' : '加入房間';
  const normalized = normalizeRoomId(roomId);
  if (!normalized) {
    setRoomMessage('請先輸入房號。', 'warn');
    return;
  }

  try {
    setRoomMessage(mode === 'auto' ? `偵測邀請連結，正在自動加入房間 ${normalized}...` : `正在加入房間 ${normalized}...`);
    const result = await joinRoom(normalized, { playerName: getPlayerName(), roomPassword: el('roomPasswordInput')?.value || '' });
    currentRoomId = result.roomId;
    latestInviteUrl = result.inviteUrl;
    await listenRoom(result.roomId, renderRoom, (error) => setRoomMessage(`房間同步失敗：${makeFriendlyError(error)}`, 'warn'));
    playSound('join');
    setRoomMessage(mode === 'auto' ? `已自動加入房間 ${result.roomId}。` : `已加入房間 ${result.roomId}。`, 'ok');
  } catch (error) {
    setRoomMessage(makeFriendlyError(error) || '加入房間失敗。', 'warn');
  }
}

async function bindRoomEvents() {
  setFirebaseBadge();
  renderFirebaseDiagnosticPanel();
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
    await runButtonLocked('createRoomBtn', '建立中...', async () => {
      try {
        setRoomMessage('正在建立 Firebase 房間...');
        const result = await createRoom({ playerName: getPlayerName(), aiLevel: getSavedAILevel(), rules: getSavedRules(), scoringRules: getSavedScoringRules(), roomPassword: el('roomPasswordInput')?.value || '' });
        currentRoomId = result.roomId;
        latestInviteUrl = result.inviteUrl;
        await listenRoom(result.roomId, renderRoom, (error) => setRoomMessage(`房間同步失敗：${makeFriendlyError(error)}`, 'warn'));
        playSound('join');
        setRoomMessage(`已建立房間 ${result.roomId}，可以複製連結或顯示 QR Code。`, 'ok');
      } catch (error) {
        setRoomMessage(makeFriendlyError(error) || '建立房間失敗，請檢查 Firebase 設定。', 'warn');
      }
    });
  });

  el('joinRoomBtn').addEventListener('click', async () => {
    await runButtonLocked('joinRoomBtn', '加入中...', async () => connectRoom(el('roomCodeInput').value, 'join'));
  });

  el('fillAIBtn').addEventListener('click', async () => {
    await runButtonLocked('fillAIBtn', '補位中...', async () => {
      try {
        await fillAISeats(currentRoomId || el('roomCodeInput').value);
        setRoomMessage('已補滿 AI 空位。', 'ok');
      } catch (error) {
        setRoomMessage(makeFriendlyError(error) || '補 AI 空位失敗。', 'warn');
      }
    });
  });

  el('startMultiplayerBtn').addEventListener('click', async () => {
    await runButtonLocked('startMultiplayerBtn', latestRoom?.status === 'finished' ? '下一局中...' : '開始中...', async () => {
      try {
        setRoomMessage(latestRoom?.status === 'finished' ? '正在開始下一局並保留累計總分...' : '正在同步洗牌、發牌並開始多人遊戲...');
        await startMultiplayerGame(currentRoomId || el('roomCodeInput').value, { aiLevel: getSavedAILevel(), rules: getSavedRules(), scoringRules: getSavedScoringRules(), expectedGameNo: Number(latestRoom?.gameNo || 0) });
        playSound('start');
        setRoomMessage(latestRoom?.status === 'finished' ? '下一局已開始，累計總分已保留。' : '多人遊戲已開始。', 'ok');
      } catch (error) {
        setRoomMessage(makeFriendlyError(error) || '開始多人遊戲失敗。', 'warn');
      }
    });
  });

  el('leaveRoomBtn').addEventListener('click', async () => {
    await runButtonLocked('leaveRoomBtn', '離開中...', async () => {
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
        setRoomMessage(makeFriendlyError(error) || '離開房間失敗。', 'warn');
      }
    });
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
    const qrImage = el('qrCodeImage');
    const qrStatus = el('qrStatusText');
    const qrFallback = el('qrFallbackLink');
    const qrUrl = qrCodeImageUrl(latestInviteUrl);
    if (qrFallback) {
      qrFallback.href = qrUrl;
      qrFallback.classList.remove('hidden');
    }
    if (qrStatus) qrStatus.textContent = '正在產生 QR Code... 若圖片未出現，可直接複製邀請連結。';
    qrImage.onload = () => {
      if (qrStatus) qrStatus.textContent = 'QR Code 已產生，手機掃描後會開啟同一房間並自動加入。';
    };
    qrImage.onerror = () => {
      if (qrStatus) qrStatus.textContent = 'QR Code 圖片服務暫時無法載入，請改用複製邀請連結。';
      setRoomMessage('QR Code 圖片載入失敗，請改用複製邀請連結。', 'warn');
    };
    qrImage.src = qrUrl;
    el('qrBox').classList.remove('hidden');
    setRoomMessage('已顯示 QR Code，手機掃描後會自動加入房間。', 'ok');
  });


  const copyDebugBtn = el('copyDebugBtn');
  if (copyDebugBtn) copyDebugBtn.addEventListener('click', copyDebugReport);
  el('downloadDebugBtn')?.addEventListener('click', downloadDebugReport);

  const firebaseCheckBtn = el('runFirebaseCheckBtn');
  if (firebaseCheckBtn) {
    firebaseCheckBtn.addEventListener('click', async () => {
      firebaseCheckBtn.disabled = true;
      firebaseCheckBtn.textContent = '檢查中...';
      setRoomMessage('正在檢查 Firebase Config、匿名登入與 Firestore Rules...');
      try {
        const result = await runFirebaseDiagnostics();
        renderFirebaseDiagnosticPanel(result);
        setRoomMessage(result.summary, result.ok ? 'ok' : 'warn');
      } catch (error) {
        const result = {
          ok: false,
          summary: makeFriendlyError(error),
          checks: [
            { label: 'Firebase 設定檢查', ok: false, text: makeFriendlyError(error) },
            { label: 'Cloud Functions', ok: true, text: `未使用。v${VERSION} 不需要 functions/，也不需要 Blaze。` }
          ]
        };
        renderFirebaseDiagnosticPanel(result);
        setRoomMessage(result.summary, 'warn');
      } finally {
        firebaseCheckBtn.disabled = false;
        firebaseCheckBtn.textContent = '執行 Firebase 檢查';
      }
    });
  }
}

function scrollToPanel(selector, focusSelector = null) {
  const panel = document.querySelector(selector);
  if (!panel) return;
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const target = focusSelector ? document.querySelector(focusSelector) : null;
  if (target && typeof target.focus === 'function') {
    window.setTimeout(() => target.focus(), 260);
  }
}

function updateDuplicateTabWarning(room = latestRoom) {
  try {
    const payload = { tabId: SESSION_TAB_ID, roomId: room?.roomId || currentRoomId || null, at: Date.now() };
    const previous = JSON.parse(localStorage.getItem(ACTIVE_TAB_KEY) || 'null');
    localStorage.setItem(ACTIVE_TAB_KEY, JSON.stringify(payload));
    if (previous?.tabId && previous.tabId !== SESSION_TAB_ID && previous.roomId && previous.roomId === payload.roomId && payload.roomId) {
      setRoomMessage(`偵測到同一裝置可能開了多個 ${payload.roomId} 房間視窗；建議只保留一個視窗，避免重複操作。`, 'warn');
    }
  } catch {
    // localStorage 不可用時不影響遊戲。
  }
}

function bindHomeFlowEvents() {
  const bind = (id, handler) => {
    const button = el(id);
    if (button) button.addEventListener('click', handler);
  };
  bind('quickSingleBtn', () => {
    if (gameState.mode === 'multiplayer' && currentRoomId && !confirm('目前已在多人房間中，確定要切回單人練習嗎？')) return;
    resetGame({ playDealSound: true });
    gameState.message = '已進入單人練習模式。';
    renderGameAndFocus();
    scrollToPanel('.table-area');
  });
  bind('quickCreateRoomBtn', () => scrollToPanel('.room-panel', '#playerNameInput'));
  bind('quickJoinRoomBtn', () => scrollToPanel('.room-panel', '#roomCodeInput'));
  bind('quickRecentRoomBtn', () => scrollToPanel('.room-directory-panel'));
  bind('quickRulesBtn', () => scrollToPanel('.tutorial-panel'));
  bind('quickSettingsBtn', () => scrollToPanel('.settings-panel'));
}

function bindGameEvents() {
  const focusButton = el('focusModeToggleBtn');
  if (focusButton) {
    focusButton.addEventListener('click', () => {
      if (!isGameplayActiveForFocus()) return;
      focusPanelsExpanded = !focusPanelsExpanded;
      updateGameplayFocusMode();
    });
  }

  el('newGameBtn').addEventListener('click', () => resetGame({ playDealSound: true }));

  const handSortSelect = el('handSortSelect');
  if (handSortSelect) {
    handSortSelect.value = getHandSortMode();
    handSortSelect.addEventListener('change', (event) => {
      setHandSortMode(event.target.value);
      gameState.message = `已切換手牌排序：${event.target.options[event.target.selectedIndex]?.textContent || '依點數'}`;
      renderGameAndFocus();
    });
  }

  const recommendBtn = el('recommendPlayBtn');
  if (recommendBtn) recommendBtn.addEventListener('click', () => applyPlayAssist('smart'));

  const minimumBtn = el('minPlayableBtn');
  if (minimumBtn) minimumBtn.addEventListener('click', () => applyPlayAssist('minimum'));

  const clearSelectionBtn = el('clearSelectionBtn');
  if (clearSelectionBtn) {
    clearSelectionBtn.addEventListener('click', () => {
      clearSelection();
      gameState.message = '已清除選牌。';
      playSound('select');
      renderGameAndFocus();
    });
  }

  const passReminderToggle = el('passReminderToggle');
  if (passReminderToggle) {
    passReminderToggle.checked = isPassReminderEnabled();
    passReminderToggle.addEventListener('change', (event) => {
      setPassReminderEnabled(event.target.checked);
      gameState.message = event.target.checked ? 'Pass 前提醒已開啟。' : 'Pass 前提醒已關閉。';
      renderGameAndFocus();
    });
  }

  el('playBtn').addEventListener('click', async () => {
    const selected = getSelectedCards(gameState);
    if (!selected.length) {
      gameState.message = '請先選擇要出的牌。';
      renderGameAndFocus();
      return;
    }

    if (gameState.mode === 'multiplayer' && currentRoomId) {
      await runLockedMultiplayerAction('出牌同步中', async () => {
        try {
          const precondition = {
            expectedRevision: Number(gameState.security?.revision || 0),
            expectedTurnSeat: gameState.currentTurnSeat,
            expectedGameId: gameState.gameId || null
          };
          await playMultiplayerCards(currentRoomId, selected, precondition);
          playSound('play');
          clearSelection();
        } catch (error) {
          gameState.message = makeFriendlyError(error) || '多人出牌失敗。';
          playSound('error');
          renderGameAndFocus();
        }
      });
      return;
    }

    gameState = playCards(gameState, 0, selected);
    playSound(gameState.lastAction?.type === 'PLAY' ? 'play' : 'error');
    if (gameState.lastAction?.type === 'PLAY' && gameState.lastAction.seat === 0) {
      clearSelection();
    }
    renderGameAndFocus();
    renderLeaderboard();
    maybeRecordFinishedGame();
    scheduleAIIfNeeded();
  });

  el('passBtn').addEventListener('click', async () => {
    if (!confirmPassIfNeeded()) return;

    if (gameState.mode === 'multiplayer' && currentRoomId) {
      await runLockedMultiplayerAction('Pass 同步中', async () => {
        try {
          const precondition = {
            expectedRevision: Number(gameState.security?.revision || 0),
            expectedTurnSeat: gameState.currentTurnSeat,
            expectedGameId: gameState.gameId || null
          };
          await passMultiplayerTurn(currentRoomId, precondition);
          playSound('pass');
          clearSelection();
        } catch (error) {
          gameState.message = makeFriendlyError(error) || '多人 Pass 失敗。';
          playSound('error');
          renderGameAndFocus();
        }
      });
      return;
    }

    gameState = passTurn(gameState, 0);
    playSound(gameState.lastAction?.type === 'PASS' ? 'pass' : 'error');
    clearSelection();
    renderGameAndFocus();
    renderLeaderboard();
    maybeRecordFinishedGame();
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
      renderGameAndFocus();
      renderLeaderboard();
      scheduleAIIfNeeded();
    } else {
      setRoomMessage('AI 難度會在下一次「開始多人遊戲 / 重新發牌」時套用。', 'ok');
    }
  });

  const ruleSelect = el('rulePresetSelect');
  if (ruleSelect) {
    ruleSelect.value = getSavedRulePresetId();
    ruleSelect.addEventListener('change', (event) => {
      localStorage.setItem(RULE_PRESET_KEY, event.target.value);
      updateSettingsSummary();
      if (gameState.mode === 'multiplayer') {
        setRoomMessage('玩法規則會在下一次「開始多人遊戲 / 重新發牌」時套用。', 'ok');
      } else {
        resetGame();
        gameState.message = '已套用新玩法規則並重新開局。';
        renderGameAndFocus();
      }
    });
  }

  const scoringSelect = el('scoringPresetSelect');
  if (scoringSelect) {
    scoringSelect.value = getSavedScoringPresetId();
    scoringSelect.addEventListener('change', (event) => {
      localStorage.setItem(SCORING_PRESET_KEY, event.target.value);
      updateSettingsSummary();
      if (gameState.mode === 'multiplayer') {
        setRoomMessage('計分規則會在下一次「開始多人遊戲 / 重新發牌」時套用。', 'ok');
      } else {
        gameState.scoringRules = getSavedScoringRules();
        gameState.message = '已套用新計分規則，本局結束時計算。';
        renderGameAndFocus();
      }
    });
  }

  const soundButton = el('soundToggleBtn');
  if (soundButton) {
    updateSoundButton();
    soundButton.addEventListener('click', () => {
      const enabled = setSoundEnabled(!isSoundEnabled());
      updateSoundButton();
      renderExperienceSettings();
      if (enabled) playSound('select');
    });
  }

  const volumeInput = el('soundVolumeInput');
  if (volumeInput) {
    volumeInput.addEventListener('input', (event) => {
      setSoundPreference('masterVolume', Number(event.target.value) / 100);
      renderExperienceSettings();
    });
  }

  document.querySelectorAll('.sound-option').forEach((input) => {
    input.addEventListener('change', () => {
      setSoundPreference(input.dataset.soundType, input.checked);
      renderExperienceSettings();
      if (input.checked) playSound(input.dataset.soundType || 'select');
    });
  });

  const animationToggle = el('animationToggle');
  if (animationToggle) {
    animationToggle.addEventListener('change', () => {
      setAnimationEnabled(animationToggle.checked);
      renderExperienceSettings();
    });
  }

  const refreshRoomsBtn = el('refreshRoomsBtn');
  if (refreshRoomsBtn) refreshRoomsBtn.addEventListener('click', refreshPublicRooms);

  const cleanupRoomsBtn = el('cleanupRoomsBtn');
  if (cleanupRoomsBtn) {
    cleanupRoomsBtn.addEventListener('click', async () => {
      await runButtonLocked('cleanupRoomsBtn', '清理中...', async () => {
        try {
          const result = await cleanupExpiredOwnedRooms();
          setRoomMessage(`已檢查 ${result.checked} 個自己建立的房間，清理 ${result.deleted} 個過期房間；略過進行中 ${result.skippedPlaying}、目前房間 ${result.skippedActive}、近期房間 ${result.skippedRecent}。`, 'ok');
          await refreshPublicRooms();
        } catch (error) {
          setRoomMessage(makeFriendlyError(error) || '清理過期房間失敗。', 'warn');
        }
      });
    });
  }

  const clearRecentBtn = el('clearRecentRoomsBtn');
  if (clearRecentBtn) {
    clearRecentBtn.addEventListener('click', () => {
      clearRecentRooms();
      renderRoomDirectory();
      setRoomMessage('已清除本機最近房號。', 'ok');
    });
  }

  const clearRecordsBtn = el('clearGameRecordsBtn');
  if (clearRecordsBtn) {
    clearRecordsBtn.addEventListener('click', () => {
      if (!confirm('確定要清除本機遊戲紀錄與每日戰績嗎？')) return;
      clearGameRecords();
      renderProgressAndRecords();
      setRoomMessage('已清除本機遊戲紀錄與每日戰績。', 'ok');
    });
  }
}


applyAnimationPreference();
bindViewportAndNetworkEvents();
bindHomeFlowEvents();
bindGameEvents();
bindRoomEvents();
bindAcceptanceAndErrorCenter();
updateSettingsSummary();
renderDebugPanel(null);
renderGameAndFocus();
updateAllExperienceViews();
scheduleAIIfNeeded();
