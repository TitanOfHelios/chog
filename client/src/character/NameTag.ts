import * as THREE from 'three';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createNameSprite(text: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.font = 'bold 30px -apple-system, sans-serif';
  const w = Math.min(240, ctx.measureText(text).width + 28);
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = 'rgba(10,16,30,0.55)';
  roundRect(ctx, 128 - w / 2, 10, w, 40, 12);
  ctx.fill();
  ctx.fillStyle = '#eafff3';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 31);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.5, 0.38, 1);
  sprite.position.y = 2.15;
  sprite.renderOrder = 999;
  return sprite;
}
