const ANIMATION_KEY = 'big2-animation-enabled';
const RECENT_ROOMS_KEY = 'big2-recent-rooms';
const MAX_RECENT_ROOMS = 8;
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
