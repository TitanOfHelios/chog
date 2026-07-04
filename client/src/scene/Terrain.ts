import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { CONFIG } from '../config';

const ISLAND_PATH = CONFIG.ISLAND_MODEL_PATH;

/**
 * Arazi katmanı. `client/public/assets/island.glb` dosyası varsa onu
 * yükler ve karakterin adanın gerçek yüzeyinde (raycast ile) dolaşmasını
 * sağlar — karakter adanın HER NOKTASINA gidebilir, yapay bir daire ile
 * sınırlanmaz. island.glb yoksa eski prosedürel dalgalı çim alanına
 * otomatik olarak geri döner.
 *
 * Sağlamlık notları:
 * - Dosya var mı diye ayrı bir HEAD isteği ATMIYORUZ; bazı sunucular/CDN'ler
 *   olmayan dosyalar için de 200 döndürebiliyor (SPA fallback vb.), bu da
 *   yanlış pozitif algılamaya yol açabiliyor. Bunun yerine doğrudan
 *   GLTFLoader ile yüklemeyi deniyoruz; başarısız olursa (404, bozuk dosya
 *   vb.) prosedürel araziye sorunsuzca geri dönüyoruz.
 * - Blender gibi araçlardan dışa aktarılan modellerde normaller ters
 *   olabiliyor; bu da yukarıdan aşağı atılan ışının yüzeyi "görmemesine"
 *   sebep olabiliyor. Bunu önlemek için ada materyallerini DoubleSide
 *   yapıyoruz — hem render hem raycast için normal yönünden bağımsız
 *   çalışır.
 */
export class Terrain {
  readonly group = new THREE.Group();
  readonly usingIsland: boolean;
  readonly proceduralRadius = 140; // island.glb yoksa kullanılan geniş dünya yarıçapı

  private islandMeshes: THREE.Object3D[] = [];
  private raycaster = new THREE.Raycaster();
  private downVec = new THREE.Vector3(0, -1, 0);
  private islandBounds: THREE.Box3 | null = null;
  private islandMaxY = 500;

  private constructor(usingIsland: boolean) {
    this.usingIsland = usingIsland;
  }

  static async create(scene: THREE.Scene): Promise<Terrain> {
    const island = await Terrain.tryLoadIsland();
    const terrain = new Terrain(!!island);

    if (island) {
      island.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          const mesh = o as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          // Ters normal / ters yüz sarımı yüzünden raycast'in veya
          // render'ın "delik" görmesini engelle.
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            (m as THREE.Material & { side?: THREE.Side }).side = THREE.DoubleSide;
          }
          terrain.islandMeshes.push(mesh);
        }
      });
      terrain.group.add(island);
      terrain.islandBounds = new THREE.Box3().setFromObject(island);
      terrain.islandMaxY = terrain.islandBounds.max.y + 50;
    } else {
      terrain.buildProcedural();
    }

    scene.add(terrain.group);
    return terrain;
  }

  private static async tryLoadIsland(): Promise<THREE.Object3D | null> {
    try {
      return await new Promise<THREE.Object3D>((resolve, reject) => {
        const loader = new GLTFLoader();
        const draco = new DRACOLoader();
        draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        loader.setDRACOLoader(draco);
        loader.load(
          ISLAND_PATH,
          (gltf) => resolve(gltf.scene),
          undefined,
          (err) => reject(err)
        );
      });
    } catch (err) {
      console.warn(
        `[Terrain] ${ISLAND_PATH} bulunamadı/yüklenemedi, prosedürel çim alanına geri dönülüyor.`,
        err
      );
      return null;
    }
  }

  // ---------------- Prosedürel çim alanı (yedek) ----------------
  proceduralHeight(x: number, z: number): number {
    return Math.sin(x * 0.035) * 2.6 + Math.cos(z * 0.032) * 2.3 + Math.sin((x + z) * 0.02) * 1.5;
  }

  private buildProcedural(): void {
    const groundSize = 420;
    const groundSeg = 140;
    const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize, groundSeg, groundSeg);
    groundGeo.rotateX(-Math.PI / 2);
    const gpos = groundGeo.attributes.position;
    for (let i = 0; i < gpos.count; i++) {
      const x = gpos.getX(i);
      const z = gpos.getZ(i);
      gpos.setY(i, this.proceduralHeight(x, z));
    }
    groundGeo.computeVertexNormals();
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color: 0x2f7a45, roughness: 1 }));
    ground.receiveShadow = true;
    this.group.add(ground);

    const farHillsGeo = new THREE.RingGeometry(150, 380, 72, 8);
    const fpos = farHillsGeo.attributes.position;
    for (let i = 0; i < fpos.count; i++) {
      const x = fpos.getX(i);
      const y = fpos.getY(i);
      const d = Math.sqrt(x * x + y * y);
      const h = 8 + Math.sin(x * 0.02) * 4 + Math.cos(y * 0.02) * 4;
      farHillsGeo.attributes.position.setZ(i, -h * Math.min(1, (d - 140) / 50));
    }
    farHillsGeo.rotateX(-Math.PI / 2);
    farHillsGeo.computeVertexNormals();
    const farHills = new THREE.Mesh(farHillsGeo, new THREE.MeshStandardMaterial({ color: 0x3f8f57, roughness: 1 }));
    this.group.add(farHills);
  }

  // ---------------- Yükseklik sorgusu ----------------
  /**
   * Ada modeli varsa: (x,z) noktasının tam üstünden aşağı ışın atarak
   * gerçek yüzey yüksekliğini bulur. Nokta adanın dışındaysa `null`
   * döner (karakter oraya gidemez, en son geçerli konumda kalır).
   * Ada modeli yoksa prosedürel formülle her zaman bir yükseklik döner.
   */
  heightAt(x: number, z: number): number | null {
    if (!this.usingIsland) return this.proceduralHeight(x, z);

    this.raycaster.set(new THREE.Vector3(x, this.islandMaxY, z), this.downVec);
    this.raycaster.far = this.islandMaxY + 500;
    const hits = this.raycaster.intersectObjects(this.islandMeshes, false);
    if (hits.length === 0) return null;
    return hits[0].point.y;
  }

  /** Spawn noktası seçerken kullanılacak, adanın merkezine yakın güvenli bir alan. */
  getSpawnRadius(): number {
    if (!this.usingIsland || !this.islandBounds) return this.proceduralRadius * 0.6;
    const size = new THREE.Vector3();
    this.islandBounds.getSize(size);
    return Math.min(size.x, size.z) * 0.3;
  }
}
