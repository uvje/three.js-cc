import { C, varyColor } from '../core/builder.js';

// Small reusable models. Each takes get(matKey) -> MeshBuilder already transformed to the model's frame
// (local +z = the model's front).

export function torusX(b, cx, cy, cz, R, r, seg, color) {
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    b.tube(cx, cy + Math.sin(a0) * R, cz + Math.cos(a0) * R, cx, cy + Math.sin(a1) * R, cz + Math.cos(a1) * R, r, 5, color);
  }
}

function wheel(b, x, y, z, r, w, col = C(0x1c1c1c)) {
  b.push(); b.translate(x, y, z); b.rotateZ(Math.PI / 2);
  b.cyl(0, -w / 2, 0, r, r, w, 10, col, { cap: true, capColor: C(0x9a9a9a) });
  b.pop();
  b.push(); b.translate(x, y, z); b.rotateZ(-Math.PI / 2);
  b.cyl(0, w / 2 - 0.001, 0, r * 0.98, r * 0.98, 0.001, 10, col, { cap: true, capColor: C(0x9a9a9a) });
  b.pop();
}

// White kei truck (軽トラ): 3.4 m long, cab forward
export function keiTruck(get, rng, color = 0xf2f2ee) {
  const P = get('plain');
  const body = C(color), dark = C(0x2a2c30), chrome = C(0xb0b4b8), red = C(0xc0302a);
  // chassis
  P.box(0, 0.32, 0, 1.44, 0.22, 3.36, dark);
  // cab
  P.box(0, 0.54, 1.1, 1.46, 0.75, 1.15, body);
  P.box(0, 1.29, 0.95, 1.4, 0.55, 0.85, body);
  P.box(0, 1.84, 0.95, 1.36, 0.06, 0.82, body);
  // bed with low gates
  P.box(0, 0.54, -0.6, 1.44, 0.08, 2.1, body);
  P.box(0.7, 0.62, -0.6, 0.05, 0.35, 2.1, body);
  P.box(-0.7, 0.62, -0.6, 0.05, 0.35, 2.1, body);
  P.box(0, 0.62, -1.63, 1.44, 0.35, 0.05, body);
  P.box(0, 0.62, 0.43, 1.44, 0.75, 0.05, body);
  P.box(0, 1.37, 0.47, 1.2, 0.04, 0.04, chrome);
  // lights & bumper
  P.box(0.55, 0.78, 1.68, 0.22, 0.14, 0.04, C(0xf4f4e8));
  P.box(-0.55, 0.78, 1.68, 0.22, 0.14, 0.04, C(0xf4f4e8));
  P.box(0, 0.42, 1.7, 1.46, 0.16, 0.08, C(0x8a8c90));
  P.box(0.62, 0.62, -1.67, 0.14, 0.12, 0.03, red);
  P.box(-0.62, 0.62, -1.67, 0.14, 0.12, 0.03, red);
  const W = get('winDark');
  W.quad([-0.66, 1.08, 1.4], [0.66, 1.08, 1.4], [0.64, 1.76, 1.33], [-0.64, 1.76, 1.33], C(0xffffff), [0, 0, 1, 1]);
  W.quad([0.735, 1.1, 1.3], [0.735, 1.1, 0.62], [0.735, 1.74, 0.62], [0.735, 1.74, 1.3], C(0xffffff), [0, 0, 1, 1]);
  W.quad([-0.735, 1.1, 0.62], [-0.735, 1.1, 1.3], [-0.735, 1.74, 1.3], [-0.735, 1.74, 0.62], C(0xffffff), [0, 0, 1, 1]);
  wheel(P, 0.62, 0.28, 1.05, 0.28, 0.18);
  wheel(P, -0.62, 0.28, 1.05, 0.28, 0.18);
  wheel(P, 0.62, 0.28, -1.0, 0.28, 0.18);
  wheel(P, -0.62, 0.28, -1.0, 0.28, 0.18);
  if (rng && rng.chance(0.5)) { // some cargo
    P.box(0.2, 0.62, -0.9, 0.6, 0.35, 0.45, C(0x3a6ab0));
    P.box(-0.3, 0.62, -0.4, 0.5, 0.3, 0.4, C(0xd8c890));
  }
}

export function bench(get, color = 0x8a5a3a, len = 1.8) {
  const P = get('plain');
  const wood = C(color), leg = C(0x5a5a5a);
  P.box(0, 0.42, 0, len, 0.05, 0.42, wood);
  P.box(0, 0.5, -0.2, len, 0.32, 0.04, wood);
  for (const x of [-len / 2 + 0.1, len / 2 - 0.1]) { P.box(x, 0, 0.12, 0.05, 0.42, 0.05, leg); P.box(x, 0, -0.18, 0.05, 0.85, 0.05, leg); }
}

export function stoneLantern(get, s = 1) {
  const P = get('plain');
  const st = C(0x9a978e), st2 = C(0x8a877e);
  P.push(); P.scale(s, s, s);
  P.box(0, 0, 0, 0.7, 0.18, 0.7, st2);
  P.cyl(0, 0.18, 0, 0.14, 0.12, 0.8, 6, st);
  P.box(0, 0.98, 0, 0.5, 0.14, 0.5, st2);
  P.box(0, 1.12, 0, 0.36, 0.34, 0.36, st);
  P.cone(0, 1.46, 0, 0.42, 0.34, 4, st2);
  P.box(0, 1.8, 0, 0.08, 0.1, 0.08, st);
  P.pop();
  const G = get('glow');
  G.push(); G.scale(s, s, s);
  G.box(0, 1.2, 0, 0.2, 0.18, 0.37, C(0x1a1612), { noTop: true });
  G.pop();
}

export function jizo(get, rng, n = 3) {
  const P = get('plain');
  const stone = C(0x8e8b84), bib = C(0xc8302a), wood = C(0x5a3e2a);
  // little wooden shelter
  P.box(0, 0, 0, n * 0.55 + 0.5, 0.3, 0.8, C(0x7a776e));
  for (const x of [-(n * 0.55) / 2 - 0.15, (n * 0.55) / 2 + 0.15]) { P.box(x, 0.3, -0.3, 0.08, 1.3, 0.08, wood); P.box(x, 0.3, 0.3, 0.08, 1.2, 0.08, wood); }
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 0.55;
    const s = rng ? rng.float(0.85, 1.05) : 1;
    P.blob(x, 0.3 + 0.28 * s, 0, 0.17 * s, 0.3 * s, 0.15 * s, stone, null, 0, 1, 0.9);
    P.blob(x, 0.3 + 0.68 * s, 0, 0.12 * s, 0.13 * s, 0.12 * s, stone, null, 0, 1, 0.9);
    P.tri([x - 0.16 * s, 0.3 + 0.55 * s, 0.13 * s], [x + 0.16 * s, 0.3 + 0.55 * s, 0.13 * s], [x, 0.3 + 0.3 * s, 0.17 * s], bib);
    P.cone(x, 0.3 + 0.76 * s, 0, 0.12 * s, 0.1 * s, 6, bib);
  }
  const K = get('kawara');
  K.push(); K.translate(0, 1.5, 0);
  K.gableRoof(n * 0.55 + 0.4, 0.7, 0, 0.18, 0.6, C(0x8a8e94), { thickness: 0.05 });
  K.pop();
}

export function acUnit(get) {
  const P = get('plain');
  P.box(0, 0, 0, 0.8, 0.12, 0.3, C(0x6a6a66));
  P.box(0, 0.12, 0, 0.78, 0.55, 0.28, C(0xe4e0d4));
  P.box(-0.1, 0.18, 0.142, 0.42, 0.42, 0.01, C(0x3a3a38));
  P.cyl(0.36, 0.3, 0.1, 0.02, 0.02, 1.2, 4, C(0xd8d4c8));
}

export function propane(get) {
  const P = get('plain');
  const c = C(0xb8c4cc);
  for (const x of [-0.22, 0.22]) {
    P.cyl(x, 0, 0, 0.18, 0.18, 1.15, 10, c, { cap: true });
    P.cyl(x, 1.15, 0, 0.06, 0.06, 0.12, 6, C(0x7a7a7a));
  }
}

export function mailbox(get, color = 0xc8302a) {
  const P = get('plain');
  P.box(0, 0, 0, 0.06, 1.0, 0.06, C(0x555555));
  P.box(0, 1.0, 0, 0.36, 0.42, 0.24, C(color));
}

export function potPlants(get, rng, n = 4) {
  const P = get('plain'), Fo = get('foliage');
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 0.42;
    P.cyl(x, 0, 0, 0.12, 0.16, 0.26, 7, C(rng.pick([0xa0583a, 0x8a4a30, 0x5a6a7a])));
    Fo.blob(x, 0.38, 0, 0.2, 0.18, 0.2, varyColor(rng.pick([0x4a7a32, 0x5a8a3a, 0x3c6a2c]), rng, 0.1), rng, 0.25, 1);
    if (rng.chance(0.4)) Fo.blob(x, 0.52, 0.05, 0.06, 0.06, 0.06, C(rng.pick([0xe86aa0, 0x6a7ae8, 0xf0e050, 0xf0f0f0])), null, 0, 0);
  }
}

export function shrub(get, rng, s = 1, color = 0x3f6a2c) {
  const Fo = get('foliage');
  Fo.blob(0, 0.45 * s, 0, 0.7 * s, 0.5 * s, 0.7 * s, varyColor(color, rng, 0.12), rng, 0.2, 1);
}

export function laundry(get, rng) {
  const P = get('plain');
  const pole = C(0x9aa0a4);
  P.box(-1.2, 0, 0, 0.05, 1.9, 0.05, pole);
  P.box(1.2, 0, 0, 0.05, 1.9, 0.05, pole);
  P.box(0, 1.82, 0, 2.5, 0.035, 0.035, pole);
  const cols = [0xf4f4f0, 0x9ab8d8, 0xe8a0a8, 0xf0e8a0, 0xffffff, 0x6a8a5a, 0x3a4a7a];
  let x = -1.0;
  while (x < 1.0) {
    const w = rng.float(0.35, 0.65), h = rng.float(0.45, 0.8);
    const c = C(rng.pick(cols));
    P.quad([x, 1.8 - h, 0.01], [x + w, 1.8 - h, 0.01], [x + w, 1.8, 0.01], [x, 1.8, 0.01], c);
    P.quad([x + w, 1.8 - h, -0.01], [x, 1.8 - h, -0.01], [x, 1.8, -0.01], [x + w, 1.8, -0.01], c);
    x += w + rng.float(0.05, 0.15);
  }
}

// static mamachari parked on its stand
export function bicycle(get, color = 0x8ab8c8) {
  const P = get('plain');
  const fr = C(color), blk = C(0x1a1a1a), chrome = C(0xc0c4c8);
  torusX(P, 0, 0.33, 0.52, 0.31, 0.022, 14, blk);
  torusX(P, 0, 0.33, -0.52, 0.31, 0.022, 14, blk);
  P.tube(0, 0.33, -0.52, 0, 0.36, -0.05, 0.02, 4, fr);
  P.tube(0, 0.36, -0.05, 0, 0.92, -0.2, 0.022, 4, fr);
  P.tube(0, 0.36, -0.05, 0, 0.62, 0.38, 0.025, 4, fr);
  P.tube(0, 0.62, 0.38, 0, 1.0, 0.36, 0.022, 4, fr);
  P.tube(0, 0.33, 0.52, 0, 1.0, 0.36, 0.018, 4, chrome);
  P.tube(-0.26, 1.02, 0.22, 0.26, 1.02, 0.22, 0.014, 4, chrome);
  P.tube(-0.26, 1.02, 0.22, 0, 1.03, 0.36, 0.014, 4, chrome);
  P.tube(0.26, 1.02, 0.22, 0, 1.03, 0.36, 0.014, 4, chrome);
  P.box(0, 0.94, -0.24, 0.16, 0.06, 0.26, blk);
  P.box(0, 0.78, 0.6, 0.36, 0.24, 0.3, chrome, { noTop: true });
  P.box(0, 0.74, -0.55, 0.28, 0.03, 0.36, chrome);
}

export function trafficCone(get) {
  const P = get('plain');
  P.box(0, 0, 0, 0.38, 0.04, 0.38, C(0x2a2a2a));
  P.cone(0, 0.04, 0, 0.15, 0.65, 8, C(0xe8502a));
}

export function blockWall(get, x0, x1, z, h = 1.2) {
  const B = get('block');
  B.box((x0 + x1) / 2, 0, z, Math.abs(x1 - x0), h, 0.15, C(0xd0ccc4), { uvScale: 1, topColor: C(0x9a968c) });
}
export function hedge(get, rng, x0, z0, x1, z1, h = 1.2, w = 0.7) {
  const Fo = get('foliage');
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 1.1));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    Fo.blob(x0 + (x1 - x0) * t, h * 0.55, z0 + (z1 - z0) * t, (L / n) * 0.62, h * 0.55, w * 0.6, varyColor(0x3c5e2a, rng, 0.08), rng, 0.12, 1, 0.8);
  }
}
