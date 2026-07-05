// Vite, kök dizindeki tek .env dosyasındaki VITE_ ile başlayan
// değişkenleri import.meta.env üzerinden derleme zamanında enjekte eder
// (bkz. vite.config.ts -> envDir: '../'). Tüm ayarlanabilir değerler
// TEK BİR YERDE (proje kökündeki .env) toplanır; kodun içine dağılmış
// "sihirli sayı" yoktur — bir şeyi değiştirmek için sadece .env'i
// düzenleyip sunucuyu/vite'ı yeniden başlatmanız yeterlidir.

function num(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && raw !== undefined && raw !== '' ? n : fallback;
}

export const CONFIG = {
  // ---------- Sunucu adresi ----------
  DEFAULT_WS_URL: (import.meta.env.VITE_WS_URL as string | undefined) || 'ws://localhost:8080',

  // ---------- 3D model dosya yolları ----------
  CHARACTER_MODEL_PATH: (import.meta.env.VITE_CHARACTER_MODEL_PATH as string | undefined) || '/assets/character.glb',
  COIN_MODEL_PATH: (import.meta.env.VITE_COIN_MODEL_PATH as string | undefined) || '/assets/coin.glb',
  // İsim plakası TEK dosya değil, bu KLASÖRDEKİ manifest.json'da listelenen
  // birden çok .glb dosyasından oluşur (login ekranında seçilebilir).
  PLATE_FOLDER: (import.meta.env.VITE_PLATE_FOLDER as string | undefined) || '/assets/plate/',

  // ---------- Boyut ayarları ----------
  CHARACTER_HEIGHT: num(import.meta.env.VITE_CHARACTER_HEIGHT, 1.3),
  COIN_HEIGHT: num(import.meta.env.VITE_COIN_HEIGHT, 0.55),
  PLATE_MIN_WIDTH: num(import.meta.env.VITE_PLATE_MIN_WIDTH, 1.1),
  PLATE_MAX_WIDTH: num(import.meta.env.VITE_PLATE_MAX_WIDTH, 3.4),
  PLATE_WIDTH_PER_CHAR: num(import.meta.env.VITE_PLATE_WIDTH_PER_CHAR, 0.16),

  // ---------- Hareket / fizik ----------
  MOVE_SPEED: num(import.meta.env.VITE_MOVE_SPEED, 4.2),
  TURN_SPEED: num(import.meta.env.VITE_TURN_SPEED, 3.0),
  JUMP_VELOCITY: num(import.meta.env.VITE_JUMP_VELOCITY, 6.2),
  GRAVITY: num(import.meta.env.VITE_GRAVITY, -16),
  SPRINT_MAX_MULT: num(import.meta.env.VITE_SPRINT_MAX_MULT, 2.8),
  SPRINT_RAMP_TIME: num(import.meta.env.VITE_SPRINT_RAMP_TIME, 2.0),
  SPRINT_DECAY_RATE: num(import.meta.env.VITE_SPRINT_DECAY_RATE, 1.6),

  // ---------- Kamera ----------
  CAMERA_DISTANCE: num(import.meta.env.VITE_CAMERA_DISTANCE, 7),
  CAMERA_DISTANCE_MIN: num(import.meta.env.VITE_CAMERA_DISTANCE_MIN, 3),
  CAMERA_DISTANCE_MAX: num(import.meta.env.VITE_CAMERA_DISTANCE_MAX, 16),
  CAMERA_PITCH: num(import.meta.env.VITE_CAMERA_PITCH, 0.38),

  // ---------- Joystick ----------
  JOYSTICK_DEADZONE: num(import.meta.env.VITE_JOYSTICK_DEADZONE, 0.1),

  // ---------- Ortadaki heykel(ler) (client/public/assets içinden .glb) ----------
  STATUE_ENABLED: (import.meta.env.VITE_STATUE_ENABLED as string | undefined) !== 'false',
  // .glb dosyaları bulunamaz/bozuksa otomatik olarak basit/renksiz bir
  // yedek heykele geri dönülür (hiçbir şey çökmez).
  STATUE_COLOR: (import.meta.env.VITE_STATUE_COLOR as string | undefined) || '#b7b3ad',
  STATUE_SCALE: num(import.meta.env.VITE_STATUE_SCALE, 1),
  STATUE_HEIGHT: num(import.meta.env.VITE_STATUE_HEIGHT, 2.3),
  STATUE_MODEL_PATH: (import.meta.env.VITE_STATUE_MODEL_PATH as string | undefined) || '/assets/statue.glb',
  // İkinci (ilkinin yanındaki) heykel — ayrı bir .glb ve ayrı bir konum.
  STATUE2_MODEL_PATH: (import.meta.env.VITE_STATUE2_MODEL_PATH as string | undefined) || '/assets/statue2.glb',
  STATUE2_OFFSET_X: num(import.meta.env.VITE_STATUE2_OFFSET_X, 3.2),
  STATUE2_OFFSET_Z: num(import.meta.env.VITE_STATUE2_OFFSET_Z, 0),

  // ---------- Heykel kaidesi (basit sütun, .glb gerektirmez) ----------
  STATUE_PEDESTAL_ENABLED: (import.meta.env.VITE_STATUE_PEDESTAL_ENABLED as string | undefined) !== 'false',
  STATUE_PEDESTAL_HEIGHT: num(import.meta.env.VITE_STATUE_PEDESTAL_HEIGHT, 0.9),
  STATUE_PEDESTAL_RADIUS: num(import.meta.env.VITE_STATUE_PEDESTAL_RADIUS, 0.4),
  STATUE_PEDESTAL_COLOR: (import.meta.env.VITE_STATUE_PEDESTAL_COLOR as string | undefined) || '#9a958c',

  // ---------- Credit / yapımcı bilgisi (giriş ekranında gösterilir) ----------
  CREDITS_TEXT: (import.meta.env.VITE_CREDITS_TEXT as string | undefined) || '',
  CREDITS_URL: (import.meta.env.VITE_CREDITS_URL as string | undefined) || '',
};
