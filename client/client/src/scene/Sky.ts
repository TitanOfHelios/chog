import * as THREE from 'three';

export function createSkyTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#0e1a3a');
  grad.addColorStop(0.45, '#28406e');
  grad.addColorStop(0.75, '#7c93b0');
  grad.addColorStop(1.0, '#cfd9e4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.LinearFilter;
  return tex;
}
