import * as THREE from 'three';
import { CONFIG } from '../config';

export class CameraRig {
  yaw = 0;
  pitch = CONFIG.CAMERA_PITCH;
  distance = CONFIG.CAMERA_DISTANCE;
  readonly lookOffset = new THREE.Vector3(0, 1.4, 0);
  readonly position = new THREE.Vector3(0, 4, -7);

  private readonly MIN_PITCH = 0.08;
  private readonly MAX_PITCH = 1.35;
  private readonly MIN_DIST = CONFIG.CAMERA_DISTANCE_MIN;
  private readonly MAX_DIST = CONFIG.CAMERA_DISTANCE_MAX;
  private readonly DRAG_SENS = 0.008;

  private drag = { active: false, id: null as number | 'mouse' | null, lastX: 0, lastY: 0 };
  private pinch = { active: false, startDist: 0, startCamDist: 0 };

  constructor(private canvas: HTMLCanvasElement) {
    canvas.addEventListener('touchstart', this.onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', this.onTouchMove, { passive: true });
    canvas.addEventListener('touchend', this.onTouchEnd, { passive: true });
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  private touchDist(a: Touch, b: Touch): number {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private dragStart(x: number, y: number, id: number | 'mouse'): void {
    this.drag.active = true;
    this.drag.id = id;
    this.drag.lastX = x;
    this.drag.lastY = y;
  }

  private dragMove(x: number, y: number): void {
    if (!this.drag.active) return;
    const dx = x - this.drag.lastX;
    const dy = y - this.drag.lastY;
    this.drag.lastX = x;
    this.drag.lastY = y;
    this.yaw -= dx * this.DRAG_SENS;
    this.pitch += dy * this.DRAG_SENS;
    this.pitch = Math.max(this.MIN_PITCH, Math.min(this.MAX_PITCH, this.pitch));
  }

  private dragEnd(): void {
    this.drag.active = false;
    this.drag.id = null;
  }

  private onTouchStart = (e: TouchEvent): void => {
    if (e.touches.length === 2) {
      this.pinch.active = true;
      this.drag.active = false;
      this.pinch.startDist = this.touchDist(e.touches[0], e.touches[1]);
      this.pinch.startCamDist = this.distance;
    } else if (e.touches.length === 1 && !this.pinch.active) {
      const t = e.touches[0];
      this.dragStart(t.clientX, t.clientY, t.identifier);
    }
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (this.pinch.active && e.touches.length === 2) {
      const d = this.touchDist(e.touches[0], e.touches[1]);
      const scale = this.pinch.startDist / Math.max(1, d);
      this.distance = Math.max(this.MIN_DIST, Math.min(this.MAX_DIST, this.pinch.startCamDist * scale));
    } else if (this.drag.active) {
      for (const t of Array.from(e.touches)) {
        if (t.identifier === this.drag.id) {
          this.dragMove(t.clientX, t.clientY);
          break;
        }
      }
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    if (e.touches.length < 2) this.pinch.active = false;
    if (e.touches.length === 0) this.dragEnd();
  };

  private onMouseDown = (e: MouseEvent): void => {
    this.dragStart(e.clientX, e.clientY, 'mouse');
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
  };
  private onMouseMove = (e: MouseEvent): void => this.dragMove(e.clientX, e.clientY);
  private onMouseUp = (): void => {
    this.dragEnd();
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.distance = Math.max(this.MIN_DIST, Math.min(this.MAX_DIST, this.distance + e.deltaY * 0.01));
  };

  get isDragging(): boolean {
    return this.drag.active;
  }

  /** Klavye (A/D) ile PUBG tarzı döndürme: sürüklemeyle aynı yön kuralını kullanır. */
  turn(deltaYaw: number): void {
    this.yaw -= deltaYaw;
  }

  update(dt: number, targetPos: THREE.Vector3, camera: THREE.PerspectiveCamera): void {
    const horiz = Math.cos(this.pitch) * this.distance;
    const vert = Math.sin(this.pitch) * this.distance;
    const desired = new THREE.Vector3(
      targetPos.x - Math.sin(this.yaw) * horiz,
      targetPos.y + 1.2 + vert,
      targetPos.z - Math.cos(this.yaw) * horiz
    );
    this.position.lerp(desired, 1 - Math.pow(0.0001, dt));
    camera.position.copy(this.position);
    camera.lookAt(new THREE.Vector3().copy(targetPos).add(this.lookOffset));
  }
}
