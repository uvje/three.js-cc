import * as THREE from 'three';
import { MeshBuilder, C } from '../core/builder.js';
import { patch } from '../env/materials.js';
import * as MD from './models.js';
import { person, pose } from './npc.js';

// Summer afternoons in the river: kids wading and splashing each other, one drifting about in a swim ring, their
// bikes dropped on the bank above. From one until five, when it isn't raining.

const START = 13, END = 17.2;

export class RiverKids {
  constructor(W) {
    this.W = W; this.audio = null;
    const R = (this.R = W.plan.river);
    const b = W.plan.bridges.find((br) => br.road.name === 'south') || W.plan.bridges[0];
    const m = b.road.poly.pts[Math.round((b.a + b.b) / 2)];
    const s0 = (this.s0 = (R.poly.nearest(m[0], m[1], 80)?.s ?? R.poly.length * 0.7) - 38);
    const at = (ds, off) => { const a = R.poly.at(s0 + ds); return { x: a.x - a.tz * off, z: a.z + a.tx * off, y: R.poly.sampleArray(R.water, s0 + ds), tx: a.tx, tz: a.tz }; };
    this.at = at;
    this.group = new THREE.Group();
    W.scene.add(this.group);
    // three bikes dropped on the bank top
    const mat = patch(new THREE.MeshLambertMaterial({ vertexColors: true }), { key: 'kidbike' });
    [[-2, 11.6, 0x3a8ad0, 0.2], [0.5, 11.9, 0xe8402a, -0.15], [2.6, 11.5, 0xf0c020, 1.45]].forEach(([ds, off, col, lean]) => {
      const B = new MeshBuilder();
      MD.bicycle(() => B.reset(), col);
      const mesh = new THREE.Mesh(B.build(), mat);
      const p = at(ds, off), g = W.hm.sample(p.x, p.z);
      mesh.position.set(p.x, g, p.z);
      mesh.rotation.set(0, Math.atan2(p.tx, p.tz) + (lean > 1 ? 0.3 : 0), lean > 1 ? 1.45 : lean, 'YXZ');
      if (lean > 1) mesh.position.y += 0.05;
      mesh.castShadow = true;
      this.group.add(mesh);
    });
    // a towel and a pair of sandals on the bank
    const P = new MeshBuilder();
    const tp = at(1.2, 10.9), tg = W.hm.sample(tp.x, tp.z);
    P.box(0, 0.01, 0, 0.7, 0.02, 1.2, C(0xf08a3a));
    for (const sx of [-0.12, 0.12]) P.box(0.6 + sx, 0, 0.2, 0.09, 0.03, 0.24, C(0x2a6ad8));
    const tm = new THREE.Mesh(P.build(), mat);
    tm.position.set(tp.x, tg, tp.z); tm.rotation.y = Math.atan2(tp.tx, tp.tz) + 0.3;
    this.group.add(tm);
    // the kids
    const skin = 0xd8a882;
    const mk = (shirt, pants, cap, scale) => { const k = person({ skin, shirt, pants, legs: skin, hair: 0x141414, cap, sleeve: false, scale }); k.visible = true; this.group.add(k); return k; };
    this.kids = [
      { g: mk(skin, 0x2a4ab0, null, 0.68), ds: -1.0, off: 1.2, mode: 'splash', ph: 0 },
      { g: mk(skin, 0xd83a2a, 0xf0d040, 0.64), ds: 0.8, off: -0.6, mode: 'splash', ph: 2.1 },
      { g: mk(0xf0f0f0, 0x2a2a3a, null, 0.7), ds: 3.5, off: 2.2, mode: 'wade', ph: 4 },
      { g: mk(skin, 0x1a8a5a, null, 0.6), ds: -4, off: -1.5, mode: 'ring', ph: 1 },
    ];
    // the swim ring
    const ring = (this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.11, 10, 20), new THREE.MeshLambertMaterial({ color: 0xff7a2a })));
    ring.rotation.x = Math.PI / 2;
    this.group.add(ring);
    // spray
    const n = 60;
    this.drops = Array.from({ length: n }, () => ({ x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, t: 1 }));
    this.dropPos = new Float32Array(n * 3);
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(this.dropPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.spray = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xe8f4ff, size: 0.05, transparent: true, opacity: 0.85, depthWrite: false }));
    this.spray.frustumCulled = false;
    this.group.add(this.spray);
    this.group.visible = false;
    this.center = at(0, 0);
    W.landmarkIcons.push({ x: this.center.x, z: this.center.z, icon: '泳' });
    this.t = 0; this.splashT = 0;
  }
  near(p, r = 40) { return Math.hypot(p.x - this.center.x, p.z - this.center.z) < r; }
  update(dt, tSec, time, cam) {
    const h = time.hour, rain = this.W.game?.weather?.rain || 0;
    const on = h >= START && h < END && rain < 0.2;
    const close = Math.abs(cam.x - this.center.x) < 160 && Math.abs(cam.z - this.center.z) < 160;
    this.group.visible = on && close;
    if (!this.group.visible) return;
    this.t += dt;
    for (const k of this.kids) {
      const u = k.g.userData, t = this.t + k.ph;
      let ds = k.ds, off = k.off;
      if (k.mode === 'ring') { ds += Math.sin(t * 0.13) * 3; off += Math.sin(t * 0.21) * 1.2; }
      if (k.mode === 'wade') { ds += Math.sin(t * 0.25) * 2; }
      const p = this.at(ds, off);
      const bob = Math.sin(t * 1.7) * 0.03;
      if (k.mode === 'ring') {
        pose(k.g, 'sit');
        u.pelvis.position.y = 0.5;
        u.shL.rotation.set(-0.3, 0, 1.2); u.shR.rotation.set(-0.3, 0, -1.2); u.elL.rotation.x = u.elR.rotation.x = -0.3;
        u.knL.rotation.x = u.knR.rotation.x = 1.0 + Math.sin(t * 3) * 0.3;
        k.g.position.set(p.x, p.y - 0.42 + bob, p.z);
        this.ring.position.set(p.x, p.y + 0.02 + bob, p.z);
        k.g.rotation.y = t * 0.2;
      } else {
        pose(k.g, k.mode === 'wade' ? 'walk' : 'stand', t * 2);
        k.g.position.set(p.x, p.y - 0.5 + bob, p.z);
        // face the nearest other kid
        const o = this.kids[(this.kids.indexOf(k) + 1) % 2];
        if (k.mode === 'splash') {
          const q = o.g.position; k.g.rotation.y = Math.atan2(q.x - p.x, q.z - p.z);
          // scoop and throw water every couple of seconds
          const c = (t * 0.55) % 1, sw = c < 0.35 ? Math.sin((c / 0.35) * Math.PI) : 0;
          u.spine.rotation.x = 0.35 * sw;
          u.shL.rotation.set(-0.4 - sw * 1.6, 0, 0.25); u.shR.rotation.set(-0.4 - sw * 1.6, 0, -0.25);
          u.elL.rotation.x = u.elR.rotation.x = -0.2;
          if (c < k.lastC && Math.hypot(cam.x - p.x, cam.z - p.z) < 70) this.splash(p, k.g.rotation.y);
          k.lastC = c;
        } else {
          k.g.rotation.y = Math.atan2(p.tx, p.tz) * (Math.cos(t * 0.25) > 0 ? 1 : -1) + (Math.cos(t * 0.25) > 0 ? 0 : Math.PI);
          u.shL.rotation.set(0, 0, 0.6); u.shR.rotation.set(0, 0, -0.6);
        }
      }
    }
    // spray droplets
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i];
      if (d.t < 1) {
        d.t += dt * 1.4; d.vy -= 9.8 * dt;
        d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
        if (d.t >= 1 || d.y < d.floor) { d.t = 1; d.y = -100; }
      }
      this.dropPos[i * 3] = d.x; this.dropPos[i * 3 + 1] = d.y; this.dropPos[i * 3 + 2] = d.z;
    }
    this.spray.geometry.attributes.position.needsUpdate = true;
  }
  splash(p, yaw) {
    let n = 0;
    for (const d of this.drops) {
      if (d.t < 1 || n > 14) continue;
      n++;
      const a = yaw + (Math.random() - 0.5) * 0.9, v = 2 + Math.random() * 2.5;
      Object.assign(d, { x: p.x + Math.sin(yaw) * 0.3, y: p.y + 0.05, z: p.z + Math.cos(yaw) * 0.3, vx: Math.sin(a) * v, vy: 2.2 + Math.random() * 1.8, vz: Math.cos(a) * v, t: 0, floor: p.y - 0.02 });
    }
    this.audio?.kidSplash?.(p);
  }
}
