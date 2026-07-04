// ============================================================
// 3D Çim Alanı - Tek Oda Multiplayer Sunucusu
// ------------------------------------------------------------
// Çalıştırma:
//   cd server
//   npm install
//   npm start
// Sunucu varsayılan olarak 8080 portunda WebSocket ile dinler.
// ============================================================

const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

const ARENA_RADIUS = 85;   // hareket alanının yarıçapı (istemcideki alanla eşleşir)
const CATCH_RADIUS = 1.6;  // karakterin paraya ne kadar yaklaşınca yakalamış sayılacağı
const CYCLE_MS = 7000;     // her para için verilen süre (7 saniye)
const TICK_MS = 120;       // sunucunun durum yayınlama sıklığı

let players = new Map();   // id -> { ws, name, x, z, ry, score }
let nextId = 1;
let coin = { x: 0, z: 0, endsAt: 0 };
let coinTimer = null;

function randomPoint() {
  const ang = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * ARENA_RADIUS;
  return { x: Math.cos(ang) * r, z: Math.sin(ang) * r };
}

function clampNum(v, min, max) {
  v = Number(v) || 0;
  return Math.max(min, Math.min(max, v));
}

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const p of players.values()) {
    if (p.ws.readyState === WebSocket.OPEN) p.ws.send(msg);
  }
}

function playerList() {
  return Array.from(players.entries()).map(([id, p]) => ({
    id, name: p.name, x: p.x, z: p.z, ry: p.ry, score: p.score
  }));
}

function spawnCoin() {
  if (coinTimer) clearTimeout(coinTimer);
  const p = randomPoint();
  coin = { x: p.x, z: p.z, endsAt: Date.now() + CYCLE_MS };
  broadcast({ type: 'coin', coin });
  // 7 saniye içinde kimse alamazsa: puan verilmez, para tekrar rastgele yerde doğar
  coinTimer = setTimeout(spawnCoin, CYCLE_MS);
}

wss.on('connection', (ws) => {
  const id = 'p' + (nextId++);
  let joined = false;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    if (msg.type === 'join' && !joined) {
      const name = (msg.name || 'Oyuncu').toString().trim().slice(0, 16) || 'Oyuncu';
      const spawn = randomPoint();
      players.set(id, { ws, name, x: spawn.x, z: spawn.z, ry: 0, score: 0 });
      joined = true;
      ws.send(JSON.stringify({ type: 'welcome', id, arenaRadius: ARENA_RADIUS }));
      ws.send(JSON.stringify({ type: 'coin', coin }));
      broadcast({ type: 'players', players: playerList() });
      return;
    }

    if (!joined) return;

    if (msg.type === 'move') {
      const p = players.get(id);
      if (!p) return;
      p.x = clampNum(msg.x, -ARENA_RADIUS - 5, ARENA_RADIUS + 5);
      p.z = clampNum(msg.z, -ARENA_RADIUS - 5, ARENA_RADIUS + 5);
      p.ry = Number(msg.ry) || 0;
    }
  });

  ws.on('close', () => {
    players.delete(id);
    broadcast({ type: 'players', players: playerList() });
  });
});

// Para yakalama kontrolü + durum yayını
setInterval(() => {
  if (players.size === 0) return;

  for (const [id, p] of players) {
    const dx = p.x - coin.x, dz = p.z - coin.z;
    if (dx * dx + dz * dz <= CATCH_RADIUS * CATCH_RADIUS) {
      p.score += 1;
      broadcast({ type: 'caught', id, name: p.name, score: p.score });
      spawnCoin();
      break; // bu tick'te sadece ilk yakalayan sayılır
    }
  }

  broadcast({ type: 'state', players: playerList(), coinEndsAt: coin.endsAt });
}, TICK_MS);

spawnCoin();

console.log('3D Çim Alanı sunucusu calisiyor -> ws://localhost:' + PORT);
