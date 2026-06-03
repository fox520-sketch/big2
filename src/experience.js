const ANIMATION_KEY = 'big2-animation-enabled';
const RECENT_ROOMS_KEY = 'big2-recent-rooms';
const DAILY_STATS_KEY = 'big2-daily-stats';
const GAME_RECORDS_KEY = 'big2-game-records';
const ACHIEVEMENTS_KEY = 'big2-achievements';
const MAX_RECENT_ROOMS = 8;
const MAX_GAME_RECORDS = 40;
const RECENT_ROOM_TTL_MS = 1000 * 60 * 60 * 24 * 14;

export function isAnimationEnabled() {
  return localStorage.getItem(ANIMATION_KEY) !== '0';
}

export function setAnimationEnabled(enabled) {
  localStorage.setItem(ANIMATION_KEY, enabled ? '1' : '0');
  applyAnimationPreference();
  return isAnimationEnabled();
}

export function applyAnimationPreference() {
  document.body.dataset.motion = isAnimationEnabled() ? 'on' : 'off';
}

function safeRead(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  return value;
}

export function getRecentRooms() {
  try {
    const rows = JSON.parse(localStorage.getItem(RECENT_ROOMS_KEY) || '[]');
    const now = Date.now();
    return Array.isArray(rows)
      ? rows
        .filter((row) => row?.roomId && (!row.updatedAtMs || now - Number(row.updatedAtMs) < RECENT_ROOM_TTL_MS))
        .slice(0, MAX_RECENT_ROOMS)
      : [];
  } catch {
    return [];
  }
}

export function rememberRecentRoom(room) {
  const roomId = String(room?.roomId || '').trim().toUpperCase();
  if (!roomId) return getRecentRooms();
  const row = {
    roomId,
    status: room.status || 'waiting',
    hostName: room.hostName || room.host || '',
    lastEvent: room.lastEvent || '',
    gameNo: Number(room.gameNo || 0),
    humanCount: Number.isFinite(room.humanCount) ? room.humanCount : undefined,
    aiCount: Number.isFinite(room.aiCount) ? room.aiCount : undefined,
    seatCount: Number.isFinite(room.seatCount) ? room.seatCount : undefined,
    passwordEnabled: Boolean(room.passwordEnabled),
    updatedAtMs: Date.now(),
    inviteUrl: room.inviteUrl || room.invitePath || ''
  };
  const merged = [row, ...getRecentRooms().filter((item) => item.roomId !== roomId)].slice(0, MAX_RECENT_ROOMS);
  localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(merged));
  return merged;
}

export function clearRecentRooms() {
  localStorage.removeItem(RECENT_ROOMS_KEY);
  return [];
}

export function roomStatusLabel(status) {
  if (status === 'playing') return '進行中';
  if (status === 'finished') return '已結束';
  if (status === 'waiting') return '等待中';
  return status || '未知';
}

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDailyStats() {
  const all = safeRead(DAILY_STATS_KEY, {});
  const key = todayKey();
  return {
    key,
    all,
    today: all[key] || { date: key, games: 0, wins: 0, score: 0, bestScore: 0, multiplayerGames: 0 }
  };
}

export function getGameRecords() {
  const records = safeRead(GAME_RECORDS_KEY, []);
  return Array.isArray(records) ? records.slice(0, MAX_GAME_RECORDS) : [];
}

export function clearGameRecords() {
  safeWrite(GAME_RECORDS_KEY, []);
  safeWrite(DAILY_STATS_KEY, {});
  return [];
}

export function getAchievements() {
  const unlocked = safeRead(ACHIEVEMENTS_KEY, {});
  const records = getGameRecords();
  const daily = getDailyStats().today;
  const totalGames = records.length;
  const wins = records.filter((record) => record.localRank === 1).length;
  const multiplayerGames = records.filter((record) => record.mode === 'multiplayer').length;
  const bestScore = records.reduce((max, record) => Math.max(max, Number(record.localScore || 0)), 0);
  const achievements = [
    { id: 'first_game', title: '初試啼聲', text: '完成第一局遊戲', unlocked: totalGames >= 1 },
    { id: 'first_win', title: '首勝到手', text: '取得第一場勝利', unlocked: wins >= 1 },
    { id: 'daily_three', title: '今日手感熱', text: '今天完成 3 局', unlocked: Number(daily.games || 0) >= 3 },
    { id: 'multiplayer_one', title: '好友開戰', text: '完成 1 局多人房間遊戲', unlocked: multiplayerGames >= 1 },
    { id: 'ten_games', title: '牌桌熟客', text: '累計完成 10 局', unlocked: totalGames >= 10 },
    { id: 'score_30', title: '大贏一把', text: '單局取得 30 分以上', unlocked: bestScore >= 30 },
    { id: 'five_wins', title: '常勝將軍', text: '累計取得 5 勝', unlocked: wins >= 5 }
  ];

  let changed = false;
  for (const item of achievements) {
    if (item.unlocked && !unlocked[item.id]) {
      unlocked[item.id] = { unlockedAt: Date.now(), title: item.title };
      changed = true;
    }
  }
  if (changed) safeWrite(ACHIEVEMENTS_KEY, unlocked);

  return achievements.map((item) => ({ ...item, unlockedAt: unlocked[item.id]?.unlockedAt || null }));
}

export function recordFinishedGame(gameState, room = null) {
  if (!gameState?.finished || !Array.isArray(gameState.results)) return { added: false };
  const localSeat = Number.isInteger(gameState.localSeat) ? gameState.localSeat : 0;
  const localRow = gameState.results.find((row) => row.seat === localSeat) || gameState.results[0];
  const id = gameState.gameId || `${room?.roomId || 'local'}-${gameState.gameNo || 0}-${gameState.finishedAt || Date.now()}`;
  const records = getGameRecords();
  if (records.some((record) => record.id === id)) return { added: false };

  const record = {
    id,
    roomId: room?.roomId || '',
    mode: gameState.mode || 'single',
    gameNo: Number(gameState.gameNo || room?.gameNo || 0),
    playedAt: Date.now(),
    winnerName: gameState.players?.[gameState.winnerSeat]?.name || localRow?.name || '玩家',
    localName: gameState.players?.[localSeat]?.name || localRow?.name || '玩家',
    localRank: Number(localRow?.rank || 0),
    localScore: Number(localRow?.score || 0),
    localRemaining: Number(localRow?.remaining || 0),
    resultSummary: gameState.results.map((row) => `${row.name}第${row.rank}名${row.score > 0 ? '+' : ''}${row.score}`).join('、')
  };
  const nextRecords = [record, ...records].slice(0, MAX_GAME_RECORDS);
  safeWrite(GAME_RECORDS_KEY, nextRecords);

  const daily = getDailyStats();
  const today = { ...daily.today };
  today.games = Number(today.games || 0) + 1;
  today.wins = Number(today.wins || 0) + (record.localRank === 1 ? 1 : 0);
  today.score = Number(today.score || 0) + record.localScore;
  today.bestScore = Math.max(Number(today.bestScore || 0), record.localScore);
  today.multiplayerGames = Number(today.multiplayerGames || 0) + (record.mode === 'multiplayer' ? 1 : 0);
  safeWrite(DAILY_STATS_KEY, { ...daily.all, [daily.key]: today });
  getAchievements();
  return { added: true, record };
}
