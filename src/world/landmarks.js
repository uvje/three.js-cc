import * as THREE from 'three';
import { C, varyColor } from '../core/builder.js';
import { RNG } from '../core/noise.js';
import * as MD from './models.js';
import { LotCtx } from './buildings.js';
import { drawSign, canvas, tex, JP_SERIF, JP_SANS } from '../env/textures.js';
import { patch } from '../env/materials.js';
import { CF } from './collision.js';

// Shrine, station, level crossing, school, community hall, bus stops, jizo, the great camphor and the hilltop lookout.

const VERM = 0xd2452a;
const at = (W, x, z, h, ang) => new LotCtx({ x, z, h, ang }, W);

function stripeTex(c1 = '#f2c418', c2 = '#1a1a1a', n = 8) {
  const [c, x] = canvas(64, 256);
  x.fillStyle = c1; x.fillRect(0, 0, 64, 256);
  x.fillStyle = c2;
  for (let i = -2; i < n * 2; i++) { x.beginPath(); x.moveTo(0, i * 32); x.lineTo(64, i * 32 - 32); x.lineTo(64, i * 32 - 16); x.lineTo(0, i * 32 + 16); x.fill(); }
  return tex(c);
}

export function torii(get, color = VERM, w = 4.6, h = 4.8, stone = false) {
  const P = get('plain');
  const c = C(color), blk = C(0x1a1a1a);
  for (const sx of [-1, 1]) {
    P.cyl(sx * w / 2 * 0.74, 0, 0, 0.24, 0.2, h, 12, c);
    if (!stone) P.cyl(sx * w / 2 * 0.74, 0, 0, 0.3, 0.28, 0.45, 12, blk);
  }
  P.box(0, h * 0.78, 0, w * 0.9, 0.24, 0.22, c);
  P.box(0, h - 0.05, 0, w + 0.5, 0.3, 0.42, c, { topColor: stone ? c : blk });
  if (!stone) P.box(0, h + 0.25, 0, w + 0.8, 0.14, 0.46, blk);
  for (const sx of [-1, 1]) { P.push(); P.translate(sx * (w / 2 + 0.25), h + 0.1, 0); P.rotateZ(-sx * 0.12); P.box(0, 0, 0, 0.5, 0.28, 0.44, stone ? c : blk); P.pop(); }
  P.box(0, h * 0.78 + 0.12, 0, 0.22, h * 0.22 - 0.2, 0.18, c);
}

function hall(get, rng, w, d, o = {}) {
  // traditional shrine-style hall on a raised wooden floor
  const P = get('plain'), Wd = get('wood');
  const post = C(o.post || 0xb8452e), wall = C(o.wall || 0x6a4a32), floor = C(0x5a4030);
  P.box(0, 0, 0, w + 0.6, 0.4, d + 0.6, C(0x9a968c));
  P.box(0, 0.4, 0, w + 0.4, 0.45, d + 0.4, floor);
  Wd.box(0, 0.85, 0, w, 2.6, d, wall, { noTop: true });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(sx * w / 2, 0.85, sz * d / 2, 0.24, 2.7, 0.24, post);
  for (let i = 1; i < 4; i++) P.box(-w / 2 + (i * w) / 4, 0.85, d / 2 + 0.01, 0.2, 2.6, 0.2, post);
  // lattice doors on the front
  const S = get('shojiA');
  for (let i = 0; i < 4; i++) {
    const u = -w / 2 + (i + 0.5) * (w / 4);
    S.quad([u - w / 8 + 0.12, 0.9, d / 2 + 0.04], [u + w / 8 - 0.12, 0.9, d / 2 + 0.04], [u + w / 8 - 0.12, 3.3, d / 2 + 0.04], [u - w / 8 + 0.12, 3.3, d / 2 + 0.04], C(0xffffff), [0, 0, 1, 1]);
  }
  // front steps
  for (let i = 0; i < 3; i++) P.box(0, i * 0.28, d / 2 + 0.45 + (2 - i) * 0.3, w * 0.4, 0.28, 0.3, floor);
  const roofKey = o.copper ? 'plain' : 'kawara';
  const roofC = o.copper ? C(0x5a8a78) : C(0x8c94a0);
  const R = get(roofKey); R.translate(0, 3.45, 0);
  R.hipRoof(w, d, 0, 1.3, 0.62, roofC, { ridgeColor: C(o.copper ? 0x3e6a5a : 0x4a5058), irimoya: true, gableColor: C(0x8a6a48), thickness: 0.35 });
  // chigi & katsuogi on the ridge (shrine roof ornaments)
  const rh = 3.45 + (d / 2) * 0.62;
  for (const sx of [-1, 1]) { P.push(); P.translate(sx * (w / 2 - 0.6), rh + 0.5, 0); P.rotateZ(sx * 0.5); P.box(0, -0.6, 0, 0.12, 1.4, 0.12, C(0x2a2a2a)); P.pop(); }
  for (let i = -1; i <= 1; i++) { P.push(); P.translate(i * w * 0.18, rh + 0.25, 0); P.rotateZ(Math.PI / 2); P.cyl(0, -0.45, 0, 0.12, 0.12, 0.9, 6, C(0xc8a038), { cap: true }); P.pop(); }
}

function komainu(get, mirror) {
  const P = get('plain');
  const st = C(0x8e8a80), st2 = C(0x7a766c);
  P.box(0, 0, 0, 0.9, 0.9, 0.9, st2, { topColor: st });
  P.blob(0, 1.25, -0.05, 0.32, 0.36, 0.38, st, null, 0, 1, 0.9);
  P.blob(0, 1.75, 0.12, 0.27, 0.27, 0.27, st, null, 0, 1, 0.9);
  P.blob(mirror * 0.12, 1.92, 0.05, 0.1, 0.1, 0.1, st, null, 0, 0, 0.9);
  P.blob(0, 1.6, -0.35, 0.12, 0.25, 0.12, st, null, 0, 0, 0.9);
}

export function buildLandmarks(W) {
  const A = W.plan.areas;
  const rng = new RNG(4321);
  shrine(W, A.shrine, rng);
  station(W, A.station, rng);
  crossing(W, rng);
  school(W, A.school, rng);
  communityHall(W, A.hall, rng);
  camphor(W, A.camphor, rng);
  lookout(W, A.lookout, rng);
  busStops(W, rng);
  jizoSpots(W, rng);
}

function shrine(W, S, rng) {
  const L = at(W, S.bottom[0], S.bottom[1], S.bottomH, S.ang);
  torii(L.at(0, 0, -2.5));
  L.circle(-1.7, -2.5, 0.35); L.circle(1.7, -2.5, 0.35);
  L.sign('なつめ神社', 0, 4.15, -2.36, 0.62, 1.2, { vertical: true, bg: '#1a1a1a', fg: '#d8b860', tw: 128, th: 256 });
  // stone stairs
  const rise = S.topH - S.bottomH, nSteps = Math.round(rise / 0.18), tread = S.run / nSteps, sh = rise / nSteps;
  const P = L.get('plain');
  const st = C(0x9a968c), st2 = C(0x86827a);
  for (let i = 0; i < nSteps; i++) P.box(0, i * sh - 0.4, i * tread + tread / 2, 3.2, sh + 0.4, tread + 0.02, i % 2 ? st : st2);
  for (const sx of [-1, 1]) {
    for (let i = 0; i < nSteps; i += 4) P.box(sx * 1.85, i * sh - 0.6, i * tread + tread * 2, 0.5, sh * 4 + 0.9, tread * 4 + 0.02, C(0x7e7a72));
    W.col.addSegment(L.wx(sx * 1.85, 0), L.wz(sx * 1.85, 0), L.wx(sx * 1.85, S.run), L.wz(sx * 1.85, S.run), 0.3, CF.ALL);
  }
  for (let i = 0; i < nSteps; i += 2) P.box(0, i * sh + sh, i * tread, 0.05, 0.9, 0.05, C(0x8a8e92));
  P.tube(0, 0.95, 0, 0, rise + 0.95, S.run, 0.035, 5, C(0xa0a4a8));
  W.col.addPlatform(L.wx(0, S.run / 2), L.wz(0, S.run / 2), 1.62, S.run / 2, S.ang, S.bottomH, S.topH, 'stone', 'stairs');
  W.col.addBox(L.wx(0, -0.6), L.wz(0, -0.6), 1.6, 0.4, S.ang, CF.BIKE, 'stairs');
  // terrace
  const T = at(W, S.top[0], S.top[1], S.topH, S.ang);
  torii(T.at(0, 0, 2.5), 0x9a968c, 3.8, 4.0, true);
  T.circle(-1.4, 2.5, 0.3); T.circle(1.4, 2.5, 0.3);
  for (const z of [6, 12]) for (const sx of [-1, 1]) { MD.stoneLantern(T.at(sx * 2.7, 0, z), 1.25); T.circle(sx * 2.7, z, 0.45); }
  for (const sx of [-1, 1]) { komainu(T.at(sx * 2.5, 0, 18, sx > 0 ? -0.3 : 0.3), sx); T.box(sx * 2.5, 18, 0.5, 0.5); }
  // stone path
  const Pt = T.get('plain');
  for (let z = 0.5; z < 24; z += 1.0) Pt.box(rng.float(-0.05, 0.05), 0, z, 1.6, 0.06, 0.92, varyColor(0xa8a49a, rng, 0.06));
  hall(T.at(0, 0, 26), rng, 8, 6.4, { post: VERM, wall: 0x5a3e2a, copper: true });
  T.box(0, 26, 4.5, 3.6);
  hall(T.at(0, 0.4, 32.5), rng, 4.2, 3.6, { post: VERM, wall: 0x4a3426, copper: true });
  T.box(0, 32.5, 2.6, 2.2);
  // offering box + bell
  const O = T.get('plain', 0, 0, 22.2);
  O.box(0, 0, 0, 1.6, 0.75, 0.7, C(0x5a3a26));
  for (let i = 0; i < 6; i++) O.box(-0.65 + i * 0.26, 0.75, 0, 0.08, 0.04, 0.6, C(0x3a2618));
  O.blob(0, 3.2, 0.1, 0.18, 0.18, 0.18, C(0xd8b040), null, 0, 1, 1);
  O.cyl(0, 1.3, 0.1, 0.04, 0.04, 1.8, 5, C(0xe8e0d0));
  O.cyl(0.03, 1.3, 0.12, 0.012, 0.012, 1.8, 3, C(0xc8282a));
  T.box(0, 22.2, 0.85, 0.4);
  W.interact.push({ x: T.wx(0, 21.2), z: T.wz(0, 21.2), y: S.topH, r: 1.8, kind: 'pray', label: 'Помолиться (¥5)' });
  W.shrinePos = { x: T.wx(0, 22.5), y: S.topH + 2.5, z: T.wz(0, 22.5) };
  // temizuya
  const Tz = T.get('plain', -8.5, 0, 10);
  Tz.box(0, 0, 0, 1.6, 0.7, 0.8, C(0x8a867e));
  Tz.box(0, 0.7, 0, 1.4, 0.05, 0.6, C(0x3a5a6a));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) Tz.box(sx * 1.1, 0, sz * 0.8, 0.14, 2.5, 0.14, C(VERM));
  const Kt = T.get('kawara', -8.5, 2.5, 10); Kt.gableRoof(2.6, 2.0, 0, 0.4, 0.6, C(0x8c94a0), { thickness: 0.15, gableColor: C(0x8a6a48) });
  T.box(-8.5, 10, 1.3, 1.0);
  // sacred tree with shimenawa
  T.tree('broad', 9, 15, 2.1);
  T.circle(9, 15, 1.1);
  const Sh = T.get('plain', 9, 0, 15);
  MD.torusX(Sh, 0, 2.2, 0, 0, 0, 1, C(0xe0d4b0));
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; Sh.tube(Math.cos(a) * 0.95, 2.25, Math.sin(a) * 0.95, Math.cos(a + 0.4) * 0.95, 2.22, Math.sin(a + 0.4) * 0.95, 0.07, 5, C(0xd8c8a0)); }
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; Sh.quad([Math.cos(a) * 1.0, 1.8, Math.sin(a) * 1.0], [Math.cos(a) * 1.0 + 0.1, 1.8, Math.sin(a) * 1.0], [Math.cos(a) * 1.0 + 0.1, 2.2, Math.sin(a) * 1.0], [Math.cos(a) * 1.0, 2.2, Math.sin(a) * 1.0], C(0xffffff)); }
  // banners
  for (const z of [8, 15]) for (const sx of [-1, 1]) {
    const p = T.get('plain', sx * 4.2, 0, z); p.cyl(0, 0, 0, 0.03, 0.03, 4.2, 5, C(0xd8d8d8));
    const t = drawSign('奉納 夏目神社', { w: 96, h: 512, vertical: true, bg: '#f4f0e8', fg: '#b8282a' });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 3.0), patch(new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide }), { key: 'sign' }));
    T.mesh(m, sx * 4.2 + 0.3 * sx, 2.4, z, Math.PI / 2);
    W.flags.push(m);
  }
  W.lampSources.push({ x: T.wx(0, 22), z: T.wz(0, 22), y: S.topH + 3.2, color: 0xffc070, power: 0.7 });
  W.landmarkIcons.push({ x: S.center[0], z: S.center[1], icon: '⛩' });
  // drink machine at the bottom of the stairs, of course
  L.vending(4.2, -1.5, -Math.PI / 2, 0, 0xe8e8e4);
}

function station(W, S, rng) {
  const L = at(W, S.x, S.z, S.railTop, S.ang); // local +x along the track, +z away from it
  const P = L.get('plain');
  const top = S.platH - S.railTop;
  const conc = C(0xa8a49c);
  // platform body
  L.get('concrete').box(0, -0.5, 3.8, 64, top + 0.5, 4.4, conc, { topColor: C(0xb8b4ac) });
  P.box(0, top, 1.75, 64, 0.02, 0.12, C(0xf4f4f0));
  P.box(0, top, 2.25, 64, 0.025, 0.32, C(0xf0c020));
  W.col.addPlatform(L.wx(0, 3.8), L.wz(0, 3.8), 32, 2.2, S.ang, S.platH, S.platH, 'concrete', 'platform');
  // ramp down at the east end (+x)
  const rampX = 32 + 3.5;
  L.get('concrete').box(rampX, -0.5, 4.6, 7, top + 0.3, 2.6, conc);
  W.col.addPlatform(L.wx(rampX, 4.6), L.wz(rampX, 4.6), 1.3, 3.5, S.ang - Math.PI / 2, S.platH, S.railTop - 0.25, 'concrete', 'ramp');
  for (const z of [3.35, 5.9]) P.box(rampX, top - 0.2, z, 7, 0.9, 0.06, C(0x9aa0a4));
  // shelter with bench
  const Sh = L.get('plain', -6, top, 5.6);
  Sh.box(0, 0, 0, 8, 2.6, 0.12, C(0x7a5a3e));
  for (const sx of [-4, 0, 4]) Sh.box(sx, 0, -1.5, 0.14, 2.7, 0.14, C(0x6a6e72));
  MD.bench((k) => { const b = L.get(k, -8, top, 5.1, Math.PI); return b; }, 0x5a7a9a, 2.4);
  MD.bench((k) => { const b = L.get(k, -4, top, 5.1, Math.PI); return b; }, 0x5a7a9a, 2.4);
  const Rf = L.get('tin', -6, top + 2.75, 4.8); Rf.rotateY(0);
  Rf.gableRoof(8.4, 2.4, 0, 0.3, 0.15, C(0x5a6a7a), { thickness: 0.08 });
  W.sitSpots.push({ x: L.wx(-6, 5.0), z: L.wz(-6, 5.0), y: S.platH, ang: S.ang + Math.PI, label: 'Присесть и подождать поезд' });
  // station name board
  const B = L.get('plain', 14, top, 4.5);
  for (const sx of [-0.9, 0.9]) B.box(sx, 0, 0, 0.08, 2.2, 0.08, C(0x3a3a3a));
  const sign = L.sign('なつめ', 14, top + 1.65, 4.56, 2.0, 0.8, { bg: '#ffffff', fg: '#1a1a1a', font: JP_SANS, weight: 800, size: 64, baseline: 0.42, sub: '← ひがしやま　　 NATSUME　　 みずさわ →', glow: 0.3 }, Math.PI);
  sign.position.y = S.platH + 1.65;
  L.sign('なつめ', 14, top + 1.65, 4.44, 2.0, 0.8, { bg: '#ffffff', fg: '#1a1a1a', font: JP_SANS, weight: 800, size: 64, baseline: 0.42, sub: '← みずさわ　　 NATSUME　　 ひがしやま →', glow: 0.3 }, 0).position.y = S.platH + 1.65;
  // timetable
  const tt = L.get('plain', 4.5, top, 5.7); tt.box(0, 0, 0, 0.9, 1.9, 0.08, C(0x2a3a4a));
  W.interact.push({ x: L.wx(4.5, 5.0), z: L.wz(4.5, 5.0), y: S.platH, r: 1.5, kind: 'timetable', label: 'Посмотреть расписание' });
  // lamps on the platform
  for (const x of [-24, -10, 6, 22]) {
    const Lp = L.get('plain', x, top, 5.9);
    Lp.box(0, 0, 0, 0.1, 3.6, 0.1, C(0x5a5e62)); Lp.box(0, 3.6, -0.5, 0.1, 0.08, 1.1, C(0x5a5e62));
    L.get('lampGlow', x, top, 5.9).box(0, 3.45, -0.85, 0.5, 0.1, 0.18, C(0xeef4ff));
    W.lamps.push({ x: L.wx(x, 5.0), z: L.wz(x, 5.0), y: S.platH + 3.4, ground: S.platH, color: 0xdfe8ff, r: 5.5 });
  }
  // station house
  const Hx = 0, Hz = 9.6;
  const H = L.get('wood', Hx, -0.4, Hz);
  H.box(0, 0, 0, 14, 3.2, 6.2, C(0x6a4a34), { noTop: true });
  const Wn = L.get('winB', Hx, -0.4, Hz);
  for (const u of [-4.5, -1.5, 3.5]) Wn.quad([u - 0.8, 1.0, 3.14], [u + 0.8, 1.0, 3.14], [u + 0.8, 2.4, 3.14], [u - 0.8, 2.4, 3.14], C(0xffffff), [0, 0, 1, 1]);
  L.get('doorB', Hx, -0.4, Hz).quad([0.3, 0.05, 3.14], [2.3, 0.05, 3.14], [2.3, 2.3, 3.14], [0.3, 2.3, 3.14], C(0xffffff), [0, 0, 1, 1]);
  const HR = L.get('kawara', Hx, 2.8, Hz); HR.gableRoof(14, 6.2, 0, 0.7, 0.45, C(0x8c94a0), { ridgeColor: C(0x4a5058), gableColor: C(0x6a4a34) });
  L.box(Hx, Hz, 7.1, 3.2);
  L.sign('なつめ駅', 1.3, 2.75, Hz + 3.3, 2.4, 0.55, { bg: '#f6f2e6', fg: '#1a1a1a', glow: 0.6 }).position.y = S.railTop + 2.35;
  W.lamps.push({ x: L.wx(1.3, Hz + 4.0), z: L.wz(1.3, Hz + 4.0), y: S.railTop + 2.6, ground: S.railTop - 0.4, color: 0xfff0d0, r: 4 });
  // plaza: phone booth, bike rack, vending machine
  const pz = at(W, W.plan.areas.plaza[0], W.plan.areas.plaza[1], W.hm.sample(W.plan.areas.plaza[0], W.plan.areas.plaza[1]), Math.PI / 2);
  const ph = pz.get('plain', -4, 0, -3);
  ph.box(0, 0, 0, 0.95, 0.1, 0.95, C(0x6a6a6a));
  for (const sx of [-0.45, 0.45]) for (const sz of [-0.45, 0.45]) ph.box(sx, 0.1, sz, 0.06, 2.2, 0.06, C(0x3a8a4a));
  ph.box(0, 2.3, 0, 1.0, 0.18, 1.0, C(0x3a8a4a));
  ph.box(0, 1.0, -0.38, 0.3, 0.45, 0.2, C(0x2a9a5a));
  const gl = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.1, 0.9), new THREE.MeshLambertMaterial({ color: 0xcfe6f0, transparent: true, opacity: 0.22, depthWrite: false }));
  pz.mesh(gl, -4, 1.15, -3);
  pz.box(-4, -3, 0.5, 0.5);
  for (let i = 0; i < 5; i++) MD.bicycle(pz.at(2 + i * 0.7, 0, -3.5, rng.float(-0.1, 0.1)), rng.pick([0x8ab8c8, 0xd8d0c0, 0x5a8a5a, 0xc87a7a, 0x3a4a6a]));
  pz.box(3.4, -3.5, 2.0, 0.9);
  pz.vending(-6.2, -3.2, 0, 1, 0x2a7a3a);
  W.landmarkIcons.push({ x: S.x, z: S.z, icon: '▣' });
}

function crossing(W, rng) {
  const road = W.plan.byName.north;
  const cr = road.crossing;
  if (!cr) return;
  const stripe = stripeTex();
  const poleMat = patch(new THREE.MeshLambertMaterial({ map: stripe }), { key: 'stripe' });
  const lampA = patch(new THREE.MeshLambertMaterial({ color: 0x401010, emissive: 0xff2010, emissiveIntensity: 0 }), { key: 'lampA' });
  const lampB = patch(new THREE.MeshLambertMaterial({ color: 0x401010, emissive: 0xff2010, emissiveIntensity: 0 }), { key: 'lampB' });
  const xsignT = (() => { const [c, x] = canvas(256, 64); x.fillStyle = '#f2c418'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#1a1a1a'; for (let i = 0; i < 10; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32 + 16, 0); x.lineTo(i * 32 - 8, 64); x.lineTo(i * 32 - 24, 64); x.fill(); } return tex(c, { clamp: true }); })();
  const xMat = patch(new THREE.MeshLambertMaterial({ map: xsignT, side: THREE.DoubleSide }), { key: 'xsign' });
  const rq = W.plan.byName.north.poly.nearest(cr.x, cr.z, 10);
  const rtx = rq.tx, rtz = rq.tz; // road direction
  const ltx = cr.tx, ltz = cr.tz; // rail direction
  const arms = [];
  const lamps = [];
  const group = new THREE.Group();
  for (const side of [1, -1]) {
    // posts sit beside the road, before the tracks, on opposite corners
    const ox = cr.x - rtx * side * 4.2 + -rtz * side * (road.w / 2 + 0.7);
    const oz = cr.z - rtz * side * 4.2 + rtx * side * (road.w / 2 + 0.7);
    const y = W.hm.sample(ox, oz);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 10), poleMat);
    post.position.set(ox, y + 1.7, oz);
    group.add(post);
    W.col.addCircle(ox, oz, 0.2);
    const head = new THREE.Group();
    head.position.set(ox, y, oz);
    head.rotation.y = Math.atan2(rtx * side, rtz * side) + Math.PI;
    group.add(head);
    // crossbuck
    for (const r of [0.7, -0.7]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.2), xMat); b.position.set(0, 3.15, 0.1); b.rotation.z = r; head.add(b); }
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.22), patch(new THREE.MeshLambertMaterial({ map: drawSign('踏切', { w: 128, h: 56, bg: '#1a1a1a', fg: '#f2c418', font: JP_SANS }) }), { key: 'sign' }));
    lab.position.set(0, 2.62, 0.1); head.add(lab);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.08), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    bar.position.set(0, 2.2, 0.06); head.add(bar);
    for (const [lx, m] of [[-0.42, lampA], [0.42, lampB]]) {
      for (const dz of [0.14, -0.14]) {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 12), m);
        l.rotation.x = Math.PI / 2; l.position.set(lx, 2.2, dz); head.add(l);
        const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.12, 12, 1, true, 0, Math.PI), new THREE.MeshLambertMaterial({ color: 0x111111, side: THREE.DoubleSide }));
        hood.rotation.x = Math.PI / 2; hood.position.set(lx, 2.2, dz * 1.5); head.add(hood);
      }
    }
    lamps.push({ x: ox, y: y + 2.2, z: oz });
    // barrier arm pivot
    const pivot = new THREE.Group();
    const px = ox + rtx * side * 0.4, pz = oz + rtz * side * 0.4;
    pivot.position.set(px, y + 0.95, pz);
    pivot.rotation.y = Math.atan2(side * rtx, side * rtz);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.3), new THREE.MeshLambertMaterial({ color: 0x2a2a2a }));
    box.position.set(px, y + 0.7, pz); group.add(box);
    const armLen = road.w + 0.2;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(armLen, 0.09, 0.09), poleMat);
    arm.position.set(armLen / 2, 0, 0);
    pivot.add(arm);
    pivot.userData.len = armLen;
    group.add(pivot);
    arms.push(pivot);
  }
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  W.scene.add(group);
  W.crossing = { x: cr.x, z: cr.z, h: cr.h, lampA, lampB, arms, lamps, active: 0, armT: 0, rtx, rtz, roadW: road.w, blocker: null };
  // arms start raised
  for (const a of arms) a.rotation.z = Math.PI / 2;
}

function school(W, S, rng) {
  const L = at(W, S.x, S.z, S.h, 0);
  const bw = 54, bd = 11, bz = -S.hd + 8;
  const wall = C(0xe8e2d0);
  L.get('plaster', 0, 0, bz).box(0, 0, 0, bw, 8.4, bd, wall, { noTop: true });
  L.get('plain', 0, 0, bz).box(0, 8.4, 0, bw + 0.6, 0.5, bd + 0.6, C(0xb8b2a2));
  for (const y of [1.1, 4.9]) {
    for (let i = 0; i < 12; i++) {
      const u = -bw / 2 + 2.6 + i * 4.3;
      const k = rng.chance(0.06) ? 'winA' : 'winDark';
      const b = L.get(k, 0, 0, bz);
      b.quad([u - 1.6, y, bd / 2 + 0.03], [u + 1.6, y, bd / 2 + 0.03], [u + 1.6, y + 2.0, bd / 2 + 0.03], [u - 1.6, y + 2.0, bd / 2 + 0.03], C(0xffffff), [0, 0, 1, 1]);
      L.get(k, 0, 0, bz, Math.PI).quad([u - 1.6, y, bd / 2 + 0.03], [u + 1.6, y, bd / 2 + 0.03], [u + 1.6, y + 2.0, bd / 2 + 0.03], [u - 1.6, y + 2.0, bd / 2 + 0.03], C(0xffffff), [0, 0, 1, 1]);
    }
    L.get('plain', 0, 0, bz).box(0, y + 2.5, bd / 2 + 0.25, bw, 0.12, 0.5, C(0xc8c2b2));
  }
  // clock
  const [cc, cx] = canvas(128);
  cx.fillStyle = '#f8f8f4'; cx.beginPath(); cx.arc(64, 64, 60, 0, Math.PI * 2); cx.fill();
  cx.strokeStyle = '#2a2a2a'; cx.lineWidth = 5; cx.stroke();
  cx.lineWidth = 3; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; cx.beginPath(); cx.moveTo(64 + Math.cos(a) * 48, 64 + Math.sin(a) * 48); cx.lineTo(64 + Math.cos(a) * 56, 64 + Math.sin(a) * 56); cx.stroke(); }
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), patch(new THREE.MeshLambertMaterial({ map: tex(cc, { clamp: true }) }), { key: 'sign' }));
  L.mesh(clock, 0, 7.6, bz + bd / 2 + 0.06);
  const hands = new THREE.Group();
  const hm = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  const hh = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.02), hm); hh.geometry.translate(0, 0.25, 0);
  const mh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.75, 0.02), hm); mh.geometry.translate(0, 0.37, 0);
  hands.add(hh, mh);
  L.mesh(hands, 0, 7.6, bz + bd / 2 + 0.09);
  W.clock = { hh, mh };
  L.box(0, bz, bw / 2 + 0.2, bd / 2 + 0.2);
  // entrance canopy
  L.get('plain', 0, 0, bz + bd / 2 + 1.5).box(0, 3.1, 0, 5, 0.2, 3, C(0xc8c2b2));
  for (const sx of [-2.3, 2.3]) L.get('plain', sx, 0, bz + bd / 2 + 2.8).box(0, 0, 0, 0.25, 3.1, 0.25, C(0xd8d2c2));
  // yard: backstop, iron bars, pool, gate
  const BS = L.get('plain', -S.hw + 8, 0, S.hd - 10);
  for (const [x, z] of [[-4, 0], [0, -2], [4, 0]]) BS.box(x, 0, z, 0.12, 6, 0.12, C(0x6a8a6a));
  BS.box(-2, 5.9, -1, 4.5, 0.1, 0.1, C(0x6a8a6a)); BS.box(2, 5.9, -1, 4.5, 0.1, 0.1, C(0x6a8a6a));
  const bars = L.get('plain', S.hw - 14, 0, -4);
  for (let i = 0; i < 3; i++) { bars.box(i * 1.6, 0, 0, 0.08, 1.0 + i * 0.35, 0.08, C(0x4a6ab0)); bars.box(i * 1.6 + 0.8, 0.9 + i * 0.35, 0, 1.6, 0.05, 0.05, C(0xb0b4b8)); }
  bars.box(4.0, 0, 0, 0.08, 2.0, 0.08, C(0x4a6ab0));
  const pool = L.get('plain', S.hw - 14, 0, S.hd - 9);
  pool.box(0, 0, 0, 16, 0.5, 9, C(0xd8d8d4));
  pool.box(0, 0.5, 0, 15, 0.02, 8, C(0x3a9ac8));
  for (const sz of [-1, 1]) pool.box(0, 0.5, sz * 4.7, 16.6, 1.4, 0.04, C(0x5a9a6a));
  for (const sx of [-1, 1]) pool.box(sx * 8.3, 0.5, 0, 0.04, 1.4, 9.4, C(0x5a9a6a));
  L.box(S.hw - 14, S.hd - 9, 8.3, 4.7);
  for (let x = -S.hw + 4; x < S.hw - 4; x += 9) L.tree('sakura', x, S.hd - 1.5, rng.float(0.85, 1.05));
  for (let z = -S.hd + 22; z < S.hd - 4; z += 9) L.tree('sakura', -S.hw + 1.5, z, rng.float(0.85, 1.05));
  const G = L.get('plain', S.hw - 0.5, 0, 6);
  for (const sz of [-3, 3]) G.box(0, 0, sz, 0.7, 1.7, 0.7, C(0x9a968c));
  L.box(S.hw - 0.5, 3, 0.4, 0.4); L.box(S.hw - 0.5, 9, 0.4, 0.4);
  L.sign('なつめ小学校', S.hw - 0.12, 1.15, 9.3, 0.3, 1.0, { vertical: true, bg: '#e8e2d4', fg: '#1a1a1a', tw: 96, th: 320 }, Math.PI / 2);
  L.vending(S.hw - 1.2, 1.6, Math.PI / 2, 1, 0xe8e8e4);
  W.landmarkIcons.push({ x: S.x, z: S.z, icon: '文' });
}

function communityHall(W, Hh, rng) {
  const L = at(W, Hh.x, Hh.z, Hh.h, Math.PI); // faces north to the main road
  const H = L.get('siding');
  H.box(0, 0.3, 0, 16, 3.2, 9, C(0xd8d4c8), { noTop: true });
  L.get('plain').box(0, 0, 0, 16.2, 0.3, 9.2, C(0x9a968e));
  for (const u of [-5.5, -2.5, 3, 6]) L.get('winA').quad([u - 0.9, 1.2, 4.53], [u + 0.9, 1.2, 4.53], [u + 0.9, 2.4, 4.53], [u - 0.9, 2.4, 4.53], C(0xffffff), [0, 0, 1, 1]);
  L.get('doorA').quad([-1, 0.3, 4.53], [1, 0.3, 4.53], [1, 2.5, 4.53], [-1, 2.5, 4.53], C(0xffffff), [0, 0, 1, 1]);
  L.get('tin', 0, 3.5, 0).gableRoof(16, 9, 0, 0.5, 0.35, C(0x3a5a7a), { thickness: 0.1, gableColor: C(0xd8d4c8) });
  L.sign('なつめ村公民館', 0, 3.05, 4.62, 3.6, 0.5, { bg: '#ffffff', fg: '#1a1a1a', font: JP_SANS, weight: 700 });
  L.box(0, 0, 8.1, 4.6);
  // loudspeaker pole (防災無線)
  const P = L.get('plain', 9.5, 0, 3);
  P.cyl(0, 0, 0, 0.18, 0.13, 11, 10, C(0xb8b8b4));
  P.box(0, 1.2, 0.18, 0.4, 0.6, 0.2, C(0xd8d8d0));
  for (let i = 0; i < 4; i++) {
    P.push(); P.translate(0, 10.2, 0); P.rotateY((i / 4) * Math.PI * 2 + 0.4); P.rotateX(Math.PI / 2 + 0.25);
    P.cone(0, 0, 0, 0.32, 0.9, 10, C(0xe8e8e4)); P.pop();
  }
  L.circle(9.5, 3, 0.3);
  W.speaker = { x: L.wx(9.5, 3), y: Hh.h + 10.2, z: L.wz(9.5, 3) };
  // flag pole
  L.get('plain', -9.5, 0, 4).cyl(0, 0, 0, 0.05, 0.04, 8, 6, C(0xd8d8d8));
}

function camphor(W, A, rng) {
  const L = at(W, A.x, A.z, A.h, 0.4);
  const Fo = L.get('foliage');
  const P = L.get('plain');
  const bark = C(0x5a4a3a);
  P.cyl(0, -0.3, 0, 1.4, 0.9, 6, 10, bark);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + 0.3; P.tube(0, 4.5, 0, Math.cos(a) * 4.5, 8 + (i % 2) * 2, Math.sin(a) * 4.5, 0.45, 6, bark); }
  for (let i = 0; i < 26; i++) {
    const a = rng.float(0, Math.PI * 2), r = rng.float(1, 7), y = rng.float(8, 15);
    Fo.blob(Math.cos(a) * r, y, Math.sin(a) * r, rng.float(3, 4.5), rng.float(2.2, 3.2), rng.float(3, 4.5), varyColor(rng.pick([0x3e5e2a, 0x4a6a2e, 0x35532a]), rng, 0.1), rng, 0.2, 1);
  }
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; P.tube(Math.cos(a) * 1.3, 2.4, Math.sin(a) * 1.3, Math.cos(a + 0.36) * 1.3, 2.38, Math.sin(a + 0.36) * 1.3, 0.09, 5, C(0xd8c8a0)); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; P.quad([Math.cos(a) * 1.36, 1.9, Math.sin(a) * 1.36], [Math.cos(a) * 1.36 + 0.12, 1.9, Math.sin(a) * 1.36], [Math.cos(a) * 1.36 + 0.12, 2.35, Math.sin(a) * 1.36], [Math.cos(a) * 1.36, 2.35, Math.sin(a) * 1.36], C(0xffffff)); }
  L.circle(0, 0, 1.5);
  // small shrine (hokora) and torii
  const Hk = L.get('plain', 0, 0, 3.4);
  Hk.box(0, 0, 0, 1.0, 0.6, 0.8, C(0x8a867e));
  Hk.box(0, 0.6, 0, 0.7, 0.7, 0.6, C(0x6a4a30));
  L.get('kawara', 0, 1.3, 3.4).gableRoof(0.8, 0.7, 0, 0.2, 0.7, C(0x8c94a0), { thickness: 0.06 });
  torii(L.at(0, 0, 5.5), VERM, 1.6, 1.9);
  L.box(0, 3.4, 0.55, 0.45);
  MD.stoneLantern(L.at(1.6, 0, 4.4), 0.8);
  W.landmarkIcons.push({ x: A.x, z: A.z, icon: '木' });
}

function lookout(W, A, rng) {
  const L = at(W, A.x, A.z, A.h, -1.2); // benches face west-ish toward the sunset
  const P = L.get('plain');
  const wood = C(0x6a4a30);
  for (const sx of [-1.5, 1.5]) for (const sz of [-1.5, 1.5]) P.box(sx, 0, sz, 0.16, 2.6, 0.16, wood);
  P.box(0, 0, 0, 3.6, 0.15, 3.6, C(0x8a7a62));
  const R = L.get('kawara', 0, 2.6, 0); R.hipRoof(3.4, 3.38, 0, 0.6, 0.65, C(0x8c94a0), { thickness: 0.15 });
  MD.bench(L.at(0, 0, 0.4, 0), 0x7a5a3a, 2.2);
  MD.bench(L.at(0, 0, 3.6, 0), 0x7a5a3a, 2.2);
  for (const sx of [-1.5, 1.5]) for (const sz of [-1.5, 1.5]) L.circle(sx, sz, 0.15);
  W.sitSpots.push({ x: L.wx(0, 0.25), z: L.wz(0, 0.25), y: A.h, ang: -1.2, label: 'Сесть и смотреть на долину' });
  W.sitSpots.push({ x: L.wx(0, 3.45), z: L.wz(0, 3.45), y: A.h, ang: -1.2, label: 'Сесть и смотреть на закат' });
  L.sign('見晴らし台', -2.8, 1.5, 5.2, 0.8, 0.5, { bg: '#5a4030', fg: '#f4e8c8' });
  L.get('plain', -2.8, 0, 5.18).box(0, 0, 0, 0.08, 1.25, 0.08, wood);
  L.vending(3.2, -2.6, Math.PI, 0, 0xe8e8e4);
  W.lampSources.push({ x: A.x, z: A.z, y: A.h + 2.4, color: 0xffd8a0, power: 0.4 });
}

function busStops(W, rng) {
  const main = W.plan.byName.main;
  const spots = [[-205, 1, 'なつめ中央'], [425, -1, '東集落前']];
  for (const [x, side, name] of spots) {
    let best = 0, bd = 1e9;
    for (let i = 0; i < main.poly.pts.length; i++) { const d = Math.abs(main.poly.pts[i][0] - x); if (d < bd) { bd = d; best = i; } }
    const p = main.poly.at(main.poly.s[best]);
    const nx = -p.tz * side, nz = p.tx * side;
    const cx = p.x + nx * (main.w / 2 + 2.2), cz = p.z + nz * (main.w / 2 + 2.2);
    const h = main.prof[best] + 0.05;
    const L = at(W, cx, cz, h, Math.atan2(-nx, -nz));
    const wood = C(0x7a5a3e);
    const Wd = L.get('wood');
    Wd.box(0, 0, -0.9, 3.0, 2.3, 0.1, C(0x8a6a4a));
    Wd.box(-1.45, 0, 0, 0.1, 2.3, 1.9, C(0x8a6a4a));
    Wd.box(1.45, 0, 0, 0.1, 2.3, 1.9, C(0x8a6a4a));
    L.get('plain').box(0, 0, 0, 3.0, 0.12, 2.0, C(0x8a867e));
    L.get('tin', 0, 2.3, 0).gableRoof(3.3, 2.2, 0, 0.25, 0.35, C(0x9b3a2e), { thickness: 0.06, gableColor: wood });
    MD.bench(L.at(0, 0.12, -0.55, 0), 0x6a8aa8, 2.4);
    L.box(0, -0.9, 1.5, 0.08); L.box(-1.45, 0, 0.08, 0.95); L.box(1.45, 0, 0.08, 0.95);
    const S = L.get('plain', 2.3, 0, 0.8);
    S.cyl(0, 0, 0, 0.18, 0.18, 0.12, 8, C(0x6a6a6a)); S.cyl(0, 0.12, 0, 0.035, 0.035, 2.1, 5, C(0xc8c8c8));
    const sg = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20), patch(new THREE.MeshLambertMaterial({ map: drawSign(name, { w: 256, h: 256, bg: '#ffffff', fg: '#1a3a8a', font: JP_SANS, size: 44, border: '#2a5ac8', borderW: 18 }), side: THREE.DoubleSide }), { key: 'sign' }));
    L.mesh(sg, 2.3, 2.45, 0.8, 0);
    L.circle(2.3, 0.8, 0.12);
    W.sitSpots.push({ x: L.wx(0, -0.35), z: L.wz(0, -0.35), y: h + 0.12, ang: Math.atan2(-nx, -nz), label: 'Присесть на остановке', busStop: name });
    W.lamps.push({ x: L.wx(0, 0), z: L.wz(0, 0), y: h + 2.2, ground: h, color: 0xe8f0ff, r: 3.5 });
  }
}

function jizoSpots(W, rng) {
  const spots = [[-512, 26, 0.3], [338, 66, -1.4], [-74, -150, 1.6], [92, 300, 2.6]];
  for (const [x, z, a] of spots) {
    const occ = W.plan.occAt(x, z);
    if (occ & 1) continue;
    const L = at(W, x, z, W.hm.sample(x, z), a);
    MD.jizo(L.at(0, 0, 0), rng, rng.int(2, 4));
    L.box(0, 0, 1.0, 0.45);
    W.landmarkIcons.push({ x, z, icon: '地' });
  }
}
