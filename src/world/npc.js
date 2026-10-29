import * as THREE from 'three';
import { RNG } from '../core/noise.js';
import { MeshBuilder, C } from '../core/builder.js';
import { patch } from '../env/materials.js';
import { CF } from './collision.js';

// Villagers and cats. Low-poly figures with a few animated joints: a grandmother fanning herself in front of the
// shop, farmers weeding the paddies, an old man dozing at the bus stop, a boy hunting cicadas, and cats you can pet.

const matCache = new Map();
function M(color) {
  let m = matCache.get(color);
  if (!m) { m = patch(new THREE.MeshLambertMaterial({ color }), { key: 'npc' }); matCache.set(color, m); }
  return m;
}
function box(w, h, d, color, y0 = 0) { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, y0, 0); const m = new THREE.Mesh(g, M(color)); m.castShadow = true; return m; }
function ball(r, color, sx = 1, sy = 1, sz = 1) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), M(color)); m.scale.set(sx, sy, sz); m.castShadow = true; return m; }
function cyl(r0, r1, h, color, seg = 8) { const g = new THREE.CylinderGeometry(r1, r0, h, seg); g.translate(0, h / 2, 0); const m = new THREE.Mesh(g, M(color)); m.castShadow = true; return m; }

// A person rig. All limbs hang along -y from their joint groups; everything that moves together is one mesh with
// vertex colours, so a figure costs eleven draw calls.
const personMat = patch(new THREE.MeshLambertMaterial({ vertexColors: true }), { key: 'npc' });
export const PEOPLE = [];
export function person(o) {
  const s = o.scale || 1;
  const root = new THREE.Group();
  const body = new THREE.Group(); body.scale.setScalar(s); root.add(body);
  const part = (group, fn) => { const b = new MeshBuilder(); fn(b); const m = new THREE.Mesh(b.build(), personMat); m.castShadow = true; group.add(m); return m; };
  const bx = (b, w, h, d, color, y0 = 0, z0 = 0) => b.box(0, y0 - h / 2, z0, w, h, d, C(color));
  const ball = (b, r, color, sx = 1, sy = 1, sz = 1, y = 0, z = 0) => b.blob(0, y, z, r * sx, r * sy, r * sz, C(color), null, 0, 1, 0.92);
  const pelvis = new THREE.Group(); pelvis.position.y = 0.92; body.add(pelvis);
  part(pelvis, (b) => bx(b, 0.34, 0.2, 0.22, o.pants));
  const spine = new THREE.Group(); spine.position.y = 0.08; pelvis.add(spine);
  part(spine, (b) => {
    bx(b, 0.36, 0.52, 0.22, o.shirt, 0.26);
    if (o.apron) bx(b, 0.37, 0.42, 0.02, o.apron, 0.18, 0.115);
    if (o.towel) bx(b, 0.3, 0.06, 0.26, 0xf2f2ec, 0.5);
  });
  const neck = new THREE.Group(); neck.position.y = 0.55; spine.add(neck);
  part(neck, (b) => {
    ball(b, 0.12, o.skin, 1, 1.1, 1, 0.13);
    if (o.hair) ball(b, 0.125, o.hair, 1.02, 0.95, 1.05, 0.17, -0.02);
    if (o.bun) ball(b, 0.06, o.hair, 1, 1, 1, 0.28, -0.08);
    if (o.straw) { b.cyl(0, 0.24, 0, 0.38, 0.38, 0.025, 14, C(0xd8c078)); b.cyl(0, 0.25, 0, 0.16, 0.05, 0.16, 12, C(0xc8b068)); }
    if (o.cap) { ball(b, 0.13, o.cap, 1, 0.55, 1, 0.24); bx(b, 0.2, 0.02, 0.14, o.cap, 0.21, 0.12); }
  });
  const limb = (parent, x, y, len, w, color, color2, extra) => {
    const j = new THREE.Group(); j.position.set(x, y, 0); parent.add(j);
    part(j, (b) => bx(b, w, len, w, color, -len / 2));
    const k = new THREE.Group(); k.position.y = -len; j.add(k);
    part(k, (b) => { bx(b, w * 0.9, len, w * 0.9, color2, -len / 2); extra(b); });
    return [j, k];
  };
  const hand = (b) => ball(b, 0.05, o.skin, 1, 1, 1, -0.3);
  const shoe = (b) => bx(b, 0.11, 0.07, 0.24, o.shoes || 0x2a2a2a, -0.45, 0.05);
  const fore = o.sleeve ? o.shirt : o.skin;
  const [shL, elL] = limb(spine, 0.23, 0.5, 0.28, 0.09, o.shirt, fore, hand);
  const [shR, elR] = limb(spine, -0.23, 0.5, 0.28, 0.09, o.shirt, fore, hand);
  const [hipL, knL] = limb(pelvis, 0.1, -0.05, 0.43, 0.12, o.pants, o.legs || o.pants, shoe);
  const [hipR, knR] = limb(pelvis, -0.1, -0.05, 0.43, 0.12, o.pants, o.legs || o.pants, shoe);
  root.userData = { body, pelvis, spine, neck, shL, elL, shR, elR, hipL, knL, hipR, knR, s };
  PEOPLE.push(root);
  return root;
}
// Shadows only for figures close to the camera; further away nobody notices, and crowds stay cheap.
export function updateCrowdShadows(cam, r = 24) {
  for (const p of PEOPLE) {
    if (!p.visible) continue;
    const want = (p.position.x - cam.x) ** 2 + (p.position.z - cam.z) ** 2 < r * r;
    if (p.userData.shadow === want) continue;
    p.userData.shadow = want;
    p.traverse((m) => { if (m.isMesh) m.castShadow = want; });
  }
}
export function pose(p, name, t = 0) {
  const u = p.userData;
  const set = (o, x = 0, y = 0, z = 0) => o.rotation.set(x, y, z);
  if (name === 'sit') {
    u.pelvis.position.y = 0.47; set(u.pelvis); set(u.spine, -0.05);
    set(u.hipL, -1.5, 0, 0.06); set(u.hipR, -1.5, 0, -0.06); set(u.knL, 1.5); set(u.knR, 1.5);
    set(u.shL, -0.25, 0, 0.12); set(u.shR, -0.25, 0, -0.12); set(u.elL, -0.9); set(u.elR, -0.9);
  } else if (name === 'bend') {
    u.pelvis.position.y = 0.86; set(u.pelvis, 0.15); set(u.spine, 1.15);
    set(u.hipL, -0.35); set(u.hipR, -0.35); set(u.knL, 0.55); set(u.knR, 0.55);
    set(u.neck, -0.6);
    set(u.shL, -0.2 + Math.sin(t * 2.2) * 0.35, 0, 0.1); set(u.shR, -0.2 - Math.sin(t * 2.2) * 0.35, 0, -0.1);
    set(u.elL, -0.3); set(u.elR, -0.3);
  } else if (name === 'walk') {
    u.pelvis.position.y = 0.92 + Math.abs(Math.sin(t)) * 0.02; set(u.spine, 0.05);
    const a = Math.sin(t) * 0.5;
    set(u.hipL, a); set(u.hipR, -a); set(u.knL, Math.max(0, -Math.sin(t)) * 0.7); set(u.knR, Math.max(0, Math.sin(t)) * 0.7);
    set(u.shL, -a * 0.8, 0, 0.06); set(u.shR, a * 0.8, 0, -0.06); set(u.elL, -0.3); set(u.elR, -0.3);
  } else {
    u.pelvis.position.y = 0.92; set(u.spine); set(u.hipL); set(u.hipR); set(u.knL); set(u.knR);
    set(u.shL, 0, 0, 0.08); set(u.shR, 0, 0, -0.08); set(u.elL, -0.15); set(u.elR, -0.15);
  }
}

function cat(color, rng) {
  const root = new THREE.Group();
  const c = color;
  const body = ball(0.16, c.body, 1.0, 0.85, 1.55); body.position.y = 0.2; root.add(body);
  if (c.patch) { const pt = ball(0.1, c.patch, 1.05, 0.7, 1.1); pt.position.set(0.04, 0.27, -0.06); root.add(pt); }
  const head = new THREE.Group(); head.position.set(0, 0.34, 0.22); root.add(head);
  head.add(ball(0.1, c.head || c.body, 1.1, 0.95, 1));
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.08, 4), M(c.head || c.body)); e.position.set(s * 0.055, 0.1, -0.01); e.rotation.z = -s * 0.25; head.add(e); }
  for (const s of [-1, 1]) { const ey = ball(0.016, 0x2a3a1a); ey.position.set(s * 0.04, 0.02, 0.085); head.add(ey); }
  const tail = new THREE.Group(); tail.position.set(0, 0.24, -0.22); root.add(tail);
  const t1 = cyl(0.025, 0.02, 0.28, c.tail || c.body, 6); t1.rotation.x = -0.9; tail.add(t1);
  const legs = [];
  for (const [x, z] of [[0.07, 0.13], [-0.07, 0.13], [0.07, -0.13], [-0.07, -0.13]]) { const l = cyl(0.03, 0.025, 0.17, c.legs || c.body, 6); l.position.set(x, 0.0, z); root.add(l); legs.push(l); }
  root.userData = { body, head, tail, legs };
  void rng;
  return root;
}
// a shiba inu: fox-coloured with a cream chest and a tail curled over its back
function shiba() {
  const root = new THREE.Group();
  const tan = 0xc8803a, cream = 0xf0e4cc;
  const body = ball(0.15, tan, 1.0, 0.95, 1.9); body.position.y = 0.33; root.add(body);
  const chest = ball(0.11, cream, 1.0, 0.9, 1.0); chest.position.set(0, 0.3, 0.17); root.add(chest);
  const head = new THREE.Group(); head.position.set(0, 0.47, 0.3); root.add(head);
  head.add(ball(0.11, tan, 1.0, 0.95, 1.0));
  const muzzle = ball(0.06, cream, 1.0, 0.85, 1.2); muzzle.position.set(0, -0.03, 0.1); head.add(muzzle);
  const nose = ball(0.018, 0x1a1a1a); nose.position.set(0, -0.01, 0.17); head.add(nose);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.09, 4), M(tan)); e.position.set(s * 0.06, 0.11, -0.01); e.rotation.z = -s * 0.2; head.add(e);
    const ey = ball(0.014, 0x1a1a1a); ey.position.set(s * 0.045, 0.02, 0.09); head.add(ey);
  }
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 14), M(0xc8282a)); collar.position.set(0, 0.42, 0.24); collar.rotation.x = 1.2; root.add(collar);
  const tail = new THREE.Group(); tail.position.set(0, 0.45, -0.26); root.add(tail);
  const tc = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.03, 6, 10, Math.PI * 1.4), M(tan)); tc.rotation.y = Math.PI / 2; tc.position.y = 0.05; tail.add(tc);
  const legs = [];
  for (const [x, z] of [[0.07, 0.17], [-0.07, 0.17], [0.07, -0.17], [-0.07, -0.17]]) {
    const l = new THREE.Group(); l.position.set(x, 0.27, z); root.add(l);
    const m = cyl(0.03, 0.028, 0.27, z > 0 ? cream : tan, 6); m.position.y = -0.27; l.add(m);
    legs.push(l);
  }
  root.userData = { head, tail, legs };
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return root;
}
const CAT_COLORS = [
  { body: 0xd8893c, tail: 0xc87830 },
  { body: 0x232323 },
  { body: 0xf2f0ea, patch: 0xd8893c, head: 0xf2f0ea, tail: 0x2a2a2a },
  { body: 0x8a8a8a, legs: 0xf0f0ea },
  { body: 0xe8e2d4, head: 0xb08a60, tail: 0xb08a60 },
];

export class Villagers {
  constructor(W, audio) {
    this.W = W; this.audio = audio;
    this.list = [];
    this.cats = [];
    const rng = new RNG(31337);
    const add = (p, x, z, ang, kind, extra = {}) => {
      const y = W.groundAt(x, z, 1e3).h;
      p.position.set(x, y, z); p.rotation.y = ang;
      W.scene.add(p);
      const n = { p, x, z, y, ang, kind, t: rng.float(0, 10), ...extra };
      this.list.push(n);
      return n;
    };
    // grandmother on the bench in front of the shop
    const st = W.shopSpots.store;
    if (st) {
      const lot = W.plan.shops.find((l) => l.shop === 'store');
      const c = Math.cos(lot.ang), s = Math.sin(lot.ang);
      const lx = lot.w / 2 - 1.6 - 0.5, lz = (-1.2 + (lot.d - 2.6) / 2) + 0.45;
      const x = lot.x + lx * c + lz * s, z = lot.z - lx * s + lz * c;
      const g = person({ skin: 0xe2c0a0, shirt: 0x9a6a8a, pants: 0x4a4a5a, apron: 0x4a6a9a, hair: 0xb8b8b4, bun: true, sleeve: false, scale: 0.88 });
      const fan = new THREE.Group();
      fan.add(cyl(0.008, 0.008, 0.16, 0xd8c8a0, 4).translateY(-0.14));
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.11, 14), new THREE.MeshLambertMaterial({ color: 0xf0f0ea, side: THREE.DoubleSide }));
      disc.position.y = -0.3; fan.add(disc);
      g.userData.elR.add(fan); fan.position.y = -0.28;
      const n = add(g, x, z, lot.ang, 'fan');
      n.y = lot.h + 0.0; g.position.y = n.y;
      pose(g, 'sit');
      this.granny = n;
    }
    // farmers in the paddies (daytime)
    const pads = W.paddies.filter((p) => Math.abs(p.x) < 600).sort(() => rng.next() - 0.5).slice(0, 5);
    for (const pd of pads) {
      const f = person({ skin: 0xd8a882, shirt: rng.pick([0x5a7a9a, 0x8a8a7a, 0xe8e4d8, 0x6a5a8a]), pants: 0x3a3a40, legs: 0x3a3a40, straw: true, towel: true, sleeve: true, shoes: 0xe8e8e0 });
      const n = add(f, pd.x + rng.float(-pd.hw * 0.6, pd.hw * 0.6), pd.z + rng.float(-pd.hd * 0.5, pd.hd * 0.5), rng.float(0, 6.28), 'farmer', { pad: pd, dir: 1 });
      n.y = pd.y - 0.1; f.position.y = n.y;
    }
    // old man dozing at a bus stop
    const bs = W.sitSpots.find((s) => s.busStop === '東集落前');
    if (bs) {
      const m = person({ skin: 0xd8b090, shirt: 0xf0efe8, pants: 0x6a6a5a, cap: 0x3a5a3a, sleeve: false });
      const n = add(m, bs.x, bs.z, bs.ang, 'doze');
      n.y = bs.y; m.position.y = bs.y; pose(m, 'sit');
      W.col.addCircle(bs.x, bs.z, 0.3);
    }
    // boy with a bug net near the shrine torii
    const sh = W.plan.areas.shrine;
    {
      const b = person({ skin: 0xe8c4a0, shirt: 0xf2f0e8, pants: 0x3a5a8a, hair: 0x1a1a1a, sleeve: false, scale: 0.72, cap: 0xd8402a });
      const net = new THREE.Group();
      net.add(cyl(0.012, 0.012, 1.6, 0xd8c8a0, 4));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.008, 4, 16), M(0x4a8a4a)); ring.position.y = 1.72; ring.rotation.x = Math.PI / 2; net.add(ring);
      const bag = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 10, 1, true), new THREE.MeshLambertMaterial({ color: 0x9ad0a0, transparent: true, opacity: 0.55, side: THREE.DoubleSide })); bag.position.y = 1.58; bag.rotation.x = Math.PI; net.add(bag);
      b.userData.elR.add(net); net.position.y = -0.28; net.rotation.x = 1.2;
      const cage = box(0.16, 0.14, 0.1, 0x6aa86a, -0.1); b.userData.elL.add(cage); cage.position.y = -0.32;
      const x = sh.torii[0] + 5.5, z = sh.torii[1] + 3;
      add(b, x, z, Math.atan2(-1, -0.3), 'boy', { home: [x, z] });
      W.col.addCircle(x, z, 0.25);
    }
    // grandmother pushing a little cart between the shop and home (daytime)
    {
      const g2 = person({ skin: 0xe0bc9a, shirt: 0x8a9a7a, pants: 0x5a4a4a, hair: 0xd0d0cc, bun: true, apron: 0xc8b8a0, scale: 0.86 });
      const cart = new THREE.Group();
      cart.add(box(0.36, 0.42, 0.3, 0x7a3a3a, 0.45));
      for (const s of [-1, 1]) cart.add(cyl(0.07, 0.07, 0.03, 0x1a1a1a, 10).rotateZ(Math.PI / 2).translateY(-0.17 * s).translateX(0.08));
      cart.position.set(0, 0, 0.5); g2.add(cart);
      const road = W.plan.byName.main;
      const q = road.poly.nearest(-26, 40, 30);
      const n = add(g2, q.x, q.z, 0, 'stroll', { road, s: q.s, dir: 1, s0: q.s - 140, s1: q.s + 90, side: -1 });
      void n;
    }
    // a man walking his shiba along the river embankment, early in the morning and at sunset
    const em = W.plan.byName.embank;
    if (em && em.poly.length > 120) {
      const m = person({ skin: 0xd8b090, shirt: 0xe8e4d8, pants: 0x4a4a52, legs: 0x4a4a52, hair: 0x8a8a88, cap: 0x3a4a6a, sleeve: false, scale: 0.98, shoes: 0x6a5a4a });
      const dog = shiba();
      W.scene.add(dog);
      const leash = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xc8282a }));
      leash.frustumCulled = false;
      W.scene.add(leash);
      const s = em.poly.length * 0.4;
      const q = em.poly.at(s);
      add(m, q.x, q.z, 0, 'stroll', { road: em, s, dir: 1, s0: 20, s1: em.poly.length - 20, side: -1, off: 0.35, speed: 0.95, upright: true, hours: (h) => (h > 5.6 && h < 7.6) || (h > 17.4 && h < 19.4), dog, leash });
    }
    // cats
    const spots = [];
    if (st) spots.push([st.x + 1.8, st.z + 0.6, 'sit']);
    const S = W.plan.areas.station;
    spots.push([S.house[0] + 3, S.house[1] + 4.2, 'loaf']);
    spots.push([sh.bottom[0] + 2.5, sh.bottom[1] + 1.2, 'loaf']);
    const lots = W.plan.lots.filter((l) => !l.shop).sort(() => rng.next() - 0.5).slice(0, 5);
    for (const l of lots) { const c = Math.cos(l.ang), s = Math.sin(l.ang); const lx = rng.float(-l.w / 3, l.w / 3), lz = l.d / 2 - 2.2; spots.push([l.x + lx * c + lz * s, l.z - lx * s + lz * c, rng.chance(0.5) ? 'loaf' : 'sit']); }
    spots.forEach(([x, z, mode], i) => {
      const cc = CAT_COLORS[i % CAT_COLORS.length];
      const k = cat(cc, rng);
      const y = W.groundAt(x, z, 1e3).h;
      k.position.set(x, y, z); k.rotation.y = rng.float(0, 6.28);
      W.scene.add(k);
      const c = { p: k, x, z, y, home: [x, z], mode, t: rng.float(0, 10), run: 0, vx: 0, vz: 0, petted: 0 };
      this.cats.push(c);
      this.poseCat(c, 0);
      W.interact.push({ get x() { return c.x; }, get z() { return c.z; }, y, r: 1.4, kind: 'cat', cat: c, label: 'Погладить кошку' });
    });
  }
  poseCat(c, t) {
    const u = c.p.userData;
    if (c.mode === 'loaf') {
      u.body.scale.set(1.05, 0.7, 1.4); u.body.position.y = 0.12;
      u.head.position.set(0, 0.2, 0.2); u.head.rotation.set(0.3, 0.4 * Math.sin(t * 0.2), 0);
      for (const l of u.legs) l.visible = false;
      u.tail.rotation.set(0.9, 0.9, 0);
    } else if (c.mode === 'sit') {
      u.body.scale.set(0.95, 1.05, 1.15); u.body.position.y = 0.22; u.body.rotation.x = -0.5;
      u.head.position.set(0, 0.42, 0.12); u.head.rotation.set(0, 0.5 * Math.sin(t * 0.3), 0);
      for (const l of u.legs) l.visible = true;
      u.tail.rotation.set(0.2, 0.3 * Math.sin(t * 0.8), 0);
    } else {
      u.body.scale.set(1, 0.85, 1.55); u.body.position.y = 0.22; u.body.rotation.x = 0;
      u.head.position.set(0, 0.34, 0.24); u.head.rotation.set(0, 0, 0);
      u.legs.forEach((l, i) => { l.visible = true; l.rotation.x = Math.sin(t * 14 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.6; });
      u.tail.rotation.set(-0.3, 0, 0);
    }
  }
  pet(c) {
    c.petted = 3;
    this.audio.purr?.(c.x, c.y + 0.3, c.z);
    if (Math.random() < 0.6) setTimeout(() => this.audio.meow?.(c.x, c.y + 0.3, c.z), 900);
  }
  update(dt, time, cam, player) {
    const h = time.hour;
    const day = h > 6.5 && h < 17.8;
    for (const n of this.list) {
      n.t += dt;
      const p = n.p;
      const near = Math.abs(n.x - cam.x) < 120 && Math.abs(n.z - cam.z) < 120;
      p.visible = near && (n.hours ? n.hours(h) : n.kind === 'fan' ? h > 7.5 && h < 19.3 : n.kind === 'farmer' ? day : n.kind === 'boy' ? h > 7 && h < 17 : n.kind === 'stroll' ? h > 8 && h < 17.5 : n.kind === 'doze' ? h > 6.8 && h < 19.5 : true);
      if (n.dog) { n.dog.visible = n.leash.visible = p.visible; }
      if (!p.visible) continue;
      const u = p.userData;
      if (n.kind === 'fan') {
        u.elR.rotation.set(-1.5 + Math.sin(n.t * 5.5) * 0.35, 0, 0.3);
        u.shR.rotation.set(-0.6, 0, -0.2);
        u.neck.rotation.set(0.05, Math.sin(n.t * 0.3) * 0.4, 0);
      } else if (n.kind === 'farmer') {
        pose(p, 'bend', n.t);
        const pd = n.pad;
        const dx = Math.cos(n.ang) * 0.12 * dt * n.dir, dz = -Math.sin(n.ang) * 0.12 * dt * n.dir;
        n.x += dx; n.z += dz;
        if (Math.abs(n.x - pd.x) > pd.hw * 0.75 || Math.abs(n.z - pd.z) > pd.hd * 0.75) n.dir *= -1;
        p.position.set(n.x, n.y + Math.abs(Math.sin(n.t * 2.2)) * 0.02, n.z);
        p.rotation.y = n.ang + (n.dir < 0 ? Math.PI : 0) - Math.PI / 2;
      } else if (n.kind === 'doze') {
        u.neck.rotation.set(0.35 + Math.sin(n.t * 0.6) * 0.15, 0, 0);
      } else if (n.kind === 'boy') {
        const k = (n.t % 9);
        u.shR.rotation.set(k < 1.2 ? -2.6 + Math.sin(k * 5) * 0.8 : -1.4, 0, -0.2);
        u.neck.rotation.set(-0.5, Math.sin(n.t * 0.4) * 0.6, 0);
      } else if (n.kind === 'stroll') {
        const dist = Math.hypot(player.pos.x - n.x, player.pos.z - n.z);
        const blocked = dist < 1.6;
        if (!blocked) n.s += n.dir * (n.speed || 0.75) * dt;
        if (n.s > n.s1 || n.s < n.s0) n.dir *= -1;
        const q = n.road.poly.at(n.s);
        const off = n.off ?? n.road.w / 2 + 0.6;
        n.x = q.x + -q.tz * n.side * off; n.z = q.z + q.tx * n.side * off;
        p.position.set(n.x, this.W.groundAt(n.x, n.z, n.y + 1).h, n.z);
        p.rotation.y = Math.atan2(q.tx * n.dir, q.tz * n.dir);
        pose(p, blocked ? 'stand' : 'walk', n.t * 4.2);
        if (!n.upright) { u.spine.rotation.x = 0.3; u.shL.rotation.x = -0.9; u.shR.rotation.x = -0.9; }
        else u.shR.rotation.set(-0.7, 0, -0.1);
        if (n.dog) {
          // the dog trots ahead on its lead, nose down, now and then stopping to sniff the grass
          const sniff = Math.sin(n.t * 0.23) > 0.8 && !blocked;
          const ahead = sniff ? 0.9 : 1.6;
          const dq = n.road.poly.at(n.s + n.dir * ahead);
          const dx = dq.x + -dq.tz * n.side * (off + 0.25), dz = dq.z + dq.tx * n.side * (off + 0.25);
          const d = n.dog, du = d.userData;
          d.position.set(dx, this.W.groundAt(dx, dz, n.y + 1).h, dz);
          d.rotation.y = p.rotation.y + (sniff ? Math.sin(n.t * 2) * 0.6 : 0);
          const gait = blocked || sniff ? 0 : 1;
          du.legs.forEach((l, i) => { l.rotation.x = Math.sin(n.t * 9 + (i % 2 ? 0 : Math.PI) + (i > 1 ? Math.PI / 2 : 0)) * 0.6 * gait; });
          du.head.rotation.x = sniff ? 0.7 : 0.1;
          du.tail.rotation.z = Math.sin(n.t * 6) * 0.2;
          // lead from his hand to the collar
          const hand = (this._v1 || (this._v1 = new THREE.Vector3())).set(0, -0.3, 0);
          u.elR.updateWorldMatrix(true, false); u.elR.localToWorld(hand);
          du.head.updateWorldMatrix(true, false);
          const col = du.head.localToWorld((this._v2 || (this._v2 = new THREE.Vector3())).set(0, -0.06, -0.06));
          const a = n.leash.geometry.attributes.position.array;
          a[0] = hand.x; a[1] = hand.y; a[2] = hand.z; a[3] = col.x; a[4] = col.y; a[5] = col.z;
          n.leash.geometry.attributes.position.needsUpdate = true;
          if (Math.random() < dt * 0.012 && Math.hypot(cam.x - n.x, cam.z - n.z) < 40) this.audio.dog?.(dx, d.position.y + 0.4, dz);
        }
      }
    }
    // cats: nap, sit, and dart away from fast bikes
    for (const c of this.cats) {
      c.t += dt;
      const near = Math.abs(c.x - cam.x) < 80 && Math.abs(c.z - cam.z) < 80;
      c.p.visible = near;
      if (!near) continue;
      const dx = c.x - player.pos.x, dz = c.z - player.pos.z, d = Math.hypot(dx, dz);
      if (c.run <= 0 && d < 3.2 && player.speed > 3.2) { c.run = 1.6; c.vx = (dx / d) * 4.5; c.vz = (dz / d) * 4.5; c.mode = 'walk'; this.audio.meow?.(c.x, c.y + 0.3, c.z, true); }
      if (c.run > 0) {
        c.run -= dt;
        const t = { x: c.x + c.vx * dt, z: c.z + c.vz * dt };
        this.W.col.resolve(t, 0.2, CF.WALK);
        c.x = t.x; c.z = t.z;
        c.p.rotation.y = Math.atan2(c.vx, c.vz);
        if (c.run <= 0) c.mode = Math.random() < 0.5 ? 'sit' : 'loaf';
      }
      if (c.petted > 0) { c.petted -= dt; if (c.mode === 'loaf') c.p.userData.tail.rotation.y = Math.sin(c.t * 3) * 0.6; }
      c.y = this.W.groundAt(c.x, c.z, c.y + 0.5).h;
      c.p.position.set(c.x, c.y, c.z);
      this.poseCat(c, c.t);
    }
  }
}
