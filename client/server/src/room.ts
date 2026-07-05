import type { WebSocket } from 'ws';
import type { CoinState, PlayerMove, PlayerState, ServerMessage } from './types.js';

interface Connection {
  ws: WebSocket;
  name: string;
  plateId?: string;
  x: number;
  z: number;
  ry: number;
  score: number;
  isAlive: boolean;
  joinedAt: number;
}

export interface RoomConfig {
  arenaRadius: number;
  coinCycleMs: number;
  tickMs: number;
  catchRadius: number;
}

/**
 * Tek odalı oyunu yöneten sınıf. Oyuncu bağlantıları, skor ve para
 * döngüsü burada yaşar. "Daha iyi multiplayer" için:
 *  - Tutarlı, tipli mesajlaşma (types.ts)
 *  - Sunucu zaman damgası (serverTime) ile istemci taraflı gecikme telafisi
 *  - join/left olayları (yeni oyuncu/ayrılan oyuncu bildirimleri)
 *  - Geçersiz/aşırı hızlı hareket paketlerine karşı basit doğrulama
 *  - Her tick'te tam liste yerine hazır olduğunda hedeflenmiş yayın
 */
export class Room {
  private players = new Map<string, Connection>();
  private nextId = 1;
  private coin: CoinState = { x: 0, z: 0, endsAt: 0 };
  private coinTimer: NodeJS.Timeout | null = null;
  private tickTimer: NodeJS.Timeout | null = null;
  // "Better multiplayer" optimizasyonu: bir önceki tick'ten bu yana
  // gerçekten hareket eden/katılan biri olmadıysa tick'te hiçbir şey
  // hesaplamıyoruz/yayınlamıyoruz (boş oda ya da herkes duruyorsa CPU
  // ve ağ trafiği sıfıra iner).
  private dirty = false;

  constructor(private cfg: RoomConfig) {}

  start(): void {
    this.spawnCoin();
    this.tickTimer = setInterval(() => this.tick(), this.cfg.tickMs);
  }

  stop(): void {
    if (this.coinTimer) clearTimeout(this.coinTimer);
    if (this.tickTimer) clearInterval(this.tickTimer);
  }

  private randomPoint(): { x: number; z: number } {
    const ang = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * this.cfg.arenaRadius;
    return { x: Math.cos(ang) * r, z: Math.sin(ang) * r };
  }

  private clamp(v: unknown, min: number, max: number): number {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(min, Math.min(max, n));
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }

  private broadcast(msg: ServerMessage, except?: string): void {
    const payload = JSON.stringify(msg);
    for (const [id, p] of this.players) {
      if (id === except) continue;
      if (p.ws.readyState === p.ws.OPEN) p.ws.send(payload);
    }
  }

  private playerList(): PlayerState[] {
    return Array.from(this.players.entries()).map(([id, p]) => ({
      id,
      name: p.name,
      x: p.x,
      z: p.z,
      ry: p.ry,
      score: p.score,
      plateId: p.plateId,
    }));
  }

  /** Sık yayınlanan tick paketi için: sadece konum alanları, isim/skor/plaka YOK. */
  private playerMoveList(): PlayerMove[] {
    return Array.from(this.players.entries()).map(([id, p]) => ({ id, x: p.x, z: p.z, ry: p.ry }));
  }

  private spawnCoin(): void {
    if (this.coinTimer) clearTimeout(this.coinTimer);
    const p = this.randomPoint();
    this.coin = { x: p.x, z: p.z, endsAt: Date.now() + this.cfg.coinCycleMs };
    this.broadcast({ type: 'coin', coin: this.coin });
    this.coinTimer = setTimeout(() => this.spawnCoin(), this.cfg.coinCycleMs);
  }

  /** Yeni bir WebSocket bağlantısını odaya bağlar. */
  handleConnection(ws: WebSocket): void {
    const id = 'p' + this.nextId++;
    let joined = false;

    const heartbeatOnPong = () => {
      const conn = this.players.get(id);
      if (conn) conn.isAlive = true;
    };
    ws.on('pong', heartbeatOnPong);

    ws.on('message', (raw: Buffer) => {
      let msg: unknown;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (typeof msg !== 'object' || msg === null || !('type' in msg)) return;
      const m = msg as { type: string; [k: string]: unknown };

      if (m.type === 'join' && !joined) {
        const rawName = typeof m.name === 'string' ? m.name : 'Oyuncu';
        const name = rawName.trim().slice(0, 16) || 'Oyuncu';
        const plateId =
          typeof m.plateId === 'string' && m.plateId.trim() ? m.plateId.trim().slice(0, 40) : undefined;
        const spawn = this.randomPoint();
        this.players.set(id, {
          ws,
          name,
          plateId,
          x: spawn.x,
          z: spawn.z,
          ry: 0,
          score: 0,
          isAlive: true,
          joinedAt: Date.now(),
        });
        joined = true;
        this.send(ws, { type: 'welcome', id, arenaRadius: this.cfg.arenaRadius, tickMs: this.cfg.tickMs });
        this.send(ws, { type: 'coin', coin: this.coin });
        this.broadcast({ type: 'players', players: this.playerList() });
        this.broadcast({ type: 'joined', id, name }, id);
        return;
      }

      if (!joined) return;

      if (m.type === 'move') {
        const p = this.players.get(id);
        if (!p) return;
        const limit = this.cfg.arenaRadius + 15; // ada modelinde biraz pay bırak
        p.x = this.clamp(m.x, -limit, limit);
        p.z = this.clamp(m.z, -limit, limit);
        p.ry = Number(m.ry) || 0;
        this.dirty = true;
      } else if (m.type === 'ping') {
        this.send(ws, { type: 'pong', t: Number(m.t) || 0 });
      }
    });

    ws.on('close', () => {
      const p = this.players.get(id);
      this.players.delete(id);
      if (p) this.broadcast({ type: 'left', id, name: p.name });
      this.broadcast({ type: 'players', players: this.playerList() });
    });

    ws.on('error', () => {
      /* close olayı zaten temizliği yapacak */
    });
  }

  /** Ölü (yanıt vermeyen) bağlantıları temizler. HEARTBEAT_MS aralığıyla dışarıdan çağrılır. */
  pruneDeadConnections(): void {
    for (const [id, p] of this.players) {
      if (!p.isAlive) {
        p.ws.terminate();
        this.players.delete(id);
        this.broadcast({ type: 'left', id, name: p.name });
        this.broadcast({ type: 'players', players: this.playerList() });
        continue;
      }
      p.isAlive = false;
      if (p.ws.readyState === p.ws.OPEN) p.ws.ping();
    }
  }

  private tick(): void {
    // Kimse hareket etmediyse (oda boş ya da herkes duruyor) bu tick'te
    // hiçbir şey hesaplama/yayınlama — yakalama kontrolü de dahil, çünkü
    // pozisyonlar değişmediyse sonuç da değişemez. Boşta CPU/ağ maliyeti
    // sıfıra iner.
    if (this.players.size === 0 || !this.dirty) return;
    this.dirty = false;

    for (const [id, p] of this.players) {
      const dx = p.x - this.coin.x;
      const dz = p.z - this.coin.z;
      if (dx * dx + dz * dz <= this.cfg.catchRadius * this.cfg.catchRadius) {
        p.score += 1;
        this.broadcast({ type: 'caught', id, name: p.name, score: p.score });
        this.spawnCoin();
        break; // bu tick'te sadece ilk yakalayan sayılır
      }
    }

    // 'state' artık SADECE konum alanlarını taşır (id,x,z,ry) — isim,
    // skor, plaka ve para bitiş zamanı burada tekrar tekrar gönderilmez
    // (skor 'caught' ile, isim/plaka 'players' ile, para süresi zaten
    // istemcide yerel olarak sayılıyor). Bu, oyuncu sayısı arttıkça
    // O(n²) büyüyen tick trafiğini ciddi oranda küçültür.
    this.broadcast({
      type: 'state',
      players: this.playerMoveList(),
      serverTime: Date.now(),
    });
  }

  get playerCount(): number {
    return this.players.size;
  }
}
