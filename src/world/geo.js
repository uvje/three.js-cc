// Polylines with arc-length parameterisation and a grid index for nearest-point queries.

export function catmullRom(ctrl, step = 2) {
  const dense = [];
  const n = ctrl.length;
  const P = (i) => ctrl[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const sub = Math.max(4, Math.ceil(segLen / 1.5));
    for (let k = 0; k < sub; k++) {
      const t = k / sub, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dense.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  dense.push(ctrl[n - 1].slice());
  return resample(dense, step);
}

export function resample(pts, step) {
  const out = [pts[0].slice()];
  let carry = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-6) continue;
    let s = step - carry;
    while (s <= L) {
      const t = s / L;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      s += step;
    }
    carry = L - (s - step);
  }
  const last = pts[pts.length - 1];
  const pl = out[out.length - 1];
  if (Math.hypot(last[0] - pl[0], last[1] - pl[1]) > step * 0.3) out.push(last.slice());
  else out[out.length - 1] = last.slice();
  return out;
}

export class Polyline {
  constructor(pts) {
    this.pts = pts;
    this.s = new Float32Array(pts.length);
    for (let i = 1; i < pts.length; i++) this.s[i] = this.s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    this.length = this.s[pts.length - 1];
    this._index();
  }
  _index() {
    this.cell = 24;
    this.grid = new Map();
    let minx = Infinity, minz = Infinity, maxx = -Infinity, maxz = -Infinity;
    for (let i = 0; i < this.pts.length - 1; i++) {
      const a = this.pts[i], b = this.pts[i + 1];
      const x0 = Math.floor(Math.min(a[0], b[0]) / this.cell), x1 = Math.floor(Math.max(a[0], b[0]) / this.cell);
      const z0 = Math.floor(Math.min(a[1], b[1]) / this.cell), z1 = Math.floor(Math.max(a[1], b[1]) / this.cell);
      for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
        const k = cx * 100003 + cz;
        let arr = this.grid.get(k); if (!arr) { arr = []; this.grid.set(k, arr); }
        arr.push(i);
      }
      minx = Math.min(minx, a[0], b[0]); maxx = Math.max(maxx, a[0], b[0]);
      minz = Math.min(minz, a[1], b[1]); maxz = Math.max(maxz, a[1], b[1]);
    }
    this.bbox = [minx, minz, maxx, maxz];
  }
  // nearest point within maxR (returns null if none)
  nearest(x, z, maxR = 60, out = {}) {
    const c = this.cell;
    const r = Math.ceil(maxR / c);
    const cx = Math.floor(x / c), cz = Math.floor(z / c);
    let best = maxR * maxR, bi = -1, bt = 0;
    const seen = this._seen || (this._seen = new Set());
    seen.clear();
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
      const arr = this.grid.get((cx + i) * 100003 + (cz + j));
      if (!arr) continue;
      for (const si of arr) {
        if (seen.has(si)) continue; seen.add(si);
        const a = this.pts[si], b = this.pts[si + 1];
        const dx = b[0] - a[0], dz = b[1] - a[1];
        const L2 = dx * dx + dz * dz || 1e-9;
        let t = ((x - a[0]) * dx + (z - a[1]) * dz) / L2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = a[0] + dx * t, pz = a[1] + dz * t;
        const d2 = (x - px) ** 2 + (z - pz) ** 2;
        if (d2 < best) { best = d2; bi = si; bt = t; }
      }
    }
    if (bi < 0) return null;
    const a = this.pts[bi], b = this.pts[bi + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    out.d = Math.sqrt(best);
    out.i = bi; out.t = bt;
    out.s = this.s[bi] + (this.s[bi + 1] - this.s[bi]) * bt;
    out.x = a[0] + (b[0] - a[0]) * bt; out.z = a[1] + (b[1] - a[1]) * bt;
    out.tx = (b[0] - a[0]) / L; out.tz = (b[1] - a[1]) / L;
    // signed side: + is to the left of travel direction (tx,tz) -> normal (-tz, tx)
    out.side = Math.sign((x - out.x) * -out.tz + (z - out.z) * out.tx) || 1;
    return out;
  }
  at(s, out = {}) {
    s = Math.max(0, Math.min(this.length, s));
    let lo = 0, hi = this.pts.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.s[m] <= s) lo = m; else hi = m; }
    const a = this.pts[lo], b = this.pts[hi];
    const seg = this.s[hi] - this.s[lo] || 1;
    const t = (s - this.s[lo]) / seg;
    out.x = a[0] + (b[0] - a[0]) * t; out.z = a[1] + (b[1] - a[1]) * t;
    out.tx = (b[0] - a[0]) / seg; out.tz = (b[1] - a[1]) / seg;
    out.i = lo; out.t = t;
    return out;
  }
  // value interpolated from a per-point array at arc length s
  sampleArray(arr, s) {
    const p = this.at(s);
    return arr[p.i] + (arr[Math.min(p.i + 1, arr.length - 1)] - arr[p.i]) * p.t;
  }
}

export function smoothArray(arr, radius, passes = 2) {
  let a = Float32Array.from(arr);
  for (let p = 0; p < passes; p++) {
    const b = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) {
      let s = 0, n = 0;
      for (let k = -radius; k <= radius; k++) { const j = Math.max(0, Math.min(a.length - 1, i + k)); s += a[j]; n++; }
      b[i] = s / n;
    }
    a = b;
  }
  return a;
}

// segment distance helper
export function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const L2 = dx * dx + dz * dz || 1e-9;
  let t = ((px - ax) * dx + (pz - az) * dz) / L2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return [Math.hypot(px - (ax + dx * t), pz - (az + dz * t)), t];
}

// point in rotated rectangle (center, half extents, angle where local +z = (sin a, cos a))
export function inRect(px, pz, cx, cz, hw, hd, a, margin = 0) {
  const dx = px - cx, dz = pz - cz;
  const c = Math.cos(a), s = Math.sin(a);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  return Math.abs(lx) <= hw + margin && Math.abs(lz) <= hd + margin;
}
