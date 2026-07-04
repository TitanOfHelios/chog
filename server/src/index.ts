// ============================================================
// 3D Çim Alanı - Tek Oda Multiplayer Sunucusu (TypeScript)
// Çalıştırma (kök klasörden):
//   npm run dev        -> hem server hem client birlikte çalışır
// Sadece bu klasörden:
//   npm run dev
// ============================================================
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { WebSocketServer } from 'ws';
import { Room } from './room.js';

// Tek .env dosyası proje kökünde (server/'ın bir üstünde) yaşar.
// server/src/index.ts -> ../../.env  (src -> server -> kök)
// (derlenmiş server/dist/index.js için de aynı derinlik geçerlidir.)
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

const PORT = Number(process.env.PORT) || 8080;
const ARENA_RADIUS = Number(process.env.ARENA_RADIUS) || 85;
const COIN_CYCLE_MS = Number(process.env.COIN_CYCLE_MS) || 7000;
const TICK_MS = Number(process.env.TICK_MS) || 100;
const HEARTBEAT_MS = Number(process.env.HEARTBEAT_MS) || 15000;
const CATCH_RADIUS = 1.6;

const room = new Room({
  arenaRadius: ARENA_RADIUS,
  coinCycleMs: COIN_CYCLE_MS,
  tickMs: TICK_MS,
  catchRadius: CATCH_RADIUS,
});
room.start();

// perMessageDeflate: JSON metin mesajlarını (özellikle tekrarlayan
// 'state'/'players' paketlerini) sıkıştırarak ağ trafiğini düşürür.
// threshold, çok küçük mesajları (ör. tek oyunculu 'move') boşuna
// sıkıştırmaya çalışıp CPU harcamamak için bir alt sınır koyar.
const wss = new WebSocketServer({
  port: PORT,
  perMessageDeflate: {
    threshold: 256,
  },
});
wss.on('connection', (ws) => room.handleConnection(ws));

// Kopan bağlantıları düzenli aralıklarla temizle (better multiplayer:
// tarayıcı sekmesi kapanmadan ağ kesilirse bile odanın şişmesini önler)
const heartbeat = setInterval(() => room.pruneDeadConnections(), HEARTBEAT_MS);
wss.on('close', () => clearInterval(heartbeat));

console.log(`3D Çim Alanı sunucusu çalışıyor -> ws://localhost:${PORT}`);
console.log(`Arena yarıçapı: ${ARENA_RADIUS} | Para döngüsü: ${COIN_CYCLE_MS}ms | Tick: ${TICK_MS}ms`);

process.on('SIGINT', () => {
  console.log('\nSunucu kapatılıyor...');
  room.stop();
  wss.close(() => process.exit(0));
});
