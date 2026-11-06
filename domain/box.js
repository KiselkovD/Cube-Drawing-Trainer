import { DEFAULTS } from '../config.js'
import { rotationMatrixXYZ } from '../core/math.js'

export class Box {
  constructor({ id, center, size, rotation, link = null }) {
    this.id = id;
    this.center = { x: center.x, y: center.y };
    this.size = { w: size.w, h: size.h, dep: size.dep };
    this.rotation = { rx: rotation.rx || 0, ry: rotation.ry || 0, rz: rotation.rz || 0 };
    this.link = link ? { ...link } : null;
  }

  static default({ id, center }) {
    return new Box({
      id,
      center: center || { x: 0, y: 0 },
      size: { ...DEFAULTS.boxSize },
      rotation: { rx: 0, ry: 0, rz: 0 },
      link: null,
    });
  }

  static defaultLinked({ id, center }) {
    return new Box({
      id,
      center: center || { x: 0, y: 0 },
      size: { ...DEFAULTS.boxSize },
      rotation: { rx: 0, ry: 0, rz: 0 },
      link: { ...DEFAULTS.linkDefaults },
    });
  }

  getRotationMatrix() {
    return rotationMatrixXYZ(this.rotation.rx, this.rotation.ry, this.rotation.rz);
  }

  hasLink() { return !!this.link; }

  getMainCenterCam(camera) {
    const pp = camera.principalPoint;
    const d = camera.focalLength;
    const Z0 = 2 * d;
    return [
      (this.center.x - pp.x) * Z0 / d,
      -(this.center.y - pp.y) * Z0 / d,
      Z0,
    ];
  }

  toSnapshot() {
    return {
      id: this.id,
      center: { x: this.center.x, y: this.center.y },
      size: { w: this.size.w, h: this.size.h, dep: this.size.dep },
      rotation: { rx: this.rotation.rx, ry: this.rotation.ry, rz: this.rotation.rz },
      link: this.link ? { ...this.link } : null,
    };
  }

  static fromSnapshot(s) {
    return new Box({
      id: s.id,
      center: { x: s.center.x, y: s.center.y },
      size: { w: s.size.w, h: s.size.h, dep: s.size.dep },
      rotation: { rx: s.rotation.rx, ry: s.rotation.ry, rz: s.rotation.rz },
      link: s.link ? { ...s.link } : null,
    });
  }
}