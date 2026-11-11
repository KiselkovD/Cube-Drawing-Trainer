export class PointerController {
  constructor({ canvas, state, toolManager }) {
    this.canvas = canvas;
    this.state = state;
    this.toolManager = toolManager;
    this._activePointer = null;
  }

  attach() {
    this.canvas.addEventListener('pointerdown', (e) => this._onDown(e));
    this.canvas.addEventListener('pointermove', (e) => this._onMove(e));
    this.canvas.addEventListener('pointerup', (e) => this._onUp(e));
    this.canvas.addEventListener('pointercancel', () => this._onCancel());
  }

  _toWorld(e) {
    return this.state.camera.screenToWorld(
      { x: e.clientX, y: e.clientY },
      this.state.view
    );
  }

  _onDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    try { this.canvas.setPointerCapture(e.pointerId); } catch {}
    this._activePointer = e.pointerId;
    const w = this._toWorld(e);
    this.state.interaction.hoverWorld = w;
    this.toolManager.onPointerDown(w);
  }

  _onMove(e) {
    const w = this._toWorld(e);
    this.state.interaction.hoverWorld = w;
    if (this._activePointer == null) {
      this.state.emit();
      return;
    }
    this.toolManager.onPointerMove(w);
  }

  _onUp(e) {
    if (this._activePointer == null) return;
    this._activePointer = null;
    this.toolManager.onPointerUp(this._toWorld(e));
  }

  _onCancel() {
    this._activePointer = null;
    this.toolManager.onPointerCancel();
  }
}