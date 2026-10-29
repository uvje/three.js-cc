import * as THREE from 'three';
import { MeshBuilder, C } from '../core/builder.js';
import { torusX } from '../world/models.js';
import { patch, U } from '../env/materials.js';
import { canvas, tex } from '../env/textures.js';

// A mamachari (city bike) with basket, bell and dynamo lamp. Wheels, crank and steering animate, and the rider's
// legs and arms are posed with two-bone IK so you can look down and see yourself pedalling.

const FRAME = 0x9cc8d6, CHROME = 0xc4c8cc, BLACK = 0x181818;
const WHEEL_R = 0.33;

function mat(o = {}) { return patch(new THREE.MeshLambertMaterial({ vertexColors: true, ...o }), { key: 'bike' }); }

function wheelGeo() {
  const b = new MeshBuilder();
  torusX(b, 0, 0, 0, 0.312, 0.024, 22, C(BLACK));
  torusX(b, 0, 0, 0, 0.288, 0.011, 22, C(CHROME));
  b.push(); b.rotateZ(Math.PI / 2); b.cyl(0, -0.05, 0, 0.028, 0.028, 0.1, 8, C(CHROME), { cap: true }); b.pop();
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2, s = i % 2 ? 0.035 : -0.035;
    b.tube(s, Math.sin(a + 0.2) * 0.025, Math.cos(a + 0.2) * 0.025, 0, Math.sin(a) * 0.285, Math.cos(a) * 0.285, 0.0032, 3, C(0xb8bcc0));
  }
  return b.build();
}

function basketTex() {
  const [c, x] = canvas(64);
  x.clearRect(0, 0, 64, 64);
  x.strokeStyle = '#d8dcdf'; x.lineWidth = 3;
  for (let i = 0; i <= 64; i += 12.8) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 64); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(64, i); x.stroke(); }
  const t = tex(c); t.repeat.set(3, 2);
  return t;
}

function limb(r, color) {
  const g = new THREE.CylinderGeometry(r * 0.85, r, 1, 7, 1, false);
  g.translate(0, 0.5, 0);
  const m = new THREE.Mesh(g, patch(new THREE.MeshLambertMaterial({ color }), { key: 'limb' }));
  m.castShadow = true;
  return m;
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion();
function orient(mesh, a, b) {
  _d.subVectors(b, a);
  const len = _d.length();
  mesh.position.copy(a);
  _q.setFromUnitVectors(_up, _d.divideScalar(len || 1));
  mesh.quaternion.copy(_q);
  mesh.scale.set(1, len, 1);
}
// two-bone IK: returns joint position given root A, target B, lengths, and a preferred bend direction
function ik(A, B, l1, l2, bend, out) {
  _d.subVectors(B, A);
  let d = _d.length();
  d = Math.min(Math.max(d, 0.05), l1 + l2 - 0.002);
  _d.normalize();
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
  // perpendicular toward bend
  _a.copy(bend).addScaledVector(_d, -bend.dot(_d)).normalize();
  out.copy(A).addScaledVector(_d, a).addScaledVector(_a, h);
  return out;
}

export class Bike {
  constructor(scene) {
    this.root = new THREE.Group();
    this.root.name = 'bike';
    this.lean = new THREE.Group();  // rolls with lean
    this.root.add(this.lean);
    const M = mat();
    // ---- static frame
    const b = new MeshBuilder();
    const fr = C(FRAME), ch = C(CHROME), bk = C(BLACK);
    const T = (a, c, r = 0.021, col = fr) => b.tube(a[0], a[1], a[2], c[0], c[1], c[2], r, 6, col);
    T([0, 0.3, -0.03], [0, 0.46, 0.2]); T([0, 0.46, 0.2], [0, 0.74, 0.36]);
    T([0, 0.3, 0.0], [0, 0.4, 0.16], 0.019); T([0, 0.4, 0.16], [0, 0.66, 0.34], 0.019);
    T([0, 0.3, -0.03], [0, 0.88, -0.21]);
    for (const s of [-0.06, 0.06]) { T([0, 0.3, -0.03], [s, WHEEL_R, -0.53], 0.013); T([0, 0.84, -0.19], [s, WHEEL_R, -0.53], 0.012); }
    T([0, 0.72, 0.37], [0, 0.88, 0.33], 0.03);
    // rear carrier
    b.box(0, 0.78, -0.48, 0.15, 0.02, 0.42, ch);
    for (const s of [-0.07, 0.07]) b.tube(s, 0.78, -0.62, s, WHEEL_R, -0.53, 0.008, 4, ch);
    // fender (rear)
    for (let i = 0; i < 9; i++) { const a0 = 0.35 + (i / 9) * 2.3, a1 = 0.35 + ((i + 1) / 9) * 2.3; b.tube(0, WHEEL_R + Math.sin(a0) * 0.35, -0.53 - Math.cos(a0) * 0.35, 0, WHEEL_R + Math.sin(a1) * 0.35, -0.53 - Math.cos(a1) * 0.35, 0.03, 5, ch); }
    // chain guard
    b.box(-0.075, 0.27, -0.27, 0.015, 0.12, 0.56, C(0x9aa0a6));
    // saddle
    b.blob(0, 0.92, -0.24, 0.1, 0.045, 0.15, C(0x2a1e18), null, 0, 1, 1);
    b.tube(0, 0.86, -0.21, 0, 0.92, -0.23, 0.012, 5, ch);
    // kickstand (center stand) folded
    this.frame = new THREE.Mesh(b.build(), M);
    this.frame.castShadow = true;
    this.lean.add(this.frame);
    // ---- stand (shown when parked)
    const sb = new MeshBuilder();
    for (const s of [-0.09, 0.09]) sb.tube(0, 0, 0, s, -0.36, 0.05, 0.012, 4, ch);
    this.stand = new THREE.Mesh(sb.build(), M);
    this.stand.position.set(0, WHEEL_R, -0.5);
    this.lean.add(this.stand);
    // ---- wheels
    const wg = wheelGeo();
    this.rearWheel = new THREE.Mesh(wg, M); this.rearWheel.position.set(0, WHEEL_R, -0.53); this.rearWheel.castShadow = true;
    this.lean.add(this.rearWheel);
    // ---- steering assembly: pivot at the head tube
    this.steer = new THREE.Group();
    this.steer.position.set(0, 0.8, 0.355);
    this.lean.add(this.steer);
    const f = new MeshBuilder();
    const o = (x, y, z) => [x, y - 0.8, z - 0.355];
    for (const s of [-0.05, 0.05]) f.tube(...o(s * 0.5, 0.72, 0.37), ...o(s, WHEEL_R, 0.53), 0.014, 5, ch);
    f.tube(...o(0, 0.86, 0.335), ...o(0, 1.0, 0.3), 0.016, 6, ch);
    const hb = [[-0.33, 1.04, 0.1], [-0.3, 1.04, 0.2], [-0.16, 1.02, 0.31], [0, 1.0, 0.31], [0.16, 1.02, 0.31], [0.3, 1.04, 0.2], [0.33, 1.04, 0.1]];
    for (let i = 0; i < hb.length - 1; i++) f.tube(...o(...hb[i]), ...o(...hb[i + 1]), 0.012, 6, ch);
    for (const s of [-1, 1]) {
      f.tube(...o(s * 0.33, 1.04, 0.1), ...o(s * 0.32, 1.04, 0.21), 0.019, 7, bk); // grips
      f.tube(...o(s * 0.22, 1.05, 0.29), ...o(s * 0.29, 1.02, 0.29), 0.006, 4, ch); // brake levers
    }
    // bell on the left
    f.blob(...o(0.15, 1.05, 0.31), 0.028, 0.02, 0.028, C(0xd8dce0), null, 0, 1, 1);
    // front fender
    for (let i = 0; i < 7; i++) { const a0 = 0.5 + (i / 7) * 1.9, a1 = 0.5 + ((i + 1) / 7) * 1.9; f.tube(...o(0, WHEEL_R + Math.sin(a0) * 0.35, 0.53 + Math.cos(a0) * 0.35), ...o(0, WHEEL_R + Math.sin(a1) * 0.35, 0.53 + Math.cos(a1) * 0.35), 0.03, 5, ch); }
    // basket frame
    const bx = 0.2, by0 = 0.76, by1 = 1.0, bz0 = 0.46, bz1 = 0.8;
    const edges = [[[-bx, by0, bz0], [bx, by0, bz0]], [[-bx, by0, bz1], [bx, by0, bz1]], [[-bx, by0, bz0], [-bx, by0, bz1]], [[bx, by0, bz0], [bx, by0, bz1]],
      [[-bx, by1, bz0], [bx, by1, bz0]], [[-bx, by1, bz1], [bx, by1, bz1]], [[-bx, by1, bz0], [-bx, by1, bz1]], [[bx, by1, bz0], [bx, by1, bz1]],
      [[-bx, by0, bz0], [-bx, by1, bz0]], [[bx, by0, bz0], [bx, by1, bz0]], [[-bx, by0, bz1], [-bx, by1, bz1]], [[bx, by0, bz1], [bx, by1, bz1]]];
    for (const [p, q] of edges) f.tube(...o(...p), ...o(...q), 0.007, 4, C(0xd8dcdf));
    f.tube(...o(0, 0.98, 0.3), ...o(0, by1, bz0), 0.01, 4, ch);
    f.tube(...o(0, by0, bz1), ...o(0, WHEEL_R + 0.02, 0.53), 0.008, 4, ch);
    // lamp housing
    f.push(); f.translate(...o(0, 0.86, 0.83)); f.rotateX(Math.PI / 2); f.cyl(0, -0.05, 0, 0.045, 0.04, 0.1, 10, C(0xd8d8d0), { cap: true }); f.pop();
    this.front = new THREE.Mesh(f.build(), M);
    this.front.castShadow = true;
    this.steer.add(this.front);
    const bt = basketTex();
    const bm = patch(new THREE.MeshLambertMaterial({ map: bt, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }), { key: 'basket' });
    const basket = new THREE.Mesh(new THREE.BoxGeometry(bx * 2, by1 - by0, bz1 - bz0), bm);
    basket.position.set(0, (by0 + by1) / 2 - 0.8, (bz0 + bz1) / 2 - 0.355);
    this.steer.add(basket);
    this.lampMat = patch(new THREE.MeshLambertMaterial({ color: 0xfff6d8, emissive: 0xfff0c0, emissiveIntensity: 0 }), { key: 'lamp' });
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.038, 14), this.lampMat);
    lens.position.set(0, 0.86 - 0.8, 0.885 - 0.355);
    this.steer.add(lens);
    this.frontWheel = new THREE.Mesh(wg, M); this.frontWheel.position.set(0, WHEEL_R - 0.8, 0.53 - 0.355); this.frontWheel.castShadow = true;
    this.steer.add(this.frontWheel);
    this.spot = new THREE.SpotLight(0xffeccc, 0, 34, 0.42, 0.55, 1.4);
    this.spot.position.set(0, 0.06, 0.53);
    this.spotTarget = new THREE.Object3D(); this.spotTarget.position.set(0, -0.7, 8);
    this.steer.add(this.spot, this.spotTarget);
    this.spot.target = this.spotTarget;
    // ---- crank
    this.crank = new THREE.Group();
    this.crank.position.set(0, 0.3, -0.03);
    this.lean.add(this.crank);
    const cb = new MeshBuilder();
    cb.push(); cb.rotateZ(-Math.PI / 2); cb.cyl(0, -0.085, 0, 0.1, 0.1, 0.012, 16, C(0xa0a4a8), { cap: true }); cb.pop();
    cb.tube(0.08, 0, 0, 0.08, -0.17, 0, 0.012, 4, ch);
    cb.tube(-0.08, 0, 0, -0.08, 0.17, 0, 0.012, 4, ch);
    cb.box(0.13, -0.18, 0, 0.09, 0.022, 0.07, bk);
    cb.box(-0.13, 0.16, 0, 0.09, 0.022, 0.07, bk);
    this.crankMesh = new THREE.Mesh(cb.build(), M);
    this.crankMesh.castShadow = true;
    this.crank.add(this.crankMesh);
    // ---- rider limbs
    this.body = new THREE.Group();
    this.lean.add(this.body);
    const skin = 0xe9c3a0, shorts = 0x2c3a5c, shirt = 0xf2f0ea;
    this.thighs = [limb(0.075, shorts), limb(0.075, shorts)];
    this.shins = [limb(0.05, skin), limb(0.05, skin)];
    this.feet = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.24), patch(new THREE.MeshLambertMaterial({ color: 0x2a5a8a }), { key: 'limb' })); m.castShadow = true; return m; });
    this.uarms = [limb(0.05, shirt), limb(0.05, shirt)];
    this.farms = [limb(0.038, skin), limb(0.038, skin)];
    this.hands = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), patch(new THREE.MeshLambertMaterial({ color: skin }), { key: 'limb' })); m.scale.set(1, 0.8, 1.3); return m; });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.22), patch(new THREE.MeshLambertMaterial({ color: shirt }), { key: 'limb' }));
    torso.position.set(0, 1.2, -0.18); torso.rotation.x = 0.12; torso.castShadow = true;
    this.torso = torso;
    this.body.add(...this.thighs, ...this.shins, ...this.feet, ...this.uarms, ...this.farms, ...this.hands, torso);
    this.root.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
    scene.add(this.root);

    // physics state
    this.x = 0; this.z = 0; this.y = 0;
    this.heading = 0;   // forward = (sin h, cos h)
    this.speed = 0;
    this.steerAng = 0;
    this.leanAng = 0;
    this.pitch = 0;
    this.crankAng = 0;
    this.wheelAng = 0;
    this.pedaling = 0;
    this.braking = 0;
    this.parked = true;
    this.lampOn = true;
    this._k = new THREE.Vector3(); this._p = new THREE.Vector3(); this._h = new THREE.Vector3(); this._s = new THREE.Vector3(); this._g = new THREE.Vector3();
    this._bendL = new THREE.Vector3(); this._bendA = new THREE.Vector3();
  }
  setRiding(r) {
    this.parked = !r;
    this.body.visible = r;
    this.stand.rotation.x = r ? -1.25 : 0;
  }
  // update visual transforms from state
  sync(lampsOn) {
    const r = this.root;
    r.position.set(this.x, this.y, this.z);
    r.rotation.set(0, this.heading, 0);
    this.lean.rotation.set(-this.pitch, 0, this.leanAng, 'YXZ');
    this.steer.rotation.set(0, this.steerAng, 0);
    this.rearWheel.rotation.x = this.wheelAng;
    this.frontWheel.rotation.x = this.wheelAng;
    this.crank.rotation.x = this.crankAng;
    const on = this.lampOn && lampsOn > 0.05 && !this.parked;
    this.lampMat.emissiveIntensity = on ? 2.5 : 0;
    this.spot.intensity = on ? 38 * lampsOn : 0;
    if (!this.body.visible) return;
    // legs: hips -> pedals (pedal positions in lean-space)
    const ca = Math.cos(this.crankAng), sa = Math.sin(this.crankAng);
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? 1 : -1;
      // crank arm rotates around x; right pedal starts down
      const py = 0.3 + (-0.17 * s) * ca, pz = -0.03 + (-0.17 * s) * sa;
      this._p.set(0.13 * s, py, pz);
      this._h.set(0.1 * s, 0.94, -0.25);
      this._bendL.set(0.15 * s, 0.25, 1);
      ik(this._h, this._p, 0.44, 0.45, this._bendL, this._k);
      orient(this.thighs[i], this._h, this._k);
      orient(this.shins[i], this._k, this._p);
      this.feet[i].position.set(this._p.x, this._p.y + 0.03, this._p.z + 0.04);
      this.feet[i].rotation.x = -0.15;
    }
    // arms: shoulders -> grips (grips follow steering)
    const cs = Math.cos(this.steerAng), ss = Math.sin(this.steerAng);
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? 1 : -1;
      const gx = 0.32 * s, gz = 0.16 - 0.355;
      this._g.set(gx * cs + gz * ss, 1.04, -gx * ss + gz * cs + 0.355);
      this._s.set(0.2 * s, 1.4, -0.16);
      this._bendA.set(1.0 * s, -0.8, -0.2);
      ik(this._s, this._g, 0.3, 0.29, this._bendA, this._k);
      orient(this.uarms[i], this._s, this._k);
      orient(this.farms[i], this._k, this._g);
      this.hands[i].position.copy(this._g);
    }
  }
}
export { WHEEL_R };
