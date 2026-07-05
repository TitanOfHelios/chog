// ============================================================
// İkili (binary) ağ protokolü — İSTEMCİ tarafı
// Sunucudaki server/src/binary.ts ile birebir aynı düzeni kullanır.
// Ayrıntılı açıklama için o dosyadaki yorumlara bakın.
// ============================================================

export const MSG_MOVE = 1;
export const MSG_STATE = 2;

const MOVE_BYTE_LENGTH = 13;
const STATE_HEADER_LENGTH = 11;
const STATE_PLAYER_LENGTH = 14;

/** Yerel oyuncunun konum/rotasyonunu 13 byte'lık kompakt bir pakete kodlar. */
export function encodeMove(x: number, z: number, ry: number): ArrayBuffer {
  const buf = new ArrayBuffer(MOVE_BYTE_LENGTH);
  const view = new DataView(buf);
  view.setUint8(0, MSG_MOVE);
  view.setFloat32(1, x, true);
  view.setFloat32(5, z, true);
  view.setFloat32(9, ry, true);
  return buf;
}

export interface DecodedStatePlayer {
  id: string;
  x: number;
  z: number;
  ry: number;
}

export interface DecodedState {
  players: DecodedStatePlayer[];
  serverTime: number;
}

/** Sunucudan gelen ikili 'state' paketini çözer. Bozuksa null döner. */
export function decodeState(buf: ArrayBuffer): DecodedState | null {
  if (buf.byteLength < STATE_HEADER_LENGTH) return null;
  const view = new DataView(buf);
  if (view.getUint8(0) !== MSG_STATE) return null;
  const serverTime = view.getFloat64(1, true);
  const count = view.getUint16(9, true);
  const players: DecodedStatePlayer[] = [];
  let offset = STATE_HEADER_LENGTH;
  for (let i = 0; i < count; i++) {
    if (offset + STATE_PLAYER_LENGTH > buf.byteLength) break; // eksik/bozuk paket: elden geldiğince oku
    const numericId = view.getUint16(offset, true);
    const x = view.getFloat32(offset + 2, true);
    const z = view.getFloat32(offset + 6, true);
    const ry = view.getFloat32(offset + 10, true);
    players.push({ id: 'p' + numericId, x, z, ry });
    offset += STATE_PLAYER_LENGTH;
  }
  return { players, serverTime };
}
