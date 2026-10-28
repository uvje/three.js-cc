import * as THREE from 'three';

// Accumulates indexed geometry with per-vertex color and metric UVs.
// All the village's static architecture is built through this and merged per material.

const colorCache = new Map();
export function C(hex) {
  let c = colorCache.get(hex);
  if (!c) { c = new THREE.Color(hex); colorCache.set(hex, c); }
  return c;
}
const _tmpC = new THREE.Color();
export function varyColor(hex, rng, amount = 0.06) {
  const c = _tmpC.copy(C(hex));
  const k = 1 + (rng.next() * 2 - 1) * amount;
  return new THREE.Color(c.r * k, c.g * k, c.b * k);
}
export function mixColor(a, b, t) { return new THREE.Color().copy(C(a)).lerp(C(b), t); }

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _e = new THREE.Euler();

export class MeshBuilder {
  constructor() {
    this.pos = []; this.nor = []; this.col = []; this.uv = []; this.idx = [];
    this.vc = 0;
    this.m = new THREE.Matrix4();
    this.nm = new THREE.Matrix3();
    this.stack = [];
    this.identity = true;
  }
  get empty() { return this.vc === 0; }

  // ---- transform ----
  push() { this.stack.push(this.m.clone()); return this; }
  pop() { this.m.copy(this.stack.pop()); this._upd(); return this; }
  _upd() { this.nm.getNormalMatrix(this.m); this.identity = false; }
  reset() { this.m.identity(); this.nm.identity(); this.stack.length = 0; this.identity = true; return this; }
  translate(x, y, z) { this.m.multiply(_m.makeTranslation(x, y, z)); this._upd(); return this; }
  rotateY(a) { this.m.multiply(_m.makeRotationY(a)); this._upd(); return this; }
  rotateX(a) { this.m.multiply(_m.makeRotationX(a)); this._upd(); return this; }
  rotateZ(a) { this.m.multiply(_m.makeRotationZ(a)); this._upd(); return this; }
  scale(x, y, z) { this.m.multiply(_m.makeScale(x, y, z)); this._upd(); return this; }
  place(x, y, z, ry = 0) { return this.reset().translate(x, y, z).rotateY(ry); }

  // ---- raw ----
  vert(x, y, z, nx, ny, nz, c, u, v) {
    if (this.identity) { this.pos.push(x, y, z); this.nor.push(nx, ny, nz); }
    else {
      _v.set(x, y, z).applyMatrix4(this.m); this.pos.push(_v.x, _v.y, _v.z);
      _n.set(nx, ny, nz).applyMatrix3(this.nm).normalize(); this.nor.push(_n.x, _n.y, _n.z);
    }
    this.col.push(c.r, c.g, c.b);
    this.uv.push(u, v);
    return this.vc++;
  }
  // Quad from 4 corners (CCW seen from the front). uv given as [u0,v0,u1,v1] mapped a->(u0,v0) b->(u1,v0) c->(u1,v1) d->(u0,v1)
  quad(a, b, c, d, color, uv = null, normal = null) {
    let nx, ny, nz;
    if (normal) { nx = normal[0]; ny = normal[1]; nz = normal[2]; }
    else {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
      nx = uy * vz - uz * vy; ny = uz * vx - ux * vz; nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    }
    let u0 = 0, v0 = 0, u1, v1;
    if (uv) { u0 = uv[0]; v0 = uv[1]; u1 = uv[2]; v1 = uv[3]; }
    else {
      u1 = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      v1 = Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
    }
    const i = this.vert(a[0], a[1], a[2], nx, ny, nz, color, u0, v0);
    this.vert(b[0], b[1], b[2], nx, ny, nz, color, u1, v0);
    this.vert(c[0], c[1], c[2], nx, ny, nz, color, u1, v1);
    this.vert(d[0], d[1], d[2], nx, ny, nz, color, u0, v1);
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
    return this;
  }
  tri(a, b, c, color, uvs = null) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const t = uvs || [0, 0, 1, 0, 0.5, 1];
    const i = this.vert(a[0], a[1], a[2], nx, ny, nz, color, t[0], t[1]);
    this.vert(b[0], b[1], b[2], nx, ny, nz, color, t[2], t[3]);
    this.vert(c[0], c[1], c[2], nx, ny, nz, color, t[4], t[5]);
    this.idx.push(i, i + 1, i + 2);
    return this;
  }

  // Axis-aligned box in local space. (x,z) center, y = bottom. faces: skip bits {top,bottom,px,nx,pz,nz}
  box(x, y, z, sx, sy, sz, color, o = {}) {
    const hx = sx / 2, hz = sz / 2, y0 = y, y1 = y + sy;
    const x0 = x - hx, x1 = x + hx, z0 = z - hz, z1 = z + hz;
    const us = o.uvScale || 1;
    const top = o.topColor || color;
    if (!o.noTop) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top, [x0 * us, z1 * us, x1 * us, z0 * us], [0, 1, 0]);
    if (o.bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], color, null, [0, -1, 0]);
    if (!o.noPZ) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], o.pzColor || color, [x0 * us, y0 * us, x1 * us, y1 * us], [0, 0, 1]);
    if (!o.noNZ) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], o.nzColor || color, [-x1 * us, y0 * us, -x0 * us, y1 * us], [0, 0, -1]);
    if (!o.noPX) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], o.sideColor || color, [-z1 * us, y0 * us, -z0 * us, y1 * us], [1, 0, 0]);
    if (!o.noNX) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], o.sideColor || color, [z0 * us, y0 * us, z1 * us, y1 * us], [-1, 0, 0]);
    return this;
  }
  // Box defined by center (cx,cy,cz) — convenience
  cbox(cx, cy, cz, sx, sy, sz, color, o) { return this.box(cx, cy - sy / 2, cz, sx, sy, sz, color, o); }

  // Cylinder along local Y from y0 to y1
  cyl(x, y0, z, r0, r1, h, seg, color, o = {}) {
    const base = this.vc;
    const y1 = y0 + h;
    const slope = (r0 - r1) / h;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const nl = Math.hypot(1, slope);
      const nx = ca / nl, ny = slope / nl, nz = sa / nl;
      const u = (i / seg) * Math.PI * 2 * Math.max(r0, 0.05);
      this.vert(x + ca * r0, y0, z + sa * r0, nx, ny, nz, color, u, 0);
      this.vert(x + ca * r1, y1, z + sa * r1, nx, ny, nz, o.topColor || color, u, h);
    }
    for (let i = 0; i < seg; i++) {
      const a = base + i * 2;
      this.idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
    if (o.cap && r1 > 0.001) {
      const c0 = this.vert(x, y1, z, 0, 1, 0, o.capColor || color, 0, 0);
      for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2; this.vert(x + Math.cos(a) * r1, y1, z + Math.sin(a) * r1, 0, 1, 0, o.capColor || color, Math.cos(a) * r1, Math.sin(a) * r1); }
      for (let i = 0; i < seg; i++) this.idx.push(c0, c0 + 2 + i, c0 + 1 + i);
    }
    return this;
  }
  // Cylinder between two arbitrary points (local space)
  tube(ax, ay, az, bx, by, bz, r, seg, color, cap = false) {
    _v.set(bx - ax, by - ay, bz - az);
    const len = _v.length();
    if (len < 1e-5) return this;
    _q.setFromUnitVectors(_n.set(0, 1, 0), _v.divideScalar(len));
    this.push();
    this.m.multiply(_m.compose(_p.set(ax, ay, az), _q, _s.set(1, 1, 1)));
    this._upd();
    this.cyl(0, 0, 0, r, r, len, seg, color, { cap });
    this.pop();
    return this;
  }
  cone(x, y0, z, r, h, seg, color, tipColor) {
    const base = this.vc;
    const nl = Math.hypot(h, r);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      this.vert(x + ca * r, y0, z + sa * r, (ca * h) / nl, r / nl, (sa * h) / nl, color, i / seg, 0);
      const am = ((i + 0.5) / seg) * Math.PI * 2;
      this.vert(x, y0 + h, z, (Math.cos(am) * h) / nl, r / nl, (Math.sin(am) * h) / nl, tipColor || color, i / seg, 1);
    }
    for (let i = 0; i < seg; i++) { const a = base + i * 2; this.idx.push(a, a + 1, a + 2); }
    return this;
  }
  // Rounded blob (low-poly icosphere with spherical normals), optional jitter rng
  blob(x, y, z, rx, ry, rz, color, rng = null, jitter = 0.18, detail = 1, darkBottom = 0.75) {
    const g = blobTemplate(detail);
    const base = this.vc;
    const p = g.attributes.position.array;
    const cBot = new THREE.Color(color.r * darkBottom, color.g * darkBottom, color.b * darkBottom);
    const cc = new THREE.Color();
    for (let i = 0; i < p.length; i += 3) {
      const px = p[i], py = p[i + 1], pz = p[i + 2];
      const j = rng ? 1 + (rng.next() * 2 - 1) * jitter : 1;
      cc.copy(cBot).lerp(color, (py + 1) / 2);
      this.vert(x + px * rx * j, y + py * ry * j, z + pz * rz * j, px, py, pz, cc, px * rx, py * ry);
    }
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i++) this.idx.push(base + ix[i]);
    return this;
  }

  // Gable roof over footprint w (x) × d (z), eave at y, ridge along X. overhang o, pitch k (rise/run)
  gableRoof(w, d, y, o, k, color, o2 = {}) {
    const hw = w / 2 + (o2.sideOverhang ?? o), hd = d / 2 + o;
    const rise = (d / 2) * k, drop = o * k;
    const ye = y - drop, yr = y + rise;
    const th = o2.thickness ?? 0.18;
    const slopeLen = Math.hypot(hd, rise + drop);
    // front (+z) and back (-z) slopes
    this.quad([-hw, ye, hd], [hw, ye, hd], [hw, yr, 0], [-hw, yr, 0], color, [-hw, 0, hw, slopeLen]);
    this.quad([hw, ye, -hd], [-hw, ye, -hd], [-hw, yr, 0], [hw, yr, 0], color, [-hw, 0, hw, slopeLen]);
    const under = o2.underColor || C(0x3a3430);
    // undersides
    this.quad([-hw, yr - th, 0], [hw, yr - th, 0], [hw, ye - th, hd], [-hw, ye - th, hd], under);
    this.quad([hw, yr - th, 0], [-hw, yr - th, 0], [-hw, ye - th, -hd], [hw, ye - th, -hd], under);
    // fascia edges
    const fas = o2.edgeColor || color;
    this.quad([-hw, ye - th, hd], [hw, ye - th, hd], [hw, ye, hd], [-hw, ye, hd], fas);
    this.quad([hw, ye - th, -hd], [-hw, ye - th, -hd], [-hw, ye, -hd], [hw, ye, -hd], fas);
    // verge (gable edges)
    this.quad([hw, ye - th, hd], [hw, yr - th, 0], [hw, yr, 0], [hw, ye, hd], fas);
    this.quad([hw, yr - th, 0], [hw, ye - th, -hd], [hw, ye, -hd], [hw, yr, 0], fas);
    this.quad([-hw, yr - th, 0], [-hw, ye - th, hd], [-hw, ye, hd], [-hw, yr, 0], fas);
    this.quad([-hw, ye - th, -hd], [-hw, yr - th, 0], [-hw, yr, 0], [-hw, ye, -hd], fas);
    // gable wall triangles (at the wall plane)
    if (o2.gableColor) {
      const gw = w / 2;
      this.tri([gw, y, d / 2], [gw, y, -d / 2], [gw, y + rise, 0], o2.gableColor, [0, 0, d, 0, d / 2, rise]);
      this.tri([-gw, y, -d / 2], [-gw, y, d / 2], [-gw, y + rise, 0], o2.gableColor, [0, 0, d, 0, d / 2, rise]);
    }
    if (o2.ridgeColor) this.box(0, yr - 0.08, 0, hw * 2 + 0.1, 0.24, 0.32, o2.ridgeColor);
    return yr;
  }

  // Hip roof (ridge along X when w>d). Returns ridge height.
  hipRoof(w, d, y, o, k, color, o2 = {}) {
    const hw = w / 2 + o, hd = d / 2 + o;
    const drop = o * k;
    const ye = y - drop;
    const rise = (d / 2) * k;
    const yr = y + rise;
    const rl = Math.max(hw - hd, 0); // half ridge length
    const th = o2.thickness ?? 0.18;
    const sl = Math.hypot(hd, rise + drop);
    this.quad([-hw, ye, hd], [hw, ye, hd], [rl, yr, 0], [-rl, yr, 0], color, [-hw, 0, hw, sl]);
    this.quad([hw, ye, -hd], [-hw, ye, -hd], [-rl, yr, 0], [rl, yr, 0], color, [-hw, 0, hw, sl]);
    this.tri([hw, ye, hd], [hw, ye, -hd], [rl, yr, 0], color, [-hd, 0, hd, 0, 0, sl]);
    this.tri([-hw, ye, -hd], [-hw, ye, hd], [-rl, yr, 0], color, [-hd, 0, hd, 0, 0, sl]);
    const fas = o2.edgeColor || color;
    this.quad([-hw, ye - th, hd], [hw, ye - th, hd], [hw, ye, hd], [-hw, ye, hd], fas);
    this.quad([hw, ye - th, -hd], [-hw, ye - th, -hd], [-hw, ye, -hd], [hw, ye, -hd], fas);
    this.quad([hw, ye - th, hd], [hw, ye - th, -hd], [hw, ye, -hd], [hw, ye, hd], fas);
    this.quad([-hw, ye - th, -hd], [-hw, ye - th, hd], [-hw, ye, hd], [-hw, ye, -hd], fas);
    const under = o2.underColor || C(0x3a3430);
    this.quad([-hw, ye - th, -hd], [hw, ye - th, -hd], [hw, ye - th, hd], [-hw, ye - th, hd], under, null, [0, -1, 0]);
    let rx = rl;
    if (o2.irimoya && rl > 0.6) {
      // small gable sitting on the hip at each ridge end (irimoya style)
      const t = (hw - rl) * 0.45, xg = rl + t, yb = yr - k * t;
      const gc = o2.gableColor || C(0x6b4a33);
      this.tri([xg, yb, t], [xg, yb, -t], [xg, yr, 0], gc);
      this.quad([rl, yb, t], [xg, yb, t], [xg, yr, 0], [rl, yr, 0], color);
      this.quad([xg, yb, -t], [rl, yb, -t], [rl, yr, 0], [xg, yr, 0], color);
      this.tri([-xg, yb, -t], [-xg, yb, t], [-xg, yr, 0], gc);
      this.quad([-xg, yb, t], [-rl, yb, t], [-rl, yr, 0], [-xg, yr, 0], color);
      this.quad([-rl, yb, -t], [-xg, yb, -t], [-xg, yr, 0], [-rl, yr, 0], color);
      rx = xg;
    }
    if (o2.ridgeColor && rl > 0) this.box(0, yr - 0.08, 0, rx * 2 + 0.3, 0.24, 0.3, o2.ridgeColor);
    return yr;
  }

  // Flat strip along a polyline of [x,y,z] points with per-point width
  strip(points, width, color, o = {}) {
    const n = points.length;
    if (n < 2) return this;
    const base = this.vc;
    let dist = o.v0 || 0;
    const vScale = o.vScale ?? 1;
    for (let i = 0; i < n; i++) {
      const p = points[i];
      const pa = points[Math.max(i - 1, 0)], pb = points[Math.min(i + 1, n - 1)];
      let tx = pb[0] - pa[0], tz = pb[2] - pa[2];
      const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const nx = -tz, nz = tx;
      if (i > 0) dist += Math.hypot(p[0] - points[i - 1][0], p[2] - points[i - 1][2]);
      const w = (typeof width === 'function' ? width(i) : width) / 2;
      const off = o.offset || 0;
      const yl = p[1] + (o.leftLift || 0), yr = p[1] + (o.rightLift || 0);
      this.vert(p[0] + nx * (w + off), yl, p[2] + nz * (w + off), 0, 1, 0, color, 0, dist * vScale);
      this.vert(p[0] - nx * (w - off), yr, p[2] - nz * (w - off), 0, 1, 0, color, 1, dist * vScale);
    }
    for (let i = 0; i < n - 1; i++) {
      const a = base + i * 2;
      this.idx.push(a, a + 3, a + 1, a, a + 2, a + 3);
    }
    return this;
  }

  // Append an existing THREE geometry with the current transform
  addGeometry(geom, color, matrix = null) {
    const g = geom.index ? geom : geom;
    const p = g.attributes.position.array, nrm = g.attributes.normal.array;
    const uv = g.attributes.uv ? g.attributes.uv.array : null;
    const base = this.vc;
    if (matrix) { this.push(); this.m.multiply(matrix); this._upd(); }
    for (let i = 0, j = 0; i < p.length; i += 3, j += 2) this.vert(p[i], p[i + 1], p[i + 2], nrm[i], nrm[i + 1], nrm[i + 2], color, uv ? uv[j] : 0, uv ? uv[j + 1] : 0);
    if (g.index) { const ix = g.index.array; for (let i = 0; i < ix.length; i++) this.idx.push(base + ix[i]); }
    else for (let i = 0; i < p.length / 3; i++) this.idx.push(base + i);
    if (matrix) this.pop();
    return this;
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.vc > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

const blobCache = {};
function blobTemplate(detail) {
  if (!blobCache[detail]) {
    let g = new THREE.IcosahedronGeometry(1, detail);
    g.deleteAttribute('uv'); g.deleteAttribute('normal');
    g = mergeVerts(g);
    blobCache[detail] = g;
  }
  return blobCache[detail];
}
function mergeVerts(g) {
  const p = g.attributes.position.array;
  const map = new Map(); const out = []; const idx = [];
  for (let i = 0; i < p.length; i += 3) {
    const key = `${p[i].toFixed(4)},${p[i + 1].toFixed(4)},${p[i + 2].toFixed(4)}`;
    let k = map.get(key);
    if (k === undefined) { k = out.length / 3; map.set(key, k); out.push(p[i], p[i + 1], p[i + 2]); }
    idx.push(k);
  }
  const ng = new THREE.BufferGeometry();
  ng.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  ng.setIndex(idx);
  return ng;
}

// Builders keyed by material and spatial chunk, so static geometry merges into few draw calls but still frustum-culls.
export class ChunkedBuilders {
  constructor(chunkSize = 200) { this.size = chunkSize; this.map = new Map(); }
  get(mat, x, z) {
    const cx = Math.floor(x / this.size), cz = Math.floor(z / this.size);
    const key = mat + '|' + cx + '|' + cz;
    let b = this.map.get(key);
    if (!b) { b = new MeshBuilder(); b.matKey = mat; this.map.set(key, b); }
    return b;
  }
  // Returns meshes built with materials from lib (key -> material)
  buildMeshes(lib, opts = {}) {
    const meshes = [];
    for (const [key, b] of this.map) {
      if (b.empty) continue;
      const mat = lib[b.matKey];
      if (!mat) { console.warn('missing material', b.matKey); continue; }
      const m = new THREE.Mesh(b.build(), mat);
      m.castShadow = opts.noShadow?.includes(b.matKey) ? false : true;
      m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      m.name = key;
      meshes.push(m);
    }
    return meshes;
  }
}
