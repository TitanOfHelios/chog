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
import { networkInterfaces } from 'os';
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
//
// host: '0.0.0.0' AÇIKÇA belirtiliyor — bazı Android/Termux kurulumlarında
// host verilmezse sunucu beklenenden farklı bir arayüze bağlanabiliyor ve
// aynı ağdaki başka bir cihaz (2. oyuncu) bağlanamıyor, oysa aynı cihazdan
// (localhost) her zaman çalışıyor gibi görünüyor. 0.0.0.0 = tüm ağ
// arayüzlerinden gelen bağlantıları kabul et.
const wss = new WebSocketServer({
  port: PORT,
  host: '0.0.0.0',
  perMessageDeflate: {
    threshold: 256,
  },
});
wss.on('connection', (ws) => room.handleConnection(ws));

// Kopan bağlantıları düzenli aralıklarla temizle (better multiplayer:
// tarayıcı sekmesi kapanmadan ağ kesilirse bile odanın şişmesini önler)
const heartbeat = setInterval(() => room.pruneDeadConnections(), HEARTBEAT_MS);
wss.on('close', () => clearInterval(heartbeat));

console.log(`3D Çim Alanı sunucusu çalışıyor -> ws://0.0.0.0:${PORT} (tüm arayüzler)`);
console.log(`Arena yarıçapı: ${ARENA_RADIUS} | Para döngüsü: ${COIN_CYCLE_MS}ms | Tick: ${TICK_MS}ms`);

// Aynı ağdaki başka bir cihazdan (2. oyuncu) bağlanırken hangi IP'yi
// kullanması gerektiğini görmesi için: makinedeki TÜM LAN IP'lerini
// yazdırıyoruz. .env'deki VITE_WS_URL bunlardan biriyle EŞLEŞMİYORSA
// (ör. telefon hem Wi-Fi'ye hem hotspot'a bağlıysa iki farklı IP olabilir)
// ikinci oyuncu asla bağlanamaz — bu listeden doğru olanı .env'e yazın.
const nets = networkInterfaces();
console.log('Bu makinedeki LAN IP\'leri (2. oyuncunun .env\'deki VITE_WS_URL için kullanması gerekenler):');
for (const [name, addrs] of Object.entries(nets)) {
  for (const addr of addrs ?? []) {
    if (addr.family === 'IPv4' && !addr.internal) {
      console.log(`  ${name}: ws://${addr.address}:${PORT}`);
    }
  }
}

process.on('SIGINT', () => {
  console.log('\nSunucu kapatılıyor...');
  room.stop();
  wss.close(() => process.exit(0));
});
