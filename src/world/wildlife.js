import * as THREE from 'three';
import { MeshBuilder, C } from '../core/builder.js';
import { patch } from '../env/materials.js';

// Dragonflies darting over the fields and white egrets wading in the paddies (they take off if you come close).

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();

export class Wildlife {
  constructor(W, audio) {
    this.W = W; this.audio = audio;
    // ---- dragonflies
    const b = new MeshBuilder();
    b.box(0, -0.006, -0.01, 0.012, 0.012, 0.075, C(0xffffff));
    b.blob(0, 0, 0.035, 0.012, 0.012, 0.012, C(0xffffff), null, 0, 0, 1);
    const wing = C(0xdde8f0);
    for (const z of [0.012, -0.008]) {
      b.quad([-0.06, 0.002, z - 0.008], [0.06, 0.002, z - 0.008], [0.06, 0.002, z + 0.008], [-0.06, 0.002, z + 0.008], wing);
      b.quad([0.06, 0.0, z - 0.008], [-0.06, 0.0, z - 0.008], [-0.06, 0.0, z + 0.008], [0.06, 0.0, z + 0.008], wing);
    }
    this.nDF = 46;
    this.df = new THREE.InstancedMesh(b.build(), patch(new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.92 }), { key: 'df' }), this.nDF);
    this.df.frustumCulled = false;
    const red = new THREE.Color(0xd8402e), blue = new THREE.Color(0x6a8ab0);
    this.flies = [];
    for (let i = 0; i < this.nDF; i++) {
      this.df.setColorAt(i, i % 3 === 0 ? blue : red);
      this.flies.push({ x: 0, y: -100, z: 0, tx: 0, ty: 0, tz: 0, hover: 0, yaw: 0, placed: false });
    }
    W.scene.add(this.df);
    // ---- egrets
    this.egrets = [];
    const paddies = W.paddies.filter((p) => Math.abs(p.x) < 700);
    for (let i = 0; i < 12 && paddies.length; i++) {
      const g = this.makeEgret();
      W.scene.add(g);
      const e = { g, state: 'stand', t: Math.random() * 10, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
      this.placeEgret(e, paddies, null, i);
      this.egrets.push(e);
    }
    this.paddies = paddies;
  }
  makeEgret() {
    const white = patch(new THREE.MeshLambertMaterial({ color: 0xf4f4f0 }), { key: 'egret' });
    const dark = new THREE.MeshLambertMaterial({ color: 0x1a1a1a }), yellow = new THREE.MeshLambertMaterial({ color: 0xe8b830 });
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), white); body.scale.set(0.85, 0.8, 1.6); body.position.y = 0.62; g.add(body);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.38, 6), white); neck.position.set(0, 0.86, 0.2); neck.rotation.x = 0.35; g.add(neck);
    const head = new THREE.Group(); head.position.set(0, 1.04, 0.28); g.add(head);
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), white));
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.14, 5), yellow); beak.rotation.x = Math.PI / 2; beak.position.z = 0.09; head.add(beak);
    for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 4), dark); l.position.set(s * 0.05, 0.27, 0); g.add(l); }
    const wings = [];
    for (const s of [-1, 1]) {
      const w = new THREE.Group(); w.position.set(s * 0.1, 0.66, 0); g.add(w);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.26), new THREE.MeshLambertMaterial({ color: 0xf2f2ee, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.position.x = s * 0.27; w.add(m);
      w.visible = false; wings.push(w);
    }
    g.userData = { head, wings, body };
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  placeEgret(e, paddies, avoid, idx = Math.floor(Math.random() * 2)) {
    const R = this.W.plan.river;
    for (let k = 0; k < 30; k++) {
      let x, z, y;
      if (idx % 2 === 0) {
        // wading in the shallows by the river bank
        const i = 20 + Math.floor(Math.random() * (R.poly.pts.length - 40));
        const [px, pz] = R.poly.pts[i], [qx, qz] = R.poly.pts[i + 1];
        let nx = -(qz - pz), nz = qx - px; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
        const s = Math.random() < 0.5 ? -1 : 1;
        x = px + nx * s * 5.6; z = pz + nz * s * 5.6; y = R.water[i] - 0.32;
        if (Math.abs(x) > 760) continue;
      } else {
        // standing on a levee between paddies
        const p = paddies[Math.floor(Math.random() * paddies.length)];
        const side = Math.floor(Math.random() * 4);
        x = p.x + (side === 0 ? -p.hw - 0.35 : side === 1 ? p.hw + 0.35 : (Math.random() - 0.5) * p.hw * 1.6);
        z = p.z + (side === 2 ? -p.hd - 0.35 : side === 3 ? p.hd + 0.35 : (Math.random() - 0.5) * p.hd * 1.6);
        y = p.y + 0.2;
      }
      if (avoid && Math.hypot(x - avoid.x, z - avoid.z) < 70) continue;
      e.x = x; e.z = z; e.y = y; e.state = 'stand';
      e.g.position.set(x, y, z); e.g.rotation.set(0, Math.random() * 6.28, 0);
      for (const w of e.g.userData.wings) w.visible = false;
      return;
    }
  }
  update(dt, time, cam, player) {
    const h = time.hour;
    const day = h > 8.5 && h < 18.6;
    const rain = this.W.game?.weather?.rain || 0;
    // dragonflies
    const active = day && rain < 0.3;
    this.df.visible = active;
    if (active) {
      for (let i = 0; i < this.nDF; i++) {
        const f = this.flies[i];
        const far = Math.hypot(f.x - cam.x, f.z - cam.z);
        if (!f.placed || far > 55) {
          // respawn over grass or paddies near the player
          const a = Math.random() * Math.PI * 2, d = 12 + Math.random() * 35;
          const x = cam.x + Math.cos(a) * d, z = cam.z + Math.sin(a) * d;
          const W = this.W, ix = Math.round((x + 1000) / 2), iz = Math.round((z + 1000) / 2);
          const grassy = ix > 0 && iz > 0 && ix < W.maskW && iz < W.maskW && (W.maskData[(iz * W.maskW + ix) * 4] > 80 || W.plan.occAt(x, z) & 64);
          if (!grassy) { f.y = -100; continue; }
          f.x = f.tx = x; f.z = f.tz = z; f.y = f.ty = W.hm.sample(x, z) + 1 + Math.random() * 1.8; f.placed = true; f.hover = Math.random() * 2;
        }
        f.hover -= dt;
        if (f.hover <= 0) {
          f.hover = 0.6 + Math.random() * 2.2;
          f.tx = f.x + (Math.random() - 0.5) * 9; f.tz = f.z + (Math.random() - 0.5) * 9;
          f.ty = this.W.hm.sample(f.tx, f.tz) + 0.8 + Math.random() * 2;
        }
        const dx = f.tx - f.x, dy = f.ty - f.y, dz = f.tz - f.z, d = Math.hypot(dx, dy, dz);
        if (d > 0.05) {
          const sp = Math.min(d, 7 * dt);
          f.x += (dx / d) * sp; f.y += (dy / d) * sp; f.z += (dz / d) * sp;
          f.yaw = Math.atan2(dx, dz);
        }
        _p.set(f.x + Math.sin(time.hour * 900 + i) * 0.02, f.y + Math.sin(performance.now() * 0.013 + i) * 0.03, f.z);
        _q.setFromEuler(_e.set(0, f.yaw, 0));
        const flick = 0.75 + 0.25 * Math.sin(performance.now() * 0.09 + i * 3);
        _s.set(flick, 1, 1);
        this.df.setMatrixAt(i, _m.compose(_p, _q, _s));
      }
      this.df.instanceMatrix.needsUpdate = true;
    }
    // egrets
    for (const e of this.egrets) {
      const near = Math.abs(e.x - cam.x) < 260 && Math.abs(e.z - cam.z) < 260;
      e.g.visible = near && h > 5.5 && h < 19 && rain < 0.5;
      if (!e.g.visible) continue;
      e.t += dt;
      const u = e.g.userData;
      if (e.state === 'stand') {
        const k = e.t % 7;
        u.head.position.y = k < 0.6 ? 0.95 - Math.sin((k / 0.6) * Math.PI) * 0.25 : 1.04;
        const d = Math.hypot(player.pos.x - e.x, player.pos.z - e.z);
        if (d < (player.speed > 3 ? 18 : 11)) {
          e.state = 'fly'; e.t = 0;
          const ax = e.x - player.pos.x, az = e.z - player.pos.z, l = Math.hypot(ax, az) || 1;
          e.vx = (ax / l) * 6.5; e.vz = (az / l) * 6.5; e.vy = 2.2;
          e.g.rotation.y = Math.atan2(e.vx, e.vz);
          for (const w of u.wings) w.visible = true;
          this.audio.wingFlap?.(e.x, e.y + 1, e.z);
        }
      } else {
        e.vy = Math.max(0.3, e.vy - dt * 0.4);
        e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt;
        e.g.position.set(e.x, e.y, e.z);
        const f = Math.sin(e.t * 9) * 0.9;
        u.wings[0].rotation.z = -f; u.wings[1].rotation.z = f;
        if (e.t > 14) this.placeEgret(e, this.paddies, player.pos);
      }
    }
  }
}
