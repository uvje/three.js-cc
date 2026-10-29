import * as THREE from 'three';
import { C } from '../core/builder.js';
import { canvas, tex } from '../env/textures.js';
import { CF } from './collision.js';
import { person, pose } from './npc.js';
import { LanternStrings, yukataPerson } from './festival.js';

// Bon dance on the school ground on summer evenings: a wooden yagura hung with red-and-white bunting and lanterns,
// a drummer on top, strings of lanterns running out to the edge of the ground, and a ring of dancers in yukata
// circling slowly with the same few gestures. You can step into the ring and dance along.

const START = 18.9, END = 21.05, R = 7, N = 18, OMEGA = 0.045;

function kohakuTex() {
  const [c, x] = canvas(256, 64);
  for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#f4f0e8' : '#c8202a'; x.fillRect(i * 16, 0, 16, 64); }
  return tex(c, { clamp: false });
}

export class BonOdori {
  constructor(W) {
    this.W = W;
    const S = W.plan.areas.school;
    const cx = (this.cx = S.x), cz = (this.cz = S.z + 15), y0 = (this.y0 = W.hm.sample(cx, cz));
    this.on = 0; this.music = 0; this.glow = 0;
    // the yagura
    const P = W.chunks.get('plain', cx, cz);
    const wood = C(0x8a6a48), dark = C(0x5a4030);
    P.place(cx, y0, cz, 0);
    for (const sx of [-1.5, 1.5]) for (const sz of [-1.5, 1.5]) P.box(sx, 0, sz, 0.18, 4.4, 0.18, wood);
    P.box(0, 2.3, 0, 3.5, 0.14, 3.5, wood, { bottom: true });
    for (const s of [-1, 1]) { P.box(0, 3.15, s * 1.6, 3.3, 0.07, 0.07, dark); P.box(s * 1.6, 3.15, 0, 0.07, 0.07, 3.3, dark); }
    for (const s of [-1, 1]) for (const k of [-0.6, 0, 0.6]) { P.box(k, 2.44, s * 1.6, 0.05, 0.7, 0.05, dark); P.box(s * 1.6, 2.44, k, 0.05, 0.7, 0.05, dark); }
    // ladder on the south side
    for (const s of [-0.3, 0.3]) P.box(s, 0, -2.2, 0.07, 2.5, 0.07, wood);
    for (let y = 0.3; y < 2.3; y += 0.35) P.box(0, y, -2.2 + y * 0.12, 0.6, 0.05, 0.08, wood);
    // drum on its stand
    P.push(); P.translate(0, 2.44 + 0.62, 0.35); P.rotateX(Math.PI / 2);
    P.cyl(0, -0.3, 0, 0.42, 0.42, 0.6, 16, C(0x7a3a1a));
    P.cyl(0, -0.31, 0, 0.4, 0.4, 0.01, 16, C(0xe8dcc0), { cap: true }); P.cyl(0, 0.3, 0, 0.4, 0.4, 0.01, 16, C(0xe8dcc0), { cap: true });
    P.pop();
    P.box(0, 2.44, 0.35, 0.7, 0.2, 0.5, dark);
    W.col.addBox(cx, cz - 0.3, 1.8, 2.1, 0, CF.ALL);
    // red-and-white bunting round the base and the railing
    const kt = kohakuTex();
    kt.repeat.set(2, 1);
    const km = (this.buntingMat = new THREE.MeshLambertMaterial({ map: kt, emissiveMap: kt, emissive: 0xffffff, emissiveIntensity: 0, side: THREE.DoubleSide }));
    for (const [px, pz, ry] of [[0, 1.6, 0], [0, -1.6, 0], [1.6, 0, Math.PI / 2], [-1.6, 0, Math.PI / 2]]) {
      for (const [y, h] of [[1.2, 2.2], [2.82, 0.6]]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, h), km);
        m.position.set(cx + px * 1.01, y0 + y, cz + pz * 1.01); m.rotation.y = ry;
        m.updateMatrixWorld();
        W.extras.push(m);
      }
    }
    // lanterns round the railing, and strings out to poles round the ground
    const strings = new LanternStrings();
    const top = y0 + 3.75;
    const sq = [[-1.6, -1.6], [1.6, -1.6], [1.6, 1.6], [-1.6, 1.6], [-1.6, -1.6]].map(([x, z]) => [cx + x, top - 0.3, cz + z]);
    strings.add(sq, 0.8, 0, 0.12);
    const poles = [];
    for (let k = 1; k < 8; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 4;
      const px = cx + Math.cos(a) * 17, pz = cz + Math.sin(a) * 17, py = W.hm.sample(px, pz);
      poles.push([px, py, pz]);
      W.col.addCircle(px, pz, 0.1);
      const corner = [cx + Math.sign(Math.cos(a)) * 1.5 * (Math.abs(Math.cos(a)) > 0.3 ? 1 : 0), y0 + 4.4, cz + Math.sign(Math.sin(a)) * 1.5 * (Math.abs(Math.sin(a)) > 0.3 ? 1 : 0)];
      strings.add([corner, [px, py + 3.6, pz]], 1.6, 0, 1.2);
    }
    for (const [x, y, z] of poles) { P.place(x, y, z, 0); P.cyl(0, 0, 0, 0.06, 0.05, 3.7, 6, C(0x9a9a8a)); }
    this.lanternMats = strings.build(W);
    strings.all.forEach(([x, y, z], i) => { if (i % 5 === 0) W.lampSources.push({ x, y: y + 0.1, z, color: 0xff9050, power: 1, i: 3, dist: 9, kf: () => this.glow }); });
    // drummer in a happi coat with a headband
    const d = (this.drummer = person({ skin: 0xd8a880, shirt: 0x24305a, pants: 0xf0ece4, legs: 0x24305a, hair: 0x141414, towel: true, scale: 1, shoes: 0xf0ece4 }));
    for (const el of [d.userData.elL, d.userData.elR]) {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.42, 6), new THREE.MeshLambertMaterial({ color: 0xe8d8b0 }));
      stick.position.set(0, -0.4, 0.15); stick.rotation.x = 1.2; el.add(stick);
    }
    d.position.set(cx, y0 + 2.44, cz - 0.35);
    d.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    d.visible = false;
    W.scene.add(d);
    // the ring of dancers
    this.dancers = [];
    for (let i = 0; i < N; i++) {
      const p = yukataPerson(i + 2, i % 5 === 3);
      p.visible = false;
      W.scene.add(p);
      this.dancers.push({ p, a0: (i / N) * Math.PI * 2 + (i % 2) * 0.05 });
    }
    // a place in the ring for the player
    this.spot = { x: cx, y: y0 + 0.42, z: cz + R, ang: 0, label: 'Встать в круг бон-одори', dance: true, when: () => this.on > 0.5 };
    W.sitSpots.push(this.spot);
    this.t = 0;
  }
  get open() { return this.on > 0.5; }
  near(p, r = 30) { return Math.hypot(p.x - this.cx, p.z - this.cz) < r; }
  update(dt, tSec, time, player, audio) {
    const h = time.hour;
    const want = h >= START && h < END ? 1 : 0;
    this.on += (want - this.on) * Math.min(1, dt * 0.8);
    if (this.on < 0.002) this.on = 0;
    this.music += (want * this.on - this.music) * Math.min(1, dt * 0.5);
    this.glow = this.on * (0.35 + 0.9 * time.night);
    for (const m of this.lanternMats) m.emissiveIntensity = this.glow * 1.25;
    this.buntingMat.emissiveIntensity = this.glow * 0.22;
    const vis = this.on > 0.5;
    if (vis !== this.vis) { this.vis = vis; this.drummer.visible = vis; for (const d of this.dancers) d.p.visible = vis; }
    if (!vis) return;
    this.t += dt;
    // follow the music when it is playing, else keep our own time at the same tempo
    const mb = audio?.festBeat('bon');
    const beat = mb ?? this.t * (108 / 60);
    const ring = this.t * OMEGA;
    const P = player.pos;
    const close = this.near(P, 60);
    // the player's place in the ring
    const sp = this.spot, dancing = player.mode === 'sit' && player.sit === sp;
    if (dancing) {
      this.pa = (this.pa ?? 0) + dt * OMEGA;
      const a = this.pa;
      sp.x = this.cx + Math.cos(a) * R; sp.z = this.cz + Math.sin(a) * R;
      sp.y = this.y0 + 0.42 + Math.abs(Math.sin(beat * Math.PI)) * 0.03;
    } else {
      const a = Math.atan2(P.z - this.cz, P.x - this.cx);
      this.pa = a;
      sp.x = this.cx + Math.cos(a) * R; sp.z = this.cz + Math.sin(a) * R;
      sp.ang = Math.atan2(-Math.sin(a), Math.cos(a));
    }
    if (!close) return;
    for (const d of this.dancers) {
      const a = d.a0 + ring;
      // make room where the player has stepped in
      let off = 0;
      if (dancing) { let da = Math.atan2(Math.sin(a - this.pa), Math.cos(a - this.pa)); if (Math.abs(da) < 0.3) off = Math.sign(da || 1) * (0.3 - Math.abs(da)); }
      const aa = a + off;
      const p = d.p;
      p.position.set(this.cx + Math.cos(aa) * R, this.y0, this.cz + Math.sin(aa) * R);
      p.rotation.y = Math.atan2(-Math.sin(aa), Math.cos(aa));
      this.dance(p, beat);
    }
    // the drummer: two strikes on every beat, an extra flourish at the end of the phrase
    const u = this.drummer.userData, k = beat % 1, hit = Math.exp(-k * 7);
    pose(this.drummer, 'stand');
    u.shL.rotation.set(-1.6 + hit * 0.9 - (1 - hit) * 0.6, 0, 0.25); u.shR.rotation.set(-1.6 + Math.exp(-((beat + 0.5) % 1) * 7) * 0.9 - 0.3, 0, -0.25);
    u.elL.rotation.x = -0.5; u.elR.rotation.x = -0.5;
    u.spine.rotation.x = 0.12 + hit * 0.05;
  }
  // one 8-beat figure: clap clap, reach right, reach left, hands up and turn to the yagura
  dance(p, beat) {
    const u = p.userData, b = ((beat % 8) + 8) % 8;
    pose(p, 'walk', beat * Math.PI * 0.5);
    u.body.position.y = 0;
    if (b < 2) {
      const c = 1 - Math.abs(Math.sin(b * Math.PI)) ;
      u.shL.rotation.set(-1.25, 0, -0.18 - c * 0.12); u.shR.rotation.set(-1.25, 0, 0.18 + c * 0.12);
      u.elL.rotation.x = -0.6; u.elR.rotation.x = -0.6;
      u.spine.rotation.y = 0;
    } else if (b < 6) {
      const side = b < 4 ? -1 : 1, s = Math.sin(((b - 2) % 2) * Math.PI * 0.5);
      u.spine.rotation.y = side * 0.35 * s;
      u.shL.rotation.set(-1.4 - s * 0.9, 0, 0.2 + (side > 0 ? 0.5 : 0) * s); u.shR.rotation.set(-1.4 - s * 0.9, 0, -0.2 - (side < 0 ? 0.5 : 0) * s);
      u.elL.rotation.x = -0.3; u.elR.rotation.x = -0.3;
    } else {
      const s = Math.sin((b - 6) * Math.PI * 0.5);
      u.spine.rotation.y = -0.9 * s; // toward the yagura in the middle of the ring
      u.shL.rotation.set(-2.5 * s - 0.3, 0, 0.3); u.shR.rotation.set(-2.5 * s - 0.3, 0, -0.3);
      u.elL.rotation.x = -0.2; u.elR.rotation.x = -0.2;
    }
  }
}
