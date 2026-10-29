import * as THREE from 'three';
import { C } from '../core/builder.js';
import { drawSign } from '../env/textures.js';
import { patch } from '../env/materials.js';

// Fishing from the river bank: a stool, a bucket and a little sign mark the spots. Sit down to cast; watch the
// float, and when it is pulled under, strike (E). The catch goes into the diary.

export const FISH = [
  { id: 'oikawa', jp: 'オイカワ', ru: 'Оикава', acc: 'оикаву', note: 'Серебристая рыбка; летом у самцов радужные бока.', w: 5, when: (h) => h > 5 && h < 19.5 },
  { id: 'ayu', jp: 'アユ', ru: 'Аю', acc: 'аю', note: 'Пахнет арбузом — правда! Летом её жарят на шпажках с солью.', w: 3, when: (h) => h > 5 && h < 19.5 },
  { id: 'yamame', jp: 'ヤマメ', ru: 'Ямамэ', acc: 'ямамэ', note: 'Пятнистая и пугливая форель из чистой холодной воды.', w: 1.2, when: (h) => (h > 4.5 && h < 8) || (h > 17 && h < 20) },
  { id: 'dojo', jp: 'ドジョウ', ru: 'Вьюн', acc: 'вьюна', note: 'Скользкий, с усиками, живёт в иле и пищит, если его взять.', w: 2, when: () => true },
  { id: 'zarigani', jp: 'ザリガニ', ru: 'Красный рак', acc: 'красного рака', note: 'Цепляется клешнёй за наживку и не отпускает.', w: 2.5, when: () => true },
  { id: 'namazu', jp: 'ナマズ', ru: 'Сом', acc: 'сома', note: 'Усатый сом. Говорят, он чувствует землетрясения.', w: 1.5, when: (h) => h > 19 || h < 5 },
];
const BOOT = { id: 'boot', jp: '長靴', ru: 'Старый сапог', acc: 'старый сапог', note: 'Резиновый сапог, полный ила. Чей он, интересно?' };

export class Fishing {
  constructor(W) {
    this.W = W;
    const R = W.plan.river;
    this.spots = [];
    const at = (s, side) => {
      const a = R.poly.at(s), nx = -a.tz * side, nz = a.tx * side;
      const x = a.x + nx * 10.9, z = a.z + nz * 10.9, g = W.hm.sample(x, z);
      const spot = { x, y: g + 0.3, z, ang: Math.atan2(-nx, -nz), label: 'Порыбачить', fish: true, water: { x: a.x + nx * 3.2, z: a.z + nz * 3.2, y: R.poly.sampleArray(R.water, s) } };
      // stool, bucket and a sign on a stake
      const P = W.chunks.get('plain', x, z);
      P.place(x, g, z, spot.ang);
      P.cyl(0, 0, 0, 0.17, 0.15, 0.3, 8, C(0x7a5a3a), { cap: true });
      P.cyl(0.45, 0, -0.1, 0.13, 0.11, 0.26, 10, C(0x3a7ac0), { cap: true });
      P.box(-0.55, 0, -0.3, 0.05, 1.0, 0.05, C(0x8a6a48));
      const t = drawSign('釣り場', { w: 256, h: 96, bg: '#f4efe2', fg: '#1a3a6a' });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.19), patch(new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide }), { key: 'sign' }));
      sign.position.set(x + Math.cos(spot.ang) * -0.55 + Math.sin(spot.ang) * -0.32, g + 0.9, z - Math.sin(spot.ang) * -0.55 + Math.cos(spot.ang) * -0.32);
      sign.rotation.y = spot.ang + Math.PI;
      W.extras.push(sign);
      W.sitSpots.push(spot);
      W.landmarkIcons.push({ x, z, icon: '釣' });
      this.spots.push(spot);
    };
    // below the main bridge, by grandma's, and downstream of the south bridge
    const bs = (name, off) => { const b = W.plan.bridges.find((br) => br.road.name === name); if (!b) return null; const m = b.road.poly.pts[Math.round((b.a + b.b) / 2)]; const q = R.poly.nearest(m[0], m[1], 80); return q ? q.s + off : null; };
    const s1 = bs('main', 36); if (s1) at(s1, 1);
    const hl = W.plan.lots.find((l) => l.home);
    if (hl) { const q = R.poly.nearest(hl.x, hl.z, 400); if (q) at(q.s, Math.sign((hl.x - q.x) * -q.tz + (hl.z - q.z) * q.tx) || 1); }
    const s3 = bs('south', 45); if (s3) at(s3, -1);
    // rod, line and float
    const rod = (this.rod = new THREE.Group());
    const len = 2.7;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.011, len, 6), new THREE.MeshLambertMaterial({ color: 0x8a6a3a }));
    pole.geometry.translate(0, len / 2, 0);
    pole.rotation.x = -1.05; pole.position.set(0.22, -0.32, -0.25);
    rod.add(pole);
    this.pole = pole; this.len = len;
    rod.visible = false;
    W.scene.add(rod);
    this.lineGeo = new THREE.BufferGeometry();
    this.lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9 * 3), 3));
    this.line = new THREE.Line(this.lineGeo, new THREE.LineBasicMaterial({ color: 0xe8e8e0, transparent: true, opacity: 0.7 }));
    this.line.frustumCulled = false; this.line.visible = false;
    W.scene.add(this.line);
    const fl = (this.float = new THREE.Group());
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshLambertMaterial({ color: 0xe83a2a, emissive: 0x401008 }));
    top.position.y = 0.025; fl.add(top);
    const bot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshLambertMaterial({ color: 0xf4f4ee })); fl.add(bot);
    const ring = (this.ring = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.08, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })));
    ring.rotation.x = -Math.PI / 2; fl.add(ring);
    fl.visible = false;
    W.scene.add(fl);
    this.state = 'idle'; this.t = 0;
    this._v = new THREE.Vector3(); this._tip = new THREE.Vector3();
  }
  // while a fish is on, E strikes instead of standing up
  get holdsE() { return this.state === 'nibble' || this.state === 'bite' || this.state === 'reel' || this.state === 'show'; }
  start(spot) { this.spot = spot; this.state = 'cast'; this.t = 0; this.rod.visible = this.line.visible = this.float.visible = true; }
  stop() { this.state = 'idle'; this.spot = null; this.rod.visible = this.line.visible = this.float.visible = false; }
  pickFish(h) {
    if (Math.random() < 0.06) return BOOT;
    const pool = FISH.filter((f) => f.when(h));
    let r = Math.random() * pool.reduce((a, f) => a + f.w, 0);
    return pool.find((f) => (r -= f.w) < 0) || pool[0];
  }
  // returns the catch when one is landed this frame
  update(dt, tSec, time, camera, input, audio) {
    if (this.state === 'idle') return null;
    const sp = this.spot, wpt = sp.water;
    this.t += dt;
    let result = null;
    // rod follows the camera; the line runs from its tip to the float
    this.rod.position.copy(camera.position); this.rod.quaternion.copy(camera.quaternion);
    let fy = wpt.y + 0.01 + Math.sin(tSec * 1.6) * 0.008, fx = wpt.x, fz = wpt.z, bend = 0;
    const strike = input.hit('KeyE');
    if (this.state === 'cast') {
      const k = Math.min(1, this.t / 0.9);
      this.pole.rotation.x = -1.05 - Math.sin(k * Math.PI) * 0.5;
      if (this.t < 0.05) audio?.fishCast?.(wpt);
      const tip = this.tipWorld();
      fx = tip.x + (wpt.x - tip.x) * k; fz = tip.z + (wpt.z - tip.z) * k; fy = tip.y + (wpt.y - tip.y) * k + Math.sin(k * Math.PI) * 1.2;
      if (k >= 1) { this.state = 'wait'; this.t = 0; this.wait = 4 + Math.random() * 12; audio?.fishPlop?.(wpt, 0.6); this.splash = 1; }
    } else if (this.state === 'wait') {
      this.pole.rotation.x = -1.05;
      if (this.t > this.wait) { this.state = 'nibble'; this.t = 0; this.nib = 0.8 + Math.random() * 1.6; }
    } else if (this.state === 'nibble') {
      fy -= Math.max(0, Math.sin(this.t * 14)) * 0.03;
      if (Math.sin(this.t * 14) > 0.95 && !this.nibbed) { this.nibbed = true; audio?.fishPlop?.(wpt, 0.15); } else if (Math.sin(this.t * 14) < 0) this.nibbed = false;
      if (strike) { this.state = 'wait'; this.t = 0; this.wait = 3 + Math.random() * 8; this.msg = 'Рано подсёк — рыба только пробовала наживку.'; }
      else if (this.t > this.nib) { this.state = 'bite'; this.t = 0; audio?.fishPlop?.(wpt, 0.9); this.splash = 1; }
    } else if (this.state === 'bite') {
      fy -= 0.09; bend = 0.25;
      fx += Math.sin(this.t * 9) * 0.06;
      if (strike) { this.state = 'reel'; this.t = 0; this.caught = this.pickFish(time.hour); audio?.fishSplash?.(wpt); this.splash = 1; }
      else if (this.t > 1.1) { this.state = 'wait'; this.t = 0; this.wait = 4 + Math.random() * 10; this.msg = 'Не успел — поплавок вынырнул. Рыба сорвалась.'; }
    } else if (this.state === 'reel') {
      bend = 0.45 * (1 - this.t / 1.2);
      const k = Math.min(1, this.t / 1.2), tip = this.tipWorld();
      fx = wpt.x + (tip.x - 0.3 - wpt.x) * k * 0.8; fz = wpt.z + (tip.z - wpt.z) * k * 0.8; fy = wpt.y + k * 1.4;
      this.pole.rotation.x = -1.05 - k * 0.6;
      if (this.t > 1.2) { this.state = 'show'; this.t = 0; result = this.caught; }
    } else if (this.state === 'show') {
      this.pole.rotation.x = -1.65;
      const tip = this.tipWorld(); fx = tip.x; fz = tip.z; fy = tip.y - 0.6;
      if (this.t > 2.2 || strike) { this.state = 'cast'; this.t = 0; }
    }
    this.pole.rotation.z = -bend;
    this.float.position.set(fx, fy, fz);
    // splash ring
    this.splash = Math.max(0, (this.splash || 0) - dt * 1.2);
    this.ring.material.opacity = this.splash * 0.6;
    this.ring.scale.setScalar(1 + (1 - this.splash) * 3);
    // the line, sagging a little
    const tip = this.tipWorld(), arr = this.lineGeo.attributes.position.array;
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      arr[i * 3] = tip.x + (fx - tip.x) * t; arr[i * 3 + 1] = tip.y + (fy + 0.04 - tip.y) * t - Math.sin(t * Math.PI) * (this.state === 'wait' ? 0.25 : 0.08); arr[i * 3 + 2] = tip.z + (fz - tip.z) * t;
    }
    this.lineGeo.attributes.position.needsUpdate = true;
    return result;
  }
  tipWorld() {
    this.rod.updateMatrixWorld();
    return this.pole.localToWorld(this._tip.set(0, this.len, 0));
  }
}
