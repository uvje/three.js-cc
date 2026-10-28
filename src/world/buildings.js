import * as THREE from 'three';
import { C, varyColor } from '../core/builder.js';
import { RNG } from '../core/noise.js';
import * as MD from './models.js';
import { drawSign, canvas, tex, JP_SERIF, JP_SANS } from '../env/textures.js';
import { patch } from '../env/materials.js';
import { CF } from './collision.js';

// Houses (farmhouses with kura storehouses, Showa-era two-storey homes, small tin-roofed cottages) and the village shops.

const WHITE = C(0xffffff);
const FACE = { f: 0, b: Math.PI, r: Math.PI / 2, l: -Math.PI / 2 };

export class LotCtx {
  constructor(lot, world) { this.lot = lot; this.W = world; this.c = Math.cos(lot.ang); this.s = Math.sin(lot.ang); }
  wx(lx, lz) { return this.lot.x + lx * this.c + lz * this.s; }
  wz(lx, lz) { return this.lot.z - lx * this.s + lz * this.c; }
  get(key, lx = 0, ly = 0, lz = 0, rot = 0) {
    const b = this.W.chunks.get(key, this.lot.x, this.lot.z);
    b.place(this.lot.x, this.lot.h, this.lot.z, this.lot.ang);
    if (lx || ly || lz) b.translate(lx, ly, lz);
    if (rot) b.rotateY(rot);
    return b;
  }
  at(lx, ly, lz, rot = 0) { return (key) => this.get(key, lx, ly, lz, rot); }
  box(lx, lz, hw, hd, rot = 0, flags = CF.ALL, tag = null) { return this.W.col.addBox(this.wx(lx, lz), this.wz(lx, lz), hw, hd, this.lot.ang + rot, flags, tag); }
  circle(lx, lz, r) { return this.W.col.addCircle(this.wx(lx, lz), this.wz(lx, lz), r); }
  tree(type, lx, lz, s = 1) { this.W.plan.trees.push({ type, x: this.wx(lx, lz), z: this.wz(lx, lz), y: this.lot.h, s, r: lx * 7.1 + lz }); }
  vending(lx, lz, rot = 0, variant = 0, color = 0xd8d8d4) {
    const v = { x: this.wx(lx, lz), z: this.wz(lx, lz), y: this.lot.h, ang: this.lot.ang + rot, variant, color };
    this.W.vending.push(v);
    return v;
  }
  mesh(m, lx, ly, lz, rot = 0) {
    m.position.set(this.wx(lx, lz), this.lot.h + ly, this.wz(lx, lz));
    m.rotation.y = this.lot.ang + rot;
    m.updateMatrixWorld();
    this.W.extras.push(m);
    return m;
  }
  sign(text, lx, ly, lz, w, h, o = {}, rot = 0) {
    const t = drawSign(text, { w: o.tw || 512, h: o.th || Math.round(512 * (h / w)), ...o });
    const mat = patch(new THREE.MeshLambertMaterial({ map: t, emissiveMap: o.glow ? t : null, emissive: o.glow ? 0xffffff : 0x000000, emissiveIntensity: 0 }), { key: 'sign' });
    if (o.glow) this.W.glowSigns.push({ mat, k: o.glow });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.castShadow = false;
    return this.mesh(m, lx, ly, lz, rot);
  }
}

function pickWin(rng) { return rng.weighted([['A', 0.5], ['B', 0.24], ['C', 0.12], [null, 0.14]]); }
const wkey = (kind, g) => (g ? kind + (kind === 'win' ? g : g === 'C' ? 'A' : g) : kind + 'Dark');

function win(H, key, face, ext, u, y, w, h, frameCol) {
  const b = H(key); b.rotateY(FACE[face]);
  const z = ext + 0.035;
  b.quad([u - w / 2, y, z], [u + w / 2, y, z], [u + w / 2, y + h, z], [u - w / 2, y + h, z], WHITE, [0, 0, 1, 1]);
  if (frameCol) {
    const P = H('plain'); P.rotateY(FACE[face]);
    P.box(u, y + h, ext + 0.03, w + 0.12, 0.07, 0.09, frameCol);
    P.box(u, y - 0.06, ext + 0.05, w + 0.16, 0.06, 0.13, frameCol);
  }
}
function windowsAlong(H, key, face, ext, span, y, h, rng, frameCol, gap = 0.9) {
  let u = -span / 2 + 0.7;
  while (u < span / 2 - 1.0) {
    const w = rng.float(1.0, 1.7);
    if (u + w > span / 2 - 0.5) break;
    if (rng.chance(0.75)) win(H, key, face, ext, u + w / 2, y, w, h, frameCol);
    u += w + gap + rng.float(0, 1.2);
  }
}
function pentRoof(H, key, ext, len, y, depth, k, color, face = 'f') {
  const b = H(key); b.rotateY(FACE[face]);
  const hl = len / 2;
  b.quad([-hl, y - depth * k, ext + depth], [hl, y - depth * k, ext + depth], [hl, y, ext], [-hl, y, ext], color, [-hl, 0, hl, depth]);
  b.quad([hl, y - depth * k - 0.08, ext + depth], [-hl, y - depth * k - 0.08, ext + depth], [-hl, y - 0.08, ext], [hl, y - 0.08, ext], C(0x3a3430));
  b.quad([-hl, y - depth * k - 0.08, ext + depth], [hl, y - depth * k - 0.08, ext + depth], [hl, y - depth * k, ext + depth], [-hl, y - depth * k, ext + depth], color);
}

export function buildLots(W) {
  for (const lot of W.plan.lots) {
    const seed = (Math.floor(lot.x * 13.7 + lot.z * 7.3) & 0xffff) ^ 0x5a5a;
    const rng = new RNG(seed);
    const L = new LotCtx(lot, W);
    lot.win = pickWin(rng);
    if (lot.shop) SHOPS[lot.shop](L, rng);
    else if (lot.style === 'farm') farmLot(L, rng);
    else townLot(L, rng);
  }
}

// ----------------------------------------------------------------- farm lots
function farmLot(L, rng) {
  const { w, d } = L.lot;
  const g = L.lot.win;
  const fw = Math.min(w - 5, rng.float(11, 14.5)), fd = Math.min(d - 10, rng.float(7.8, 9.6));
  const hx = rng.float(-1, 1) * Math.max(0, (w - fw) / 2 - 2.5);
  const hz = -d / 2 + fd / 2 + rng.float(1.4, 2.6);
  farmhouse(L, rng, hx, hz, fw, fd, g);
  const yardFront = d / 2 - 0.6, yardBack = hz + fd / 2 + 1.6;
  const yardD = yardFront - yardBack;
  const sides = [-1, 1];
  if (rng.chance(0.5)) sides.reverse();
  let usedKura = false;
  for (const sd of sides) {
    const x = sd * (w / 2 - 2.6);
    if (yardD < 5.5) break;
    const r = rng.next();
    if (!usedKura && r < 0.45) { kura(L, rng, x, yardBack + 2.4, -sd * Math.PI / 2); usedKura = true; }
    else if (r < 0.8) shed(L, rng, x, yardBack + 2.4, -sd * Math.PI / 2);
  }
  // front: hedge (most), block wall, or open
  const front = rng.weighted([['hedge', 0.55], ['block', 0.28], ['open', 0.17]]);
  const gate = rng.float(-1, 1) * (w / 2 - 4);
  frontage(L, rng, front, gate, 4.2);
  if (rng.chance(0.6)) {
    const tx = gate + rng.sign() * 1.0;
    MD.keiTruck(L.at(tx, 0, yardFront - 3.2, rng.float(-0.25, 0.25) + (rng.chance(0.5) ? Math.PI : 0)), rng);
    L.box(tx, yardFront - 3.2, 0.8, 1.75);
  }
  // windbreak grove behind the house and garden trees
  for (let x = -w / 2 + 1.5; x < w / 2 - 1; x += rng.float(3.5, 6)) if (rng.chance(0.7)) L.tree(rng.chance(0.3) ? 'sugi' : 'broad', x, -d / 2 + 0.7, rng.float(0.7, 1.0));
  L.tree('pine', hx + (fw / 2 + 1.2) * rng.sign(), hz + fd / 2 + 2.0, rng.float(0.7, 1.0));
  if (rng.chance(0.65)) L.tree('kaki', rng.sign() * (w / 2 - 1.5), yardBack + 1.0, rng.float(0.7, 0.95));
  for (let i = 0; i < 3; i++) if (rng.chance(0.6)) { MD.shrub(L.at(hx + rng.float(-fw / 2, fw / 2), 0, hz + fd / 2 + 1.5, 0), rng, rng.float(0.6, 0.9), rng.pick([0x3f6a2c, 0x4a7a34, 0x365e28])); }
  if (rng.chance(0.4)) MD.laundry(L.at(hx + rng.float(-2, 2), 0, hz + fd / 2 + 2.5, 0), rng);
  if (rng.chance(0.45)) { const px = hx + (fw / 2 + 0.35) * rng.sign(); MD.propane(L.at(px, 0, hz - 1, Math.PI / 2)); }
  if (rng.chance(0.5)) MD.potPlants(L.at(hx + (rng.chance(0.5) ? -1 : 1) * (fw / 2 - 1.2), 0, hz + fd / 2 + 1.25, 0), rng, rng.int(3, 6));
  if (rng.chance(0.3)) { MD.bicycle(L.at(hx + rng.float(-3, 3), 0, hz + fd / 2 + 1.7, Math.PI / 2 + rng.float(-0.2, 0.2)), rng.pick([0x8ab8c8, 0xd8d0c0, 0x5a8a5a, 0xc87a7a])); }
  // furin wind chime on the engawa of some houses
  if (rng.chance(0.4)) L.W.furin.push({ x: L.wx(hx, hz + fd / 2 + 0.95), z: L.wz(hx, hz + fd / 2 + 0.95), y: L.lot.h + 2.6 });
  if (rng.chance(0.35)) vegPatch(L, rng, rng.sign() * (w / 2 - 3), yardBack + 0.6);
}

function frontage(L, rng, kind, gate, gap) {
  const { w, d } = L.lot;
  const z = d / 2 - 0.25;
  const a = -w / 2 + 0.2, b = gate - gap / 2, c = gate + gap / 2, e = w / 2 - 0.2;
  if (kind === 'block') {
    const h = rng.float(1.0, 1.5);
    for (const [x0, x1] of [[a, b], [c, e]]) if (x1 - x0 > 0.4) { MD.blockWall(L.at(0, 0, 0), x0, x1, z, h); L.box((x0 + x1) / 2, z, (x1 - x0) / 2, 0.1); }
    // gate posts
    const P = L.get('plain');
    P.box(b - 0.15, 0, z, 0.35, h + 0.2, 0.35, C(0x8a867e));
    P.box(c + 0.15, 0, z, 0.35, h + 0.2, 0.35, C(0x8a867e));
    MD.mailbox(L.at(c + 0.6, 0, z + 0.25, 0));
    // side walls along part of the lot
    if (rng.chance(0.5)) for (const sx of [-w / 2 + 0.1, w / 2 - 0.1]) {
      const B = L.get('block', sx, 0, z, Math.PI / 2);
      const len = rng.float(4, d * 0.6);
      B.box(len / 2, 0, 0, len, h, 0.15, C(0xd0ccc4), { topColor: C(0x9a968c) });
      L.box(sx, z - len / 2, 0.1, len / 2);
    }
  } else if (kind === 'hedge') {
    const h = rng.float(1.0, 1.5);
    for (const [x0, x1] of [[a, b], [c, e]]) if (x1 - x0 > 0.6) { MD.hedge(L.at(0, 0, 0), rng, x0, z, x1, z, h); L.box((x0 + x1) / 2, z, (x1 - x0) / 2, 0.35); }
    MD.mailbox(L.at(c + 0.5, 0, z + 0.45, 0));
  }
}

function farmhouse(L, rng, hx, hz, fw, fd, g) {
  const H = (k) => L.get(k, hx, 0, hz);
  const hw = fw / 2, hd = fd / 2;
  const woodC = varyColor(rng.pick([0x4a3426, 0x3e2c22, 0x56402e, 0x2e2622]), rng, 0.05);
  const darkWood = C(0x2c211a);
  const plasterC = varyColor(rng.pick([0xece6d8, 0xe4dccb, 0xf2eee4]), rng, 0.03);
  const roofC = varyColor(rng.pick([0x9aa2ac, 0x8c96a8, 0xa49c96, 0x94827a]), rng, 0.04);
  const ridgeC = C(0x5a6068);
  const allWood = rng.chance(0.35);
  const frame = C(0x3a2c22);
  H('plain').box(0, 0, 0, fw + 0.12, 0.45, fd + 0.12, C(0x8c8880));
  H('wood').box(0, 0.45, 0, fw, allWood ? 2.75 : 1.05, fd, woodC, { noTop: true });
  if (!allWood) H('plaster').box(0, 1.5, 0, fw - 0.02, 1.7, fd - 0.02, plasterC, { noTop: true });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) H('plain').box(sx * hw, 0.45, sz * hd, 0.16, 2.75, 0.16, darkWood);
  const genR = rng.chance(0.5);
  const ew = fw - 2.8;
  const ex = genR ? -1.4 : 1.4;
  H('plain').box(ex, 0.25, hd + 0.45, ew, 0.3, 0.9, C(0x7a5a3e));
  const n = Math.max(2, Math.floor(ew / 1.75));
  const shoji = rng.chance(0.45);
  for (let i = 0; i < n; i++) win(H, wkey(shoji ? 'shoji' : 'win', g), 'f', hd, ex - ew / 2 + (i + 0.5) * (ew / n), 0.62, ew / n - 0.06, 1.85, null);
  for (let i = 0; i <= n; i++) H('plain').box(ex - ew / 2 + (i * ew) / n, 0.55, hd + 0.92, 0.12, 2.6, 0.12, darkWood);
  H('plain').box(ex, 2.68, hd + 0.92, ew + 0.2, 0.14, 0.16, darkWood);
  const gx = genR ? hw - 1.35 : -hw + 1.35;
  win(H, wkey('door', g), 'f', hd, gx, 0.45, 1.8, 2.05, frame);
  const K = H('kawara'); K.translate(gx, 2.85, hd + 0.55); K.rotateY(Math.PI / 2);
  K.gableRoof(1.5, 2.4, 0, 0.25, 0.55, roofC, { thickness: 0.12, gableColor: woodC, ridgeColor: ridgeC });
  for (const f of ['r', 'l']) windowsAlong(H, wkey('win', g), f, hw, fd, 1.4, 1.0, rng, frame, 1.2);
  windowsAlong(H, wkey(rng.chance(0.5) ? 'shoji' : 'win', g), 'b', hd, fw, 1.3, 1.1, rng, frame);
  const R = H('kawara'); R.translate(0, 3.2, 0);
  R.hipRoof(fw, fd, 0, 1.15, 0.56, roofC, { ridgeColor: ridgeC, irimoya: rng.chance(0.7), gableColor: woodC });
  L.box(hx, hz + 0.45, hw + 0.15, hd + 0.95);
  L.lot.house = { hx, hz, fw, fd, ex, ew, gx };
}

function kura(L, rng, x, z, rot) {
  const H = (k) => L.get(k, x, 0, z, rot);
  const kw = 4.6, kd = 3.8;
  const pl = C(0xf0ece2), roofC = varyColor(0x9aa2ac, rng, 0.04), dark = C(0x26201c);
  H('plain').box(0, 0, 0, kw + 0.25, 0.5, kd + 0.25, C(0x8c8880));
  H('namako').box(0, 0.5, 0, kw, 1.25, kd, WHITE, { noTop: true });
  H('plaster').box(0, 1.75, 0, kw, 3.9, kd, pl, { noTop: true });
  H('plain').box(0, 4.15, kd / 2, 0.75, 0.62, 0.14, dark);
  H('plain').box(1.2, 2.6, kd / 2, 0.55, 0.5, 0.12, dark);
  H('plain').box(0, 0.5, kd / 2 + 0.04, 1.35, 2.1, 0.16, C(0x3a2a20));
  H('plain').box(0, 2.6, kd / 2 + 0.25, 2.0, 0.08, 0.5, dark);
  const R = H('kawara'); R.translate(0, 5.65, 0);
  R.gableRoof(kw, kd, 0, 0.55, 0.62, roofC, { ridgeColor: C(0x4a5058), gableColor: pl, thickness: 0.3 });
  L.box(x, z, rot ? kd / 2 + 0.15 : kw / 2 + 0.15, rot ? kw / 2 + 0.15 : kd / 2 + 0.15);
}

function shed(L, rng, x, z, rot) {
  const H = (k) => L.get(k, x, 0, z, rot);
  const sw = 5.2, sd = 3.8, h = 2.6;
  const tinC = varyColor(rng.pick([0x8f9aa0, 0x7a8a96, 0xa08a7a]), rng, 0.06);
  const roofC = varyColor(rng.pick([0x9b3a2e, 0x2e5a7a, 0x4a6a4a, 0x7a5a48]), rng, 0.06);
  const T = H('tin');
  T.box(0, 0, -sd / 2 + 0.05, sw, h, 0.1, tinC);
  T.box(-sw / 2 + 0.05, 0, 0, 0.1, h, sd, tinC);
  T.box(sw / 2 - 0.05, 0, 0, 0.1, h, sd, tinC);
  for (const px of [-sw / 2 + 0.1, sw / 2 - 0.1]) H('plain').box(px, 0, sd / 2 - 0.1, 0.12, h, 0.12, C(0x4a4a48));
  const R = H('tin'); R.translate(0, h, 0);
  R.gableRoof(sw, sd, 0, 0.4, 0.32, roofC, { thickness: 0.08, gableColor: tinC });
  const P = H('plain');
  if (rng.chance(0.5)) { // little tractor
    P.box(0, 0.35, 0.2, 0.9, 0.55, 1.6, C(0xe0602a));
    P.box(0, 0.9, -0.2, 0.6, 0.5, 0.5, C(0xe0602a));
    P.cyl(0, 1.4, -0.2, 0.03, 0.03, 0.6, 4, C(0x333333));
    for (const sx of [-0.55, 0.55]) { P.push(); P.translate(sx, 0.45, -0.3); P.rotateZ(Math.PI / 2); P.cyl(0, -0.12, 0, 0.45, 0.45, 0.24, 10, C(0x1e1e1e), { cap: true }); P.pop(); }
    for (const sx of [-0.45, 0.45]) { P.push(); P.translate(sx, 0.25, 0.75); P.rotateZ(Math.PI / 2); P.cyl(0, -0.09, 0, 0.25, 0.25, 0.18, 8, C(0x1e1e1e), { cap: true }); P.pop(); }
  } else {
    for (let i = 0; i < 6; i++) P.box(rng.float(-1.8, 1.8), 0, rng.float(-1.2, 0.5), 0.5, 0.35 + rng.float(0, 0.4), 0.5, C(rng.pick([0xd8c890, 0x3a6ab0, 0x8a6a4a, 0xc8c0b0])));
  }
  L.box(x, z, rot ? sd / 2 : sw / 2, rot ? sw / 2 : sd / 2);
}

function vegPatch(L, rng, x, z) {
  const Fo = L.get('foliage', x, 0, z);
  const P = L.get('plain', x, 0, z);
  P.box(0, 0, 0, 3.4, 0.08, 3.2, C(0x5a4630));
  for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) {
    const px = -1.4 + k * 0.56, pz = -1.2 + r * 0.8;
    Fo.blob(px, 0.3, pz, 0.22, 0.25, 0.22, varyColor(0x4a7a2c, rng, 0.12), rng, 0.3, 0);
    if (r % 2 === 0) P.box(px, 0.08, pz, 0.025, 1.2, 0.025, C(0x8a7a5a));
    if (r % 2 === 0 && rng.chance(0.5)) Fo.blob(px + 0.08, 0.55, pz, 0.05, 0.05, 0.05, C(rng.pick([0xd03a2a, 0x5a2a6a])), null, 0, 0);
  }
}

// ----------------------------------------------------------------- town lots
function townLot(L, rng) {
  const { w, d } = L.lot;
  const g = L.lot.win;
  const t = rng.weighted([['showa', 0.55], ['small', 0.3], ['modern', 0.15]]);
  if (t === 'small') {
    const sw = Math.min(w - 3, rng.float(6.5, 8)), sd = Math.min(d - 6, rng.float(5.5, 7));
    const hx = rng.float(-1, 1) * Math.max(0, (w - sw) / 2 - 1.5), hz = -d / 2 + sd / 2 + rng.float(1, 2.5);
    const akiya = !g && rng.chance(0.7);
    smallHouse(L, rng, hx, hz, sw, sd, g, akiya);
    if (!akiya) frontage(L, rng, rng.weighted([['block', 0.5], ['hedge', 0.3], ['open', 0.2]]), hx + rng.float(-1, 1), 3.2);
    else { for (let i = 0; i < 5; i++) MD.shrub(L.at(rng.float(-w / 2 + 1, w / 2 - 1), 0, rng.float(0, d / 2 - 1), 0), rng, rng.float(0.8, 1.4), 0x4a6a30); L.W.tallGrassLots.push(L.lot); }
    if (rng.chance(0.5)) L.tree(rng.pick(['kaki', 'pine', 'maple']), (w / 2 - 1.5) * rng.sign(), d / 2 - 2.5, rng.float(0.6, 0.85));
    if (!akiya && rng.chance(0.35)) MD.laundry(L.at(hx, 0, hz + sd / 2 + 1.8, 0), rng);
  } else {
    const sw = Math.min(w - 3.5, rng.float(7.5, 9.5)), sd = Math.min(d - 6, rng.float(6.5, 8));
    const hx = rng.float(-1, 1) * Math.max(0, (w - sw) / 2 - 1.8), hz = -d / 2 + sd / 2 + rng.float(1, 2.2);
    if (t === 'showa') showa(L, rng, hx, hz, sw, sd, g); else modern(L, rng, hx, hz, sw, sd, g);
    const gate = hx + rng.float(-1.5, 1.5);
    frontage(L, rng, rng.weighted([['block', 0.6], ['hedge', 0.25], ['open', 0.15]]), gate, 3.4);
    if (rng.chance(0.25)) { MD.keiTruck(L.at(gate, 0, hz + sd / 2 + 2.6, Math.PI / 2 + rng.float(-0.1, 0.1)), rng, rng.pick([0xf2f2ee, 0xf2f2ee, 0x9ab0c8])); L.box(gate, hz + sd / 2 + 2.6, 1.75, 0.8); }
    if (rng.chance(0.55)) L.tree(rng.pick(['pine', 'maple', 'kaki', 'broad']), (w / 2 - 1.3) * (hx > 0 ? -1 : 1), d / 2 - 2.0, rng.float(0.55, 0.85));
    if (rng.chance(0.6)) MD.acUnit(L.at(hx + (sw / 2 + 0.25) * rng.sign(), 0, hz + rng.float(-1, 1), Math.PI / 2 * rng.sign()));
    if (rng.chance(0.4)) MD.potPlants(L.at(gate + 1.4, 0, hz + sd / 2 + 0.5, 0), rng, rng.int(2, 5));
    if (rng.chance(0.3)) MD.bicycle(L.at(hx - sw / 2 + 0.8, 0, hz + sd / 2 + 1.1, Math.PI / 2), rng.pick([0x8ab8c8, 0xe0d8c8, 0x5a7a9a, 0xd89aa0]));
    if (rng.chance(0.3)) L.W.furin.push({ x: L.wx(hx, hz + sd / 2 + 0.6), z: L.wz(hx, hz + sd / 2 + 0.6), y: L.lot.h + 2.4 });
  }
}

function showa(L, rng, hx, hz, sw, sd, g) {
  const H = (k) => L.get(k, hx, 0, hz);
  const hw = sw / 2, hd = sd / 2;
  const wallKey = rng.chance(0.7) ? 'siding' : 'plaster';
  const wallC = varyColor(rng.pick([0xd8ccb0, 0xc9c8c0, 0xe6dcc4, 0xb8c4c8, 0xd4b8a0, 0xc8d0b8, 0xe8e4dc]), rng, 0.04);
  const tinRoof = rng.chance(0.35);
  const roofKey = tinRoof ? 'tin' : 'kawara';
  const roofC = tinRoof ? varyColor(rng.pick([0x8a3a2e, 0x2e5a7a, 0x3d6a4a, 0x5a4a40]), rng, 0.05) : varyColor(rng.pick([0x9aa2ac, 0x7a8aa8, 0xa49c96]), rng, 0.04);
  const frame = C(0xb4b8ba);
  H('plain').box(0, 0, 0, sw + 0.1, 0.4, sd + 0.1, C(0x9a968e));
  H(wallKey).box(0, 0.4, 0, sw, 5.4, sd, wallC, { noTop: true });
  const doorRight = rng.chance(0.5);
  const dx = doorRight ? hw - 1.1 : -hw + 1.1;
  win(H, wkey('door', g), 'f', hd, dx, 0.4, 1.3, 2.05, frame);
  win(H, wkey('win', g), 'f', hd, doorRight ? -hw + 1.8 : hw - 1.8, 0.55, 2.4, 1.85, frame);
  const balcony = rng.chance(0.55);
  if (!balcony) pentRoof(H, roofKey, hd, sw + 0.4, 3.15, 0.7, 0.45, roofC, 'f');
  pentRoof(H, roofKey, hd, sw + 0.4, 3.15, 0.6, 0.45, roofC, 'b');
  for (const f of ['r', 'l']) { windowsAlong(H, wkey('win', g), f, hw, sd, 1.15, 1.1, rng, frame); windowsAlong(H, wkey('win', g), f, hw, sd, 3.75, 1.05, rng, frame); }
  windowsAlong(H, wkey('win', g), 'b', hd, sw, 1.2, 1.0, rng, frame);
  windowsAlong(H, wkey('win', g), 'b', hd, sw, 3.75, 1.05, rng, frame);
  win(H, wkey('win', g), 'f', hd, -hw / 2, 3.65, 1.6, 1.15, frame);
  win(H, wkey('win', g), 'f', hd, hw / 2, 3.65, 1.6, 1.15, frame);
  if (balcony) {
    const P = H('plain');
    P.box(0, 3.05, hd + 0.5, sw * 0.7, 0.14, 1.0, C(0xb0aca4));
    const rc = C(0xc8ccce);
    P.box(0, 4.0, hd + 0.98, sw * 0.7, 0.05, 0.05, rc);
    for (let x = -sw * 0.35; x <= sw * 0.35 + 0.01; x += 0.12) P.box(x, 3.19, hd + 0.98, 0.025, 0.82, 0.025, rc);
    for (const sx of [-1, 1]) { P.box(sx * sw * 0.35, 3.19, hd + 0.5, 0.05, 0.85, 1.0, rc); }
    if (rng.chance(0.75)) MD.laundry((k) => { const b = H(k); b.translate(0, 3.2, hd + 0.55); b.scale(sw * 0.24, 0.85, 1); return b; }, rng);
  }
  const R = H(roofKey); R.translate(0, 5.8, 0);
  if (rng.chance(0.5)) R.hipRoof(sw, sd, 0, 0.6, 0.5, roofC, { ridgeColor: C(0x5a6068) });
  else R.gableRoof(sw, sd, 0, 0.55, 0.5, roofC, { ridgeColor: tinRoof ? null : C(0x5a6068), gableColor: wallC });
  L.box(hx, hz, hw + 0.1, hd + (balcony ? 0.1 : 0.2));
}

function modern(L, rng, hx, hz, sw, sd, g) {
  const H = (k) => L.get(k, hx, 0, hz);
  const hw = sw / 2, hd = sd / 2;
  const wallC = varyColor(rng.pick([0xeeeeea, 0x9a9c9e, 0xd8d0c4, 0x6a6e72]), rng, 0.03);
  const roofC = C(rng.pick([0x5a5e64, 0x3e4248, 0x6a5a50]));
  const frame = C(0x3a3c3e);
  H('plain').box(0, 0, 0, sw + 0.1, 0.45, sd + 0.1, C(0xa09c94));
  H('siding').box(0, 0.45, 0, sw, 5.5, sd, wallC, { noTop: true });
  win(H, wkey('door', g), 'f', hd, -hw + 1.0, 0.45, 1.0, 2.1, frame);
  win(H, wkey('win', g), 'f', hd, hw * 0.25, 0.6, 2.8, 1.9, frame);
  win(H, wkey('win', g), 'f', hd, -hw * 0.3, 3.6, 2.2, 1.2, frame);
  win(H, wkey('win', g), 'f', hd, hw * 0.55, 3.6, 1.0, 1.2, frame);
  for (const f of ['r', 'l']) windowsAlong(H, wkey('win', g), f, hw, sd, 3.7, 1.0, rng, frame, 1.4);
  windowsAlong(H, wkey('win', g), 'b', hd, sw, 1.2, 1.1, rng, frame);
  const R = H('tin'); R.translate(0, 5.95, 0);
  R.gableRoof(sw, sd, 0, 0.45, 0.28, roofC, { gableColor: wallC, thickness: 0.15 });
  H('plain').box(-hw + 1.0, 2.6, hd + 0.4, 1.6, 0.08, 0.9, C(0x6a6c70));
  L.box(hx, hz, hw + 0.1, hd + 0.1);
}

function smallHouse(L, rng, hx, hz, sw, sd, g, akiya) {
  const H = (k) => L.get(k, hx, 0, hz);
  const hw = sw / 2, hd = sd / 2;
  const wood = rng.chance(0.55);
  const wallC = wood ? varyColor(rng.pick([0x5a4232, 0x4a3628, 0x6a5444]), rng, 0.06) : varyColor(rng.pick([0xc8c0a8, 0xb8b8b0, 0xd0c4a8]), rng, 0.05);
  const roofC = akiya ? varyColor(0x7a4a34, rng, 0.08) : varyColor(rng.pick([0x9b3a2e, 0x2e5a7a, 0x3d6a4a, 0x8a5a3a]), rng, 0.06);
  const frame = C(akiya ? 0x6a5a4a : 0xa8acae);
  H('plain').box(0, 0, 0, sw + 0.1, 0.35, sd + 0.1, C(0x8c8880));
  H(wood ? 'wood' : 'siding').box(0, 0.35, 0, sw, 2.55, sd, wallC, { noTop: true });
  const k = akiya ? 'shutter' : wkey('win', g);
  win(H, akiya ? 'shutter' : wkey('door', g), 'f', hd, -hw + 1.0, 0.35, 1.2, 1.95, frame);
  win(H, k, 'f', hd, hw * 0.35, 0.8, 2.0, 1.3, frame);
  for (const f of ['r', 'l', 'b']) windowsAlong(H, k, f, f === 'b' ? hd : hw, f === 'b' ? sw : sd, 1.0, 1.0, rng, frame, 1.3);
  const R = H('tin'); R.translate(0, 2.9, 0);
  R.gableRoof(sw, sd, 0, 0.5, 0.5, roofC, { gableColor: wallC, thickness: 0.1 });
  pentRoof(H, 'tin', hd, 2.0, 2.45, 0.6, 0.3, roofC, 'f');
  L.box(hx, hz, hw + 0.1, hd + 0.1);
}

// ----------------------------------------------------------------- shops
function awningTex(c1, c2, stripes = 8) {
  const [c, x] = canvas(256, 64);
  for (let i = 0; i < stripes; i++) { x.fillStyle = i % 2 ? c2 : c1; x.fillRect((i * 256) / stripes, 0, 256 / stripes + 1, 64); }
  x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(0, 56, 256, 8);
  return tex(c, { clamp: true });
}
function awning(L, lx, lz, w, depth, y, tx, rot = 0) {
  const mat = patch(new THREE.MeshLambertMaterial({ map: tx, side: THREE.DoubleSide }), { key: 'awn' });
  const g = new THREE.BufferGeometry();
  const k = 0.42;
  const p = [-w / 2, y, 0, w / 2, y, 0, w / 2, y - depth * k, depth, -w / 2, y - depth * k, depth,
    -w / 2, y - depth * k, depth, w / 2, y - depth * k, depth, w / 2, y - depth * k - 0.28, depth, -w / 2, y - depth * k - 0.28, depth];
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0.15, 0, 0.15, 0, 0.15, 1, 0.15, 1, 0, 0, 0], 2));
  g.setIndex([0, 3, 2, 0, 2, 1, 4, 7, 6, 4, 6, 5]);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true; m.receiveShadow = true;
  L.mesh(m, lx, 0, lz, rot);
}
function nobori(L, lx, lz, text, bg, fg) {
  const P = L.get('plain', lx, 0, lz);
  P.cyl(0, 0, 0, 0.025, 0.025, 2.9, 5, C(0xc8c8c8));
  P.box(0, 0, 0, 0.3, 0.12, 0.3, C(0x4a4a4a));
  const t = drawSign(text, { w: 128, h: 448, vertical: true, bg, fg, font: JP_SERIF });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.75), patch(new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide }), { key: 'sign' }));
  L.mesh(m, lx + 0.27, 1.9, lz, 0);
  L.W.flags.push(m);
}
function shopHouse(L, rng, o) {
  const { w, d } = L.lot;
  const sw = w - 1.0, sd = d - 2.6, hz = -1.2;
  const fz = hz + sd / 2; // front face z
  const H = (k) => L.get(k, 0, 0, hz);
  const hw = sw / 2, hd = sd / 2;
  const wallC = o.wallC || varyColor(rng.pick([0xd8d0bc, 0xcfc8b4, 0xe2dccc]), rng, 0.03);
  const frame = C(0xb8bcbe);
  H('plain').box(0, 0, 0, sw + 0.1, 0.18, sd + 0.1, C(0x9a968e));
  H(o.wallKey || 'siding').box(0, 0.18, 0, sw, o.storeys === 1 ? 3.3 : 5.8, sd, wallC, { noTop: true });
  // storefront glass
  const gw = sw * 0.72;
  const n = 4;
  for (let i = 0; i < n; i++) win(H, 'doorA', 'f', hd, -gw / 2 + (i + 0.5) * (gw / n), 0.18, gw / n - 0.04, 2.3, null);
  H('plain').box(0, 2.48, hd + 0.02, gw + 0.2, 0.12, 0.12, frame);
  if (o.storeys !== 1) {
    win(H, wkey('win', L.lot.win || 'A'), 'f', hd, -hw / 2, 3.9, 1.6, 1.1, frame);
    win(H, wkey('win', L.lot.win || 'A'), 'f', hd, hw / 2, 3.9, 1.6, 1.1, frame);
    for (const f of ['r', 'l']) windowsAlong(H, wkey('win', L.lot.win || 'B'), f, hw, sd, 3.9, 1.0, rng, frame, 1.5);
  }
  // flat kanban facade rising above the roof line
  const topY = o.storeys === 1 ? 4.2 : 6.6;
  H(o.wallKey || 'siding').box(0, o.storeys === 1 ? 3.48 : 5.98, hd - 0.1, sw + 0.2, topY - (o.storeys === 1 ? 3.48 : 5.98), 0.25, wallC);
  const R = H(o.roofKey || 'tin'); R.translate(0, o.storeys === 1 ? 3.48 : 5.98, 0);
  R.gableRoof(sw, sd, 0, 0.35, 0.35, o.roofC || C(0x6a6e74), { thickness: 0.12, gableColor: wallC });
  L.box(0, hz, hw + 0.1, hd + 0.1, 0, CF.ALL, 'shop');
  return { sw, sd, hz, fz, hw, hd, topY };
}

const SHOPS = {
  store(L, rng) {
    const s = shopHouse(L, rng, { wallC: C(0xd6ccb4), roofC: C(0x5a3a2e) });
    awning(L, 0, s.fz, s.sw * 0.82, 1.7, 3.05, awningTex('#2f7a4a', '#f2f0e6'));
    L.sign('なつめ商店', 0, 4.15, s.fz + 0.16, s.sw * 0.78, 0.95, { bg: '#f6f2e6', fg: '#b8282a', border: '#2f5a3a', borderW: 10, glow: 0.5, sub: 'たばこ・おかし・アイス' });
    L.sign('たばこ', -s.hw + 0.32, 2.6, s.fz + 0.4, 0.42, 1.25, { vertical: true, bg: '#d42c24', fg: '#ffffff', tw: 128, th: 384, glow: 0.8 }, 0);
    L.vending(-s.hw + 0.65, s.fz + 0.55, 0, 2, 0xc8302a);
    L.vending(-s.hw + 1.75, s.fz + 0.55, 0, 0, 0x2a5aa8);
    MD.bench(L.at(s.hw - 1.6, 0, s.fz + 0.6, 0), 0xc8302a, 1.6);
    L.box(s.hw - 1.6, s.fz + 0.6, 0.85, 0.3);
    const P = L.get('plain', s.hw - 0.3, 0, s.fz + 0.95);
    P.box(0, 0, 0, 0.55, 0.85, 0.85, C(0xf2f2ee));
    P.box(0, 0.85, 0, 0.56, 0.04, 0.86, C(0x9ac8e8));
    L.box(s.hw - 0.3, s.fz + 0.95, 0.3, 0.45);
    nobori(L, s.hw + 0.15, s.fz + 1.6, '氷', '#ffffff', '#c82a2a');
    // gachapon
    const G = L.get('plain', -s.hw + 2.9, 0, s.fz + 0.4);
    for (let i = 0; i < 3; i++) { G.box(i * 0.45, 0, 0, 0.42, 0.9, 0.4, C([0xe84a3a, 0x3a8ae8, 0xf0c030][i])); G.blob(i * 0.45, 1.15, 0, 0.18, 0.22, 0.18, C(0xe8f4ff), null, 0, 1, 1); }
    L.box(-s.hw + 3.35, s.fz + 0.4, 0.7, 0.25);
    L.W.interact.push({ x: L.wx(0, s.fz + 0.8), z: L.wz(0, s.fz + 0.8), y: L.lot.h, r: 2.2, kind: 'shop', shop: 'store', label: 'Зайти в «Нацумэ сётэн»' });
    L.W.shopSpots.store = { x: L.wx(0, s.fz + 0.8), z: L.wz(0, s.fz + 0.8) };
  },
  liquor(L, rng) {
    const s = shopHouse(L, rng, { wallC: C(0xe0dccf), roofC: C(0x4a4e56), roofKey: 'kawara' });
    awning(L, 0, s.fz, s.sw * 0.8, 1.4, 3.0, awningTex('#7a2a24', '#7a2a24', 1));
    L.sign('中村酒店', 0, 4.15, s.fz + 0.16, s.sw * 0.8, 0.95, { bg: '#1e1c1a', fg: '#f0e6c8', border: '#8a6a3a', borderW: 8, glow: 0.5, sub: '酒・たばこ・塩' });
    L.sign('塩', s.hw - 0.4, 2.2, s.fz + 0.3, 0.5, 0.5, { bg: '#1a4a9a', fg: '#ffffff', tw: 128, th: 128 }, 0);
    for (let i = 0; i < 3; i++) L.vending(s.hw - 0.65 - i * 1.08, s.fz + 0.55, 0, i % 3, [0xe8e8e4, 0x2a7a3a, 0xc8302a][i]);
    const P = L.get('plain', -s.hw + 1.0, 0, s.fz + 0.6);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) P.box(j * 0.5, i * 0.3, 0, 0.45, 0.28, 0.35, C(i % 2 ? 0xf0c020 : 0xc8302a));
    L.box(-s.hw + 1.25, s.fz + 0.6, 0.55, 0.25);
    // sugidama: cedar ball hanging from the eave
    const Fo = L.get('foliage', -s.hw + 2.2, 0, s.fz + 0.9);
    Fo.blob(0, 2.55, 0, 0.32, 0.32, 0.32, C(0x6a6a32), new RNG(3), 0.08, 1, 0.9);
    L.get('plain', -s.hw + 2.2, 0, s.fz + 0.9).box(0, 2.85, 0, 0.02, 0.25, 0.02, C(0x3a3a3a));
  },
  post(L, rng) {
    const s = shopHouse(L, rng, { wallC: C(0xeeeeea), roofC: C(0x8a8e92), storeys: 1, wallKey: 'plaster' });
    const P = L.get('plain', 0, 0, s.hz);
    P.box(0, 2.62, s.hd + 0.06, s.sw + 0.02, 0.32, 0.06, C(0xe2541c));
    L.sign('〒 なつめ郵便局', 0, 3.3, s.fz + 0.16, s.sw * 0.75, 0.6, { bg: '#ffffff', fg: '#d8341c', font: JP_SANS, weight: 800, glow: 0.5 });
    const B = L.get('plain', s.hw + 0.2, 0, s.fz + 1.3);
    B.box(0, 0, 0, 0.5, 0.25, 0.5, C(0x6a6a6a));
    B.cyl(0, 0.25, 0, 0.26, 0.26, 1.05, 12, C(0xd02a1e), { cap: true });
    B.blob(0, 1.3, 0, 0.27, 0.12, 0.27, C(0xd02a1e), null, 0, 1, 1);
    B.box(0, 0.95, 0.24, 0.24, 0.05, 0.06, C(0x1a1a1a));
    L.circle(s.hw + 0.2, s.fz + 1.3, 0.3);
    L.W.landmarkIcons.push({ x: L.wx(0, 0), z: L.wz(0, 0), icon: '〒' });
  },
  barber(L, rng) {
    const s = shopHouse(L, rng, { wallC: C(0xf0ece6), roofC: C(0x2e5a7a), storeys: 1 });
    L.sign('理容 やまだ', 0, 3.3, s.fz + 0.16, s.sw * 0.8, 0.62, { bg: '#ffffff', fg: '#1a3a7a', font: JP_SANS, weight: 800, glow: 0.5 });
    const [c, x] = canvas(64, 256);
    for (let i = -4; i < 12; i++) {
      x.fillStyle = ['#d8282a', '#ffffff', '#2a4ad0', '#ffffff'][((i % 4) + 4) % 4];
      x.beginPath(); x.moveTo(0, i * 32); x.lineTo(64, i * 32 - 40); x.lineTo(64, i * 32 - 8); x.lineTo(0, i * 32 + 32); x.fill();
    }
    const t = tex(c); t.repeat.set(1, 1);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.9, 16, 1, true), patch(new THREE.MeshLambertMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.25 }), { key: 'pole' }));
    L.mesh(pole, s.hw - 0.4, 1.9, s.fz + 0.3, 0);
    const cap = L.get('plain', s.hw - 0.4, 0, s.fz + 0.3);
    cap.cyl(0, 1.42, 0, 0.13, 0.13, 0.03, 12, C(0xd0d0d0), { cap: true }); cap.blob(0, 2.38, 0, 0.13, 0.08, 0.13, C(0xe0e0e0), null, 0, 1, 1);
    cap.box(0, 1.4, -0.2, 0.06, 1.0, 0.25, C(0xc0c0c0));
    L.W.barberPoles.push(t);
    MD.bench(L.at(-s.hw + 1.2, 0, s.fz + 0.6, 0), 0x7a7e86, 1.4);
  },
  diner(L, rng) {
    const s = shopHouse(L, rng, { wallC: C(0x6a4a34), wallKey: 'wood', roofC: C(0x4a4e56), roofKey: 'kawara' });
    L.sign('ふじ食堂', 0, 4.15, s.fz + 0.16, s.sw * 0.75, 0.9, { bg: '#2a1e16', fg: '#f4e8c8', border: '#c8a060', borderW: 6, glow: 0.6, sub: 'ラーメン・定食・かき氷' });
    // noren curtain
    const [c, x] = canvas(256, 128);
    x.fillStyle = '#1e2e5a'; x.fillRect(0, 0, 256, 128);
    x.fillStyle = '#f4f0e6'; x.font = `900 66px ${JP_SERIF}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('め', 64, 70); x.fillText('し', 192, 70);
    x.fillStyle = '#0e1630'; x.fillRect(126, 20, 4, 108);
    const nt = tex(c, { clamp: true });
    const nm = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), patch(new THREE.MeshLambertMaterial({ map: nt, side: THREE.DoubleSide }), { key: 'sign' }));
    L.mesh(nm, -s.sw * 0.18, 1.95, s.fz + 0.12, 0);
    L.W.flags.push(nm);
    // red lantern
    const lt = drawSign('ラーメン', { w: 128, h: 256, vertical: true, bg: '#d8281e', fg: '#1a1a1a', tw: 128, th: 256 });
    const lm = patch(new THREE.MeshLambertMaterial({ map: lt, emissiveMap: lt, emissive: 0xffffff, emissiveIntensity: 0 }), { key: 'sign' });
    const lan = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.7, 14, 1, true), lm);
    L.mesh(lan, s.sw * 0.28, 2.2, s.fz + 0.45, 0);
    L.W.glowSigns.push({ mat: lm, k: 2.4 });
    L.W.lampSources.push({ x: L.wx(s.sw * 0.28, s.fz + 0.45), z: L.wz(s.sw * 0.28, s.fz + 0.45), y: L.lot.h + 2.2, color: 0xff5030, power: 0.6 });
    const sb = L.get('plain', s.hw - 0.6, 0, s.fz + 0.8);
    sb.box(0, 0, 0, 0.6, 0.06, 0.4, C(0x3a3a3a)); sb.box(0, 0.06, 0, 0.5, 1.1, 0.06, C(0x1a1a1a));
    L.box(s.hw - 0.6, s.fz + 0.8, 0.3, 0.2);
    L.W.interact.push({ x: L.wx(-s.sw * 0.18, s.fz + 0.7), z: L.wz(-s.sw * 0.18, s.fz + 0.7), y: L.lot.h, r: 2.0, kind: 'shop', shop: 'diner', label: 'Зайти в столовую «Фудзи»' });
  },
  hardware(L, rng) {
    const s = shopHouse(L, rng, { wallC: C(0xc4beb0), roofC: C(0x7a5a48) });
    awning(L, 0, s.fz, s.sw * 0.9, 1.5, 3.0, awningTex('#9aa4ac', '#9aa4ac', 1));
    L.sign('田中金物店', 0, 4.15, s.fz + 0.16, s.sw * 0.8, 0.9, { bg: '#f2f0ea', fg: '#1a1a1a', border: '#3a3a3a', borderW: 6, glow: 0.4, sub: '農具・金物・日用品' });
    const P = L.get('plain', 0, 0, s.fz + 0.8);
    for (let i = 0; i < 5; i++) { P.cyl(-s.hw + 0.6 + i * 0.25, 0, 0, 0.02, 0.02, 1.3, 4, C(0xb08a5a)); P.cone(-s.hw + 0.6 + i * 0.25, 0, 0.05, 0.1, 0.35, 6, C(0xd0b070)); }
    for (let i = 0; i < 4; i++) P.cyl(s.hw - 0.8 - (i % 2) * 0.4, (i >> 1) * 0.32, (i % 2) * 0.1, 0.17, 0.14, 0.3, 10, C([0x3a6ab0, 0xe0a020, 0x2a8a4a, 0xc83a2a][i]));
    L.box(0, s.fz + 0.8, s.hw - 0.2, 0.3);
  },
};
