import * as THREE from 'three';
import { C, varyColor, MeshBuilder } from '../core/builder.js';
import { RNG } from '../core/noise.js';
import { patch, U } from '../env/materials.js';
import { THETA, CU, CV } from './planner.js';
import { CF } from './collision.js';

// Paddy surfaces with rippling wind, levees, vegetable ridges, vinyl greenhouses, sunflower fields and scarecrows.

export function paddyMaterial(T) {
  const t = T.paddy.clone(); t.repeat.set(1 / 8, 1 / 8); t.needsUpdate = true;
  return patch(new THREE.MeshLambertMaterial({ map: t, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), {
    key: 'paddy',
    frag: (sh) => {
      sh.uniforms.uGustF = U.uGust; sh.uniforms.uWindF = U.uWind; sh.uniforms.uTimeF = U.uTime;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uGustF; uniform vec3 uWindF; uniform float uTimeF;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          {
            vec2 wd = normalize(uWindF.xz + 1e-4);
            float ph = dot(vWPos.xz, wd) * 0.35 - uTimeF * 2.2;
            float wv = sin(ph) * 0.5 + 0.5;
            float wv2 = sin(dot(vWPos.xz, vec2(-wd.y, wd.x)) * 0.11 + ph * 0.37) * 0.5 + 0.5;
            float k = wv * wv2 * (0.25 + uGustF * 0.9);
            diffuseColor.rgb *= 0.92 + 0.22 * k;
            diffuseColor.rgb += vec3(0.04, 0.05, 0.0) * k;
          }`);
    },
  });
}

function g2w(gu, gv) { const c = Math.cos(THETA), s = Math.sin(THETA); return [gu * c - gv * s, gu * s + gv * c]; }

export function buildFields(W) {
  const plan = W.plan;
  const rng = new RNG(555);
  const paddyKey = 'paddy';
  const sunflowers = [];
  const melons = [];
  const plastic = new MeshBuilder();
  for (const c of plan.cells.values()) {
    const { iu, iv } = c;
    // margins: farm roads on every 4th u-line and every 2nd v-line
    const mL = ((iu % 4) + 4) % 4 === 0 ? 2.1 : 0.45, mR = (((iu + 1) % 4) + 4) % 4 === 0 ? 2.1 : 0.45;
    const mT = ((iv % 2) + 2) % 2 === 0 ? 2.1 : 0.45, mB = (((iv + 1) % 2) + 2) % 2 === 0 ? 2.1 : 0.45;
    const u0 = iu * CU + mL, u1 = (iu + 1) * CU - mR, v0 = iv * CV + mT, v1 = (iv + 1) * CV - mB;
    const y = c.h;
    const corner = (u, v, dy = 0) => { const [x, z] = g2w(u, v); return [x, y + dy, z]; };
    const [cx, cz] = g2w((u0 + u1) / 2, (v0 + v1) / 2);
    if (c.type === 'rice') {
      const b = W.chunks.get(paddyKey, cx, cz);
      const col = varyColor(rng.pick([0x9cc070, 0xa4c46c, 0x92b868, 0xa8c878, 0x98bc62]), rng, 0.07);
      b.quad(corner(u0, v1, 0.05), corner(u1, v1, 0.05), corner(u1, v0, 0.05), corner(u0, v0, 0.05), col, [u0, v1, u1, v0]);
      // levees on non-road edges
      const L = W.chunks.get('plain', cx, cz);
      const lev = C(0x6f8a3c);
      const levee = (ua, va, ub, vb) => {
        const [xa, za] = g2w(ua, va), [xb, zb] = g2w(ub, vb);
        const dx = xb - xa, dz = zb - za, len = Math.hypot(dx, dz);
        L.place((xa + xb) / 2, y, (za + zb) / 2, Math.atan2(dx, dz));
        L.box(0, 0, 0, 0.55, 0.2, len, lev, { noNX: false });
      };
      if (mL < 1) levee(iu * CU, v0 - 0.2, iu * CU, v1 + 0.2);
      if (mR < 1) levee((iu + 1) * CU, v0 - 0.2, (iu + 1) * CU, v1 + 0.2);
      if (mT < 1) levee(u0 - 0.2, iv * CV, u1 + 0.2, iv * CV);
      if (mB < 1) levee(u0 - 0.2, (iv + 1) * CV, u1 + 0.2, (iv + 1) * CV);
      W.paddies.push({ x: cx, z: cz, y, hw: (u1 - u0) / 2, hd: (v1 - v0) / 2 });
      if (rng.chance(0.07)) scarecrow(W, rng, ...g2w(u0 + rng.float(4, u1 - u0 - 4), v0 + rng.float(3, v1 - v0 - 3)), y);
    } else if (c.type === 'veg' && rng.chance(0.3)) {
      // a watermelon patch: straw mulch, sprawling vines and striped melons lying among the leaves
      const F = W.chunks.get('foliage', cx, cz), S = W.chunks.get('plain', cx, cz);
      for (let k = 0; k < (u1 - u0) * (v1 - v0) * 0.5; k++) {
        const [x, z] = g2w(rng.float(u0 + 0.4, u1 - 0.4), rng.float(v0 + 0.4, v1 - 0.4));
        const gy = W.hm.sample(x, z);
        if (rng.chance(0.4)) { S.place(x, gy, z, rng.float(0, 6.28)); for (let j = 0; j < 4; j++) S.box(rng.float(-0.2, 0.2), 0, rng.float(-0.2, 0.2), rng.float(0.25, 0.5), 0.015, 0.04, varyColor(0xb8a468, rng, 0.1)); continue; } // loose straw
        F.place(x, gy, z, rng.float(0, 6.28));
        F.blob(0, 0.07, 0, rng.float(0.22, 0.38), 0.11, rng.float(0.2, 0.34), varyColor(0x3e6e2a, rng, 0.1), rng, 0.2, 1, 0.7);
      }
      for (let k = 0; k < (u1 - u0) * (v1 - v0) * 0.04; k++) {
        const [x, z] = g2w(rng.float(u0 + 0.8, u1 - 0.8), rng.float(v0 + 0.8, v1 - 0.8));
        melons.push([x, W.hm.sample(x, z) + 0.13, z, rng.float(0.8, 1.15), rng.float(0, 6.28)]);
      }
    } else if (c.type === 'veg') {
      const b = W.chunks.get('plain', cx, cz);
      const soil = C(0x6a5232), green = varyColor(rng.pick([0x4e7a2e, 0x5a8a34, 0x3e6a2a]), rng, 0.08);
      for (let v = v0 + 0.6; v < v1 - 0.4; v += 1.1) {
        const [xa, za] = g2w(u0 + 0.5, v), [xb, zb] = g2w(u1 - 0.5, v);
        const dx = xb - xa, dz = zb - za, len = Math.hypot(dx, dz);
        b.place((xa + xb) / 2, y, (za + zb) / 2, Math.atan2(dx, dz));
        b.box(0, 0, 0, 0.6, 0.18, len, soil);
        const tall = rng.chance(0.18);
        b.box(0, 0.18, 0, tall ? 0.3 : 0.42, tall ? 1.5 : 0.32, len - 0.4, green, { topColor: varyColor(0x6a9a3a, rng, 0.08) });
      }
    } else if (c.type === 'greenhouse') {
      const P = W.chunks.get('plain', cx, cz);
      const n = Math.floor((v1 - v0) / 6.2);
      for (let k = 0; k < n; k++) {
        const vc = v0 + 3.1 + k * 6.2;
        const [xa, za] = g2w(u0 + 1, vc), [xb, zb] = g2w(u1 - 1, vc);
        const dx = xb - xa, dz = zb - za, len = Math.hypot(dx, dz);
        const ang = Math.atan2(dx, dz);
        P.place((xa + xb) / 2, y, (za + zb) / 2, ang);
        plastic.place((xa + xb) / 2, y, (za + zb) / 2, ang);
        const r = 2.6, seg = 10;
        for (let z = -len / 2; z <= len / 2 + 0.01; z += 1.6) for (let i = 0; i < seg; i++) {
          const a0 = (i / seg) * Math.PI, a1 = ((i + 1) / seg) * Math.PI;
          P.tube(Math.cos(a0) * r, Math.sin(a0) * r * 1.05, z, Math.cos(a1) * r, Math.sin(a1) * r * 1.05, z, 0.025, 3, C(0xb0b4b8));
        }
        for (let i = 0; i < seg; i++) {
          const a0 = (i / seg) * Math.PI, a1 = ((i + 1) / seg) * Math.PI;
          const pa = [Math.cos(a0) * r, Math.sin(a0) * r * 1.05], pb = [Math.cos(a1) * r, Math.sin(a1) * r * 1.05];
          plastic.quad([pa[0], pa[1], len / 2], [pa[0], pa[1], -len / 2], [pb[0], pb[1], -len / 2], [pb[0], pb[1], len / 2], C(0xf4f6f4));
        }
        // end walls
        for (const zz of [-len / 2, len / 2]) for (let i = 0; i < seg; i++) {
          const a0 = (i / seg) * Math.PI, a1 = ((i + 1) / seg) * Math.PI;
          plastic.tri([0, 0, zz], [Math.cos(a0) * r, Math.sin(a0) * r * 1.05, zz], [Math.cos(a1) * r, Math.sin(a1) * r * 1.05, zz], C(0xf4f6f4));
        }
        // rows of green inside
        P.box(0, 0, 0, 3.6, 0.5, len - 1, C(0x4a7a2e), { topColor: C(0x5e8e36) });
        W.col.addBox((xa + xb) / 2, (za + zb) / 2, r, len / 2, ang, CF.ALL, 'greenhouse');
      }
    } else if (c.type === 'sunflower') {
      for (let u = u0 + 0.8; u < u1 - 0.6; u += 0.62) for (let v = v0 + 0.8; v < v1 - 0.6; v += 0.95) {
        const [x, z] = g2w(u + rng.float(-0.12, 0.12), v + rng.float(-0.15, 0.15));
        sunflowers.push([x, y, z, rng.float(0.8, 1.15), rng.float(-0.5, 0.5), W.sunflowerFields.length]);
      }
      const b = W.chunks.get('plain', cx, cz);
      b.quad(corner(u0, v1, 0.02), corner(u1, v1, 0.02), corner(u1, v0, 0.02), corner(u0, v0, 0.02), C(0x5a4a30));
      W.sunflowerFields.push({ x: cx, z: cz });
    }
  }
  if (!plastic.empty) {
    const m = new THREE.Mesh(plastic.build(), patch(new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }), { key: 'plastic' }));
    m.renderOrder = 2;
    W.scene.add(m);
  }
  if (sunflowers.length) buildSunflowers(W, sunflowers);
  if (melons.length) buildMelons(W, melons);
}

// striped watermelons: one instanced mesh, stripes painted into a small texture
function buildMelons(W, list) {
  const [c, x] = (() => { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 32; return [cv, cv.getContext('2d')]; })();
  x.fillStyle = '#2e6a28'; x.fillRect(0, 0, 64, 32);
  x.fillStyle = '#163a14';
  for (let i = 0; i < 8; i++) { x.beginPath(); for (let y = 0; y <= 32; y += 2) x.lineTo(i * 8 + 2 + Math.sin(y * 0.6 + i) * 1.6, y); for (let y = 32; y >= 0; y -= 2) x.lineTo(i * 8 + 5 + Math.sin(y * 0.6 + i) * 1.6, y); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.SphereGeometry(0.17, 14, 10); geo.scale(1.2, 0.95, 1);
  const mesh = new THREE.InstancedMesh(geo, patch(new THREE.MeshLambertMaterial({ map: t }), { key: 'melon' }), list.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  list.forEach(([mx, my, mz, sc, r], i) => mesh.setMatrixAt(i, m4.compose(p.set(mx, my, mz), q.setFromAxisAngle(up, r), s.set(sc, sc, sc))));
  mesh.computeBoundingSphere();
  mesh.castShadow = true; mesh.receiveShadow = true;
  W.scene.add(mesh);
}

function scarecrow(W, rng, x, z, y) {
  const b = W.chunks.get('plain', x, z);
  b.place(x, y, z, rng.float(0, 6.28));
  const wood = C(0x7a5a3a);
  b.box(0, 0, 0, 0.07, 1.9, 0.07, wood);
  b.box(0, 1.35, 0, 1.4, 0.06, 0.06, wood);
  b.box(0, 1.0, 0, 0.5, 0.5, 0.2, C(rng.pick([0x3a5a9a, 0xb83a3a, 0x8a8a5a])));
  b.blob(0, 1.65, 0, 0.16, 0.18, 0.16, C(0xe8e0c8), null, 0, 1, 1);
  b.cone(0, 1.72, 0, 0.42, 0.28, 10, C(0xd8c078));
  W.col.addCircle(x, z, 0.15);
}

function buildSunflowers(W, list) {
  const b = new MeshBuilder();
  const stem = C(0x4a7a2a), leaf = C(0x3e6e26), petal = C(0xf2c41a), disk = C(0x4a3018);
  b.cyl(0, 0, 0, 0.025, 0.018, 1.75, 4, stem);
  b.quad([0, 0.8, 0], [0.32, 0.92, 0.08], [0.36, 1.0, 0.02], [0.05, 0.9, 0], leaf);
  b.quad([0, 1.1, 0], [-0.3, 1.2, -0.06], [-0.34, 1.3, -0.02], [-0.04, 1.2, 0], leaf);
  b.push(); b.translate(0, 1.78, 0.06); b.rotateX(-0.25);
  // flower head faces +z
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, a1 = ((i + 0.5) / n) * Math.PI * 2, a2 = ((i + 1) / n) * Math.PI * 2;
    b.tri([Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0.01], [Math.cos(a1) * 0.26, Math.sin(a1) * 0.26, 0], [Math.cos(a2) * 0.1, Math.sin(a2) * 0.1, 0.01], petal);
    b.tri([0, 0, 0.03], [Math.cos(a) * 0.11, Math.sin(a) * 0.11, 0.02], [Math.cos(a2) * 0.11, Math.sin(a2) * 0.11, 0.02], disk);
    b.tri([Math.cos(a2) * 0.11, Math.sin(a2) * 0.11, -0.01], [Math.cos(a) * 0.11, Math.sin(a) * 0.11, -0.01], [0, 0, -0.03], C(0x6a8a3a));
  }
  b.pop();
  const geo = b.build();
  const mat = patch(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), { wind: 0.02, windBase: 0.2, key: 'sunf' });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  // one instanced mesh per field, so fields out of view or far away are skipped (see World.update)
  W.sunflowerMeshes = [];
  W.sunflowerFields.forEach((f, fi) => {
    const mine = list.filter((e) => e[5] === fi);
    if (!mine.length) return;
    const mesh = new THREE.InstancedMesh(geo, mat, mine.length);
    mine.forEach(([x, y, z, sc, r], i) => {
      p.set(x, y, z); q.setFromAxisAngle(up, Math.PI / 2 + r); s.set(sc, sc, sc);
      m4.compose(p, q, s); mesh.setMatrixAt(i, m4);
    });
    mesh.computeBoundingSphere();
    mesh.castShadow = true; mesh.receiveShadow = true;
    W.scene.add(mesh);
    W.sunflowerMeshes.push({ mesh, x: f.x, z: f.z });
  });
}
