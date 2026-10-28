import * as THREE from 'three';
import { RNG } from '../core/noise.js';
import { U } from '../env/materials.js';

// Night life: fireflies over the river and paddies, moths around lamps, and a small pool of real point lights
// that follow the lamps nearest to the player.

export class Fireflies {
  constructor(W) {
    const rng = new RNG(1717);
    const pos = [], seed = [];
    const R = W.plan.river;
    for (let i = 0; i < R.poly.pts.length; i += 2) {
      const [x, z] = R.poly.pts[i];
      if (Math.abs(x) > 760) continue;
      for (let k = 0; k < 3; k++) {
        const side = rng.sign(), d = rng.float(4, 22);
        const a = R.poly.pts[Math.min(i + 1, R.poly.pts.length - 1)];
        let nx = -(a[1] - z), nz = a[0] - x; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
        const px = x + nx * side * d, pz = z + nz * side * d;
        const y = d < 10 ? R.water[i] + rng.float(0.4, 2.5) : W.hm.sample(px, pz) + rng.float(0.3, 2.2);
        pos.push(px, y, pz); seed.push(rng.next(), rng.next(), rng.next());
      }
    }
    for (const p of W.paddies) {
      if (!rng.chance(0.45)) continue;
      for (let k = 0; k < 4; k++) {
        const px = p.x + rng.float(-p.hw, p.hw) * 1.05, pz = p.z + rng.float(-p.hd, p.hd) * 1.05;
        pos.push(px, p.y + rng.float(0.5, 1.8), pz); seed.push(rng.next(), rng.next(), rng.next());
      }
    }
    // shrine forest
    const S = W.plan.areas.shrine;
    for (let k = 0; k < 120; k++) pos.push(S.center[0] + rng.float(-30, 30), S.topH + rng.float(0.5, 4), S.center[1] + rng.float(-30, 30)), seed.push(rng.next(), rng.next(), rng.next());
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 3));
    g.computeBoundingSphere();
    this.u = { uTime: U.uTime, uOn: { value: 0 }, uScale: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u,
      vertexShader: `attribute vec3 seed; uniform float uTime, uOn, uScale; varying float vB;
        void main() {
          vec3 p = position;
          float t = uTime * (0.25 + seed.x * 0.3) + seed.y * 60.0;
          p += vec3(sin(t * 1.3) * 1.4 + sin(t * 0.37) * 2.0, sin(t * 0.9 + seed.z * 6.0) * 0.6, cos(t * 1.1) * 1.4 + cos(t * 0.29) * 2.0);
          float blink = pow(max(sin(uTime * (1.6 + seed.z * 1.4) + seed.x * 40.0), 0.0), 6.0);
          vB = blink * uOn;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = vB > 0.01 ? clamp(uScale * 26.0 / -mv.z, 1.0, 9.0) : 0.0;
        }`,
      fragmentShader: `varying float vB;
        void main() { vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vec3(0.72, 1.0, 0.28) * a * vB * 3.2, 1.0); }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    W.scene.add(this.points);
  }
  update(time, pixelRatio, h) {
    const hr = time.hour;
    const season = hr > 19.2 ? 1 - Math.max(0, (hr - 22.8) / 1.2) : hr < 2 ? Math.max(0, 0.3 - hr * 0.15) : 0;
    this.u.uOn.value = time.night * Math.max(0, Math.min(1, season));
    this.u.uScale.value = pixelRatio * (h / 900);
    this.points.visible = this.u.uOn.value > 0.01;
  }
}

export class Moths {
  constructor(W) {
    const pos = [], seed = [];
    const rng = new RNG(99);
    for (const l of W.lamps) for (let k = 0; k < 7; k++) { pos.push(l.x, l.y - 0.4, l.z); seed.push(rng.next(), rng.next(), rng.next()); }
    for (const s of W.lampSources) if (s.vending) for (let k = 0; k < 5; k++) { pos.push(s.x, s.y + 0.4, s.z); seed.push(rng.next(), rng.next(), rng.next()); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 3));
    g.computeBoundingSphere();
    this.u = { uTime: U.uTime, uOn: U.uLamps, uScale: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u,
      vertexShader: `attribute vec3 seed; uniform float uTime, uOn, uScale; varying float vA;
        void main() {
          float t = uTime * (2.0 + seed.x * 3.0) + seed.y * 30.0;
          vec3 p = position + vec3(sin(t) * 0.5 + sin(t * 2.7) * 0.2, sin(t * 1.9) * 0.3, cos(t * 1.3) * 0.5 + cos(t * 3.1) * 0.2) * (0.6 + seed.z);
          vA = uOn;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uOn > 0.05 ? clamp(uScale * 9.0 / -mv.z, 1.0, 4.0) : 0.0;
        }`,
      fragmentShader: `varying float vA; void main() { gl_FragColor = vec4(vec3(1.0, 0.95, 0.85) * vA * 0.9, 1.0); }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    W.scene.add(this.points);
  }
  update(pixelRatio, h) { this.u.uScale.value = pixelRatio * (h / 900); this.points.visible = U.uLamps.value > 0.05; }
}

export class LightPool {
  constructor(scene, W, n = 5) {
    this.W = W;
    this.lights = [];
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 16, 2);
      l.castShadow = false;
      scene.add(l);
      this.lights.push(l);
    }
    this.sources = [...W.lamps.map((l) => ({ x: l.x, y: l.y - 0.2, z: l.z, color: l.color, power: 1.0, lamp: true })), ...W.lampSources];
    this._c = new THREE.Color();
  }
  update(cam, time) {
    const lamps = U.uLamps.value, night = time.night;
    const cand = [];
    for (const s of this.sources) {
      const d = (s.x - cam.x) ** 2 + (s.z - cam.z) ** 2;
      if (d < 70 * 70) cand.push([d, s]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i];
      const c = cand[i];
      if (!c || night < 0.02) { l.intensity = 0; continue; }
      const s = c[1];
      l.position.set(s.x, s.y, s.z);
      l.color.setHex(s.color);
      const k = s.lamp ? lamps : night;
      const fade = 1 - Math.min(1, Math.max(0, (Math.sqrt(c[0]) - 45) / 25));
      l.intensity = (s.lamp ? 7 : 2.2) * s.power * k * fade;
      l.distance = s.lamp ? 15 : 6;
    }
  }
}
