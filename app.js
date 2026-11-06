import { DEFAULTS, THRESHOLDS } from './config.js'
import { Camera } from './core/camera.js'
import { Scene } from './domain/scene.js'
import { PointerController } from './PointerController.js'
import { Renderer } from './Renderer.js'
import { createTools } from './tools.js'
import { UIManager } from './ui.js'

export class AppState {
  constructor({ viewportWidth, viewportHeight }) {
    this.document = new Scene();
    this.camera = new Camera({
      fov: DEFAULTS.fov,
      horizonOffset: DEFAULTS.horizonOffset,
      pictureSizeCm: DEFAULTS.pictureSizeCm,
      viewportWidth,
      viewportHeight,
    });
    this.view = { x: 0, y: 0 };
    this.ui = {
      mode: 'theory',
      tool: 'create',
      visibility: { theory: true, practice: true, exam: true },
      showSP: true,
      showGuides: true,
      showGuidesSec: false,
      showTri: true,
      showOrthoTable: true,
      showRecognized: false,
      showRawGraph: false,
      showSimplifiedGraph: false,
      tablesMode: 'full',
      snapStart: 'points',
      snapEnd: 'points',
      defaultSegmentStyle: 'solid',
    };
    this.interaction = { draft: null };
    this._listeners = new Set();
  }

  subscribe(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  emit() { for (const fn of this._listeners) fn(this); }
}

export class History {
  constructor(initialScene, maxSize = THRESHOLDS.maxHistorySteps) {
    this._max = maxSize;
    this._stack = [];
    this._index = -1;
    this.push(initialScene);
  }
  push(scene) {
    const snap = JSON.parse(JSON.stringify(scene.toSnapshot()));
    this._stack = this._stack.slice(0, this._index + 1);
    this._stack.push(snap);
    if (this._stack.length > this._max) this._stack.shift();
    this._index = this._stack.length - 1;
  }
  get canUndo() { return this._index > 0; }
  get canRedo() { return this._index < this._stack.length - 1; }
  undo() {
    if (!this.canUndo) return null;
    this._index--;
    return Scene.fromSnapshot(this._stack[this._index]);
  }
  redo() {
    if (!this.canRedo) return null;
    this._index++;
    return Scene.fromSnapshot(this._stack[this._index]);
  }
}

export class ToolManager {
  constructor({ state, history }) {
    this.state = state;
    this.history = history;
    this.tools = createTools({ state, history });
    this._active = this.tools[state.ui.tool] || this.tools.create;
    this.state.ui.tool = this._active.name;
  }
  setTool(name) {
    if (!this.tools[name]) return;
    if (this._active && this._active.onCancel) this._active.onCancel();
    this._active = this.tools[name];
    this.state.ui.tool = name;
    this.state.emit();
  }
  get active() { return this._active; }
  onPointerDown(w) { this._active.onPointerDown(w); }
  onPointerMove(w) { this._active.onPointerMove(w); }
  onPointerUp(w) { this._active.onPointerUp(w); }
  onPointerCancel() { this._active.onPointerCancel(); }
}

export class Application {
  constructor(canvas) {
    this.state = new AppState({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
    this.history = new History(this.state.document, THRESHOLDS.maxHistorySteps);
    this.renderer = new Renderer({ canvas, state: this.state });
    this.toolManager = new ToolManager({ state: this.state, history: this.history });
    this.pointer = new PointerController({
      canvas,
      state: this.state,
      toolManager: this.toolManager,
    });
    this.ui = new UIManager({ state: this.state, app: this });

    this.state.subscribe(() => {
      this.renderer.render();
      this.ui.update();
    });

    window.addEventListener('resize', () => {
      this.state.camera.setViewport(window.innerWidth, window.innerHeight);
      this.state.emit();
    });
  }

  start() {
    this.ui.mount(document.body);
    this.pointer.attach();
    this.renderer.render();
    this.ui.update();
    document.body.classList.add('mode-create');
    document.body.classList.add('mode-theory');
  }

  pushHistory() { this.history.push(this.state.document); }

  undo() {
    const scene = this.history.undo();
    if (scene) { this.state.document = scene; this.state.emit(); }
  }

  redo() {
    const scene = this.history.redo();
    if (scene) { this.state.document = scene; this.state.emit(); }
  }

  clearAll() {
    this.state.document = new Scene();
    this.state.view = { x: 0, y: 0 };
    this.state.interaction.draft = null;
    this.pushHistory();
    this.state.emit();
  }

  setMode(mode) {
    if (this.state.interaction.draft) this.state.interaction.draft = null;
    this.state.ui.mode = mode;
    const validTools = (mode === 'practice' || mode === 'exam')
      ? ['segment', 'erase', 'move']
      : ['create', 'link', 'move'];
    if (!validTools.includes(this.state.ui.tool)) this.toolManager.setTool(validTools[0]);
    this.state.emit();
  }

  setTool(name) { this.toolManager.setTool(name); }
}