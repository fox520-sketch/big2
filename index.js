import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import {
  VERSION,
  applySecurityRevision,
  assertGameIntegrity,
  cardsFromIds,
  createGameFromSeats,
  ensureFilledSeatList,
  findEmptySeat,
  findHostSeat,
  findNextConnectedHumanSeat,
  findReplaceableAISeat,
  findSeatForUid,
  isSeatStale,
  makeInitialTotalsFromSeats,
  makeRoomId,
  makeSeatPayload,
  markGameSeatAsAITakeover,
  mergeSeriesTotals,
  normalizePlayerName,
  normalizeRoomId,
  normalizeRules,
  normalizeScoringRules,
  passTurn,
  playCards,
  prepareSeatListForGame,
  restoreGameSeatFromReconnect,
  runAITurn,
  seatsToObject,
  normalizeSeats,
  ruleSummary,
  scoringSummary,
  validateActionPreconditions
} from './lib/game-engine.js';

initializeApp();
setGlobalOptions({ region: 'asia-east1', maxInstances: 20 });

const db = getFirestore();
const ROOM_COLLECTION = 'rooms';
const STALE_PLAYER_MS = 45000;

function nowMs() {
  return Date.now();
}

function requireAuth(request) {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', '請先完成匿名登入後再操作。');
  }
  return request.auth.uid;
}

function roomRef(roomId) {
  const normalized = normalizeRoomId(roomId);
  if (!normalized || normalized.length !== 6) throw new HttpsError('invalid-argument', '請輸入 6 碼房號。');
  return { roomId: normalized, ref: db.collection(ROOM_COLLECTION).doc(normalized) };
}

function sanitizeExpected(data = {}) {
  return {
    expectedGameId: typeof data.expectedGameId === 'string' ? data.expectedGameId : null,
    expectedRevision: Number.isFinite(Number(data.expectedRevision)) ? Number(data.expectedRevision) : undefined,
    expectedTurnSeat: Number.isInteger(Number(data.expectedTurnSeat)) ? Number(data.expectedTurnSeat) : undefined
  };
}

function plainGame(game) {
  return JSON.parse(JSON.stringify(game));
}

function roomStatusForGame(game) {
  return game.finished ? 'finished' : 'playing';
}

function assertHost(room, uid, message = '只有房主可以操作。') {
  if (room.hostUid !== uid) throw new HttpsError('permission-denied', message);
}

function assertRoomPlayer(room, uid) {
  const seat = findSeatForUid(room, uid);
  if (seat === null || seat === undefined) throw new HttpsError('permission-denied', '你不在這個房間座位內。');
  return seat;
}

function makeTotalsForSeats(room, seats) {
  const totalScores = { ...makeInitialTotalsFromSeats(seats), ...(room.totalScores || {}) };
  for (const seat of seats) {
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
  return totalScores;
}

function addActionLog(transaction, ref, payload) {
  const actionRef = ref.collection('actions').doc();
  transaction.set(actionRef, {
    ...payload,
    actionId: actionRef.id,
    createdAt: FieldValue.serverTimestamp(),
    createdAtMs: nowMs(),
    backendVersion: 'cloud-functions-v0.7.0'
  });
}

async function wrapCallable(handler) {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('failed-precondition', error.message || '伺服器驗證失敗。');
  }
}

export const createRoom = onCall(async (request) => wrapCallable(async () => {
  const uid = requireAuth(request);
  const name = normalizePlayerName(request.data?.playerName, '玩家');
  const aiLevel = Math.min(20, Math.max(1, Math.round(Number(request.data?.aiLevel || 8))));
  const rules = normalizeRules(request.data?.rules);
  const scoringRules = normalizeScoringRules(request.data?.scoringRules);
  let roomId = makeRoomId();
  let ref = db.collection(ROOM_COLLECTION).doc(roomId);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const snap = await ref.get();
    if (!snap.exists) break;
    roomId = makeRoomId();
    ref = db.collection(ROOM_COLLECTION).doc(roomId);
  }

  const hostSeat = makeSeatPayload({ seat: 0, name, uid, host: true, isAI: false, connected: true });
  await ref.set({
    roomId,
    status: 'waiting',
    hostUid: uid,
    hostName: name,
    aiLevel,
    rules,
    scoringRules,
    securityVersion: 'cloud-functions-v0.7.0',
    backendMode: 'cloudFunctions',
    version: VERSION,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    presenceUpdatedAt: FieldValue.serverTimestamp(),
    gameNo: 0,
    lastEvent: `${name} 建立 Cloud Functions 防作弊房間。${ruleSummary(rules)}；${scoringSummary(scoringRules)}`,
    totalScores: makeInitialTotalsFromSeats([hostSeat, null, null, null]),
    seats: { 0: hostSeat }
  });

  await ref.collection('actions').add({
    uid,
    seat: 0,
    actionType: 'createRoom',
    status: 'accepted',
    createdAt: FieldValue.serverTimestamp(),
    createdAtMs: nowMs(),
    backendVersion: 'cloud-functions-v0.7.0'
  });

  return { roomId, seat: 0, securityVersion: 'cloud-functions-v0.7.0' };
}));

export const joinRoom = onCall(async (request) => wrapCallable(async () => {
  const uid = requireAuth(request);
  const { roomId, ref } = roomRef(request.data?.roomId);
  const name = normalizePlayerName(request.data?.playerName, '玩家');
  let joinedSeat = null;

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', `找不到房間 ${roomId}，請確認房號是否正確。`);
    const room = snap.data();
    const existingSeat = findSeatForUid(room, uid);
    const emptySeat = findEmptySeat(room);
    const replaceAISeat = emptySeat === null ? findReplaceableAISeat(room) : null;
    const seat = existingSeat ?? emptySeat ?? replaceAISeat;
    if (seat === null || seat === undefined) throw new HttpsError('failed-precondition', '這個房間已滿或牌局已開始，無法加入。');

    const seats = normalizeSeats(room.seats);
    const wasHost = room.hostUid === uid || (!room.hostUid && seat === 0);
    const payload = makeSeatPayload({ seat, name, uid, host: wasHost, connected: true, aiTakingOver: false });
    seats[seat] = payload;

    let game = room.game ? plainGame(room.game) : null;
    if (game && existingSeat !== null) game = restoreGameSeatFromReconnect(game, seat, payload);

    const totalScores = { ...(room.totalScores || makeInitialTotalsFromSeats(seats)) };
    totalScores[seat] = {
      ...(totalScores[seat] || {}),
      seat,
      name,
      uid,
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
      updatedAt: FieldValue.serverTimestamp(),
      presenceUpdatedAt: FieldValue.serverTimestamp(),
      lastEvent: existingSeat === null ? `${name} 加入房間。` : `${name} 回到房間。`
    };
    if (game) updates.game = game;
    transaction.update(ref, updates);
    addActionLog(transaction, ref, { uid, seat, actionType: existingSeat === null ? 'joinRoom' : 'reconnect', status: 'accepted' });
    joinedSeat = seat;
  });

  return { roomId, seat: joinedSeat };
}));

export const fillAISeats = onCall(async (request) => wrapCallable(async () => {
  const uid = requireAuth(request);
  const { roomId, ref } = roomRef(request.data?.roomId);
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', '找不到房間，無法補 AI。');
    const room = snap.data();
    assertHost(room, uid, '只有房主可以補 AI 空位。');
    if (room.status === 'playing' && !room.game?.finished) throw new HttpsError('failed-precondition', '牌局進行中不能補 AI 空位。');
    const seats = normalizeSeats(room.seats);
    for (let seat = 0; seat < 4; seat += 1) {
      if (!seats[seat]) seats[seat] = makeSeatPayload({ seat, name: `AI ${seat + 1}`, isAI: true, connected: false });
    }
    const totalScores = makeTotalsForSeats(room, seats);
    transaction.update(ref, {
      seats: seatsToObject(seats),
      totalScores,
      updatedAt: FieldValue.serverTimestamp(),
      lastEvent: '房主已用 AI 補滿空位。'
    });
    addActionLog(transaction, ref, { uid, actionType: 'fillAISeats', status: 'accepted' });
  });
  return { roomId, ok: true };
}));

export const startGame = onCall(async (request) => wrapCallable(async () => {
  const uid = requireAuth(request);
  const { roomId, ref } = roomRef(request.data?.roomId);
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', '找不到房間，無法開始多人遊戲。');
    const room = snap.data();
    assertHost(room, uid, '只有房主可以開始多人遊戲 / 下一局。');
    if (room.status === 'playing' && room.game && !room.game.finished) {
      throw new HttpsError('failed-precondition', '目前牌局尚未結束，不能直接重新開局。');
    }
    const filledSeats = prepareSeatListForGame(room, STALE_PLAYER_MS);
    const nextGameNo = Number(room.gameNo || 0) + 1;
    const rules = normalizeRules(request.data?.rules || room.rules);
    const scoringRules = normalizeScoringRules(request.data?.scoringRules || room.scoringRules);
    const aiLevel = Math.min(20, Math.max(1, Math.round(Number(request.data?.aiLevel || room.aiLevel || 8))));
    const game = createGameFromSeats(filledSeats, { aiLevel, rules, scoringRules, hostUid: room.hostUid, gameId: `${roomId}-${nextGameNo}-${nowMs()}` });
    game.history.unshift(`多人第 ${nextGameNo} 局開始，Cloud Functions 已在後端洗牌、發牌與指定起手玩家。${ruleSummary(rules)}；${scoringSummary(scoringRules)}`);
    const totalScores = makeTotalsForSeats(room, filledSeats);
    transaction.update(ref, {
      status: 'playing',
      seats: seatsToObject(filledSeats),
      game,
      gameNo: nextGameNo,
      totalScores,
      aiLevel,
      rules,
      scoringRules,
      securityVersion: 'cloud-functions-v0.7.0',
      backendMode: 'cloudFunctions',
      updatedAt: FieldValue.serverTimestamp(),
      lastEvent: `多人第 ${nextGameNo} 局開始：${game.message}`
    });
    addActionLog(transaction, ref, { uid, actionType: 'startGame', status: 'accepted', gameNo: nextGameNo, gameId: game.gameId });
  });
  return { roomId, ok: true };
}));

async function updateGameAction({ request, actionType, apply }) {
  const uid = requireAuth(request);
  const { roomId, ref } = roomRef(request.data?.roomId);
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', '找不到房間。');
    const room = snap.data();
    if (room.status !== 'playing' || !room.game) throw new HttpsError('failed-precondition', '這個房間目前尚未開始多人遊戲。');
    const seat = assertRoomPlayer(room, uid);
    let game = plainGame(room.game);
    assertGameIntegrity(game);
    validateActionPreconditions(game, sanitizeExpected(request.data || {}));
    game = apply({ room, game, seat, uid });
    assertGameIntegrity(game);
    game = applySecurityRevision(game, { roomId, uid, seat, actionType });

    const updates = {
      status: roomStatusForGame(game),
      game,
      updatedAt: FieldValue.serverTimestamp(),
      lastEvent: game.message
    };
    if (game.finished) {
      const totalScores = mergeSeriesTotals(room.totalScores || {}, game.results || [], game.players || [], Number(room.gameNo || 0));
      game.totalScores = totalScores;
      updates.game = game;
      updates.totalScores = totalScores;
      updates.lastEvent = `${game.message} 已由後端更新累計總分。`;
    }
    transaction.update(ref, updates);
    addActionLog(transaction, ref, { uid, seat, actionType, status: 'accepted', gameId: game.gameId, revision: game.security?.revision });
  });
  return { roomId, ok: true };
}

export const submitPlay = onCall(async (request) => wrapCallable(async () => updateGameAction({
  request,
  actionType: 'play',
  apply: ({ game, seat }) => {
    if (game.players[seat]?.isAI) throw new Error('這個座位目前由 AI 接管，請等待回合更新。');
    const cards = cardsFromIds(request.data?.cardIds || []);
    return playCards(game, seat, cards);
  }
})));

export const submitPass = onCall(async (request) => wrapCallable(async () => updateGameAction({
  request,
  actionType: 'pass',
  apply: ({ game, seat }) => {
    if (game.players[seat]?.isAI) throw new Error('這個座位目前由 AI 接管，請等待回合更新。');
    return passTurn(game, seat);
  }
})));

export const runAITurnCallable = onCall(async (request) => wrapCallable(async () => {
  const uid = requireAuth(request);
  const { roomId, ref } = roomRef(request.data?.roomId);
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', '找不到房間。');
    const room = snap.data();
    assertRoomPlayer(room, uid);
    if (room.status !== 'playing' || !room.game) throw new HttpsError('failed-precondition', '這個房間目前尚未開始多人遊戲。');
    let game = plainGame(room.game);
    assertGameIntegrity(game);
    const current = game.players[game.currentTurnSeat];
    const currentSeat = game.currentTurnSeat;
    if (!current?.isAI) throw new HttpsError('failed-precondition', '目前不是 AI 或離線接管座位的回合。');
    game = runAITurn(game);
    game = applySecurityRevision(game, { roomId, uid, seat: currentSeat, actionType: 'aiTurn' });
    const updates = {
      status: roomStatusForGame(game),
      game,
      updatedAt: FieldValue.serverTimestamp(),
      lastEvent: game.message
    };
    if (game.finished) {
      const totalScores = mergeSeriesTotals(room.totalScores || {}, game.results || [], game.players || [], Number(room.gameNo || 0));
      game.totalScores = totalScores;
      updates.game = game;
      updates.totalScores = totalScores;
      updates.lastEvent = `${game.message} 已由後端更新累計總分。`;
    }
    transaction.update(ref, updates);
    addActionLog(transaction, ref, { uid, seat: currentSeat, actionType: 'aiTurn', status: 'accepted', gameId: game.gameId, revision: game.security?.revision });
  });
  return { roomId, ok: true };
}));

export const syncPresence = onCall(async (request) => wrapCallable(async () => {
  const uid = requireAuth(request);
  const { roomId, ref } = roomRef(request.data?.roomId);
  const name = normalizePlayerName(request.data?.playerName, '玩家');
  let activeSeat = null;
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) return;
    const room = snap.data();
    const seat = findSeatForUid(room, uid);
    if (seat === null || seat === undefined) return;
    const seats = normalizeSeats(room.seats);
    seats[seat] = { ...seats[seat], name, connected: true, aiTakingOver: false, lastSeen: nowMs() };
    let game = room.game ? plainGame(room.game) : null;
    if (game?.players?.[seat]) {
      const player = game.players[seat];
      if (player?.isAI || player?.aiTakingOver || player?.connected === false || player.name !== name || player.uid !== uid) {
        game = restoreGameSeatFromReconnect(game, seat, { seat, name, uid, isAI: false, connected: true });
      }
    }
    transaction.update(ref, {
      seats: seatsToObject(seats),
      ...(game ? { game } : {}),
      presenceUpdatedAt: FieldValue.serverTimestamp()
    });
    activeSeat = seat;
  });
  return { roomId, seat: activeSeat };
}));

export const reconcilePresence = onCall(async (request) => wrapCallable(async () => {
  const uid = requireAuth(request);
  const { roomId, ref } = roomRef(request.data?.roomId);
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) return;
    const room = snap.data();
    assertRoomPlayer(room, uid);
    const seats = normalizeSeats(room.seats);
    const now = nowMs();
    let changed = false;
    const events = [];
    let game = room.game ? plainGame(room.game) : null;
    for (let seat = 0; seat < 4; seat += 1) {
      const seatData = seats[seat];
      if (seatData && !seatData.isAI && seatData.connected && isSeatStale(seatData, now, STALE_PLAYER_MS)) {
        seats[seat] = { ...seatData, connected: false, aiTakingOver: room.status === 'playing', disconnectedAt: now };
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
    const hostNeedsTransfer = hostSeat === null || !seats[hostSeat]?.connected || isSeatStale(seats[hostSeat], now, STALE_PLAYER_MS);
    if (hostNeedsTransfer) {
      const newHostSeat = findNextConnectedHumanSeat(seats, hostSeat ?? -1);
      if (newHostSeat !== null) {
        seats.forEach((seatData, index) => { if (seatData) seats[index] = { ...seatData, host: index === newHostSeat }; });
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
      ...(game ? { game } : {}),
      hostUid,
      hostName,
      updatedAt: FieldValue.serverTimestamp(),
      presenceUpdatedAt: FieldValue.serverTimestamp(),
      lastEvent: events[events.length - 1] || room.lastEvent || '已更新房間連線狀態。'
    });
    addActionLog(transaction, ref, { uid, actionType: 'reconcilePresence', status: 'accepted', note: events.join('；') });
  });
  return { roomId, ok: true };
}));

export const leaveRoom = onCall(async (request) => wrapCallable(async () => {
  const uid = requireAuth(request);
  const { roomId, ref } = roomRef(request.data?.roomId);
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) return;
    const room = snap.data();
    const currentSeat = findSeatForUid(room, uid);
    if (currentSeat === null || currentSeat === undefined) return;
    const seats = normalizeSeats(room.seats);
    const leavingName = seats[currentSeat]?.name || '玩家';
    let game = room.game ? plainGame(room.game) : null;
    if (room.status === 'playing' && game) {
      game = markGameSeatAsAITakeover(game, currentSeat, seats[currentSeat]);
      seats[currentSeat] = { ...seats[currentSeat], connected: false, aiTakingOver: true, disconnectedAt: nowMs() };
    } else {
      seats[currentSeat] = null;
    }
    let hostUid = room.hostUid;
    let hostName = room.hostName;
    if (room.hostUid === uid) {
      const newHostSeat = findNextConnectedHumanSeat(seats, currentSeat);
      if (newHostSeat !== null) {
        seats.forEach((seatData, index) => { if (seatData) seats[index] = { ...seatData, host: index === newHostSeat }; });
        hostUid = seats[newHostSeat].uid;
        hostName = seats[newHostSeat].name;
        if (game) game.hostUid = hostUid;
      }
    }
    transaction.update(ref, {
      seats: seatsToObject(seats),
      ...(game ? { game } : {}),
      hostUid,
      hostName,
      updatedAt: FieldValue.serverTimestamp(),
      presenceUpdatedAt: FieldValue.serverTimestamp(),
      lastEvent: room.status === 'playing' ? `${leavingName} 離線，由 AI 接管到本局結束。` : `${leavingName} 離開房間。`
    });
    addActionLog(transaction, ref, { uid, seat: currentSeat, actionType: 'leaveRoom', status: 'accepted' });
  });
  return { roomId, ok: true };
}));
