import * as THREE from 'three';

// Summer fireworks over the river every night at 20:00, and hand-held senko-hanabi sparklers.

const MAXP = 9000;
const PALETTE = [
  [1.0, 0.32, 0.22], [1.0, 0.78, 0.3], [0.45, 1.0, 0.5], [0.4, 0.62, 1.0], [1.0, 0.5, 0.85], [0.9, 0.95, 1.0], [1.0, 0.6, 0.15],
];

export class Fireworks {
  constructor(scene, audio, origin) {
    this.audio = audio;
    this.origin = origin; // {x, y, z} launch area on the river
    this.pos = new Float32Array(MAXP * 3);
    this.col = new Float32Array(MAXP * 3);
    this.size = new Float32Array(MAXP);
    this.alpha = new Float32Array(MAXP);
    this.vel = new Float32Array(MAXP * 3);
    this.life = new Float32Array(MAXP);
    this.max = new Float32Array(MAXP);
    this.kind = new Uint8Array(MAXP); // 0 spark, 1 trail-dropping willow, 2 crackle, 3 rocket
    this.next = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.uScale = { value: 1 };
    const m = new THREE.ShaderMaterial({
      uniforms: { uScale: this.uScale },
      vertexShader: `attribute float size; attribute float alpha; varying vec3 vC; varying float vA; uniform float uScale;
        void main() { vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = alpha > 0.002 ? clamp(size * uScale * 300.0 / -mv.z, 1.0, 28.0) : 0.0; }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC * a * vA * 4.0, 1.0); }`,
      vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.flash = new THREE.PointLight(0xffffff, 0, 1200, 2);
    this.flash.position.set(origin.x, origin.y + 100, origin.z);
    scene.add(this.flash);
    this.flashI = 0;
    this.show = null;
    this.rockets = [];
    this.pending = [];
    this.alive = 0;
  }
  start(duration = 150) { this.show = { t: 0, dur: duration, nextLaunch: 1.5 }; }
  get running() { return !!this.show || this.alive > 0; }
  emit(x, y, z, vx, vy, vz, r, g, b, life, size, kind) {
    const i = this.next; this.next = (this.next + 1) % MAXP;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.col[i3] = r; this.col[i3 + 1] = g; this.col[i3 + 2] = b;
    this.life[i] = life; this.max[i] = life; this.size[i] = size; this.kind[i] = kind; this.alpha[i] = 1;
  }
  launch() {
    const o = this.origin;
    const x = o.x + (Math.random() - 0.5) * 120, z = o.z + (Math.random() - 0.5) * 40;
    const h = 90 + Math.random() * 70;
    const type = ['kiku', 'botan', 'kamuro', 'senrin', 'ring', 'kiku', 'double'][Math.floor(Math.random() * 7)];
    this.rockets.push({ x, y: o.y, z, vy: Math.sqrt(2 * 9.8 * h) * 1.02, type, t: 0 });
    this.audio.fwLaunch?.(x, o.y, z);
  }
  burst(r) {
    const n = r.type === 'senrin' ? 70 : r.type === 'kamuro' ? 140 : 180;
    const c1 = PALETTE[Math.floor(Math.random() * PALETTE.length)], c2 = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    const sp = r.type === 'kamuro' ? 17 : 24 + Math.random() * 6;
    for (let k = 0; k < n; k++) {
      // even directions on a sphere
      const u = (k + 0.5) / n, th = Math.acos(1 - 2 * u), ph = k * 2.39996;
      let dx = Math.sin(th) * Math.cos(ph), dy = Math.cos(th), dz = Math.sin(th) * Math.sin(ph);
      if (r.type === 'ring') { dx = Math.cos(ph); dy = Math.sin(ph) * 0.95; dz = 0.25 * Math.sin(ph * 3); }
      const s = sp * (0.92 + Math.random() * 0.16);
      const c = r.type === 'kamuro' ? [1.0, 0.72, 0.3] : k % 3 === 0 && r.type === 'double' ? c2 : c1;
      const kind = r.type === 'kamuro' ? 1 : r.type === 'senrin' ? 2 : 0;
      this.emit(r.x, r.y, r.z, dx * s, dy * s, dz * s, c[0], c[1], c[2], r.type === 'kamuro' ? 4.2 : 2.4 + Math.random() * 0.6, r.type === 'kamuro' ? 0.9 : 1.2, kind);
      if (r.type === 'double' && k % 2 === 0) this.emit(r.x, r.y, r.z, dx * s * 0.5, dy * s * 0.5, dz * s * 0.5, c2[0], c2[1], c2[2], 2.0, 1.0, 0);
    }
    this.flash.position.set(r.x, r.y, r.z);
    this.flash.color.setRGB(c1[0], c1[1], c1[2]);
    this.flashI = r.type === 'senrin' ? 1.4 : 2.6;
    this.audio.fwBurst?.(r.x, r.y, r.z, r.type);
  }
  update(dt, cam, pixelRatio, h) {
    this.uScale.value = pixelRatio * (h / 900);
    if (this.show) {
      const s = this.show;
      s.t += dt;
      s.nextLaunch -= dt;
      if (s.nextLaunch <= 0 && s.t < s.dur) {
        const finale = s.t > s.dur - 18;
        const n = finale ? 2 + Math.floor(Math.random() * 3) : 1;
        for (let i = 0; i < n; i++) this.launch();
        s.nextLaunch = finale ? 0.35 + Math.random() * 0.4 : 1.2 + Math.random() * 2.6;
      }
      if (s.t > s.dur + 6) this.show = null;
    }
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.t += dt;
      r.vy -= 9.8 * dt;
      r.y += r.vy * dt;
      this.emit(r.x + (Math.random() - 0.5) * 0.3, r.y, r.z, (Math.random() - 0.5) * 1.5, -2, (Math.random() - 0.5) * 1.5, 1.0, 0.7, 0.4, 0.5, 0.5, 0);
      if (r.vy <= 2) { this.burst(r); this.rockets.splice(i, 1); }
    }
    let alive = 0;
    const drag = Math.exp(-dt * 1.4);
    for (let i = 0; i < MAXP; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      alive++;
      const i3 = i * 3;
      this.life[i] -= dt;
      const k = this.kind[i];
      const d = k === 1 ? Math.exp(-dt * 2.4) : drag;
      this.vel[i3] *= d; this.vel[i3 + 1] = this.vel[i3 + 1] * d - (k === 1 ? 3.5 : 6.0) * dt; this.vel[i3 + 2] *= d;
      this.pos[i3] += this.vel[i3] * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * dt; this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const t = this.life[i] / this.max[i];
      let a = Math.min(1, t * 2.2);
      if (k === 2) a *= t < 0.5 ? (Math.random() < 0.5 ? 1.6 : 0.1) : 0.7;
      if (k === 0 && t < 0.35) a *= 0.6 + 0.4 * Math.random();
      this.alpha[i] = Math.max(0, a);
      // trailing embers for willows
      if (k === 1 && Math.random() < dt * 9) this.emit(this.pos[i3], this.pos[i3 + 1], this.pos[i3 + 2], 0, -0.6, 0, 0.9, 0.55, 0.2, 1.1, 0.5, 3);
    }
    this.alive = alive + this.rockets.length;
    this.flashI *= Math.exp(-dt * 5);
    this.flash.intensity = this.flashI * 5200;
    this.points.visible = this.alive > 0;
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.alpha.needsUpdate = true;
    g.attributes.color.needsUpdate = true; g.attributes.size.needsUpdate = true;
  }
}

// Senko-hanabi held in the hand: bud, peony, pine needles, falling willow — then the little ball drops.
export class Sparkler {
  constructor(camera, scene, audio) {
    this.camera = camera; this.audio = audio;
    this.group = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.24, 5), new THREE.MeshBasicMaterial({ color: 0x8a3a5a }));
    stick.position.set(0, 0.12, 0);
    this.ballMat = new THREE.MeshBasicMaterial({ color: 0xffa040 });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), this.ballMat);
    this.group.add(stick, this.ball);
    this.n = 400;
    this.sp = new Float32Array(this.n * 3); this.sv = new Float32Array(this.n * 3); this.sl = new Float32Array(this.n); this.sa = new Float32Array(this.n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.sp, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.sa, 1).setUsage(THREE.DynamicDrawUsage));
    this.uScale = { value: 1 };
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { uScale: this.uScale },
      vertexShader: `attribute float alpha; varying float vA; uniform float uScale; void main() { vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = alpha > 0.01 ? clamp(uScale * 3.0 / -mv.z, 1.5, 7.0) : 0.0; }`,
      fragmentShader: `varying float vA; void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(1.0, 0.62, 0.25) * smoothstep(0.5, 0.0, d) * vA * 5.0, 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.points.frustumCulled = false;
    this.group.visible = false; this.points.visible = false;
    scene.add(this.group, this.points);
    this.light = new THREE.PointLight(0xffa050, 0, 6, 2);
    scene.add(this.light);
    this.t = -1;
    this.k = 0;
    this._v = new THREE.Vector3(); this._q = new THREE.Quaternion();
  }
  get active() { return this.t >= 0; }
  light_() { this.t = 0; this.group.visible = true; this.points.visible = true; this.ball.visible = true; this.audio.sparklerStart?.(); }
  update(dt, pixelRatio, h) {
    this.uScale.value = pixelRatio * (h / 900) * 60;
    if (this.t < 0) { this.light.intensity = 0; return; }
    this.t += dt;
    const T = this.t;
    // hold the stick in front of the camera, slightly to the right and down
    const cam = this.camera;
    this._v.set(0.1, -0.06, -0.5).applyQuaternion(cam.quaternion).add(cam.position);
    this.group.position.copy(this._v);
    this.group.quaternion.copy(cam.quaternion);
    this.group.rotateX(Math.PI);
    const tip = this._v.clone().add(new THREE.Vector3(0, -0.24 + Math.sin(T * 2) * 0.003, 0));
    this.ball.position.set(0, 0.24 + Math.sin(T * 3) * 0.002, 0);
    const phase = T < 3 ? 0 : T < 9 ? 1 : T < 17 ? 2 : T < 23 ? 3 : 4;
    const rate = [0, 90, 55, 25, 0][phase];
    const ballS = Math.min(1, T / 3) * (phase === 4 ? 0 : 1);
    this.ball.scale.setScalar(0.4 + ballS * 0.9);
    this.ballMat.color.setRGB(4, 1.6 + 0.6 * Math.random(), 0.4);
    let emit = rate * dt;
    while (emit > 0) {
      if (Math.random() < emit) {
        const i = this.k; this.k = (this.k + 1) % this.n;
        const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * 1.2;
        const s = phase === 1 ? 0.8 + Math.random() * 0.6 : phase === 2 ? 0.5 + Math.random() * 0.5 : 0.15 + Math.random() * 0.2;
        this.sp[i * 3] = tip.x; this.sp[i * 3 + 1] = tip.y; this.sp[i * 3 + 2] = tip.z;
        this.sv[i * 3] = Math.cos(a) * s * Math.cos(e); this.sv[i * 3 + 1] = Math.sin(e) * s - (phase === 3 ? 0.6 : 0); this.sv[i * 3 + 2] = Math.sin(a) * s * Math.cos(e);
        this.sl[i] = phase === 3 ? 0.5 : 0.18 + Math.random() * 0.15;
        this.sa[i] = 1;
      }
      emit -= 1;
    }
    for (let i = 0; i < this.n; i++) {
      if (this.sl[i] <= 0) { this.sa[i] = 0; continue; }
      this.sl[i] -= dt;
      this.sv[i * 3 + 1] -= 2.5 * dt;
      this.sp[i * 3] += this.sv[i * 3] * dt; this.sp[i * 3 + 1] += this.sv[i * 3 + 1] * dt; this.sp[i * 3 + 2] += this.sv[i * 3 + 2] * dt;
      // pine-needle branching flicker
      this.sa[i] = phase === 2 && Math.random() < 0.3 ? 1.6 : Math.min(1, this.sl[i] * 6);
    }
    const g = this.points.geometry; g.attributes.position.needsUpdate = true; g.attributes.alpha.needsUpdate = true;
    this.light.position.copy(tip);
    this.light.intensity = phase < 4 ? (0.4 + ballS * 0.6) * (phase === 1 ? 1.6 : 1) * (0.8 + Math.random() * 0.4) : 0;
    this.audio.sparklerUpdate?.(phase, dt);
    if (phase === 4) {
      this.ball.visible = false;
      if (T > 26) { this.t = -1; this.group.visible = false; this.points.visible = false; this.audio.sparklerStop?.(); }
    }
  }
}
