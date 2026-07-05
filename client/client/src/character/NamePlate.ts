import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { createNameSprite } from './NameTag';
import { CONFIG } from '../config';
import { loadPlateManifest, plateFileUrl, type PlateOption } from './plateManifest';

const PLATE_HEIGHT = 2.05; // Karakterin başı üzerindeki yükseklik

// --- Plaka genişliği isme göre otomatik uzayıp kısalır (.env'den ayarlanır) ---
const PLATE_MIN_WIDTH = CONFIG.PLATE_MIN_WIDTH; // en kısa isimler için (örn. "Ali")
const PLATE_MAX_WIDTH = CONFIG.PLATE_MAX_WIDTH; // en uzun isimler için üst sınır
const PLATE_BASE_WIDTH = 0.7; // sabit taban genişlik
const PLATE_WIDTH_PER_CHAR = CONFIG.PLATE_WIDTH_PER_CHAR; // her karakter için eklenen genişlik
// Yükseklik/derinlik ölçeği bu referans genişliğe göre sabitlenir; böylece
// sadece genişlik (X) isme göre değişir, plaka kısa isimde çok küçülüp
// uzun isimde çok uzamaz — sadece "gerilir".
const PLATE_REFERENCE_WIDTH = clampWidth(PLATE_BASE_WIDTH + 8 * PLATE_WIDTH_PER_CHAR);

function clampWidth(w: number): number {
  return Math.max(PLATE_MIN_WIDTH, Math.min(PLATE_MAX_WIDTH, w));
}

function widthForName(name: string): number {
  return clampWidth(PLATE_BASE_WIDTH + name.length * PLATE_WIDTH_PER_CHAR);
}

/**
 * client/public/assets/plate/ klasöründeki manifest.json'da listelenen
 * .glb dosyalarını isim etiketimizi süsleyen 3D plakalar olarak kullanır.
 * Oyuncu, login ekranında bunlardan birini seçer; seçtiği plaka id'si
 * sunucu üzerinden diğer oyunculara da iletilir, böylece herkes aynı
 * plakayı görür.
 *
 * manifest.json boşsa/yoksa (hiç plaka eklenmemişse) sade metin
 * etiketine geri döner — hiçbir şey bozulmaz.
 */
export class NamePlateFactory {
  private templates = new Map<string, THREE.Object3D>();
  private manifest: PlateOption[] = [];

  async load(): Promise<void> {
    this.manifest = await loadPlateManifest();
    if (this.manifest.length === 0) return;

    await Promise.all(
      this.manifest.map(async (option) => {
        try {
          const template = await this.loadGlb(plateFileUrl(option));
          this.templates.set(option.id, template);
        } catch (err) {
          console.error(
            `[NamePlateFactory] ${plateFileUrl(option)} yüklenemedi (id: "${option.id}"). ` +
              'manifest.json içindeki dosya adını ve dosyanın gerçekten var olduğunu kontrol edin.',
            err
          );
        }
      })
    );
  }

  private loadGlb(path: string): Promise<THREE.Object3D> {
    return new Promise((resolve, reject) => {
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
  }

  /** Login ekranındaki seçim listesini doldurmak için kullanılabilir. */
  getManifest(): PlateOption[] {
    return this.manifest;
  }

  /**
   * @param name Karakterin ismi (plaka genişliğini ve yazıyı belirler)
   * @param plateId Login ekranında seçilen plaka id'si. Geçersizse/yoksa
   *   manifest'teki ilk plaka (varsa) varsayılan olarak kullanılır.
   */
  build(name: string, plateId?: string): THREE.Group {
    const group = new THREE.Group();
    const sprite = createNameSprite(name);

    const template = this.resolveTemplate(plateId);

    if (template) {
      const plate = template.clone(true);
      plate.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = false;
          mesh.receiveShadow = false;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            (m as THREE.Material & { side?: THREE.Side }).side = THREE.DoubleSide;
          }
        }
      });
      plate.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(plate);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      // Genişlik (X) isme göre uzar/kısalır; yükseklik ve derinlik (Y/Z)
      // sabit bir referans genişliğe göre ölçeklenir, böylece plaka sadece
      // yatayda "gerilir", oranı bozulmaz.
      const targetWidth = widthForName(name);
      const baseScale = size.x > 0.0001 ? PLATE_REFERENCE_WIDTH / size.x : 1;
      const scaleX = size.x > 0.0001 ? targetWidth / size.x : 1;
      const scaleY = baseScale;
      const scaleZ = baseScale;

      plate.scale.set(scaleX, scaleY, scaleZ);
      plate.position.set(-center.x * scaleX, PLATE_HEIGHT - center.y * scaleY, -center.z * scaleZ);
      plate.renderOrder = 998;
      group.add(plate);

      // Plaka, dünyadaki güneş açısına bakılmaksızın her zaman okunabilir
      // kalsın diye üstüne hafif, sıcak bir ışık asılır (sahne genelini
      // etkilemesin diye menzili kısa tutulur). Işık, plakanın kendi
      // yerel uzayına gömülür ki plaka nereye giderse (konum/ölçek
      // değişse bile) o da birebir aynı yerde kalsın.
      const plateLight = new THREE.PointLight(0xfff3d6, 1.1, 2.6, 2);
      plateLight.position.set(0, (PLATE_HEIGHT + 0.25 - plate.position.y) / scaleY, (0.5 - plate.position.z) / scaleZ);
      plate.add(plateLight);

      // İsim yazısı artık ayrı bir kardeş değil, PLAKANIN KENDİSİNİN
      // ÇOCUĞU: plaka her nereye giderse (taşınır, döndürülür,
      // yeniden ölçeklenirse) isim de birebir aynı yere gömülü kalır.
      // Plakanın kendi yerel (henüz group ölçeği uygulanmamış) uzayında
      // konumlandırıp plakanın ters orantılı ölçeğiyle telafi ediyoruz
      // ki metin, plakanın olası eşit-olmayan (non-uniform) ölçeğinden
      // bozulmadan hep aynı görsel boyutta kalsın.
      const spriteWidth = targetWidth * 0.68;
      const localY = (PLATE_HEIGHT - plate.position.y) / scaleY;
      const localZ = (0.08 - plate.position.z) / scaleZ;
      sprite.position.set(0, localY, localZ);
      sprite.scale.set(spriteWidth / scaleX, 0.29 / scaleY, 1 / scaleZ);
      plate.add(sprite);
    } else {
      // Hiç plaka yok/seçilmedi: eskisi gibi sade yazı etiketi.
      sprite.position.set(0, PLATE_HEIGHT, 0);
      sprite.scale.set(1.5, 0.38, 1);
      group.add(sprite);
    }

    return group;
  }

  private resolveTemplate(plateId?: string): THREE.Object3D | undefined {
    if (plateId) {
      const exact = this.templates.get(plateId);
      if (exact) return exact;
    }
    // Geçersiz/eksik seçim: manifest'teki ilk yüklenebilen plakaya düş.
    for (const option of this.manifest) {
      const tpl = this.templates.get(option.id);
      if (tpl) return tpl;
    }
    return undefined;
  }
}
