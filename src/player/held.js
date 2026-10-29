import * as THREE from 'three';
import { MeshBuilder, C } from '../core/builder.js';
import { canvas, tex, JP_SANS } from '../env/textures.js';

// Something to eat or drink in your hand: a soda-ice pop, a bottle of ramune, a can from the machine, a cup of
// shaved ice, a cloud of cotton candy or a boat of takoyaki. It sits low in the corner of the view, comes up to
// your mouth every few seconds and slowly runs out. The stick of an ice pop now and then says あたり — a free one.

const LIFE = { ice: 5, ramune: 5, can: 5, kakigori: 6, wata: 6, tako: 6 }; // bites or sips

function atariTex() {
  const [c, x] = canvas(32, 128);
  x.fillStyle = '#e8d4a8'; x.fillRect(0, 0, 32, 128);
  x.fillStyle = '#c8282a'; x.font = `900 22px ${JP_SANS}`; x.textAlign = 'center';
  for (const [i, ch] of ['あ', 'た', 'り'].entries()) x.fillText(ch, 16, 70 + i * 22);
  return tex(c, { clamp: true });
}

export class Held {
  constructor(camera, scene, audio) {
    this.camera = camera; this.audio = audio;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.kind = null;
    this._v = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler();
    this.atariTex = atariTex();
  }
  get busy() { return !!this.kind; }
  take(kind, opts = {}) {
    this.clear();
    this.kind = kind; this.left = LIFE[kind]; this.t = 0; this.next = 1.6; this.bite = 0; this.opts = opts;
    this.atari = kind === 'ice' && Math.random() < 0.12;
    const g = this.group, M = (color, o = {}) => new THREE.MeshLambertMaterial({ color, ...o });
    const item = (this.item = new THREE.Group());
    g.add(item);
    if (kind === 'ice') {
      const stick = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.11, 0.004), new THREE.MeshLambertMaterial({ map: this.atari ? this.atariTex : null, color: this.atari ? 0xffffff : 0xe8d4a8 }));
      stick.position.y = -0.03; item.add(stick);
      this.part = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.085, 0.022), M(opts.color ?? 0x7ac8f0, { emissive: 0x0a1a24 }));
      this.part.geometry.translate(0, 0.0425, 0); this.part.position.y = 0.02; item.add(this.part);
    } else if (kind === 'ramune' || kind === 'can') {
      if (kind === 'ramune') {
        const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.15, 14, 1, true), M(0x9adcf0, { transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
        item.add(glass);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.024, 0.05, 12, 1, true), glass.material); neck.position.y = 0.1; item.add(neck);
        const marble = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), M(0xd8f4ff, { emissive: 0x203040 })); marble.position.y = 0.09; item.add(marble);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.012, 10), M(0x2a6ad8)); cap.position.y = 0.13; item.add(cap);
        this.part = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.13, 12), M(0xc8f0ff, { transparent: true, opacity: 0.55, depthWrite: false }));
        this.part.geometry.translate(0, 0.065, 0); this.part.position.y = -0.072; item.add(this.part);
      } else {
        const [c, x] = canvas(64, 64);
        x.fillStyle = opts.c1 || '#3f8a3a'; x.fillRect(0, 0, 64, 64);
        x.fillStyle = opts.c2 || '#ffffff'; x.fillRect(0, 22, 64, 20);
        x.fillStyle = opts.c1 || '#3f8a3a'; x.font = `900 14px ${JP_SANS}`; x.textAlign = 'center'; x.fillText(opts.jp || '', 32, 37);
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 16), [new THREE.MeshLambertMaterial({ map: tex(c, { clamp: true }) }), M(0xc8ccd0), M(0xc8ccd0)]);
        item.add(body);
        // condensation drops
        for (let i = 0; i < 6; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.0025, 5, 4), M(0xffffff, { transparent: true, opacity: 0.7 })); const a = i * 1.1; d.position.set(Math.cos(a) * 0.031, -0.04 + (i % 3) * 0.03, Math.sin(a) * 0.031); item.add(d); }
        this.part = null;
      }
    } else if (kind === 'kakigori') {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.032, 0.06, 14, 1, true), M(0xf4f4f0, { side: THREE.DoubleSide })); item.add(cup);
      this.part = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(opts.color ?? 0xf05a6a, { emissive: 0x200808 }));
      this.part.position.y = 0.025; this.part.scale.y = 1.3; item.add(this.part);
      const spoon = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.08, 0.004), M(0x3a8ad8)); spoon.position.set(0.02, 0.07, 0.01); spoon.rotation.z = -0.4; item.add(spoon);
    } else if (kind === 'wata') {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 5), M(0xe8d8b0)); stick.position.y = -0.06; item.add(stick);
      this.part = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 1), M(0xffc8e0, { emissive: 0x281018 }));
      this.part.position.y = 0.09; this.part.scale.set(1, 1.2, 1); item.add(this.part);
    } else if (kind === 'tako') {
      const boat = new MeshBuilder();
      boat.box(0, 0, 0, 0.13, 0.012, 0.075, C(0xe8dcc0)); boat.box(0, 0, 0.034, 0.13, 0.025, 0.006, C(0xe8dcc0)); boat.box(0, 0, -0.034, 0.13, 0.025, 0.006, C(0xe8dcc0));
      item.add(new THREE.Mesh(boat.build(), new THREE.MeshLambertMaterial({ vertexColors: true })));
      this.balls = [];
      for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 8), M(0xb8742a, { emissive: 0x1a0a02 })); b.position.set(-0.04 + (i % 3) * 0.04, 0.022, i < 3 ? -0.017 : 0.017); b.scale.y = 0.85; item.add(b); this.balls.push(b); }
      const pick = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.07, 4), M(0xe8d8b0)); pick.position.set(0.05, 0.05, 0.02); pick.rotation.z = 0.5; item.add(pick);
      this.part = null; this.left = 6;
    }
    item.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.renderOrder = 10; } });
    g.visible = true;
  }
  clear() {
    if (this.item) { this.group.remove(this.item); this.item.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); } }); }
    this.item = null; this.kind = null; this.part = null; this.balls = null; this.group.visible = false;
  }
  // returns 'done' (and whether the stick was a winner) when the last bite is taken
  update(dt, hidden) {
    if (!this.kind) return null;
    this.group.visible = !hidden;
    this.t += dt;
    let result = null;
    // a bite / sip every few seconds
    this.next -= dt;
    if (this.next <= 0 && this.left > 0) {
      this.next = 2.6 + Math.random() * 1.8; this.bite = 1;
      this.left--;
      const k = this.left / LIFE[this.kind];
      if (this.kind === 'ice') { this.part.scale.y = Math.max(0.001, k); this.audio?.eat?.(); }
      else if (this.kind === 'ramune' || this.kind === 'can') { if (this.part) this.part.scale.y = Math.max(0.001, k); this.audio?.sip?.(); }
      else if (this.kind === 'kakigori' || this.kind === 'wata') { this.part.scale.multiplyScalar(0.84); this.audio?.eat?.(); }
      else if (this.kind === 'tako' && this.balls?.[this.left]) { this.balls[this.left].visible = false; this.audio?.eat?.(); }
      if (this.left === 0) this.endT = this.kind === 'ice' ? 3.5 : 1.5;
    }
    this.bite = Math.max(0, this.bite - dt * 1.6);
    if (this.left === 0) {
      this.endT -= dt;
      if (this.endT <= 0) { result = { kind: this.kind, atari: this.atari }; this.clear(); return result; }
    }
    // in the lower right corner, raised to the mouth on each bite
    const b = Math.sin(Math.min(1, this.bite) * Math.PI);
    const drinking = this.kind === 'ramune' || this.kind === 'can';
    const bob = Math.sin(this.t * 1.7) * 0.004;
    this._v.set(0.16 - b * 0.12, -0.17 + b * 0.12 + bob, -0.42 + b * 0.16).applyQuaternion(this.camera.quaternion).add(this.camera.position);
    this.group.position.copy(this._v);
    this.group.quaternion.copy(this.camera.quaternion);
    this.item.rotation.set(drinking ? b * 1.2 : -b * 0.4, -0.3 + b * 0.3, drinking ? b * 0.3 : 0);
    // after the last bite of an ice pop, the bare stick is held up to read it
    if (this.kind === 'ice' && this.left === 0) this.item.rotation.set(0.15, -0.1, 0);
    return null;
  }
}
