import * as THREE from 'three';
import { Bike, WHEEL_R } from './bike.js';
import { CF } from '../world/collision.js';
import { clamp, lerp, smoothstep } from '../core/noise.js';

// First-person controller: walking, riding the mamachari, and sitting on benches.

const EYE = 1.62;
const ROLL = { asphalt: 0.07, concrete: 0.07, wood: 0.08, stone: 0.16, gravel: 0.2, dirt: 0.24, grass: 0.42, tall: 0.6, paddy: 1.6, water: 2.0 };
const BIKE_EYE = new THREE.Vector3(0, 1.58, -0.08);

export class Player {
  constructor(world, camera, input, audio, hud, settings) {
    this.W = world; this.cam = camera; this.input = input; this.audio = audio; this.hud = hud; this.S = settings;
    this.mode = 'walk';
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.yaw = 0; this.pitch = -0.05;
    this.headYaw = 0; this.headPitch = -0.14;
    this.onGround = true;
    this.bike = new Bike(world.scene);
    this.stepPhase = 0; this.bobAmp = 0;
    this.eye = new THREE.Vector3();
    this.camFrom = new THREE.Vector3(); this.trans = 1;
    this.surface = 'asphalt';
    this.sit = null;
    this.ridden = 0; this.nightRide = 0;
    this.shake = 0;
    this.prompt = null;
    this.fov = 72;
    this._t = { x: 0, z: 0 };
    this._v = new THREE.Vector3();
    this.lastBoundaryMsg = -100;
    this.lookTarget = null;
  }
  spawn(x, z, yaw) {
    this.pos.set(x, this.W.groundAt(x, z, 1e3).h, z);
    this.yaw = yaw;
    const b = this.bike;
    b.heading = yaw + Math.PI + 0.2;
    b.x = x + Math.cos(yaw) * 1.3; b.z = z - Math.sin(yaw) * 1.3;
    b.y = this.W.groundAt(b.x, b.z, 1e3).h;
    b.setRiding(false);
    b.sync(0);
  }
  get riding() { return this.mode === 'bike'; }
  get speed() { return this.mode === 'bike' ? this.bike.speed : Math.hypot(this.vel.x, this.vel.z); }

  update(dt, tSec, time) {
    const inp = this.input;
    const [mdx, mdy] = inp.consumeMouse();
    const sens = 0.0022 * this.S.sens;
    const inv = this.S.invertY ? -1 : 1;
    if (this.mode === 'bike') {
      this.headYaw = clamp(this.headYaw - mdx * sens, -1.9, 1.9);
      this.headPitch = clamp(this.headPitch - mdy * sens * inv, -1.25, 0.95);
      this.updateBike(dt, time);
    } else if (this.mode === 'sit') {
      this.yaw -= mdx * sens; this.pitch = clamp(this.pitch - mdy * sens * inv, -1.2, 1.2);
      if (inp.hit('KeyW') || inp.hit('KeyS') || inp.hit('KeyE') || inp.hit('Space') || Math.abs(inp.joyY) > 0.6) this.standUp();
      this.eye.set(this.sit.x, this.sit.y + 1.18, this.sit.z);
    } else {
      this.yaw -= mdx * sens; this.pitch = clamp(this.pitch - mdy * sens * inv, -1.45, 1.45);
      this.updateWalk(dt);
    }
    // actions
    if (inp.hit('KeyR') || (inp.clicked && this.mode === 'bike')) this.audio.bell();
    if (inp.hit('KeyL')) { this.bike.lampOn = !this.bike.lampOn; this.hud.toast(this.bike.lampOn ? 'Фара: включена' : 'Фара: выключена'); this.audio.click(); }
    if (inp.hit('KeyB')) this.callBike();
    this.findPrompt();
    if (inp.hit('KeyE') && this.mode !== 'sit') this.act(time);
    this.bike.sync(this.W.lampsLevel);
    this.updateCamera(dt);
    // night riding counter for the diary
    if (this.mode === 'bike' && time.night > 0.8 && this.bike.lampOn) this.nightRide += Math.abs(this.bike.speed) * dt;
  }

  surfaceAt(x, z, y) { return this.W.groundAt(x, z, y).surface; }

  updateWalk(dt) {
    const inp = this.input;
    let f = 0, s = 0;
    if (inp.down('KeyW') || inp.down('ArrowUp')) f += 1;
    if (inp.down('KeyS') || inp.down('ArrowDown')) f -= 1;
    if (inp.down('KeyD') || inp.down('ArrowRight')) s += 1;
    if (inp.down('KeyA') || inp.down('ArrowLeft')) s -= 1;
    f -= inp.joyY; s += inp.joyX;
    const run = inp.down('ShiftLeft') || inp.down('ShiftRight');
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let dx = -sy * f + cy * s, dz = -cy * f - sy * s;
    const dl = Math.hypot(dx, dz);
    if (dl > 1) { dx /= dl; dz /= dl; }
    const surf = this.surface;
    const slow = surf === 'paddy' ? 0.45 : surf === 'water' ? 0.35 : surf === 'tall' ? 0.8 : 1;
    const sp = (run ? 4.4 : 2.0) * slow;
    const k = 1 - Math.exp(-dt * (this.onGround ? 10 : 2));
    this.vel.x = lerp(this.vel.x, dx * sp, k);
    this.vel.z = lerp(this.vel.z, dz * sp, k);
    const ox = this.pos.x, oz = this.pos.z;
    const t = this._t;
    t.x = ox + this.vel.x * dt; t.z = oz + this.vel.z * dt;
    this.W.col.resolve(t, 0.3, CF.WALK);
    const g0 = this.W.groundAt(ox, oz, this.pos.y);
    let g = this.W.groundAt(t.x, t.z, this.pos.y);
    const hd = Math.hypot(t.x - ox, t.z - oz);
    const rise = g.h - this.pos.y;
    if (this.onGround && hd > 1e-4 && (rise > 0.55 || (rise > 0 && rise / hd > 1.35 && !g.platform))) {
      // too steep: try sliding along each axis
      let moved = false;
      for (const [ax, az] of [[t.x, oz], [ox, t.z]]) {
        const gg = this.W.groundAt(ax, az, this.pos.y);
        const r2 = gg.h - this.pos.y, d2 = Math.hypot(ax - ox, az - oz);
        if (d2 > 1e-4 && r2 < 0.55 && (r2 <= 0 || r2 / d2 <= 1.35 || gg.platform)) { t.x = ax; t.z = az; g = gg; moved = true; break; }
      }
      if (!moved) { t.x = ox; t.z = oz; g = g0; this.vel.multiplyScalar(0.3); }
    }
    this.boundary(t);
    this.pos.x = t.x; this.pos.z = t.z;
    this.surface = g.surface;
    if (this.onGround) {
      if (g.h < this.pos.y - 0.45) { this.onGround = false; this.vy = 0; }
      else this.pos.y = lerp(this.pos.y, g.h, g.h > this.pos.y ? 0.5 : 0.7);
      if (this.input.hit('Space')) { this.vy = 4.4; this.onGround = false; this.audio.step(this.surface, 0.6); }
    }
    if (!this.onGround) {
      this.vy -= 18 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= g.h) { this.pos.y = g.h; this.onGround = true; if (this.vy < -3) this.audio.step(this.surface, 1.0); this.vy = 0; }
    }
    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.bobAmp = lerp(this.bobAmp, this.onGround && hs > 0.3 ? Math.min(1, hs / 3) : 0, 1 - Math.exp(-dt * 8));
    if (this.onGround && hs > 0.25) {
      const prev = this.stepPhase;
      this.stepPhase += (hs * dt) / (run ? 1.0 : 0.72) * Math.PI;
      if (Math.floor(prev / Math.PI) !== Math.floor(this.stepPhase / Math.PI)) this.audio.step(this.surface, run ? 0.9 : 0.6);
    }
    const bob = Math.abs(Math.sin(this.stepPhase)) * 0.045 * this.bobAmp;
    const sway = Math.sin(this.stepPhase) * 0.02 * this.bobAmp;
    this.eye.set(this.pos.x + Math.cos(this.yaw) * sway, this.pos.y + EYE + bob - 0.02, this.pos.z - Math.sin(this.yaw) * sway);
  }

  updateBike(dt, time) {
    const b = this.bike, inp = this.input;
    const fwd = inp.down('KeyW') || inp.down('ArrowUp') || inp.joyY < -0.35;
    const back = inp.down('KeyS') || inp.down('ArrowDown') || inp.down('Space') || inp.joyY > 0.45;
    let steerIn = ((inp.down('KeyA') || inp.down('ArrowLeft')) ? 1 : 0) - ((inp.down('KeyD') || inp.down('ArrowRight')) ? 1 : 0);
    if (Math.abs(inp.joyX) > 0.08) steerIn = clamp(-inp.joyX * 1.2, -1, 1);
    const sprint = inp.down('ShiftLeft') || inp.down('ShiftRight');
    if (this.S.mouseSteer && steerIn === 0) steerIn = clamp(this.headYaw * 1.4, -1, 1);
    const g = this.W.groundAt(b.x, b.z, b.y + 0.3);
    const surf = g.surface;
    this.surface = surf;
    const fx = Math.sin(b.heading), fz = Math.cos(b.heading);
    const hF = this.W.groundAt(b.x + fx * 0.53, b.z + fz * 0.53, b.y + 0.4).h;
    const hB = this.W.groundAt(b.x - fx * 0.53, b.z - fz * 0.53, b.y + 0.4).h;
    const pitchT = Math.atan2(hF - hB, 1.06);
    b.pitch = lerp(b.pitch, pitchT, 1 - Math.exp(-dt * 10));
    const vmax = sprint ? 9.6 : 6.4;
    let acc = 0;
    if (fwd && b.speed < vmax) acc += (sprint ? 2.4 : 1.6) * (1 - Math.max(0, b.speed) / vmax) + (b.speed < 1 ? 0.6 : 0);
    const roll = ROLL[surf] ?? 0.2;
    if (Math.abs(b.speed) > 0.02) acc -= Math.sign(b.speed) * (roll + 0.0055 * b.speed * b.speed);
    acc -= 9.81 * Math.sin(b.pitch);
    b.braking = 0;
    if (back) {
      if (b.speed > 0.25) { acc -= 4.8; b.braking = 1; }
      else b.speed = lerp(b.speed, -0.8, 1 - Math.exp(-dt * 3));
    }
    b.speed += acc * dt;
    b.speed = clamp(b.speed, -1.2, 15);
    if (!fwd && !back && Math.abs(b.speed) < 0.12 && Math.abs(b.pitch) < 0.05) b.speed = 0;
    // steering
    const vs = Math.abs(b.speed);
    const maxSteer = lerp(0.62, 0.11, smoothstep(1, 9, vs));
    b.steerAng = lerp(b.steerAng, steerIn * maxSteer, 1 - Math.exp(-dt * 6));
    let yawRate = (b.speed * Math.tan(b.steerAng)) / 1.06;
    if (vs < 0.6) yawRate = lerp(steerIn * 0.85, yawRate, vs / 0.6);
    b.heading += yawRate * dt;
    if (this.S.mouseSteer) this.headYaw -= yawRate * dt;
    const wobble = vs > 0.3 && vs < 2.5 ? Math.sin(performance.now() * 0.004) * 0.03 * (2.5 - vs) : 0;
    const leanT = clamp(Math.atan((b.speed * yawRate) / 9.81), -0.42, 0.42) + wobble;
    b.leanAng = lerp(b.leanAng, -leanT, 1 - Math.exp(-dt * 5));
    // move with collisions
    const ox = b.x, oz = b.z;
    const t = this._t;
    t.x = ox + fx * b.speed * dt; t.z = oz + fz * b.speed * dt;
    const hit = this.W.col.resolve(t, 0.42, CF.BIKE);
    let ng = this.W.groundAt(t.x, t.z, b.y + 0.3);
    if (ng.h - b.y > 0.32) { t.x = ox; t.z = oz; ng = g; if (vs > 1.5) { this.audio.bump(Math.min(1, vs / 6)); this.shake = 0.3; } b.speed *= 0.15; }
    if (hit) {
      const imp = Math.abs(hit.x * fx + hit.z * fz);
      if (vs * imp > 1.8) { this.audio.bump(Math.min(1, (vs * imp) / 6)); this.shake = Math.min(0.5, vs * imp * 0.08); }
      b.speed *= 1 - 0.85 * imp;
    }
    this.boundary(t);
    b.x = t.x; b.z = t.z;
    b.y = lerp(b.y, ng.h, ng.h > b.y ? 0.6 : 0.45);
    this.ridden += Math.abs(b.speed) * dt;
    b.wheelAng += (b.speed / WHEEL_R) * dt;
    b.pedaling = fwd ? (sprint ? 1 : 0.7) : 0;
    if (fwd) b.crankAng += Math.max(b.speed, 1.2) / WHEEL_R / 2.1 * dt * (sprint ? 1.15 : 1);
    this.pos.set(b.x, b.y, b.z);
    // eye: computed from the leaned frame after sync
    b.sync(this.W.lampsLevel);
    b.root.updateMatrixWorld(true);
    this._v.copy(BIKE_EYE);
    const cadence = fwd ? Math.sin(b.crankAng * 2) * 0.012 * (sprint ? 1.6 : 1) : 0;
    this._v.y += cadence;
    if (sprint && fwd) this._v.x += Math.sin(b.crankAng) * 0.03;
    b.lean.localToWorld(this._v);
    this.eye.copy(this._v);
    if (inp.hit('KeyE') && vs > 1.6) this.hud.toast('Сначала притормози (S)');
  }

  boundary(t) {
    const lim = { x0: -770, x1: 770, z0: -600, z1: 640 };
    const ox = clamp(t.x, lim.x0, lim.x1), oz = clamp(t.z, lim.z0, lim.z1);
    if (ox !== t.x || oz !== t.z) {
      t.x = ox; t.z = oz;
      const now = performance.now() / 1000;
      if (now - this.lastBoundaryMsg > 8) { this.lastBoundaryMsg = now; this.hud.toast('Дальше только горы и лес. Пора поворачивать обратно.'); }
      if (this.mode === 'bike') this.bike.speed *= 0.5;
    }
  }

  updateCamera(dt) {
    const c = this.cam;
    let yaw, pitch, roll = 0;
    if (this.mode === 'bike') { yaw = this.bike.heading + Math.PI + this.headYaw; pitch = this.headPitch; roll = -this.bike.leanAng * 0.55; }
    else { yaw = this.yaw; pitch = this.pitch; }
    if (this.trans < 1) {
      this.trans = Math.min(1, this.trans + dt / 0.45);
      const k = smoothstep(0, 1, this.trans);
      c.position.lerpVectors(this.camFrom, this.eye, k);
    } else c.position.copy(this.eye);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      c.position.x += (Math.random() - 0.5) * this.shake * 0.08; c.position.y += (Math.random() - 0.5) * this.shake * 0.08;
    }
    c.rotation.set(pitch, yaw, roll, 'YXZ');
    const sp = this.mode === 'bike' ? Math.abs(this.bike.speed) : 0;
    const fovT = 72 + Math.max(0, sp - 3) * 0.7;
    this.fov = lerp(this.fov, fovT, 1 - Math.exp(-dt * 3));
    if (Math.abs(c.fov - this.fov) > 0.01) { c.fov = this.fov; c.updateProjectionMatrix(); }
  }
  startTransition() { this.camFrom.copy(this.cam.position); this.trans = 0; }

  // ---- interaction
  findPrompt() {
    this.prompt = null;
    const W = this.W;
    if (this.mode === 'sit') { this.prompt = { text: 'Встать', key: 'E', act: () => this.standUp() }; return; }
    if (this.mode === 'bike') { if (Math.abs(this.bike.speed) < 1.6) this.prompt = { text: 'Слезть с велосипеда', key: 'E', act: () => this.dismount() }; return; }
    const px = this.pos.x, pz = this.pos.z;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    let best = null, bs = -1e9;
    const consider = (x, z, r, item) => {
      const dx = x - px, dz = z - pz, d = Math.hypot(dx, dz);
      if (d > r) return;
      const facing = d < 0.3 ? 1 : (dx * fx + dz * fz) / d;
      if (facing < 0.25) return;
      const score = facing * 2 - d;
      if (score > bs) { bs = score; best = item; }
    };
    const b = this.bike;
    consider(b.x, b.z, 2.3, { text: 'Сесть на велосипед', key: 'E', act: () => this.mount() });
    for (const it of W.interact) if ((!it.when || it.when()) && Math.abs(it.x - px) < 4 && Math.abs(it.z - pz) < 4 && Math.abs(it.y - this.pos.y) < 2.5) consider(it.x, it.z, it.r, { text: it.label, key: 'E', act: () => W.game.interact(it) });
    for (const sp of W.sitSpots) if (Math.abs(sp.x - px) < 3 && Math.abs(sp.z - pz) < 3 && Math.abs(sp.y - this.pos.y) < 2) consider(sp.x, sp.z, 1.6, { text: sp.label, key: 'E', act: () => this.sitDown(sp) });
    this.prompt = best;
  }
  act() { if (this.prompt) this.prompt.act(); }
  mount() {
    const b = this.bike;
    this.startTransition();
    this.mode = 'bike';
    b.setRiding(true);
    b.speed = 0;
    // look the way the bike points
    this.headYaw = 0; this.headPitch = -0.3;
    this.audio.kickstand();
  }
  dismount() {
    const b = this.bike;
    this.startTransition();
    b.speed = 0; b.leanAng = 0; b.steerAng = 0.25;
    b.setRiding(false);
    const lx = Math.cos(b.heading), lz = -Math.sin(b.heading); // rider's left side
    const t = { x: b.x + lx * 0.75, z: b.z + lz * 0.75 };
    this.W.col.resolve(t, 0.3, CF.WALK);
    this.pos.set(t.x, this.W.groundAt(t.x, t.z, b.y + 0.5).h, t.z);
    this.yaw = b.heading + Math.PI + this.headYaw;
    this.pitch = this.headPitch;
    this.mode = 'walk';
    this.vel.set(0, 0, 0);
    this.audio.kickstand();
    this.W.col.remove(this.bikeBlock || {});
    this.bikeBlock = this.W.col.addBox(b.x, b.z, 0.2, 0.75, b.heading, CF.WALK, 'bike');
  }
  callBike() {
    const b = this.bike;
    if (this.mode === 'bike') return;
    const d = Math.hypot(b.x - this.pos.x, b.z - this.pos.z);
    if (d < 20) { this.hud.toast('Велосипед и так рядом'); return; }
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    b.x = this.pos.x + rx * 1.3; b.z = this.pos.z + rz * 1.3;
    b.y = this.W.groundAt(b.x, b.z, this.pos.y + 1).h;
    b.heading = this.yaw + Math.PI;
    this.W.col.remove(this.bikeBlock || {});
    this.bikeBlock = this.W.col.addBox(b.x, b.z, 0.2, 0.75, b.heading, CF.WALK, 'bike');
    this.hud.toast('Велосипед стоит рядом с тобой');
  }
  sitDown(sp) {
    this.startTransition();
    this.sit = sp;
    this.mode = 'sit';
    this.yaw = sp.ang + Math.PI;
    this.pitch = 0.02;
    this.W.game.onSit(sp);
  }
  standUp() {
    this.startTransition();
    const sp = this.sit;
    this.mode = 'walk';
    const fx = Math.sin(sp.ang), fz = Math.cos(sp.ang);
    const t = { x: sp.x + fx * 0.8, z: sp.z + fz * 0.8 };
    this.W.col.resolve(t, 0.3, CF.WALK);
    this.pos.set(t.x, this.W.groundAt(t.x, t.z, sp.y + 0.5).h, t.z);
    this.sit = null;
    this.W.game.onStand();
  }
}
