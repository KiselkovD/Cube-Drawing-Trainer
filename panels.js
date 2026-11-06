import { angleAtVertex, rad2deg } from './core/math.js'
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
  }

  mount() {
    this.el = $('panelSize');
    this.rowsEl = $('sizeRows');
    this.btn = $('deleteBtn');
    this.btn.addEventListener('click', () => {
      const box = getSelectedBox(this.state);
      if (!box) return;
      this.state.document.removeBox(box.id);
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
      }
      this.btn.disabled = true;
      return;
    }

    this.btn.disabled = false;

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
    this.rowsEl.querySelectorAll('input[data-key]').forEach((inp) => {
      const key = inp.dataset.key;
      const realVal = getByPath(box, key);
      if (realVal == null) return;
      const uiVal = Math.round(realVal / 10);
      // не трогаем value, если пользователь сейчас держит этот ползунок
      if (document.activeElement === inp) return;
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
    this.rowsEl.querySelectorAll('input[data-key]').forEach((inp) => {
      const key = inp.dataset.key;
      const realRad = getByPath(box, key);
      if (realRad == null) return;
      const uiVal = Math.round(rad2deg(realRad) / 5);
      if (document.activeElement === inp) return;
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

class StylePanel {
  constructor({ state, app }) { this.state = state; this.app = app; this.el = null; }
  mount() {
    this.el = $('panelSegStyle');
    this.el.querySelectorAll('.snap-seg[data-target="segStyle"] .snap-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.val;
        this.state.ui.defaultSegmentStyle = val;
        const mode = this.state.ui.mode;
        const sel = mode === 'exam'
          ? this.state.document.getSelectedExamSegment()
          : this.state.document.getSelectedSegment();
        if (sel) {
          sel.style = val;
          this.app.pushHistory();
        }
        this.update();
        this.state.emit();
      });
    });
    $('deleteSegBtn').addEventListener('click', () => {
      const mode = this.state.ui.mode;
      const sel = mode === 'exam'
        ? this.state.document.getSelectedExamSegment()
        : this.state.document.getSelectedSegment();
      if (!sel) return;
      if (mode === 'exam') this.state.document.removeExamSegment(sel.id);
      else this.state.document.removeSegment(sel.id);
      this.app.pushHistory();
      this.state.emit();
    });
  }
  update() {
    const mode = this.state.ui.mode;
    const sel = mode === 'exam'
      ? this.state.document.getSelectedExamSegment()
      : this.state.document.getSelectedSegment();
    const info = $('segStyleInfo');
    if (sel) {
      info.textContent = 'Выбран: ' + sel.id;
      info.style.color = '#ffd888';
    } else {
      info.textContent = 'Новые отрезки';
      info.style.color = '';
    }
    const cur = sel ? sel.style : this.state.ui.defaultSegmentStyle;
    this.el.querySelectorAll('.snap-seg[data-target="segStyle"] .snap-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.val === cur);
    });
    $('deleteSegBtn').disabled = !sel;
  }
}

export function createPanels({ state, app }) {
  const size = new SizePanel({ state, app });
  const rotation = new RotationPanel({ state, app });
  const ortho = new OrthoPanel({ state });
  const snap = new SnapPanel({ state });
  const style = new StylePanel({ state, app });

  return {
    mount() {
      size.mount();
      rotation.mount();
      ortho.mount();
      snap.mount();
      style.mount();
    },
    update() {
      const tm = state.ui.tablesMode;
      const mode = state.ui.mode;

      if (mode === 'practice' || mode === 'exam') {
        if (tm === 'size' || tm === 'full') snap.update();
        if (tm === 'rotation' || tm === 'full') style.update();
      } else {
        if (tm === 'size' || tm === 'full') size.update();
        if (tm === 'rotation' || tm === 'full') rotation.update();
        if (state.ui.showOrthoTable) ortho.update();
      }
    },
  };
}