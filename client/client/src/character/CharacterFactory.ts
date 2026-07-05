import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { CONFIG } from '../config';

const CHARACTER_PATH = CONFIG.CHARACTER_MODEL_PATH;

export interface CharacterHandle {
  group: THREE.Group;
  isCustomModel: boolean;
  model?: THREE.Object3D;
}

/**
 * NOT: Yürüme animasyonu kasıtlı olarak yok. Karakter grubu sadece
 * konum (x,y,z) ve bakış yönü (yaw) ile hareket eder; modelin kendisi
 * hiçbir şekilde eğilmez/sallanmaz/zıplamaz — GLB dosyasında dışa
 * aktarılan "orijinal" pozunda kalır.
 *
 * Bu fabrika artık SADECE client/public/assets/character.glb dosyasını
 * kullanır. Prosedürel/otomatik üretilen yedek bir karakter YOKTUR.
 * Dosya bulunamaz veya yüklenemezse, oyunun tamamen çökmemesi için
 * çok basit nötr bir yer tutucu (placeholder) gösterilir ve konsola
 * net bir uyarı yazılır.
 */
export class CharacterFactory {
  private template: THREE.Object3D | null = null;
  private loadError: string | null = null;

  async load(): Promise<void> {
    try {
      const gltf = await new Promise<THREE.Object3D>((resolve, reject) => {
        const loader = new GLTFLoader();
        const draco = new DRACOLoader();
        draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        loader.setDRACOLoader(draco);
        loader.load(
          CHARACTER_PATH,
          (g) => resolve(g.scene),
          undefined,
          (err) => reject(err)
        );
      });
      this.template = gltf;
    } catch (err) {
      this.loadError = String(err);
      console.error(
        `[CharacterFactory] ${CHARACTER_PATH} yüklenemedi. Dosyanın client/public/assets/character.glb ` +
          'yolunda gerçekten var olduğundan ve geçerli bir GLB olduğundan emin ol.',
        err
      );
    }
  }

  build(): CharacterHandle {
    return this.template ? this.buildCustomCharacter() : this.buildPlaceholder();
  }

  private buildCustomCharacter(): CharacterHandle {
    const group = new THREE.Group();
    const model = this.template!.clone(true);
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    model.updateMatrixWorld(true);

    // Modeli otomatik ölçekle, tabanı yere otur, merkezini ortala —
    // bu bir "animasyon" değil, tek seferlik yerleştirme; model kendi
    // orijinal şeklini/oranlarını korur.
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const scale = size.y > 0.0001 ? CONFIG.CHARACTER_HEIGHT / size.y : 1;
    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

    group.add(model);
    return { group, isCustomModel: true, model };
  }

  /** character.glb hiç yoksa/bozuksa: oyunun çökmemesi için minik nötr bir yer tutucu. */
  private buildPlaceholder(): CharacterHandle {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x6d28d9, roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.55, 4, 8), mat);
    body.position.y = 0.68;
    body.castShadow = true;
    group.add(body);
    return { group, isCustomModel: false };
  }
}
