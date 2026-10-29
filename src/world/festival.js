import * as THREE from 'three';
import { C } from '../core/builder.js';
import { LotCtx } from './buildings.js';
import { canvas, tex, JP_SERIF } from '../env/textures.js';
import { patch, U } from '../env/materials.js';
import { CF } from './collision.js';
import { person, pose } from './npc.js';

// The summer festival (natsu matsuri) at the shrine: strings of paper lanterns up the stairs and along the approach,
// food stalls on the terrace, visitors in yukata, and taiko with a bamboo flute drifting over the village at night.

const START = 18.3, END = 23.6, MUSIC_END = 22.6, BON_START = 18.95, BON_END = 21.05;

export function lanternTex(red) {
  const [c, x] = canvas(128, 128);
  x.fillStyle = red ? '#d8322a' : '#f4ecd8'; x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#1a1a1a'; x.fillRect(0, 0, 128, 10); x.fillRect(0, 118, 128, 10);
  x.strokeStyle = red ? 'rgba(0,0,0,0.22)' : 'rgba(120,80,40,0.22)'; x.lineWidth = 2;
  for (let y = 18; y < 118; y += 9) { x.beginPath(); x.moveTo(0, y); x.lineTo(128, y); x.stroke(); }
  x.fillStyle = red ? '#1a1a1a' : '#c8281e'; x.font = `900 54px ${JP_SERIF}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('祭', 32, 66); x.fillText('祭', 96, 66);
  return tex(c, { clamp: false });
}
function textTex(text, col, w = 256, h = 64, bg = '#fffaf0', size = 44) {
  const [c, x] = canvas(w, h);
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  x.fillStyle = col; x.fillRect(0, h - 6, w, 6);
  x.fillStyle = col; x.font = `900 ${size}px ${JP_SERIF}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, w / 2, h / 2);
  return tex(c, { clamp: true });
}
function koriTex() {
  // the classic shaved-ice flag: red 氷 over blue waves
  const [c, x] = canvas(128, 160);
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 128, 160);
  x.fillStyle = '#d8202a'; x.font = `900 92px ${JP_SERIF}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('氷', 64, 66);
  x.fillStyle = '#1a5ab8';
  for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(22 + i * 42, 160, 26, Math.PI, 0); x.fill(); }
  x.fillStyle = '#ffffff';
  for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(22 + i * 42, 160, 14, Math.PI, 0); x.fill(); }
  return tex(c, { clamp: true });
}

// Paper lanterns strung between posts: collects the wire segments and lantern positions, then builds them as one
// line mesh and two instanced meshes (red and white lanterns alternate).
export class LanternStrings {
  constructor() { this.lanterns = [[], []]; this.wires = []; }
  add(pts, every, h, sag) {
    const { lanterns, wires } = this;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const ya = a[1] + h, yb = b[1] + h;
      const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / every));
      const y = (t) => ya + (yb - ya) * t - sag * 4 * t * (1 - t);
      for (let k = 0; k < 10; k++) {
        const t0 = k / 10, t1 = (k + 1) / 10;
        wires.push(a[0] + (b[0] - a[0]) * t0, y(t0), a[2] + (b[2] - a[2]) * t0, a[0] + (b[0] - a[0]) * t1, y(t1), a[2] + (b[2] - a[2]) * t1);
      }
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        lanterns[(k + i) % 2].push([a[0] + (b[0] - a[0]) * t, y(t) - 0.4, a[2] + (b[2] - a[2]) * t]);
        wires.push(a[0] + (b[0] - a[0]) * t, y(t), a[2] + (b[2] - a[2]) * t, a[0] + (b[0] - a[0]) * t, y(t) - 0.04, a[2] + (b[2] - a[2]) * t);
      }
    }
  }
  // returns the two lantern materials (red, white) so their glow can be driven by the caller
  build(W) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.wires, 3));
    g.computeBoundingSphere();
    W.extras.push(new THREE.LineSegments(g, patch(new THREE.LineBasicMaterial({ color: 0x2a2420 }), { key: 'wire' })));
    // bulging paper cylinders with black caps
    const prof = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; prof.push(new THREE.Vector2(0.1 + Math.sin(t * Math.PI) * 0.085, t * 0.38)); }
    const lg = new THREE.LatheGeometry(prof, 12);
    const mats = [true, false].map((red) => {
      const t = lanternTex(red);
      return patch(new THREE.MeshLambertMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0, side: THREE.DoubleSide }), { key: 'lantern' });
    });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
    this.lanterns.forEach((list, k) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(lg, mats[k], list.length);
      list.forEach(([x, y, z], i) => im.setMatrixAt(i, m4.compose(p3.set(x, y, z), q.setFromAxisAngle(up, i * 0.7 + k), one)));
      im.computeBoundingSphere();
      im.castShadow = false;
      W.extras.push(im);
    });
    return mats;
  }
  get all() { return [...this.lanterns[0], ...this.lanterns[1]]; }
}

const YUKATA = [[0x24305a, 0xe8b0c0], [0xf0ecf4, 0x3a3a8a], [0x6a2440, 0xf0d070], [0x2a5a50, 0xf4e8c8], [0xe8a8c0, 0x8a2a4a], [0x1a1a2a, 0xd84a3a], [0xf4f0e0, 0x2a6a9a], [0x3a3a6a, 0xf0c0d0]];
// a festival-goer in yukata with an obi (kids get a big bow at the back); every third one carries a fan
export function yukataPerson(i, kid) {
  const [robe, obi] = YUKATA[i % YUKATA.length];
  const pp = person({ skin: 0xe8c4a0, shirt: robe, pants: robe, legs: robe, hair: i % 4 === 3 ? 0x2a1a10 : 0x141414, bun: !kid && i % 2 === 0, sleeve: true, scale: kid ? 0.68 : 0.96, shoes: 0x9a7a52 });
  const u = pp.userData;
  const ob = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.25), new THREE.MeshLambertMaterial({ color: obi }));
  ob.position.y = 0.08; u.spine.add(ob);
  if (kid) { const bow = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.08), ob.material); bow.position.set(0, 0.1, -0.15); u.spine.add(bow); }
  if (i % 3 === 0) {
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.01, 12), new THREE.MeshLambertMaterial({ color: [0xf4f0e8, 0x7ab0e0, 0xf0a0b0][(i / 3) % 3] }));
    fan.rotation.z = Math.PI / 2; fan.position.set(0, -0.36, 0.03); u.elR.add(fan);
    u.fan = true;
  }
  pp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return pp;
}

export class Festival {
  constructor(W) {
    this.W = W;
    const S = (this.S = W.plan.areas.shrine);
    this.on = 0; this.music = 0;
    this.cols = [];
    this.signMats = [];
    this.bulbs = [];
    this.anim = [];
    const strings = new LanternStrings();
    const string = (pts, every, h, sag) => strings.add(pts, every, h, sag);
    const posts = [];
    const post = (x, z, h, y = W.hm.sample(x, z)) => {
      posts.push([x, y, z, h]);
      W.col.addCircle(x, z, 0.07);
      return [x, y, z];
    };
    // up both sides of the stone stairs
    const B = new LotCtx({ x: S.bottom[0], z: S.bottom[1], h: S.bottomH, ang: S.ang }, W);
    for (const sx of [-2.3, 2.3]) {
      const pts = [];
      for (let z = -1; z <= S.run + 0.01; z += (S.run + 1) / 4) pts.push(post(B.wx(sx, z), B.wz(sx, z), 2.7));
      string(pts, 1.5, 2.55, 0.25);
    }
    // the approach road below the torii, stopping short of the level crossing
    const nr = W.plan.byName.north;
    for (const side of [-1, 1]) {
      const pts = [];
      for (let s = nr.poly.length - 4; s > nr.poly.length - 44; s -= 9) {
        const p = nr.poly.at(s), off = side * (nr.w / 2 + 0.6);
        pts.push(post(p.x - p.tz * off, p.z + p.tx * off, 3.1));
      }
      string(pts, 2.0, 2.95, 0.35);
    }
    // the terrace: along both sides of the approach, and twice across it
    const T = (this.T = new LotCtx({ x: S.top[0], z: S.top[1], h: S.topH, ang: S.ang }, W));
    const tp = {};
    for (const sx of [-6, 6]) {
      const pts = [];
      for (const z of [1.5, 8.5, 15.5, 22.5]) { const p = post(T.wx(sx, z), T.wz(sx, z), 3.4, S.topH); pts.push(p); tp[sx + ':' + z] = p; }
      string(pts, 1.4, 3.25, 0.4);
    }
    for (const z of [8.5, 15.5]) string([tp['-6:' + z], tp['6:' + z]], 1.35, 3.25, 0.7);
    // bamboo posts
    const P = W.chunks.get('plain', S.center[0], S.center[1]);
    for (const [x, y, z, h] of posts) {
      P.place(x, y, z, 0);
      P.cyl(0, 0, 0, 0.05, 0.04, h, 6, C(0x8a9a48));
      for (let k = 0.6; k < h; k += 0.55) P.cyl(0, k, 0, 0.056, 0.056, 0.03, 6, C(0x7a8a3e));
    }
    this.lanternMats = strings.build(W);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    // a warm light every few lanterns (only the nearest few are real lights at any moment)
    strings.all.forEach(([x, y, z], i) => {
      if (i % 4 === 0) W.lampSources.push({ x, y: y + 0.1, z, color: 0xff8a4a, power: 1, i: 2.6, dist: 7, festival: true });
    });
    // stalls (yatai) on both sides of the terrace, facing the approach
    this.stalls = [];
    for (const [lx, lz, rot, name, col, kind] of [
      [-11.2, 5, Math.PI / 2, 'たこ焼き', '#d8402a', 'tako'],
      [-11.2, 17, Math.PI / 2, 'わたあめ', '#e0609a', 'wata'],
      [11.6, 5.5, -Math.PI / 2, 'かき氷', '#2a6ad0', 'kori'],
      [11.6, 21.5, -Math.PI / 2, '金魚すくい', '#e89020', 'kingyo'],
    ]) this.stalls.push(this.stall(T, lx, lz, rot, name, col, kind));
    // bare bulbs under the awnings
    const bm = (this.bulbMat = new THREE.MeshBasicMaterial({ color: 0x555555 }));
    const bi = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), bm, this.bulbs.length);
    this.bulbs.forEach((b, i) => bi.setMatrixAt(i, m4.compose(p3.copy(b), q.identity(), one)));
    bi.computeBoundingSphere();
    W.extras.push(bi);
    // visitors in yukata
    this.people = [];
    this.walkers = [];
    const dress = (i, kid) => {
      const pp = yukataPerson(i, kid);
      pp.visible = false;
      W.scene.add(pp);
      this.people.push(pp);
      return pp;
    };
    const spots = [[-9.3, 5.6, -Math.PI / 2, 0], [-9.1, 4.4, -Math.PI / 2, 1], [-9.3, 17.4, -Math.PI / 2, 1], [9.6, 5.2, Math.PI / 2, 0], [9.8, 21.5, Math.PI / 2, 2],
      [-1.8, 9.5, 0.5, 0], [2.4, 13.8, -2.6, 0], [-2.2, 19.6, 2.2, 1], [1.6, 4.4, 3.0, 0], [-8, 11, 1.2, 0], [7.8, 12.5, -1.4, 1]];
    spots.forEach(([lx, lz, r, kind], i) => {
      const kid = kind > 0;
      const pp = dress(i, kid);
      pp.position.set(T.wx(lx, lz), S.topH, T.wz(lx, lz));
      pp.rotation.y = S.ang + r;
      pp.userData.idle = kind === 2 ? 'bend' : 'stand';
      pp.userData.ph = i * 1.7;
      this.cols.push(W.col.addCircle(pp.position.x, pp.position.z, 0.28));
    });
    // a few strolling up and down the approach
    for (const [lx, lz, dir, kid] of [[-3.5, 4, 1, false], [-3.2, 3.1, 1, true], [3.4, 19, -1, false], [3.9, 19.4, -1, false], [-3.6, 15, -1, true]]) {
      const pp = dress(this.people.length + 3, kid);
      this.walkers.push({ g: pp, lx, lz, dir, sp: kid ? 1.15 : 0.95, t: Math.random() * 6, turn: 0 });
    }
    // the vendors behind their counters
    for (const s of this.stalls) {
      const v = person({ skin: 0xd8b090, shirt: 0xf2f0ea, pants: 0x2a2a3a, hair: 0x1a1a1a, towel: true, apron: s.col, scale: 1 });
      v.position.set(s.L.wx(0, -0.35), S.topH, s.L.wz(0, -0.35)); v.rotation.y = s.L.lot.ang;
      v.userData.idle = 'vend'; v.userData.ph = Math.random() * 6;
      v.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      v.visible = false;
      W.scene.add(v);
      this.people.push(v);
    }
    for (const c of this.cols) c.flags = 0;
    this.center = { x: T.wx(0, 12), y: S.topH + 1.5, z: T.wz(0, 12) };
    this.tako = this.stalls[0].L;
    this.sizzlePos = { x: this.tako.wx(0, 0.75), y: S.topH + 1.1, z: this.tako.wz(0, 0.75) };
    W.landmarkIcons.push({ x: T.wx(0, 12), z: T.wz(0, 12), icon: '祭' });
  }
  stall(T, lx, lz, rot, name, col, kind) {
    const W = this.W, S = this.S;
    const L = new LotCtx({ x: T.wx(lx, lz), z: T.wz(lx, lz), h: S.topH, ang: S.ang + rot }, W);
    const P = L.get('plain');
    const wood = C(0x7a5a3c), c = new THREE.Color(col);
    const stallCol = C(c.getHex());
    // frame: front posts lower than the back so the tarp slopes forward
    for (const sx of [-1.4, 1.4]) { P.box(sx, 0, 1.0, 0.08, 2.17, 0.08, wood); P.box(sx, 0, -1.0, 0.08, 2.53, 0.08, wood); }
    // counter
    P.box(0, 0.88, 0.75, 2.9, 0.07, 0.52, C(0x9a7a58));
    P.box(0, 0, 0.98, 2.84, 0.88, 0.04, C(0xf0ece2));
    P.box(0, 0.62, 1.005, 2.84, 0.16, 0.02, stallCol);
    // back tarp and side cloths
    P.box(0, 0, -1.02, 2.84, 2.45, 0.03, C(0xd8d4c8));
    for (const sx of [-1.43, 1.43]) P.box(sx, 1.2, 0, 0.02, 1.15, 1.9, stallCol);
    // striped awning
    const [cv, x] = canvas(128, 32);
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#ffffff' : col; x.fillRect(i * 16, 0, 16, 32); }
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(3.25, 2.5), patch(new THREE.MeshLambertMaterial({ map: tex(cv, { clamp: true }), side: THREE.DoubleSide }), { key: 'awn' }));
    roof.rotation.x = -Math.PI / 2 + 0.18;
    L.mesh(roof, 0, 2.35, 0);
    roof.castShadow = true;
    // name board hanging under the front of the awning
    const st = textTex(name, col);
    const sm = patch(new THREE.MeshLambertMaterial({ map: st, emissiveMap: st, emissive: 0xffffff, emissiveIntensity: 0 }), { key: 'sign' });
    L.mesh(new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.56), sm), 0, 1.84, 1.06).castShadow = false;
    this.signMats.push(sm);
    // what's on the counter
    const top = 0.95;
    if (kind === 'tako') {
      P.box(-0.2, top, 0.7, 1.1, 0.08, 0.42, C(0x2a2a2a));
      for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) P.blob(-0.66 + i * 0.18, top + 0.08, 0.57 + j * 0.13, 0.055, 0.04, 0.055, C(0xc8883a), null, 0, 0, 0.9);
      for (let k = 0; k < 4; k++) P.box(0.8, top + k * 0.03, 0.7, 0.24, 0.025, 0.14, C(0xe8dcc0));
      P.cyl(1.15, top, 0.7, 0.05, 0.05, 0.2, 8, C(0x7a3a1a));
    } else if (kind === 'wata') {
      P.cyl(0, top, 0.7, 0.3, 0.32, 0.25, 14, C(0xd8d8dc));
      P.blob(0, top + 0.28, 0.7, 0.2, 0.1, 0.2, C(0xffe4f0), null, 0, 1, 1);
      const bags = [0xf088b0, 0x88c8f0, 0xf0e070, 0xa0e0a0, 0xf0a060, 0xc0a0f0];
      for (let i = 0; i < 6; i++) { P.box(-1.15 + i * 0.46, 1.32, 1.12, 0.004, 0.42, 0.004, C(0x666666)); P.box(-1.15 + i * 0.46, 1.32, 1.12, 0.26, 0.38, 0.14, C(bags[i])); }
    } else if (kind === 'kori') {
      P.box(-0.5, top, 0.7, 0.32, 0.5, 0.3, C(0x2a5aa8));
      P.cyl(-0.5, top + 0.5, 0.7, 0.13, 0.13, 0.1, 12, C(0xd8d8d8));
      const syr = [0xd8202a, 0x40b040, 0x2a8ae8, 0xf0d020];
      for (let i = 0; i < 4; i++) P.cyl(0.3 + i * 0.22, top, 0.68, 0.045, 0.045, 0.28, 8, C(syr[i]));
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.78), patch(new THREE.MeshLambertMaterial({ map: koriTex(), side: THREE.DoubleSide }), { key: 'sign' }));
      L.mesh(f, 1.05, 1.15, 1.11);
      W.flags.push(f);
    } else if (kind === 'kingyo') {
      // shallow blue tub in front of the stall, full of goldfish
      P.box(0, 0, 1.75, 1.7, 0.36, 0.9, C(0x2a7ad0));
      const water = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshLambertMaterial({ color: 0x5aa8d8, transparent: true, opacity: 0.55, depthWrite: false }));
      water.rotation.x = -Math.PI / 2;
      L.mesh(water, 0, 0.33, 1.75);
      water.castShadow = false;
      const fish = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.02, 0.07), new THREE.MeshLambertMaterial({ color: 0xffffff }), 14);
      const fc = [0xff5a1a, 0xff7a2a, 0xe83a1a, 0xf8f0e8, 0x1a1a1a];
      for (let i = 0; i < 14; i++) fish.setColorAt(i, new THREE.Color(fc[i % 5 === 4 ? 4 : i % 4]));
      fish.frustumCulled = false;
      W.extras.push(fish);
      this.fish = { mesh: fish, L, n: 14, a: Array.from({ length: 14 }, (_, i) => ({ r: 0.12 + (i % 5) * 0.06, ph: i * 1.3, sp: 0.5 + (i % 3) * 0.25 })) };
      for (let k = 0; k < 8; k++) P.box(1.2, top + k * 0.012, 0.7, 0.14, 0.008, 0.2, C(0xf4f0e8));
      L.box(0, 1.75, 0.88, 0.48);
    }
    // light: two bare bulbs and a pool on the ground in front
    for (const sx of [-0.75, 0.75]) this.bulbs.push(new THREE.Vector3(L.wx(sx, 0.5), S.topH + 2.08, L.wz(sx, 0.5)));
    W.lampSources.push({ x: L.wx(0, 0.7), z: L.wz(0, 0.7), y: S.topH + 1.95, color: 0xffc070, power: 1, i: 5, dist: 9, festival: true });
    W.pools.push({ x: L.wx(0, 1.5), z: L.wz(0, 1.5), y: S.topH, r: 3.2, color: 0xffb060, k: -0.8 });
    L.box(0, -0.05, 1.5, 1.15);
    const iz = kind === 'kingyo' ? 2.55 : 1.75;
    W.interact.push({ x: L.wx(0, iz), z: L.wz(0, iz), y: S.topH, r: 1.5, kind: 'stall', stall: kind, label: `Подойти к лотку «${name}»`, when: () => this.on > 0.5 });
    return { L, kind, name, col: c.getHex() };
  }
  // true while the stalls are open
  get open() { return this.on > 0.5; }
  near(p, r = 34) { return Math.hypot(p.x - this.center.x, p.z - this.center.z) < r && Math.abs(p.y - this.S.topH) < 8; }
  update(dt, tSec, time, player) {
    const h = time.hour;
    const target = h >= START && h < END ? 1 : 0;
    this.on += (target - this.on) * Math.min(1, dt * 0.8);
    if (this.on < 0.002) this.on = 0;
    // the drummers play a first set before the bon dance starts at the school, and a second one after it ends
    const musicT = (h >= START + 0.15 && h < BON_START) || (h >= BON_END && h < MUSIC_END) ? 1 : 0;
    this.music += (musicT * this.on - this.music) * Math.min(1, dt * 0.5);
    const night = time.night;
    const glow = this.on * (0.35 + 0.9 * night);
    U.uFest.value = glow;
    for (const m of this.lanternMats) m.emissiveIntensity = glow * 1.25;
    for (const m of this.signMats) m.emissiveIntensity = glow * 0.55;
    this.bulbMat.color.setRGB(1, 0.82, 0.5).multiplyScalar(0.25 + glow * 3.2);
    const vis = this.on > 0.5;
    if (vis !== this.vis) {
      this.vis = vis;
      for (const p of this.people) p.visible = vis;
      for (const c of this.cols) c.flags = vis ? CF.ALL : 0;
    }
    const cam = player.pos;
    const close = Math.abs(cam.x - this.center.x) < 120 && Math.abs(cam.z - this.center.z) < 120;
    if (!vis || !close) return;
    // idle motions
    for (const p of this.people) {
      const u = p.userData;
      if (!u.idle) continue;
      const t = tSec + u.ph;
      if (u.idle === 'bend') pose(p, 'bend', t * 0.6);
      else {
        pose(p, 'stand');
        u.spine.rotation.z = Math.sin(t * 0.7) * 0.03;
        u.neck.rotation.y = Math.sin(t * 0.31) * 0.4;
        if (u.idle === 'vend') { u.spine.rotation.x = 0.25 + Math.sin(t * 1.3) * 0.05; u.shR.rotation.x = -0.7 + Math.sin(t * 3.1) * 0.25; u.shL.rotation.x = -0.6; u.elR.rotation.x = -0.6; u.elL.rotation.x = -0.7; }
        if (u.fan) { u.shR.rotation.x = -0.9; u.elR.rotation.x = -1.2 + Math.sin(t * 6) * 0.35; u.elR.rotation.z = Math.sin(t * 6) * 0.2; }
      }
    }
    const T = this.T;
    for (const w of this.walkers) {
      const g = w.g;
      if (w.turn > 0) {
        w.turn -= dt;
        g.rotation.y += (Math.PI / 1.2) * dt * -w.dir;
        if (w.turn <= 0) g.rotation.y = this.S.ang + (w.dir > 0 ? 0 : Math.PI);
        pose(g, 'walk', w.t * 3);
        w.t += dt;
        continue;
      }
      const nz = w.lz + w.dir * w.sp * dt;
      const wx = T.wx(w.lx, nz), wz = T.wz(w.lx, nz);
      const blocked = Math.hypot(wx - cam.x, wz - cam.z) < 1.1;
      if (!blocked) { w.lz = nz; w.t += dt; }
      g.position.set(T.wx(w.lx, w.lz), this.S.topH, T.wz(w.lx, w.lz));
      g.rotation.y = this.S.ang + (w.dir > 0 ? 0 : Math.PI);
      pose(g, blocked ? 'stand' : 'walk', w.t * (w.sp * 4.4));
      if ((w.dir > 0 && w.lz > 20.5) || (w.dir < 0 && w.lz < 3.2)) { w.dir = -w.dir; w.turn = 1.2; }
    }
    // goldfish circling in their tub
    if (this.fish) {
      const F = this.fish, L = F.L, m4 = this._m || (this._m = new THREE.Matrix4()), q = this._q || (this._q = new THREE.Quaternion()), v = this._v || (this._v = new THREE.Vector3()), one = this._one || (this._one = new THREE.Vector3(1, 1, 1)), up = this._up || (this._up = new THREE.Vector3(0, 1, 0));
      for (let i = 0; i < F.n; i++) {
        const a = F.a[i], ang = a.ph + tSec * a.sp * (i % 2 ? 1 : -1);
        const lx = Math.cos(ang) * a.r * 2.2, lz = 1.75 + Math.sin(ang) * a.r;
        v.set(L.wx(lx, lz), this.S.topH + 0.25, L.wz(lx, lz));
        q.setFromAxisAngle(up, L.lot.ang + ang + (i % 2 ? 0 : Math.PI) + Math.sin(tSec * 7 + i) * 0.25);
        F.mesh.setMatrixAt(i, m4.compose(v, q, one));
      }
      F.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
