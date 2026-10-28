import * as THREE from 'three';
import { Simplex, smoothstep, clamp } from '../core/noise.js';
import { patch } from '../env/materials.js';

// World: 2 km square, heightmap at 2 m. The valley runs east–west between forested hills.
export const WH = 1000;
export const CELL = 2;
export const N = (WH * 2) / CELL + 1;

const nz = new Simplex(1234);

export function floorH(x, z) {
  return 6 - x * 0.0035 + nz.fbm(x * 0.0025, z * 0.0025, 3) * 1.6;
}
export function northFoot(x) { return -272 + 22 * Math.sin(x * 0.0065 + 0.5) + 12 * nz.noise(x * 0.017, 3.3); }
export function southFoot(x) { return 305 + 28 * Math.sin(x * 0.0048 + 2.0) + 14 * nz.noise(x * 0.015, 7.7); }
export function hillDist(x, z) {
  const nf = northFoot(x), sf = southFoot(x);
  let d = z < nf ? nf - z : z > sf ? z - sf : 0;
  const ex = Math.abs(x) - 830;
  if (ex > 0) d = Math.max(d, ex);
  return d;
}
function bump(x, z, cx, cz, r, hh) {
  const d2 = ((x - cx) ** 2 + (z - cz) ** 2) / (r * r);
  if (d2 >= 1) return 0;
  const t = 1 - d2;
  return hh * t * t * (1 + 0.12 * nz.noise(x * 0.04, z * 0.04));
}
export const SATOYAMA = { x: 232, z: -108, r: 80, h: 19 };
export function baseHeight(x, z) {
  let h = floorH(x, z);
  const d = hillDist(x, z);
  if (d > 0) {
    const H = 85 + 55 * nz.fbm(x * 0.0018 + 10, z * 0.0018 - 3, 3);
    const rise = 1 - Math.exp(-Math.pow(d / 85, 1.5));
    const ridge = nz.ridged(x * 0.0045 + 3, z * 0.0045, 3);
    const roll = nz.fbm(x * 0.006 - 7, z * 0.006 + 2, 3) * 0.5 + 0.5;
    h += rise * H * (0.55 + 0.3 * ridge + 0.35 * roll) + d * 0.05;
  }
  h += bump(x, z, SATOYAMA.x, SATOYAMA.z, SATOYAMA.r, SATOYAMA.h);
  h += bump(x, z, -660, -40, 75, 13);
  return h;
}

export class Heightmap {
  constructor() {
    this.n = N;
    this.h = new Float32Array(N * N);
  }
  generate() {
    const h = this.h;
    for (let iz = 0; iz < N; iz++) {
      const z = iz * CELL - WH;
      for (let ix = 0; ix < N; ix++) h[iz * N + ix] = baseHeight(ix * CELL - WH, z);
    }
  }
  get(ix, iz) {
    ix = ix < 0 ? 0 : ix >= N ? N - 1 : ix;
    iz = iz < 0 ? 0 : iz >= N ? N - 1 : iz;
    return this.h[iz * N + ix];
  }
  sample(x, z) {
    let fx = (x + WH) / CELL, fz = (z + WH) / CELL;
    if (fx < 0) fx = 0; else if (fx > N - 1.001) fx = N - 1.001;
    if (fz < 0) fz = 0; else if (fz > N - 1.001) fz = N - 1.001;
    const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz;
    const i = iz * N + ix, h = this.h;
    const a = h[i], b = h[i + 1], c = h[i + N], d = h[i + N + 1];
    return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
  }
  normal(x, z, out) {
    const e = 1.5;
    const dx = this.sample(x + e, z) - this.sample(x - e, z);
    const dz = this.sample(x, z + e) - this.sample(x, z - e);
    out.set(-dx, 2 * e, -dz).normalize();
    return out;
  }
  // iterate cells inside bbox; cb(i, x, z)
  forBox(x0, z0, x1, z1, cb) {
    const ix0 = Math.max(0, Math.floor((x0 + WH) / CELL)), ix1 = Math.min(N - 1, Math.ceil((x1 + WH) / CELL));
    const iz0 = Math.max(0, Math.floor((z0 + WH) / CELL)), iz1 = Math.min(N - 1, Math.ceil((z1 + WH) / CELL));
    for (let iz = iz0; iz <= iz1; iz++) {
      const z = iz * CELL - WH;
      for (let ix = ix0; ix <= ix1; ix++) cb(iz * N + ix, ix * CELL - WH, z);
    }
  }
}

// Ground types (per heightmap cell)
export const G = { GRASS: 0, ASPHALT: 1, GRAVEL: 2, YARD: 3, FOREST: 4, PADDY: 5, WATER: 6, BALLAST: 7, STONE: 8, SAND: 9, CONCRETE: 10, DIRT: 11, FIELD: 12, TALL: 13, WOOD: 14 };
const GCOL = {
  [G.GRASS]: [0x6c8c3a, 0x86a248], [G.ASPHALT]: [0x5a5a5c, 0x5a5a5c], [G.GRAVEL]: [0x9c9482, 0x8f8774], [G.YARD]: [0xa29a88, 0x8e866f],
  [G.FOREST]: [0x3c4a26, 0x4c5a2e], [G.PADDY]: [0x5d6d34, 0x5d6d34], [G.WATER]: [0x4a4c3c, 0x4a4c3c], [G.BALLAST]: [0x7a7670, 0x6e6a64],
  [G.STONE]: [0x9a968c, 0x8a867c], [G.SAND]: [0xc8b48c, 0xbca67e], [G.CONCRETE]: [0xa6a49a, 0x9a988e], [G.DIRT]: [0x8a7050, 0x7a6448],
  [G.FIELD]: [0x6a573a, 0x5c4a30], [G.TALL]: [0x7c9442, 0x94a650], [G.WOOD]: [0x6a5038, 0x6a5038],
};
// grass density R, blade height B, wildflowers A
const GMASK = {
  [G.GRASS]: [0.9, 0.5, 0.3], [G.ASPHALT]: [0, 0, 0], [G.GRAVEL]: [0.12, 0.3, 0], [G.YARD]: [0.18, 0.3, 0.1], [G.FOREST]: [0.45, 0.65, 0],
  [G.PADDY]: [0, 0, 0], [G.WATER]: [0, 0, 0], [G.BALLAST]: [0.05, 0.3, 0], [G.STONE]: [0.05, 0.2, 0], [G.SAND]: [0.03, 0.2, 0],
  [G.CONCRETE]: [0, 0, 0], [G.DIRT]: [0.15, 0.3, 0], [G.FIELD]: [0.08, 0.3, 0], [G.TALL]: [1, 1, 0.6], [G.WOOD]: [0, 0, 0],
};

export function buildGroundTextures(hm, ground, noise) {
  const W = N - 1; // texel per cell
  const col = new Uint8Array(W * W * 4);
  const mask = new Uint8Array(W * W * 4);
  const ca = new THREE.Color(), cb = new THREE.Color();
  for (let iz = 0; iz < W; iz++) {
    for (let ix = 0; ix < W; ix++) {
      const i = iz * N + ix, o = (iz * W + ix) * 4;
      const g = ground[i];
      const x = ix * CELL - WH, z = iz * CELL - WH;
      const n = noise.fbm(x * 0.02, z * 0.02, 3) * 0.5 + 0.5;
      const pair = GCOL[g] || GCOL[0];
      ca.setHex(pair[0]); cb.setHex(pair[1]);
      ca.lerp(cb, n);
      let r = ca.r, gg = ca.g, b = ca.b;
      if (g === G.GRASS || g === G.TALL) {
        // dry patches and lush hollows
        const dry = smoothstep(0.55, 0.85, noise.fbm(x * 0.006 + 40, z * 0.006, 3) * 0.5 + 0.5);
        r += dry * 0.08; gg += dry * 0.02; b -= dry * 0.02;
      }
      col[o] = clamp(r, 0, 1) * 255; col[o + 1] = clamp(gg, 0, 1) * 255; col[o + 2] = clamp(b, 0, 1) * 255; col[o + 3] = 255;
      const m = GMASK[g] || GMASK[0];
      const dn = noise.noise(x * 0.05, z * 0.05) * 0.5 + 0.5;
      mask[o] = clamp(m[0] * (0.65 + 0.5 * dn), 0, 1) * 255;
      mask[o + 1] = 0;
      mask[o + 2] = m[1] * 255;
      mask[o + 3] = m[2] * (noise.noise(x * 0.03 + 9, z * 0.03) > 0.25 ? 255 : 0);
    }
  }
  // soften the grass mask one pass so edges fade instead of stepping
  const blurred = new Uint8Array(mask);
  for (let iz = 1; iz < W - 1; iz++) for (let ix = 1; ix < W - 1; ix++) {
    const o = (iz * W + ix) * 4;
    let s = 0;
    for (let k = -1; k <= 1; k++) for (let l = -1; l <= 1; l++) s += mask[((iz + k) * W + ix + l) * 4];
    blurred[o] = Math.min(mask[o], s / 9 + 30);
  }
  const groundTex = new THREE.DataTexture(col, W, W, THREE.RGBAFormat);
  groundTex.colorSpace = THREE.SRGBColorSpace;
  groundTex.magFilter = THREE.LinearFilter; groundTex.minFilter = THREE.LinearMipmapLinearFilter;
  groundTex.generateMipmaps = true; groundTex.anisotropy = 8;
  groundTex.needsUpdate = true;
  const maskTex = new THREE.DataTexture(blurred, W, W, THREE.RGBAFormat);
  maskTex.magFilter = THREE.LinearFilter; maskTex.minFilter = THREE.LinearFilter;
  maskTex.needsUpdate = true;
  return { groundTex, maskTex, maskData: blurred, maskW: W };
}

export function buildHeightTexture(hm) {
  const data = new Uint16Array(N * N);
  for (let i = 0; i < N * N; i++) data[i] = THREE.DataUtils.toHalfFloat(hm.h[i]);
  const t = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.HalfFloatType);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

function axisCoords() {
  const xs = [];
  for (let x = -WH; x < -720; x += 20) xs.push(x);
  for (let x = -720; x <= 720; x += 4) xs.push(x);
  for (let x = 740; x <= WH; x += 20) xs.push(x);
  if (xs[xs.length - 1] !== WH) xs.push(WH);
  return xs;
}

export function buildTerrainMesh(hm, groundTex, detailTex) {
  const xs = axisCoords(), zs = axisCoords();
  const nx = xs.length, nzc = zs.length;
  const pos = new Float32Array(nx * nzc * 3), nor = new Float32Array(nx * nzc * 3), uv = new Float32Array(nx * nzc * 2), colr = new Float32Array(nx * nzc * 3);
  const v = new THREE.Vector3();
  let p = 0;
  for (let j = 0; j < nzc; j++) for (let i = 0; i < nx; i++) {
    const x = xs[i], z = zs[j];
    const h = hm.sample(x, z);
    pos[p * 3] = x; pos[p * 3 + 1] = h; pos[p * 3 + 2] = z;
    hm.normal(x, z, v);
    nor[p * 3] = v.x; nor[p * 3 + 1] = v.y; nor[p * 3 + 2] = v.z;
    uv[p * 2] = ((x + WH) / CELL + 0.5) / (N - 1); uv[p * 2 + 1] = ((z + WH) / CELL + 0.5) / (N - 1);
    const slope = 1 - v.y;
    const k = 1 - Math.min(0.35, slope * 1.4);
    colr[p * 3] = k; colr[p * 3 + 1] = k; colr[p * 3 + 2] = k;
    p++;
  }
  const idx = new Uint32Array((nx - 1) * (nzc - 1) * 6);
  let q = 0;
  for (let j = 0; j < nzc - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx[q++] = a; idx[q++] = c; idx[q++] = b;
    idx[q++] = b; idx[q++] = c; idx[q++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  const mat = patch(new THREE.MeshLambertMaterial({ map: groundTex, vertexColors: true }), {
    key: 'terrain',
    frag: (sh) => {
      sh.uniforms.uDetail = { value: detailTex };
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D uDetail;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          vec3 dta = texture2D(uDetail, vWPos.xz * 0.21).rgb;
          vec3 dtb = texture2D(uDetail, vWPos.xz * 0.027).rgb;
          float fadeD = smoothstep(120.0, 20.0, length(vWPos - cameraPosition));
          diffuseColor.rgb *= mix(1.0, (0.8 + 0.4 * dta.r) * (0.92 + 0.16 * dta.b), fadeD) * (0.86 + 0.28 * dtb.g);`);
    },
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  mesh.name = 'terrain';
  return mesh;
}

// Distant mountain ring beyond the heightmap, lost in summer haze
export function buildFarMountains() {
  const rings = [];
  for (let r = 900; r < 4600; r *= 1.12) rings.push(r);
  const seg = 200;
  const pos = [], col = [], idx = [];
  const c1 = new THREE.Color(0x2e4230), c2 = new THREE.Color(0x4a5e6a), c = new THREE.Color();
  for (let j = 0; j < rings.length; j++) {
    const r = rings[j];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const k = smoothstep(950, 1800, r);
      const ridge = nz.ridged(x * 0.0008 + 5, z * 0.0008, 4);
      const roll = nz.fbm(x * 0.0006 + 3, z * 0.0006, 4) * 0.5 + 0.5;
      const h = -30 + k * (110 + 260 * roll + 200 * Math.pow(ridge, 1.6)) + (r > 3000 ? (r - 3000) * 0.05 : 0);
      pos.push(x, h, z);
      c.copy(c1).lerp(c2, smoothstep(1500, 4000, r));
      col.push(c.r, c.g, c.b);
    }
  }
  const w = seg + 1;
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < seg; i++) {
    const a = j * w + i, b = a + 1, cc = a + w, d = cc + 1;
    idx.push(a, b, cc, b, d, cc);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, patch(new THREE.MeshLambertMaterial({ vertexColors: true }), { key: 'far' }));
  m.matrixAutoUpdate = false;
  m.name = 'farMountains';
  return m;
}
