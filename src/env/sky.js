import * as THREE from 'three';
import { canvas, tex } from './textures.js';
import { mulberry32 } from '../core/noise.js';

// Sky dome drawn first around the camera: gradient, sun & moon, procedural stars, milky way,
// a drifting cloud layer, plus towering summer cumulus billboards on the horizon.

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w * 0.99999;
}`;
const SKY_FRAG = /* glsl */`
uniform vec3 uSunDir, uMoonDir, uZenith, uHorizon, uGround, uSunGlow, uSunDisc, uCloudLit, uCloudDark;
uniform float uStars, uTime, uCloudCover, uMoonLight, uBright, uMetT, uMetI;
uniform vec3 uMetA, uMetB;
varying vec3 vDir;
float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec3 hash33(vec3 p3) { p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float hz = clamp(h, 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(hz, 0.5));
  col = mix(col, uHorizon, exp(-hz * 14.0) * 0.45);
  if (h < 0.0) col = mix(uHorizon, uGround, clamp(-h * 5.0, 0.0, 1.0));
  float sd = dot(d, uSunDir);
  float sdc = max(sd, 0.0);
  col += uSunGlow * (pow(sdc, 5.0) * 0.32 + pow(sdc, 42.0) * 0.55) * (1.0 - 0.45 * hz);
  col += uSunDisc * smoothstep(0.99955, 0.99972, sd);
  if (uStars > 0.001) {
    vec3 sp = d * 230.0;
    vec3 cell = floor(sp);
    float hs = hash13(cell);
    if (hs > 0.9925) {
      vec3 jit = hash33(cell) * 0.6 + 0.2;
      float dd = length(fract(sp) - jit);
      float mag = (hs - 0.9925) / 0.0075;
      float tw = 0.7 + 0.3 * sin(uTime * (1.5 + mag * 4.0) + hs * 300.0);
      vec3 sc = mix(vec3(1.0, 0.85, 0.7), vec3(0.8, 0.88, 1.0), hash13(cell + 7.0));
      col += sc * smoothstep(0.13, 0.0, dd) * (0.35 + mag * mag * 2.2) * tw * uStars * smoothstep(0.02, 0.2, h);
    }
    vec3 mwN = normalize(vec3(0.42, 0.5, -0.76));
    float mw = dot(d, mwN);
    float band = exp(-mw * mw * 26.0);
    // noise in the plane of the galaxy, so there is no seam where an angle would wrap around
    vec3 e1 = normalize(cross(mwN, vec3(0.0, 1.0, 0.0))), e2 = cross(mwN, e1);
    float mwn = fbm(vec2(dot(d, e1), dot(d, e2)) * 4.0 + mw * 4.0);
    col += vec3(0.5, 0.56, 0.78) * band * smoothstep(0.35, 0.8, mwn) * 0.22 * uStars * smoothstep(0.05, 0.4, h);
    // a Perseid: the head runs from A to B along a great circle, the tail fades out behind it
    if (uMetT >= 0.0) {
      vec3 mh = normalize(mix(uMetA, uMetB, uMetT));
      vec3 mt = normalize(mix(uMetA, uMetB, max(0.0, uMetT - 0.4)));
      vec3 ab = mh - mt;
      float k = clamp(dot(d - mt, ab) / max(dot(ab, ab), 1e-7), 0.0, 1.0);
      float dist = length(d - (mt + ab * k));
      col += vec3(0.85, 0.92, 1.0) * exp(-dist * dist / 2.2e-6) * k * k * sin(3.14159 * uMetT) * uMetI * uStars;
    }
  }
  float md = dot(d, uMoonDir);
  float moon = smoothstep(0.99972, 0.99984, md);
  float shade = 0.75 + 0.25 * smoothstep(-0.02, 0.02, dot(d - uMoonDir, normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)))));
  col = mix(col, vec3(1.0, 0.97, 0.88) * 1.25 * shade, moon * uMoonLight);
  col += vec3(0.45, 0.55, 0.8) * (pow(max(md, 0.0), 300.0) * 0.35 + pow(max(md, 0.0), 30.0) * 0.04) * uMoonLight;
  if (h > 0.0) {
    vec2 cp = d.xz / (h + 0.1) * 1.4 + vec2(uTime * 0.0045, uTime * 0.0018);
    float n = fbm(cp * 0.8);
    float cov = smoothstep(1.0 - uCloudCover, 1.12 - uCloudCover + 0.18, n);
    float thick = smoothstep(0.45, 0.85, n);
    vec3 cc = mix(uCloudLit, uCloudDark, thick * 0.55);
    cc += uSunGlow * pow(sdc, 7.0) * 0.6 * (1.0 - thick);
    col = mix(col, cc, cov * smoothstep(0.0, 0.22, h) * 0.85);
  }
  gl_FragColor = vec4(col * uBright, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const CLOUD_FRAG = /* glsl */`
uniform sampler2D map; uniform vec3 uLit, uDark, uHorizon, uSunGlow; uniform float uOpacity, uHaze, uBright;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(map, vUv);
  vec3 c = mix(uDark, uLit, t.r) + uSunGlow * t.g * 0.35;
  c = mix(c, uHorizon, uHaze * (1.0 - vUv.y * 0.6));
  gl_FragColor = vec4(c * uBright, t.a * uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const CLOUD_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.99998; }`;

function cumulusTexture(seed) {
  const [c, x] = canvas(512, 512);
  const R = mulberry32(seed);
  // build puffs: wide base, cauliflower tower
  const puffs = [];
  const baseY = 470;
  for (let i = 0; i < 26; i++) puffs.push([60 + R() * 392, baseY - R() * 50, 30 + R() * 45]);
  let cx = 256, cy = baseY - 60, r = 95;
  for (let i = 0; i < 18; i++) {
    puffs.push([cx + (R() - 0.5) * r * 1.6, cy, r * (0.6 + R() * 0.5)]);
    cy -= r * (0.25 + R() * 0.2); r *= 0.93; cx += (R() - 0.5) * 30;
    if (cy < 70) break;
  }
  // lighting buffer: R = lit amount (top-left bright), G = rim, A = density
  const img = x.createImageData(512, 512);
  const dens = new Float32Array(512 * 512);
  for (const [px, py, pr] of puffs) {
    const x0 = Math.max(0, Math.floor(px - pr)), x1 = Math.min(511, Math.ceil(px + pr));
    const y0 = Math.max(0, Math.floor(py - pr)), y1 = Math.min(511, Math.ceil(py + pr));
    for (let y = y0; y <= y1; y++) for (let xx = x0; xx <= x1; xx++) {
      const d = Math.hypot(xx - px, y - py) / pr;
      if (d < 1) { const v = 1 - d * d; const i = y * 512 + xx; dens[i] = Math.max(dens[i], v); }
    }
  }
  for (let y = 0; y < 512; y++) for (let xx = 0; xx < 512; xx++) {
    const i = y * 512 + xx;
    const d = dens[i];
    if (d <= 0) continue;
    // light from above: sample density a bit above
    const up = y > 24 ? dens[(y - 24) * 512 + xx] : 0;
    const lit = Math.min(1, Math.max(0, 1.05 - up * 0.9 - (y / 512) * 0.45));
    const edge = Math.max(0, 1 - d * 2.2);
    img.data[i * 4] = lit * 255;
    img.data[i * 4 + 1] = edge * 255;
    img.data[i * 4 + 2] = 0;
    img.data[i * 4 + 3] = Math.min(1, d * 2.6) * 255 * Math.min(1, (500 - y) / 40);
  }
  x.putImageData(img, 0, 0);
  return tex(c, { clamp: true, linear: true });
}

export class Sky {
  constructor() {
    this.group = new THREE.Group();
    this._g = new THREE.Color();
    this.uniforms = {
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
      uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGround: { value: new THREE.Color() },
      uSunGlow: { value: new THREE.Color() }, uSunDisc: { value: new THREE.Color() },
      uCloudLit: { value: new THREE.Color() }, uCloudDark: { value: new THREE.Color() },
      uStars: { value: 0 }, uTime: { value: 0 }, uCloudCover: { value: 0.42 }, uMoonLight: { value: 1 }, uBright: { value: 1.25 },
      uMetT: { value: -1 }, uMetI: { value: 0 }, uMetA: { value: new THREE.Vector3() }, uMetB: { value: new THREE.Vector3() },
    };
    this.meteor = { t: -1, dur: 1, next: 20 };
    const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(100, 48, 24), mat);
    this.dome.renderOrder = -100;
    this.dome.frustumCulled = false;
    this.group.add(this.dome);

    // horizon cumulus (nyuudougumo)
    this.clouds = [];
    const R = mulberry32(5);
    const azs = [0.35, 1.25, 2.1, 2.95, 3.9, 4.6, 5.5];
    azs.forEach((az, i) => {
      const t = cumulusTexture(30 + i);
      const u = {
        map: { value: t }, uLit: { value: new THREE.Color() }, uDark: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
        uSunGlow: { value: new THREE.Color() }, uOpacity: { value: 1 }, uHaze: { value: 0.35 + R() * 0.2 }, uBright: { value: 1.25 },
      };
      const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG, transparent: true, depthWrite: false, depthTest: false, fog: false });
      const size = 26 + R() * 18;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.1, size), m);
      const el = 0.05 + R() * 0.04;
      const dist = 92;
      mesh.position.set(Math.sin(az) * dist, Math.sin(el) * dist + size * 0.38 - 2, -Math.cos(az) * dist);
      mesh.lookAt(0, mesh.position.y, 0);
      mesh.renderOrder = -99;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.clouds.push({ mesh, u, az });
    });
  }
  update(camera, time, tSec, cloud = 0, flash = 0) {
    this.group.position.copy(camera.position);
    const s = time.s, u = this.uniforms;
    u.uSunDir.value.copy(time.sunDir);
    u.uMoonDir.value.copy(time.moonDir);
    u.uZenith.value.copy(s.zen);
    u.uHorizon.value.copy(s.hor);
    u.uGround.value.copy(s.fog).multiplyScalar(0.8);
    const day = time.dayLight;
    u.uSunGlow.value.copy(s.haze).multiplyScalar(0.25 + 0.75 * smooth01((time.sunSin + 0.12) / 0.2));
    u.uSunDisc.value.copy(s.sun).multiplyScalar(26 * smooth01((time.sunSin + 0.02) / 0.05));
    u.uCloudLit.value.copy(s.cl);
    u.uCloudDark.value.copy(s.cd);
    u.uStars.value = s.stars;
    u.uTime.value = tSec;
    u.uMoonLight.value = smooth01((time.moonDir.y + 0.02) / 0.06) * (0.35 + 0.65 * (1 - day)) * (1 - cloud);
    u.uCloudCover.value = 0.42 + 0.56 * cloud;
    if (cloud > 0.001) {
      for (const c of [u.uZenith.value, u.uHorizon.value, u.uCloudLit.value, u.uCloudDark.value]) {
        const l = c.r * 0.3 + c.g * 0.55 + c.b * 0.15;
        c.lerp(this._g.setRGB(l * 0.62, l * 0.66, l * 0.72), cloud * 0.85);
      }
      u.uCloudDark.value.multiplyScalar(1 - 0.5 * cloud);
      u.uSunDisc.value.multiplyScalar(1 - cloud);
      u.uSunGlow.value.multiplyScalar(1 - 0.85 * cloud);
      u.uStars.value *= 1 - cloud;
    }
    u.uBright.value = 1.25 + flash * 1.2;
    this.updateMeteor(camera, tSec, u.uStars.value);
    for (const c of this.clouds) {
      c.u.uLit.value.copy(s.cl).multiplyScalar(1.05);
      c.u.uDark.value.copy(s.cd).lerp(s.hor, 0.25);
      c.u.uHorizon.value.copy(s.hor);
      // clouds facing the sun glow at sunset
      const az = c.az, sx = Math.sin(az), sz = -Math.cos(az);
      const facing = Math.max(0, sx * time.sunDir.x + sz * time.sunDir.z);
      c.u.uSunGlow.value.copy(s.haze).multiplyScalar(facing * (1 - day * 0.7));
      c.u.uOpacity.value = (0.55 + 0.45 * Math.max(day, 0.25)) * (1 - cloud * 0.9);
    }
  }
}
Sky.prototype.updateMeteor = function (camera, tSec, stars) {
  const m = this.meteor, u = this.uniforms;
  const dt = Math.min(0.1, Math.max(0, tSec - (this._lastT ?? tSec)));
  this._lastT = tSec;
  if (m.t >= 0) {
    m.t += dt / m.dur;
    if (m.t >= 1) { m.t = -1; u.uMetT.value = -1; return; }
    u.uMetT.value = m.t;
    return;
  }
  m.next -= dt;
  if (m.next > 0 || stars < 0.6) return;
  m.next = 18 + Math.random() * 50;
  // streaks radiate away from Perseus, low in the north-east
  const az = Math.random() * Math.PI * 2, el = 0.6 + Math.random() * 0.6;
  const a = u.uMetA.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  const rad = new THREE.Vector3(0.55, 0.35, -0.75).normalize();
  const dir = a.clone().sub(rad).normalize();
  const len = 0.18 + Math.random() * 0.3;
  u.uMetB.value.copy(a).addScaledVector(dir, len).normalize();
  u.uMetI.value = 2.5 + Math.random() * 4;
  m.dur = 0.45 + Math.random() * 0.7;
  m.t = 0;
  // did the player see it?
  const f = camera.getWorldDirection(this._f || (this._f = new THREE.Vector3()));
  const mid = a.clone().add(u.uMetB.value).normalize();
  if (f.dot(mid) > 0.8) this.onMeteor?.();
};
function smooth01(x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }
