import * as THREE from 'three';
import { C, MeshBuilder } from '../core/builder.js';
import { LotCtx } from './buildings.js';
import { patch } from '../env/materials.js';
import { CF } from './collision.js';
import { canvas, tex } from '../env/textures.js';
import { person, pose } from './npc.js';

// Grandma's farmhouse — the player's summer home: a place on the engawa, watermelon, a mosquito coil smoking in
// its ceramic pig, a wind chime, and a futon to sleep until morning. The tatami room behind the engawa stands open
// to the garden, and grandma is about: watering the garden in the morning, at the low table in the afternoon and
// in the evening with the TV on.

const LINES = {
  morning: ['Проснулся? Умойся и беги на радиозарядку, дети уже собираются.', 'Помидоры в этом году сладкие. Сорви себе один, пока никто не видит.', 'Утром роса — значит, днём будет жарко.', 'Вчера ночью у реки светлячков было — видимо-невидимо.'],
  day: ['Мугитя в холодильнике, пей побольше — жара ведь.', 'В твоём возрасте я ловила раков в той речке.', 'Не забудь кепку, солнце сегодня злое.', 'Сходи к дедушке Нацумэ в лавку, купи себе мороженое.', 'После обеда все спят. Даже цикады устают… нет, цикады не устают.'],
  evening: ['Слышишь хигураси? Значит, лето уже перевалило за середину.', 'На холме у святилища праздник. Сходи, только не потеряй сандалии.', 'Дедушка любил сидеть на энгаве и смотреть на светлячков.', 'Арбуз остывает в колодце. Ешь, сколько влезет.', 'Ужин был вкусный? Завтра сделаю сомэн.'],
  night: ['Поздно уже. Футон расстелен, москитная сетка повешена.', 'Слышишь лягушек? Говорят, к дождю… а может, и нет.'],
};

function fusumaTex() {
  const [c, x] = canvas(256, 256);
  x.fillStyle = '#e8dcc0'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(200,160,60,${Math.random() * 0.25})`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  x.strokeStyle = 'rgba(40,40,40,0.55)'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(0, 170); x.quadraticCurveTo(50, 90, 100, 150); x.quadraticCurveTo(150, 60, 210, 140); x.lineTo(256, 120); x.stroke();
  x.strokeStyle = 'rgba(40,40,40,0.3)'; x.beginPath(); x.moveTo(0, 200); x.quadraticCurveTo(90, 150, 170, 190); x.lineTo(256, 175); x.stroke();
  x.fillStyle = '#4a3a2a'; x.fillRect(0, 0, 4, 256); x.fillRect(252, 0, 4, 256);
  x.fillStyle = '#2a2420'; x.beginPath(); x.arc(226, 128, 9, 0, Math.PI * 2); x.fill();
  return tex(c, { clamp: true });
}
function shojiTex() {
  const [c, x] = canvas(128, 256);
  x.fillStyle = '#f4efe2'; x.fillRect(0, 0, 128, 256);
  x.fillStyle = '#8a6a48';
  for (let i = 0; i <= 3; i++) x.fillRect(i * 41, 0, 4, 256);
  for (let j = 0; j <= 6; j++) x.fillRect(0, j * 42, 128, 4);
  x.fillRect(0, 230, 128, 26);
  return tex(c, { clamp: true });
}
function portraitTex(k) {
  const [c, x] = canvas(64, 80);
  x.fillStyle = '#1a1a1a'; x.fillRect(0, 0, 64, 80);
  x.fillStyle = '#d8d4cc'; x.fillRect(6, 6, 52, 68);
  x.fillStyle = '#8a8680'; x.beginPath(); x.ellipse(32, 34, 12, 15, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = k % 2 ? '#3a3a3a' : '#5a5a5a'; x.fillRect(14, 50, 36, 24);
  if (k === 1) { x.fillStyle = '#4a4a4a'; x.fillRect(20, 18, 24, 7); }
  return tex(c, { clamp: true });
}

export class Home {
  constructor(W) {
    this.W = W;
    // a farmhouse a short ride west of the shops, near the river
    const lot = (this.lot = W.plan.lots.find((l) => l.home && l.house));
    const H = lot.house;
    const L = (this.L = new LotCtx(lot, W));
    const ex = H.hx + H.ex, ez = H.hz + H.fd / 2 + 0.45; // engawa centre (lot-local)
    const top = 0.55;
    // things on the engawa
    const P = L.get('plain', ex, top, ez);
    // watermelon slices on a plate
    P.cyl(-1.2, 0, 0.05, 0.22, 0.2, 0.03, 14, C(0xf2f2ee), { cap: true });
    const melon = new MeshBuilder();
    for (let i = 0; i < 3; i++) {
      melon.push(); melon.translate(-1.28 + i * 0.09, 0.03, 0.05); melon.rotateY(0.3 - i * 0.3);
      const r = 0.12, n = 8;
      for (let k = 0; k < n; k++) {
        const a0 = Math.PI * (k / n), a1 = Math.PI * ((k + 1) / n);
        melon.tri([0, 0, 0], [Math.cos(a0) * r, Math.sin(a0) * r, 0], [Math.cos(a1) * r, Math.sin(a1) * r, 0], C(0xe83a3a));
        melon.tri([0, 0, -0.03], [Math.cos(a1) * r, Math.sin(a1) * r, -0.03], [Math.cos(a0) * r, Math.sin(a0) * r, -0.03], C(0xe83a3a));
        melon.quad([Math.cos(a0) * r, Math.sin(a0) * r, 0], [Math.cos(a0) * r, Math.sin(a0) * r, -0.03], [Math.cos(a1) * r, Math.sin(a1) * r, -0.03], [Math.cos(a1) * r, Math.sin(a1) * r, 0], C(0x2e6a2a));
      }
      for (let k = 0; k < 4; k++) melon.box(Math.cos(0.5 + k * 0.6) * 0.06, Math.sin(0.5 + k * 0.6) * 0.06, 0.002, 0.012, 0.016, 0.004, C(0x1a1a1a));
      melon.pop();
    }
    const mm = new THREE.Mesh(melon.build(), patch(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), { key: 'melon' }));
    L.mesh(mm, ex, top, ez);
    // katori-buta: the ceramic pig holding a mosquito coil
    P.blob(1.1, 0.13, 0.1, 0.11, 0.1, 0.14, C(0xb8c4c8), null, 0, 1, 0.85);
    P.cyl(1.1, 0.06, 0.24, 0.07, 0.07, 0.04, 10, C(0x101010), { cap: true });
    P.cone(1.1, 0.2, -0.05, 0.03, 0.05, 6, C(0xb8c4c8));
    // uchiwa fan and a glass of barley tea
    P.cyl(0.5, 0.0, 0.2, 0.035, 0.035, 0.1, 8, C(0xc89a4a), { cap: true });
    P.box(0.75, 0.0, 0.25, 0.18, 0.006, 0.22, C(0x3a6ab0));
    // furin hanging from the eave
    const F = L.get('plain', ex + 0.4, 0, ez + 0.5);
    F.blob(0, 2.42, 0, 0.06, 0.05, 0.06, C(0xa8d8e8), null, 0, 1, 1);
    F.box(0, 2.48, 0, 0.004, 0.12, 0.004, C(0x444444));
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.16), new THREE.MeshLambertMaterial({ color: 0xf0e070, side: THREE.DoubleSide }));
    strip.geometry.translate(0, -0.08, 0);
    this.strip = L.mesh(strip, ex + 0.4, 2.33, ez + 0.5);
    W.furin.push({ x: L.wx(ex + 0.4, ez + 0.5), z: L.wz(ex + 0.4, ez + 0.5), y: lot.h + 2.4, home: true });
    // mosquito coil smoke
    this.smokeBase = new THREE.Vector3(L.wx(ex + 1.1, ez + 0.1), lot.h + top + 0.32, L.wz(ex + 1.1, ez + 0.1));
    const n = 40;
    this.smoke = new Float32Array(n * 3); this.smokeT = new Float32Array(n);
    for (let i = 0; i < n; i++) this.smokeT[i] = i / n;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.smoke, 3).setUsage(THREE.DynamicDrawUsage));
    this.smokePts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xd8d8d8, size: 0.035, transparent: true, opacity: 0.35, depthWrite: false }));
    this.smokePts.frustumCulled = false;
    W.scene.add(this.smokePts);
    // a goldfish bowl, empty until you win a fish at the festival
    const bowl = (this.bowl = new THREE.Group());
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.14, 18, 12, 0, Math.PI * 2, 0.62, Math.PI - 0.62), new THREE.MeshLambertMaterial({ color: 0xd8f0f4, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
    glass.position.y = 0.12; bowl.add(glass);
    const water = new THREE.Mesh(new THREE.SphereGeometry(0.128, 16, 10, 0, Math.PI * 2, 0.95, Math.PI - 0.95), new THREE.MeshLambertMaterial({ color: 0x8ac8e0, transparent: true, opacity: 0.35, depthWrite: false }));
    water.position.y = 0.12; bowl.add(water);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.083, 0.008, 6, 20), new THREE.MeshLambertMaterial({ color: 0x9adaf0, transparent: true, opacity: 0.6 }));
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.12 + Math.cos(0.62) * 0.14; bowl.add(rim);
    const fish = (this.fish = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.016, 0.05), new THREE.MeshLambertMaterial({ color: 0xff5a1a, emissive: 0x401000 })));
    fish.position.y = 0.1; bowl.add(fish);
    L.mesh(bowl, ex - 0.45, top, ez - 0.05);
    bowl.traverse((o) => { o.castShadow = false; });
    bowl.visible = false;
    // interactions
    const step = H.ew / Math.max(2, Math.floor(H.ew / 1.75));
    const sx = L.wx(ex + step / 2, ez + 0.32), sz = L.wz(ex + step / 2, ez + 0.32);
    W.sitSpots.push({ x: sx, z: sz, y: lot.h + top - 0.08, ang: lot.ang, label: 'Посидеть на энгаве', engawa: true });
    W.interact.push({ x: L.wx(ex - 1.2, ez + 0.6), z: L.wz(ex - 1.2, ez + 0.6), y: lot.h, r: 1.4, kind: 'melon', label: 'Съесть ломтик арбуза' });
    const gx = H.hx + H.gx, gz = H.hz + H.fd / 2 + 0.3;
    W.interact.push({ x: L.wx(gx, gz), z: L.wz(gx, gz), y: lot.h, r: 1.6, kind: 'sleep', label: 'Зайти в дом и лечь спать' });
    this.buildRoom(L, H);
    W.landmarkIcons.push({ x: lot.x, z: lot.z, icon: '家' });
    W.plan.regions.unshift({ jp: 'おばあちゃんの家', ru: 'Бабушкин дом', x: lot.x, z: lot.z, r: 18, seal: '家' });
    this.homePos = { x: L.wx(gx, gz + 2.5), z: L.wz(gx, gz + 2.5) };
  }
  // the tatami room behind the engawa, and grandma
  buildRoom(L, H) {
    const W = this.W;
    const hw = H.fw / 2, hd = H.fd / 2;
    const x0 = H.hx + H.ex - H.ew / 2, x1 = H.hx + H.ex + H.ew / 2;
    const ix0 = x0 + 0.12, ix1 = x1 - 0.12, zf = H.hz + hd - 0.12, zb = H.hz + hd - 3.6, F = 0.55, CEIL = 3.0;
    const cx = (ix0 + ix1) / 2, cz = (zf + zb) / 2;
    this.room = { ix0, ix1, zf, zb, cx, cz };
    const P = L.get('plain'), Wd = L.get('wood'), Pl = L.get('plaster');
    // tatami, two rows of mats with dark cloth borders
    const mats = Math.max(2, Math.round((ix1 - ix0) / 0.9)), mw = (ix1 - ix0) / mats, rows = 2, md = (zf - zb) / rows;
    for (let i = 0; i < mats; i++) for (let j = 0; j < rows; j++) {
      const x = ix0 + (i + 0.5) * mw, z = zb + (j + 0.5) * md;
      P.box(x, F - 0.1, z, mw - 0.02, 0.1, md - 0.02, C([0xc8c48a, 0xc2be84, 0xccc690][(i + j) % 3]));
      P.box(x - mw / 2 + 0.02, F - 0.1, z, 0.035, 0.103, md - 0.02, C(0x2a3a2a)); P.box(x + mw / 2 - 0.02, F - 0.1, z, 0.035, 0.103, md - 0.02, C(0x2a3a2a));
    }
    // ceiling boards, plaster walls, the wall strip above the opening and the partition
    Wd.box(cx, CEIL, cz, ix1 - ix0 + 0.24, 0.05, zf - zb + 0.12, C(0xd8c098), { bottom: true });
    for (let x = ix0 + 0.6; x < ix1; x += 0.6) Wd.box(x, CEIL - 0.03, cz, 0.04, 0.03, zf - zb, C(0x8a6a48), { bottom: true });
    const cream = C(0xe8dcc4);
    Pl.box(cx, 2.45, zf - 0.03, ix1 - ix0, CEIL - 2.45, 0.04, cream);
    Wd.box(cx, 2.36, zf - 0.05, ix1 - ix0, 0.09, 0.06, H.darkWood); // kamoi beam
    const genkanSide = Math.abs(x1 - hw - H.hx) > 0.05 ? 1 : -1; // side of the room that is not an outer wall
    const px = genkanSide > 0 ? ix1 + 0.06 : ix0 - 0.06;
    Pl.box(px, F, cz, 0.06, CEIL - F, zf - zb, cream);
    // back: fusuma panels below, wall with ancestor portraits above
    Pl.box(cx, F, zb - 0.03, ix1 - ix0, CEIL - F, 0.06, cream);
    const fm = patch(new THREE.MeshLambertMaterial({ map: fusumaTex() }), { key: 'sign' });
    const nPanels = Math.max(2, Math.round((ix1 - ix0) / 0.9)), pw = (ix1 - ix0) / nPanels;
    for (let i = 0; i < nPanels; i++) L.mesh(new THREE.Mesh(new THREE.PlaneGeometry(pw - 0.02, 1.8), fm), ix0 + (i + 0.5) * pw, F + 0.9, zb + 0.005).castShadow = false;
    Wd.box(cx, F + 1.8, zb + 0.03, ix1 - ix0, 0.07, 0.05, H.darkWood);
    for (let k = 0; k < 3; k++) {
      const pm = new THREE.MeshLambertMaterial({ map: portraitTex(k) });
      L.mesh(new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.4), pm), cx - 0.5 + k * 0.5 + (genkanSide > 0 ? -1.2 : 1.2), 2.42, zb + 0.01, 0).rotation.x = -0.12;
    }
    // chabudai with tea and edamame, cushions around it
    const tx = cx + 0.3 * genkanSide, tz = cz + 0.1;
    P.cyl(tx, F + 0.29, tz, 0.48, 0.48, 0.04, 20, C(0x6a3e24), { cap: true });
    for (const [dx, dz] of [[0.25, 0.25], [-0.25, 0.25], [0.25, -0.25], [-0.25, -0.25]]) P.box(tx + dx, F, tz + dz, 0.05, 0.3, 0.05, C(0x5a3420));
    P.cyl(tx - 0.12, F + 0.33, tz - 0.05, 0.07, 0.065, 0.12, 10, C(0x8a8a6a), { cap: true });
    for (const [dx, dz] of [[0.12, 0.1], [0.2, -0.12]]) P.cyl(tx + dx, F + 0.33, tz + dz, 0.035, 0.03, 0.07, 8, C(0xd8d0c0), { cap: true });
    P.cyl(tx + 0.02, F + 0.33, tz + 0.22, 0.1, 0.07, 0.04, 12, C(0xe8e4dc), { cap: true });
    for (let i = 0; i < 9; i++) P.blob(tx + (Math.random() - 0.5) * 0.1, F + 0.38, tz + 0.22 + (Math.random() - 0.5) * 0.1, 0.025, 0.012, 0.012, C(0x7aa83a), null, 0, 0, 1);
    for (const [dx, dz] of [[0, -0.75], [0.75, 0], [-0.75, 0]]) P.box(tx + dx, F, tz + dz, 0.55, 0.08, 0.55, C(0x5a3a6a));
    // the TV on a low cabinet in the back corner
    const tvx = genkanSide > 0 ? ix1 - 0.6 : ix0 + 0.6, tvz = zb + 0.45;
    Wd.box(tvx, F, tvz, 0.9, 0.42, 0.45, C(0x6a4a30));
    P.box(tvx, F + 0.42, tvz, 0.62, 0.48, 0.45, C(0x2e2a28));
    this.tvMat = new THREE.MeshBasicMaterial({ map: (W.store && W.store.tvMat.map) || null, color: 0x000000 });
    const scr = L.mesh(new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.34), this.tvMat), tvx, F + 0.66, tvz + 0.226);
    scr.castShadow = false;
    this.tvPos = { x: L.wx(tvx, tvz), y: L.lot.h + F + 0.7, z: L.wz(tvx, tvz) };
    // butsudan in the other back corner: black lacquer, gold inside, two small candles
    const bx = genkanSide > 0 ? ix0 + 0.45 : ix1 - 0.45, bz = zb + 0.3;
    P.box(bx, F, bz, 0.62, 1.25, 0.42, C(0x141210));
    P.box(bx, F + 0.35, bz + 0.05, 0.5, 0.75, 0.34, C(0xb8902a));
    for (const s of [-0.12, 0.12]) { P.cyl(bx + s, F + 0.45, bz + 0.18, 0.012, 0.012, 0.12, 5, C(0xf4f0e8)); L.get('lampGlow').blob(bx + s, F + 0.6, bz + 0.18, 0.012, 0.022, 0.012, C(0xffb040), null, 0, 0, 1); }
    // electric fan by the opening, turning its head
    const fan = (this.fan = new THREE.Group());
    const fmm = new THREE.MeshLambertMaterial({ color: 0x9ac8d8 }), white = new THREE.MeshLambertMaterial({ color: 0xf0f0ec });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.05, 14), white); base.position.y = 0.025; fan.add(base);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), white); pole.position.y = 0.4; fan.add(pole);
    const head = (this.fanHead = new THREE.Group()); head.position.y = 0.78; fan.add(head);
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 18, 1, true), new THREE.MeshLambertMaterial({ color: 0xd8d8d8, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    cage.rotation.x = Math.PI / 2; cage.position.z = 0.04; head.add(cage);
    const motor = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), white); motor.position.z = -0.06; head.add(motor);
    const blades = (this.fanBlades = new THREE.Group()); blades.position.z = 0.05; head.add(blades);
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.CircleGeometry(0.08, 8), fmm); b.position.set(Math.cos(i * 2.09) * 0.09, Math.sin(i * 2.09) * 0.09, 0); blades.add(b); }
    L.mesh(fan, genkanSide > 0 ? ix0 + 0.5 : ix1 - 0.5, F, zf - 0.6, genkanSide > 0 ? 0.8 : -0.8);
    fan.traverse((o) => { o.castShadow = false; });
    // round fluorescent ceiling lamp with a pull cord
    this.lampMat = new THREE.MeshBasicMaterial({ color: 0x888888 });
    const lampG = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 8, 24), this.lampMat); ring.rotation.x = Math.PI / 2; lampG.add(ring);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.08, 20, 1, true), new THREE.MeshLambertMaterial({ color: 0xf4f0e6, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })); shade.position.y = 0.04; lampG.add(shade);
    const cord = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.5, 0.004), new THREE.MeshLambertMaterial({ color: 0x222222 })); cord.position.y = -0.25; lampG.add(cord);
    const cordTop = new THREE.Mesh(new THREE.BoxGeometry(0.01, CEIL - 2.45, 0.01), new THREE.MeshLambertMaterial({ color: 0x222222 })); cordTop.position.y = (CEIL - 2.45) / 2; lampG.add(cordTop);
    L.mesh(lampG, tx, 2.45, tz);
    lampG.traverse((o) => { o.castShadow = false; });
    W.lampSources.push({ x: L.wx(tx, tz), y: L.lot.h + 2.3, z: L.wz(tx, tz), color: 0xfff0d8, power: 1, i: 5, dist: 9, kf: () => this.lamp });
    // shoji slid open to both ends; at night the paper glows from the room
    this.shojiMat = patch(new THREE.MeshLambertMaterial({ map: shojiTex(), emissiveMap: null, emissive: 0xffe8c0, emissiveIntensity: 0, side: THREE.DoubleSide }), { key: 'sign' });
    const sw = 0.92;
    for (const [x, z] of [[ix0 + sw / 2, zf - 0.04], [ix0 + sw / 2 + 0.06, zf - 0.09], [ix1 - sw / 2, zf - 0.04], [ix1 - sw / 2 - 0.06, zf - 0.09]]) L.mesh(new THREE.Mesh(new THREE.PlaneGeometry(sw, 1.8), this.shojiMat), x, F + 0.9, z).castShadow = false;
    // morning glories on bamboo trellises — the flowers open at dawn and close by noon
    // (in front of the engawa, on the side away from the seat, clear of sheds at the edges of the yard)
    const gxs = H.hx + H.ex - 2.2, gzs = H.hz + hd + 2.0;
    const Pp = L.get('plain', gxs, 0, gzs), Fo = L.get('foliage', gxs, 0, gzs);
    this.blooms = new THREE.Group();
    const bloomM = new THREE.MeshLambertMaterial({ color: 0x5a6ae0, emissive: 0x101040 }), bloomM2 = new THREE.MeshLambertMaterial({ color: 0xd85aa8, emissive: 0x301020 });
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.55;
      Pp.cyl(x, 0, 0, 0.13, 0.1, 0.22, 10, C(0x8a5a3a), { cap: true });
      for (const a of [0, 2.1, 4.2]) Pp.cyl(x + Math.cos(a) * 0.08, 0.2, Math.sin(a) * 0.08, 0.008, 0.008, 1.0, 4, C(0xa8b060));
      for (let k = 0; k < 5; k++) Fo.blob(x + Math.cos(k * 1.9) * 0.08, 0.35 + k * 0.15, Math.sin(k * 1.9) * 0.08, 0.1, 0.08, 0.1, C(0x3e7a2e), null, 0, 0, 0.9);
      for (let k = 0; k < 4; k++) {
        const b = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.06, 8, 1, true), k % 2 ? bloomM : bloomM2);
        b.rotation.x = -Math.PI / 2 + 0.5;
        b.position.set(L.wx(gxs + x + Math.cos(k * 2.4) * 0.12, gzs + 0.1 + Math.sin(k * 2.4) * 0.06), L.lot.h + 0.45 + k * 0.17, L.wz(gxs + x + Math.cos(k * 2.4) * 0.12, gzs + 0.1 + Math.sin(k * 2.4) * 0.06));
        b.rotation.y = L.lot.ang;
        this.blooms.add(b);
      }
    }
    W.scene.add(this.blooms);
    L.circle(gxs, gzs, 0.8);
    // grandma
    const g = (this.granny = person({ skin: 0xe0b896, shirt: 0xb8a8c8, pants: 0x3a3a58, legs: 0x3a3a58, hair: 0xd4d4d0, bun: true, apron: 0xece4d4, scale: 0.86, shoes: 0x5a4a3a }));
    const can = new THREE.Group();
    const cb = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.2, 10), new THREE.MeshLambertMaterial({ color: 0x3a8ad0 })); can.add(cb);
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, 0.28, 5), cb.material); sp.rotation.x = 1.0; sp.position.set(0, 0.04, 0.14); can.add(sp);
    can.position.set(0, -0.38, 0.05); g.userData.elR.add(can); this.can = can;
    const fanU = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.01, 12), new THREE.MeshLambertMaterial({ color: 0xe86a8a }));
    fanU.rotation.z = Math.PI / 2; fanU.position.set(0, -0.36, 0.03); g.userData.elL.add(fanU); this.uchiwa = fanU;
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.visible = false;
    W.scene.add(g);
    const gx2 = gxs + 0.2, gz2 = gzs + 0.75;
    this.spots = {
      garden: { x: L.wx(gx2, gz2), y: L.lot.h, z: L.wz(gx2, gz2), ry: L.lot.ang + Math.PI, it: [L.wx(gx2, gz2 + 1.0), L.wz(gx2, gz2 + 1.0)] },
      table: { x: L.wx(tx, tz - 0.75), y: L.lot.h + F + 0.08, z: L.wz(tx, tz - 0.75), ry: L.lot.ang, it: [L.wx(tx, H.hz + hd + 1.15), L.wz(tx, H.hz + hd + 1.15)] },
    };
    this.grannyIt = { x: 0, y: L.lot.h, z: 0, r: 1.8, kind: 'granny', label: 'Поговорить с бабушкой', when: () => this.granny.visible };
    W.interact.push(this.grannyIt);
    this.lamp = 0; this.tvOn = 0;
  }
  grannyLine(h) {
    const k = h >= 5 && h < 10 ? 'morning' : h < 16.5 ? 'day' : h < 21.5 ? 'evening' : 'night';
    const list = LINES[k];
    this.lineI = ((this.lineI ?? Math.floor(Math.random() * 10)) + 1) % list.length;
    return list[this.lineI];
  }
  showGoldfish(v) { this.bowl.visible = v; }
  update(dt, tSec, time, cam) {
    this.updateRoom(dt, tSec, time, cam);
    if (this.bowl.visible) { const a = tSec * 0.9; this.fish.position.set(Math.cos(a) * 0.06, 0.09 + Math.sin(tSec * 1.3) * 0.015, Math.sin(a) * 0.06); this.fish.rotation.y = -a + Math.sin(tSec * 8) * 0.3; }
    if (Math.abs(cam.x - this.lot.x) > 90 || Math.abs(cam.z - this.lot.z) > 90) { this.smokePts.visible = false; return; }
    this.smokePts.visible = true;
    const b = this.smokeBase, n = this.smokeT.length;
    for (let i = 0; i < n; i++) {
      let t = (this.smokeT[i] += dt * 0.12);
      if (t > 1) t = this.smokeT[i] = t - 1;
      this.smoke[i * 3] = b.x + Math.sin(t * 9 + tSec * 0.7) * 0.05 * t;
      this.smoke[i * 3 + 1] = b.y + t * 0.6;
      this.smoke[i * 3 + 2] = b.z + Math.cos(t * 7 + tSec * 0.5) * 0.05 * t;
    }
    this.smokePts.geometry.attributes.position.needsUpdate = true;
    if (this.strip) this.strip.rotation.x = Math.sin(tSec * 2.1) * 0.25 + Math.sin(tSec * 5.3) * 0.08;
  }
  updateRoom(dt, tSec, time, cam) {
    const h = time.hour;
    // lamp from dusk until bedtime, TV in the morning news hour and in the evening
    const lampWant = (h > 17.8 && h < 22.2) || (h > 5.0 && h < 5.6) ? 1 : 0;
    this.lamp += (lampWant - this.lamp) * Math.min(1, dt * 4);
    const tvWant = (h > 6.0 && h < 7.5) || (h > 17.2 && h < 21.8) ? 1 : 0;
    this.tvOn += (tvWant - this.tvOn) * Math.min(1, dt * 4);
    this.lampMat.color.setScalar(0.5 + 2.6 * this.lamp);
    this.shojiMat.emissiveIntensity = this.lamp * 0.55 * time.night;
    this.tvMat.color.setScalar(this.tvOn * (0.75 + 0.25 * Math.sin(tSec * 11) * Math.sin(tSec * 2.7)));
    // grandma's day
    const where = h >= 5.4 && h < 8.8 ? 'garden' : h >= 8.8 && h < 21.6 ? 'table' : null;
    this.blooms.visible = h > 4.8 && h < 11.5;
    const g = this.granny, near = Math.abs(cam.x - this.lot.x) < 90 && Math.abs(cam.z - this.lot.z) < 90;
    g.visible = !!where && near;
    if (where) {
      const s = this.spots[where];
      if (this.where !== where) { this.where = where; g.position.set(s.x, s.y, s.z); g.rotation.y = s.ry; }
      const it = this.grannyIt;
      it.x = s.it[0]; it.z = s.it[1]; it.y = this.lot.h;
    }
    if (!g.visible) return;
    const u = g.userData;
    this.can.visible = this.where === 'garden';
    this.uchiwa.visible = this.where === 'table' && h > 16.5;
    if (this.where === 'garden') {
      pose(g, 'bend', tSec * 0.5);
      u.shR.rotation.set(-0.9 + Math.sin(tSec * 0.8) * 0.15, 0, -0.1); u.elR.rotation.x = -0.2;
    } else {
      pose(g, 'sit');
      u.pelvis.position.y = 0.2; // sitting on her heels
      u.hipL.rotation.x = u.hipR.rotation.x = -1.35; u.knL.rotation.x = u.knR.rotation.x = 2.6;
      u.spine.rotation.x = 0.18;
      if (this.uchiwa.visible) { u.shL.rotation.set(-0.8, 0, 0.2); u.elL.rotation.x = -1.3 + Math.sin(tSec * 5) * 0.35; }
      else { u.shL.rotation.set(-0.6, 0, 0.15); u.shR.rotation.set(-0.6, 0, -0.15); u.elL.rotation.x = u.elR.rotation.x = -0.8 + Math.sin(tSec * 3) * 0.12; }
      // she turns to look at you when you come close
      const dx = cam.x - g.position.x, dz = cam.z - g.position.z, d = Math.hypot(dx, dz);
      let a = Math.atan2(dx, dz) - g.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a));
      u.neck.rotation.y += ((d < 5 ? Math.max(-1, Math.min(1, a)) : Math.sin(tSec * 0.2) * 0.3) - u.neck.rotation.y) * Math.min(1, dt * 2);
    }
    if (this.fanHead) {
      this.fanHead.rotation.y = Math.sin(tSec * 0.35) * 0.7;
      this.fanBlades.rotation.z -= dt * 22;
    }
  }
}
