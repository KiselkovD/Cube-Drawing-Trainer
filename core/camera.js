import { DEFAULTS } from '../config.js'

export class Camera {
  constructor({ fov = DEFAULTS.fov, horizonOffset = 0, pictureSizeCm = DEFAULTS.pictureSizeCm, viewportWidth = 800, viewportHeight = 600 } = {}) {
    this.fov = fov;
    this.horizonOffset = horizonOffset;
    this.pictureSizeCm = pictureSizeCm;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
  }

  setViewport(w, h) {
    this.viewportWidth = w;
    this.viewportHeight = h;
  }

  get pictureRect() {
    const availW = this.viewportWidth - 16;
    const availH = this.viewportHeight - DEFAULTS.bottomBarHeightPx - 16;
    const sq = Math.max(80, Math.min(availW, availH) * 0.98);
    return {
      x: this.viewportWidth / 2 - sq / 2,
      y: (this.viewportHeight - DEFAULTS.bottomBarHeightPx) / 2 - sq / 2,
      w: sq,
      h: sq,
    };
  }

  get principalPoint() {
    const r = this.pictureRect;
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }

  get focalLength() {
    const r = this.pictureRect;
    return (r.w / 2) / Math.tan(this.fov * Math.PI / 360);
  }

  get horizonY() {
    const r = this.pictureRect;
    return this.principalPoint.y - this.horizonOffset * r.w;
  }

  get distanceToScreenCm() {
    return (this.pictureSizeCm / 2) / Math.tan(this.fov * Math.PI / 360);
  }

  get R_wc() {
    const r = this.pictureRect;
    const d = this.focalLength;
    const phi = Math.atan(this.horizonOffset * r.w / d);
    const yaw = Math.PI / 4;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(phi), sp = Math.sin(phi);
    return [
      [cy, 0, -sy],
      [sy * sp, cp, sp * cy],
      [sy * cp, -sp, cp * cy],
    ];
  }

  screenToWorld(screen, view) {
    return { x: screen.x - view.x, y: screen.y - view.y };
  }

  worldToScreen(world, view) {
    return { x: world.x + view.x, y: world.y + view.y };
  }

  project3D(p3) {
    if (p3[2] <= 0.01) return null;
    const pp = this.principalPoint;
    const d = this.focalLength;
    return { x: pp.x + d * p3[0] / p3[2], y: pp.y - d * p3[1] / p3[2] };
  }

  cameraContext() {
    const pp = this.principalPoint;
    return { picCx: pp.x, picCy: pp.y, d: this.focalLength };
  }
}