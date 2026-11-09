import { THRESHOLDS } from './config.js'
import { Box } from './domain/box.js'
import { Segment } from './domain/segment.js'

function getSegmentsForMode(state) {
  return state.ui.mode === 'exam' ? state.document.examSegments : state.document.segments;
}

function getPracticePoints(state) {
  const pts = [];
  for (const s of getSegmentsForMode(state)) {
    pts.push({ x: s.a.x, y: s.a.y });
    pts.push({ x: s.b.x, y: s.b.y });
  }
  return pts;
}

function snapToPoints(state, w) {
  const pts = getPracticePoints(state);
  let best = null, bestDist = THRESHOLDS.snapPointPx;
  for (const p of pts) {
    const d = Math.hypot(p.x - w.x, p.y - w.y);
    if (d < bestDist) { best = p; bestDist = d; }
  }
  return best ? { x: best.x, y: best.y, type: 'point' } : null;
}

function snapToLines(state, w) {
  let bestSeg = null, bestDist = THRESHOLDS.snapLinePx;
  for (const s of getSegmentsForMode(state)) {
    const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const d = Math.abs((w.x - s.a.x) * dy - (w.y - s.a.y) * dx) / len;
    if (d < bestDist) { bestSeg = s; bestDist = d; }
  }
  if (bestSeg) {
    const proj = bestSeg.projectPoint(w);
    return { x: proj.x, y: proj.y, type: 'line' };
  }
  return null;
}

export function applySnap(state, w, mode) {
  if (mode === 'points') return snapToPoints(state, w);
  if (mode === 'lines') return snapToLines(state, w);
  return null;
}

export class Tool {
  constructor({ state, history }) { this.state = state; this.history = history; }
  get name() { return 'base'; }
  get cursor() { return 'default'; }
  onPointerDown() {}
  onPointerMove() {}
  onPointerUp() {}
  onPointerCancel() {}
}

export class CreateBoxTool extends Tool {
  get name() { return 'create'; }
  get cursor() { return 'crosshair'; }
  onPointerDown(world) {
    const box = Box.default({ id: 'b' + this.state.document.nextBoxId++, center: world });
    this.state.document.addBox(box);
    this.state.document.selectedBoxId = box.id;
    this.history.push(this.state.document);
    this.state.emit();
  }
}

export class CreateLinkTool extends Tool {
  get name() { return 'link'; }
  get cursor() { return 'crosshair'; }
  onPointerDown(world) {
    const box = Box.defaultLinked({ id: 'b' + this.state.document.nextBoxId++, center: world });
    box.link.theta = 60 * Math.PI / 180;
    this.state.document.addBox(box);
    this.state.document.selectedBoxId = box.id;
    this.history.push(this.state.document);
    this.state.emit();
  }
}

export class MoveTool extends Tool {
  constructor(ctx) {
    super(ctx);
    this.drag = null;
  }
  get name() { return 'move'; }
  get cursor() { return 'move'; }

  _hitVP3(w) {
    if (this.state.ui.mode === 'practice') return false;
    const cam = this.state.camera;
    const r = cam.pictureRect;
    const d = cam.focalLength;
    const pp = cam.principalPoint;
    const tanTheta = this.state.camera.horizonOffset * r.w / d;
    if (Math.abs(tanTheta) < 1e-6) return false;
    const vpY = pp.y + d / tanTheta;
    if (vpY < THRESHOLDS.vp3MinMarginPx || vpY > cam.viewportHeight - THRESHOLDS.vp3MinMarginPx) return false;
    return Math.hypot(pp.x - w.x, vpY - w.y) < THRESHOLDS.hitVP3Px;
  }

  onPointerDown(world) {
    this.state.interaction.draft = null;
    if (this._hitVP3(world)) {
      this.drag = { kind: 'vp3' };
      return;
    }
    const mode = this.state.ui.mode;
    if (mode === 'theory') {
      const box = this.state.document.hitBox(world, THRESHOLDS.hitBoxPx);
      if (box) {
        this.state.document.selectedBoxId = box.id;
        this.drag = { kind: 'box', boxId: box.id, start: { x: box.center.x, y: box.center.y }, world };
        this.state.emit();
        return;
      }
    }
    if (mode === 'practice' || mode === 'exam') {
      const ep = this.state.document.hitSegmentEndpoint(world, THRESHOLDS.hitSegEndpointPx, mode);
      if (ep) {
        const list = mode === 'exam' ? this.state.document.examSegments : this.state.document.segments;
        const seg = list.find((s) => s.id === ep.segId);
        if (mode === 'exam') this.state.document.selectedExamSegmentId = ep.segId;
        else this.state.document.selectedSegmentId = ep.segId;
        this.drag = { kind: 'endpoint', segId: ep.segId, end: ep.end, mode, orig: { x: seg[ep.end].x, y: seg[ep.end].y }, world };
        this.state.emit();
        return;
      }
      const body = this.state.document.hitSegmentBody(world, THRESHOLDS.hitSegBodyPx, mode);
      if (body) {
        if (mode === 'exam') this.state.document.selectedExamSegmentId = body.id;
        else this.state.document.selectedSegmentId = body.id;
        this.drag = { kind: 'select' };
        this.state.emit();
        return;
      }
      if (mode === 'exam') this.state.document.selectedExamSegmentId = null;
      else this.state.document.selectedSegmentId = null;
    }
    this.drag = { kind: 'pan', world };
  }

  onPointerMove(world) {
    if (!this.drag) return;
    const d = this.drag;
    if (d.kind === 'box') {
      const box = this.state.document.boxes.find((b) => b.id === d.boxId);
      if (box) {
        box.center.x = d.start.x + (world.x - d.world.x);
        box.center.y = d.start.y + (world.y - d.world.y);
      }
    } else if (d.kind === 'pan') {
      this.state.view.x += world.x - d.world.x;
      this.state.view.y += world.y - d.world.y;
    } else if (d.kind === 'endpoint') {
      const list = d.mode === 'exam' ? this.state.document.examSegments : this.state.document.segments;
      const seg = list.find((s) => s.id === d.segId);
      if (seg) {
        seg[d.end].x = d.orig.x + (world.x - d.world.x);
        seg[d.end].y = d.orig.y + (world.y - d.world.y);
      }
    } else if (d.kind === 'vp3') {
      const cam = this.state.camera;
      const pp = cam.principalPoint;
      const r = cam.pictureRect;
      const dY = world.y - pp.y;
      if (Math.abs(dY) < 5) return;
      const newOff = Math.max(-1.5, Math.min(1.5, (cam.focalLength / dY) * cam.focalLength / r.w));
      cam.horizonOffset = newOff;
    }
    this.state.emit();
  }

  onPointerUp() {
    if (!this.drag) return;
    if (this.drag.kind !== 'pan' && this.drag.kind !== 'select') {
      this.history.push(this.state.document);
    }
    this.drag = null;
    this.state.emit();
  }

  onPointerCancel() { this.drag = null; }
}

export class SegmentTool extends Tool {
  constructor(ctx) {
    super(ctx);
    this.gestureMoved = false;
  }
  get name() { return 'segment'; }
  get cursor() { return 'crosshair'; }

  onPointerDown(world) {
    const st = this.state;
    const draft = st.interaction.draft;
    if (draft) {
      const dx = world.x - draft.startX, dy = world.y - draft.startY;
      if (Math.hypot(dx, dy) < THRESHOLDS.minSegLenPx) {
        st.interaction.draft = null;
        st.emit();
        return;
      }
      const endSnap = applySnap(st, world, st.ui.snapEnd);
      this._commit(draft.startX, draft.startY, endSnap ? endSnap.x : world.x, endSnap ? endSnap.y : world.y);
      return;
    }
    const startSnap = applySnap(st, world, st.ui.snapStart);
    st.interaction.draft = {
      startX: startSnap ? startSnap.x : world.x,
      startY: startSnap ? startSnap.y : world.y,
      cursorX: world.x, cursorY: world.y,
      cursorSnapType: null,
    };
    this.gestureMoved = false;
    st.emit();
  }

  onPointerMove(world) {
    const st = this.state;
    const draft = st.interaction.draft;
    if (!draft) return;
    const endSnap = applySnap(st, world, st.ui.snapEnd);
    draft.cursorX = endSnap ? endSnap.x : world.x;
    draft.cursorY = endSnap ? endSnap.y : world.y;
    draft.cursorSnapType = endSnap ? endSnap.type : null;
    const dx = world.x - draft.startX, dy = world.y - draft.startY;
    if (Math.hypot(dx, dy) > THRESHOLDS.dragThresholdPx) this.gestureMoved = true;
    st.emit();
  }

  onPointerUp(world) {
    const st = this.state;
    const draft = st.interaction.draft;
    if (!draft) { this.gestureMoved = false; return; }
    if (this.gestureMoved) {
      const endSnap = applySnap(st, world, st.ui.snapEnd);
      this._commit(draft.startX, draft.startY, endSnap ? endSnap.x : world.x, endSnap ? endSnap.y : world.y);
    }
    this.gestureMoved = false;
  }

  onPointerCancel() {
    this.gestureMoved = false;
    if (this.state.interaction.draft) {
      this.state.interaction.draft = null;
      this.state.emit();
    }
  }

  _commit(startX, startY, endX, endY) {
    const st = this.state;
    if (Math.hypot(endX - startX, endY - startY) < THRESHOLDS.minSegLenPx) {
      st.interaction.draft = null;
      st.emit();
      return;
    }
    const isExam = st.ui.mode === 'exam';
    const id = isExam ? ('ex' + st.document.nextExamSegmentId++) : ('sg' + st.document.nextSegmentId++);
    const seg = new Segment({
      id,
      a: { x: startX, y: startY },
      b: { x: endX, y: endY },
      style: st.ui.defaultSegmentStyle,
    });
    if (isExam) st.document.addExamSegment(seg);
    else st.document.addSegment(seg);
    st.interaction.draft = null;
    this.history.push(st.document);
    st.emit();
  }
}

export class EraseTool extends Tool {
  constructor(ctx) {
    super(ctx);
    this.drag = null;
  }
  get name() { return 'erase'; }
  get cursor() { return 'crosshair'; }

  onPointerDown(world) {
    const st = this.state;
    const mode = st.ui.mode;
    const hit = st.document.hitSegmentBody(world, THRESHOLDS.hitSegBodyPx, mode);
    if (hit) {
      if (mode === 'exam') st.document.removeExamSegment(hit.id);
      else st.document.removeSegment(hit.id);
      this.history.push(st.document);
      st.emit();
      return;
    }
    this.drag = { kind: 'pan', world };
  }

  onPointerMove(world) {
    if (!this.drag) return;
    const st = this.state;
    st.view.x += world.x - this.drag.world.x;
    st.view.y += world.y - this.drag.world.y;
    st.emit();
  }

  onPointerUp() { this.drag = null; }
  onPointerCancel() { this.drag = null; }
}

export function createTools({ state, history }) {
  const ctx = { state, history };
  return {
    create: new CreateBoxTool(ctx),
    link: new CreateLinkTool(ctx),
    move: new MoveTool(ctx),
    segment: new SegmentTool(ctx),
    erase: new EraseTool(ctx),
  };
}