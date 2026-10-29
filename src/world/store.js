import * as THREE from 'three';
import { C, MeshBuilder } from '../core/builder.js';
import { canvas, tex, drawSign, JP_SERIF, JP_SANS } from '../env/textures.js';
import { patch } from '../env/materials.js';
import { CF } from './collision.js';
import { person, pose } from './npc.js';
import { G } from './terrain.js';

// The inside of なつめ商店, the village dagashiya: shelves of ten-yen sweets, a humming drinks cooler, an ice-cream
// chest, toys hanging from the ceiling, a fan turning slowly, and the old shopkeeper behind the counter with his
// newspaper and the high-school baseball on a little TV. Open from 6:30 until 21:00.

const OPEN = 6.5, CLOSE = 21;
const PACK = [0xe8402a, 0xf0a020, 0xf0d830, 0x40a8e0, 0x3a6ad8, 0xe86aa8, 0x58b848, 0xf4f0e6, 0xa04ad0, 0xff7a3a, 0x2ab8a8, 0xd8283a];

function bottlesTex() {
  const [c, x] = canvas(256, 320);
  x.fillStyle = '#eef6fa'; x.fillRect(0, 0, 256, 320);
  const cols = ['#7ad0f0', '#f05040', '#f8d040', '#60c060', '#e8e8e8', '#f08ac0', '#4060d0', '#f0a040'];
  for (let r = 0; r < 4; r++) {
    const y0 = 20 + r * 76;
    x.fillStyle = '#b8c4cc'; x.fillRect(0, y0 + 64, 256, 6);
    for (let i = 0; i < 9; i++) {
      const cx = 12 + i * 27, col = cols[(i * 3 + r * 5) % cols.length];
      if ((i + r) % 3 === 0) {
        // ramune bottle
        x.fillStyle = 'rgba(120,200,220,0.9)'; x.fillRect(cx, y0 + 18, 18, 46); x.fillRect(cx + 5, y0 + 4, 8, 16);
        x.fillStyle = '#2a6ad0'; x.fillRect(cx + 4, y0, 10, 6);
      } else {
        x.fillStyle = col; x.fillRect(cx, y0 + 22, 20, 42);
        x.fillStyle = 'rgba(255,255,255,0.6)'; x.fillRect(cx + 3, y0 + 30, 5, 26);
        x.fillStyle = '#c8c8c8'; x.fillRect(cx + 2, y0 + 18, 16, 5);
      }
    }
  }
  x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(0, 0, 256, 320);
  return tex(c, { clamp: true });
}
function tvTex() {
  const [c, x] = canvas(128, 96);
  x.fillStyle = '#3a8a3a'; x.fillRect(0, 0, 128, 96);
  x.fillStyle = '#b8864a'; x.beginPath(); x.moveTo(64, 30); x.lineTo(104, 62); x.lineTo(64, 94); x.lineTo(24, 62); x.fill();
  x.fillStyle = '#4a9a40'; x.beginPath(); x.moveTo(64, 44); x.lineTo(88, 62); x.lineTo(64, 80); x.lineTo(40, 62); x.fill();
  x.fillStyle = '#ffffff'; for (const [px, py] of [[64, 50], [86, 62], [42, 62], [64, 84]]) x.fillRect(px - 2, py - 2, 4, 4);
  x.fillStyle = '#1a2a6a'; x.fillRect(0, 0, 128, 22);
  x.fillStyle = '#ffffff'; x.font = `700 13px ${JP_SANS}`; x.fillText('夏の甲子園  3 - 2', 6, 15);
  return tex(c, { clamp: true });
}
function norenTex() {
  const [c, x] = canvas(256, 256);
  x.fillStyle = '#23305a'; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(255,255,255,0.85)'; x.lineWidth = 6;
  for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(64 + (i % 2) * 128, 150 + Math.floor(i / 2) * 60, 26, Math.PI, 0); x.stroke(); }
  x.fillStyle = '#ffffff'; x.font = `900 64px ${JP_SERIF}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('な', 128, 70);
  return tex(c, { clamp: true });
}
function newspaperTex() {
  const [c, x] = canvas(128, 96);
  x.fillStyle = '#e8e4d8'; x.fillRect(0, 0, 128, 96);
  x.fillStyle = '#2a2a2a'; x.font = `900 16px ${JP_SERIF}`; x.fillText('なつめ新聞', 6, 18);
  x.fillStyle = '#6a6a6a';
  for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) x.fillRect(6 + j * 41, 28 + i * 7, 36, 3);
  return tex(c, { clamp: true });
}

export class StoreInterior {
  constructor(L, s, rng) {
    this.L = L; this.W = L.W;
    const W = L.W;
    const X0 = -s.hw + 0.14, X1 = s.hw - 0.14, Zb = s.hz - s.hd + 0.14, Zf = s.hz + s.hd - 0.14, Y = 0.18, CH = 2.52;
    const mz = (Zb + Zf) / 2, depth = Zf - Zb, door = 3.6;
    this.box = { X0, X1, Zb, Zf };
    this.floorY = L.lot.h + Y;
    const F = (k) => L.get(k, 0, Y, 0);
    const P = F('plain'), Wd = F('wood'), Pl = F('plaster');
    const pick = () => C(PACK[rng.int(0, PACK.length - 1)]);
    // walls: plaster above a dark wooden wainscot, board ceiling
    const cream = C(0xe8dcc4), wain = C(0x6a4a32);
    Pl.box(X0 + 0.02, 0.9, mz, 0.04, CH - 0.9, depth, cream);
    Pl.box(X1 - 0.02, 0.9, mz, 0.04, CH - 0.9, depth, cream);
    Pl.box(0, 0.9, Zb + 0.02, X1 - X0, CH - 0.9, 0.04, cream);
    Wd.box(X0 + 0.025, 0, mz, 0.05, 0.9, depth, wain);
    Wd.box(X1 - 0.025, 0, mz, 0.05, 0.9, depth, wain);
    Wd.box(0, 0, Zb + 0.025, X1 - X0, 0.9, 0.05, wain);
    Wd.box(0, CH, mz, X1 - X0, 0.05, depth, C(0xf0e4c8), { bottom: true });
    for (let x = X0 + 0.9; x < X1; x += 0.9) Wd.box(x, CH - 0.04, mz, 0.05, 0.04, depth, C(0x8a6a48), { bottom: true });
    // concrete floor: keep the grass outside
    W.plan.markRect(L.wx(0, s.hz), L.wz(0, s.hz), s.hw, s.hd, L.lot.ang, 0, G.CONCRETE);

    // ---- left wall: tall shelves crammed with sweets
    const sz0 = Zb + 0.95, sz1 = Zf - 0.3;
    const shelfC = C(0x8a6a4a);
    for (const y of [0.12, 0.55, 0.98, 1.41, 1.84]) P.box(X0 + 0.22, y, (sz0 + sz1) / 2, 0.42, 0.03, sz1 - sz0, shelfC, { bottom: true });
    for (let z = sz0; z <= sz1 + 0.01; z += (sz1 - sz0) / 5) P.box(X0 + 0.22, 0, z, 0.42, 1.87, 0.03, shelfC);
    P.box(X0 + 0.06, 0, (sz0 + sz1) / 2, 0.02, 1.87, sz1 - sz0, C(0x5a4030));
    for (const y of [0.15, 0.58, 1.01, 1.44]) {
      let z = sz0 + 0.04;
      while (z < sz1 - 0.12) {
        const w = rng.float(0.08, 0.22), h = rng.float(0.1, Math.min(0.34, 0.4)), dd = rng.float(0.12, 0.3);
        if (z + w > sz1 - 0.04) break;
        const col = pick();
        const n = rng.int(1, 3);
        for (let k = 0; k < n; k++) P.box(X0 + 0.38 - dd / 2 - k * 0.02, y + k * 0.003, z + w / 2, dd, h * (1 - k * 0.05), w - 0.01, col);
        z += w + rng.float(0.0, 0.04);
      }
      // price strips along the shelf edge
      P.box(X0 + 0.435, y - 0.035, (sz0 + sz1) / 2, 0.01, 0.04, sz1 - sz0, C(0xf8f4ea));
    }
    // bagged snacks hanging on hooks at the top
    for (let z = sz0 + 0.2; z < sz1; z += 0.32) P.box(X0 + 0.3, 1.9, z, 0.04, rng.float(0.22, 0.32), 0.2, pick());
    L.box(X0 + 0.22, (sz0 + sz1) / 2, 0.24, (sz1 - sz0) / 2);
    L.sign('だがし 10円〜', X0 + 0.07, 2.2, (sz0 + sz1) / 2, 1.6, 0.4, { bg: '#fff6d8', fg: '#c8281e', tw: 512, th: 128 }, Math.PI / 2);

    // ---- right wall: drinks cooler, ice-cream chest, toys on a pegboard
    const fz0 = Zf - 2.0, fz1 = Zf - 0.35, fx = X1 - 0.65;
    P.box(X1 - 0.33, 0, (fz0 + fz1) / 2, 0.66, 1.95, fz1 - fz0, C(0xf0f0ec));
    P.box(fx - 0.005, 0.12, (fz0 + fz1) / 2, 0.02, 1.62, fz1 - fz0 - 0.1, C(0x9aa0a6));
    this.fridgeMat = new THREE.MeshBasicMaterial({ map: bottlesTex() });
    const fr = new THREE.Mesh(new THREE.PlaneGeometry(fz1 - fz0 - 0.18, 1.5), this.fridgeMat);
    L.mesh(fr, fx - 0.02, Y + 0.93, (fz0 + fz1) / 2, -Math.PI / 2).castShadow = false;
    L.sign('つめたい のみもの', fx - 0.025, Y + 1.82, (fz0 + fz1) / 2, fz1 - fz0 - 0.2, 0.2, { bg: '#2a5ab0', fg: '#ffffff', tw: 512, th: 64, font: JP_SANS, weight: 800, glow: 0.6 }, -Math.PI / 2);
    W.hums.push({ x: L.wx(X1 - 0.3, (fz0 + fz1) / 2), z: L.wz(X1 - 0.3, (fz0 + fz1) / 2), y: L.lot.h + 1 });
    L.box(X1 - 0.33, (fz0 + fz1) / 2, 0.36, (fz1 - fz0) / 2);
    // ice-cream chest with a sliding glass lid
    const iz0 = Zf - 3.5, iz1 = Zf - 2.25, ix = X1 - 0.45;
    P.box(ix, 0, (iz0 + iz1) / 2, 0.8, 0.82, iz1 - iz0, C(0xf4f4f0));
    P.box(ix, 0.82, (iz0 + iz1) / 2, 0.8, 0.03, iz1 - iz0, C(0x9ab0c0));
    for (let i = 0; i < 10; i++) P.box(ix - 0.28 + (i % 4) * 0.18, 0.62, iz0 + 0.18 + Math.floor(i / 4) * 0.4, 0.15, 0.12, 0.3, C([0xf8f0e0, 0x40a0e0, 0xf06aa0, 0x8a5a3a, 0xf8d040][i % 5]));
    L.sign('アイス', ix - 0.41, Y + 0.5, (iz0 + iz1) / 2, 0.7, 0.28, { bg: '#ffffff', fg: '#2a7ad0', tw: 256, th: 96, font: JP_SANS, weight: 900 }, -Math.PI / 2);
    L.box(ix, (iz0 + iz1) / 2, 0.42, (iz1 - iz0) / 2);
    // pegboard of toys
    const pz0 = Zb + 1.5, pz1 = iz0 - 0.15;
    P.box(X1 - 0.06, 0.95, (pz0 + pz1) / 2, 0.03, 1.35, pz1 - pz0, C(0xd8c8a8));
    for (let z = pz0 + 0.2; z < pz1 - 0.1; z += 0.34) for (const y of [1.1, 1.55, 2.0]) {
      const kind = rng.int(0, 2);
      if (kind === 0) P.box(X1 - 0.12, y, z, 0.06, 0.32, 0.22, pick()); // bagged toy
      else if (kind === 1) { P.box(X1 - 0.13, y + 0.12, z, 0.07, 0.14, 0.26, pick()); P.box(X1 - 0.13, y, z + 0.08, 0.07, 0.16, 0.06, pick()); } // water pistol
      else P.blob(X1 - 0.12, y + 0.16, z, 0.04, 0.11, 0.11, pick(), null, 0, 1, 1); // mask
    }

    // ---- back: the counter, the shopkeeper's corner and the doorway to the house
    const cz = Zb + 1.08, cx0 = -0.6, cx1 = X1 - 0.12;
    Wd.box((cx0 + cx1) / 2, 0, cz, cx1 - cx0, 0.86, 0.55, C(0x7a5434));
    P.box((cx0 + cx1) / 2, 0.86, cz + 0.02, cx1 - cx0 + 0.04, 0.04, 0.62, C(0x9a7450));
    L.box((cx0 + cx1) / 2, cz, (cx1 - cx0) / 2, 0.3);
    // old cash register, candy jar, abacus
    P.box(2.3, 0.9, cz, 0.42, 0.18, 0.38, C(0x5a6064));
    P.box(2.3, 1.08, cz - 0.05, 0.36, 0.14, 0.24, C(0x6a7074));
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) P.box(2.16 + i * 0.09, 1.0, cz + 0.12 + j * 0.0, 0.05, 0.04 + j * 0.0, 0.05, C(0xe8e4d8));
    P.cyl(0.6, 0.9, cz + 0.05, 0.11, 0.11, 0.26, 12, C(0xcfe4ec));
    P.cyl(0.6, 1.16, cz + 0.05, 0.12, 0.12, 0.05, 12, C(0xd8302a));
    for (let i = 0; i < 6; i++) P.blob(0.55 + (i % 3) * 0.05, 0.96 + Math.floor(i / 3) * 0.06, cz + 0.05, 0.03, 0.03, 0.03, pick(), null, 0, 0, 1);
    P.box(1.3, 0.9, cz + 0.12, 0.34, 0.02, 0.12, C(0x5a3a22));
    // cigarettes and odds on the wall shelf behind the counter
    for (const y of [1.25, 1.62]) {
      P.box(1.4, y, Zb + 0.12, 3.0, 0.03, 0.2, shelfC, { bottom: true });
      for (let x = 0.0; x < 2.8; x += 0.11) P.box(x, y + 0.03, Zb + 0.12, 0.08, 0.13, 0.1, C([0xf4f4f0, 0x2a4a9a, 0xd8302a, 0x1a1a1a, 0xe8c040][(Math.floor(x * 9) + (y > 1.4 ? 2 : 0)) % 5]));
    }
    // little TV with the high-school baseball
    const tvx = 3.75;
    P.box(tvx, 1.25, Zb + 0.25, 0.7, 0.03, 0.42, shelfC, { bottom: true });
    P.box(tvx, 1.28, Zb + 0.25, 0.5, 0.4, 0.38, C(0x2e2a28));
    this.tvMat = new THREE.MeshBasicMaterial({ map: tvTex() });
    L.mesh(new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.27), this.tvMat), tvx - 0.03, Y + 1.49, Zb + 0.445).castShadow = false;
    this.tvPos = { x: L.wx(tvx, Zb + 0.4), y: L.lot.h + Y + 1.5, z: L.wz(tvx, Zb + 0.4) };
    // calendar and clock
    L.sign('8月', 1.0, Y + 2.0, Zb + 0.05, 0.42, 0.56, { bg: '#ffffff', fg: '#c8281e', tw: 128, th: 170, size: 54, baseline: 0.3 }, 0);
    const clock = (this.clock = new THREE.Group());
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.17, 20), new THREE.MeshLambertMaterial({ color: 0xf8f4ea }));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 6, 20), new THREE.MeshLambertMaterial({ color: 0x5a3a22 }));
    clock.add(face, rim);
    const hand = (len, w) => { const g = new THREE.BoxGeometry(w, len, 0.01); g.translate(0, len / 2, 0.01); const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0x1a1a1a })); clock.add(m); return m; };
    this.hh = hand(0.09, 0.02); this.mh = hand(0.14, 0.012);
    L.mesh(clock, -0.2, Y + 2.05, Zb + 0.06);
    // raised floor and noren to the family's rooms
    const ax1 = -1.0;
    Wd.box((X0 + ax1) / 2, 0, Zb + 0.36, ax1 - X0, 0.42, 0.72, C(0x8a6440));
    P.box((X0 + ax1) / 2, 0.42, Zb + 0.36, ax1 - X0 - 0.06, 0.01, 0.68, C(0xc8b880));
    L.box((X0 + ax1) / 2, Zb + 0.36, (ax1 - X0) / 2, 0.38);
    P.box(-2.9, 0.42, Zb + 0.03, 1.5, 1.9, 0.02, C(0x2a2018));
    const nm = patch(new THREE.MeshLambertMaterial({ map: norenTex(), side: THREE.DoubleSide }), { key: 'sign' });
    for (let i = 0; i < 3; i++) {
      const g = new THREE.PlaneGeometry(0.48, 1.0); g.translate(0, -0.5, 0);
      g.attributes.uv.array.forEach((v, k, a) => { if (k % 2 === 0) a[k] = (i + v) / 3; });
      const m = L.mesh(new THREE.Mesh(g, nm), -3.4 + i * 0.5, Y + 2.3, Zb + 0.08);
      m.castShadow = false;
      W.flags.push(m);
    }
    for (const sx of [-0.12, 0.12]) P.box(-2.0 + sx, 0, Zb + 0.95, 0.1, 0.03, 0.24, C(0x8a6a4a));

    // ---- middle: the stepped stand of ten-yen sweets
    const tz = (cz + 0.35 + Zf) / 2 - 0.2, tw = 2.4, td = 1.2;
    Wd.box(0, 0, tz, tw, 0.5, td, C(0x7a5434));
    Wd.box(0, 0.5, tz, tw - 0.5, 0.2, td - 0.5, C(0x7a5434));
    Wd.box(0, 0.7, tz, tw - 1.0, 0.2, td - 0.8, C(0x7a5434));
    const tray = (x, y, z) => { P.box(x, y, z, 0.2, 0.06, 0.16, C(0xe8d8b8)); P.box(x, y + 0.02, z, 0.18, 0.05, 0.14, pick()); };
    for (let i = 0; i < 10; i++) { tray(-1.08 + i * 0.24, 0.5, tz - 0.48); tray(-1.08 + i * 0.24, 0.5, tz + 0.48); }
    for (let i = 0; i < 7; i++) { tray(-0.72 + i * 0.24, 0.7, tz - 0.22); tray(-0.72 + i * 0.24, 0.7, tz + 0.22); }
    for (let i = 0; i < 5; i++) {
      const x = -0.56 + i * 0.28;
      P.cyl(x, 0.9, tz, 0.08, 0.08, 0.22, 10, C(0xd8eaf0));
      P.cyl(x, 1.12, tz, 0.085, 0.085, 0.04, 10, C([0xd8302a, 0xf0c020, 0x3a8ae8][i % 3]));
      for (let k = 0; k < 4; k++) P.blob(x + (k % 2 - 0.5) * 0.06, 0.95 + Math.floor(k / 2) * 0.06, tz, 0.028, 0.028, 0.028, pick(), null, 0, 0, 1);
    }
    L.box(0, tz, tw / 2, td / 2);
    // ramune cooling in a tub of ice water by the door
    const rx = -3.2, rz = Zf - 0.75;
    P.box(rx, 0, rz, 0.85, 0.36, 0.55, C(0x2a7ad0));
    for (let i = 0; i < 12; i++) P.cyl(rx - 0.3 + (i % 6) * 0.12, 0.2, rz - 0.12 + Math.floor(i / 6) * 0.22, 0.03, 0.022, 0.24, 6, C(0x8ad8e8));
    const water = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.48), new THREE.MeshLambertMaterial({ color: 0x9ad8f0, transparent: true, opacity: 0.5, depthWrite: false }));
    water.rotation.x = -Math.PI / 2;
    L.mesh(water, rx, Y + 0.32, rz).castShadow = false;
    L.sign('ラムネ 100円', rx, Y + 0.25, rz + 0.285, 0.7, 0.18, { bg: '#ffffff', fg: '#2a6ad0', tw: 256, th: 64, font: JP_SANS, weight: 800 }, 0);
    L.box(rx, rz, 0.45, 0.3);

    // ---- ceiling: fluorescent tubes, a fan, toys and flypaper
    this.tubeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const tubes = new MeshBuilder();
    for (const x of [-1.8, 1.8]) {
      P.box(x, CH - 0.06, tz - 0.6, 0.2, 0.06, 1.3, C(0xe8e8e4), { bottom: true });
      tubes.box(x - 0.05, CH - 0.1, tz - 0.6, 0.04, 0.04, 1.2, C(0xffffff));
      tubes.box(x + 0.05, CH - 0.1, tz - 0.6, 0.04, 0.04, 1.2, C(0xffffff));
      W.lampSources.push({ x: L.wx(x, tz - 0.6), y: L.lot.h + Y + CH - 0.3, z: L.wz(x, tz - 0.6), color: 0xf0f6ff, power: 1, i: 4.5, dist: 8, kf: () => this.light });
    }
    const tm = new THREE.Mesh(tubes.build(), this.tubeMat);
    L.mesh(tm, 0, Y, 0).castShadow = false;
    const fan = (this.fan = new THREE.Group());
    const fm = new THREE.MeshLambertMaterial({ color: 0x8a8478 });
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.14, 12), fm); fan.add(motor);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), fm); rod.position.y = 0.2; fan.add(rod);
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.012, 0.13), new THREE.MeshLambertMaterial({ color: 0x6a4a32 }));
      b.position.set(Math.cos((i / 3) * Math.PI * 2) * 0.38, -0.03, Math.sin((i / 3) * Math.PI * 2) * 0.38);
      b.rotation.y = -(i / 3) * Math.PI * 2; b.rotation.x = 0.12;
      fan.add(b);
    }
    L.mesh(fan, 0.4, Y + CH - 0.42, cz + 1.3);
    for (const x of [-2.4, 2.6]) for (let k = 0; k < 3; k++) {
      P.box(x + k * 0.3, CH - 0.5 - k * 0.1, Zf - 0.9, 0.004, 0.5 + k * 0.1, 0.004, C(0xd8d8d8));
      P.box(x + k * 0.3, CH - 0.82 - k * 0.1, Zf - 0.9, 0.22, 0.3, 0.05, pick());
    }
    P.box(-0.4, CH - 0.55, cz + 0.6, 0.05, 0.5, 0.012, C(0xd8b830));
    // a wind chime just inside the door
    const fu = L.get('plain', 1.2, Y, Zf - 0.15);
    fu.blob(0, 2.18, 0, 0.055, 0.045, 0.055, C(0xa8d8e8), null, 0, 1, 1);
    fu.box(0, 2.0, 0, 0.04, 0.14, 0.005, C(0xf0d040));
    W.furin.push({ x: L.wx(1.2, Zf - 0.15), z: L.wz(1.2, Zf - 0.15), y: L.lot.h + 2.3 });

    // ---- the storefront: fixed glass panes and two sliding doors
    const glass = new THREE.MeshLambertMaterial({ color: 0xcfe4ee, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
    const alu = new THREE.MeshLambertMaterial({ color: 0xb8bcc0 });
    const pane = (w) => {
      const g = new THREE.Group();
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, 2.24), glass); gl.position.y = 1.15; g.add(gl);
      const fb = new MeshBuilder();
      fb.box(0, 0, 0, w, 0.05, 0.05, C(0xffffff)); fb.box(0, 2.25, 0, w, 0.05, 0.05, C(0xffffff));
      fb.box(-w / 2 + 0.025, 0, 0, 0.05, 2.3, 0.05, C(0xffffff)); fb.box(w / 2 - 0.025, 0, 0, 0.05, 2.3, 0.05, C(0xffffff));
      fb.box(0, 0.95, 0, w, 0.04, 0.04, C(0xffffff));
      g.add(new THREE.Mesh(fb.build(), alu));
      g.traverse((o) => { o.castShadow = false; });
      return g;
    };
    const zf = s.hz + s.hd - 0.07;
    for (const sx of [-1, 1]) L.mesh(pane(door / 2), sx * (door / 2 + door / 4), Y, zf + 0.02);
    this.doors = [-1, 1].map((sx) => ({ g: L.mesh(pane(door / 2), sx * door / 4, Y, zf - 0.05), sx, open: 1 }));
    this.doorCol = L.box(0, zf - 0.05, door / 2, 0.08);
    this.doorCol.flags = 0;
    this.door = door; this.zf = zf;

    // ---- the shopkeeper
    const k = (this.keeper = person({ skin: 0xd8b090, shirt: 0xeceae0, pants: 0x4a4a52, legs: 0x4a4a52, hair: 0xc8c8c8, scale: 0.94, shoes: 0x6a5a4a, sleeve: false }));
    P.cyl(1.5, 0, Zb + 0.42, 0.17, 0.17, 0.46, 10, C(0x8a6a4a));
    k.position.set(L.wx(1.5, Zb + 0.42), L.lot.h + Y + 0.04, L.wz(1.5, Zb + 0.42));
    k.rotation.y = L.lot.ang;
    pose(k, 'sit');
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.34), new THREE.MeshLambertMaterial({ map: newspaperTex(), side: THREE.DoubleSide }));
    paper.position.set(0, 0.28, 0.3); paper.rotation.x = -0.35;
    k.userData.spine.add(paper);
    this.paper = paper;
    k.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    W.scene.add(k);
    W.interact.push({ x: L.wx(1.5, cz + 0.85), z: L.wz(1.5, cz + 0.85), y: L.lot.h, r: 1.7, kind: 'shop', shop: 'store', label: 'Купить что-нибудь у прилавка', when: () => this.open });
    this.counterPos = { x: L.wx(1.5, cz + 0.9), z: L.wz(1.5, cz + 0.9) };

    this.open = true; this.light = 1; this.t = 0;
  }
  // is a point (camera) inside the shop?
  inside(p) {
    const L = this.L, dx = p.x - L.lot.x, dz = p.z - L.lot.z;
    const lx = dx * L.c - dz * L.s, lz = dx * L.s + dz * L.c;
    return lx > this.box.X0 - 0.05 && lx < this.box.X1 + 0.05 && lz > this.box.Zb - 0.05 && lz < this.box.Zf + 0.05 && p.y > this.floorY - 0.5 && p.y < this.floorY + 3;
  }
  update(dt, tSec, time, cam) {
    const h = time.hour;
    // the shopkeeper won't lock up with a customer still inside
    this.open = (h >= OPEN && h < CLOSE) || (this.open && this.inside(cam));
    this.light += ((this.open ? 1 : 0) - this.light) * Math.min(1, dt * 3);
    this.doorCol.flags = this.open ? 0 : CF.ALL;
    const L = this.L;
    const near = Math.abs(cam.x - L.lot.x) < 80 && Math.abs(cam.z - L.lot.z) < 80;
    this.keeper.visible = near && this.open;
    this.tubeMat.color.setScalar(0.25 + 1.6 * this.light);
    this.fridgeMat.color.setScalar(0.55 + 0.6 * this.light);
    for (const d of this.doors) {
      d.open += ((this.open ? 1 : 0) - d.open) * Math.min(1, dt * 2.5);
      d.g.position.copy(this.doorPos(d));
    }
    if (!near) return;
    this.t += dt;
    this.fan.rotation.y -= dt * 4.2 * this.light;
    this.tvMat.color.setScalar(this.light * (0.75 + 0.25 * Math.sin(tSec * 13) * Math.sin(tSec * 3.1)));
    const hr = h % 12, mn = (h * 60) % 60;
    this.hh.rotation.z = -(hr / 12) * Math.PI * 2; this.mh.rotation.z = -(mn / 60) * Math.PI * 2;
    // the shopkeeper reads; when you come up to the counter he lowers the paper and looks at you
    const u = this.keeper.userData, c = this.counterPos;
    const close = Math.hypot(cam.x - c.x, cam.z - c.z) < 2.6 && this.inside(cam);
    this.look = (this.look || 0) + ((close ? 1 : 0) - (this.look || 0)) * Math.min(1, dt * 2.5);
    const lk = this.look;
    u.shL.rotation.set(-1.0 + 0.6 * lk, 0, 0.25); u.shR.rotation.set(-1.0 + 0.6 * lk, 0, -0.25);
    u.elL.rotation.set(-0.9 + 0.5 * lk, 0, 0); u.elR.rotation.set(-0.9 + 0.5 * lk, 0, 0);
    this.paper.position.set(0, 0.28 - 0.25 * lk, 0.3 - 0.05 * lk);
    this.paper.rotation.x = -0.35 - 0.9 * lk;
    u.neck.rotation.x = 0.35 * (1 - lk) + Math.sin(this.t * 0.4) * 0.03;
    if (lk > 0.01) {
      const dx = cam.x - this.keeper.position.x, dz = cam.z - this.keeper.position.z;
      let a = Math.atan2(dx, dz) - this.keeper.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a));
      u.neck.rotation.y = Math.max(-0.9, Math.min(0.9, a)) * lk;
    } else u.neck.rotation.y = Math.sin(this.t * 0.13) * 0.1;
  }
  doorPos(d) {
    const L = this.L, lx = d.sx * this.door / 4 + d.sx * this.door / 2 * d.open * 0.98;
    return (this._dp || (this._dp = new THREE.Vector3())).set(L.wx(lx, this.zf - 0.05), L.lot.h + 0.18, L.wz(lx, this.zf - 0.05));
  }
}
