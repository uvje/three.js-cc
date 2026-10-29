import * as THREE from 'three';
import { MeshBuilder, C } from '../core/builder.js';
import { patch } from '../env/materials.js';

// Tōrō nagashi: late in the evening paper lanterns are set on the river below the main bridge and drift
// downstream, each with a small pool of light on the water.

export const TORO_START = 20.5, TORO_END = 23.4;
const N = 36;

export class Toro {
  constructor(W) {
    this.W = W;
    const R = (this.R = W.plan.river);
    const b = W.plan.bridges.find((br) => br.road.name === 'main') || W.plan.bridges[0];
    const m = b.road.poly.pts[Math.round((b.a + b.b) / 2)];
    this.s0 = (R.poly.nearest(m[0], m[1], 80)?.s ?? R.poly.length * 0.6) + 9;
    // wooden base with corner posts, and the paper shade on top (drawn separately so it can glow)
    const base = new MeshBuilder();
    base.box(0, 0, 0, 0.34, 0.06, 0.34, C(0x4a3424));
    for (const sx of [-0.14, 0.14]) for (const sz of [-0.14, 0.14]) base.box(sx, 0.06, sz, 0.025, 0.34, 0.025, C(0x3a2a1c));
    base.box(0, 0.4, 0, 0.32, 0.03, 0.32, C(0x3a2a1c));
    const shade = new MeshBuilder();
    shade.box(0, 0.07, 0, 0.27, 0.32, 0.27, C(0xffffff), { noTop: true });
    this.baseMesh = new THREE.InstancedMesh(base.build(), patch(new THREE.MeshLambertMaterial({ vertexColors: true }), { key: 'toro' }), N);
    this.shadeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.shadeMesh = new THREE.InstancedMesh(shade.build(), this.shadeMat, N);
    const tint = [0xffd8a0, 0xffc890, 0xffb47c, 0xffe0b8];
    for (let i = 0; i < N; i++) this.shadeMesh.setColorAt(i, new THREE.Color(tint[i % 4]));
    // light on the water
    const disc = new THREE.PlaneGeometry(2.4, 2.4); disc.rotateX(-Math.PI / 2);
    this.glowMat = new THREE.ShaderMaterial({
      uniforms: { uI: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uI; varying vec2 vUv; void main() { float d = length(vUv - 0.5) * 2.0; float a = exp(-d * d * 5.0) * uI; gl_FragColor = vec4(vec3(1.0, 0.62, 0.28) * a, 1.0); }',
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.glowMesh = new THREE.InstancedMesh(disc, this.glowMat, N);
    for (const m2 of [this.baseMesh, this.shadeMesh, this.glowMesh]) { m2.frustumCulled = false; m2.visible = false; W.scene.add(m2); }
    this.items = Array.from({ length: N }, (_, i) => ({ s: 0, off: 0, ph: i * 1.7, v: 0.5, alive: false }));
    this.lights = Array.from({ length: 6 }, () => ({ x: 1e6, y: -100, z: 1e6, color: 0xffa050, power: 1, i: 2.2, dist: 6, kf: () => (this.glow > 0.01 ? this.glow : 0) }));
    W.lampSources.push(...this.lights);
    this.spawnT = 0; this.glow = 0;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1); this._e = new THREE.Euler();
  }
  get active() { return this.glow > 0.05; }
  // the nearest glowing lantern, for stamps and time slowing
  nearest(p) {
    let best = 1e9;
    for (const it of this.items) if (it.alive) { const d = Math.hypot(it.x - p.x, it.z - p.z); if (d < best) best = d; }
    return best;
  }
  update(dt, tSec, time, cam) {
    const h = time.hour;
    const on = h >= TORO_START && h < TORO_END;
    // the candles burn down towards midnight
    this.glow += ((on || (h >= TORO_END && h < 24 && this.items.some((it) => it.alive)) ? (h < TORO_END ? 1 : Math.max(0, 1 - (h - TORO_END) / 0.6)) : 0) - this.glow) * Math.min(1, dt * 0.8);
    if (!on && this.glow < 0.01) {
      if (this.baseMesh.visible) { for (const it of this.items) it.alive = false; this.baseMesh.visible = this.shadeMesh.visible = this.glowMesh.visible = false; for (const l of this.lights) l.x = l.z = 1e6; }
      return;
    }
    this.baseMesh.visible = this.shadeMesh.visible = this.glowMesh.visible = true;
    const R = this.R;
    if (on) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        const it = this.items.find((x) => !x.alive);
        if (it) { it.alive = true; it.s = this.s0; it.off = (Math.random() - 0.5) * 6; it.v = 0.42 + Math.random() * 0.16; it.ph = Math.random() * 6; }
        this.spawnT = 3.2 + Math.random() * 2;
      }
    }
    const m = this._m, q = this._q, p = this._p, e = this._e;
    let li = 0;
    this.items.forEach((it, i) => {
      if (!it.alive) { this.baseMesh.setMatrixAt(i, m.makeScale(0, 0, 0)); this.shadeMesh.setMatrixAt(i, m); this.glowMesh.setMatrixAt(i, m); return; }
      it.s += it.v * dt;
      if (it.s > this.s0 + 300 || it.s > R.poly.length - 5) { it.alive = false; return; }
      const a = R.poly.at(it.s);
      const off = Math.max(-R.half + 1.2, Math.min(R.half - 1.2, it.off + Math.sin(tSec * 0.23 + it.ph) * 0.8));
      it.x = a.x - a.tz * off; it.z = a.z + a.tx * off;
      const y = R.poly.sampleArray(R.water, it.s) + 0.02 + Math.sin(tSec * 1.3 + it.ph) * 0.015;
      p.set(it.x, y, it.z);
      q.setFromEuler(e.set(Math.sin(tSec * 0.9 + it.ph) * 0.04, tSec * 0.05 + it.ph, Math.cos(tSec * 1.1 + it.ph) * 0.04));
      m.compose(p, q, this._s);
      this.baseMesh.setMatrixAt(i, m);
      this.shadeMesh.setMatrixAt(i, m.compose(p.set(it.x, y + 0.06, it.z), q, this._s));
      this.glowMesh.setMatrixAt(i, m.compose(p.set(it.x, y + 0.01, it.z), q.identity(), this._s));
      if (i % 6 === 0 && li < this.lights.length) { const l = this.lights[li++]; l.x = it.x; l.y = y + 0.5; l.z = it.z; }
    });
    for (; li < this.lights.length; li++) { const l = this.lights[li]; l.x = l.z = 1e6; }
    this.baseMesh.instanceMatrix.needsUpdate = this.shadeMesh.instanceMatrix.needsUpdate = this.glowMesh.instanceMatrix.needsUpdate = true;
    const flick = 0.9 + 0.1 * Math.sin(tSec * 7.3) * Math.sin(tSec * 3.1);
    this.shadeMat.color.setScalar(0.15 + this.glow * 2.4 * flick);
    this.glowMat.uniforms.uI.value = this.glow * 0.55 * flick;
  }
}
