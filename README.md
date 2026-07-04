# The 7 Seconds Chog — TypeScript Multiplayer

Tek odalı, herkesin aynı anda aynı alanda gezindiği 3D bir oyun. Tek
komutla hem sunucuyu hem istemciyi birlikte çalıştırır.

## Neler var (v4)

- **Tek komutla çalıştırma**: kökten `npm run dev` hem server'ı hem client'ı
  aynı anda başlatır (`concurrently`).
- **TypeScript**: hem `server/` hem `client/` tamamen TS.
- **TEK .env dosyası**: sunucu portu, arena ayarları, WebSocket adresi,
  3D model dosya yolları, karakter/para/plaka boyutları, hareket hızı,
  kamera ve joystick ayarları — hepsi kök dizindeki **tek bir `.env`**
  dosyasından okunur. Bir şeyi değiştirmek için kod içine girmeye gerek
  yok, sadece `.env`'i düzenleyip yeniden başlatın. Giriş ekranında
  `ws://` adresi **gösterilmez/istenmez** — otomatik olarak `.env`'den
  alınır.
- **Yürüme animasyonu yok**: karakter sallanmıyor/zıplamıyor; sadece konum
  ve yön değişiyor. Modeliniz GLB dosyasındaki **orijinal görünümüyle**
  sabit kalır.
- **Basit, kütüphanesiz joystick**: dışarıdan hiçbir paket kullanmayan,
  doğrudan dokunmatik/fare olaylarıyla çalışan sade bir sanal joystick.
  Davranışı tamamen düz: sağa iterseniz karakter dünyada sağa, ileri
  iterseniz ileri, geri iterseniz geri gider — joystick kamerayı
  döndürmez, sadece yürütür. Kamerayı çevirmek için ekranı sürükleyin.
  Klavyede W/S ile ileri/geri, A/D ile kamerayı (ve karakteri) döndürme
  eskisi gibi çalışmaya devam eder.
- **Kademeli hızlanma**: HIZLAN'ı basılı tuttukça hız kademeli olarak
  artar (~2 saniyede maksimuma ulaşır), bırakınca yumuşakça normale döner.
- **Üç özel model**: `character.glb` (oyuncu), `coin.glb` (para) ve
  `island.glb` (ada/zemin). Hiçbiri yoksa oyun basit yer tutucularla
  (mor kapsül/küre, prosedürel zemin — artık çim/otlar yok) sorunsuz
  çalışır.
- **Seçilebilir isim plakaları**: `client/public/assets/plate/` klasörüne
  istediğiniz kadar `.glb` plaka modeli koyup `manifest.json`'a
  ekleyin — giriş ekranında küçük önizleme kartlarıyla otomatik olarak
  seçilebilir hale gelirler. Seçtiğiniz plaka hem kendi karakterinizde
  hem diğer oyunculara iletilerek onlarda da görünür — herkes aynı
  plakayı görür. Her plakaya, dünyanın güneş açısından bağımsız her
  zaman okunaklı kalması için hafif bir ışık asılıdır. Plakanın
  genişliği **isme göre otomatik uzar/kısalır** (kısa isimlerde daralır,
  uzun isimlerde genişler); yükseklik/derinlik oranı bozulmaz. Hiç plaka
  eklenmemişse seçim ekranı görünmez, isimler sade yazı etiketiyle
  gösterilir.
- **Ortadaki heykel**: haritanın merkezinde `.glb` gerektirmeyen, kasıtlı
  olarak renksiz/sade basit bir taş heykel durur (`VITE_STATUE_*` ile
  açılıp kapatılabilir, rengi/boyu ayarlanabilir).
- **Credit alanı**: `VITE_CREDITS_TEXT` (ve isteğe bağlı `VITE_CREDITS_URL`)
  doldurulursa giriş ekranının altında küçük bir yapımcı notu belirir;
  boşsa hiç görünmez.
- **Mor arayüz**: Giriş ekranı, HUD, para süresi çubuğu vb. mor temalıdır.
- **Multiplayer**: otomatik yeniden bağlanma, ping göstergesi,
  katılma/ayrılma, sunucuda heartbeat, mesaj doğrulama.

## Kurulum

```bash
npm install
```

Bu tek komut kök, `server/` ve `client/` bağımlılıklarının hepsini kurar
(`postinstall` scripti sayesinde).

Sonra **tek `.env` dosyasını** oluşturun (proje kökünde, `server/` ve
`client/` klasörlerinin YANINDA — içlerinde değil):

```bash
cp .env.example .env
```

## Çalıştırma (tek komut)

```bash
npm run dev
```

- Sunucu: `ws://localhost:8080` (ya da `.env`'deki `PORT`)
- İstemci: `http://localhost:3000`

Tarayıcıda `http://localhost:3000` adresini açın, isim yazın ve **Odaya
Gir**'e basın. Sunucu adresi kökteki `.env` içindeki `VITE_WS_URL`
değerinden otomatik okunur; giriş ekranında ayrıca gösterilmez.

`.env`'i her değiştirdiğinizde `npm run dev`'i durdurup yeniden
başlatmanız gerekir (hem Vite hem Node sadece açılışta okur).

## Tek `.env` dosyası — her şey burada

Eskiden `server/.env` ve `client/.env` diye iki ayrı dosya vardı, artık
**tek dosya** (proje kökünde `.env`) her ikisini de besliyor. İsim
önünde `VITE_` olanlar tarayıcıya (istemciye), olmayanlar sadece
sunucuya gider. Tam liste ve açıklamalar için kökteki **`.env.example`**
dosyasına bakın; başlıca gruplar:

```bash
# Sunucu
PORT=8080
ARENA_RADIUS=85
COIN_CYCLE_MS=7000
TICK_MS=100
HEARTBEAT_MS=15000

# İstemci: sunucu adresi
VITE_WS_URL=ws://localhost:8080   # telefondan test ediyorsanız LAN IP'nizi yazın

# İstemci: 3D model dosya yolları
VITE_CHARACTER_MODEL_PATH=/assets/character.glb
VITE_COIN_MODEL_PATH=/assets/coin.glb
VITE_ISLAND_MODEL_PATH=/assets/island.glb
VITE_PLATE_FOLDER=/assets/plate/   # klasördeki manifest.json'da listelenen plakalar

# İstemci: boyutlar
VITE_CHARACTER_HEIGHT=1.3
VITE_COIN_HEIGHT=0.55
VITE_PLATE_MIN_WIDTH=1.1
VITE_PLATE_MAX_WIDTH=3.4
VITE_PLATE_WIDTH_PER_CHAR=0.16

# İstemci: hareket / fizik
VITE_MOVE_SPEED=4.2
VITE_TURN_SPEED=3.0
VITE_JUMP_VELOCITY=6.2
VITE_GRAVITY=-16
VITE_SPRINT_MAX_MULT=2.8
VITE_SPRINT_RAMP_TIME=2.0
VITE_SPRINT_DECAY_RATE=1.6

# İstemci: kamera
VITE_CAMERA_DISTANCE=7
VITE_CAMERA_DISTANCE_MIN=3
VITE_CAMERA_DISTANCE_MAX=16
VITE_CAMERA_PITCH=0.38

# İstemci: joystick
VITE_JOYSTICK_DEADZONE=0.1
```

`VITE_WS_URL`, istemcinin bağlanacağı WebSocket adresidir (ör. sunucuyu
Render/Railway gibi bir servise yükledikten sonra oradaki `wss://...`
adresini buraya yazıp yeniden build alın). Giriş ekranında bu adres için
ayrı bir kutu **yoktur** — build zamanında otomatik enjekte edilir.

## Kendi 3D modelleriniz

Varsayılan olarak tüm modeller `client/public/assets/` klasörüne konur
ve **otomatik** algılanır (dosya yoksa oyun sorunsuz şekilde yer
tutucuya/prosedürele geri döner). Dosya adını/klasörünü değiştirmek
isterseniz kod yerine `.env`'deki `VITE_..._MODEL_PATH` değerini
güncellemeniz yeterlidir:

| Dosya (varsayılan yol) | Ne işe yarar | Yoksa ne olur |
|---|---|---|
| `client/public/assets/character.glb` | Oyuncu karakteri | Basit mor kapsül yer tutucu |
| `client/public/assets/coin.glb` | Toplanacak para | Basit mor küre yer tutucu |
| `client/public/assets/island.glb` | Oyun dünyası/zemin | Dalgalı prosedürel zemin |
| `client/public/assets/plate/*.glb` + `manifest.json` | Seçilebilir isim plakaları | Sade metin etiketi (seçim ekranı da görünmez) |

### İsim plakası ekleme (birden çok, seçilebilir)

`plate.glb` artık tek bir dosya değil — `client/public/assets/plate/`
klasörüne istediğiniz kadar `.glb` koyup aynı klasördeki
`manifest.json`'a kaydedersiniz:

```json
[
  { "id": "neon", "file": "neon.glb", "label": "Neon" },
  { "id": "ahsap", "file": "ahsap.glb", "label": "Ahşap Tabela" }
]
```

Giriş ekranında her biri küçük bir 3D önizleme kartı olarak görünür,
oyuncu birini seçer (ya da "Plakasız" der), seçimi sunucuya iletilir ve
diğer oyuncular da aynı plakayı görür. `manifest.json` boş (`[]`)
kalırsa seçim alanı hiç görünmez — hiçbir şey bozulmaz. Ayrıntılı format
için `client/public/assets/plate/README.md` dosyasına bakın.

`character.glb` zaten yüklü modelinizle birlikte geldi (~34 MB, Draco
sıkıştırmalı). Boyunu `.env` içindeki `VITE_CHARACTER_HEIGHT`
(varsayılan 1.3 birim) ile ayarlayabilirsiniz; model otomatik ölçeklenir,
tabanı yere oturtulur ve ortalanır — **hiçbir deformasyon veya animasyon
uygulanmaz**, modeliniz tasarladığınız gibi görünür.

### Kendi adanızı eklemek

1. Blender / başka bir araçtan dışa aktardığınız `island.glb` dosyasını
   `client/public/assets/island.glb` olarak koyun.
2. Oyunu yeniden başlatın (`npm run dev`).
3. Karakter artık adanın **gerçek yüzeyinde** yürür (her x/z noktası için
   yukarıdan aşağı ışın atılarak yükseklik bulunur). Adanın dışına
   çıkamaz — model nereye kadar mesh varsa oraya kadar gidilebilir, yapay
   bir çember sınırı yoktur. Ters normal/ters yüz sarımı olan modellerde
   bile raycast doğru çalışır (materyaller otomatik olarak çift taraflı
   yapılır).
4. İstediğiniz kadar büyük/karmaşık bir ada kullanabilirsiniz; sadece dosya
   boyutu yüklenme süresini etkiler (Draco sıkıştırması önerilir).

### İsim plakanızı eklemek

Bkz. yukarıdaki "İsim plakası ekleme (birden çok, seçilebilir)" bölümü —
`client/public/assets/plate/` klasörüne `.glb` dosyalarınızı koyup
`manifest.json`'a kaydetmeniz yeterli.

## Kontroller

- **Joystick (sol alt, kütüphanesiz)**: sağa iterseniz karakter sağa,
  ileri iterseniz ileri, geri iterseniz geri gider. Joystick kamerayı
  döndürmez, sadece yürütür. Hem dokunmatikte hem fareyle çalışır.
- **Klavye**: W/S ileri-geri, A/D ile kamerayı (ve karakteri) döndürme —
  masaüstünde tam kontrol sağlar.
- **Ekranı/mouse'u sürükle**: bakış açısını değiştirir (kamerayı
  istediğiniz yöne çevirebilirsiniz).
- **İki parmakla kıstır / fare tekerleği**: yakınlaş–uzaklaş.
- **ZIPLA**: zıplama (Boşluk tuşu da çalışır).
- **HIZLAN**: basılı tuttukça hız kademeli olarak artar (Shift de çalışır).

## Oyun kuralları

- Tek oda, sürekli açık.
- Rastgele bir noktada **para** belirir, **7 saniye** (`COIN_CYCLE_MS`)
  süre verilir — oyunun adı da buradan gelir.
- Süre içinde ilk yakalayan +1 puan alır, para hemen yeni bir yerde
  belirir. Kimse alamazsa da yeni yerde tekrar belirir.
- Sağ üstteki **SIRALAMA** butonuyla skor tablosu görülür.

## Proje yapısı

```
server/
  src/
    index.ts     # giriş noktası, .env okuma, WebSocketServer
    room.ts      # oda/oyun mantığı: oyuncular, para döngüsü, heartbeat
    types.ts     # istemci <-> sunucu mesaj tipleri
client/
  public/assets/ # character.glb / coin.glb / island.glb / plate/*.glb+manifest.json buraya
  src/
    main.ts             # sahneyi kurar, döngüyü çalıştırır
    config.ts            # .env değerlerini okur
    types.ts             # mesaj tipleri (server/types.ts ile senkron)
    net/GameClient.ts    # WS istemcisi: yeniden bağlanma, ping/latency
    scene/Sky.ts          # gökyüzü dokusu
    scene/Terrain.ts      # ada modeli veya prosedürel arazi + yükseklik sorgusu
    character/CharacterFactory.ts # character.glb yükler (yedeği yer tutucu)
    character/Coin.ts             # coin.glb yükler (yedeği yer tutucu)
    character/NameTag.ts          # düz isim yazısı (canvas sprite)
    character/NamePlate.ts        # seçilen plate/*.glb + isim yazısı birleşimi
    character/plateManifest.ts    # plate/manifest.json okuyucu (paylaşılan)
    character/PlateThumbnails.ts  # giriş ekranı için plaka önizleme görüntüleri
    input/Joystick.ts             # Kütüphanesiz basit dokunmatik/fare joystick
    input/Keyboard.ts, CameraRig.ts
    ui/Login.ts (plaka seçim ızgarası dahil), Hud.ts
```

## Üretim derlemesi (opsiyonel)

```bash
npm run build   # server/dist ve client/dist üretir
npm start       # derlenmiş sunucuyu + client önizlemesini çalıştırır
```
