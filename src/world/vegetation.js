import * as THREE from 'three';
import { MeshBuilder, C, varyColor } from '../core/builder.js';
import { RNG } from '../core/noise.js';
import { patch } from '../env/materials.js';
import { CF } from './collision.js';

// Instanced trees in spatial chunks with three levels of detail.

function buildTypes() {
  const R = new RNG(77);
  const T = {};
  const mk = (fn) => [0, 1, 2].map((lod) => { const b = new MeshBuilder(); fn(b, lod); return b.build(); });
  T.sugi = mk((b, lod) => {
    const bark = C(0x5a4232);
    if (lod < 2) b.cyl(0, 0, 0, 0.3, 0.1, 15, lod ? 4 : 6, bark);
    const n = lod === 0 ? 6 : lod === 1 ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(1, n - 1);
      const r = n === 1 ? 2.3 : 2.4 * (1 - t * 0.78) + 0.25;
      const y0 = n === 1 ? 3.8 : 4.0 + i * (11 / n);
      const h = n === 1 ? 13.5 : 4.2 + (1 - t) * 1.2;
      const col = varyColor(i % 2 ? 0x2c4628 : 0x324e2c, R, 0.08);
      b.cone(R.float(-0.15, 0.15), y0, R.float(-0.15, 0.15), r, h, lod === 0 ? 7 : lod === 1 ? 6 : 5, col, varyColor(0x4a6638, R, 0.05));
    }
  });
  T.broad = mk((b, lod) => {
    const bark = C(0x5e4a3a);
    if (lod < 2) {
      b.cyl(0, 0, 0, 0.36, 0.22, 5.5, lod ? 5 : 7, bark);
      if (lod === 0) for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.4; b.tube(0, 4.2, 0, Math.cos(a) * 1.8, 6.6, Math.sin(a) * 1.8, 0.14, 4, bark); }
    }
    const n = lod === 0 ? 7 : lod === 1 ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + R.float(0, 1), rr = n === 1 ? 0 : R.float(1.2, 2.4);
      const col = varyColor(R.pick([0x46682e, 0x3e5e2a, 0x527234, 0x3a5a2a]), R, 0.08);
      const s = n === 1 ? 3.9 : R.float(2.3, 3.0);
      b.blob(Math.cos(a) * rr, (n === 1 ? 8.0 : 7.0 + R.float(0, 2.4)), Math.sin(a) * rr, s, s * 0.82, s, col, lod === 2 ? null : R, 0.18, lod === 0 ? 1 : 0, 0.62);
    }
  });
  T.bamboo = mk((b, lod) => {
    const culm = C(0x8aa04a);
    b.push(); b.rotateZ(0.06);
    b.cyl(0, 0, 0, 0.075, 0.05, 11.5, lod === 0 ? 6 : 4, culm, { topColor: C(0x9ab05a) });
    const n = lod === 0 ? 6 : lod === 1 ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const y = 6.5 + (i / Math.max(1, n - 1)) * 4.8, a = i * 2.4;
      const col = varyColor(i % 2 ? 0x6a8c38 : 0x7a9a40, R, 0.07);
      b.blob(Math.cos(a) * 0.7, y, Math.sin(a) * 0.7, n === 1 ? 1.4 : 1.0, n === 1 ? 2.4 : 0.42, n === 1 ? 1.4 : 1.0, col, lod ? null : R, 0.3, 0, 0.7);
    }
    b.pop();
  });
  T.pine = mk((b, lod) => {
    const bark = C(0x4a3a30);
    b.tube(0, 0, 0, 0.4, 2.0, 0.2, 0.22, 5, bark);
    b.tube(0.4, 2.0, 0.2, -0.3, 3.6, -0.1, 0.18, 5, bark);
    b.tube(-0.3, 3.6, -0.1, 0.2, 4.8, 0.1, 0.14, 5, bark);
    const pads = [[1.3, 2.4, 0.4, 1.5], [-1.2, 3.3, -0.3, 1.3], [0.6, 4.3, 0.6, 1.1], [0.1, 5.1, 0, 1.0], [-0.8, 4.4, 0.9, 0.9]];
    for (const [x, y, z, s] of pads.slice(0, lod === 0 ? 5 : 3)) b.blob(x, y, z, s * 1.2, s * 0.42, s * 1.1, varyColor(0x2e4a2a, R, 0.08), lod ? null : R, 0.15, lod === 0 ? 1 : 0, 0.7);
  });
  T.sakura = mk((b, lod) => {
    const bark = C(0x3e322c);
    b.cyl(0, 0, 0, 0.32, 0.2, 2.6, 6, bark);
    if (lod === 0) for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.3; b.tube(0, 2.4, 0, Math.cos(a) * 2.8, 4.4, Math.sin(a) * 2.8, 0.13, 4, bark); }
    const n = lod === 0 ? 7 : lod === 1 ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, rr = n === 1 ? 0 : R.float(1.6, 3.0);
      const s = n === 1 ? 4.2 : R.float(2.0, 2.6);
      b.blob(Math.cos(a) * rr, n === 1 ? 5.0 : R.float(4.4, 5.8), Math.sin(a) * rr, s * 1.1, s * 0.62, s * 1.1, varyColor(R.pick([0x507a34, 0x5a823a, 0x4a7030]), R, 0.07), lod === 2 ? null : R, 0.15, lod === 0 ? 1 : 0, 0.65);
    }
  });
  T.kaki = mk((b, lod) => {
    const bark = C(0x4e3e32);
    b.cyl(0, 0, 0, 0.22, 0.14, 2.4, 6, bark);
    if (lod === 0) for (let i = 0; i < 3; i++) { const a = i * 2.2; b.tube(0, 2.0, 0, Math.cos(a) * 1.6, 3.6, Math.sin(a) * 1.6, 0.09, 4, bark); }
    const n = lod === 0 ? 5 : 2;
    for (let i = 0; i < n; i++) { const a = i * 2.4; b.blob(Math.cos(a) * 1.2, 4.0 + (i % 2) * 0.8, Math.sin(a) * 1.2, 1.8, 1.4, 1.8, varyColor(0x4a6e2e, R, 0.08), lod ? null : R, 0.18, lod === 0 ? 1 : 0, 0.65); }
    if (lod === 0) for (let i = 0; i < 10; i++) { const a = R.float(0, 6.28); b.blob(Math.cos(a) * 2.2, R.float(3.2, 5.0), Math.sin(a) * 2.2, 0.09, 0.09, 0.09, C(0x8aa040), null, 0, 0, 1); }
  });
  T.maple = mk((b, lod) => {
    const bark = C(0x5a4a40);
    b.cyl(0, 0, 0, 0.14, 0.08, 2.4, 5, bark);
    const n = lod === 0 ? 6 : 2;
    for (let i = 0; i < n; i++) { const a = i * 1.9; b.blob(Math.cos(a) * 0.9, 2.6 + (i % 3) * 0.5, Math.sin(a) * 0.9, 1.2, 0.7, 1.2, varyColor(R.pick([0x6a9a3a, 0x78a442, 0x5e8e34]), R, 0.08), lod ? null : R, 0.25, lod === 0 ? 1 : 0, 0.7); }
  });
  return T;
}

const RADIUS = { sugi: 0.32, broad: 0.4, bamboo: 0.1, pine: 0.25, sakura: 0.35, kaki: 0.22, maple: 0.15 };

export class Forest {
  constructor(W, quality) {
    this.W = W;
    this.types = buildTypes();
    this.chunk = 125;
    this.meshes = [];
    const foliage = W.M.foliage;
    const bambooMat = patch(new THREE.MeshLambertMaterial({ vertexColors: true }), { wind: 0.0042, windBase: 1.0, key: 'bamboo' });
    const groups = new Map();
    for (const t of W.plan.trees) {
      const k = t.type + '|' + Math.floor(t.x / this.chunk) + '|' + Math.floor(t.z / this.chunk);
      let g = groups.get(k); if (!g) { g = []; groups.set(k, g); }
      g.push(t);
      if (Math.abs(t.x) < 800 && t.z > -560 && t.z < 600) W.col.addCircle(t.x, t.z, RADIUS[t.type] * t.s, CF.ALL, 'tree');
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (const [k, arr] of groups) {
      const type = arr[0].type;
      const geos = this.types[type];
      const mesh = new THREE.InstancedMesh(geos[0], type === 'bamboo' ? bambooMat : foliage, arr.length);
      let cx = 0, cz = 0;
      arr.forEach((t, i) => {
        p.set(t.x, t.y - 0.15, t.z);
        q.setFromAxisAngle(up, t.r);
        const sy = t.s * (type === 'sugi' ? 1 : 1);
        s.set(t.s, sy, t.s);
        m4.compose(p, q, s);
        mesh.setMatrixAt(i, m4);
        cx += t.x; cz += t.z;
      });
      mesh.computeBoundingSphere();
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { geos, cx: cx / arr.length, cz: cz / arr.length, lod: 0 };
      mesh.name = 'trees:' + k;
      this.meshes.push(mesh);
      W.scene.add(mesh);
    }
    this.lodDist = quality === 'high' ? [200, 520] : quality === 'low' ? [110, 340] : [160, 440];
    // index for audio (cicadas in trees)
    this.index = new Map();
    for (const t of W.plan.trees) {
      if (t.type === 'bamboo') continue;
      const key = Math.floor(t.x / 20) * 1000 + Math.floor(t.z / 20);
      let a = this.index.get(key); if (!a) { a = []; this.index.set(key, a); }
      a.push(t);
    }
  }
  setQuality(q) { this.lodDist = q === 'high' ? [200, 520] : q === 'low' ? [110, 340] : [160, 440]; }
  update(cam) {
    for (const m of this.meshes) {
      const u = m.userData;
      const d = Math.hypot(cam.x - u.cx, cam.z - u.cz) - this.chunk * 0.55;
      const lod = d < this.lodDist[0] ? 0 : d < this.lodDist[1] ? 1 : 2;
      if (lod !== u.lod) { u.lod = lod; m.geometry = u.geos[lod]; m.castShadow = lod < 2; }
    }
  }
  treesNear(x, z, r, out = []) {
    out.length = 0;
    const c = 20, x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c), z0 = Math.floor((z - r) / c), z1 = Math.floor((z + r) / c);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
      const a = this.index.get(i * 1000 + j);
      if (a) for (const t of a) if ((t.x - x) ** 2 + (t.z - z) ** 2 < r * r) out.push(t);
    }
    return out;
  }
}
