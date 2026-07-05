import * as THREE from 'three';
import { createSkyTexture } from './scene/Sky';
import { Terrain } from './scene/Terrain';
import { createStatue } from './scene/Statue';
import { CharacterFactory, type CharacterHandle } from './character/CharacterFactory';
import { NamePlateFactory } from './character/NamePlate';
import { Coin } from './character/Coin';
import { Joystick } from './input/Joystick';
import { Keyboard } from './input/Keyboard';
import { CameraRig } from './input/CameraRig';
import { Login } from './ui/Login';
import { Hud } from './ui/Hud';
import { GameMap } from './ui/GameMap';
import { GameClient } from './net/GameClient';
import type { PlayerState, PlayerMove, CoinState } from './types';
import { t } from './i18n';
import { CONFIG } from './config';

/** İki açı arasında en kısa yoldan yumuşak geçiş (saat yönü sarmalamasını doğru ele alır). */
function angleLerp(a: number, b: number, factor: number): number {
  let diff = b - a;
  diff = ((diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + diff * factor;
}

async function main(): Promise<void> {
  const loadingElStart = document.getElementById('loading');
  if (loadingElStart) loadingElStart.textContent = t('loading');

  // ---------- TEMEL SAHNE ----------
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 600);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('app')!.appendChild(renderer.domElement);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  scene.background = createSkyTexture();
  scene.fog = new THREE.Fog(0x9aa8bf, 45, 220);

  const hemi = new THREE.HemisphereLight(0xbfd3ea, 0x3a5a35, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d6, 1.0);
  sun.position.set(-40, 55, -20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -60;
  sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -60;
  sun.shadow.camera.far = 160;
  sun.shadow.bias = -0.0015;
  scene.add(sun);

  // ---------- HUD / GİRİŞ ----------
  // Bunlar en başta oluşturulur ki ağır modeller (character.glb vb.) yüklenirken
  // giriş ekranı zaten doğru dilde ve dil menüsü tıklanabilir olsun.
  const hud = new Hud();
  const login = new Login();

  // ---------- ARAZİ (prosedürel biyom alanları: çim / çöl / kar / yağmur ormanı) ----------
  const terrain = await Terrain.create(scene);

  // ---------- HARİTA (basit PUBG tarzı minimap + tam harita) ----------
  const gameMap = new GameMap(terrain.proceduralRadius);

  // ---------- ORTADAKİ HEYKELLER (character.glb/coin.glb ile aynı paternde,
  // client/public/assets içinden yüklenir; dosya yoksa otomatik yedeğe döner) ----------
  const statue = await createStatue({
    path: CONFIG.STATUE_MODEL_PATH,
    color: CONFIG.STATUE_COLOR,
    scale: CONFIG.STATUE_SCALE,
    height: CONFIG.STATUE_HEIGHT,
    pedestal: CONFIG.STATUE_PEDESTAL_ENABLED
      ? {
          height: CONFIG.STATUE_PEDESTAL_HEIGHT,
          radius: CONFIG.STATUE_PEDESTAL_RADIUS,
          color: CONFIG.STATUE_PEDESTAL_COLOR,
        }
      : undefined,
  });
  statue.position.set(0, terrain.heightAt(0, 0) ?? 0, 0);
  scene.add(statue);

  // İkinci heykel: birincinin hemen yanına, ayrı bir .glb'den.
  const statue2X = CONFIG.STATUE2_OFFSET_X;
  const statue2Z = CONFIG.STATUE2_OFFSET_Z;
  const statue2 = await createStatue({
    path: CONFIG.STATUE2_MODEL_PATH,
    color: CONFIG.STATUE_COLOR,
    scale: CONFIG.STATUE_SCALE,
    height: CONFIG.STATUE_HEIGHT,
    pedestal: CONFIG.STATUE_PEDESTAL_ENABLED
      ? {
          height: CONFIG.STATUE_PEDESTAL_HEIGHT,
          radius: CONFIG.STATUE_PEDESTAL_RADIUS,
          color: CONFIG.STATUE_PEDESTAL_COLOR,
        }
      : undefined,
  });
  statue2.position.set(statue2X, terrain.heightAt(statue2X, statue2Z) ?? 0, statue2Z);
  scene.add(statue2);

  // ---------- KARAKTER FABRİKASI (sadece character.glb) ----------
  const characterFactory = new CharacterFactory();
  await characterFactory.load();

  // ---------- İSİM PLAKASI FABRİKASI (client/public/assets/plate/manifest.json) ----------
  const namePlateFactory = new NamePlateFactory();
  await namePlateFactory.load();

  // ---------- YEREL OYUNCU ----------
  let local: CharacterHandle = characterFactory.build();
  let character = local.group;
  scene.add(character);

  const charState = {
    x: 0,
    z: 0,
    y: 0,
    facing: 0,
    velY: 0,
    grounded: true,
  };
  charState.y = terrain.heightAt(0, 0) ?? 0;
  character.position.set(0, charState.y, 0);

  const MOVE_SPEED_BASE = CONFIG.MOVE_SPEED;
  const TURN_SPEED_INPUT = CONFIG.TURN_SPEED; // joystick/klavye ile döndürme hızı (rad/s, tam basınçta)
  const FACING_SMOOTH = 12; // karakter, kamera yönüne ne kadar hızlı döner
  const JUMP_VELOCITY = CONFIG.JUMP_VELOCITY;
  const GRAVITY = CONFIG.GRAVITY;

  // ---------- HIZLANMA (basılı tuttukça artan hız) ----------
  const SPRINT_MAX_MULT = CONFIG.SPRINT_MAX_MULT;
  const SPRINT_RAMP_TIME = CONFIG.SPRINT_RAMP_TIME; // saniye — tam hıza ulaşma süresi
  const SPRINT_DECAY_RATE = CONFIG.SPRINT_DECAY_RATE; // bırakınca yavaşlama hızı
  let sprintActive = false;
  let sprintHoldTime = 0;

  // ---------- KAMERA (PUBG tarzı: karakter her zaman kameranın baktığı yöne bakar) ----------
  const cameraRig = new CameraRig(renderer.domElement);

  // ---------- JOYSTICK (kütüphanesiz — dokunmatik + fare) / KLAVYE / BUTONLAR ----------
  const joystick = new Joystick(document.getElementById('joyZone')!);
  const keyboard = new Keyboard();

  function doJump(): void {
    if (charState.grounded) {
      charState.velY = JUMP_VELOCITY;
      charState.grounded = false;
    }
  }
  keyboard.onJump = doJump;
  keyboard.onSprintChange = (v) => setSprint(v);

  function bindHoldButton(el: HTMLElement, onDown: () => void, onUp: () => void): void {
    el.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        onDown();
      },
      { passive: false }
    );
    el.addEventListener(
      'touchend',
      (e) => {
        e.preventDefault();
        onUp();
      },
      { passive: false }
    );
    el.addEventListener(
      'touchcancel',
      (e) => {
        e.preventDefault();
        onUp();
      },
      { passive: false }
    );
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      onDown();
    });
    el.addEventListener('mouseleave', () => onUp());
    window.addEventListener('mouseup', () => onUp());
  }

  const jumpBtn = document.getElementById('jumpBtn')!;
  bindHoldButton(jumpBtn, doJump, () => {});

  const sprintBtn = document.getElementById('sprintBtn')!;
  function setSprint(v: boolean): void {
    sprintActive = v;
    sprintBtn.classList.toggle('active', v);
  }
  bindHoldButton(
    sprintBtn,
    () => setSprint(true),
    () => setSprint(false)
  );

  // ---------- PARA (COIN, sadece coin.glb) ----------
  const coin = await Coin.create(scene);
  let coinState: CoinState = { x: 0, z: 0, endsAt: 0 };
  function positionCoin(): void {
    const h = terrain.heightAt(coinState.x, coinState.z) ?? 0;
    coin.setPosition(coinState.x, h + 0.55, coinState.z);
  }

  // ---------- AĞ ----------
  const client = new GameClient();
  let myId: string | null = null;
  const remotePlayers = new Map<
    string,
    { handle: CharacterHandle; group: THREE.Group; target: { x: number; z: number; ry: number } }
  >();
  const latestScores = new Map<string, { name: string; score: number }>();

  function createRemotePlayer(
    name: string,
    plateId?: string
  ): { handle: CharacterHandle; group: THREE.Group; target: { x: number; z: number; ry: number } } {
    const handle = characterFactory.build();
    handle.group.add(namePlateFactory.build(name, plateId));
    scene.add(handle.group);
    return { handle, group: handle.group, target: { x: 0, z: 0, ry: 0 } };
  }

  /** Tam liste: sadece join/left anında ('players' olayı) gelir; isim/skor/plaka içerir. */
  function syncPlayerList(list: PlayerState[]): void {
    const seen = new Set<string>();
    for (const p of list) {
      seen.add(p.id);
      latestScores.set(p.id, { name: p.name, score: p.score });
      if (p.id === myId) {
        hud.updateScore(p.score);
        continue;
      }
      let rp = remotePlayers.get(p.id);
      if (!rp) {
        rp = createRemotePlayer(p.name, p.plateId);
        remotePlayers.set(p.id, rp);
      }
      rp.target.x = p.x;
      rp.target.z = p.z;
      rp.target.ry = p.ry;
    }
    for (const [id, rp] of remotePlayers) {
      if (!seen.has(id)) {
        scene.remove(rp.group);
        remotePlayers.delete(id);
        latestScores.delete(id);
      }
    }
    if (hud.isLeaderboardOpen) refreshLeaderboard();
  }

  /**
   * Hafif liste: her tick ('state' olayı) gelir; sadece konum içerir
   * (isim/skor/plaka YOK — optimizasyon, bkz. server/src/room.ts).
   * Henüz 'players' ile tanışılmamış bir id varsa (çok nadir bir yarış
   * durumu) yok sayılır; zaten bir sonraki 'players' yayınında gelecek.
   */
  function syncPlayerPositions(list: PlayerMove[]): void {
    for (const p of list) {
      if (p.id === myId) continue;
      const rp = remotePlayers.get(p.id);
      if (!rp) continue;
      rp.target.x = p.x;
      rp.target.z = p.z;
      rp.target.ry = p.ry;
    }
  }

  function refreshLeaderboard(): void {
    const entries = Array.from(latestScores.entries()).map(([id, v]) => ({ id, name: v.name, score: v.score }));
    hud.renderLeaderboard(entries, myId);
  }

  client.on('welcome', ({ id, arenaRadius }) => {
    myId = id;
    login.hide();
    gameMap.setWorldRadius(arenaRadius);
  });
  client.on('players', ({ players }) => syncPlayerList(players));
  // 'state' artık sadece konum taşır (bkz. server/src/room.ts) — para
  // süresi zaten aşağıdaki animasyon döngüsünde yerel coinState'ten her
  // karede güncelleniyor, burada ayrıca çağırmaya gerek yok.
  client.on('state', ({ players }) => syncPlayerPositions(players));
  client.on('coin', ({ coin: c }) => {
    coinState = c;
    positionCoin();
  });
  client.on('caught', ({ id, name, score }) => {
    hud.showToast(id === myId ? t('caughtToastSelf') : t('caughtToastOther', { name }));
    // Skor artık her tick'te değil sadece burada geldiği için,
    // skor tahtasının güncel kalması adına herkes için (sadece kendimiz
    // için değil) latestScores'u da güncelliyoruz.
    latestScores.set(id, { name, score });
    if (id === myId) hud.updateScore(score);
    else if (hud.isLeaderboardOpen) refreshLeaderboard();
  });
  client.on('latency', ({ ms }) => hud.setLatency(ms));
  client.on('close', () => hud.setDisconnected());
  client.on('error', () => {
    login.setMsg(t('connError'));
    login.allowRetry();
  });

  let myNamePlate: THREE.Object3D | null = null;
  login.onJoin = (name, url, plateId) => {
    // Kendi seçtiğimiz plaka kendi karakterimizde de görünsün (3. şahıs
    // kamerada zaten kendi başımızın üstünü görebiliyoruz).
    if (myNamePlate) character.remove(myNamePlate);
    myNamePlate = namePlateFactory.build(name, plateId);
    character.add(myNamePlate);
    client.connect(url, name, plateId);
  };

  // ---------- ANİMASYON DÖNGÜSÜ ----------
  const clock = new THREE.Clock();
  let networkAccum = 0;
  const NETWORK_SEND_INTERVAL = 0.1;

  function frame(): void {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);

    // --- Girdi: joystick varsa doğrudan yön girdisi (sağ/sol/ileri/geri),
    // boştaysa klavye (WASD/ok tuşları) devreye girer. ---
    const joyX = joystick.vec.x;
    const joyY = joystick.vec.y;
    const usingJoystick = Math.abs(joyX) > 0.04 || Math.abs(joyY) > 0.04;

    // --- Hızlanma: basılı tuttukça kademeli olarak hızlanır, bırakınca yavaşlar ---
    if (sprintActive) {
      sprintHoldTime = Math.min(SPRINT_RAMP_TIME, sprintHoldTime + dt);
    } else {
      sprintHoldTime = Math.max(0, sprintHoldTime - dt * SPRINT_DECAY_RATE);
    }
    const sprintT = sprintHoldTime / SPRINT_RAMP_TIME;
    const sprintEase = 1 - Math.pow(1 - sprintT, 2); // ease-out: başta hızlı, sona doğru yumuşak
    const sprintMultiplier = 1 + (SPRINT_MAX_MULT - 1) * sprintEase;
    const moveSpeed = MOVE_SPEED_BASE * sprintMultiplier;

    let candX = charState.x;
    let candZ = charState.z;
    let moved = false;

    if (usingJoystick) {
      // --- Joystick: kameranın baktığı yöne göre GERÇEK yön girdisi.
      // Sağa basınca dünyada sağa, ileri basınca ileri, geri basınca geri
      // gider — joystick artık kamerayı DÖNDÜRMEZ, sadece hareket eder.
      // Kamera yönünü değiştirmek için ekranı sürüklemek yeterli. ---
      const yaw = cameraRig.yaw;
      const rightX = -Math.cos(yaw);
      const rightZ = Math.sin(yaw);
      const fwdX = Math.sin(yaw);
      const fwdZ = Math.cos(yaw);

      let moveX = rightX * joyX + fwdX * joyY;
      let moveZ = rightZ * joyX + fwdZ * joyY;
      const len = Math.hypot(moveX, moveZ);

      if (len > 0.001) {
        const amount = Math.min(1, len);
        moveX /= len;
        moveZ /= len;

        // Karakter, hareket ettiği yöne doğru yumuşakça döner.
        const targetFacing = Math.atan2(moveX, moveZ);
        charState.facing = angleLerp(charState.facing, targetFacing, Math.min(1, FACING_SMOOTH * dt));

        candX = charState.x + moveX * moveSpeed * amount * dt;
        candZ = charState.z + moveZ * moveSpeed * amount * dt;
        moved = true;
      }
    } else {
      // --- Klavye: A/D kamerayı (ve karakteri) döndürür, W/S o yöne ileri/geri gider. ---
      const turnInput = keyboard.turnInput();
      const moveInput = keyboard.moveInput();
      const keyboardActive = Math.abs(turnInput) > 0.04 || Math.abs(moveInput) > 0.04;

      if (Math.abs(turnInput) > 0.04) {
        cameraRig.turn(turnInput * TURN_SPEED_INPUT * dt);
      }

      // Sadece klavyeyle gerçekten hareket edilirken karakter kameraya döner.
      // Tamamen boştaysak (joystick de klavye de basılı değilse) karakteri
      // döndürmüyoruz — böylece ekranı sürükleyip etrafa serbestçe
      // bakabiliyorsunuz, karakter yerinde durup gereksiz dönmüyor.
      if (keyboardActive) {
        charState.facing = angleLerp(charState.facing, cameraRig.yaw, Math.min(1, FACING_SMOOTH * dt));
      }

      const forwardAmount = Math.abs(moveInput) > 0.04 ? Math.max(-1, Math.min(1, moveInput)) : 0;
      if (forwardAmount !== 0) {
        const dirX = Math.sin(charState.facing);
        const dirZ = Math.cos(charState.facing);
        candX = charState.x + dirX * moveSpeed * forwardAmount * dt;
        candZ = charState.z + dirZ * moveSpeed * forwardAmount * dt;
        moved = true;
      }
    }

    if (moved) {
      const groundH = terrain.heightAt(candX, candZ);
      if (groundH !== null) {
        charState.x = candX;
        charState.z = candZ;
        if (charState.grounded) charState.y = groundH;
      }
    }

    if (!charState.grounded) {
      charState.velY += GRAVITY * dt;
      charState.y += charState.velY * dt;
      const groundH = terrain.heightAt(charState.x, charState.z) ?? charState.y;
      if (charState.y <= groundH) {
        charState.y = groundH;
        charState.velY = 0;
        charState.grounded = true;
      }
    }

    // Karakter grubu SADECE konum + bakış yönü ile hareket eder.
    // Yürüme animasyonu yok: model her zaman kendi orijinal pozunda kalır.
    character.position.set(charState.x, charState.y, charState.z);
    character.rotation.y = charState.facing;

    // --- Sunucuya konum gönder ---
    networkAccum += dt;
    if (client.isOpen && networkAccum >= NETWORK_SEND_INTERVAL) {
      networkAccum = 0;
      client.send({ type: 'move', x: charState.x, z: charState.z, ry: charState.facing });
    }

    // --- Uzak oyuncuları güncelle (konum interpolasyonu, animasyon yok) ---
    for (const rp of remotePlayers.values()) {
      const lerpF = 1 - Math.pow(0.0001, dt);
      const curX = rp.group.position.x + (rp.target.x - rp.group.position.x) * lerpF;
      const curZ = rp.group.position.z + (rp.target.z - rp.group.position.z) * lerpF;
      const curY = terrain.heightAt(curX, curZ) ?? rp.group.position.y;
      rp.group.position.set(curX, curY, curZ);

      let rdiff = rp.target.ry - rp.group.rotation.y;
      while (rdiff > Math.PI) rdiff -= Math.PI * 2;
      while (rdiff < -Math.PI) rdiff += Math.PI * 2;
      rp.group.rotation.y += rdiff * Math.min(1, 8 * dt);
    }

    // --- Para animasyonu (sadece dönüş/hafif yüzme; yürüme animasyonu değil) ---
    coin.update(dt, clock.elapsedTime);
    if (myId) hud.updateCoinTimer(coinState.endsAt);

    // --- Harita (minimap + tam harita) ---
    gameMap.update(
      { x: charState.x, z: charState.z, facing: charState.facing },
      Array.from(remotePlayers.values()).map((rp) => ({ x: rp.group.position.x, z: rp.group.position.z }))
    );

    // --- Kamera (karakterin etrafında, yaw/pitch/distance ile) ---
    cameraRig.update(dt, character.position, camera);

    renderer.render(scene, camera);
  }

  const loadingEl = document.getElementById('loading');
  if (loadingEl) loadingEl.style.display = 'none';
  frame();
}

main().catch((err) => {
  console.error(err);
  const loadingEl = document.getElementById('loading');
  if (loadingEl) loadingEl.textContent = t('sceneLoadError', { err: String(err) });
});
