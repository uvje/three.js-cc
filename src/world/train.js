import * as THREE from 'three';
import { MeshBuilder, C } from '../core/builder.js';
import { patch } from '../env/materials.js';
import { drawSign, JP_SANS } from '../env/textures.js';
import { CF } from './collision.js';

// A two-car local diesel train on a timetable: out of the tunnel, a stop at Natsume station, and the level crossing
// that rings and lowers its barriers as it passes.

const CAR = 20, GAP = 0.6, CRUISE = 15.5, DECEL = 0.95, ACCEL = 0.75;
export const DEST = { east: 'ひがしやま', west: 'みずさわ', eastRu: 'Хигасияма', westRu: 'Мидзусава' };

function carGeometry(front) {
  const b = new MeshBuilder();
  const body = C(0xefe8d6), stripe = C(0x2a8a7a), red = C(0xb83a2e), roof = C(0x9a9c9e), dark = C(0x2a2c2e), under = C(0x3a3c3e);
  const hw = 1.42, L = CAR / 2;
  b.box(0, 1.05, 0, hw * 2, 2.75, CAR, body);
  b.box(0, 1.5, 0, hw * 2 + 0.02, 0.2, CAR + 0.02, stripe);
  b.box(0, 1.32, 0, hw * 2 + 0.02, 0.07, CAR + 0.02, red);
  b.box(0, 3.8, 0, hw * 2 - 0.25, 0.22, CAR - 0.2, roof);
  for (const s of [-1, 1]) { b.push(); b.translate(s * (hw - 0.06), 3.72, 0); b.rotateZ(-s * 0.5); b.box(0, 0, 0, 0.32, 0.12, CAR - 0.1, roof); b.pop(); }
  b.box(0, 3.98, -4, 1.4, 0.35, 2.2, C(0x7a7c7e));
  b.box(0, 3.98, 5, 0.9, 0.5, 1.2, C(0x5a5c5e));
  b.box(0, 0.42, 0, 2.3, 0.63, CAR - 4, under);
  for (const z of [-L + 3.2, L - 3.2]) {
    b.box(0, 0.12, z, 2.2, 0.55, 2.6, dark);
    for (const dz of [-1.05, 1.05]) for (const s of [-1, 1]) { b.push(); b.translate(s * 0.75, 0.43, z + dz); b.rotateZ(Math.PI / 2); b.cyl(0, -0.08, 0, 0.43, 0.43, 0.16, 10, C(0x1e1e1e), { cap: true }); b.pop(); }
  }
  // doors (darker frames) on both sides
  for (const s of [-1, 1]) for (const z of [-L + 2.2, L - 2.2]) b.box(s * (hw + 0.005), 1.08, z, 0.02, 2.05, 1.15, C(0xb8b2a2));
  // cab end
  const fz = front ? L : -L, fs = front ? 1 : -1;
  b.box(0, 1.05, fz + fs * 0.06, hw * 2 - 0.1, 2.7, 0.12, C(0xe6dfcc));
  b.box(0, 1.1, fz + fs * 0.13, hw * 2 - 0.3, 0.22, 0.05, C(0x8a8c8e));
  return b.build();
}

function windowGeometry(front) {
  const b = new MeshBuilder();
  const hw = 1.43, L = CAR / 2, w = C(0xffffff);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      const z = -L + 4.2 + i * 1.66;
      if (s > 0) b.quad([s * hw, 1.95, z + 0.7], [s * hw, 1.95, z - 0.7], [s * hw, 2.85, z - 0.7], [s * hw, 2.85, z + 0.7], w, [0, 0, 1, 1]);
      else b.quad([s * hw, 1.95, z - 0.7], [s * hw, 1.95, z + 0.7], [s * hw, 2.85, z + 0.7], [s * hw, 2.85, z - 0.7], w, [0, 0, 1, 1]);
    }
    for (const z of [-L + 2.2, L - 2.2]) {
      if (s > 0) b.quad([s * (hw + 0.02), 2.0, z + 0.35], [s * (hw + 0.02), 2.0, z - 0.35], [s * (hw + 0.02), 2.85, z - 0.35], [s * (hw + 0.02), 2.85, z + 0.35], w, [0, 0, 1, 1]);
      else b.quad([s * (hw + 0.02), 2.0, z - 0.35], [s * (hw + 0.02), 2.0, z + 0.35], [s * (hw + 0.02), 2.85, z + 0.35], [s * (hw + 0.02), 2.85, z - 0.35], w, [0, 0, 1, 1]);
    }
  }
  const fz = (front ? L : -L) + (front ? 0.14 : -0.14);
  if (front) b.quad([-1.2, 2.2, fz], [1.2, 2.2, fz], [1.2, 3.2, fz], [-1.2, 3.2, fz], w, [0, 0, 1, 1]);
  else b.quad([1.2, 2.2, fz], [-1.2, 2.2, fz], [-1.2, 3.2, fz], [1.2, 3.2, fz], w, [0, 0, 1, 1]);
  return b.build();
}

export class Trains {
  constructor(W, audio) {
    this.W = W; this.audio = audio;
    const R = W.plan.rail;
    this.rail = R;
    this.sWest = R.poly.s[R.west] - 40;
    this.sEast = R.poly.s[R.east] + 40;
    const st = W.plan.areas.station;
    this.sStation = R.poly.nearest(st.x, st.z, 30).s;
    this.sCross = W.crossing ? R.poly.nearest(W.crossing.x, W.crossing.z, 30).s : null;
    // materials
    this.bodyMat = patch(new THREE.MeshLambertMaterial({ vertexColors: true }), { key: 'train' });
    const winT = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 64, 64); g.addColorStop(0, '#6a8090'); g.addColorStop(0.5, '#26323c'); g.addColorStop(1, '#1a2228'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); x.fillStyle = 'rgba(255,255,255,0.15)'; x.fillRect(8, 0, 10, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    this.winMat = patch(new THREE.MeshLambertMaterial({ map: winT, emissive: 0xe8f4ff, emissiveIntensity: 0 }), { key: 'trainwin' });
    this.headMat = patch(new THREE.MeshBasicMaterial({ color: 0xfff6e0 }), { key: 'trainhead' });
    this.tailMat = patch(new THREE.MeshBasicMaterial({ color: 0xff2a1a }), { key: 'traintail' });
    this.group = new THREE.Group();
    this.cars = [];
    for (let i = 0; i < 2; i++) {
      const front = i === 0;
      const car = new THREE.Group();
      const body = new THREE.Mesh(carGeometry(front), this.bodyMat); body.castShadow = true; body.receiveShadow = true;
      const win = new THREE.Mesh(windowGeometry(front), this.winMat);
      car.add(body, win);
      const fz = front ? CAR / 2 + 0.15 : -CAR / 2 - 0.15;
      const lamps = [];
      for (const s of [-0.85, 0.85]) {
        const head = new THREE.Mesh(new THREE.CircleGeometry(0.13, 12), this.headMat);
        head.position.set(s, 1.3, fz + (front ? 0.01 : -0.01)); if (!front) head.rotation.y = Math.PI;
        const tail = new THREE.Mesh(new THREE.CircleGeometry(0.09, 10), this.tailMat);
        tail.position.set(s * 0.6, 3.35, fz + (front ? 0.01 : -0.01)); if (!front) tail.rotation.y = Math.PI;
        car.add(head, tail); lamps.push({ head, tail });
      }
      const destT = drawSign('普通　なつめ線', { w: 256, h: 64, bg: '#101010', fg: '#ffb030', font: JP_SANS, weight: 800 });
      const dest = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.25), new THREE.MeshBasicMaterial({ map: destT }));
      dest.position.set(0, 3.45, fz + (front ? 0.02 : -0.02)); if (!front) dest.rotation.y = Math.PI;
      car.add(dest);
      car.userData = { lamps, front };
      this.group.add(car);
      this.cars.push(car);
    }
    this.group.visible = false;
    W.scene.add(this.group);
    this.light = { x: 0, y: 0, z: 0, color: 0xfff0d0, power: 0, lamp: false };
    W.lightPool.sources.push(this.light);
    this.boxes = this.cars.map(() => W.col.addDynamicBox());
    this.run = null;
    this.lastHourIdx = null;
    this.crossT = 0; this.bellT = 0;
    this._p = {};
  }
  // trains leave the tunnels at :08 every two hours from 5:08 to 23:08, alternating directions
  schedule() {
    const out = [];
    for (let h = 5; h <= 23; h += 2) out.push({ t: h + 8 / 60, dir: (h - 5) % 4 === 0 ? 'east' : 'west' });
    return out;
  }
  nextTrains(hour, n = 3) {
    const s = this.schedule();
    const res = [];
    for (let d = 0; d < 2 && res.length < n; d++) for (const e of s) { const t = e.t + d * 24; if (t > hour && res.length < n) res.push({ ...e, t: t % 24, arrive: (t + 1.2 / 60 * 60 / 60) % 24 }); }
    return res;
  }
  update(dt, time, tSec) {
    const h = time.hour;
    // spawn by timetable
    for (const e of this.schedule()) {
      if (this.prevHour !== undefined && this.prevHour < e.t && h >= e.t && !this.run && h - e.t < 0.5) this.spawn(e.dir);
    }
    this.prevHour = h;
    const W = this.W;
    if (this.run) this.step(dt, time);
    // level crossing
    const C = W.crossing;
    if (C) {
      let want = false;
      if (this.run && this.sCross !== null) {
        const r = this.run;
        const head = r.s, tail = r.s - r.dir * (CAR * 2 + GAP);
        const lo = Math.min(head, tail), hi = Math.max(head, tail);
        const ahead = r.dir > 0 ? this.sCross - head : head - this.sCross;
        want = (this.sCross > lo - 8 && this.sCross < hi + 8) || (ahead > 0 && ahead < 260);
        if (r.phase === 'dwell' && ahead > 30) want = false;
      }
      C.active = want ? Math.min(1, C.active + dt * 2) : Math.max(0, C.active - dt * 0.7);
      const target = want ? 1 : 0;
      C.armT += Math.sign(target - C.armT) * Math.min(Math.abs(target - C.armT), dt / 4.5);
      for (const a of C.arms) a.rotation.z = (1 - smooth(C.armT)) * Math.PI / 2;
      const on = want || C.active > 0.05;
      const ph = Math.floor(tSec * 2.6) % 2;
      C.lampA.emissiveIntensity = on ? (ph ? 4 : 0.05) : 0;
      C.lampB.emissiveIntensity = on ? (ph ? 0.05 : 4) : 0;
      if (want) { this.bellT -= dt; if (this.bellT <= 0) { this.bellT = 0.36; this.audio.crossingBell?.(C.x, C.h + 2.2, C.z); } }
      // barrier colliders
      if (C.armT > 0.6 && !C.blocker) C.blocker = C.arms.map((a) => {
        const ang = a.rotation.y, L = a.userData.len;
        const x0 = a.position.x, z0 = a.position.z, x1 = x0 + Math.cos(ang) * L, z1 = z0 - Math.sin(ang) * L;
        return W.col.addSegment(x0, z0, x1, z1, 0.15, CF.ALL, 'barrier');
      });
      if (C.armT < 0.4 && C.blocker) { for (const b of C.blocker) W.col.remove(b); C.blocker = null; }
    }
  }
  spawn(dir) {
    const east = dir === 'east';
    this.run = { dir: east ? 1 : -1, s: east ? this.sWest : this.sEast, v: CRUISE * 0.8, phase: 'run', stopped: false, honked: 0, joint: new Map(), destRu: east ? DEST.eastRu : DEST.westRu };
    this.group.visible = true;
    // the leading car's cab faces the travel direction
    this.audio.trainStart?.();
  }
  step(dt, time) {
    const r = this.run, W = this.W, R = this.rail;
    const toStop = r.dir * (this.sStation - r.s);
    if (r.phase === 'run') {
      if (!r.stopped && toStop > 0) {
        const brakeDist = (r.v * r.v) / (2 * DECEL);
        if (toStop <= brakeDist + 1) { r.v = Math.sqrt(Math.max(0, 2 * DECEL * Math.max(0, toStop - 0.5))); r.braking = true; }
        else r.v = Math.min(CRUISE, r.v + ACCEL * dt);
        if (toStop < 0.8 || (r.v < 0.15 && toStop < 6)) { r.phase = 'dwell'; r.v = 0; r.dwell = 22; r.stopped = true; r.braking = false; this.audio.trainDoors?.(this.posAt(r.s - r.dir * CAR)); W.game?.onTrainArrive?.(r); }
      } else r.v = Math.min(CRUISE, r.v + ACCEL * dt);
      r.s += r.dir * r.v * dt;
      // horn when leaving the tunnel and before the crossing
      const fromStart = r.dir > 0 ? r.s - this.sWest : this.sEast - r.s;
      if (r.honked === 0 && fromStart > 60) { r.honked = 1; this.audio.trainHorn?.(this.posAt(r.s), 1.4); }
      if (this.sCross !== null && r.honked === 1 && r.dir * (this.sCross - r.s) < 220 && r.dir * (this.sCross - r.s) > 0) { r.honked = 2; this.audio.trainHorn?.(this.posAt(r.s), 0.8); }
      if ((r.dir > 0 && r.s > this.sEast + CAR * 2) || (r.dir < 0 && r.s < this.sWest - CAR * 2)) { this.run = null; this.group.visible = false; for (const b of this.boxes) b.flags = 0; this.light.power = 0; this.audio.trainStop?.(); return; }
    } else if (r.phase === 'dwell') {
      r.dwell -= dt;
      if (r.dwell <= 0) { r.phase = 'run'; this.audio.trainHorn?.(this.posAt(r.s), 0.5); r.honked = Math.max(r.honked, 1); }
    }
    // place cars
    const night = time.night;
    for (let i = 0; i < 2; i++) {
      const car = this.cars[i];
      const sFront = r.s - r.dir * i * (CAR + GAP);
      const sA = sFront - r.dir * 3.2, sB = sFront - r.dir * (CAR - 3.2);
      const a = R.poly.at(sA, {}), b = R.poly.at(sB, {});
      const cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2;
      const top = R.poly.sampleArray(R.top, (sA + sB) / 2) + 0.25;
      car.position.set(cx, top, cz);
      // car local +z must point toward the leading end for car 0 and toward the rear for car 1 (cabs at both ends)
      let yaw = Math.atan2(a.x - b.x, a.z - b.z);
      if (i === 1) yaw += Math.PI;
      car.rotation.set(0, yaw, 0);
      const lead = i === 0;
      for (const l of car.userData.lamps) { l.head.visible = lead; l.tail.visible = !lead; }
      const box = this.boxes[i];
      box.flags = CF.ALL; box.x = cx; box.z = cz; box.hw = 1.5; box.hd = CAR / 2 + 0.2; box.c = Math.cos(yaw); box.sn = Math.sin(yaw);
    }
    this.winMat.emissiveIntensity = 0.15 + 1.25 * night;
    this.headMat.color.setScalar(1 + 3 * night);
    const hp = this.posAt(r.s + r.dir * 2);
    this.light.x = hp.x; this.light.y = hp.y + 1.3; this.light.z = hp.z; this.light.power = night > 0.2 ? 3 : 0;
    this.audio.trainUpdate?.(this.posAt(r.s - r.dir * (CAR + GAP / 2)), r.v, r.braking && r.v < 7, r.phase === 'dwell');
    // rail joints every 25 m under each bogie
    for (let i = 0; i < 4; i++) {
      const sb = r.s - r.dir * (3.2 + Math.floor(i / 2) * (CAR + GAP) + (i % 2) * (CAR - 6.4));
      const j = Math.floor(sb / 25);
      if (r.joint.get(i) !== undefined && r.joint.get(i) !== j && r.v > 1) this.audio.trainClack?.(this.posAt(sb), r.v);
      r.joint.set(i, j);
    }
  }
  posAt(s) {
    const p = this.rail.poly.at(s, this._p);
    return { x: p.x, y: this.rail.poly.sampleArray(this.rail.top, s) + 0.6, z: p.z };
  }
}
function smooth(t) { return t * t * (3 - 2 * t); }
