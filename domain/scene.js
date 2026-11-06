import { Box } from './box.js'
import { Segment } from './segment.js'

export class Scene {
  constructor() {
    this.boxes = [];
    this.segments = [];
    this.examSegments = [];
    this.selectedBoxId = null;
    this.selectedSegmentId = null;
    this.selectedExamSegmentId = null;
    this.nextBoxId = 1;
    this.nextSegmentId = 1;
    this.nextExamSegmentId = 1;
  }

  addBox(box) { this.boxes.push(box); }
  removeBox(id) {
    this.boxes = this.boxes.filter((b) => b.id !== id);
    if (this.selectedBoxId === id) this.selectedBoxId = null;
  }
  getSelectedBox() { return this.boxes.find((b) => b.id === this.selectedBoxId) || null; }

  hitBox(world, tolerance) {
    for (let i = this.boxes.length - 1; i >= 0; i--) {
      const b = this.boxes[i];
      if (Math.hypot(b.center.x - world.x, b.center.y - world.y) < tolerance) return b;
    }
    return null;
  }

  addSegment(seg) { this.segments.push(seg); }
  removeSegment(id) {
    this.segments = this.segments.filter((s) => s.id !== id);
    if (this.selectedSegmentId === id) this.selectedSegmentId = null;
  }
  getSelectedSegment() { return this.segments.find((s) => s.id === this.selectedSegmentId) || null; }

  addExamSegment(seg) { this.examSegments.push(seg); }
  removeExamSegment(id) {
    this.examSegments = this.examSegments.filter((s) => s.id !== id);
    if (this.selectedExamSegmentId === id) this.selectedExamSegmentId = null;
  }
  getSelectedExamSegment() { return this.examSegments.find((s) => s.id === this.selectedExamSegmentId) || null; }

  getSegmentsForMode(mode) {
    return mode === 'exam' ? this.examSegments : this.segments;
  }

  hitSegmentBody(world, tolerance, mode = 'practice') {
    const list = this.getSegmentsForMode(mode);
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].hitTest(world, tolerance)) return list[i];
    }
    return null;
  }

  hitSegmentEndpoint(world, tolerance, mode = 'practice') {
    const list = this.getSegmentsForMode(mode);
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      if (Math.hypot(s.a.x - world.x, s.a.y - world.y) < tolerance) return { segId: s.id, end: 'a', mode };
      if (Math.hypot(s.b.x - world.x, s.b.y - world.y) < tolerance) return { segId: s.id, end: 'b', mode };
    }
    return null;
  }

  toSnapshot() {
    return {
      boxes: this.boxes.map((b) => b.toSnapshot()),
      segments: this.segments.map((s) => s.toSnapshot()),
      examSegments: this.examSegments.map((s) => s.toSnapshot()),
      selectedBoxId: this.selectedBoxId,
      selectedSegmentId: this.selectedSegmentId,
      selectedExamSegmentId: this.selectedExamSegmentId,
      nextBoxId: this.nextBoxId,
      nextSegmentId: this.nextSegmentId,
      nextExamSegmentId: this.nextExamSegmentId,
    };
  }

  static fromSnapshot(s) {
    const sc = new Scene();
    sc.boxes = (s.boxes || []).map((b) => Box.fromSnapshot(b));
    sc.segments = (s.segments || []).map((seg) => Segment.fromSnapshot(seg));
    sc.examSegments = (s.examSegments || []).map((seg) => Segment.fromSnapshot(seg));
    sc.selectedBoxId = s.selectedBoxId ?? null;
    sc.selectedSegmentId = s.selectedSegmentId ?? null;
    sc.selectedExamSegmentId = s.selectedExamSegmentId ?? null;
    sc.nextBoxId = s.nextBoxId ?? 1;
    sc.nextSegmentId = s.nextSegmentId ?? 1;
    sc.nextExamSegmentId = s.nextExamSegmentId ?? 1;
    return sc;
  }
}