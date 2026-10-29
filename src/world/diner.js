import * as THREE from 'three';
import { C, MeshBuilder } from '../core/builder.js';
import { CF } from './collision.js';
import { person, pose } from './npc.js';
import { G } from './terrain.js';

// Inside ふじ食堂, the village diner: a counter with stools in front of the kitchen, a cook stirring the soup
// pot, two little tables with regulars, wooden menu tags on the walls, a beckoning cat on the counter and the
// baseball on a TV up in the corner. Open from half past ten until half past nine.

const OPEN = 10.5, CLOSE = 21.5;
const MENU = ['ラーメン 五〇〇円', 'カレーライス 六〇〇円', '冷やし中華 六五〇円', 'ぎょうざ 三〇〇円', '親子丼 六〇〇円', 'かき氷 二八〇円', 'ビール 五〇〇円', 'ラムネ 一五〇円'];

export class DinerInterior {
  constructor(L, s, door, doorX) {
    this.L = L; this.W = L.W;
    const W = L.W;
    const X0 = -s.hw + 0.14, X1 = s.hw - 0.14, Zb = s.hz - s.hd + 0.14, Zf = s.hz + s.hd - 0.14, Y = 0.18, CH = 2.52;
    const mz = (Zb + Zf) / 2, depth = Zf - Zb;
    this.box = { X0, X1, Zb, Zf };
    this.floorY = L.lot.h + Y;
    W.plan.markRect(L.wx(0, s.hz), L.wz(0, s.hz), s.hw, s.hd, L.lot.ang, 0, G.CONCRETE);
    const F = (k) => L.get(k, 0, Y, 0);
    const P = F('plain'), Wd = F('wood'), Pl = F('plaster');
    const wood = C(0x8a6440), dark = C(0x4a3424);
    // walls: plaster above a wainscot, dark board ceiling
    Pl.box(X0 + 0.02, 1.0, mz, 0.04, CH - 1.0, depth, C(0xe4d8bc)); Pl.box(X1 - 0.02, 1.0, mz, 0.04, CH - 1.0, depth, C(0xe4d8bc));
    Pl.box(0, 1.0, Zb + 0.02, X1 - X0, CH - 1.0, 0.04, C(0xe4d8bc));
    Wd.box(X0 + 0.025, 0, mz, 0.05, 1.0, depth, dark); Wd.box(X1 - 0.025, 0, mz, 0.05, 1.0, depth, dark); Wd.box(0, 0, Zb + 0.025, X1 - X0, 1.0, 0.05, dark);
    Wd.box(0, CH, mz, X1 - X0, 0.05, depth, C(0xb89a70), { bottom: true });
    for (let z = Zb + 0.8; z < Zf; z += 0.8) Wd.box(0, CH - 0.05, z, X1 - X0, 0.05, 0.06, dark, { bottom: true });
    // counter with stools; the kitchen behind it
    const cz = Zb + 1.45, cx0 = X0, cx1 = 1.4;
    Wd.box((cx0 + cx1) / 2, 0, cz, cx1 - cx0, 0.95, 0.5, wood);
    P.box((cx0 + cx1) / 2, 0.95, cz + 0.02, cx1 - cx0, 0.04, 0.58, C(0xc8a878));
    P.box((cx0 + cx1) / 2, 1.0, cz - 0.2, cx1 - cx0, 0.18, 0.08, wood);
    L.box((cx0 + cx1) / 2, cz, (cx1 - cx0) / 2, 0.3);
    this.stools = [];
    for (let x = cx0 + 0.6; x < cx1 - 0.3; x += 1.1) { P.cyl(x, 0, cz + 0.55, 0.05, 0.05, 0.62, 6, C(0x8a8a8a)); P.cyl(x, 0.62, cz + 0.55, 0.19, 0.19, 0.07, 12, C(0xc83a2a), { cap: true }); this.stools.push(x); }
    // stove with two pots, shelves of bowls, a sink
    P.box(-2.2, 0, Zb + 0.45, 1.6, 0.85, 0.6, C(0x9aa0a4));
    for (const [x, r, h] of [[-2.6, 0.24, 0.42], [-1.8, 0.18, 0.22]]) P.cyl(x, 0.85, Zb + 0.45, r, r, h, 14, C(0xb8bcc0), { cap: true });
    P.box(0.3, 0, Zb + 0.4, 1.0, 0.85, 0.55, C(0xc8ccd0));
    for (const y of [1.35, 1.75]) {
      P.box(-1.0, y, Zb + 0.14, 3.2, 0.03, 0.22, wood, { bottom: true });
      for (let x = -2.4; x < 0.5; x += 0.24) for (let k = 0; k < 3; k++) P.cyl(x, y + 0.03 + k * 0.05, Zb + 0.14, 0.09, 0.07, 0.05, 10, C(k % 2 ? 0xe8e4dc : 0xd8402a));
    }
    this.potPos = { x: L.wx(-2.6, Zb + 0.45), y: L.lot.h + Y + 1.3, z: L.wz(-2.6, Zb + 0.45) };
    // tables by the window
    this.tables = [];
    for (const tz of [Zb + 2.2, Zf - 1.0]) {
      const tx = X1 - 1.15;
      P.box(tx, 0, tz, 0.06, 0.7, 0.06, C(0x6a6a6a));
      P.box(tx, 0.7, tz, 0.85, 0.04, 0.85, C(0xd8c8a0));
      for (const sx of [-1, 1]) { P.box(tx + sx * 0.75, 0, tz, 0.4, 0.45, 0.4, C(0x8a5a3a)); P.box(tx + sx * 0.93, 0.45, tz, 0.05, 0.45, 0.4, C(0x8a5a3a)); }
      P.cyl(tx + 0.2, 0.74, tz - 0.2, 0.06, 0.05, 0.2, 8, C(0xc8e4ec));
      L.box(tx, tz, 1.05, 0.45);
      this.tables.push([tx, tz]);
    }
    // wooden menu tags along the back wall
    MENU.forEach((m, i) => L.sign(m.replace(' ', '　'), X0 + 0.06, Y + 1.85, cz + 0.9 + i * ((Zf - 0.5 - cz - 0.9) / (MENU.length - 1)), 0.28, 0.8, { vertical: true, bg: '#e8dcc0', fg: '#2a1a10', tw: 96, th: 288 }, Math.PI / 2));
    // the beckoning cat
    const cat = (this.cat = new THREE.Group());
    const white = new THREE.MeshLambertMaterial({ color: 0xf8f6f0 }), red = new THREE.MeshLambertMaterial({ color: 0xd8282a }), gold = new THREE.MeshLambertMaterial({ color: 0xe8b830 });
    const bodyM = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), white); bodyM.scale.set(1, 1.15, 0.9); bodyM.position.y = 0.12; cat.add(bodyM);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), white); head.scale.set(1.1, 0.95, 0.95); head.position.y = 0.3; cat.add(head);
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.06, 4), white); e.position.set(sx * 0.06, 0.39, 0); cat.add(e); }
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 16), red); collar.rotation.x = Math.PI / 2; collar.position.y = 0.21; cat.add(collar);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), gold); bell.position.set(0, 0.2, 0.08); cat.add(bell);
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.01, 12), gold); coin.rotation.x = Math.PI / 2; coin.position.set(0.05, 0.1, 0.1); cat.add(coin);
    const paw = (this.paw = new THREE.Group()); paw.position.set(-0.08, 0.22, 0.02); cat.add(paw);
    const pm = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.14, 8), white); pm.position.y = 0.07; paw.add(pm);
    L.mesh(cat, cx0 + 0.35, Y + 0.99, cz + 0.05, 0);
    // TV up in the corner
    P.box(X1 - 0.35, 1.9, Zb + 0.3, 0.6, 0.04, 0.5, wood, { bottom: true });
    P.box(X1 - 0.35, 1.94, Zb + 0.3, 0.5, 0.38, 0.4, C(0x2e2a28));
    this.tvMat = new THREE.MeshBasicMaterial({ map: W.store?.tvMat.map || null, color: 0x000000 });
    L.mesh(new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.28), this.tvMat), X1 - 0.38, Y + 2.13, Zb + 0.505, -0.5).castShadow = false;
    this.tvPos = { x: L.wx(X1 - 0.35, Zb + 0.3), y: L.lot.h + Y + 2.1, z: L.wz(X1 - 0.35, Zb + 0.3) };
    // lights
    this.tubeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const tubes = new MeshBuilder();
    for (const x of [-2, 1.5]) {
      P.box(x, CH - 0.06, mz, 0.2, 0.06, 1.3, C(0xe8e8e4), { bottom: true });
      tubes.box(x, CH - 0.1, mz, 0.05, 0.04, 1.2, C(0xffffff));
      W.lampSources.push({ x: L.wx(x, mz), y: L.lot.h + Y + CH - 0.3, z: L.wz(x, mz), color: 0xfff4e0, power: 1, i: 4.5, dist: 8, kf: () => this.light });
    }
    L.mesh(new THREE.Mesh(tubes.build(), this.tubeMat), 0, Y, 0).castShadow = false;
    // the doorway: a wooden sliding door that closes after hours
    const dg = new THREE.Group();
    const dm = new THREE.MeshLambertMaterial({ color: 0x5a4030 });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(door, 2.25, 0.05), dm); panel.position.y = 1.125; dg.add(panel);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(door - 0.3, 1.0), new THREE.MeshLambertMaterial({ color: 0xd8e4e8, transparent: true, opacity: 0.35 })); pane.position.set(0, 1.4, 0.03); dg.add(pane);
    this.doorG = L.mesh(dg, doorX + door, Y, s.hz + s.hd - 0.25);
    this.doorX = doorX; this.door = door; this.dz = s.hz + s.hd - 0.25;
    this.doorCol = L.box(doorX, s.hz + s.hd - 0.07, door / 2, 0.08);
    this.doorCol.flags = 0;
    // people: the cook and two regulars
    const cook = (this.cook = person({ skin: 0xd8b090, shirt: 0xf4f4f0, pants: 0x3a3a44, hair: 0x1a1a1a, towel: true, apron: 0xf4f4f0, scale: 1 }));
    cook.position.set(L.wx(-2.2, Zb + 0.95), L.lot.h + Y, L.wz(-2.2, Zb + 0.95)); cook.rotation.y = L.lot.ang + Math.PI;
    cook.userData.idle = 'cook';
    const reg = [
      person({ skin: 0xd8a882, shirt: 0x6a7a5a, pants: 0x3a3a40, cap: 0x3a5a3a, sleeve: true, scale: 0.98 }),
      person({ skin: 0xe0b896, shirt: 0xe8e8f0, pants: 0x2a2a3a, hair: 0x1a1a1a, sleeve: false, scale: 1 }),
    ];
    reg.forEach((p, i) => {
      const [tx, tz] = this.tables[i];
      p.position.set(L.wx(tx - 0.72, tz), L.lot.h + Y + 0.0, L.wz(tx - 0.72, tz)); p.rotation.y = L.lot.ang + Math.PI / 2;
      p.userData.idle = i ? 'read' : 'eat';
    });
    this.people = [cook, ...reg];
    for (const p of this.people) { p.visible = false; W.scene.add(p); }
    // ordering at the counter
    const sx = this.stools[Math.floor(this.stools.length / 2)];
    W.interact.push({ x: L.wx(sx, cz + 0.9), z: L.wz(sx, cz + 0.9), y: L.lot.h, r: 1.6, kind: 'shop', shop: 'diner', label: 'Сесть за стойку и заказать', when: () => this.open });
    W.interact.push({ x: L.wx(doorX, s.hz + s.hd + 0.8), z: L.wz(doorX, s.hz + s.hd + 0.8), y: L.lot.h, r: 1.8, kind: 'closedDiner', label: 'Столовая закрыта — откроется в 10:30', when: () => !this.open });
    this.open = true; this.light = 1; this.t = 0;
  }
  inside(p) {
    const L = this.L, dx = p.x - L.lot.x, dz = p.z - L.lot.z;
    const lx = dx * L.c - dz * L.s, lz = dx * L.s + dz * L.c;
    return lx > this.box.X0 - 0.05 && lx < this.box.X1 + 0.05 && lz > this.box.Zb - 0.05 && lz < this.box.Zf + 0.05 && p.y > this.floorY - 0.5 && p.y < this.floorY + 3;
  }
  update(dt, tSec, time, cam) {
    const h = time.hour, L = this.L;
    this.open = h >= OPEN && h < CLOSE;
    this.light += ((this.open ? 1 : 0) - this.light) * Math.min(1, dt * 3);
    this.doorCol.flags = this.open ? 0 : CF.ALL;
    // the door slides across the doorway when closed
    const target = this.open ? this.doorX + this.door : this.doorX;
    this.doorS = (this.doorS ?? target) + (target - (this.doorS ?? target)) * Math.min(1, dt * 2.5);
    this.doorG.position.set(L.wx(this.doorS, this.dz), L.lot.h + 0.18, L.wz(this.doorS, this.dz));
    this.tubeMat.color.setScalar(0.25 + 1.6 * this.light);
    const near = Math.abs(cam.x - L.lot.x) < 70 && Math.abs(cam.z - L.lot.z) < 70;
    for (const p of this.people) p.visible = near && this.open;
    if (!near) return;
    this.t += dt;
    this.tvMat.color.setScalar(this.light * (0.75 + 0.25 * Math.sin(tSec * 13) * Math.sin(tSec * 3.1)));
    this.paw.rotation.x = -0.4 + Math.sin(tSec * 2.2) * 0.35;
    if (!this.open) return;
    for (const p of this.people) {
      const u = p.userData, t = tSec + p.id * 0.37;
      if (u.idle === 'cook') {
        pose(p, 'stand');
        u.spine.rotation.x = 0.15;
        u.shR.rotation.set(-1.1 + Math.sin(t * 2.5) * 0.15, 0, -0.2 + Math.cos(t * 2.5) * 0.2); u.elR.rotation.x = -0.6;
        u.shL.rotation.set(-0.6, 0, 0.1); u.elL.rotation.x = -0.8;
        u.neck.rotation.x = 0.3;
      } else {
        pose(p, 'sit');
        u.pelvis.position.y = 0.47;
        if (u.idle === 'eat') { u.shR.rotation.set(-0.9 + Math.max(0, Math.sin(t * 1.7)) * 0.5, 0, -0.1); u.elR.rotation.x = -1.2 - Math.max(0, Math.sin(t * 1.7)) * 0.5; u.neck.rotation.x = 0.35 - Math.max(0, Math.sin(t * 1.7)) * 0.2; }
        else { u.shL.rotation.set(-0.9, 0, 0.2); u.shR.rotation.set(-0.9, 0, -0.2); u.elL.rotation.x = -0.9; u.elR.rotation.x = -0.9; u.neck.rotation.x = 0.4; }
      }
    }
  }
}
