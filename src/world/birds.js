import * as THREE from 'three';
import { MeshBuilder, C } from '../core/builder.js';
import { patch } from '../env/materials.js';

// Birds on the wires and swallows over the fields. Sparrows line up on the low wires in the morning, crows gather on
// them at dusk; walk too close or ring the bell and the whole row takes off. Swallows skim low over the paddies
// and roads through the day.

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();

function birdGeo(kind, wings) {
  const b = new MeshBuilder();
  const crow = kind === 'crow', sw = kind === 'swallow';
  const L = crow ? 1 : sw ? 0.5 : 0.36;
  const body = C(crow ? 0x18181c : sw ? 0x1a2238 : 0x7a5a3a), belly = C(crow ? 0x202024 : sw ? 0xf0ece4 : 0xc8b8a0), beak = C(crow ? 0x101010 : 0x3a3a3a);
  b.blob(0, 0.06 * L, 0, 0.07 * L, 0.07 * L, 0.16 * L, body, null, 0, 1, crow ? 1 : 0.7);
  b.blob(0, 0.1 * L, 0.14 * L, 0.055 * L, 0.055 * L, 0.06 * L, sw ? C(0x8a2a1a) : body, null, 0, 1, 1);
  b.cone(0, 0.095 * L, 0.2 * L, 0.015 * L, 0.06 * L, 4, beak);
  b.box(0, 0.05 * L, -0.24 * L, 0.06 * L, 0.012 * L, 0.14 * L, body);
  if (sw) for (const s of [-1, 1]) b.box(s * 0.025 * L, 0.05 * L, -0.33 * L, 0.012 * L, 0.01 * L, 0.12 * L, body);
  b.box(0, 0.03 * L, 0.02 * L, 0.06 * L, 0.03 * L, 0.12 * L, belly);
  if (wings) {
    // spread wings, tips raised (up) or lowered (down)
    const span = (crow ? 0.5 : sw ? 0.42 : 0.24) * L * 2.2, tip = wings === 'up' ? 0.12 * L : -0.08 * L;
    for (const s of [-1, 1]) {
      b.tri([s * 0.04 * L, 0.08 * L, 0.06 * L], [s * span, 0.08 * L + tip, -0.02 * L], [s * 0.04 * L, 0.08 * L, -0.1 * L], body);
      b.tri([s * 0.04 * L, 0.08 * L, -0.1 * L], [s * span, 0.08 * L + tip, -0.02 * L], [s * 0.04 * L, 0.08 * L, 0.06 * L], body);
    }
  }
  return b.build();
}

class Flock {
  // n instances of one bird, in three poses: perched, wings up, wings down
  constructor(scene, kind, n, mat) {
    this.n = n;
    this.meshes = ['perch', 'up', 'down'].map((w) => {
      const m = new THREE.InstancedMesh(birdGeo(kind, w === 'perch' ? null : w), mat, n);
      m.frustumCulled = false; m.castShadow = false;
      for (let i = 0; i < n; i++) m.setMatrixAt(i, _m.makeScale(0, 0, 0));
      scene.add(m);
      return m;
    });
  }
  set(i, pose, p, q, scale = 1) {
    _s.setScalar(scale);
    this.meshes.forEach((m, k) => m.setMatrixAt(i, k === pose ? _m.compose(p, q, _s) : _m.makeScale(0, 0, 0)));
  }
  hide(i) { for (const m of this.meshes) m.setMatrixAt(i, _m.makeScale(0, 0, 0)); }
  flush() { for (const m of this.meshes) m.instanceMatrix.needsUpdate = true; }
}

export class Birds {
  constructor(W) {
    this.W = W; this.audio = null;
    const mat = patch(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), { key: 'bird' });
    this.flocks = { crow: new Flock(W.scene, 'crow', 36, mat), sparrow: new Flock(W.scene, 'sparrow', 48, mat), swallow: new Flock(W.scene, 'swallow', 8, mat) };
    // perched rows on low wire spans
    this.spans = (W.wires || []).filter((w) => w[6] >= 0.5 && Math.hypot(w[3] - w[0], w[5] - w[2]) > 12);
    this.rows = []; // { span, kind, birds:[{t, side, ph}], flying, ft }
    this.swallows = Array.from({ length: 8 }, (_, i) => ({ ph: i * 0.8, r: 9 + (i % 3) * 4, h: 1.2 + (i % 4) * 0.8, sp: 0.55 + (i % 5) * 0.08, cx: 0, cz: 0 }));
    this.t = 0; this.nextRow = 0;
  }
  // scare every row within r of p
  scare(p, r = 16) {
    for (const row of this.rows) if (!row.flying && Math.hypot(row.cx - p.x, row.cz - p.z) < r) this.takeOff(row);
  }
  takeOff(row) {
    row.flying = true; row.ft = 0;
    for (const b of row.birds) { b.vx = (Math.random() - 0.5) * 6; b.vz = (Math.random() - 0.5) * 6; b.vy = 2 + Math.random() * 2; }
    this.audio?.wingFlap?.(row.cx, row.cy, row.cz);
    if (row.kind === 'crow' && Math.random() < 0.7) this.audio?.crow?.(row.cx, row.cy + 2, row.cz);
  }
  update(dt, time, cam, player) {
    this.t += dt;
    const h = time.hour, rain = this.W.game?.weather?.rain || 0;
    const kind = h > 5.3 && h < 9.5 ? 'sparrow' : h > 16.3 && h < 19.3 ? 'crow' : h > 9.5 && h < 16.3 ? 'sparrow' : null;
    const wantRows = rain > 0.3 || !kind ? 0 : kind === 'crow' ? 3 : h < 9.5 ? 4 : 2;
    // retire rows that are far away, or of the wrong kind; seat new ones on spans near the player
    for (const row of this.rows) if (!row.flying && (Math.hypot(row.cx - cam.x, row.cz - cam.z) > 110 || row.kind !== kind)) row.gone = true;
    this.rows = this.rows.filter((r) => !r.gone || this.release(r));
    if (this.rows.filter((r) => !r.flying).length < wantRows && this.t > this.nextRow) {
      this.nextRow = this.t + 1.5;
      const near = this.spans.filter((w) => { const mx = (w[0] + w[3]) / 2, mz = (w[2] + w[5]) / 2, d = Math.hypot(mx - cam.x, mz - cam.z); return d > 18 && d < 90 && !this.rows.some((r) => r.span === w); });
      const w = near[Math.floor(Math.random() * near.length)];
      if (w) this.seat(w, kind);
    }
    // perched and departing birds
    const P = player.pos;
    for (const row of this.rows) {
      const F = this.flocks[row.kind];
      if (!row.flying && Math.hypot(row.cx - P.x, row.cz - P.z) < (player.speed > 3 ? 11 : 7)) this.takeOff(row);
      row.ft = (row.ft || 0) + dt;
      for (const b of row.birds) {
        if (!row.flying) {
          const [x0, y0, z0, x1, y1, z1, sag] = row.span, t = b.t;
          _p.set(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - sag * 4 * t * (1 - t) + 0.01, z0 + (z1 - z0) * t);
          b.x = _p.x; b.y = _p.y; b.z = _p.z;
          const look = Math.sin(this.t * 0.7 + b.ph) > 0.85 ? 0.6 : 0;
          _q.setFromEuler(_e.set(0, row.yaw + b.side * Math.PI + look, 0));
          F.set(b.i, 0, _p, _q);
          if (row.kind === 'sparrow' && Math.random() < dt * 0.02) this.audio?.sparrow?.(b.x, b.y, b.z);
        } else {
          b.vy += dt * 0.6; b.x += b.vx * dt * 2; b.y += b.vy * dt; b.z += b.vz * dt * 2;
          _p.set(b.x, b.y, b.z);
          _q.setFromEuler(_e.set(-0.3, Math.atan2(b.vx, b.vz), 0));
          F.set(b.i, Math.sin(this.t * (row.kind === 'crow' ? 9 : 22) + b.ph) > 0 ? 1 : 2, _p, _q);
        }
      }
      if (row.flying && row.ft > 9) row.gone = true;
    }
    this.rows = this.rows.filter((r) => !r.gone || this.release(r));
    // swallows: fast low loops around a point that drifts after the player
    const S = this.flocks.swallow, day = h > 6 && h < 18.8 && rain < 0.4;
    for (let i = 0; i < this.swallows.length; i++) {
      const s = this.swallows[i];
      if (!day) { S.hide(i); continue; }
      if (Math.hypot(s.cx - cam.x, s.cz - cam.z) > 60 || (!s.cx && !s.cz)) { s.cx = cam.x + (Math.random() - 0.5) * 50; s.cz = cam.z + (Math.random() - 0.5) * 50; }
      const a = this.t * s.sp * 1.6 + s.ph;
      const x = s.cx + Math.cos(a) * s.r + Math.sin(a * 2.3) * 3, z = s.cz + Math.sin(a * 1.3) * s.r;
      const gy = this.W.hm.sample(x, z), y = gy + s.h + Math.sin(a * 3.1) * 0.8;
      const dx = -Math.sin(a) * s.r + Math.cos(a * 2.3) * 6.9, dz = Math.cos(a * 1.3) * s.r * 1.3;
      _p.set(x, Math.max(y, gy + 0.6), z);
      _q.setFromEuler(_e.set(0, Math.atan2(dx, dz), -Math.sin(a * 1.3) * 0.7, 'YXZ'));
      S.set(i, Math.sin(this.t * 18 + i) > 0.3 ? 1 : 2, _p, _q);
    }
    for (const F of Object.values(this.flocks)) F.flush();
  }
  seat(span, kind) {
    const F = this.flocks[kind];
    const used = new Set(this.rows.filter((r) => r.kind === kind).flatMap((r) => r.birds.map((b) => b.i)));
    const free = [];
    for (let i = 0; i < F.n && free.length < 12; i++) if (!used.has(i)) free.push(i);
    const n = Math.min(free.length, kind === 'crow' ? 3 + Math.floor(Math.random() * 5) : 4 + Math.floor(Math.random() * 7));
    if (!n) return;
    const [x0, , z0, x1, , z1] = span;
    const len = Math.hypot(x1 - x0, z1 - z0), gap = (kind === 'crow' ? 0.9 : 0.35) / len;
    const start = 0.2 + Math.random() * (0.5 - n * gap);
    const birds = free.slice(0, n).map((i, k) => ({ i, t: Math.min(0.85, start + k * gap + Math.random() * gap * 0.4), side: Math.random() < 0.5 ? 0 : 1, ph: Math.random() * 6 }));
    const yaw = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
    this.rows.push({ span, kind, birds, yaw, cx: (x0 + x1) / 2, cy: (span[1] + span[4]) / 2, cz: (z0 + z1) / 2, flying: false });
  }
  release(row) { const F = this.flocks[row.kind]; for (const b of row.birds) F.hide(b.i); return false; }
}
