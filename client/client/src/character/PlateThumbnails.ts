import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { PlateOption } from './plateManifest';
import { plateFileUrl } from './plateManifest';

const THUMB_W = 220;
const THUMB_H = 140;

/**
 * Login ekranındaki plaka seçim kartları için her .glb dosyasından TEK
 * KARE'lik bir önizleme görüntüsü (PNG data URL) üretir. Canlı/dönen bir
 * 3D sahne değildir — sabit, hafif bir "fotoğraf" alınır ve <img> olarak
 * gösterilir. Böylece kaç plaka olursa olsun ekstra render yükü olmaz.
 *
 * Bir plakanın yüklenmesi başarısız olursa o kart için null döner
 * (çağıran taraf onEach ile ilerleyen sonuçları anında işleyebilir).
 */
export async function renderPlateThumbnails(
  options: PlateOption[],
  onEach: (id: string, dataUrl: string | null) => void
): Promise<void> {
  if (options.length === 0) return;

  const canvas = document.createElement('canvas');
  canvas.width = THUMB_W;
  canvas.height = THUMB_H;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(THUMB_W, THUMB_H, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, THUMB_W / THUMB_H, 0.05, 100);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x554466, 1.1);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(2, 3, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8b5cf6, 0.6);
  rim.position.set(-3, 1, -2);
  scene.add(rim);

  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
  loader.setDRACOLoader(draco);

  for (const option of options) {
    try {
      const model = await new Promise<THREE.Object3D>((resolve, reject) => {
        loader.load(
          plateFileUrl(option),
          (gltf) => resolve(gltf.scene),
          undefined,
          (err) => reject(err)
        );
      });

      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);
      const maxDim = Math.max(size.x, size.y, size.z, 0.0001);
      const scale = 1.6 / maxDim;
      model.scale.setScalar(scale);
      model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
      scene.add(model);

      camera.position.set(0.9, 0.65, 1.8);
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      const dataUrl = canvas.toDataURL('image/png');
      onEach(option.id, dataUrl);

      scene.remove(model);
      disposeObject(model);
    } catch (err) {
      console.error(`[PlateThumbnails] ${plateFileUrl(option)} önizlemesi oluşturulamadı.`, err);
      onEach(option.id, null);
    }
  }

  renderer.dispose();
}

function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) m?.dispose();
    }
  });
}
