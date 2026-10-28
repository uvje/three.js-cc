import * as THREE from 'three';
import { mulberry32 } from '../core/noise.js';
import { patch, U } from '../env/materials.js';
import { WH, CELL, N } from './terrain.js';
import { THETA, CU, CV, IU0, IU1, IV0, IV1 } from './planner.js';

// GPU grass and rice: instanced clumps in tiles that follow the camera. Placement, height and density come from
// world textures, so a clump stays fixed in the world while tiles are recycled.

function bladeClump(blades, rnd, o) {
  const pos = [], aT = [], col = [], idx = [];
  for (let b = 0; b < blades; b++) {
    const a = rnd() * Math.PI * 2;
    const ox = (rnd() - 0.5) * o.spread, oz = (rnd() - 0.5) * o.spread;
    const w = o.width * (0.7 + rnd() * 0.6);
    const lean = (o.lean || 0.25) * (0.4 + rnd());
    const h = 0.75 + rnd() * 0.5;
    const ca = Math.cos(a), sa = Math.sin(a);
    const lx = Math.cos(a + 1.57) * lean, lz = Math.sin(a + 1.57) * lean;
    const base = pos.length / 3;
    const ring = [[-w / 2, 0, 0], [w / 2, 0, 0], [-w * 0.32, 0.55, 0.55], [w * 0.32, 0.55, 0.55], [0, 1, 1]];
    for (const [x, t] of ring.map((r) => [r[0], r[1]])) {
      const y = t * h;
      pos.push(ox + ca * x + lx * t * t, y, oz + sa * x + lz * t * t);
      aT.push(t);
      col.push(1, 1, 1);
    }
    idx.push(base, base + 1, base + 3, base, base + 3, base + 2, base + 2, base + 3, base + 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

function instGeo(base, offs, rnds, count) {
  const g = new THREE.InstancedBufferGeometry();
  for (const k of ['position', 'aT', 'color']) g.setAttribute(k, base.attributes[k]);
  g.setIndex(base.index);
  g.setAttribute('aOff', offs);
  g.setAttribute('aRnd', rnds);
  g.instanceCount = count;
  return g;
}

const COMMON_VERT = /* glsl */`
attribute vec3 aOff; attribute vec3 aRnd; attribute float aT;
uniform sampler2D uHeightTex; uniform sampler2D uMaskTex; uniform sampler2D uGroundTex;
uniform vec3 uCamPos; uniform vec2 uFade; uniform float uDens;
varying float vT;
const float WH_ = ${WH.toFixed(1)}; const float CELL_ = ${CELL.toFixed(1)}; const float NH_ = ${N.toFixed(1)}; const float NM_ = ${(N - 1).toFixed(1)};
`;

function layerMaterial(kind, tex) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const shared = {
    uHeightTex: { value: tex.height }, uMaskTex: { value: tex.mask }, uGroundTex: { value: tex.ground }, uCells: { value: tex.cells },
    uCamPos: { value: new THREE.Vector3() }, uFade: { value: new THREE.Vector2(30, 40) }, uDens: { value: 1 },
    uCS: { value: new THREE.Vector2(Math.cos(THETA), Math.sin(THETA)) },
    uCellInfo: { value: new THREE.Vector4(IU0, IV0, IU1 - IU0, IV1 - IV0) },
  };
  patch(mat, {
    key: kind,
    frag: (sh) => {
      Object.assign(sh.uniforms, shared, { uSunCol: U.uSunCol });
      let place;
      if (kind === 'grass') {
        place = /* glsl */`
          vec2 base = vec2(modelMatrix[3][0], modelMatrix[3][2]) + aOff.xy;
          vec2 muv = ((base + WH_) / CELL_ + 0.5) / NM_;
          vec4 mk = texture2D(uMaskTex, muv);
          float dens = mk.r * uDens;
          float hgt = 0.22 + 0.62 * mk.b;
          float isOn = step(aRnd.y, dens);
          vec3 gcol = texture2D(uGroundTex, muv).rgb;
          vec3 bladeCol = mix(vec3(0.16, 0.27, 0.07), gcol, 0.55) * (0.78 + 0.44 * aRnd.z);
          if (mk.a > 0.5 && aRnd.z > 0.93) bladeCol = mix(bladeCol, aRnd.x > 1.0 ? vec3(0.95, 0.92, 0.85) : vec3(0.9, 0.75, 0.15), step(0.85, aT));`;
      } else {
        place = /* glsl */`
          vec2 wo = vec2(modelMatrix[3][0], modelMatrix[3][2]);
          vec2 tg = vec2(wo.x * uCS.x + wo.y * uCS.y, -wo.x * uCS.y + wo.y * uCS.x);
          vec2 g = tg + aOff.xy;
          vec2 cs = vec2(${CU.toFixed(1)}, ${CV.toFixed(1)});
          vec2 cell = floor(g / cs);
          vec2 loc = g - cell * cs;
          float mL = mod(cell.x, 4.0) < 0.5 ? 2.25 : 0.62;
          float mR = mod(cell.x + 1.0, 4.0) < 0.5 ? 2.25 : 0.62;
          float mT = mod(cell.y, 2.0) < 0.5 ? 2.25 : 0.62;
          float mB = mod(cell.y + 1.0, 2.0) < 0.5 ? 2.25 : 0.62;
          float inside = step(mL, loc.x) * step(loc.x, cs.x - mR) * step(mT, loc.y) * step(loc.y, cs.y - mB);
          float rice = texture2D(uCells, (cell - uCellInfo.xy + 0.5) / uCellInfo.zw).r;
          vec2 base = vec2(g.x * uCS.x - g.y * uCS.y, g.x * uCS.y + g.y * uCS.x);
          float isOn = inside * step(0.5, rice) * step(aRnd.y, uDens);
          float hgt = 0.82;
          vec3 bladeCol = vec3(0.13, 0.27, 0.07) * (0.82 + 0.36 * aRnd.z);`;
      }
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + COMMON_VERT + 'uniform vec2 uCS; uniform sampler2D uCells; uniform vec4 uCellInfo;\n')
        .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
        .replace('#include <begin_vertex>', /* glsl */`
          ${place}
          vec2 huv = ((base + WH_) / CELL_ + 0.5) / NH_;
          float gh = texture2D(uHeightTex, huv).r;
          float dist = distance(base, uCamPos.xz);
          float fade = 1.0 - smoothstep(uFade.x, uFade.y, dist);
          float hs = hgt * aRnd.x * isOn * fade;
          float ca = cos(aOff.z), sa = sin(aOff.z);
          vec3 p = vec3(ca * position.x - sa * position.z, position.y, sa * position.x + ca * position.z);
          p.xz *= hs > 0.001 ? (1.0 + (1.0 - fade) * 1.2) * (0.6 + 0.4 * aRnd.x) : 0.0;
          p.y *= hs;
          vec2 wd = normalize(uWind.xz + 1e-4);
          float ph = dot(base, wd) * 0.35 - uTime * 2.2;
          float wv = sin(ph) * 0.5 + 0.5;
          float wv2 = sin(dot(base, vec2(-wd.y, wd.x)) * 0.11 + ph * 0.37) * 0.5 + 0.5;
          float bend = (0.1 + (0.2 + 1.0 * uGust) * wv * (0.4 + 0.6 * wv2) + 0.05 * sin(uTime * 7.0 + aRnd.z * 40.0)) * uWind.y;
          float t2 = aT * aT;
          p.x += wd.x * bend * t2 * hs * 0.85;
          p.z += wd.y * bend * t2 * hs * 0.85;
          p.y -= bend * bend * t2 * hs * 0.22;
          vec3 transformed = vec3(aOff.x, gh - modelMatrix[3][1] + ${kind === 'rice' ? '0.04' : '0.0'}, aOff.y) + p;
          vT = aT;
          vColor.rgb = bladeCol * mix(0.55, 1.35, aT) * (1.0 + 0.12 * wv * uGust);`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vT;\nuniform vec3 uSunCol;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance += vColor.rgb * uSunCol * vT * (0.05 + 0.32 * pow(max(dot(normalize(vWPos - cameraPosition), uSunDir), 0.0), 3.0));`);
    },
  });
  return { mat, shared };
}

class FieldLayer {
  constructor(o) {
    Object.assign(this, o);
    this.active = new Map();
    this.pool = [];
    this.contentCache = new Map();
    const rnd = mulberry32(o.seed);
    const base = bladeClump(o.blades, rnd, o.clump);
    const offs = [], rnds = [];
    const n = Math.round(o.tile / o.du), m = Math.round(o.tile / o.dv);
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      offs.push((i + 0.5) * o.du + (rnd() - 0.5) * o.jitter, (j + 0.5) * o.dv + (rnd() - 0.5) * o.jitter, rnd() * Math.PI * 2);
      rnds.push(0.75 + rnd() * 0.5, rnd(), rnd());
    }
    // shuffle so partial instance counts are spatially uniform
    const count = offs.length / 3;
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      for (let k = 0; k < 3; k++) { let t = offs[i * 3 + k]; offs[i * 3 + k] = offs[j * 3 + k]; offs[j * 3 + k] = t; t = rnds[i * 3 + k]; rnds[i * 3 + k] = rnds[j * 3 + k]; rnds[j * 3 + k] = t; }
    }
    const oa = new THREE.InstancedBufferAttribute(new Float32Array(offs), 3);
    const ra = new THREE.InstancedBufferAttribute(new Float32Array(rnds), 3);
    this.count = count;
    this.lodF = [1, 0.5, 0.22];
    this.geos = this.lodF.map((f) => {
      const g = instGeo(base, oa, ra, Math.floor(count * f));
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(o.tile / 2, 0, o.tile / 2), o.tile * 0.75 + 6);
      return g;
    });
  }
  setRadius(r) { this.radius = r; this.shared.uFade.value.set(r * 0.72, r); }
  // instances are shuffled, so drawing only the first part of them thins the layer evenly without wasting vertex work
  setDensity(k) { this.geos.forEach((g, i) => { g.instanceCount = Math.max(1, Math.floor(this.count * this.lodF[i] * k)); }); }
  update(cam) {
    this.shared.uCamPos.value.copy(cam);
    const T = this.tile, R = this.radius;
    const [gx, gz] = this.toGrid(cam.x, cam.z);
    const need = new Set();
    const t0x = Math.floor((gx - R) / T), t1x = Math.floor((gx + R) / T), t0z = Math.floor((gz - R) / T), t1z = Math.floor((gz + R) / T);
    for (let i = t0x; i <= t1x; i++) for (let j = t0z; j <= t1z; j++) {
      const cx = (i + 0.5) * T, cz = (j + 0.5) * T;
      const d = Math.hypot(cx - gx, cz - gz);
      if (d > R + T * 0.72) continue;
      const key = i * 10000 + j;
      let has = this.contentCache.get(key);
      if (has === undefined) { has = this.hasContent(i, j); this.contentCache.set(key, has); }
      if (!has) continue;
      need.add(key);
      let m = this.active.get(key);
      if (!m) {
        m = this.pool.pop();
        if (!m) { m = new THREE.Mesh(this.geos[0], this.mat); m.receiveShadow = true; m.castShadow = false; m.matrixAutoUpdate = false; this.scene.add(m); }
        m.visible = true;
        const [wx, wz] = this.fromGrid(i * T, j * T);
        const [mx, mz] = this.fromGrid(cx, cz);
        m.position.set(wx, this.heightAt(mx, mz), wz);
        m.rotation.y = this.rot;
        m.updateMatrix();
        this.active.set(key, m);
      }
      const lod = d < this.lod[0] ? 0 : d < this.lod[1] ? 1 : 2;
      m.geometry = this.geos[lod];
    }
    for (const [k, m] of this.active) if (!need.has(k)) { m.visible = false; this.pool.push(m); this.active.delete(k); }
  }
}

export class GrassSystem {
  constructor(W, quality) {
    this.W = W;
    const tex = { height: W.heightTex, mask: W.maskTex, ground: W.groundTex, cells: buildCellsTex(W.plan) };
    const g = layerMaterial('grass', tex);
    const r = layerMaterial('rice', tex);
    const plan = W.plan;
    const c = Math.cos(THETA), s = Math.sin(THETA);
    const maskData = W.maskData, MW = W.maskW;
    this.grass = new FieldLayer({
      scene: W.scene, mat: g.mat, shared: g.shared, seed: 11, blades: 3, tile: 14, du: 0.3, dv: 0.3, jitter: 0.26,
      clump: { spread: 0.16, width: 0.05, lean: 0.3 }, rot: 0, lod: [20, 34],
      toGrid: (x, z) => [x, z], fromGrid: (x, z) => [x, z], heightAt: (x, z) => W.hm.sample(x, z),
      hasContent: (i, j) => {
        const x0 = Math.floor((i * 14 + WH) / CELL), z0 = Math.floor((j * 14 + WH) / CELL);
        for (let a = 0; a <= 7; a++) for (let b = 0; b <= 7; b++) {
          const xx = x0 + a, zz = z0 + b;
          if (xx < 0 || zz < 0 || xx >= MW || zz >= MW) continue;
          if (maskData[(zz * MW + xx) * 4] > 18) return true;
        }
        return false;
      },
    });
    this.rice = new FieldLayer({
      scene: W.scene, mat: r.mat, shared: r.shared, seed: 12, blades: 6, tile: 12, du: 0.22, dv: 0.3, jitter: 0.04,
      clump: { spread: 0.06, width: 0.028, lean: 0.34 }, rot: -THETA, lod: [18, 30],
      toGrid: (x, z) => [x * c + z * s, -x * s + z * c], fromGrid: (u, v) => [u * c - v * s, u * s + v * c], heightAt: (x, z) => W.hm.sample(x, z),
      hasContent: (i, j) => {
        const u0 = i * 12, v0 = j * 12;
        for (let iu = Math.floor(u0 / CU); iu <= Math.floor((u0 + 12) / CU); iu++) for (let iv = Math.floor(v0 / CV); iv <= Math.floor((v0 + 12) / CV); iv++) {
          const cell = plan.cell(iu, iv);
          if (cell && cell.type === 'rice') return true;
        }
        return false;
      },
    });
    this.setQuality(quality);
  }
  setQuality(q) {
    const gr = q === 'high' ? 46 : q === 'low' ? 26 : 36;
    const rr = q === 'high' ? 44 : q === 'low' ? 24 : 34;
    this.grass.setRadius(gr); this.rice.setRadius(rr);
    this.grass.setDensity(q === 'low' ? 0.55 : 1);
    this.rice.setDensity(q === 'low' ? 0.6 : 1);
  }
  update(cam) { this.grass.update(cam); this.rice.update(cam); }
}

function buildCellsTex(plan) {
  const nu = IU1 - IU0, nv = IV1 - IV0;
  const data = new Uint8Array(nu * nv);
  for (const c of plan.cells.values()) if (c.type === 'rice') data[(c.iv - IV0) * nu + (c.iu - IU0)] = 255;
  const t = new THREE.DataTexture(data, nu, nv, THREE.RedFormat, THREE.UnsignedByteType);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}
