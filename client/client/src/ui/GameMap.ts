import { t, onLangChange } from '../i18n';

export interface MapPoint {
  x: number;
  z: number;
}

/**
 * Very simple PUBG-style map: a small always-visible minimap (radar) in
 * the corner, plus a full-screen map that opens by tapping the minimap
 * or pressing "M". Both draw the same thing: a circular world boundary,
 * a rough tint per biome quadrant, other players as dots, and the local
 * player as a rotating arrow.
 */
export class GameMap {
  private miniCanvas = document.getElementById('minimapCanvas') as HTMLCanvasElement;
  private miniCtx = this.miniCanvas.getContext('2d')!;
  private overlay = document.getElementById('mapOverlay')!;
  private fullCanvas = document.getElementById('mapCanvas') as HTMLCanvasElement;
  private fullCtx = this.fullCanvas.getContext('2d')!;
  private minimapWrap = document.getElementById('minimapWrap')!;
  private closeBtn = document.getElementById('mapCloseBtn')!;
  private titleEl = document.getElementById('mapTitle')!;

  private worldRadius: number;
  private open = false;

  private static readonly BIOME_COLORS = ['#2f7a45', '#d9b878', '#e8eef2', '#1f5c33'];

  constructor(worldRadius: number) {
    this.worldRadius = worldRadius;

    this.minimapWrap.addEventListener('click', () => this.toggle());
    this.closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setOpen(false);
    });
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.setOpen(false);
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') this.toggle();
    });

    this.applyTexts();
    onLangChange(() => this.applyTexts());
  }

  private applyTexts(): void {
    this.titleEl.textContent = t('mapTitle');
  }

  setWorldRadius(r: number): void {
    if (r > 0) this.worldRadius = r;
  }

  get isOpen(): boolean {
    return this.open;
  }

  toggle(): void {
    this.setOpen(!this.open);
  }

  setOpen(v: boolean): void {
    this.open = v;
    this.overlay.style.display = v ? 'flex' : 'none';
  }

  /** Call once per frame with the local player and everyone else's position. */
  update(me: { x: number; z: number; facing: number }, others: MapPoint[]): void {
    this.draw(this.miniCtx, this.miniCanvas, me, others, true);
    if (this.open) this.draw(this.fullCtx, this.fullCanvas, me, others, false);
  }

  private draw(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    me: { x: number; z: number; facing: number },
    others: MapPoint[],
    isMini: boolean
  ): void {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const mapR = Math.min(w, h) / 2 - 3;
    const scale = (mapR - 4) / this.worldRadius;

    ctx.clearRect(0, 0, w, h);

    // Base disc
    ctx.beginPath();
    ctx.arc(cx, cy, mapR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20,10,40,0.55)';
    ctx.fill();

    // Biome quadrant tint (matches Terrain.ts sector order: grass/desert/snow/rainforest)
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, mapR, (i * Math.PI) / 2 - Math.PI, ((i + 1) * Math.PI) / 2 - Math.PI);
      ctx.closePath();
      ctx.fillStyle = GameMap.BIOME_COLORS[i] + '4a';
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, mapR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(196,181,253,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Other players
    ctx.fillStyle = '#f1e8ff';
    for (const o of others) {
      const px = cx + o.x * scale;
      const py = cy + o.z * scale;
      ctx.beginPath();
      ctx.arc(px, py, isMini ? 2.5 : 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Local player (arrow, points toward facing direction)
    const mx = cx + me.x * scale;
    const my = cy + me.z * scale;
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(me.facing);
    const size = isMini ? 6 : 9;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.65, size * 0.8);
    ctx.lineTo(-size * 0.65, size * 0.8);
    ctx.closePath();
    ctx.fillStyle = '#c4b5fd';
    ctx.fill();
    ctx.restore();
  }
}
