export class Segment {
  constructor({ id, a, b, style = 'solid' }) {
    this.id = id;
    this.a = { x: a.x, y: a.y };
    this.b = { x: b.x, y: b.y };
    this.style = style;
  }

  getMid() { return { x: (this.a.x + this.b.x) / 2, y: (this.a.y + this.b.y) / 2 }; }
  getLength() { return Math.hypot(this.b.x - this.a.x, this.b.y - this.a.y); }

  projectPoint(p) {
    const dx = this.b.x - this.a.x, dy = this.b.y - this.a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-9) return { x: this.a.x, y: this.a.y, t: 0 };
    const t = ((p.x - this.a.x) * dx + (p.y - this.a.y) * dy) / len2;
    return { x: this.a.x + t * dx, y: this.a.y + t * dy, t };
  }

  distanceTo(p) {
    const pr = this.projectPoint(p);
    const tClamped = Math.max(0, Math.min(1, pr.t));
    const cx = this.a.x + tClamped * (this.b.x - this.a.x);
    const cy = this.a.y + tClamped * (this.b.y - this.a.y);
    return Math.hypot(p.x - cx, p.y - cy);
  }

  hitTest(p, tolerance) {
    return this.distanceTo(p) < tolerance;
  }

  toSnapshot() {
    return {
      id: this.id,
      a: { x: this.a.x, y: this.a.y },
      b: { x: this.b.x, y: this.b.y },
      style: this.style,
    };
  }

  static fromSnapshot(s) {
    return new Segment({
      id: s.id,
      a: { x: s.a.x, y: s.a.y },
      b: { x: s.b.x, y: s.b.y },
      style: s.style,
    });
  }
}