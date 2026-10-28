import * as THREE from 'three';
import { C, MeshBuilder } from '../core/builder.js';
import { makeWaterMaterial } from './water.js';
import { drawSign } from '../env/textures.js';
import { patch } from '../env/materials.js';

// Road surfaces, bridges, the river channel and the single-track railway.

export const LIFT = { main: 0.07, local: 0.06, farm: 0.05, path: 0.05 };
const ROAD_MAT = { main: 'roadMain', local: 'roadLocal', farm: 'gravel' };

function quadUp(b, p0, p1, p2, p3, color) {
  const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
  const vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
  const ny = uz * vx - ux * vz;
  if (ny >= 0) b.quad(p0, p1, p2, p3, color); else b.quad(p0, p3, p2, p1, color);
}
function normalAt(pts, i) {
  const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
  const tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1;
  return [-tz / l, tx / l, tx / l, tz / l]; // nx, nz, tx, tz
}

export function buildRoads(plan, chunks, col, extras) {
  const white = C(0xffffff);
  for (const road of plan.roads) {
    const key = road.type === 'path' ? (road.gravel ? 'gravel' : 'dirt') : ROAD_MAT[road.type];
    const lift = LIFT[road.type];
    const pts = road.poly.pts, prof = road.prof, n = pts.length;
    const STEP = 40;
    for (let k = 0; k < n - 1; k += STEP) {
      const e = Math.min(n - 1, k + STEP);
      const seg = [];
      for (let i = k; i <= e; i++) seg.push([pts[i][0], prof[i] + lift, pts[i][1]]);
      const mid = pts[(k + e) >> 1];
      chunks.get(key, mid[0], mid[1]).strip(seg, road.w, white, { v0: road.poly.s[k] });
    }
  }
  let named = 0;
  for (const br of plan.bridges) { buildBridge(br, chunks, col, extras, named); if (br.road.type !== 'farm') named++; }
}

const BRIDGE_NAMES = [['夏目橋', 'なつめばし'], ['南橋', 'みなみばし'], ['小川橋', 'おがわばし']];
function buildBridge(br, chunks, col, extras, nameIdx) {
  const { road, a, b } = br;
  const pts = road.poly.pts, prof = road.prof, n = pts.length;
  const lift = LIFT[road.type];
  const hw = road.w / 2;
  const small = road.type === 'farm' || road.type === 'path';
  const conc = C(0xb8b4aa), concDark = C(0x8f8b80), rail = C(0x6f7f86);
  const rib = [];
  for (let i = a; i <= b; i++) rib.push([pts[i][0], pts[i][1], prof[i] + lift]);
  col.addRibbon(rib, hw + 0.7, small ? 'concrete' : 'asphalt', 'bridge');
  const mid = pts[(a + b) >> 1];
  const B = chunks.get('concrete', mid[0], mid[1]);
  const P = chunks.get('plain', mid[0], mid[1]);
  const i0 = Math.max(0, a - 1), i1 = Math.min(n - 1, b + 1);
  // deck slab
  for (let i = i0; i < i1; i++) {
    const p = pts[i], q = pts[i + 1];
    const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz);
    const y = Math.min(prof[i], prof[i + 1]) + lift - 0.03;
    B.place((p[0] + q[0]) / 2, y - 0.75, (p[1] + q[1]) / 2, Math.atan2(dx, dz));
    B.box(0, 0, 0, road.w + 0.7, 0.75, L + 0.04, conc, { noTop: true });
  }
  // parapets / railings
  const pH = small ? 0.7 : 0.95;
  for (const side of [1, -1]) {
    const line = [];
    for (let i = i0 - 1; i <= i1 + 1; i++) {
      const j = Math.max(0, Math.min(n - 1, i));
      const [nx, nz] = normalAt(pts, j);
      line.push([pts[j][0] + nx * side * (hw + 0.2), prof[j] + lift, pts[j][1] + nz * side * (hw + 0.2)]);
    }
    for (let i = 0; i < line.length - 1; i++) {
      const p = line[i], q = line[i + 1];
      const dx = q[0] - p[0], dz = q[2] - p[2], L = Math.hypot(dx, dz);
      if (L < 0.05) continue;
      const y = Math.min(p[1], q[1]) - 0.05;
      if (small) {
        P.place((p[0] + q[0]) / 2, y, (p[2] + q[2]) / 2, Math.atan2(dx, dz));
        P.box(0, pH - 0.08, 0, 0.08, 0.08, L + 0.02, rail);
        P.box(0, pH * 0.5, 0, 0.05, 0.05, L + 0.02, rail);
        P.box(0, 0, -L / 2, 0.08, pH, 0.08, rail);
      } else {
        B.place((p[0] + q[0]) / 2, y, (p[2] + q[2]) / 2, Math.atan2(dx, dz));
        B.box(0, 0, 0, 0.24, pH, L + 0.03, conc, { topColor: concDark });
      }
      col.addSegment(p[0], p[2], q[0], q[2], 0.14, 3, 'parapet');
    }
    if (!small) {
      // end posts with name plates
      for (const end of [0, line.length - 1]) {
        const p = line[end];
        const q = line[end === 0 ? 1 : end - 1];
        const ang = Math.atan2(q[0] - p[0], q[2] - p[2]);
        B.place(p[0], p[1] - 0.05, p[2], ang);
        B.box(0, 0, 0, 0.42, pH + 0.35, 0.42, concDark);
        const names = BRIDGE_NAMES[nameIdx % BRIDGE_NAMES.length];
        const text = end === 0 ? names[0] : names[1];
        const t = drawSign(text, { w: 256, h: 512, vertical: true, bg: '#2d2a26', fg: '#d8c9a2', border: '#8a8070', borderW: 10 });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.52), patch(new THREE.MeshLambertMaterial({ map: t }), { key: 'sign' }));
        // plate faces the road (toward -side normal)
        const [nx, nz] = normalAt(pts, end === 0 ? i0 : i1);
        m.position.set(p[0] - nx * side * 0.22, p[1] + pH * 0.55, p[2] - nz * side * 0.22);
        m.lookAt(m.position.x - nx * side, m.position.y, m.position.z - nz * side);
        extras.push(m);
      }
    }
  }
}

export function buildRiver(plan, chunks, col, extras) {
  const R = plan.river;
  const pts = R.poly.pts, n = pts.length;
  const mat = makeWaterMaterial();
  const STEP = 60;
  const conc = C(0xaaa69a), concWet = C(0x7c7a70);
  for (let k = 0; k < n - 1; k += STEP) {
    const e = Math.min(n - 1, k + STEP);
    const pos = [], uv = [], flow = [], idx = [];
    for (let i = k; i <= e; i++) {
      const [nx, nz, tx, tz] = normalAt(pts, i);
      const y = R.water[i];
      const hw = 6.7;
      pos.push(pts[i][0] + nx * hw, y, pts[i][1] + nz * hw, pts[i][0] - nx * hw, y, pts[i][1] - nz * hw);
      uv.push(0, R.poly.s[i], 1, R.poly.s[i]);
      flow.push(tx, tz, tx, tz);
    }
    for (let i = 0; i < e - k; i++) { const a = i * 2; idx.push(a, a + 3, a + 1, a, a + 2, a + 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('flow', new THREE.Float32BufferAttribute(flow, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = false;
    m.name = 'river';
    extras.push(m);
    // banks
    const mid = pts[(k + e) >> 1];
    const B = chunks.get('concrete', mid[0], mid[1]);
    for (const side of [1, -1]) {
      for (let i = k; i < e; i++) {
        const [n0x, n0z] = normalAt(pts, i), [n1x, n1z] = normalAt(pts, i + 1);
        const pi = pts[i], pj = pts[i + 1];
        const a = [pi[0] + n0x * side * 6.2, R.water[i] - 0.45, pi[1] + n0z * side * 6.2];
        const bq = [pj[0] + n1x * side * 6.2, R.water[i + 1] - 0.45, pj[1] + n1z * side * 6.2];
        const c = [pj[0] + n1x * side * 10.3, R.bank[i + 1] + 0.04, pj[1] + n1z * side * 10.3];
        const d = [pi[0] + n0x * side * 10.3, R.bank[i] + 0.04, pi[1] + n0z * side * 10.3];
        const midA = [pi[0] + n0x * side * 7.0, R.water[i] + 0.25, pi[1] + n0z * side * 7.0];
        const midB = [pj[0] + n1x * side * 7.0, R.water[i + 1] + 0.25, pj[1] + n1z * side * 7.0];
        quadUp(B, a, bq, midB, midA, concWet);
        quadUp(B, midA, midB, c, d, conc);
      }
    }
  }
  // keep people out of the channel except on bridges
  const nearBridge = (x, z) => plan.bridges.some(({ road, a, b }) => {
    const q = road.poly.nearest(x, z, 30);
    return q && q.d < road.w / 2 + 1.0 && q.i >= a - 3 && q.i <= b + 3;
  });
  for (const side of [1, -1]) {
    let prev = null;
    for (let i = 0; i < n; i += 2) {
      const [nx, nz] = normalAt(pts, i);
      const p = [pts[i][0] + nx * side * 10.4, pts[i][1] + nz * side * 10.4];
      if (Math.abs(p[0]) > 900 || nearBridge(p[0], p[1])) { prev = null; continue; }
      if (prev) col.addSegment(prev[0], prev[1], p[0], p[1], 0.1, 3, 'river');
      prev = p;
    }
  }
}

export function buildRail(plan, chunks, extras) {
  const { poly, top, west, east } = plan.rail;
  const pts = poly.pts, n = pts.length;
  const i0 = Math.max(0, west - 3), i1 = Math.min(n - 1, east + 3);
  const white = C(0xffffff), railTop = C(0xb8b8b4), railSide = C(0x5e4636), slope = C(0xe0dcd4);
  const STEP = 50;
  for (let k = i0; k < i1; k += STEP) {
    const e = Math.min(i1, k + STEP);
    const mid = pts[(k + e) >> 1];
    const B = chunks.get('ballast', mid[0], mid[1]);
    const seg = [];
    for (let i = k; i <= e; i++) seg.push([pts[i][0], top[i], pts[i][1]]);
    B.strip(seg, 3.0, white, { v0: poly.s[k] / 3 });
    for (const side of [1, -1]) {
      for (let i = k; i < e; i++) {
        const [n0x, n0z] = normalAt(pts, i), [n1x, n1z] = normalAt(pts, i + 1);
        const a = [pts[i][0] + n0x * side * 1.5, top[i], pts[i][1] + n0z * side * 1.5];
        const b = [pts[i + 1][0] + n1x * side * 1.5, top[i + 1], pts[i + 1][1] + n1z * side * 1.5];
        const c = [pts[i + 1][0] + n1x * side * 2.45, top[i + 1] - 0.5, pts[i + 1][1] + n1z * side * 2.45];
        const d = [pts[i][0] + n0x * side * 2.45, top[i] - 0.5, pts[i][1] + n0z * side * 2.45];
        quadUp(B, a, b, c, d, slope);
      }
    }
    // rails (top + two sides)
    const P = chunks.get('plain', mid[0], mid[1]);
    for (const off of [0.5335, -0.5335]) {
      for (let i = k; i < e; i++) {
        const [n0x, n0z] = normalAt(pts, i), [n1x, n1z] = normalAt(pts, i + 1);
        const yt0 = top[i] + 0.25, yt1 = top[i + 1] + 0.25, yb0 = top[i] + 0.1, yb1 = top[i + 1] + 0.1;
        const L = (o, j, nx, nz, y) => [pts[j][0] + nx * (off + o), y, pts[j][1] + nz * (off + o)];
        quadUp(P, L(-0.035, i, n0x, n0z, yt0), L(-0.035, i + 1, n1x, n1z, yt1), L(0.035, i + 1, n1x, n1z, yt1), L(0.035, i, n0x, n0z, yt0), railTop);
        // sides: build as vertical quads (normal computed)
        P.quad(L(0.035, i, n0x, n0z, yb0), L(0.035, i + 1, n1x, n1z, yb1), L(0.035, i + 1, n1x, n1z, yt1), L(0.035, i, n0x, n0z, yt0), railSide);
        P.quad(L(-0.035, i + 1, n1x, n1z, yb1), L(-0.035, i, n0x, n0z, yb0), L(-0.035, i, n0x, n0z, yt0), L(-0.035, i + 1, n1x, n1z, yt1), railSide);
      }
    }
  }
  // sleepers
  const s0 = poly.s[i0], s1 = poly.s[i1];
  const count = Math.floor((s1 - s0) / 0.62);
  const g = new THREE.BoxGeometry(2.05, 0.15, 0.22);
  const sm = patch(new THREE.MeshLambertMaterial({ color: 0x8e8a84 }), { key: 'sleeper' });
  const CH = 300;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pv = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  for (let c0 = 0; c0 < count; c0 += CH) {
    const cn = Math.min(CH, count - c0);
    const im = new THREE.InstancedMesh(g, sm, cn);
    for (let k = 0; k < cn; k++) {
      const s = s0 + (c0 + k) * 0.62;
      const p = poly.at(s);
      const y = poly.sampleArray(top, s) + 0.06;
      pv.set(p.x, y, p.z);
      q.setFromAxisAngle(up, Math.atan2(p.tx, p.tz));
      m4.compose(pv, q, sc);
      im.setMatrixAt(k, m4);
    }
    im.computeBoundingSphere();
    im.receiveShadow = true;
    im.name = 'sleepers';
    extras.push(im);
  }
  // tunnel portals
  for (const [pi, dirSign] of [[west, 1], [east, -1]]) {
    const p = pts[pi], q2 = pts[Math.max(0, Math.min(n - 1, pi + dirSign * 3))];
    const ox = q2[0] - p[0], oz = q2[1] - p[1], ol = Math.hypot(ox, oz);
    const ang = Math.atan2(ox / ol, oz / ol); // local +z faces out of the tunnel
    const y = top[pi] - 0.5;
    const B = chunks.get('concrete', p[0], p[1]);
    B.place(p[0], y, p[1], ang);
    const conc = C(0x9a968c);
    B.box(-3.6, 0, 0, 2.4, 8.5, 1.4, conc);
    B.box(3.6, 0, 0, 2.4, 8.5, 1.4, conc);
    B.box(0, 5.4, 0, 4.8, 3.1, 1.4, conc);
    B.box(0, 8.5, 0.1, 10.2, 0.5, 1.8, C(0x7e7a72));
    // arch spandrels
    const r = 2.4, cy = 3.0, zf = 0.7;
    for (let k = 0; k < 8; k++) {
      const a0 = (k / 8) * Math.PI, a1 = ((k + 1) / 8) * Math.PI;
      const x0 = Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r, x1 = Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
      const cornerX = (x0 + x1) / 2 > 0 ? r : -r;
      B.tri([x0, y0, zf], [cornerX, 5.4, zf], [x1, y1, zf], conc);
      B.tri([x0, y0, zf], [x1, y1, zf], [cornerX, 5.4, zf], conc);
    }
    // darkness inside
    const dark = new MeshBuilder();
    const blk = C(0x050505);
    dark.quad([-r, 0, 0], [r, 0, 0], [r, cy, 0], [-r, cy, 0], blk);
    for (let k = 0; k < 12; k++) {
      const a0 = (k / 12) * Math.PI, a1 = ((k + 1) / 12) * Math.PI;
      dark.tri([0, cy, 0], [Math.cos(a0) * r, cy + Math.sin(a0) * r, 0], [Math.cos(a1) * r, cy + Math.sin(a1) * r, 0], blk);
    }
    const dm = new THREE.Mesh(dark.build(), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    dm.position.set(p[0] + (ox / ol) * 0.3, y, p[1] + (oz / ol) * 0.3);
    dm.rotation.y = ang;
    extras.push(dm);
  }
}
