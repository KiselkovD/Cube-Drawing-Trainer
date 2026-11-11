import { COLORS } from './config.js'
import { analyze } from './graph.js'
import * as L from './layers.js'

export class Renderer {
  constructor({ canvas, state }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = state;
    this.DPR = Math.max(1, window.devicePixelRatio || 1);
    this.w = 0;
    this.h = 0;
    this._resize();
  }

  _resize() {
    const w = this.state.camera.viewportWidth;
    const h = this.state.camera.viewportHeight;
    const bw = Math.floor(w * this.DPR);
    const bh = Math.floor(h * this.DPR);
    if (this.canvas.width !== bw) this.canvas.width = bw;
    if (this.canvas.height !== bh) this.canvas.height = bh;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
    this.w = w;
    this.h = h;
  }

  render() {
    this._resize();
    const ctx = this.ctx;
    const state = this.state;
    const camera = state.camera;
    const mode = state.ui.mode;
    const isPractice = mode === 'practice';
    const isExam = mode === 'exam';
    const isAnalysis = isPractice || isExam;

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, this.w, this.h);

    let analysis = [];
    if (isAnalysis &&
        (state.ui.showRecognized || state.ui.showRawGraph
        || state.ui.showSimplifiedGraph || state.ui.showAnalysisVPs)) {
      const segs = isExam ? state.document.examSegments : state.document.segments;
      analysis = analyze(segs, camera, { fixedCamera: isExam });
    }

    ctx.save();
    ctx.translate(state.view.x, state.view.y);

    L.drawPictureFrame(ctx, camera);

    if (!isPractice) {
      L.drawHorizon(ctx, camera);
      if (state.ui.showSP) L.drawSP(ctx, camera);
      L.drawVP3(ctx, state, camera);
    }

    if (state.ui.visibility.theory) L.drawBoxes(ctx, state, camera);
    if (state.ui.visibility.practice) L.drawSegments(ctx, state, 'practice');
    if (state.ui.visibility.exam) L.drawSegments(ctx, state, 'exam');

    if (isAnalysis) L.drawDraft(ctx, state, camera);

    if (state.ui.showRawGraph) L.drawRawGraph(ctx, analysis);
    if (state.ui.showSimplifiedGraph) L.drawSimplifiedGraph(ctx, analysis);
    if (state.ui.showRecognized) {
      L.drawRecognized(ctx, analysis, camera, state.ui.showGuides);
    }
    if (state.ui.showAnalysisVPs) {
      L.drawAnalysisVPs(ctx, analysis, camera, state.view);
      L.drawAnalysisInfo(ctx, analysis, camera);
    }
    if (isAnalysis && state.ui.showSP) {
      const hasSuccess = analysis.some((r) => r.success);
      if (hasSuccess) L.drawSP(ctx, camera);
    }

    L.drawGroupRadius(ctx, state);

    ctx.restore();
  }
}