import { createPanels } from './panels.js'

export class UIManager {
  constructor({ state, app }) {
    this.state = state;
    this.app = app;
    this.panels = createPanels({ state, app });
    this._els = {};
  }

  _$(id) { return document.getElementById(id); }

  mount(root) {
    this._els.vpAnalysisBtn = this._$('vpAnalysisBtn');
    this._els.fovCell = this._$('fovCell');
    this._els.horizonRow = this._$('horizonRow');
    this._els.fovSlider = this._$('fovSlider');
    this._els.fovValue = this._$('fovValue');
    this._els.horizonSlider = this._$('horizonSlider');
    this._els.horizonValue = this._$('horizonValue');
    this._els.distValue = this._$('distValue');
    this._els.sizeInput = this._$('sizeInput');
    this._els.toolIndicator = this._$('toolIndicator');
    this._els.toolSegContainer = this._$('toolSegContainer');
    this._els.panelSize = this._$('panelSize');
    this._els.panelRot = this._$('panelRot');
    this._els.panelOrtho = this._$('panelOrtho');
    this._els.panelSnap = this._$('panelSnap');
    this._els.panelSegStyle = this._$('panelSegStyle');
    this._els.helpOverlay = this._$('helpOverlay');
    this._els.undoBtn = this._$('undoBtn');

    this._wireTopBar();
    this._wireBottomBar();
    this._wireToolBar();
    this._wireSliders();
    this._wireHelp();
    this._wireModeButtons();
    this._wireVisButtons();
    this.panels.mount();
    this._rebuildTools();
    this._applyBodyClasses();
    this._updateBottomBarVisibility();
    this.update();
  }

  _wireModeButtons() {
    document.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.app.setMode(btn.dataset.mode);
        document.querySelectorAll('.mode-btn').forEach((b) =>
          b.classList.toggle('active', b.dataset.mode === this.state.ui.mode));
        this._rebuildTools();
        this._applyBodyClasses();
        this._updateBottomBarVisibility();
      });
    });
    document.querySelectorAll('.tb-seg-btn[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.state.ui.tablesMode = btn.dataset.mode;
        document.querySelectorAll('.tb-seg-btn[data-mode]').forEach((b) =>
          b.classList.toggle('active', b === btn));
        this.update();
      });
    });
  }

  _wireVisButtons() {
    document.querySelectorAll('.vis-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.vis;
        this.state.ui.visibility[key] = !this.state.ui.visibility[key];
        this.state.emit();
      });
    });
  }

  _wireTopBar() {
    this._$('helpBtn').addEventListener('click', () => {
      this._els.helpOverlay.classList.add('show');
    });
  }

  _wireHelp() {
    this._$('helpCloseBtn').addEventListener('click', () => {
      this._els.helpOverlay.classList.remove('show');
    });
    this._els.helpOverlay.addEventListener('click', (e) => {
      if (e.target === this._els.helpOverlay) this._els.helpOverlay.classList.remove('show');
    });
  }

  _wireBottomBar() {
    const toggle = (key) => () => {
      this.state.ui[key] = !this.state.ui[key];
      this.state.emit();
    };
    this._$('vpAnalysisBtn').addEventListener('click', toggle('showAnalysisVPs'));
    this._$('spBtn').addEventListener('click', toggle('showSP'));
    this._$('guidesBtn').addEventListener('click', toggle('showGuides'));
    this._$('guidesSecBtn').addEventListener('click', toggle('showGuidesSec'));
    this._$('cubeRecoBtn').addEventListener('click', toggle('showRecognized'));
    this._$('rawGraphBtn').addEventListener('click', toggle('showRawGraph'));
    this._$('simpGraphBtn').addEventListener('click', toggle('showSimplifiedGraph'));
    this._$('triBtn').addEventListener('click', () => {
      this.state.ui.showTri = !this.state.ui.showTri;
      this.state.emit();
    });
    this._$('orthoTableBtn').addEventListener('click', () => {
      this.state.ui.showOrthoTable = !this.state.ui.showOrthoTable;
      this.state.emit();
    });
    this._$('undoBtn').addEventListener('click', () => this.app.undo());
    this._$('clearBtn').addEventListener('click', () => this.app.clearAll());
  }

  _wireToolBar() {
    this._els.toolSegContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.tb-seg-btn');
      if (!btn) return;
      this.app.setTool(btn.dataset.tool);
      this._rebuildTools();
      this._applyBodyClasses();
    });
  }

  _wireSliders() {
    this._els.fovSlider.addEventListener('input', (e) => {
      this.state.camera.fov = Number(e.target.value);
      this.state.emit();
    });
    this._els.horizonSlider.addEventListener('input', (e) => {
      this.state.camera.horizonOffset = Math.max(-1.5, Math.min(1.5, Number(e.target.value) / 100));
      this.state.emit();
    });
    this._els.sizeInput.addEventListener('input', (e) => {
      const v = Number(e.target.value);
      if (v > 0 && isFinite(v)) {
        this.state.camera.pictureSizeCm = v;
        this.state.emit();
      }
    });
  }

  _rebuildTools() {
    const mode = this.state.ui.mode;
    const isAnalysis = mode === 'practice' || mode === 'exam';
    const tools = isAnalysis
      ? [{ id: 'segment', label: 'Отрез' }, { id: 'erase', label: 'Удал' }, { id: 'move', label: 'Движ' }]
      : [{ id: 'create', label: 'Созд' }, { id: 'link', label: 'Связ' }, { id: 'move', label: 'Движ' }];
    this._els.toolSegContainer.innerHTML = tools.map((t) =>
      `<button class="tb-seg-btn${t.id === this.state.ui.tool ? ' active' : ''}" data-tool="${t.id}">${t.label}</button>`
    ).join('');
  }

  _applyBodyClasses() {
    document.body.className = '';
    document.body.classList.add('mode-' + this.state.ui.tool);
    document.body.classList.add('mode-' + this.state.ui.mode);
  }

  _updateBottomBarVisibility() {
    const mode = this.state.ui.mode;
    const isAnalysis = mode === 'practice' || mode === 'exam';
    this._$('guidesSecBtn').style.display = isAnalysis ? 'none' : '';
    this._$('triBtn').style.display = isAnalysis ? 'none' : '';
    this._$('orthoTableBtn').style.display = isAnalysis ? 'none' : '';
    this._$('cubeRecoBtn').style.display = isAnalysis ? '' : 'none';
    this._$('rawGraphBtn').style.display = isAnalysis ? '' : 'none';
    this._$('simpGraphBtn').style.display = isAnalysis ? '' : 'none';
    this._$('vpAnalysisBtn').style.display = isAnalysis ? '' : 'none';
  }

  _updateCameraControls() {
    const isPractice = this.state.ui.mode === 'practice';
    this._els.fovCell.style.display = isPractice ? 'none' : '';
    this._els.horizonRow.style.display = isPractice ? 'none' : '';
  }

  update() {
    const st = this.state;
    const cam = st.camera;

    this._els.fovSlider.value = cam.fov;
    this._els.fovValue.textContent = cam.fov + '°';
    this._els.horizonSlider.value = Math.round(cam.horizonOffset * 100);
    this._els.horizonValue.textContent = cam.horizonOffset.toFixed(2);
    this._els.distValue.textContent = (cam.distanceToScreenCm / 100).toFixed(2) + 'м';

    this._els.undoBtn.disabled = !this.app.history.canUndo;

    this._els.toolIndicator.className = 'tool-indicator';
    const toolName = st.ui.tool;
    if (toolName === 'move') { this._els.toolIndicator.textContent = 'Движ'; this._els.toolIndicator.classList.add('move'); }
    else if (toolName === 'segment') { this._els.toolIndicator.textContent = 'Отрезок'; this._els.toolIndicator.classList.add('segment'); }
    else if (toolName === 'erase') { this._els.toolIndicator.textContent = 'Удал'; this._els.toolIndicator.classList.add('erase'); }
    else if (toolName === 'link') { this._els.toolIndicator.textContent = 'Связка'; this._els.toolIndicator.classList.add('link'); }
    else { this._els.toolIndicator.textContent = 'Куб'; }

    const setActive = (id, on) => this._$(id).classList.toggle('active', on);
    setActive('spBtn', st.ui.showSP);
    setActive('guidesBtn', st.ui.showGuides);
    setActive('guidesSecBtn', st.ui.showGuidesSec);
    setActive('triBtn', st.ui.showTri);
    setActive('orthoTableBtn', st.ui.showOrthoTable);
    setActive('cubeRecoBtn', st.ui.showRecognized);
    setActive('rawGraphBtn', st.ui.showRawGraph);
    setActive('simpGraphBtn', st.ui.showSimplifiedGraph);
    setActive('vpAnalysisBtn', st.ui.showAnalysisVPs);


    document.querySelectorAll('.mode-btn').forEach((b) =>
      b.classList.toggle('active', b.dataset.mode === st.ui.mode));
    document.querySelectorAll('.vis-btn').forEach((b) =>
      b.classList.toggle('active', st.ui.visibility[b.dataset.vis]));
    document.querySelectorAll('.tb-seg-btn[data-mode]').forEach((b) =>
      b.classList.toggle('active', b.dataset.mode === st.ui.tablesMode));

    this._updatePanelVisibility();
    this._updateCameraControls();
    this.panels.update();
  }

  _updatePanelVisibility() {
    const mode = this.state.ui.mode;
    const tm = this.state.ui.tablesMode;
    const isAnalysis = mode === 'practice' || mode === 'exam';

    if (isAnalysis) {
      this._els.panelSize.style.display = 'none';
      this._els.panelRot.style.display = 'none';
      this._els.panelOrtho.style.display = 'none';
      this._els.panelSnap.style.display = (tm === 'size' || tm === 'full') ? '' : 'none';
      this._els.panelSegStyle.style.display = (tm === 'rotation' || tm === 'full') ? '' : 'none';
    } else {
      this._els.panelSnap.style.display = 'none';
      this._els.panelSegStyle.style.display = 'none';
      this._els.panelSize.style.display = (tm === 'size' || tm === 'full') ? '' : 'none';
      this._els.panelRot.style.display = (tm === 'rotation' || tm === 'full') ? '' : 'none';
      this._els.panelOrtho.style.display = this.state.ui.showOrthoTable ? '' : 'none';
    }
  }
}