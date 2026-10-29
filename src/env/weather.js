import * as THREE from 'three';
import { U } from './materials.js';

// Summer evening showers (yuudachi): the sky darkens, thunder rolls over the hills, warm rain falls for a couple
// of minutes and then the frogs and higurashi come out.

const N = 6000;

export class Weather {
  constructor(scene, audio) {
    this.audio = audio;
    this.cloud = 0; this.rain = 0; this.flash = 0; this.wet = 0;
    this.state = null;
    this.rolledDay = null; this.planHour = null;
    const pos = new Float32Array(N * 2 * 3), seed = new Float32Array(N * 2 * 3), end = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const a = Math.random(), b = Math.random(), c = Math.random();
      for (let k = 0; k < 2; k++) { seed.set([a, b, c], (i * 2 + k) * 3); end[i * 2 + k] = k; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 3));
    g.setAttribute('end', new THREE.BufferAttribute(end, 1));
    this.u = { uCam: { value: new THREE.Vector3() }, uTime: U.uTime, uRain: { value: 0 }, uLight: { value: 1 }, uWind: U.uWind };
    const m = new THREE.ShaderMaterial({
      uniforms: this.u,
      vertexShader: /* glsl */`
        attribute vec3 seed; attribute float end;
        uniform vec3 uCam; uniform float uTime, uRain; uniform vec3 uWind;
        varying float vA;
        void main() {
          vec3 box = vec3(44.0, 26.0, 44.0);
          float sp = 10.0 + seed.x * 3.0;
          vec3 p = seed * box;
          p.y = mod(p.y - uTime * sp, box.y);
          float slant = (box.y - p.y) * 0.06;
          vec3 w = vec3(mod(p.x - uCam.x + uWind.x * slant, box.x) - box.x * 0.5, p.y - box.y * 0.45, mod(p.z - uCam.z + uWind.z * slant, box.z) - box.z * 0.5);
          vec3 wp = uCam + w + end * vec3(-uWind.x * 0.05, 0.7, -uWind.z * 0.05);
          vA = step(seed.z, uRain) * (1.0 - smoothstep(14.0, 22.0, length(w.xz)));
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`,
      fragmentShader: `uniform float uLight; varying float vA; void main() { gl_FragColor = vec4(vec3(0.72, 0.76, 0.82) * uLight, vA * 0.32); }`,
      transparent: true, depthWrite: false,
    });
    this.lines = new THREE.LineSegments(g, m);
    this.lines.frustumCulled = false;
    this.lines.visible = false;
    scene.add(this.lines);
  }
  start(dur = 150) { if (!this.state) this.state = { t: 0, dur, nextThunder: 8 + Math.random() * 6 }; }
  update(dt, time, cam) {
    if (time.day !== this.rolledDay) {
      this.rolledDay = time.day;
      this.planHour = Math.random() < 0.42 ? 15.8 + Math.random() * 2.0 : null;
      if (time.day === 0 && this.planHour !== null && this.planHour < 16.6) this.planHour = 16.6 + Math.random();
    }
    if (this.planHour !== null && !this.state && time.hour >= this.planHour && time.hour < this.planHour + 1.5) { this.planHour = null; this.start(); }
    let cloudT = 0, rainT = 0;
    const S = this.state;
    if (S) {
      S.t += dt;
      const t = S.t, d = S.dur;
      cloudT = Math.min(1, t / 22) * (1 - Math.max(0, Math.min(1, (t - (d - 25)) / 25)));
      rainT = Math.max(0, Math.min(1, (t - 16) / 10)) * (1 - Math.max(0, Math.min(1, (t - (d - 40)) / 18)));
      S.nextThunder -= dt;
      if (S.nextThunder <= 0 && t < d - 30) {
        S.nextThunder = 10 + Math.random() * 22;
        const dist = 600 + Math.random() * 2500;
        this.flash = Math.min(1, 1600 / dist);
        this.audio.thunder?.(dist);
      }
      if (t > d) this.state = null;
    }
    const k = 1 - Math.exp(-dt * 0.8);
    this.cloud += (cloudT - this.cloud) * k;
    this.rain += (rainT - this.rain) * k;
    this.flash *= Math.exp(-dt * 7);
    this.wet = Math.max(this.rain, this.wet - dt / 90);
    U.uWet.value = this.wet;
    this.u.uRain.value = this.rain;
    this.u.uCam.value.copy(cam);
    this.u.uLight.value = 0.35 + 0.65 * time.dayLight + this.flash;
    this.lines.visible = this.rain > 0.01;
  }
}
