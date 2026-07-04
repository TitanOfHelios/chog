export type Lang = 'tr' | 'en';

type Dict = Record<string, string>;

const STRINGS: Record<Lang, Dict> = {
  tr: {
    loading: 'Sahne yükleniyor…',
    loginTitle: 'The 7 Seconds Chog',
    loginDesc: 'Tek oda — odaya giren herkes aynı alanda birlikte olur. İsmini yaz ve gir.',
    nameLabel: 'İsim',
    namePlaceholder: 'Adını yaz',
    joinBtn: 'Odaya Gir',
    connecting: 'Bağlanıyor…',
    nameRequired: 'Lütfen bir isim yaz.',
    connError: 'Bağlantı hatası. Sunucunun çalıştığından emin ol.',
    hudTitle: 'The 7 Seconds Chog · Joystick: Yürü · Sürükle: Bak · HIZLAN: Basılı Tut',
    coinLabel: 'Para: {s}s',
    scoreLabel: 'Skor:',
    leaderboardBtn: 'SIRALAMA',
    leaderboardTitle: 'Sıralama',
    sprintBtn: 'HIZLAN',
    jumpBtn: 'ZIPLA',
    latencyTitle: 'Sunucu gecikmesi',
    latencyTitleMs: 'Sunucu gecikmesi: {ms}ms',
    disconnectedTitle: 'Bağlantı koptu, yeniden bağlanılıyor…',
    caughtToastSelf: 'Sen parayı yakaladın! +1',
    caughtToastOther: '{name} parayı yakaladı! +1',
    sceneLoadError: 'Sahne yüklenemedi: {err}',
    plateLabel: 'İsim Plakası',
    plateNone: 'Plakasız',
    plateLoading: 'Plakalar yükleniyor…',
  },
  en: {
    loading: 'Loading scene…',
    loginTitle: 'The 7 Seconds Chog',
    loginDesc: 'Single room — everyone who joins shares the same space. Enter your name and jump in.',
    nameLabel: 'Name',
    namePlaceholder: 'Type your name',
    joinBtn: 'Join Room',
    connecting: 'Connecting…',
    nameRequired: 'Please enter a name.',
    connError: 'Connection error. Make sure the server is running.',
    hudTitle: 'The 7 Seconds Chog · Joystick: Move · Drag: Look · SPRINT: Hold',
    coinLabel: 'Coin: {s}s',
    scoreLabel: 'Score:',
    leaderboardBtn: 'RANKING',
    leaderboardTitle: 'Leaderboard',
    sprintBtn: 'SPRINT',
    jumpBtn: 'JUMP',
    latencyTitle: 'Server latency',
    latencyTitleMs: 'Server latency: {ms}ms',
    disconnectedTitle: 'Connection lost, reconnecting…',
    caughtToastSelf: 'You caught the coin! +1',
    caughtToastOther: '{name} caught the coin! +1',
    sceneLoadError: 'Failed to load scene: {err}',
    plateLabel: 'Name Plate',
    plateNone: 'No plate',
    plateLoading: 'Loading plates…',
  },
};

const STORAGE_KEY = 'chog_lang';

function detectInitialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'tr' || saved === 'en') return saved;
  } catch {
    // localStorage kapalı/erişilemez olabilir (gizli sekme vb.) — sorun değil.
  }
  const nav = (navigator.language || 'tr').toLowerCase();
  return nav.startsWith('tr') ? 'tr' : 'en';
}

let currentLang: Lang = detectInitialLang();
const listeners: Array<(lang: Lang) => void> = [];

function applyDocumentLang(lang: Lang): void {
  try {
    document.documentElement.lang = lang;
  } catch {
    // SSR/test ortamında document olmayabilir — sorun değil.
  }
}
applyDocumentLang(currentLang);

export function getLang(): Lang {
  return currentLang;
}

export function setLang(lang: Lang): void {
  if (lang === currentLang) return;
  currentLang = lang;
  applyDocumentLang(lang);
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // yoksayılabilir
  }
  for (const cb of listeners) cb(lang);
}

export function onLangChange(cb: (lang: Lang) => void): void {
  listeners.push(cb);
}

/** Çeviri anahtarını çözer; {param} şeklindeki yer tutucuları değiştirir. */
export function t(key: string, params?: Record<string, string | number>): string {
  let str = STRINGS[currentLang][key] ?? STRINGS.tr[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.split(`{${k}}`).join(String(v));
    }
  }
  return str;
}
