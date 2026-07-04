import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { CONFIG } from '../config';

export interface StatueOptions {
  /** client/public klasörüne göre .glb yolu (ör. '/assets/statue.glb'). */
  path: string;
  /** .glb bulunamaz/bozuksa kullanılan yedek prosedürel heykelin rengi. */
  color: string;
  /** Genel boyut çarpanı. */
  scale: number;
  /** .glb yüklendiğinde otomatik ölçeklenip oturtulacağı hedef yükseklik (birim). */
  height: number;
  /**
   * Verilirse modelin ALTINA basit/renksiz bir sütun (kaide) eklenir ve
   * model bu sütunun tam üstüne otursun diye yukarı kaldırılır. Model
   * bulunamayıp yedek prosedürel heykele düşülürse sütun eklenmez
   * (yedeğin zaten kendi kaidesi var).
   */
  pedestal?: {
    height: number;
    radius: number;
    color: string;
  };
}

/**
 * Haritaya konan dekoratif heykel. character.glb / coin.glb ile AYNI
 * PATERNİ izler: önce client/public/assets altındaki .glb dosyasını
 * yüklemeyi dener (otomatik ölçekleyip tabanını yere oturtur), dosya
 * yoksa/bozuksa oyunun çökmemesi için eski basit/renksiz prosedürel
 * heykele geri döner. Oyuncuyla çarpışması/etkileşimi yoktur.
 */
export async function createStatue(opts: StatueOptions): Promise<THREE.Group> {
  const group = new THREE.Group();
  if (!CONFIG.STATUE_ENABLED) return group;

  const custom = await tryLoadModel(opts.path);
  if (custom) {
    custom.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    custom.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(custom);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const fit = size.y > 0.0001 ? opts.height / size.y : 1;

    // Sütun varsa modelin tabanını yerin üstüne değil, sütunun tam
    // tepesine oturtuyoruz (pedestalHeight kadar yukarı kaldırıyoruz).
    const pedestalHeight = opts.pedestal ? opts.pedestal.height : 0;
    custom.scale.setScalar(fit);
    custom.position.set(-center.x * fit, -box.min.y * fit + pedestalHeight, -center.z * fit);
    group.add(custom);

    if (opts.pedestal) {
      group.add(buildColumn(opts.pedestal));
    }
  } else {
    group.add(buildPlaceholder(opts.color));
  }

  group.scale.setScalar(opts.scale);
  return group;
}

/** Basit, renksiz/nötr taş sütun — üstüne bir model oturtmak için kaide. */
function buildColumn(opts: { height: number; radius: number; color: string }): THREE.Group {
  const column = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: opts.color, roughness: 0.9, metalness: 0.05 });

  const capH = Math.min(0.18, opts.height * 0.12);
  const shaftH = Math.max(0.01, opts.height - capH * 2);

  // Taban kaidesi (yerden biraz daha geniş)
  const base = new THREE.Mesh(new THREE.CylinderGeometry(opts.radius * 1.25, opts.radius * 1.35, capH, 20), mat);
  base.position.y = capH / 2;

  // Sütun gövdesi
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(opts.radius, opts.radius * 1.05, shaftH, 20), mat);
  shaft.position.y = capH + shaftH / 2;

  // Üst kapak (modelin üstüne bineceği düz yüzey)
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(opts.radius * 1.2, opts.radius, capH, 20), mat);
  cap.position.y = capH + shaftH + capH / 2;

  for (const mesh of [base, shaft, cap]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    column.add(mesh);
  }
  return column;
}

function buildPlaceholder(color: string): THREE.Group {
  const placeholder = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.05 });

  // Kaide
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.4, 1.3), mat);
  base.position.y = 0.2;

  // Gövde (kabaca bir insan silueti — kasıtlı olarak çok basit/soyut)
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.46, 1.5, 14), mat);
  body.position.y = 0.4 + 0.75;

  // Baş
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), mat);
  head.position.y = 0.4 + 1.5 + 0.28;

  for (const mesh of [base, body, head]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    placeholder.add(mesh);
  }
  return placeholder;
}

async function tryLoadModel(path: string): Promise<THREE.Object3D | null> {
  try {
    return await new Promise<THREE.Object3D>((resolve, reject) => {
      const loader = new GLTFLoader();
      const draco = new DRACOLoader();
      draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
      loader.setDRACOLoader(draco);
      loader.load(
        path,
        (gltf) => resolve(gltf.scene),
        undefined,
        (err) => reject(err)
      );
    });
  } catch (err) {
    console.error(
      `[Statue] ${path} yüklenemedi. Dosyanın client/public${path} yolunda gerçekten var olduğundan ` +
        've geçerli bir GLB olduğundan emin ol. Yerine basit/renksiz yedek heykel gösterilecek.',
      err
    );
    return null;
  }
}
