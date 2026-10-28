import * as THREE from 'three';
import { C } from '../core/builder.js';
import { RNG } from '../core/noise.js';
import { CF } from './collision.js';
import { person, pose } from './npc.js';

// Summer-vacation radio calisthenics (rajio taisō) on the school ground: children gather from six in the morning,
// and when you arrive the leader on the podium starts the cassette. Afterwards everyone gets a stamp on their card.

export const BEAT = 60 / 132;
const MOVE_BEATS = 16;
const MOVES = ['stretch', 'swing', 'side', 'jump', 'twist', 'breathe'];
export const MUSIC_BEATS = 8 + 8 * 4 * 3 + 4; // count-in, three times through the tune, final chord

export class RadioTaiso {
  constructor(W) {
    this.W = W; this.audio = null; // set by the game once the audio engine exists
    const S = W.plan.areas.school;
    this.S = S;
    const lx = (x) => S.x + x, lz = (z) => S.z + z;
    const rng = new RNG(606);
    // steel podium and a cassette radio on a stool
    const P = W.chunks.get('plain', S.x, S.z);
    P.place(lx(0), S.h, lz(-11), 0);
    P.box(0, 0, 0, 1.8, 0.95, 1.3, C(0x8a9aa8));
    for (const sx of [-0.6, 0, 0.6]) P.box(sx, 0.25, 0.66, 0.4, 0.06, 0.02, C(0x6a7a88));
    P.place(lx(2.4), S.h, lz(-11.3), 0);
    P.cyl(0, 0, 0, 0.18, 0.18, 0.5, 8, C(0x7a5a3a));
    P.box(0, 0.5, 0, 0.5, 0.26, 0.16, C(0x2a2a2e));
    for (const sx of [-0.14, 0.14]) P.cyl(sx, 0.63, 0.081, 0.07, 0.07, 0.01, 10, C(0x9a9aa0));
    P.box(0, 0.76, 0, 0.36, 0.03, 0.03, C(0xb0b0b4));
    // note: the podium and radio are scenery all day, so they are real colliders
    W.col.addBox(lx(0), lz(-11), 0.95, 0.7, 0, CF.ALL);
    W.col.addCircle(lx(2.4), lz(-11.3), 0.3);
    this.radioPos = { x: lx(2.4), y: S.h + 0.7, z: lz(-11.3) };
    // the leader and the children
    this.people = [];
    const leader = person({ skin: 0xd8b090, shirt: 0x2a4a8a, pants: 0x2a4a8a, legs: 0x2a4a8a, hair: 0x1a1a1a, cap: 0xf0f0f0, scale: 1.0, shoes: 0xf0f0f0 });
    leader.position.set(lx(0), S.h + 0.95, lz(-11));
    leader.rotation.y = 0;
    this.add(leader, { leader: true });
    const shirts = [0xf0e8d8, 0x7ab0e0, 0xe86a5a, 0xf0d050, 0x8ad08a, 0xf0a0c0, 0xffffff, 0x5a8ad8, 0xe8b070, 0xc8e0f0];
    let i = 0;
    for (const z of [-5, -2.2, 0.6]) for (const x of [-4.5, -1.5, 1.5, 4.5]) {
      if (i >= 10) break;
      const girl = rng.chance(0.5);
      const kid = person({ skin: 0xe8c4a0, shirt: shirts[i], pants: girl ? 0xd85a7a : 0x2a3a6a, legs: 0xe8c4a0, hair: 0x1a1a1a, bun: girl && rng.chance(0.5), cap: !girl && rng.chance(0.5) ? rng.pick([0xd83a2a, 0x2a5ad0, 0xf0d040]) : null, scale: rng.float(0.6, 0.72), shoes: 0xf4f4f4 });
      // radio-exercise card on a string
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.01), new THREE.MeshLambertMaterial({ color: 0xf8f4e8 }));
      card.position.set(0, 0.22, 0.12); kid.userData.spine.add(card);
      const x0 = lx(x + rng.float(-0.4, 0.4)), z0 = lz(z + rng.float(-0.3, 0.3));
      kid.position.set(x0, W.hm.sample(x0, z0), z0);
      kid.rotation.y = Math.PI + rng.float(-0.15, 0.15);
      this.add(kid, { ph: rng.float(0, 6), x0, z0 });
      i++;
    }
    this.on = false;
    this.state = 'idle'; // idle → waiting → playing → stamps → idle
    this.day = -1;
    this.t = 0;
  }
  add(p, data) {
    Object.assign(p.userData, data);
    p.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    p.visible = false;
    this.W.scene.add(p);
    p.userData.col = this.W.col.addCircle(p.position.x, p.position.z, 0.25);
    p.userData.col.flags = 0;
    this.people.push(p);
  }
  near(pos, r = 38) { return Math.abs(pos.x - this.S.x) < r && Math.abs(pos.z - (this.S.z - 4)) < r; }
  setVisible(v) {
    this.on = v;
    for (const p of this.people) { p.visible = v; p.userData.col.flags = v ? CF.ALL : 0; }
  }
  // seconds since the music started, from the audio clock when there is one
  clock() {
    const a = this.audio;
    if (a?.ready && this.t0Audio !== undefined) return a.ctx.currentTime - this.t0Audio;
    return this.t;
  }
  update(dt, tSec, time, player) {
    const h = time.hour, P = player.pos;
    const far = Math.hypot(P.x - this.S.x, P.z - this.S.z) > 60;
    // the children are there from ten to six until about half past seven; they come and go out of sight
    const inWindow = h > 5.8 && h < 7.6 && time.day !== this.day;
    if (!this.on && inWindow && far) { this.setVisible(true); this.state = 'waiting'; }
    if (this.on && ((far && (!inWindow || this.state === 'done')) || h < 5.5 || h > 9.5)) { this.setVisible(false); this.state = 'idle'; }
    if (!this.on) return;
    this.t += dt;
    const G = this.W.game;
    if (this.state === 'waiting' && h > 6.4 && this.near(P, 32)) {
      this.state = 'playing'; this.t = 0;
      this.t0Audio = this.audio?.taiso(this.radioPos);
      G?.hud.toast('Вожатый нажимает кнопку на магнитофоне: «Радиозарядка! Встаём ровно!»');
    }
    const sec = this.state === 'playing' ? this.clock() : 0;
    const beat = sec / BEAT - 8;
    if (this.state === 'playing' && sec > MUSIC_BEATS * BEAT + 1) {
      this.state = 'stamps'; this.t = 0;
      if (this.near(P, 32)) {
        G?.hud.toast('Дети выстраиваются к вожатому, и он ставит каждому штамп в карточку. Тебе тоже!');
        G?.stamp('taiso');
      }
    }
    if (this.state === 'stamps' && this.t > 40) { this.state = 'done'; this.day = time.day; }
    if (far && this.state !== 'playing') return;
    // animate
    const move = beat < 0 ? -1 : Math.min(MOVES.length - 1, Math.floor(beat / MOVE_BEATS));
    for (const p of this.people) {
      const u = p.userData;
      if (this.state !== 'playing' || move < 0) {
        pose(p, 'stand');
        u.neck.rotation.y = Math.sin(tSec * 0.5 + (u.ph || 0)) * 0.4;
        u.spine.rotation.z = Math.sin(tSec * 0.8 + (u.ph || 0)) * 0.04;
        continue;
      }
      this.exercise(p, MOVES[move], beat % MOVE_BEATS);
    }
  }
  exercise(p, m, b) {
    const u = p.userData;
    pose(p, 'stand');
    u.body.position.y = 0; u.neck.rotation.set(0, 0, 0);
    const s = Math.sin(b * Math.PI / 2), a = Math.abs(Math.sin(b * Math.PI / 2));
    if (m === 'stretch') {
      const up = 0.5 - 0.5 * Math.cos(b * Math.PI / 2);
      u.shL.rotation.set(-up * 2.9, 0, 0.1); u.shR.rotation.set(-up * 2.9, 0, -0.1);
      u.elL.rotation.x = 0; u.elR.rotation.x = 0;
      u.body.position.y = up * 0.04;
    } else if (m === 'swing') {
      u.shL.rotation.set(s * 1.3, 0, 0.15 + a * 0.6); u.shR.rotation.set(-s * 1.3, 0, -0.15 - a * 0.6);
      u.pelvis.position.y = 0.92 - a * 0.14; u.hipL.rotation.x = -a * 0.5; u.hipR.rotation.x = -a * 0.5; u.knL.rotation.x = a * 0.9; u.knR.rotation.x = a * 0.9;
    } else if (m === 'side') {
      u.spine.rotation.z = s * 0.45;
      u.shL.rotation.set(0, 0, s < 0 ? 2.7 : 0.2); u.shR.rotation.set(0, 0, s > 0 ? -2.7 : -0.2);
    } else if (m === 'jump') {
      const j = Math.abs(Math.sin(b * Math.PI));
      u.body.position.y = j * 0.16;
      u.shL.rotation.set(0, 0, 0.2 + j * 1.3); u.shR.rotation.set(0, 0, -0.2 - j * 1.3);
      u.hipL.rotation.z = j * 0.25; u.hipR.rotation.z = -j * 0.25;
    } else if (m === 'twist') {
      u.spine.rotation.y = s * 0.7;
      u.shL.rotation.set(0, 0, 1.45); u.shR.rotation.set(0, 0, -1.45);
      u.elL.rotation.x = 0; u.elR.rotation.x = 0;
    } else {
      const up = 0.5 - 0.5 * Math.cos(b * Math.PI / 4);
      u.shL.rotation.set(0, 0, 0.1 + up * 2.8); u.shR.rotation.set(0, 0, -0.1 - up * 2.8);
      u.neck.rotation.x = -up * 0.25;
    }
  }
}
