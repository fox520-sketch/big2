import { VERSION } from './constants.js';
import { cloudFunctionsRegion, firebaseConfig, hasFirebaseConfig } from './firebase-config.js';
import { createGameFromSeats, passTurn, playCards, runAITurn } from './game-state.js';
import { mergeSeriesTotals } from './scoring.js';
import { canPass, validateHumanPlay } from './rules.js';
import { normalizeRules, normalizeScoringRules, ruleSummary, scoringSummary } from './game-settings.js';

const ROOM_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_ID_LENGTH = 6;
const FIREBASE_VERSION = '10.14.1';
const ROOM_COLLECTION = 'rooms';
const HEARTBEAT_INTERVAL_MS = 15000;
const RECONCILE_INTERVAL_MS = 12000;
const STALE_PLAYER_MS = 45000;

let sdkPromise = null;
let appInstance = null;
let authInstance = null;
let dbInstance = null;
let functionsInstance = null;
let currentUser = null;
let unsubscribeRoom = null;
let activeRoomId = null;
let activeSeat = null;
let heartbeatTimer = null;
let reconcileTimer = null;
let lastHeartbeatAt = 0;
let lastReconcileAt = 0;

function nowMs() {
  return Date.now();
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
    ? { ok: true, text: 'Firebase 設定已填入；v0.7.0 需要 Cloud Functions 已部署後才能建立/加入房間。' }
    : { ok: false, text: '尚未填入 Firebase 設定，請先編輯 src/firebase-config.js。' };
}

async function loadFirebaseSdk() {
  if (!sdkPromise) {
    sdkPromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-functions.js`)
    ]).then(([app, auth, firestore, functions]) => ({ app, auth, firestore, functions }));
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
    functionsInstance = sdk.functions.getFunctions(appInstance, cloudFunctionsRegion);
  }

  if (!authInstance.currentUser) {
    await sdk.auth.signInAnonymously(authInstance);
  }

  currentUser = authInstance.currentUser;
  return { sdk, app: appInstance, auth: authInstance, db: dbInstance, functions: functionsInstance, user: currentUser };
}


async function callCloudFunction(name, payload = {}) {
  const { sdk, functions } = await ensureFirebaseReady();
  if (!functions) throw new Error('Cloud Functions 尚未初始化。');
  const callable = sdk.functions.httpsCallable(functions, name);
  try {
    const result = await callable(payload);
    return result.data || {};
  } catch (error) {
    const message = error?.message || error?.details?.message || 'Cloud Functions 操作失敗，請確認已部署 functions。';
    throw new Error(message.replace(/^FirebaseError:\s*/i, ''));
  }
}

function cardsToIds(cards = []) {
  return cards.map((card) => String(card.id || card).trim().toUpperCase()).filter(Boolean);
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

export async function createRoom({ playerName, aiLevel, rules, scoringRules }) {
  const name = saveLocalPlayerName(playerName);
  const data = await callCloudFunction('createRoom', {
    playerName: name,
    aiLevel: Number(aiLevel) || 8,
    rules: normalizeRules(rules),
    scoringRules: normalizeScoringRules(scoringRules)
  });
  const roomId = normalizeRoomId(data.roomId);
  activeRoomId = roomId;
  activeSeat = Number.isInteger(data.seat) ? data.seat : 0;
  startPresenceTimers(roomId);
  return { roomId, inviteUrl: buildInviteUrl(roomId), seat: activeSeat };
}

export async function joinRoom(roomId, { playerName } = {}) {
  const normalizedRoomId = normalizeRoomId(roomId);
  if (!normalizedRoomId || normalizedRoomId.length !== ROOM_ID_LENGTH) {
    throw new Error('請輸入 6 碼房號。');
  }
  const name = saveLocalPlayerName(playerName);
  const data = await callCloudFunction('joinRoom', { roomId: normalizedRoomId, playerName: name });
  activeRoomId = normalizedRoomId;
  activeSeat = Number.isInteger(data.seat) ? data.seat : null;
  startPresenceTimers(normalizedRoomId);
  return { roomId: normalizedRoomId, inviteUrl: buildInviteUrl(normalizedRoomId), seat: activeSeat };
}

export async function fillAISeats(roomId) {
  const normalizedRoomId = normalizeRoomId(roomId || activeRoomId);
  await callCloudFunction('fillAISeats', { roomId: normalizedRoomId });
}

export async function startMultiplayerGame(roomId, { aiLevel, rules, scoringRules } = {}) {
  const normalizedRoomId = normalizeRoomId(roomId || activeRoomId);
  await callCloudFunction('startGame', {
    roomId: normalizedRoomId,
    aiLevel: Number(aiLevel) || 8,
    rules: normalizeRules(rules),
    scoringRules: normalizeScoringRules(scoringRules)
  });
}

function buildActionPreconditions(options = {}) {
  return {
    expectedGameId: options.expectedGameId || null,
    expectedRevision: Number.isFinite(Number(options.expectedRevision)) ? Number(options.expectedRevision) : undefined,
    expectedTurnSeat: Number.isInteger(options.expectedTurnSeat) ? options.expectedTurnSeat : undefined
  };
}

export async function playMultiplayerCards(roomId, cards, options = {}) {
  await callCloudFunction('submitPlay', {
    roomId: normalizeRoomId(roomId || activeRoomId),
    cardIds: cardsToIds(cards),
    ...buildActionPreconditions(options)
  });
}

export async function passMultiplayerTurn(roomId, options = {}) {
  await callCloudFunction('submitPass', {
    roomId: normalizeRoomId(roomId || activeRoomId),
    ...buildActionPreconditions(options)
  });
}

export async function runMultiplayerAITurn(roomId) {
  await callCloudFunction('runAITurnCallable', { roomId: normalizeRoomId(roomId || activeRoomId) });
}

export async function reconcileRoomPresence(roomId) {
  const normalizedRoomId = normalizeRoomId(roomId || activeRoomId);
  if (!normalizedRoomId) return;
  await callCloudFunction('reconcilePresence', { roomId: normalizedRoomId });
}

async function sendHeartbeat(roomId = activeRoomId) {
  const normalizedRoomId = normalizeRoomId(roomId);
  if (!normalizedRoomId || activeSeat === null || activeSeat === undefined) return;
  const data = await callCloudFunction('syncPresence', {
    roomId: normalizedRoomId,
    playerName: getLocalPlayerName()
  });
  if (Number.isInteger(data.seat)) activeSeat = data.seat;
  lastHeartbeatAt = nowMs();
}

function startPresenceTimers(roomId) {
  activeRoomId = normalizeRoomId(roomId || activeRoomId);
  if (heartbeatTimer) window.clearInterval(heartbeatTimer);
  if (reconcileTimer) window.clearInterval(reconcileTimer);

  heartbeatTimer = window.setInterval(() => {
    sendHeartbeat(activeRoomId).catch(() => {});
  }, HEARTBEAT_INTERVAL_MS);

  reconcileTimer = window.setInterval(() => {
    reconcileRoomPresence(activeRoomId).catch(() => {});
  }, RECONCILE_INTERVAL_MS);

  sendHeartbeat(activeRoomId).catch(() => {});
  reconcileRoomPresence(activeRoomId).catch(() => {});
}

function stopPresenceTimers() {
  if (heartbeatTimer) window.clearInterval(heartbeatTimer);
  if (reconcileTimer) window.clearInterval(reconcileTimer);
  heartbeatTimer = null;
  reconcileTimer = null;
}

export async function leaveRoom(roomId) {
  const normalizedRoomId = normalizeRoomId(roomId || activeRoomId);
  if (!normalizedRoomId || activeSeat === null) return;
  await callCloudFunction('leaveRoom', { roomId: normalizedRoomId });
  stopListeningRoom();
  stopPresenceTimers();
  activeRoomId = null;
  activeSeat = null;
}

export async function listenRoom(roomId, onRoom, onError) {
  const normalizedRoomId = normalizeRoomId(roomId);
  const { sdk, db, user } = await ensureFirebaseReady();
  const ref = sdk.firestore.doc(db, ROOM_COLLECTION, normalizedRoomId);
  stopListeningRoom();
  activeRoomId = normalizedRoomId;
  startPresenceTimers(normalizedRoomId);

  unsubscribeRoom = sdk.firestore.onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onRoom(null);
        return;
      }
      const data = snap.data();
      const localSeat = findSeatForUid(data, user.uid);
      activeSeat = localSeat;
      const now = nowMs();
      if (localSeat !== null && now - lastHeartbeatAt > 8000) {
        sendHeartbeat(normalizedRoomId).catch(() => {});
      }
      if (now - lastReconcileAt > 10000) {
        lastReconcileAt = now;
        reconcileRoomPresence(normalizedRoomId).catch(() => {});
      }
      onRoom({
        ...data,
        roomId: normalizedRoomId,
        seatList: normalizeSeats(data.seats),
        localSeat,
        localUid: user.uid,
        isHost: data.hostUid === user.uid
      });
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

export function stopListeningRoom() {
  if (typeof unsubscribeRoom === 'function') {
    unsubscribeRoom();
  }
  unsubscribeRoom = null;
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
