import { COLORS, DEFAULTS } from './config.js'
import { add3, angleAtVertex, mulM3M3, rad2deg, scale3 } from './core/math.js'
import { computeVPTriangle } from './perspective.js'

function $(id) { return document.getElementById(id); }

function getSelectedBox(state) {
  return state.document.getSelectedBox();
}

function getByPath(o, path) {
  return path.split('.').reduce((x, k) => (x == null ? null : x[k]), o);
}

function setByPath(o, path, value) {
  const ps = path.split('.');
  let c = o;
  for (let i = 0; i < ps.length - 1; i++) c = c[ps[i]];
  c[ps[ps.length - 1]] = value;
}

function structureKeyForBox(box) {
  if (!box) return 'empty';
  return box.link ? 'linked' : 'simple';
}

// ===== SizePanel =====
// UI: 1..100, реальное значение = UI*10
function buildSizeRow(box, label, key, minUI, maxUI) {
  const realVal = getByPath(box, key);
  const uiVal = Math.round(realVal / 10);
  return `<div class="row">
    <label>${label}</label>
    <input type="range" data-key="${key}" data-unit="ui" min="${minUI}" max="${maxUI}" step="1" value="${uiVal}">
    <span class="val" data-val-key="${key}">${uiVal}</span>
  </div>`;
}

// ===== RotationPanel =====
// UI: -36..36, реальное значение = UI*5° (в радианах)
function buildAngleRow(box, label, key) {
  const realRad = getByPath(box, key);
  const uiVal = Math.round(rad2deg(realRad) / 5);
  return `<div class="row">
    <label>${label}</label>
    <button class="step-btn" data-step-key="${key}" data-step="-1">−</button>
    <input type="range" data-key="${key}" data-unit="ui-deg" min="-36" max="36" step="1" value="${uiVal}">
    <button class="step-btn" data-step-key="${key}" data-step="1">+</button>
    <span class="val" data-val-key="${key}">${uiVal * 5}°</span>
  </div>`;
}

class SizePanel {
  constructor({ state, app }) {
    this.state = state;
    this.app = app;
    this.el = null;
    this.rowsEl = null;
    this.btn = null;
    this._structureKey = null;
    this._lastBoxId = null;
  }

  mount() {
    this.el = $('panelSize');
    this.rowsEl = $('sizeRows');
    this.btn = $('linkToggleBtn');
    this.btn.addEventListener('click', () => {
      const box = getSelectedBox(this.state);
      if (!box) return;
      if (box.link) {
        box.link = null;
      } else {
        box.link = { ...DEFAULTS.linkDefaults };
      }
      this.app.pushHistory();
      this.state.emit();
    });
  }

  update() {
    if (this.state.ui.mode !== 'theory') return;
    const box = getSelectedBox(this.state);
    const key = structureKeyForBox(box);

    if (key === 'empty') {
      if (this._structureKey !== 'empty') {
        this.rowsEl.innerHTML = '<div class="hint">Выберите куб</div>';
        this._structureKey = 'empty';
        this._lastBoxId = null;
      }
      this.btn.disabled = true;
      return;
    }

    this.btn.disabled = false;
    if (box.link) {
      this.btn.textContent = 'Удалить связь';
      this.btn.classList.add('link-remove');
      this.btn.classList.remove('link-add');
    } else {
      this.btn.textContent = 'Создать связь';
      this.btn.classList.add('link-add');
      this.btn.classList.remove('link-remove');
    }

    if (this._structureKey !== key) {
      this._structureKey = key;
      this._build(box);
      this._attachHandlers();
    }
    this._syncValues(box);
  }

  _build(box) {
    let html = '<div class="sec-h">Основной</div>';
    html += buildSizeRow(box, 'Ш', 'size.w', 1, 100);
    html += buildSizeRow(box, 'В', 'size.h', 1, 100);
    html += buildSizeRow(box, 'Г', 'size.dep', 1, 100);
    if (box.link) {
      html += '<div class="sec-h link">Связь</div>';
      html += buildSizeRow(box, 'd1', 'link.d1', 0, 200);
      html += buildSizeRow(box, 'd2', 'link.d2', 0, 200);
      html += '<div class="sec-h sec">Второй</div>';
      html += buildSizeRow(box, 'Ш', 'link.secW', 1, 100);
      html += buildSizeRow(box, 'В', 'link.secH', 1, 100);
      html += buildSizeRow(box, 'Г', 'link.secDep', 1, 100);
    }
    this.rowsEl.innerHTML = html;
  }

  _attachHandlers() {
    this.rowsEl.querySelectorAll('input[data-key]').forEach((inp) => {
      inp.addEventListener('input', (e) => {
        const b = getSelectedBox(this.state);
        if (!b) return;
        const uiVal = Number(e.target.value);
        setByPath(b, e.target.dataset.key, uiVal * 10);
        const sp = this.rowsEl.querySelector(`[data-val-key="${e.target.dataset.key}"]`);
        if (sp) sp.textContent = uiVal;
        this.state.emit();
      });
      inp.addEventListener('change', () => this.app.pushHistory());
    });
  }

  _syncValues(box) {
    const boxChanged = this._lastBoxId !== box.id;   // ← добавили
    this._lastBoxId = box.id;
    this.rowsEl.querySelectorAll('input[data-key]').forEach((inp) => {
      const key = inp.dataset.key;
      const realVal = getByPath(box, key);
      if (realVal == null) return;
      const uiVal = Math.round(realVal / 10);
      if (!boxChanged && document.activeElement === inp) return; 
      if (Number(inp.value) !== uiVal) inp.value = uiVal;
      const sp = this.rowsEl.querySelector(`[data-val-key="${key}"]`);
      if (sp) {
        const txt = String(uiVal);
        if (sp.textContent !== txt) sp.textContent = txt;
      }
    });
  }
}

class RotationPanel {
  constructor({ state, app }) {
    this.state = state;
    this.app = app;
    this.el = null;
    this.rowsEl = null;
    this._structureKey = null;
    this._lastBoxId = null;   
  }

  mount() {
    this.el = $('panelRot');
    this.rowsEl = $('rotRows');
  }

  update() {
    if (this.state.ui.mode !== 'theory') return;
    const box = getSelectedBox(this.state);
    const key = structureKeyForBox(box);

    if (key === 'empty') {
      if (this._structureKey !== 'empty') {
        this.rowsEl.innerHTML = '<div class="hint">—</div>';
        this._structureKey = 'empty';
        this._lastBoxId = null;
      }
      return;
    }

    if (this._structureKey !== key) {
      this._structureKey = key;
      this._build(box);
      this._attachHandlers();
    }
    this._syncValues(box);
  }

  _build(box) {
    let html = '<div class="sec-h">Основной</div>';
    html += buildAngleRow(box, 'X', 'rotation.rx');
    html += buildAngleRow(box, 'Y', 'rotation.ry');
    html += buildAngleRow(box, 'Z', 'rotation.rz');
    html += '<button class="reset-btn" id="resetRotBtn">Сброс</button>';
    if (box.link) {
      html += '<div class="sec-h link">Связь</div>';
      html += buildAngleRow(box, 'θ', 'link.theta');
      html += buildAngleRow(box, 'α', 'link.alpha');
      html += buildAngleRow(box, 'β', 'link.beta');
      html += '<button class="reset-btn link" id="resetLinkBtn">Сброс</button>';
    }
    this.rowsEl.innerHTML = html;
  }

  _attachHandlers() {
    this.rowsEl.querySelectorAll('input[data-key]').forEach((inp) => {
      inp.addEventListener('input', (e) => {
        const b = getSelectedBox(this.state);
        if (!b) return;
        const uiVal = Number(e.target.value);
        setByPath(b, e.target.dataset.key, uiVal * 5 * Math.PI / 180);
        const sp = this.rowsEl.querySelector(`[data-val-key="${e.target.dataset.key}"]`);
        if (sp) sp.textContent = (uiVal * 5) + '°';
        this.state.emit();
      });
      inp.addEventListener('change', () => this.app.pushHistory());
    });

    this.rowsEl.querySelectorAll('.step-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const b = getSelectedBox(this.state);
        if (!b) return;
        const key = btn.dataset.stepKey;
        const delta = Number(btn.dataset.step);
        const curRad = getByPath(b, key);
        const curUI = Math.round(rad2deg(curRad) / 5);
        const newUI = curUI + delta;
        if (newUI < -36 || newUI > 36) return;
        setByPath(b, key, newUI * 5 * Math.PI / 180);
        const sl = this.rowsEl.querySelector(`input[data-key="${key}"]`);
        const sp = this.rowsEl.querySelector(`[data-val-key="${key}"]`);
        if (sl) sl.value = newUI;
        if (sp) sp.textContent = (newUI * 5) + '°';
        this.state.emit();
        this.app.pushHistory();
      });
    });

    const rr = document.getElementById('resetRotBtn');
    if (rr) rr.addEventListener('click', () => {
      const b = getSelectedBox(this.state);
      if (!b) return;
      b.rotation.rx = 0; b.rotation.ry = 0; b.rotation.rz = 0;
      this.state.emit();
      this.app.pushHistory();
    });
    const rl = document.getElementById('resetLinkBtn');
    if (rl) rl.addEventListener('click', () => {
      const b = getSelectedBox(this.state);
      if (!b || !b.link) return;
      b.link.theta = 60 * Math.PI / 180;
      b.link.alpha = 0;
      b.link.beta = 0;
      this.state.emit();
      this.app.pushHistory();
    });
  }

  _syncValues(box) {
    const boxChanged = this._lastBoxId !== box.id;   // ← добавили
    this._lastBoxId = box.id; 
    this.rowsEl.querySelectorAll('input[data-key]').forEach((inp) => {
      const key = inp.dataset.key;
      const realRad = getByPath(box, key);
      if (realRad == null) return;
      const uiVal = Math.round(rad2deg(realRad) / 5);
      if (!boxChanged && document.activeElement === inp) return;
      if (Number(inp.value) !== uiVal) inp.value = uiVal;
      const sp = this.rowsEl.querySelector(`[data-val-key="${key}"]`);
      if (sp) {
        const txt = (uiVal * 5) + '°';
        if (sp.textContent !== txt) sp.textContent = txt;
      }
    });
  }
}

// ===== OrthoPanel — без изменений в структуре, только чтение =====
class OrthoPanel {
  constructor({ state }) { this.state = state; this.el = null; this.rowsEl = null; }
  mount() { this.el = $('panelOrtho'); this.rowsEl = $('orthoRows'); }

  update() {
    if (this.state.ui.mode !== 'theory') return;
    const box = getSelectedBox(this.state);
    if (!box) { this.rowsEl.innerHTML = '<div class="hint">—</div>'; return; }
    const info = computeVPTriangle(box, this.state.camera);
    if (!info) { this.rowsEl.innerHTML = '<div class="hint">—</div>'; return; }

    const fA = (v) => (v == null) ? '—' : v.toFixed(1) + '°';
    let h = '';

    h += '<div class="sec-h ortho">Проверка</div>';
    if (info.vps.x && info.vps.y && info.vps.z) {
      h += `<div class="row"><label>SP=H</label><span class="val ${info.orthocentric ? 'good' : 'bad'}">${info.orthocentric ? '✓' : '✗'}</span></div>`;
      if (info.orthoToSPcm != null && info.orthoToSPcm > 0.01) {
        const tol = Math.max(0.05, 0.01 * Math.abs(info.dCm));
        h += `<div class="row"><label>Δ</label><span class="val ${info.orthoToSPcm < tol ? 'good' : 'bad'}">${info.orthoToSPcm.toFixed(2)}</span></div>`;
      }
    } else {
      h += '<div class="row"><span class="val none">вырожден</span></div>';
    }

    const A = info.vps.x, B = info.vps.y, C = info.vps.z;
    if (A && B && C) {
      const aX = angleAtVertex(A, B, C), aY = angleAtVertex(B, C, A), aZ = angleAtVertex(C, A, B);
      h += '<div class="sec-h ortho">Углы</div>';
      h += `<div class="row"><label>∠X</label><span class="val">${fA(aX)}</span></div>`;
      h += `<div class="row"><label>∠Y</label><span class="val">${fA(aY)}</span></div>`;
      h += `<div class="row"><label>∠Z</label><span class="val">${fA(aZ)}</span></div>`;
      if (aX != null && aY != null && aZ != null) {
        const s = aX + aY + aZ;
        h += `<div class="row"><label>Σ</label><span class="val ${Math.abs(s - 180) < 0.05 ? 'good' : 'bad'}">${s.toFixed(1)}</span></div>`;
      }
    }

    h += '<div class="sec-h ortho">Параметры</div>';
    h += `<div class="row"><label>FOV</label><span class="val">${this.state.camera.fov.toFixed(0)}°</span></div>`;
    h += `<div class="row"><label>d</label><span class="val">${info.dCm.toFixed(2)}</span></div>`;
    h += `<div class="row"><label>□</label><span class="val">${this.state.camera.pictureSizeCm} см</span></div>`;

    this.rowsEl.innerHTML = h;
  }
}

// ===== EdgeDimsPanel — размеры 12 рёбер + 3 центральных отрезков =====
class EdgeDimsPanel {
  constructor({ state }) {
    this.state = state;
    this.el = null;
    this.rowsEl = null;
  }

  mount() {
    this.el = $('panelEdgeDims');
    this.rowsEl = $('edgeDimsRows');
  }

  update() {
    if (this.state.ui.mode !== 'theory') return;
    if (!this.state.ui.showEdgeDims) return;

    const box = getSelectedBox(this.state);
    if (!box) { this.rowsEl.innerHTML = '<div class="hint">Выберите куб</div>'; return; }

    const camera = this.state.camera;
    const cmPerPx = camera.pictureSizeCm / camera.pictureRect.w;

    const main_cam = box.getMainCenterCam(camera);
    const R_main = box.getRotationMatrix();
    const R_main_cam = mulM3M3(camera.R_wc, R_main);

    const { w, h, dep } = box.size;

    const axisKeys = ['x', 'y', 'z'];
    const axisNames = ['VPx', 'VPy', 'VPz'];
    const axisSizes = [w, h, dep];

    const edgeGroups = [
      { axis: 0, edges: [[0, 1], [3, 2], [4, 5], [7, 6]] },
      { axis: 1, edges: [[0, 3], [1, 2], [4, 7], [5, 6]] },
      { axis: 2, edges: [[0, 4], [1, 5], [2, 6], [3, 7]] },
    ];

        const pp = camera.principalPoint;
    const d = camera.focalLength;
    const cc = camera.project3D(main_cam);

    function vpOf(colIdx) {
      const dir = [R_main_cam[0][colIdx], R_main_cam[1][colIdx], R_main_cam[2][colIdx]];
      if (Math.abs(dir[2]) < 1e-6) return null;
      return { x: pp.x + d * dir[0] / dir[2], y: pp.y - d * dir[1] / dir[2] };
    }

    let out = '';

    const depthPx = main_cam[2] - d;
    const depthCm = depthPx * cmPerPx;
    const rayPx = Math.hypot(main_cam[0], main_cam[1], main_cam[2]);
    const rayCm = rayPx * cmPerPx;

    out += `<div class="sec-h" style="color:#c8c8c8">Центр</div>`;
    out += `<div class="row"><label>Depth</label><span class="val">${depthPx.toFixed(0)}px</span><span class="val cm">${depthCm.toFixed(2)}</span></div>`;
    out += `<div class="row"><label>Ray</label><span class="val">${rayPx.toFixed(0)}px</span><span class="val cm">${rayCm.toFixed(2)}</span></div>`;

    for (let ax = 0; ax < 3; ax++) {
      const rgb = COLORS.vp[axisKeys[ax]];
      const colorHex = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;

      out += `<div class="sec-h" style="color:${colorHex}">${axisNames[ax]}</div>`;

      const halfSize = axisSizes[ax] / 2;
      const axisDir = [R_main_cam[0][ax], R_main_cam[1][ax], R_main_cam[2][ax]];
      const endA = add3(main_cam, scale3(axisDir, -halfSize));
      const endB = add3(main_cam, scale3(axisDir, halfSize));
      const sa = camera.project3D(endA);
      const sb = camera.project3D(endB);
      if (sa && sb) {
        const lenPx = Math.hypot(sb.x - sa.x, sb.y - sa.y);
        const lenCm = lenPx * cmPerPx;
        out += `<div class="row"><label>Len</label><span class="val">${lenPx.toFixed(0)}px</span><span class="val cm">${lenCm.toFixed(2)}</span></div>`;
      }

      const vp = vpOf(ax);
      if (cc && vp) {
        const distPx = Math.hypot(vp.x - cc.x, vp.y - cc.y);
        out += `<div class="row"><label>VP</label><span class="val" style="grid-column:span 2;text-align:right">${distPx.toFixed(0)}px</span></div>`;
      } else {
        out += `<div class="row"><label>VP</label><span class="val" style="grid-column:span 2;text-align:right">∞</span></div>`;
      }
    }

    this.rowsEl.innerHTML = out;
  }
}

// ===== SnapPanel, StylePanel — без ползунков, DOM не пересоздаётся при update =====
class SnapPanel {
  constructor({ state }) { this.state = state; this.el = null; }
  mount() {
    this.el = $('panelSnap');
    this.el.querySelectorAll('.snap-seg[data-target^="snap"]').forEach((seg) => {
      seg.querySelectorAll('.snap-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.state.ui[seg.dataset.target] = btn.dataset.val;
          seg.querySelectorAll('.snap-btn').forEach((b) => b.classList.toggle('active', b === btn));
        });
      });
    });
  }
  update() {
    this.el.querySelectorAll('.snap-seg[data-target^="snap"]').forEach((seg) => {
      const target = seg.dataset.target;
      const val = this.state.ui[target];
      seg.querySelectorAll('.snap-btn').forEach((b) => b.classList.toggle('active', b.dataset.val === val));
    });
  }
}

export function createPanels({ state, app }) {
  const size = new SizePanel({ state, app });
  const rotation = new RotationPanel({ state, app });
  const ortho = new OrthoPanel({ state });
  const edgeDims = new EdgeDimsPanel({ state });
  const snap = new SnapPanel({ state });

  return {
    mount() {
      size.mount();
      rotation.mount();
      ortho.mount();
      edgeDims.mount();
      snap.mount();
    },
    update() {
      const tm = state.ui.tablesMode;
      const mode = state.ui.mode;

      if (mode === 'practice' || mode === 'exam') {
        if (tm === 'size' || tm === 'full') snap.update();
      } else {
        if (tm === 'size' || tm === 'full') size.update();
        if (tm === 'rotation' || tm === 'full') rotation.update();
        if (state.ui.showOrthoTable) ortho.update();
        if (state.ui.showEdgeDims) edgeDims.update();
      }
    },
  };
}