import { VERSION } from './constants.js';
import { firebaseConfig, hasFirebaseConfig } from './firebase-config.js';

const ROOM_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_ID_LENGTH = 6;
const FIREBASE_VERSION = '10.14.1';
const ROOM_COLLECTION = 'rooms';

let sdkPromise = null;
let appInstance = null;
let authInstance = null;
let dbInstance = null;
let currentUser = null;
let unsubscribeRoom = null;
let activeRoomId = null;
let activeSeat = null;

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

function seatPayload({ seat, name, isAI, uid, host }) {
  return {
    seat,
    name,
    isAI: Boolean(isAI),
    uid: uid || `ai-seat-${seat}`,
    host: Boolean(host),
    connected: !isAI,
    joinedAt: Date.now()
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

async function getRoomDocument(roomId) {
  const { sdk, db } = await ensureFirebaseReady();
  const ref = sdk.firestore.doc(db, ROOM_COLLECTION, normalizeRoomId(roomId));
  const snap = await sdk.firestore.getDoc(ref);
  return { sdk, db, ref, snap };
}

export async function createRoom({ playerName, aiLevel }) {
  const { sdk, db, user } = await ensureFirebaseReady();
  const roomId = makeRoomId();
  const name = saveLocalPlayerName(playerName);
  const roomRef = sdk.firestore.doc(db, ROOM_COLLECTION, roomId);
  const inviteUrl = buildInviteUrl(roomId);

  const roomData = {
    roomId,
    status: 'waiting',
    hostUid: user.uid,
    hostName: name,
    aiLevel: Number(aiLevel) || 8,
    version: VERSION,
    createdAt: sdk.firestore.serverTimestamp(),
    updatedAt: sdk.firestore.serverTimestamp(),
    invitePath: inviteUrl,
    lastEvent: `${name} 建立房間。`,
    seats: {
      0: seatPayload({ seat: 0, name, uid: user.uid, host: true })
    }
  };

  await sdk.firestore.setDoc(roomRef, roomData);
  activeRoomId = roomId;
  activeSeat = 0;
  return { roomId, inviteUrl, seat: 0 };
}

export async function joinRoom(roomId, { playerName } = {}) {
  const normalizedRoomId = normalizeRoomId(roomId);
  if (!normalizedRoomId || normalizedRoomId.length !== ROOM_ID_LENGTH) {
    throw new Error('請輸入 6 碼房號。');
  }

  const { sdk, ref, snap } = await getRoomDocument(normalizedRoomId);
  if (!snap.exists()) {
    throw new Error(`找不到房間 ${normalizedRoomId}，請確認房號是否正確。`);
  }

  const room = snap.data();
  const { user } = await ensureFirebaseReady();
  const existingSeat = findSeatForUid(room, user.uid);
  const seat = existingSeat ?? findEmptySeat(room);
  if (seat === null) {
    throw new Error('這個房間已滿，無法加入。');
  }

  const name = saveLocalPlayerName(playerName);
  const payload = seatPayload({ seat, name, uid: user.uid, host: room.hostUid === user.uid });

  await sdk.firestore.updateDoc(ref, {
    [`seats.${seat}`]: payload,
    updatedAt: sdk.firestore.serverTimestamp(),
    lastEvent: existingSeat === null ? `${name} 加入房間。` : `${name} 回到房間。`
  });

  activeRoomId = normalizedRoomId;
  activeSeat = seat;
  return { roomId: normalizedRoomId, inviteUrl: buildInviteUrl(normalizedRoomId), seat };
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
  for (let seat = 0; seat < 4; seat += 1) {
    if (!seats[seat]) {
      updates[`seats.${seat}`] = seatPayload({ seat, name: `AI ${seat}`, isAI: true });
    }
  }
  await sdk.firestore.updateDoc(ref, updates);
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

  await sdk.firestore.updateDoc(ref, {
    [`seats.${currentSeat}`]: sdk.firestore.deleteField(),
    updatedAt: sdk.firestore.serverTimestamp(),
    lastEvent: `${getLocalPlayerName()} 離開房間。`
  });

  stopListeningRoom();
  activeRoomId = null;
  activeSeat = null;
}

export async function listenRoom(roomId, onRoom, onError) {
  const normalizedRoomId = normalizeRoomId(roomId);
  const { sdk, db } = await ensureFirebaseReady();
  const ref = sdk.firestore.doc(db, ROOM_COLLECTION, normalizedRoomId);
  stopListeningRoom();
  activeRoomId = normalizedRoomId;

  unsubscribeRoom = sdk.firestore.onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onRoom(null);
        return;
      }
      const data = snap.data();
      onRoom({ ...data, roomId: normalizedRoomId, seatList: normalizeSeats(data.seats) });
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

export function qrCodeImageUrl(text, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
}
