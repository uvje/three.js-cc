// Keyboard + mouse with pointer lock, and a drag-to-look fallback where pointer lock is refused.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();   // keys pressed this frame
    this.mouseDX = 0; this.mouseDY = 0;
    this.locked = false;
    this.dragging = false;
    this.lockFailed = false;
    this.clicked = false;
    this.enabled = false;
    this.lastMouseMove = 0;
    this.onUnlock = null;

    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      // browsers can report a large bogus jump right after the lock changes
      this.quietUntil = performance.now() + 120;
      this.mouseDX = this.mouseDY = 0;
      if (was && !this.locked && this.onUnlock) this.onUnlock();
    });
    document.addEventListener('pointerlockerror', () => { this.lockFailed = true; });

    document.addEventListener('mousemove', (e) => this._move(e));
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (e.button === 0) this.clicked = true;
      if (!this.locked) { this.dragging = true; this.requestLock(); }
    });
    window.addEventListener('mouseup', () => { this.dragging = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // basic touch look for tablets
    let tl = null;
    canvas.addEventListener('touchstart', (e) => { if (e.touches.length) tl = [e.touches[0].clientX, e.touches[0].clientY]; }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      if (!tl || !e.touches.length) return;
      const t = e.touches[0];
      this.mouseDX += (t.clientX - tl[0]) * 1.5; this.mouseDY += (t.clientY - tl[1]) * 1.5;
      tl = [t.clientX, t.clientY];
    }, { passive: true });
  }
  _move(e) {
    if (!this.enabled) return;
    if (this.locked || this.dragging) {
      const mx = e.movementX || 0, my = e.movementY || 0;
      if (performance.now() < (this.quietUntil || 0) || Math.abs(mx) > 300 || Math.abs(my) > 300) return;
      this.mouseDX += mx;
      this.mouseDY += my;
      this.lastMouseMove = performance.now();
    }
  }
  requestLock() {
    if (this.lockFailed || this.locked) return;
    try {
      const p = this.canvas.requestPointerLock?.();
      if (p && p.catch) p.catch(() => { this.lockFailed = true; });
    } catch (e) { this.lockFailed = true; }
  }
  exitLock() { if (this.locked) document.exitPointerLock?.(); }
  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  consumeMouse() { const r = [this.mouseDX, this.mouseDY]; this.mouseDX = 0; this.mouseDY = 0; return r; }
  endFrame() { this.pressed.clear(); this.clicked = false; }
  clear() { this.keys.clear(); this.pressed.clear(); this.mouseDX = this.mouseDY = 0; }
}
