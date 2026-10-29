import * as THREE from 'three';
import { MeshBuilder, C } from '../core/builder.js';
import { RNG } from '../core/noise.js';
import { keiTruck } from './models.js';
import { LIFT } from './roads.js';
import { drawSign, JP_SANS } from '../env/textures.js';
import { CF } from './collision.js';
import { person, pose } from './npc.js';

// Kei trucks, small cars and the village bus driving on the left along the prefectural road.

function buildModel(kind, color, M) {
  const B = { plain: new MeshBuilder(), winDark: new MeshBuilder() };
  const get = (k) => B[k].reset();
  const extras = [];
  if (kind === 'kei') keiTruck(get, null, color);
  else if (kind === 'car') {
    const P = B.plain, W = B.winDark, body = C(color), dark = C(0x222428), w = C(0xffffff);
    P.box(0, 0.32, 0, 1.46, 0.68, 3.38, body);
    P.box(0, 1.0, -0.25, 1.38, 0.62, 2.1, body, { noTop: false });
    P.box(0, 0.36, 1.68, 1.4, 0.22, 0.06, C(0x9a9ca0));
    P.box(0, 0.36, -1.68, 1.4, 0.22, 0.06, C(0x9a9ca0));
    for (const [x, z] of [[0.66, 1.05], [-0.66, 1.05], [0.66, -1.05], [-0.66, -1.05]]) { P.push(); P.translate(x, 0.29, z); P.rotateZ(Math.PI / 2); P.cyl(0, -0.09, 0, 0.29, 0.29, 0.18, 10, dark, { cap: true }); P.pop(); }
    W.quad([-0.66, 1.04, 0.82], [0.66, 1.04, 0.82], [0.62, 1.58, 0.6], [-0.62, 1.58, 0.6], w, [0, 0, 1, 1]);
    W.quad([0.62, 1.04, -1.31], [-0.62, 1.04, -1.31], [-0.6, 1.56, -1.31], [0.6, 1.56, -1.31], w, [0, 0, 1, 1]);
    for (const s of [-1, 1]) {
      const x = s * 0.695;
      if (s > 0) W.quad([x, 1.06, 0.72], [x, 1.06, -1.2], [x, 1.56, -1.2], [x, 1.56, 0.55], w, [0, 0, 1, 1]);
      else W.quad([x, 1.06, -1.2], [x, 1.06, 0.72], [x, 1.56, 0.55], [x, 1.56, -1.2], w, [0, 0, 1, 1]);
    }
  } else if (kind === 'bus') {
    const P = B.plain, W = B.winDark, body = C(0xf2f2ee), stripe = C(0x3a8ac8), dark = C(0x222428), w = C(0xffffff);
    P.box(0, 0.4, 0, 2.1, 2.5, 7.4, body);
    P.box(0, 0.75, 0, 2.12, 0.22, 7.42, stripe);
    P.box(0, 2.9, 0.4, 1.6, 0.25, 2.4, C(0xb8bcc0));
    for (const [x, z] of [[0.9, 2.4], [-0.9, 2.4], [0.9, -2.3], [-0.9, -2.3]]) { P.push(); P.translate(x, 0.42, z); P.rotateZ(Math.PI / 2); P.cyl(0, -0.12, 0, 0.42, 0.42, 0.24, 12, dark, { cap: true }); P.pop(); }
    W.quad([-0.98, 1.3, 3.71], [0.98, 1.3, 3.71], [0.98, 2.6, 3.71], [-0.98, 2.6, 3.71], w, [0, 0, 1, 1]);
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) {
      const z0 = -3.2 + i * 1.3, z1 = z0 + 1.1, x = s * 1.055;
      if (s > 0) W.quad([x, 1.45, z1], [x, 1.45, z0], [x, 2.5, z0], [x, 2.5, z1], w, [0, 0, 1, 1]);
      else W.quad([x, 1.45, z0], [x, 1.45, z1], [x, 2.5, z1], [x, 2.5, z0], w, [0, 0, 1, 1]);
    }
    const t = drawSign('なつめ村内線', { w: 256, h: 64, bg: '#101010', fg: '#ffb030', font: JP_SANS, weight: 800 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.32), new THREE.MeshBasicMaterial({ map: t }));
    sign.position.set(0, 2.7, 3.72);
    extras.push(sign);
  }
  if (kind === 'cub') {
    // the postman's red Super Cub: step-through frame, leg shield, a red mail box on the carrier
    const P = B.plain, red = C(0xc8241e), dark = C(0x1e1e20), chrome = C(0xb8bcc0), white = C(0xf0f0ec);
    for (const z of [0.62, -0.58]) { P.push(); P.translate(0, 0.3, z); P.rotateZ(Math.PI / 2); P.cyl(0, -0.04, 0, 0.3, 0.3, 0.08, 14, dark, { cap: true }); P.cyl(0, -0.045, 0, 0.12, 0.12, 0.09, 10, chrome, { cap: true }); P.pop(); }
    P.box(0, 0.32, 0.08, 0.16, 0.12, 0.9, red);
    P.box(0, 0.4, -0.25, 0.26, 0.32, 0.55, red);
    P.box(0, 0.44, 0.38, 0.34, 0.62, 0.08, white);
    P.tube(0, 0.3, 0.62, 0, 1.0, 0.46, 0.022, 5, chrome);
    P.box(0, 0.98, 0.46, 0.62, 0.04, 0.05, chrome);
    P.box(0, 0.96, 0.52, 0.12, 0.12, 0.06, white);
    P.box(0, 0.74, -0.25, 0.26, 0.08, 0.5, dark);
    P.box(0, 0.72, -0.72, 0.42, 0.04, 0.36, chrome);
    P.box(0, 0.76, -0.72, 0.46, 0.4, 0.42, red);
    P.box(0, 0.7, 0.3, 0.3, 0.04, 0.3, chrome);
    const t = drawSign('〒', { w: 128, h: 128, bg: '#c8241e', fg: '#ffffff', font: JP_SANS, weight: 900 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), new THREE.MeshLambertMaterial({ map: t }));
    sign.position.set(0, 0.96, -0.935); sign.rotation.y = Math.PI;
    extras.push(sign);
  }
  const g = new THREE.Group();
  const body = new THREE.Mesh(B.plain.build(), M.plain); body.castShadow = true; body.receiveShadow = true;
  g.add(body);
  if (!B.winDark.empty) g.add(new THREE.Mesh(B.winDark.build(), M.winDark));
  for (const e of extras) g.add(e);
  return g;
}

const SPEC = { kei: { len: 3.4, half: 1.75, w: 0.75, v: 11 }, car: { len: 3.4, half: 1.72, w: 0.75, v: 12 }, bus: { len: 7.4, half: 3.75, w: 1.08, v: 9.5 }, cub: { len: 1.8, half: 0.95, w: 0.35, v: 8 } };

export class Traffic {
  constructor(W, audio) {
    this.W = W; this.audio = audio;
    this.road = W.plan.byName.main;
    const rng = (this.rng = new RNG(4040));
    this.headMat = new THREE.MeshBasicMaterial({ color: 0xfff4dc });
    this.tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
    const defs = [['kei', 0xf2f2ee], ['kei', 0xf2f2ee], ['car', 0xb8dcc8], ['car', 0xe8dcc0], ['car', 0xc8d0dc], ['bus', 0xffffff], ['cub', 0xc8241e]];
    const L = this.road.poly.length;
    this.stops = W.sitSpots.filter((s) => s.busStop).map((s) => this.road.poly.nearest(s.x, s.z, 20).s);
    // houses close to the road get mail
    this.mailStops = W.plan.lots.filter((l) => !l.shop).map((l) => this.road.poly.nearest(l.x, l.z, 28)).filter(Boolean).map((q) => q.s).sort((a, b) => a - b).filter((s, i, a) => i === 0 || s - a[i - 1] > 25);
    this.vehicles = defs.map(([kind, color], i) => {
      const mesh = buildModel(kind, color, W.M);
      const sp = SPEC[kind];
      if (kind === 'cub') {
        // the postman
        const r = person({ skin: 0xd8b090, shirt: 0x4a5a7a, pants: 0x3a4660, legs: 0x3a4660, cap: 0xf0f0f0, sleeve: true, scale: 0.95, shoes: 0x1a1a1a });
        pose(r, 'sit');
        const u = r.userData;
        u.pelvis.position.y = 0.36; u.hipL.rotation.x = u.hipR.rotation.x = -1.25; u.knL.rotation.x = u.knR.rotation.x = 1.35;
        u.shL.rotation.set(-1.15, 0, 0.18); u.shR.rotation.set(-1.15, 0, -0.18); u.elL.rotation.x = u.elR.rotation.x = -0.35;
        u.spine.rotation.x = 0.12;
        r.position.set(0, 0.42, -0.3);
        mesh.add(r);
        const h = new THREE.Mesh(new THREE.CircleGeometry(0.07, 10), this.headMat); h.position.set(0, 0.96, 0.56); mesh.add(h);
        const tl = new THREE.Mesh(new THREE.CircleGeometry(0.05, 8), this.tailMat); tl.position.set(0, 0.62, -0.94); tl.rotation.y = Math.PI; mesh.add(tl);
      }
      for (const s of kind === 'cub' ? [] : [-1, 1]) {
        const h = new THREE.Mesh(new THREE.CircleGeometry(kind === 'bus' ? 0.14 : 0.1, 10), this.headMat);
        h.position.set(s * (kind === 'bus' ? 0.75 : 0.55), kind === 'bus' ? 0.95 : 0.78, sp.half + 0.03);
        const t = new THREE.Mesh(new THREE.CircleGeometry(0.08, 8), this.tailMat);
        t.position.set(s * (kind === 'bus' ? 0.8 : 0.6), kind === 'bus' ? 1.0 : 0.65, -sp.half - 0.03); t.rotation.y = Math.PI;
        mesh.add(h, t);
      }
      mesh.rotation.order = 'YXZ';
      if (i === 1) {
        // the tofu seller: a cool box on the bed and a sign on the roof
        const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.9), new THREE.MeshLambertMaterial({ color: 0x5a7aa8 }));
        box.position.set(0, 0.85, -0.7); mesh.add(box);
        const st = drawSign('とうふ', { w: 256, h: 96, bg: '#ffffff', fg: '#1a3a8a', font: JP_SANS, weight: 900 });
        const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.34, 0.06), [0, 0, 0, 0, 1, 1].map((k) => (k ? new THREE.MeshLambertMaterial({ map: st }) : new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }))));
        sign.position.set(0, 2.06, 0.95); mesh.add(sign);
        const pole = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), new THREE.MeshLambertMaterial({ color: 0x9a9a9a }));
        pole.position.set(0, 1.9, 0.95); mesh.add(pole);
        mesh.userData.tofu = true;
      }
      W.scene.add(mesh);
      const v = { tofu: i === 1, hornT: 0, kind, mesh, sp, s: (L * (i + 0.5)) / defs.length, dir: i % 2 ? -1 : 1, v: sp.v, target: sp.v, wait: 0, honk: 0, box: W.col.addDynamicBox(), light: { x: 0, y: 0, z: 0, color: 0xfff0d0, power: 0, lamp: false }, voice: null, stopT: 0 };
      W.lightPool.sources.push(v.light);
      return v;
    });
  }
  active(h, v) {
    if (v.kind === 'bus') return h > 6.5 && h < 20.5;
    if (v.kind === 'cub') return h > 8.8 && h < 16.5;
    return h > 5.5 && h < 23 ? true : v === this.vehicles[0];
  }
  update(dt, time, player) {
    const R = this.road, L = R.poly.length, h = time.hour;
    const P = player.pos;
    for (const v of this.vehicles) {
      const on = this.active(h, v);
      if (!on && !v.mesh.visible) { v.box.flags = 0; continue; }
      if (v.wait > 0) { v.wait -= dt; v.mesh.visible = false; v.box.flags = 0; this.audio.vehicle?.(v, null); continue; }
      if (!on && (v.s < 30 || v.s > L - 30)) { v.mesh.visible = false; v.box.flags = 0; this.audio.vehicle?.(v, null); continue; }
      v.mesh.visible = true;
      const q = R.poly.at(v.s);
      // speed target: slower through the village
      const vil = Math.abs(q.x + 40) < 220;
      let target = v.sp.v * (vil ? 0.75 : 1);
      // bus stops
      // before supper the tofu seller crawls through the village blowing his horn
      if (v.tofu && h > 16.4 && h < 18.3) {
        target = Math.min(target, vil ? 4.5 : 9);
        v.hornT -= dt;
        if (v.hornT <= 0 && vil) { v.hornT = 7 + this.rng.float(0, 4); this.audio.tofuHorn?.(this.posOf(v)); }
      }
      // the postman stops at houses along the road for a few seconds
      if (v.kind === 'cub') {
        for (const st of this.mailStops) {
          const d = (st - v.s) * v.dir;
          if (d > 0 && d < 12 && v.stopT <= 0 && v.lastStop !== st) target = Math.min(target, Math.max(0.5, d * 0.6));
          if (Math.abs(st - v.s) < 0.8 && v.lastStop !== st) { v.stopT = 4 + this.rng.float(0, 3); v.lastStop = st; }
        }
        if (v.stopT > 0) { v.stopT -= dt; target = 0; }
      }
      if (v.kind === 'bus') {
        for (const st of this.stops) {
          const d = (st - v.s) * v.dir;
          if (d > 0 && d < 30 && v.stopT <= 0 && v.lastStop !== st) target = Math.min(target, Math.max(0.6, d * 0.35));
          if (Math.abs(st - v.s) < 1.2 && v.lastStop !== st) { v.stopT = 9; v.lastStop = st; this.audio.busDoors?.(this.posOf(v)); this.W.game?.onBusStop?.(st); }
        }
        if (v.stopT > 0) { v.stopT -= dt; target = 0; }
      }
      // keep distance to the player and to other vehicles ahead in the same lane
      const lane = -v.dir * (v.kind === 'cub' ? R.w / 2 - 0.7 : R.w / 4 + 0.1);
      const fx = q.tx * v.dir, fz = q.tz * v.dir;
      const nx = -q.tz, nz = q.tx;
      const cx = q.x + nx * lane, cz = q.z + nz * lane;
      const relx = P.x - cx, relz = P.z - cz;
      const ahead = relx * fx + relz * fz, side = Math.abs(relx * nx + relz * nz - 0);
      if (ahead > 0 && ahead < 16 + v.sp.half && side < 2.2) {
        target = Math.min(target, Math.max(0, (ahead - v.sp.half - 3) * 0.9));
        if (v.v < 0.5) { v.honk += dt; if (v.honk > 1.6) { v.honk = -6; this.audio.horn?.(this.posOf(v), v.kind); } }
      } else v.honk = Math.min(v.honk, 0) + dt * 0;
      for (const o of this.vehicles) {
        if (o === v || !o.mesh.visible || o.dir !== v.dir || o.wait > 0) continue;
        const d = (o.s - v.s) * v.dir;
        if (d > 0 && d < 22) target = Math.min(target, Math.max(0, (d - 10) * 0.8));
      }
      const acc = target > v.v ? 1.6 : 4.5;
      v.v += Math.sign(target - v.v) * Math.min(Math.abs(target - v.v), acc * dt);
      v.s += v.dir * v.v * dt;
      if (v.s > L - 5 || v.s < 5) {
        // leave the valley; come back later the other way
        v.dir *= -1; v.s = v.s > L / 2 ? L - 6 : 6;
        v.wait = this.rng.float(15, v.kind === 'bus' ? 120 : 70);
        v.lastStop = null;
        continue;
      }
      const a = R.poly.at(v.s + v.dir * 1.2), b = R.poly.at(v.s - v.dir * 1.2);
      const yA = R.poly.sampleArray(R.prof, v.s + v.dir * 1.2), yB = R.poly.sampleArray(R.prof, v.s - v.dir * 1.2);
      const px = (a.x + b.x) / 2 + nx * lane, pz = (a.z + b.z) / 2 + nz * lane;
      const py = (yA + yB) / 2 + LIFT.main;
      v.mesh.position.set(px, py, pz);
      v.mesh.rotation.set(-Math.atan2(yA - yB, 2.4), Math.atan2(a.x - b.x, a.z - b.z), 0);
      const yaw = v.mesh.rotation.y;
      Object.assign(v.box, { flags: CF.ALL, x: px, z: pz, hw: v.sp.w, hd: v.sp.half, c: Math.cos(yaw), sn: Math.sin(yaw) });
      const night = time.night;
      v.light.x = px + Math.sin(yaw) * (v.sp.half + 2); v.light.z = pz + Math.cos(yaw) * (v.sp.half + 2); v.light.y = py + 0.8;
      v.light.power = night > 0.3 ? 2.2 : 0;
      this.audio.vehicle?.(v, this.posOf(v));
    }
    this.headMat.color.setScalar(1 + 2.5 * time.night);
    this.tailMat.color.setRGB(1 + 1.5 * time.night, 0.16, 0.1);
  }
  posOf(v) { return { x: v.mesh.position.x, y: v.mesh.position.y + 0.8, z: v.mesh.position.z }; }
}
