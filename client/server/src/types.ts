// ============================================================
// İstemci <-> Sunucu arasında konuşulan mesaj tipleri.
// client/src/types.ts dosyasındaki tiplerle bilinçli olarak birebir
// aynı tutulur (iki ayrı npm paketi olduğu için import paylaşılmıyor,
// ama şekiller senkron kalmalı).
// ============================================================

export interface PlayerState {
  id: string;
  name: string;
  x: number;
  z: number;
  ry: number;
  score: number;
  plateId?: string;
}

/**
 * Sık gönderilen (her tick) hafif konum paketi. PlayerState'in aksine
 * name/score/plateId TAŞIMAZ — bunlar tick başına değişmez, sadece
 * join/left anında 'players' ile bir kez gönderilir. Bant genişliğini
 * (özellikle çok oyunculu durumda O(n²) büyüyen trafiği) ciddi oranda
 * azaltmak için ayrıldı.
 */
export interface PlayerMove {
  id: string;
  x: number;
  z: number;
  ry: number;
}

export interface CoinState {
  x: number;
  z: number;
  endsAt: number;
}

// ---- İstemciden sunucuya ----
export type ClientMessage =
  | { type: 'join'; name: string; plateId?: string }
  | { type: 'move'; x: number; z: number; ry: number }
  | { type: 'ping'; t: number };

// ---- Sunucudan istemciye ----
export type ServerMessage =
  | { type: 'welcome'; id: string; arenaRadius: number; tickMs: number }
  | { type: 'players'; players: PlayerState[] }
  | { type: 'state'; players: PlayerMove[]; serverTime: number }
  | { type: 'coin'; coin: CoinState }
  | { type: 'caught'; id: string; name: string; score: number }
  | { type: 'joined'; id: string; name: string }
  | { type: 'left'; id: string; name: string }
  | { type: 'pong'; t: number };
