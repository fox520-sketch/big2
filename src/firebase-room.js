import { VERSION } from './constants.js';
import { firebaseConfig, hasFirebaseConfig } from './firebase-config.js';
import { createGameFromSeats, passTurn, playCards, runAITurn } from './game-state.js';
import { mergeSeriesTotals } from './scoring.js';
import { canPass, validateHumanPlay } from './rules.js';
import { normalizeRules, normalizeScoringRules, ruleSummary, scoringSummary } from './game-settings.js';

const ROOM_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_ID_LENGTH = 6;
const FIREBASE_VERSION = '10.14.1';
const ROOM_COLLECTION = 'rooms';
const HEARTBEAT_INTERVAL_MS = 25000;
const RECONCILE_INTERVAL_MS = 30000;
const STALE_PLAYER_MS = 90000;
const STALE_ROOM_MS = 24 * 60 * 60 * 1000;

let sdkPromise = null;
let appInstance = null;
let authInstance = null;
let dbInstance = null;
let currentUser = null;
let unsubscribeRoom = null;
let activeRoomId = null;
let activeSeat = null;
let heartbeatTimer = null;
let reconcileTimer = null;
let lastHeartbeatAt = 0;
let lastReconcileAt = 0;
let listeningRoomId = null;
let latestRoomData = null;
let latestRoomSignature = '';
let latestRoomCallback = null;
let latestRoomErrorCallback = null;

function nowMs() {
  return Date.now();
}


function canUseNetwork() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function canRunBackgroundSync() {
  if (!canUseNetwork()) return false;
  if (typeof document === 'undefined') return true;
  return document.visibilityState !== 'hidden';
}

function roomRenderSignature(room) {
  if (!room) return '';
  const seats = normalizeSeats(room.seats).map((seat) => seat ? {
    seat: seat.seat,
    name: seat.name,
    uid: seat.uid,
    isAI: Boolean(seat.isAI),
    host: Boolean(seat.host),
    connected: seat.connected !== false,
    aiTakingOver: Boolean(seat.aiTakingOver)
  } : null);
  return JSON.stringify({
    roomId: room.roomId,
    status: room.status,
    hostUid: room.hostUid,
    hostName: room.hostName,
    aiLevel: room.aiLevel,
    rules: room.rules,
    scoringRules: room.scoringRules,
    gameNo: room.gameNo,
    lastEvent: room.lastEvent,
    passwordEnabled: Boolean(room.passwordEnabled),
    seats,
    totalScores: room.totalScores || null,
    game: room.game || null
  });
}

function getLocalPlayerName() {
  const saved = localStorage.getItem('big2-player-name');
  return saved?.trim() || `玩家${Math.floor(Math.random() * 900 + 100)}`;
}

export function saveLocalPlayerName(name) {
  const normalized = String(name || '').trim().slice(0, 18) || getLocalPlayerName();
  localStorage.setItem('big2-player-name', normalized);
  return normalized;
}

export function getFirebaseSetupState() {
  return hasFirebaseConfig()
    ? { ok: true, text: 'Firebase 設定已填入，可以建立/加入房間。' }
    : { ok: false, text: '尚未填入 Firebase 設定，請先編輯 src/firebase-config.js。' };
}


export function explainFirebaseError(error) {
  const code = error?.code || '';
  const message = error?.message || String(error || '未知錯誤');
  if (code.includes('permission-denied') || message.includes('Missing or insufficient permissions')) {
    return 'Firestore 寫入被拒絕。通常是 Firebase Console 的 Rules 沒有套用本版 firestore.rules；請貼上 v0.8.0 的 firestore.rules 後 Publish。';
  }
  if (code.includes('unauthenticated') || message.includes('auth')) {
    return '匿名登入失敗。請到 Firebase Console → Authentication → Sign-in method 啟用 Anonymous。';
  }
  if (message.includes('PASTE_') || message.includes('尚未填入 Firebase')) {
    return 'Firebase Config 尚未填入。請編輯 src/firebase-config.js。';
  }
  if (message.includes('Failed to fetch') || message.includes('network')) {
    return '連線 Firebase 失敗，請檢查網路、Firebase 專案 ID 與瀏覽器是否封鎖第三方服務。';
  }
  return message;
}

export async function runFirebaseDiagnostics() {
  const checks = [];
  checks.push({ label: 'Cloud Functions', ok: true, text: '未使用。v0.8.0 是免 Cloud Functions 正式發布候選版，不需要 Blaze。' });

  if (!hasFirebaseConfig()) {
    checks.push({ label: 'Firebase Config', ok: false, text: '尚未填入 src/firebase-config.js。' });
    checks.push({ label: '匿名登入', ok: false, text: '未檢查。' });
    checks.push({ label: 'Firestore 寫入', ok: false, text: '未檢查。' });
    return { ok: false, checks, summary: 'Firebase 設定未完成，請先填入 firebaseConfig。' };
  }

  checks.push({ label: 'Firebase Config', ok: true, text: `已設定 projectId：${firebaseConfig.projectId}` });

  try {
    const { sdk, db, user } = await ensureFirebaseReady();
    checks.push({ label: '匿名登入', ok: true, text: `成功，UID：${user.uid.slice(0, 8)}...` });

    const testRoomId = `T${makeRoomId().slice(1)}`;
    const ref = sdk.firestore.doc(db, ROOM_COLLECTION, testRoomId);
    const name = getLocalPlayerName();
    const hostSeat = seatPayload({ seat: 0, name, uid: user.uid, host: true });
    const testData = {
      roomId: testRoomId,
      status: 'waiting',
      hostUid: user.uid,
      hostName: name,
      aiLevel: 8,
      rules: normalizeRules(),
      scoringRules: normalizeScoringRules(),
      securityVersion: 'client-validated-v0.8.0',
      version: VERSION,
      passwordEnabled: false,
      passwordHash: '',
      passwordHint: '',
      createdAt: sdk.firestore.serverTimestamp(),
      updatedAt: sdk.firestore.serverTimestamp(),
      presenceUpdatedAt: sdk.firestore.serverTimestamp(),
      invitePath: buildInviteUrl(testRoomId),
      gameNo: 0,
      lastEvent: 'v0.8.0 Firebase 設定檢查用暫存房間。',
      totalScores: makeInitialTotalsFromSeats([hostSeat, null, null, null]),
      seats: { 0: hostSeat }
    };

    await sdk.firestore.setDoc(ref, testData);
    const snap = await sdk.firestore.getDoc(ref);
    if (!snap.exists()) throw new Error('測試房間建立後讀取失敗。');
    await sdk.firestore.deleteDoc(ref);
    checks.push({ label: 'Firestore 寫入', ok: true, text: '建立 / 讀取 / 刪除暫存房間成功。Rules 可用於 v0.8.0。' });
    return { ok: true, checks, summary: 'Firebase 設定檢查通過，可以建立房間。' };
  } catch (error) {
    checks.push({ label: 'Firestore 寫入', ok: false, text: explainFirebaseError(error) });
    return { ok: false, checks, summary: 'Firebase 設定檢查未通過，請依提示修正。' };
  }
}

async function loadFirebaseSdk() {
  if (!sdkPromise) {
    sdkPromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
    ]).then(([app, auth, firestore]) => ({ app, auth, firestore }));
  }
  return sdkPromise;
}

export async function ensureFirebaseReady() {
  if (!hasFirebaseConfig()) {
    throw new Error('尚未填入 Firebase 設定，請先編輯 src/firebase-config.js。');
  }

  const sdk = await loadFirebaseSdk();

  if (!appInstance) {
    appInstance = sdk.app.getApps().length
      ? sdk.app.getApp()
      : sdk.app.initializeApp(firebaseConfig);
    authInstance = sdk.auth.getAuth(appInstance);
    dbInstance = sdk.firestore.getFirestore(appInstance);
  }

  if (!authInstance.currentUser) {
    await sdk.auth.signInAnonymously(authInstance);
  }

  currentUser = authInstance.currentUser;
  return { sdk, app: appInstance, auth: authInstance, db: dbInstance, user: currentUser };
}

export function makeRoomId() {
  let id = '';
  for (let index = 0; index < ROOM_ID_LENGTH; index += 1) {
    id += ROOM_ID_CHARS[Math.floor(Math.random() * ROOM_ID_CHARS.length)];
  }
  return id;
}

export function normalizeRoomId(roomId) {
  return String(roomId || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, ROOM_ID_LENGTH);
}


function simplePasswordHash(password = '') {
  const text = String(password || '').trim();
  if (!text) return '';
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `pw-${(hash >>> 0).toString(36)}`;
}

function assertRoomPassword(room, password = '') {
  if (!room.passwordEnabled) return;
  const provided = simplePasswordHash(password);
  if (!provided || provided !== room.passwordHash) {
    throw new Error('房間密碼不正確。');
  }
}

export function getRoomIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const hashText = window.location.hash.replace(/^#/, '');
  const hashParams = new URLSearchParams(hashText);
  return normalizeRoomId(params.get('room') || params.get('code') || hashParams.get('room') || hashParams.get('code'));
}

export function shouldAutoJoinFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const hashText = window.location.hash.replace(/^#/, '');
  const hashParams = new URLSearchParams(hashText);
  return params.get('join') === '1' || hashParams.get('join') === '1';
}

export function buildInviteUrl(roomId) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('room', normalizeRoomId(roomId));
  url.searchParams.set('join', '1');
  return url.toString();
}

function seatPayload({ seat, name, isAI, uid, host, connected = true, aiTakingOver = false }) {
  return {
    seat,
    name,
    isAI: Boolean(isAI),
    uid: uid || `ai-seat-${seat}`,
    host: Boolean(host),
    connected: Boolean(!isAI && connected),
    aiTakingOver: Boolean(aiTakingOver),
    lastSeen: isAI ? null : nowMs(),
    joinedAt: nowMs()
  };
}

function normalizeSeats(seats = {}) {
  const list = [];
  for (let seat = 0; seat < 4; seat += 1) {
    const data = seats[String(seat)] || seats[seat] || null;
    list.push(data ? { ...data, seat } : null);
  }
  return list;
}

function seatsToObject(seatList) {
  const seats = {};
  for (let seat = 0; seat < 4; seat += 1) {
    if (seatList[seat]) seats[seat] = seatList[seat];
  }
  return seats;
}

function ensureFilledSeatList(room) {
  const seats = normalizeSeats(room.seats);
  for (let seat = 0; seat < 4; seat += 1) {
    if (!seats[seat]) {
      seats[seat] = seatPayload({ seat, name: `AI ${seat + 1}`, isAI: true, connected: false });
    }
  }
  return seats;
}


function prepareSeatListForGame(room) {
  return ensureFilledSeatList(room).map((seat, index) => {
    if (!seat) return seatPayload({ seat: index, name: `AI ${index + 1}`, isAI: true, connected: false });
    if (seat.isAI) {
      return { ...seat, isAI: true, connected: false, aiTakingOver: false };
    }
    if (seat.connected === false || isSeatStale(seat)) {
      return {
        ...seat,
        name: seat.name || `玩家 ${index + 1}`,
        isAI: true,
        connected: false,
        aiTakingOver: true,
        disconnectedAt: seat.disconnectedAt || nowMs()
      };
    }
    return { ...seat, isAI: false, connected: true, aiTakingOver: false, lastSeen: nowMs() };
  });
}

function findSeatForUid(room, uid) {
  const seats = normalizeSeats(room.seats);
  const index = seats.findIndex((seat) => seat?.uid === uid);
  return index >= 0 ? index : null;
}

function findEmptySeat(room) {
  const seats = normalizeSeats(room.seats);
  const index = seats.findIndex((seat) => !seat);
  return index >= 0 ? index : null;
}

function findReplaceableAISeat(room) {
  if (room.status !== 'waiting' && room.status !== 'finished') return null;
  const seats = normalizeSeats(room.seats);
  const index = seats.findIndex((seat) => seat?.isAI);
  return index >= 0 ? index : null;
}

function isSeatStale(seat, now = nowMs()) {
  if (!seat || seat.isAI) return false;
  const lastSeen = Number(seat.lastSeen || 0);
  return lastSeen > 0 && now - lastSeen > STALE_PLAYER_MS;
}

function findHostSeat(seats, hostUid) {
  const index = seats.findIndex((seat) => seat?.uid === hostUid);
  return index >= 0 ? index : null;
}

function findNextConnectedHumanSeat(seats, preferredAfter = -1) {
  for (let offset = 1; offset <= 4; offset += 1) {
    const index = (preferredAfter + offset + 4) % 4;
    const seat = seats[index];
    if (seat && !seat.isAI && seat.connected) return index;
  }
  return null;
}

function markGameSeatAsAITakeover(game, seat, seatData) {
  if (!game?.players?.[seat]) return game;
  game.players[seat] = {
    ...game.players[seat],
    name: seatData?.name || game.players[seat].name,
    uid: seatData?.uid || game.players[seat].uid || null,
    connected: false,
    isAI: true,
    isHuman: false,
    aiTakingOver: true
  };
  game.history = [`${game.players[seat].name} 已離線，由 AI 暫時接管座位 ${seat + 1}。`, ...(game.history || [])].slice(0, 80);
  if (game.currentTurnSeat === seat) {
    game.message = `${game.players[seat].name} 已離線，目前由 AI 接管出牌。`;
  }
  return game;
}

function restoreGameSeatFromReconnect(game, seat, payload) {
  if (!game?.players?.[seat] || payload.isAI) return game;
  game.players[seat] = {
    ...game.players[seat],
    name: payload.name,
    uid: payload.uid,
    connected: true,
    isAI: false,
    isHuman: true,
    aiTakingOver: false
  };
  game.history = [`${payload.name} 已重新連線，取回座位 ${seat + 1}。`, ...(game.history || [])].slice(0, 80);
  return game;
}

async function getRoomDocument(roomId) {
  const { sdk, db } = await ensureFirebaseReady();
  const ref = sdk.firestore.doc(db, ROOM_COLLECTION, normalizeRoomId(roomId));
  const snap = await sdk.firestore.getDoc(ref);
  return { sdk, db, ref, snap };
}

function cloneGame(game) {
  return JSON.parse(JSON.stringify(game));
}

function makePlainGame(game) {
  const cloned = cloneGame(game);
  delete cloned.localSeat;
  return cloned;
}

function roomStatusForGame(game) {
  return game.finished ? 'finished' : 'playing';
}

function makeInitialTotalsFromSeats(seatList) {
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

function applyFinishedGameTotals(room, updatedGame) {
  const gameNo = Number(room.gameNo || 0);
  return mergeSeriesTotals(room.totalScores || {}, updatedGame.results || [], updatedGame.players || [], gameNo);
}


export async function listRecentRoomsFromFirestore(maxRooms = 12) {
  const { sdk, db } = await ensureFirebaseReady();
  const roomsRef = sdk.firestore.collection(db, ROOM_COLLECTION);
  const q = sdk.firestore.query(
    roomsRef,
    sdk.firestore.orderBy('updatedAt', 'desc'),
    sdk.firestore.limit(Math.min(20, Math.max(1, Number(maxRooms) || 12)))
  );
  const snap = await sdk.firestore.getDocs(q);
  return snap.docs.map((docSnap) => {
    const data = docSnap.data();
    const seats = normalizeSeats(data.seats);
    const humanCount = seats.filter((seat) => seat && !seat.isAI).length;
    const aiCount = seats.filter((seat) => seat?.isAI).length;
    let updatedAtMs = 0;
    try {
      updatedAtMs = typeof data.updatedAt?.toMillis === 'function' ? data.updatedAt.toMillis() : 0;
    } catch {
      updatedAtMs = 0;
    }
    return {
      roomId: data.roomId || docSnap.id,
      status: data.status || 'waiting',
      hostName: data.hostName || '',
      gameNo: Number(data.gameNo || 0),
      humanCount,
      aiCount,
      seatCount: seats.filter(Boolean).length,
      lastEvent: data.lastEvent || '',
      passwordEnabled: Boolean(data.passwordEnabled),
      updatedAtMs,
      inviteUrl: buildInviteUrl(data.roomId || docSnap.id)
    };
  });
}

export async function createRoom({ playerName, aiLevel, rules, scoringRules, roomPassword = '' }) {
  const { sdk, db, user } = await ensureFirebaseReady();
  const name = saveLocalPlayerName(playerName);
  const normalizedRules = normalizeRules(rules);
  const normalizedScoringRules = normalizeScoringRules(scoringRules);
  const passwordHash = simplePasswordHash(roomPassword);
  let roomId = '';
  let inviteUrl = '';

  for (let attempt = 0; attempt < 8; attempt += 1) {
    roomId = makeRoomId();
    inviteUrl = buildInviteUrl(roomId);
    const roomRef = sdk.firestore.doc(db, ROOM_COLLECTION, roomId);
    const hostSeat = seatPayload({ seat: 0, name, uid: user.uid, host: true });
    const roomData = {
      roomId,
      status: 'waiting',
      hostUid: user.uid,
      hostName: name,
      aiLevel: Number(aiLevel) || 8,
      rules: normalizedRules,
      scoringRules: normalizedScoringRules,
      securityVersion: 'client-validated-v0.8.0',
      version: VERSION,
      passwordEnabled: Boolean(passwordHash),
      passwordHash,
      passwordHint: passwordHash ? '已設定房間密碼' : '',
      createdAt: sdk.firestore.serverTimestamp(),
      updatedAt: sdk.firestore.serverTimestamp(),
      presenceUpdatedAt: sdk.firestore.serverTimestamp(),
      invitePath: inviteUrl,
      gameNo: 0,
      lastEvent: `${name} 建立房間。${ruleSummary(normalizedRules)}；${scoringSummary(normalizedScoringRules)}`,
      totalScores: makeInitialTotalsFromSeats([hostSeat, null, null, null]),
      seats: {
        0: hostSeat
      }
    };

    let created = false;
    await sdk.firestore.runTransaction(db, async (transaction) => {
      const snap = await transaction.get(roomRef);
      if (snap.exists()) return;
      transaction.set(roomRef, roomData);
      created = true;
    });

    if (created) {
      activeRoomId = roomId;
      activeSeat = 0;
      startPresenceTimers(roomId);
      return { roomId, inviteUrl, seat: 0 };
    }
  }

  throw new Error('房號產生重複，請再按一次建立房間。');
}

export async function joinRoom(roomId, { playerName, roomPassword = '' } = {}) {
  const normalizedRoomId = normalizeRoomId(roomId);
  if (!normalizedRoomId || normalizedRoomId.length !== ROOM_ID_LENGTH) {
    throw new Error('請輸入 6 碼房號。');
  }

  const { sdk, db, user } = await ensureFirebaseReady();
  const ref = sdk.firestore.doc(db, ROOM_COLLECTION, normalizedRoomId);
  let joinedSeat = null;

  await sdk.firestore.runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) {
      throw new Error(`找不到房間 ${normalizedRoomId}，請確認房號是否正確。`);
    }

    const room = snap.data();
    assertRoomPassword(room, roomPassword);
    const existingSeat = findSeatForUid(room, user.uid);
    const emptySeat = findEmptySeat(room);
    const replaceAISeat = emptySeat === null ? findReplaceableAISeat(room) : null;
    const seat = existingSeat ?? emptySeat ?? replaceAISeat;
    if (seat === null) {
      throw new Error('這個房間已滿或牌局已開始，無法加入。');
    }

    const name = saveLocalPlayerName(playerName);
    const seats = normalizeSeats(room.seats);
    const wasHost = room.hostUid === user.uid || (!room.hostUid && seat === 0);
    const payload = seatPayload({ seat, name, uid: user.uid, host: wasHost, connected: true, aiTakingOver: false });
    seats[seat] = payload;

    let game = room.game ? cloneGame(room.game) : null;
    if (game && existingSeat !== null) {
      game = restoreGameSeatFromReconnect(game, seat, payload);
    }

    const totalScores = { ...(room.totalScores || makeInitialTotalsFromSeats(seats)) };
    totalScores[seat] = {
      ...(totalScores[seat] || {}),
      seat,
      name,
      uid: user.uid,
      isAI: false,
      totalScore: Number(totalScores[seat]?.totalScore || 0),
      wins: Number(totalScores[seat]?.wins || 0),
      games: Number(totalScores[seat]?.games || 0),
      latestRank: totalScores[seat]?.latestRank ?? null,
      latestScore: Number(totalScores[seat]?.latestScore || 0),
      latestRemaining: totalScores[seat]?.latestRemaining ?? null,
      updatedGameNo: Number(totalScores[seat]?.updatedGameNo || 0)
    };

    const updates = {
      seats: seatsToObject(seats),
      totalScores,
      updatedAt: sdk.firestore.serverTimestamp(),
      presenceUpdatedAt: sdk.firestore.serverTimestamp(),
      lastEvent: existingSeat === null ? `${name} 加入房間。` : `${name} 回到房間。`
    };
    if (game) updates.game = makePlainGame(game);

    transaction.update(ref, updates);
    joinedSeat = seat;
  });

  activeRoomId = normalizedRoomId;
  activeSeat = joinedSeat;
  startPresenceTimers(normalizedRoomId);
  return { roomId: normalizedRoomId, inviteUrl: buildInviteUrl(normalizedRoomId), seat: joinedSeat };
}

export async function fillAISeats(roomId) {
  const normalizedRoomId = normalizeRoomId(roomId || activeRoomId);
  const { sdk, ref, snap } = await getRoomDocument(normalizedRoomId);
  if (!snap.exists()) throw new Error('找不到房間，無法補 AI。');

  const room = snap.data();
  const { user } = await ensureFirebaseReady();
  if (room.hostUid !== user.uid) {
    throw new Error('只有房主可以補 AI 空位。');
  }

  const updates = {
    updatedAt: sdk.firestore.serverTimestamp(),
    lastEvent: '房主已用 AI 補滿空位。'
  };
  const seats = normalizeSeats(room.seats);
  const totalScores = { ...(room.totalScores || makeInitialTotalsFromSeats(seats)) };
  for (let seat = 0; seat < 4; seat += 1) {
    if (!seats[seat]) {
      const aiSeat = seatPayload({ seat, name: `AI ${seat + 1}`, isAI: true, connected: false });
      updates[`seats.${seat}`] = aiSeat;
      totalScores[seat] = totalScores[seat] || {
        seat,
        name: aiSeat.name,
        uid: aiSeat.uid,
        isAI: true,
        totalScore: 0,
        wins: 0,
        games: 0,
        latestRank: null,
        latestScore: 0,
        latestRemaining: null,
        updatedGameNo: 0
      };
    }
  }
  updates.totalScores = totalScores;
  await sdk.firestore.updateDoc(ref, updates);
}

export async function startMultiplayerGame(roomId, { aiLevel, rules, scoringRules, expectedGameNo = null } = {}) {
  const normalizedRoomId = normalizeRoomId(roomId || activeRoomId);
  const { sdk, db, user } = await ensureFirebaseReady();
  const ref = sdk.firestore.doc(db, ROOM_COLLECTION, normalizedRoomId);

  await sdk.firestore.runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error('找不到房間，無法開始多人遊戲。');
    const room = snap.data();
    if (room.hostUid !== user.uid) throw new Error('只有房主可以開始多人遊戲 / 下一局。');
    if (room.status === 'playing' && !room.game?.finished) throw new Error('目前牌局仍在進行，不能重複洗牌或開始下一局。');
    if (Number.isFinite(Number(expectedGameNo)) && Number(room.gameNo || 0) !== Number(expectedGameNo)) {
      throw new Error('房間局數已更新，請重新確認後再開始下一局。');
    }

    const filledSeats = prepareSeatListForGame(room);
    const nextGameNo = Number(room.gameNo || 0) + 1;
    const normalizedRules = normalizeRules(rules || room.rules);
    const normalizedScoringRules = normalizeScoringRules(scoringRules || room.scoringRules);
    const game = createGameFromSeats(filledSeats, {
      aiLevel: Number(aiLevel || room.aiLevel || 8),
      rules: normalizedRules,
      scoringRules: normalizedScoringRules,
      hostUid: room.hostUid,
      gameId: `${normalizedRoomId}-${nextGameNo}-${Date.now()}`
    });
    game.version = VERSION;
    game.security = { ...(game.security || {}), revision: 0, lastActionId: null, version: 'client-validated-v0.8.0' };
    game.history.unshift(`多人第 ${nextGameNo} 局開始，房主已同步洗牌與發牌。${ruleSummary(normalizedRules)}；${scoringSummary(normalizedScoringRules)}`);

    const totalScores = { ...makeInitialTotalsFromSeats(filledSeats), ...(room.totalScores || {}) };
    for (const seat of filledSeats) {
      if (!seat) continue;
      totalScores[seat.seat] = {
        ...(totalScores[seat.seat] || {}),
        seat: seat.seat,
        name: seat.name,
        uid: seat.uid || null,
        isAI: Boolean(seat.isAI),
        totalScore: Number(totalScores[seat.seat]?.totalScore || 0),
        wins: Number(totalScores[seat.seat]?.wins || 0),
        games: Number(totalScores[seat.seat]?.games || 0),
        latestRank: totalScores[seat.seat]?.latestRank ?? null,
        latestScore: Number(totalScores[seat.seat]?.latestScore || 0),
        latestRemaining: totalScores[seat.seat]?.latestRemaining ?? null,
        updatedGameNo: Number(totalScores[seat.seat]?.updatedGameNo || 0)
      };
    }

    transaction.update(ref, {
      status: 'playing',
      seats: seatsToObject(filledSeats),
      game: makePlainGame(game),
      gameNo: nextGameNo,
      totalScores,
      aiLevel: Number(aiLevel || room.aiLevel || 8),
      rules: normalizedRules,
      scoringRules: normalizedScoringRules,
      securityVersion: 'client-validated-v0.8.0',
      updatedAt: sdk.firestore.serverTimestamp(),
      lastEvent: `多人第 ${nextGameNo} 局開始：${game.message}`
    });
  });
}

function assertGameTurnIntegrity(game) {
  if (!Array.isArray(game.players) || game.players.length !== 4) {
    throw new Error('牌局玩家狀態異常，請請房主重新開局。');
  }
  if (!Number.isInteger(game.currentTurnSeat) || game.currentTurnSeat < 0 || game.currentTurnSeat > 3) {
    throw new Error('回合座位狀態異常，請請房主重新開局。');
  }
  if (!game.players[game.currentTurnSeat]) {
    throw new Error('目前回合玩家不存在，請請房主重新開局。');
  }
}

function validateActionPreconditions(game, options = {}) {
  if (options.expectedGameId && game.gameId && options.expectedGameId !== game.gameId) {
    throw new Error('牌局已換新局，請依最新手牌重新操作。');
  }
  if (Number.isFinite(Number(options.expectedRevision))) {
    const currentRevision = Number(game.security?.revision || 0);
    if (currentRevision !== Number(options.expectedRevision)) {
      throw new Error('牌局已更新，請確認最新回合後再出牌。');
    }
  }
  if (Number.isInteger(options.expectedTurnSeat) && game.currentTurnSeat !== options.expectedTurnSeat) {
    throw new Error('回合已更新，現在輪到其他玩家。');
  }
}

async function updateMultiplayerGame(roomId, action, options = {}) {
  const normalizedRoomId = normalizeRoomId(roomId || activeRoomId);
  const { sdk, db, user } = await ensureFirebaseReady();
  const ref = sdk.firestore.doc(db, ROOM_COLLECTION, normalizedRoomId);

  await sdk.firestore.runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error('找不到房間。');
    const room = snap.data();
    if (room.status !== 'playing' || !room.game) throw new Error('這個房間目前尚未開始多人遊戲。');

    const seat = findSeatForUid(room, user.uid);
    const game = cloneGame(room.game);
    const wasFinished = Boolean(game.finished);
    game.localSeat = seat ?? activeSeat ?? 0;
    assertGameTurnIntegrity(game);
    validateActionPreconditions(game, options);
    const updatedGame = action({ room, game, seat, user });
    assertGameTurnIntegrity(updatedGame);
    updatedGame.security = {
      ...(updatedGame.security || {}),
      revision: Number(game.security?.revision || 0) + 1,
      lastActionId: `${normalizedRoomId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      lastActorUid: user.uid,
      lastActorSeat: Number.isInteger(seat) ? seat : null,
      updatedAtMs: Date.now(),
      version: 'client-validated-v0.8.0'
    };
    const justFinished = !wasFinished && Boolean(updatedGame.finished);
    const updates = {
      status: roomStatusForGame(updatedGame),
      game: makePlainGame(updatedGame),
      updatedAt: sdk.firestore.serverTimestamp(),
      lastEvent: updatedGame.message
    };
    if (justFinished) {
      const totalScores = applyFinishedGameTotals(room, updatedGame);
      updatedGame.totalScores = totalScores;
      updates.game = makePlainGame(updatedGame);
      updates.totalScores = totalScores;
      updates.lastEvent = `${updatedGame.message} 已更新累計總分。`;
    }

    transaction.update(ref, updates);
  });
}

export async function playMultiplayerCards(roomId, cards, options = {}) {
  await updateMultiplayerGame(roomId, ({ game, seat }) => {
    if (seat === null || seat === undefined) throw new Error('你不在這個房間座位內。');
    if (game.currentTurnSeat !== seat) throw new Error('現在還沒輪到你。');
    if (game.players[seat]?.isAI) throw new Error('這個座位目前由 AI 接管，請等待回合更新。');
    const validation = validateHumanPlay(cards, game);
    if (!validation.ok) throw new Error(validation.message);
    return playCards(game, seat, cards);
  }, options);
}

export async function passMultiplayerTurn(roomId, options = {}) {
  await updateMultiplayerGame(roomId, ({ game, seat }) => {
    if (seat === null || seat === undefined) throw new Error('你不在這個房間座位內。');
    if (game.currentTurnSeat !== seat) throw new Error('現在還沒輪到你。');
    if (game.players[seat]?.isAI) throw new Error('這個座位目前由 AI 接管，請等待回合更新。');
    if (!canPass(game)) throw new Error('現在不能 Pass，請領出一手牌。');
    return passTurn(game, seat);
  }, options);
}

export async function runMultiplayerAITurn(roomId) {
  await updateMultiplayerGame(roomId, ({ room, game, user }) => {
    if (room.hostUid !== user.uid) throw new Error('只有目前房主可以接管 AI 出牌。');
    const player = game.players[game.currentTurnSeat];
    if (!player?.isAI) throw new Error('目前不是 AI 或離線接管座位的回合。');
    return runAITurn(game);
  });
}

export async function reconcileRoomPresence(roomId) {
  const normalizedRoomId = normalizeRoomId(roomId || activeRoomId);
  if (!normalizedRoomId || !canRunBackgroundSync()) return;
  const { sdk, db } = await ensureFirebaseReady();
  const ref = sdk.firestore.doc(db, ROOM_COLLECTION, normalizedRoomId);

  await sdk.firestore.runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) return;
    const room = snap.data();
    if (currentUser?.uid && room.hostUid !== currentUser.uid) return;
    const seats = normalizeSeats(room.seats);
    const now = nowMs();
    let changed = false;
    const events = [];
    let game = room.game ? cloneGame(room.game) : null;

    for (let seat = 0; seat < 4; seat += 1) {
      const seatData = seats[seat];
      if (seatData && !seatData.isAI && seatData.connected && isSeatStale(seatData, now)) {
        seats[seat] = {
          ...seatData,
          connected: false,
          aiTakingOver: room.status === 'playing',
          disconnectedAt: now
        };
        if (room.status === 'playing' && game) {
          game = markGameSeatAsAITakeover(game, seat, seatData);
          events.push(`${seatData.name} 離線，由 AI 接管。`);
        } else {
          events.push(`${seatData.name} 暫時離線。`);
        }
        changed = true;
      }
    }

    let hostUid = room.hostUid;
    let hostName = room.hostName;
    const hostSeat = findHostSeat(seats, room.hostUid);
    const hostNeedsTransfer = hostSeat === null || !seats[hostSeat]?.connected || isSeatStale(seats[hostSeat], now);
    if (hostNeedsTransfer) {
      const newHostSeat = findNextConnectedHumanSeat(seats, hostSeat ?? -1);
      if (newHostSeat !== null) {
        seats.forEach((seatData, index) => {
          if (seatData) seats[index] = { ...seatData, host: index === newHostSeat };
        });
        hostUid = seats[newHostSeat].uid;
        hostName = seats[newHostSeat].name;
        if (game) game.hostUid = hostUid;
        events.push(`房主已轉移給 ${hostName}。`);
        changed = true;
      }
    }

    if (!changed) return;
    transaction.update(ref, {
      seats: seatsToObject(seats),
      ...(game ? { game: makePlainGame(game) } : {}),
      hostUid,
      hostName,
      updatedAt: sdk.firestore.serverTimestamp(),
      presenceUpdatedAt: sdk.firestore.serverTimestamp(),
      lastEvent: events[events.length - 1] || room.lastEvent || '已更新房間連線狀態。'
    });
  });
}

async function sendHeartbeat(roomId = activeRoomId) {
  const normalizedRoomId = normalizeRoomId(roomId);
  if (!normalizedRoomId || activeSeat === null || activeSeat === undefined || !canRunBackgroundSync()) return;
  if (nowMs() - lastHeartbeatAt < Math.floor(HEARTBEAT_INTERVAL_MS * 0.72)) return;
  const { sdk, ref, snap } = await getRoomDocument(normalizedRoomId);
  if (!snap.exists()) return;
  const room = snap.data();
  const seat = findSeatForUid(room, currentUser?.uid);
  if (seat === null || seat === undefined) return;
  const name = getLocalPlayerName();
  const updates = {
    [`seats.${seat}.connected`]: true,
    [`seats.${seat}.aiTakingOver`]: false,
    [`seats.${seat}.lastSeen`]: nowMs(),
    [`seats.${seat}.name`]: name,
    presenceUpdatedAt: sdk.firestore.serverTimestamp()
  };

  if (room.game?.players?.[seat] && !room.seats?.[seat]?.isAI && !room.seats?.[String(seat)]?.isAI) {
    const game = cloneGame(room.game);
    const player = game.players[seat];
    const payload = {
      seat,
      name,
      uid: currentUser?.uid,
      isAI: false,
      connected: true
    };

    // 一般心跳只更新 seats.lastSeen，不要每 15 秒重寫 game。
    // v0.6.0 會把「已重新連線」重複寫入 game.history，造成所有人畫面重繪，
    // 玩家剛選好的牌因此看起來會閃一下並被清掉。
    if (player?.isAI || player?.aiTakingOver || player?.connected === false) {
      restoreGameSeatFromReconnect(game, seat, payload);
      updates.game = makePlainGame(game);
    } else if (player && (player.name !== name || player.uid !== currentUser?.uid || !player.isHuman)) {
      game.players[seat] = {
        ...player,
        name,
        uid: currentUser?.uid,
        connected: true,
        isAI: false,
        isHuman: true,
        aiTakingOver: false
      };
      updates.game = makePlainGame(game);
    }
  }

  await sdk.firestore.updateDoc(ref, updates);
  lastHeartbeatAt = nowMs();
}

function startPresenceTimers(roomId) {
  activeRoomId = normalizeRoomId(roomId || activeRoomId);
  if (heartbeatTimer) window.clearInterval(heartbeatTimer);
  if (reconcileTimer) window.clearInterval(reconcileTimer);

  heartbeatTimer = window.setInterval(() => {
    if (canRunBackgroundSync()) sendHeartbeat(activeRoomId).catch(() => {});
  }, HEARTBEAT_INTERVAL_MS);

  reconcileTimer = window.setInterval(() => {
    if (canRunBackgroundSync() && latestRoomData?.hostUid === currentUser?.uid) {
      reconcileRoomPresence(activeRoomId).catch(() => {});
    }
  }, RECONCILE_INTERVAL_MS);

  lastHeartbeatAt = 0;
  sendHeartbeat(activeRoomId).catch(() => {});
  if (latestRoomData?.hostUid === currentUser?.uid) reconcileRoomPresence(activeRoomId).catch(() => {});
}

function stopPresenceTimers() {
  if (heartbeatTimer) window.clearInterval(heartbeatTimer);
  if (reconcileTimer) window.clearInterval(reconcileTimer);
  heartbeatTimer = null;
  reconcileTimer = null;
}


export async function kickSeat(roomId, seatIndex) {
  const normalizedRoomId = normalizeRoomId(roomId || activeRoomId);
  const seatToKick = Number(seatIndex);
  if (!Number.isInteger(seatToKick) || seatToKick < 0 || seatToKick > 3) throw new Error('座位資料不正確。');
  const { sdk, db, user } = await ensureFirebaseReady();
  const ref = sdk.firestore.doc(db, ROOM_COLLECTION, normalizedRoomId);

  await sdk.firestore.runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error('找不到房間。');
    const room = snap.data();
    if (room.hostUid !== user.uid) throw new Error('只有房主可以踢除玩家。');
    const seats = normalizeSeats(room.seats);
    const target = seats[seatToKick];
    if (!target) throw new Error('該座位目前沒有人。');
    if (target.uid === user.uid) throw new Error('房主不能踢除自己。');

    if (room.status === 'playing' && room.game) {
      const game = markGameSeatAsAITakeover(cloneGame(room.game), seatToKick, target);
      seats[seatToKick] = {
        ...target,
        isAI: true,
        uid: `ai-seat-${seatToKick}`,
        name: `AI ${seatToKick + 1}`,
        connected: false,
        aiTakingOver: false
      };
      transaction.update(ref, {
        seats: seatsToObject(seats),
        game: makePlainGame(game),
        updatedAt: sdk.firestore.serverTimestamp(),
        lastEvent: `房主已將 ${target.name || '玩家'} 移出，改由 AI ${seatToKick + 1} 接手。`
      });
      return;
    }

    seats[seatToKick] = null;
    transaction.update(ref, {
      seats: seatsToObject(seats),
      updatedAt: sdk.firestore.serverTimestamp(),
      lastEvent: `房主已將 ${target.name || '玩家'} 移出房間。`
    });
  });
}

export async function moveSeat(roomId, fromSeat, toSeat) {
  const normalizedRoomId = normalizeRoomId(roomId || activeRoomId);
  const from = Number(fromSeat);
  const to = Number(toSeat);
  if (![from, to].every((seat) => Number.isInteger(seat) && seat >= 0 && seat <= 3)) throw new Error('座位資料不正確。');
  if (from === to) return;
  const { sdk, db, user } = await ensureFirebaseReady();
  const ref = sdk.firestore.doc(db, ROOM_COLLECTION, normalizedRoomId);

  await sdk.firestore.runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error('找不到房間。');
    const room = snap.data();
    if (room.hostUid !== user.uid) throw new Error('只有房主可以重新安排座位。');
    if (room.status === 'playing') throw new Error('牌局進行中不能重新安排座位，請等本局結束。');
    const seats = normalizeSeats(room.seats);
    const source = seats[from];
    if (!source) throw new Error('來源座位沒有人。');
    const target = seats[to];
    seats[to] = { ...source, seat: to };
    seats[from] = target ? { ...target, seat: from } : null;
    seats.forEach((seatData, index) => {
      if (seatData) seats[index] = { ...seatData, seat: index, host: seatData.uid === room.hostUid };
    });
    transaction.update(ref, {
      seats: seatsToObject(seats),
      updatedAt: sdk.firestore.serverTimestamp(),
      lastEvent: target
        ? `房主交換座位 ${from + 1} 與座位 ${to + 1}。`
        : `房主將 ${source.name || '玩家'} 移到座位 ${to + 1}。`
    });
  });
}

export async function leaveRoom(roomId) {
  const normalizedRoomId = normalizeRoomId(roomId || activeRoomId);
  if (!normalizedRoomId || activeSeat === null) return;

  const { sdk, ref, snap } = await getRoomDocument(normalizedRoomId);
  if (!snap.exists()) return;
  const room = snap.data();
  const { user } = await ensureFirebaseReady();
  const currentSeat = findSeatForUid(room, user.uid);
  if (currentSeat === null) return;

  if (room.status === 'playing' && room.game) {
    const game = markGameSeatAsAITakeover(cloneGame(room.game), currentSeat, normalizeSeats(room.seats)[currentSeat]);
    await sdk.firestore.updateDoc(ref, {
      [`seats.${currentSeat}.connected`]: false,
      [`seats.${currentSeat}.aiTakingOver`]: true,
      [`seats.${currentSeat}.disconnectedAt`]: nowMs(),
      game: makePlainGame(game),
      updatedAt: sdk.firestore.serverTimestamp(),
      lastEvent: `${getLocalPlayerName()} 離線，由 AI 接管到本局結束。`
    });
    await reconcileRoomPresence(normalizedRoomId).catch(() => {});
  } else {
    await sdk.firestore.updateDoc(ref, {
      [`seats.${currentSeat}`]: sdk.firestore.deleteField(),
      updatedAt: sdk.firestore.serverTimestamp(),
      lastEvent: `${getLocalPlayerName()} 離開房間。`
    });
  }

  stopListeningRoom();
  stopPresenceTimers();
  activeRoomId = null;
  activeSeat = null;
}

export async function listenRoom(roomId, onRoom, onError) {
  const normalizedRoomId = normalizeRoomId(roomId);
  const { sdk, db, user } = await ensureFirebaseReady();
  const ref = sdk.firestore.doc(db, ROOM_COLLECTION, normalizedRoomId);
  latestRoomCallback = onRoom;
  latestRoomErrorCallback = onError;

  if (unsubscribeRoom && listeningRoomId === normalizedRoomId) {
    if (latestRoomData && typeof latestRoomCallback === 'function') {
      const localSeat = findSeatForUid(latestRoomData, user.uid);
      latestRoomCallback({
        ...latestRoomData,
        roomId: normalizedRoomId,
        seatList: normalizeSeats(latestRoomData.seats),
        localSeat,
        localUid: user.uid,
        isHost: latestRoomData.hostUid === user.uid
      });
    }
    return;
  }

  stopListeningRoom();
  activeRoomId = normalizedRoomId;
  listeningRoomId = normalizedRoomId;
  startPresenceTimers(normalizedRoomId);

  unsubscribeRoom = sdk.firestore.onSnapshot(
    ref,
    { includeMetadataChanges: true },
    (snap) => {
      if (!snap.exists()) {
        latestRoomData = null;
        latestRoomSignature = '';
        if (typeof latestRoomCallback === 'function') latestRoomCallback(null);
        return;
      }
      const data = snap.data();
      latestRoomData = data;
      const localSeat = findSeatForUid(data, user.uid);
      activeSeat = localSeat;
      const now = nowMs();
      if (!snap.metadata.fromCache && localSeat !== null && now - lastHeartbeatAt > 12000 && canRunBackgroundSync()) {
        sendHeartbeat(normalizedRoomId).catch(() => {});
      }
      if (!snap.metadata.fromCache && data.hostUid === user.uid && now - lastReconcileAt > 25000 && canRunBackgroundSync()) {
        lastReconcileAt = now;
        reconcileRoomPresence(normalizedRoomId).catch(() => {});
      }

      const signature = roomRenderSignature(data);
      if (signature === latestRoomSignature) return;
      latestRoomSignature = signature;
      if (typeof latestRoomCallback === 'function') {
        latestRoomCallback({
          ...data,
          roomId: normalizedRoomId,
          seatList: normalizeSeats(data.seats),
          localSeat,
          localUid: user.uid,
          isHost: data.hostUid === user.uid,
          fromCache: snap.metadata.fromCache,
          hasPendingWrites: snap.metadata.hasPendingWrites
        });
      }
    },
    (error) => {
      if (typeof latestRoomErrorCallback === 'function') latestRoomErrorCallback(error);
    }
  );
}

export function stopListeningRoom() {
  if (typeof unsubscribeRoom === 'function') {
    unsubscribeRoom();
  }
  unsubscribeRoom = null;
  listeningRoomId = null;
  latestRoomData = null;
  latestRoomSignature = '';
}



export async function refreshActiveRoomConnection() {
  if (!activeRoomId || !canUseNetwork()) return { ok: false, roomId: activeRoomId, reason: 'offline' };
  await ensureFirebaseReady();
  lastHeartbeatAt = 0;
  await sendHeartbeat(activeRoomId).catch(() => {});
  if (latestRoomData?.hostUid === currentUser?.uid) {
    await reconcileRoomPresence(activeRoomId).catch(() => {});
  }
  return { ok: true, roomId: activeRoomId, seat: activeSeat };
}

export async function cleanupExpiredOwnedRooms(maxAgeMs = STALE_ROOM_MS) {
  const { sdk, db, user } = await ensureFirebaseReady();
  const roomsRef = sdk.firestore.collection(db, ROOM_COLLECTION);
  const q = sdk.firestore.query(
    roomsRef,
    sdk.firestore.where('hostUid', '==', user.uid),
    sdk.firestore.limit(30)
  );
  const snap = await sdk.firestore.getDocs(q);
  const cutoff = nowMs() - Math.max(60 * 60 * 1000, Number(maxAgeMs) || STALE_ROOM_MS);
  const deletions = [];
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    let updatedAtMs = 0;
    try {
      updatedAtMs = typeof data.updatedAt?.toMillis === 'function' ? data.updatedAt.toMillis() : Number(data.updatedAtMs || 0);
    } catch {
      updatedAtMs = 0;
    }
    if (docSnap.id === activeRoomId || data.status === 'playing') continue;
    if (updatedAtMs && updatedAtMs < cutoff) deletions.push(sdk.firestore.deleteDoc(docSnap.ref));
  }
  await Promise.all(deletions);
  return { deleted: deletions.length, checked: snap.size };
}

export function getActiveRoomInfo() {
  return {
    roomId: activeRoomId,
    seat: activeSeat,
    uid: currentUser?.uid || null
  };
}

export function getPresenceDebugInfo() {
  return {
    heartbeatMs: HEARTBEAT_INTERVAL_MS,
    stalePlayerMs: STALE_PLAYER_MS,
    activeRoomId,
    activeSeat,
    uid: currentUser?.uid || null
  };
}

export function qrCodeImageUrl(text, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
}
