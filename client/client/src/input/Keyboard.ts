export class Keyboard {
  private keys: Record<string, boolean> = {};
  onJump: (() => void) | null = null;
  onSprintChange: ((active: boolean) => void) | null = null;

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space') this.onJump?.();
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.onSprintChange?.(true);
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.onSprintChange?.(false);
    });
  }

  /** W/Yukarı = ileri (+1), S/Aşağı = geri (-1). PUBG tarzı ileri/geri butonlarıyla aynı girdi. */
  moveInput(): number {
    let y = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) y += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) y -= 1;
    return y;
  }

  /** A/Sol = sola dön (-1), D/Sağ = sağa dön (+1). Kamera sürüklemesiyle aynı döndürme mantığı. */
  turnInput(): number {
    let x = 0;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;
    return x;
  }
}
