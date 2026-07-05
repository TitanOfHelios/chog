import * as THREE from 'three';

/**
 * Terrain layer. Procedurally generated ground split into four biome
 * sectors around the center (grass, desert, snow, rainforest), each with
 * its own color and height profile, blended smoothly at the borders.
 * A small safe-zone near the origin (where the statues stand) always
 * stays grass regardless of angle, so the spawn area looks consistent.
 */
export type Biome = 'grass' | 'desert' | 'snow' | 'rainforest';

const BIOME_ORDER: Biome[] = ['grass', 'desert', 'snow', 'rainforest'];

const BIOME_COLOR: Record<Biome, THREE.Color> = {
  grass: new THREE.Color(0x2f7a45),
  desert: new THREE.Color(0xd9b878),
  snow: new THREE.Color(0xe8eef2),
  rainforest: new THREE.Color(0x1f5c33),
};

function biomeHeight(biome: Biome, x: number, z: number): number {
  switch (biome) {
    case 'grass':
      return Math.sin(x * 0.035) * 2.6 + Math.cos(z * 0.032) * 2.3 + Math.sin((x + z) * 0.02) * 1.5;
    case 'desert':
      return Math.sin(x * 0.018) * 1.2 + Math.cos(z * 0.02) * 1.0 + Math.sin((x + z) * 0.05) * 0.6;
    case 'snow':
      return Math.sin(x * 0.028) * 1.6 + Math.cos(z * 0.03) * 1.4 + Math.sin((x - z) * 0.05) * 0.7;
    case 'rainforest':
      return Math.sin(x * 0.05) * 3.4 + Math.cos(z * 0.045) * 3.0 + Math.sin((x + z) * 0.08) * 1.8;
  }
}

/** Deterministic seeded RNG so prop placement is stable across reloads. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return function (): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function angleNorm(a: number): number {
  let v = a % (Math.PI * 2);
  if (v < 0) v += Math.PI * 2;
  return v;
}

export class Terrain {
  readonly group = new THREE.Group();
  readonly proceduralRadius = 140; // overall visible ground radius
  private readonly safeZoneRadius = 25; // always-grass area around the center statues

  // ---------------- Biome lookup ----------------
  /** Hard biome (no blending) — used for deciding what prop to place. */
  private hardBiomeAt(x: number, z: number): Biome {
    const r = Math.hypot(x, z);
    if (r < this.safeZoneRadius) return 'grass';
    const theta = angleNorm(Math.atan2(z, x));
    const idx = Math.floor((theta / (Math.PI * 2)) * 4) % 4;
    return BIOME_ORDER[idx];
  }

  /** Smoothly blended color + height at a point, mixing the two nearest biome sectors. */
  private blendedAt(x: number, z: number): { color: THREE.Color; height: number } {
    const angle = angleNorm(Math.atan2(z, x));
    const sectorSize = Math.PI / 2;
    const sectorFloat = angle / sectorSize;
    const sectorIndex = Math.floor(sectorFloat) % 4;
    const frac = sectorFloat - Math.floor(sectorFloat);
    const transition = 0.18;

    let blend = 0;
    let neighborIndex = sectorIndex;
    if (frac < transition) {
      blend = ((transition - frac) / transition) * 0.5;
      neighborIndex = (sectorIndex + 3) % 4;
    } else if (frac > 1 - transition) {
      blend = ((frac - (1 - transition)) / transition) * 0.5;
      neighborIndex = (sectorIndex + 1) % 4;
    }

    const biomeA = BIOME_ORDER[sectorIndex];
    const biomeB = BIOME_ORDER[neighborIndex];
    const heightA = biomeHeight(biomeA, x, z);
    const heightB = biomeHeight(biomeB, x, z);
    const height = heightA * (1 - blend) + heightB * blend;
    const color = BIOME_COLOR[biomeA].clone().lerp(BIOME_COLOR[biomeB], blend);

    // Fade everything back to grass near the center safe zone.
    const r = Math.hypot(x, z);
    if (r < this.safeZoneRadius) {
      const t = 1 - r / this.safeZoneRadius; // 1 at center, 0 at edge of safe zone
      const grassHeight = biomeHeight('grass', x, z);
      return {
        color: color.clone().lerp(BIOME_COLOR.grass, t),
        height: height * (1 - t) + grassHeight * t,
      };
    }

    return { color, height };
  }

  static async create(scene: THREE.Scene): Promise<Terrain> {
    const terrain = new Terrain();
    terrain.buildProcedural();
    terrain.addBiomeProps();
    scene.add(terrain.group);
    return terrain;
  }

  private buildProcedural(): void {
    const groundSize = this.proceduralRadius * 3;
    const groundSeg = 140;
    const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize, groundSeg, groundSeg);
    groundGeo.rotateX(-Math.PI / 2);

    const gpos = groundGeo.attributes.position;
    const colors = new Float32Array(gpos.count * 3);
    for (let i = 0; i < gpos.count; i++) {
      const x = gpos.getX(i);
      const z = gpos.getZ(i);
      const { color, height } = this.blendedAt(x, z);
      gpos.setY(i, height);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    groundGeo.computeVertexNormals();

    const ground = new THREE.Mesh(
      groundGeo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })
    );
    ground.receiveShadow = true;
    this.group.add(ground);

    // Distant hills ring, purely decorative, kept as a single neutral tone.
    const farHillsGeo = new THREE.RingGeometry(this.proceduralRadius + 10, this.proceduralRadius + 240, 72, 8);
    const fpos = farHillsGeo.attributes.position;
    for (let i = 0; i < fpos.count; i++) {
      const x = fpos.getX(i);
      const y = fpos.getY(i);
      const d = Math.sqrt(x * x + y * y);
      const h = 8 + Math.sin(x * 0.02) * 4 + Math.cos(y * 0.02) * 4;
      farHillsGeo.attributes.position.setZ(i, -h * Math.min(1, (d - (this.proceduralRadius + 10)) / 50));
    }
    farHillsGeo.rotateX(-Math.PI / 2);
    farHillsGeo.computeVertexNormals();
    const farHills = new THREE.Mesh(farHillsGeo, new THREE.MeshStandardMaterial({ color: 0x3f8f57, roughness: 1 }));
    this.group.add(farHills);
  }

  /** Scatters a handful of simple, low-poly props matching each biome. */
  private addBiomeProps(): void {
    const rng = mulberry32(20260705);
    const propCount = 90;
    for (let i = 0; i < propCount; i++) {
      const ang = rng() * Math.PI * 2;
      const r = this.safeZoneRadius + 8 + rng() * (this.proceduralRadius - this.safeZoneRadius - 20);
      const x = Math.cos(ang) * r;
      const z = Math.sin(ang) * r;
      const biome = this.hardBiomeAt(x, z);
      const prop = this.buildProp(biome);
      const y = this.proceduralHeight(x, z);
      prop.position.set(x, y, z);
      prop.rotation.y = rng() * Math.PI * 2;
      const s = 0.8 + rng() * 0.7;
      prop.scale.setScalar(s);
      this.group.add(prop);
    }
  }

  private buildProp(biome: Biome): THREE.Group {
    const g = new THREE.Group();
    if (biome === 'desert') {
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4c8a4a, roughness: 1 });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.6, 6), trunkMat);
      trunk.position.y = 0.8;
      g.add(trunk);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.7, 6), trunkMat);
      arm.position.set(0.3, 1.05, 0);
      arm.rotation.z = Math.PI / 3;
      g.add(arm);
    } else {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 1.0, 6),
        new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 1 })
      );
      trunk.position.y = 0.5;
      g.add(trunk);
      const canopyColor = biome === 'snow' ? 0xdfeaf2 : biome === 'rainforest' ? 0x1c4d2b : 0x2f7a45;
      const canopy = new THREE.Mesh(
        new THREE.ConeGeometry(0.75, 1.6, 7),
        new THREE.MeshStandardMaterial({ color: canopyColor, roughness: 1 })
      );
      canopy.position.y = 1.5;
      g.add(canopy);
    }
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        (o as THREE.Mesh).castShadow = true;
        (o as THREE.Mesh).receiveShadow = true;
      }
    });
    return g;
  }

  // ---------------- Height query (used for walking/props) ----------------
  proceduralHeight(x: number, z: number): number {
    return this.blendedAt(x, z).height;
  }

  /** Kept for API compatibility with callers that ask for a safe spawn radius. */
  heightAt(x: number, z: number): number | null {
    return this.proceduralHeight(x, z);
  }

  getSpawnRadius(): number {
    return this.proceduralRadius * 0.6;
  }
}
