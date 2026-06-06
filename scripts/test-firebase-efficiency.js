import fs from 'node:fs';
const room=fs.readFileSync(new URL('../src/firebase-room.js',import.meta.url),'utf8');
for (const token of ['HIDDEN_HEARTBEAT_INTERVAL_MS = 75000','ROOM_LIST_CACHE_TTL_MS = 15000','roomDirectoryCache','roomListCacheHits','schedulePresenceHeartbeat','stopPresenceTimers','listenerStops','skippedPlaying','skippedRecent']) if(!room.includes(token)) throw new Error(`Firebase 效能保護缺少：${token}`);
console.log('Firebase efficiency protection tests passed.');
