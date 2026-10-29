import * as THREE from 'three';
import { C } from '../core/builder.js';
import { RNG } from '../core/noise.js';
import { LotCtx } from './buildings.js';
import { F } from './planner.js';
import { LIFT } from './roads.js';
import { drawSign, canvas, tex, JP_SANS } from '../env/textures.js';
import { patch, U } from '../env/materials.js';
import { CF } from './collision.js';

// Street furniture: concrete utility poles with sagging wires, street lamps, vending machines,
// curve mirrors, road signs and guardrails.

const WHITE = C(0xffffff);
const place = (W, x, z, h, ang) => new LotCtx({ x, z, h, ang }, W);

export function buildPoles(W) {
  const rng = new RNG(808);
  const poles = [];
  const wires = [];
  const nearLot = (x, z, r) => W.plan.lots.some((l) => Math.abs(l.x - x) < r && Math.abs(l.z - z) < r);
  for (const road of W.plan.roads) {
    if (road.type !== 'main' && road.type !== 'local') continue;
    const side = road.name === 'main' ? -1 : 1;
    let prev = null, count = 0;
    for (let s = 5; s < road.poly.length - 3; s += 31 + rng.float(-2, 3)) {
      const p = road.poly.at(s);
      if (Math.abs(p.x) > 790) { prev = null; continue; }
      const nx = -p.tz * side, nz = p.tx * side;
      const off = road.w / 2 + 0.55;
      const x = p.x + nx * off, z = p.z + nz * off;
      const occ = W.plan.occAt(x, z);
      if ((occ & (F.RIVER | F.RAIL | F.ROAD | F.SPECIAL)) || W.plan.riverDist(x, z) < 12.5) { prev = null; continue; }
      const y = W.hm.sample(x, z);
      const village = nearLot(x, z, 45);
      const pole = { x, z, y, nx, nz, tx: p.tx, tz: p.tz, lamp: village ? count % 2 === 0 : count % 4 === 0, trans: count % 5 === 2 };
      poles.push(pole);
      buildPole(W, pole, rng, !prev);
      if (prev && Math.hypot(prev.x - x, prev.z - z) < 50) {
        for (const k of [-0.75, 0, 0.75]) wires.push([prev.x + prev.nx * k, prev.y + 10.15, prev.z + prev.nz * k, x + nx * k, y + 10.15, z + nz * k, 0.32]);
        wires.push([prev.x, prev.y + 7.4, prev.z, x, y + 7.4, z, 0.55]);
        if (village) wires.push([prev.x + prev.nx * 0.25, prev.y + 6.9, prev.z + prev.nz * 0.25, x + nx * 0.25, y + 6.9, z + nz * 0.25, 0.6]);
      } else if (prev) guy(W, prev);
      prev = pole; count++;
    }
    if (prev) guy(W, prev);
  }
  // service drops to houses
  for (const lot of W.plan.lots) {
    const L = new LotCtx(lot, W);
    const ax = L.wx(0, -lot.d / 2 + 4.5), az = L.wz(0, -lot.d / 2 + 4.5);
    let best = null, bd = 34;
    for (const p of poles) { const d = Math.hypot(p.x - ax, p.z - az); if (d < bd) { bd = d; best = p; } }
    if (best) wires.push([best.x, best.y + 7.0, best.z, ax, lot.h + 3.6, az, 0.25]);
  }
  // wire geometry: catenary polylines
  const pos = [];
  for (const [x0, y0, z0, x1, y1, z1, sag] of wires) {
    const n = 10;
    let px = x0, py = y0, pz = z0;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, y = y0 + (y1 - y0) * t - sag * 4 * t * (1 - t);
      pos.push(px, py, pz, x, y, z);
      px = x; py = y; pz = z;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeBoundingSphere();
  const lines = new THREE.LineSegments(g, patch(new THREE.LineBasicMaterial({ color: 0x1c1e20 }), { key: 'wire' }));
  lines.name = 'wires';
  lines.frustumCulled = false;
  W.scene.add(lines);
  W.poles = poles;
  W.wires = wires;
}

function buildPole(W, p, rng, first) {
  const ang = Math.atan2(p.nx, p.nz); // local +z points away from the road
  const L = place(W, p.x, p.z, p.y, ang);
  const P = L.get('plain');
  const conc = C(0x9e9c96), steel = C(0x5e6062), ins = C(0xe4e2da);
  P.cyl(0, 0, 0, 0.17, 0.12, 10.6, 8, conc, { cap: true });
  P.box(0, 10.0, 0, 1.9, 0.11, 0.11, steel);
  for (const k of [-0.75, 0, 0.75]) P.cyl(k, 10.06, 0, 0.045, 0.035, 0.16, 5, ins);
  P.box(0, 7.3, 0, 0.7, 0.08, 0.08, steel);
  P.box(0, 2.2, -0.14, 0.18, 0.3, 0.02, C(0xe8e8e0));
  // step bolts
  for (let y = 2.5; y < 9; y += 0.45) P.box(0.16 * (Math.round(y / 0.45) % 2 ? 1 : -1), y, 0, 0.16, 0.03, 0.03, steel);
  if (p.trans) {
    for (const k of [-0.28, 0.28]) P.cyl(k, 8.0, 0.3, 0.24, 0.24, 0.95, 10, C(0x8a9096), { cap: true });
    P.box(0, 7.9, 0.3, 0.9, 0.06, 0.5, steel);
  }
  if (p.lamp) {
    P.tube(0, 6.4, 0, 0, 6.9, -1.4, 0.04, 5, C(0x8a8e92));
    P.box(0, 6.82, -1.5, 0.22, 0.12, 0.55, C(0x6a6e72));
    L.get('lampGlow').box(0, 6.78, -1.5, 0.16, 0.04, 0.45, C(0xf2f6ff));
    const lx = L.wx(0, -1.5), lz = L.wz(0, -1.5);
    const warm = rng.chance(0.3);
    W.lamps.push({ x: lx, z: lz, y: p.y + 6.75, ground: W.hm.sample(lx, lz), color: warm ? 0xffd9a8 : 0xe6eeff, r: 6.5 });
  }
  W.col.addCircle(p.x, p.z, 0.22, CF.ALL, 'pole');
}

function guy(W, p) {
  // guy wire with the yellow protective sleeve, anchored along the road
  const L = place(W, p.x, p.z, p.y, Math.atan2(p.tx, p.tz));
  const P = L.get('plain');
  P.tube(0, 8.0, 0, 0, 0.1, 3.0, 0.012, 3, C(0x2a2a2a));
  P.tube(0, 1.9, 2.3, 0, 0.05, 3.0, 0.05, 6, C(0xf2c418));
  W.col.addCircle(L.wx(0, 2.6), L.wz(0, 2.6), 0.15);
}

export function buildVending(W) {
  for (const v of W.vending) {
    const L = place(W, v.x, v.z, v.y, v.ang);
    const P = L.get('plain');
    const body = C(v.color);
    P.box(0, 0, 0, 1.0, 1.84, 0.78, body);
    P.box(0, 0.05, 0.395, 0.94, 0.66, 0.02, C(0xe8e8e4));
    P.box(-0.12, 0.12, 0.405, 0.58, 0.22, 0.03, C(0x161616));
    P.box(0.32, 0.5, 0.41, 0.2, 0.26, 0.04, C(0xb8b8b8));
    P.box(0.32, 0.55, 0.43, 0.04, 0.1, 0.01, C(0x222222));
    L.get('vend' + v.variant).quad([-0.44, 0.76, 0.397], [0.44, 0.76, 0.397], [0.44, 1.74, 0.397], [-0.44, 1.74, 0.397], WHITE, [0, 0, 1, 1]);
    L.get('lampGlow').box(0, 1.76, 0.33, 0.9, 0.06, 0.08, C(0xf0f4ff));
    L.box(0, 0, 0.52, 0.42);
    const fx = L.wx(0, 0.9), fz = L.wz(0, 0.9);
    W.interact.push({ x: fx, z: fz, y: v.y, r: 1.25, kind: 'vending', vm: v, label: 'Купить напиток (¥130)' });
    W.lampSources.push({ x: L.wx(0, 0.75), z: L.wz(0, 0.75), y: v.y + 1.3, color: 0xd6eaff, power: 1.0, vending: true });
    W.pools.push({ x: L.wx(0, 1.0), z: L.wz(0, 1.0), y: v.y, r: 2.0, color: 0xcfe4ff, k: 0.6 });
    W.hums.push({ x: v.x, y: v.y + 1, z: v.z });
    W.landmarkIcons.push({ x: v.x, z: v.z, icon: '●', small: true });
  }
}

export function buildMirrorsAndSigns(W) {
  const main = W.plan.byName.main;
  const mirrorMat = patch(new THREE.MeshStandardMaterial({ color: 0xc8d4dc, metalness: 0.9, roughness: 0.15, emissive: 0x2a3440, emissiveIntensity: 0.6 }), { key: 'mirror' });
  const stopT = (() => {
    const [c, x] = canvas(256);
    x.fillStyle = '#d42a24'; x.beginPath(); x.moveTo(8, 20); x.lineTo(248, 20); x.lineTo(128, 236); x.closePath(); x.fill();
    x.strokeStyle = '#ffffff'; x.lineWidth = 10; x.stroke();
    x.fillStyle = '#ffffff'; x.font = `900 60px ${JP_SANS}`; x.textAlign = 'center'; x.fillText('止まれ', 128, 100);
    return tex(c, { clamp: true });
  })();
  const stopMat = patch(new THREE.MeshLambertMaterial({ map: stopT, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }), { key: 'sign' });
  const speedMat = (n) => patch(new THREE.MeshLambertMaterial({ map: (() => {
    const [c, x] = canvas(128); x.fillStyle = '#ffffff'; x.beginPath(); x.arc(64, 64, 62, 0, 7); x.fill();
    x.strokeStyle = '#d42a24'; x.lineWidth = 14; x.beginPath(); x.arc(64, 64, 54, 0, 7); x.stroke();
    x.fillStyle = '#1a3a9a'; x.font = '900 58px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(n, 64, 68);
    return tex(c, { clamp: true });
  })(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }), { key: 'sign' });
  const sp40 = speedMat('40'), sp30 = speedMat('30');
  for (const road of W.plan.roads) {
    if (road.type !== 'local') continue;
    for (const endI of [0, road.poly.pts.length - 1]) {
      const [x0, z0] = road.poly.pts[endI];
      const q = main.poly.nearest(x0, z0, 8);
      if (!q) continue;
      const s = endI === 0 ? main.w / 2 + 3 : road.poly.length - main.w / 2 - 3;
      const p = road.poly.at(s);
      const dir = endI === 0 ? 1 : -1; // pointing away from the main road
      const tx = p.tx * dir, tz = p.tz * dir;
      const nx = -tz, nz = tx;
      const mx = p.x + nx * (road.w / 2 + 0.9), mz = p.z + nz * (road.w / 2 + 0.9);
      const y = W.hm.sample(mx, mz);
      const L = place(W, mx, mz, y, Math.atan2(-tx, -tz));
      const P = L.get('plain');
      P.cyl(0, 0, 0, 0.05, 0.05, 2.9, 6, C(0xe8702a));
      P.box(0, 2.55, 0.05, 0.08, 0.5, 0.08, C(0xe8702a));
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.38, 20), mirrorMat);
      const rim = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.45, 20), new THREE.MeshLambertMaterial({ color: 0xe8702a, side: THREE.DoubleSide }));
      const grp = new THREE.Group(); grp.add(disc, rim); grp.rotation.x = -0.12;
      L.mesh(grp, 0, 2.8, 0.1, 0.5);
      W.col.addCircle(mx, mz, 0.1);
      // stop sign for traffic coming from the local road
      const sx = p.x - nx * (road.w / 2 + 0.7), sz = p.z - nz * (road.w / 2 + 0.7);
      const sy = W.hm.sample(sx, sz);
      const S = place(W, sx, sz, sy, Math.atan2(tx, tz));
      S.get('plain').cyl(0, 0, 0, 0.035, 0.035, 2.3, 5, C(0xd8d8d8));
      S.mesh(new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.75), stopMat), 0, 2.1, 0.05);
      W.col.addCircle(sx, sz, 0.08);
      break;
    }
    // speed limit near the start of each local road
    if (road.poly.length > 120) addSpeedSign(W, road, 40, 1, sp30);
  }
  for (let s = 120; s < main.poly.length; s += 320) addSpeedSign(W, main, s, -1, sp40);
}
function addSpeedSign(W, road, s, side, mat) {
  const p = road.poly.at(s);
  if (Math.abs(p.x) > 780) return;
  const nx = -p.tz * side, nz = p.tx * side;
  const x = p.x + nx * (road.w / 2 + 0.8), z = p.z + nz * (road.w / 2 + 0.8);
  if (W.plan.occAt(x, z) & (F.ROAD | F.RIVER)) return;
  const L = place(W, x, z, W.hm.sample(x, z), Math.atan2(-p.tx * side, -p.tz * side));
  L.get('plain').cyl(0, 0, 0, 0.035, 0.035, 2.4, 5, C(0xd8d8d8));
  L.mesh(new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), mat), 0, 2.15, 0.05);
  W.col.addCircle(x, z, 0.08);
}

export function buildGuardrails(W) {
  const plan = W.plan;
  for (const road of plan.roads) {
    if (road.type === 'farm' || road.type === 'path') continue;
    for (const side of [1, -1]) {
      let run = [];
      const flush = () => { if (run.length >= 4) railRun(W, run); run = []; };
      for (let s = 0; s < road.poly.length; s += 2) {
        const p = road.poly.at(s);
        if (Math.abs(p.x) > 785) { flush(); continue; }
        const nx = -p.tz * side, nz = p.tx * side;
        const ex = p.x + nx * (road.w / 2 + 0.35), ez = p.z + nz * (road.w / 2 + 0.35);
        const ox = p.x + nx * (road.w / 2 + 3), oz = p.z + nz * (road.w / 2 + 3);
        const rh = road.poly.sampleArray(road.prof, s);
        const rd = plan.riverDist(ex, ez);
        const occ = plan.occAt(ex, ez);
        const want = (rd < 17 && rd > 10.8) || rh - W.hm.sample(ox, oz) > 1.3;
        if (!want || (occ & (F.LOT | F.SPECIAL)) || (occ & F.ROAD && plan.occAt(ox, oz) & F.ROAD)) { flush(); continue; }
        run.push([ex, rh + LIFT[road.type], ez]);
      }
      flush();
    }
  }
}
function railRun(W, run) {
  const mid = run[run.length >> 1];
  const P = W.chunks.get('plain', mid[0], mid[2]);
  const white = C(0xe8e8e4), post = C(0xd8d8d4);
  for (let i = 0; i < run.length; i++) {
    const [x, y, z] = run[i];
    P.place(x, y, z, 0);
    P.cyl(0, -0.3, 0, 0.05, 0.05, 1.05, 6, post, { cap: true });
    if (i < run.length - 1) {
      const [x2, y2, z2] = run[i + 1];
      const dx = x2 - x, dz = z2 - z, L = Math.hypot(dx, dz);
      P.place((x + x2) / 2, (y + y2) / 2, (z + z2) / 2, Math.atan2(dx, dz));
      P.box(0, 0.42, 0, 0.06, 0.32, L + 0.03, white);
      W.col.addSegment(x, z, x2, z2, 0.08, CF.ALL, 'rail');
    }
  }
}

// additive light pools under lamps and in front of vending machines
export function buildLightPools(W, T) {
  const pos = [], uv = [], col = [], k = [], idx = [];
  const c = new THREE.Color();
  const add = (x, y, z, r, color, kk) => {
    const b = pos.length / 3;
    c.setHex(color);
    for (const [dx, dz, u, v] of [[-r, -r, 0, 0], [r, -r, 1, 0], [r, r, 1, 1], [-r, r, 0, 1]]) {
      pos.push(x + dx, y + 0.07, z + dz); uv.push(u, v); col.push(c.r, c.g, c.b); k.push(kk);
    }
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  };
  for (const l of W.lamps) add(l.x, l.ground, l.z, l.r, l.color, 1);
  for (const p of W.pools) add(p.x, p.y, p.z, p.r, p.color, p.k);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('k', new THREE.Float32BufferAttribute(k, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: T.pool }, uLamps: U.uLamps, uNight: U.uNight, uFest: U.uFest },
    vertexShader: `attribute float k; varying vec2 vUv; varying vec3 vCol; varying float vK; varying float vDist;
      void main() { vUv = uv; vCol = color; vK = k; vec4 wp = modelMatrix * vec4(position, 1.0); vDist = distance(wp.xyz, cameraPosition); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform sampler2D map; uniform float uLamps, uNight, uFest; varying vec2 vUv; varying vec3 vCol; varying float vK; varying float vDist;
      void main() { float a = texture2D(map, vUv).a; float on = vK < 0.0 ? uFest * -vK : vK > 0.95 ? uLamps : uNight * vK; gl_FragColor = vec4(vCol * a * on * 0.22 * exp(-vDist * 0.004), 1.0); }`,
    vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6,
  });
  const m = new THREE.Mesh(g, mat);
  m.renderOrder = 3;
  m.name = 'lightPools';
  W.scene.add(m);
}
