// Touch controls for phones and tablets: a floating joystick on the left half of the screen, drag-to-look on the
// right half, and a cluster of round buttons that press the same keys as the keyboard.

const BUTTONS = [
  // code, label, aria label, hold?
  ['KeyE', 'E', 'Действие', false, 'big'],
  ['ShiftLeft', '⇧', 'Бег или рывок на велосипеде', true],
  ['KeyR', 'R', 'Звонок', false],
  ['KeyT', 'T', 'Ускорить время', true],
  ['KeyB', 'B', 'Позвать велосипед', false],
  ['KeyF', 'F', 'Бенгальский огонь', false],
  ['Tab', '帳', 'Дневник', false],
  ['KeyM', '地', 'Карта', false],
  ['Escape', 'II', 'Пауза', false],
];

function key(type, code) { window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true })); }

export class TouchControls {
  constructor(input, canvas) {
    this.input = input;
    const root = (this.root = document.createElement('div'));
    root.id = 'touch';
    root.innerHTML = '<div class="joy" hidden><div class="knob"></div></div><div class="btns"></div>';
    const firstOverlay = document.querySelector('.overlay');
    document.body.insertBefore(root, firstOverlay);
    this.joy = root.querySelector('.joy'); this.knob = root.querySelector('.knob');
    const btns = root.querySelector('.btns');
    for (const [code, label, aria, hold, cls] of BUTTONS) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tbtn' + (cls ? ' ' + cls : ''); b.textContent = label; b.setAttribute('aria-label', aria);
      b.addEventListener('touchstart', (e) => { e.preventDefault(); b.classList.add('on'); key('keydown', code); if (!hold) key('keyup', code); }, { passive: false });
      const up = (e) => { e.preventDefault(); b.classList.remove('on'); if (hold) key('keyup', code); };
      b.addEventListener('touchend', up, { passive: false });
      b.addEventListener('touchcancel', up, { passive: false });
      btns.appendChild(b);
    }
    // the first touch anywhere switches the interface to touch mode
    window.addEventListener('touchstart', () => document.body.classList.add('touch'), { once: true, passive: true });
    // joystick on the left, look on the right
    this.stick = null; this.look = null;
    const R = 52;
    canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.42 && !this.stick) {
          this.stick = { id: t.identifier, x: t.clientX, y: t.clientY };
          this.joy.hidden = false;
          this.joy.style.left = t.clientX + 'px'; this.joy.style.top = t.clientY + 'px';
          this.knob.style.transform = 'translate(-50%, -50%)';
        } else if (!this.look) this.look = { id: t.identifier, x: t.clientX, y: t.clientY };
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (this.stick && t.identifier === this.stick.id) {
          let dx = t.clientX - this.stick.x, dy = t.clientY - this.stick.y;
          const l = Math.hypot(dx, dy);
          if (l > R) { dx *= R / l; dy *= R / l; }
          this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
          input.joyX = dx / R; input.joyY = dy / R;
        } else if (this.look && t.identifier === this.look.id) {
          input.mouseDX += (t.clientX - this.look.x) * 1.8; input.mouseDY += (t.clientY - this.look.y) * 1.8;
          this.look.x = t.clientX; this.look.y = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (this.stick && t.identifier === this.stick.id) { this.stick = null; this.joy.hidden = true; input.joyX = input.joyY = 0; }
        if (this.look && t.identifier === this.look.id) this.look = null;
      }
    };
    canvas.addEventListener('touchend', end);
    canvas.addEventListener('touchcancel', end);
  }
}
