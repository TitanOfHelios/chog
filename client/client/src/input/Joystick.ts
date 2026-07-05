import { CONFIG } from '../config';

/**
 * Harici kütüphane (nipplejs) kullanmayan, basit ve öngörülebilir sanal joystick.
 *
 * Davranış tamamen düz: parmağı/fareyi merkezden ne kadar sağa çekersen
 * vec.x o kadar sağa (+1), sola çekersen o kadar sola (-1) gider. Yukarı
 * çekersen vec.y ileri (+1), aşağı çekersen geri (-1) gider. Ekstra "baskın
 * eksen bastırma" ya da açı/kuvvetten yeniden hesaplama gibi dolaylı bir
 * mantık yok — bu yüzden "sağa basınca dönüyor ama gitmiyor" gibi
 * kafa karıştırıcı davranışlar oluşmaz.
 *
 * vec.x: -1 (sol) .. 1 (sağ)
 * vec.y: -1 (geri) .. 1 (ileri)
 */
export class Joystick {
  vec = { x: 0, y: 0 };

  private readonly knob: HTMLDivElement;
  private radius = 55; // px — knob'un merkezden gidebileceği en uzak mesafe
  private readonly DEADZONE = CONFIG.JOYSTICK_DEADZONE;

  private activeId: number | 'mouse' | null = null;
  private originX = 0;
  private originY = 0;

  private readonly onTouchStart = (e: TouchEvent): void => {
    if (this.activeId !== null) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    this.begin(t.clientX, t.clientY, t.identifier);
  };

  private readonly onTouchMove = (e: TouchEvent): void => {
    if (this.activeId === null) return;
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.activeId) {
        e.preventDefault();
        this.update(t.clientX, t.clientY);
        break;
      }
    }
  };

  private readonly onTouchEnd = (e: TouchEvent): void => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.activeId) {
        this.reset();
        break;
      }
    }
  };

  private readonly onMouseDown = (e: MouseEvent): void => {
    if (this.activeId !== null) return;
    e.preventDefault();
    this.begin(e.clientX, e.clientY, 'mouse');
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
  };

  private readonly onMouseMove = (e: MouseEvent): void => {
    this.update(e.clientX, e.clientY);
  };

  private readonly onMouseUp = (): void => {
    this.reset();
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
  };

  constructor(private readonly zone: HTMLElement) {
    this.knob = document.createElement('div');
    this.knob.className = 'joyKnob';
    zone.appendChild(this.knob);
    this.radius = Math.max(30, zone.clientWidth / 2 - this.knob.offsetWidth / 2 || 55);

    zone.addEventListener('touchstart', this.onTouchStart, { passive: false });
    zone.addEventListener('touchmove', this.onTouchMove, { passive: false });
    zone.addEventListener('touchend', this.onTouchEnd, { passive: false });
    zone.addEventListener('touchcancel', this.onTouchEnd, { passive: false });
    zone.addEventListener('mousedown', this.onMouseDown);
  }

  private begin(clientX: number, clientY: number, id: number | 'mouse'): void {
    this.activeId = id;
    const rect = this.zone.getBoundingClientRect();
    this.originX = rect.left + rect.width / 2;
    this.originY = rect.top + rect.height / 2;
    this.update(clientX, clientY);
  }

  private update(clientX: number, clientY: number): void {
    let dx = clientX - this.originX;
    let dy = clientY - this.originY;
    const dist = Math.hypot(dx, dy);
    if (dist > this.radius) {
      dx = (dx / dist) * this.radius;
      dy = (dy / dist) * this.radius;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;

    // Ekranda aşağı yön pozitif Y'dir; "yukarı = ileri (+1)" olması için ters çeviriyoruz.
    const rawX = dx / this.radius;
    const rawY = -dy / this.radius;

    this.vec.x = this.applyDeadzone(rawX);
    this.vec.y = this.applyDeadzone(rawY);
  }

  private applyDeadzone(v: number): number {
    if (Math.abs(v) < this.DEADZONE) return 0;
    return Math.max(-1, Math.min(1, v));
  }

  private reset(): void {
    this.activeId = null;
    this.vec.x = 0;
    this.vec.y = 0;
    this.knob.style.transform = 'translate(0px, 0px)';
  }

  destroy(): void {
    this.zone.removeEventListener('touchstart', this.onTouchStart);
    this.zone.removeEventListener('touchmove', this.onTouchMove);
    this.zone.removeEventListener('touchend', this.onTouchEnd);
    this.zone.removeEventListener('touchcancel', this.onTouchEnd);
    this.zone.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.knob.remove();
  }
}
