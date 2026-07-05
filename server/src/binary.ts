// ============================================================
// İkili (binary) ağ protokolü
// ------------------------------------------------------------
// Her karede gönderilen 'move' (istemci -> sunucu) ve 'state'
// (sunucu -> istemci) paketleri, önceden JSON string olarak
// gidiyordu (örn. `{"type":"move","x":12.34,"z":-5.67,"ry":1.02}`,
// ~48+ byte, üstelik her tarafta JSON.parse/stringify maliyeti).
//
// Bunun yerine sabit uzunluklu, little-endian bir ArrayBuffer
// düzeni kullanıyoruz. Sonuç: 'move' paketi 13 byte'a, 'state'
// paketi oyuncu başına 14 byte'a iner (üstüne uWS'in kendi
// permessage-deflate sıkıştırması da binebilir). Metin tabanlı
// join/players/coin/caught/joined/left/ping/pong gibi SEYREK ve
// string alanlar taşıyan mesajlar JSON olarak kalır — asıl ağ
// trafiğini oluşturan yüksek frekanslı konum verisi burada.
//
// Bu dosyadaki düzen, client/src/net/binary.ts ile BİREBİR aynı
// tutulmalıdır (types.ts'teki JSON tipleri gibi, iki ayrı npm
// paketi olduğu için import paylaşılmıyor).
// ============================================================

export const MSG_MOVE = 1;
export const MSG_STATE = 2;

export const MOVE_BYTE_LENGTH = 13; // 1 (tip) + 4+4+4 (x,z,ry float32)
const STATE_HEADER_LENGTH = 11; // 1 (tip) + 8 (serverTime float64) + 2 (oyuncu sayısı uint16)
const STATE_PLAYER_LENGTH = 14; // 2 (numericId uint16) + 4+4+4 (x,z,ry float32)

export interface DecodedMove {
  x: number;
  z: number;
  ry: number;
}

/**
 * İstemciden gelen ikili 'move' paketini çözer.
 * Beklenen düzen: [uint8 tip=1][float32 x][float32 z][float32 ry]
 * Bozuk/eksik veri gelirse (kötü niyetli ya da kopuk paket) null döner.
 */
export function decodeMove(buf: ArrayBuffer): DecodedMove | null {
  if (buf.byteLength < MOVE_BYTE_LENGTH) return null;
  const view = new DataView(buf);
  if (view.getUint8(0) !== MSG_MOVE) return null;
  const x = view.getFloat32(1, true);
  const z = view.getFloat32(5, true);
  const ry = view.getFloat32(9, true);
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(ry)) return null;
  return { x, z, ry };
}

export interface StatePlayer {
  numericId: number;
  x: number;
  z: number;
  ry: number;
}

/**
 * Sunucudan tüm oyunculara yayınlanan 'state' paketini kodlar.
 * Düzen: [uint8 tip=2][float64 serverTime][uint16 n] + n * [uint16 id][float32 x][float32 z][float32 ry]
 */
export function encodeState(players: StatePlayer[], serverTime: number): ArrayBuffer {
  const buf = new ArrayBuffer(STATE_HEADER_LENGTH + players.length * STATE_PLAYER_LENGTH);
  const view = new DataView(buf);
  view.setUint8(0, MSG_STATE);
  view.setFloat64(1, serverTime, true);
  view.setUint16(9, players.length, true);
  let offset = STATE_HEADER_LENGTH;
  for (const p of players) {
    view.setUint16(offset, p.numericId, true);
    view.setFloat32(offset + 2, p.x, true);
    view.setFloat32(offset + 6, p.z, true);
    view.setFloat32(offset + 10, p.ry, true);
    offset += STATE_PLAYER_LENGTH;
  }
  return buf;
}

/** 'p123' biçimindeki oyuncu id'sini sayısal kısmına çevirir (uint16'ya sığmalı). */
export function idToNumeric(id: string): number | null {
  if (id.length < 2 || id[0] !== 'p') return null;
  const n = Number(id.slice(1));
  if (!Number.isFinite(n) || n < 0 || n > 0xffff) return null;
  return n;
}
