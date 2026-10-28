import * as THREE from 'three';
import { C, MeshBuilder } from '../core/builder.js';
import { LotCtx } from './buildings.js';
import { patch } from '../env/materials.js';
import { CF } from './collision.js';

// Grandma's farmhouse — the player's summer home: a place on the engawa, watermelon, a mosquito coil smoking in
// its ceramic pig, a wind chime, and a futon to sleep until morning.

export class Home {
  constructor(W) {
    this.W = W;
    // a farmhouse a short ride west of the shops, near the river
    const cands = W.plan.lots.filter((l) => l.house && !l.shop);
    cands.sort((a, b) => Math.hypot(a.x + 250, a.z - 60) - Math.hypot(b.x + 250, b.z - 60));
    const lot = (this.lot = cands[0]);
    const H = lot.house;
    const L = (this.L = new LotCtx(lot, W));
    const ex = H.hx + H.ex, ez = H.hz + H.fd / 2 + 0.45; // engawa centre (lot-local)
    const top = 0.55;
    // things on the engawa
    const P = L.get('plain', ex, top, ez);
    // watermelon slices on a plate
    P.cyl(-1.2, 0, 0.05, 0.22, 0.2, 0.03, 14, C(0xf2f2ee), { cap: true });
    const melon = new MeshBuilder();
    for (let i = 0; i < 3; i++) {
      melon.push(); melon.translate(-1.28 + i * 0.09, 0.03, 0.05); melon.rotateY(0.3 - i * 0.3);
      const r = 0.12, n = 8;
      for (let k = 0; k < n; k++) {
        const a0 = Math.PI * (k / n), a1 = Math.PI * ((k + 1) / n);
        melon.tri([0, 0, 0], [Math.cos(a0) * r, Math.sin(a0) * r, 0], [Math.cos(a1) * r, Math.sin(a1) * r, 0], C(0xe83a3a));
        melon.tri([0, 0, -0.03], [Math.cos(a1) * r, Math.sin(a1) * r, -0.03], [Math.cos(a0) * r, Math.sin(a0) * r, -0.03], C(0xe83a3a));
        melon.quad([Math.cos(a0) * r, Math.sin(a0) * r, 0], [Math.cos(a0) * r, Math.sin(a0) * r, -0.03], [Math.cos(a1) * r, Math.sin(a1) * r, -0.03], [Math.cos(a1) * r, Math.sin(a1) * r, 0], C(0x2e6a2a));
      }
      for (let k = 0; k < 4; k++) melon.box(Math.cos(0.5 + k * 0.6) * 0.06, Math.sin(0.5 + k * 0.6) * 0.06, 0.002, 0.012, 0.016, 0.004, C(0x1a1a1a));
      melon.pop();
    }
    const mm = new THREE.Mesh(melon.build(), patch(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), { key: 'melon' }));
    L.mesh(mm, ex, top, ez);
    // katori-buta: the ceramic pig holding a mosquito coil
    P.blob(1.1, 0.13, 0.1, 0.11, 0.1, 0.14, C(0xb8c4c8), null, 0, 1, 0.85);
    P.cyl(1.1, 0.06, 0.24, 0.07, 0.07, 0.04, 10, C(0x101010), { cap: true });
    P.cone(1.1, 0.2, -0.05, 0.03, 0.05, 6, C(0xb8c4c8));
    // uchiwa fan and a glass of barley tea
    P.cyl(0.5, 0.0, 0.2, 0.035, 0.035, 0.1, 8, C(0xc89a4a), { cap: true });
    P.box(0.75, 0.0, 0.25, 0.18, 0.006, 0.22, C(0x3a6ab0));
    // furin hanging from the eave
    const F = L.get('plain', ex + 0.4, 0, ez + 0.5);
    F.blob(0, 2.42, 0, 0.06, 0.05, 0.06, C(0xa8d8e8), null, 0, 1, 1);
    F.box(0, 2.48, 0, 0.004, 0.12, 0.004, C(0x444444));
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.16), new THREE.MeshLambertMaterial({ color: 0xf0e070, side: THREE.DoubleSide }));
    strip.geometry.translate(0, -0.08, 0);
    this.strip = L.mesh(strip, ex + 0.4, 2.33, ez + 0.5);
    W.furin.push({ x: L.wx(ex + 0.4, ez + 0.5), z: L.wz(ex + 0.4, ez + 0.5), y: lot.h + 2.4, home: true });
    // mosquito coil smoke
    this.smokeBase = new THREE.Vector3(L.wx(ex + 1.1, ez + 0.1), lot.h + top + 0.32, L.wz(ex + 1.1, ez + 0.1));
    const n = 40;
    this.smoke = new Float32Array(n * 3); this.smokeT = new Float32Array(n);
    for (let i = 0; i < n; i++) this.smokeT[i] = i / n;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.smoke, 3).setUsage(THREE.DynamicDrawUsage));
    this.smokePts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xd8d8d8, size: 0.035, transparent: true, opacity: 0.35, depthWrite: false }));
    this.smokePts.frustumCulled = false;
    W.scene.add(this.smokePts);
    // interactions
    const step = H.ew / Math.max(2, Math.floor(H.ew / 1.75));
    const sx = L.wx(ex + step / 2, ez + 0.32), sz = L.wz(ex + step / 2, ez + 0.32);
    W.sitSpots.push({ x: sx, z: sz, y: lot.h + top - 0.08, ang: lot.ang, label: 'Посидеть на энгаве', engawa: true });
    W.interact.push({ x: L.wx(ex - 1.2, ez + 0.6), z: L.wz(ex - 1.2, ez + 0.6), y: lot.h, r: 1.4, kind: 'melon', label: 'Съесть ломтик арбуза' });
    const gx = H.hx + H.gx, gz = H.hz + H.fd / 2 + 0.3;
    W.interact.push({ x: L.wx(gx, gz), z: L.wz(gx, gz), y: lot.h, r: 1.6, kind: 'sleep', label: 'Зайти в дом и лечь спать' });
    W.landmarkIcons.push({ x: lot.x, z: lot.z, icon: '家' });
    W.plan.regions.unshift({ jp: 'おばあちゃんの家', ru: 'Бабушкин дом', x: lot.x, z: lot.z, r: 18, seal: '家' });
    this.homePos = { x: L.wx(gx, gz + 2.5), z: L.wz(gx, gz + 2.5) };
  }
  update(dt, tSec, time, cam) {
    if (Math.abs(cam.x - this.lot.x) > 90 || Math.abs(cam.z - this.lot.z) > 90) { this.smokePts.visible = false; return; }
    this.smokePts.visible = true;
    const b = this.smokeBase, n = this.smokeT.length;
    for (let i = 0; i < n; i++) {
      let t = (this.smokeT[i] += dt * 0.12);
      if (t > 1) t = this.smokeT[i] = t - 1;
      this.smoke[i * 3] = b.x + Math.sin(t * 9 + tSec * 0.7) * 0.05 * t;
      this.smoke[i * 3 + 1] = b.y + t * 0.6;
      this.smoke[i * 3 + 2] = b.z + Math.cos(t * 7 + tSec * 0.5) * 0.05 * t;
    }
    this.smokePts.geometry.attributes.position.needsUpdate = true;
    if (this.strip) this.strip.rotation.x = Math.sin(tSec * 2.1) * 0.25 + Math.sin(tSec * 5.3) * 0.08;
  }
}
