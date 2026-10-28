// 2D collision on the ground plane plus walkable surfaces (bridges, platforms, stairs) above the terrain.

export const CF = { WALK: 1, BIKE: 2, ALL: 3 };

export class Collision {
  constructor() {
    this.cell = 8;
    this.grid = new Map();
    this.pgrid = new Map();
    this.colliders = [];
    this.dynamic = [];
    this.platforms = [];
    this._stamp = 0;
  }
  key(cx, cz) { return (cx + 1000) * 4000 + (cz + 1000); }
  _insert(map, obj, x0, z0, x1, z1) {
    const c = this.cell;
    const ax = Math.floor(x0 / c), bx = Math.floor(x1 / c), az = Math.floor(z0 / c), bz = Math.floor(z1 / c);
    for (let i = ax; i <= bx; i++) for (let j = az; j <= bz; j++) {
      const k = this.key(i, j);
      let arr = map.get(k); if (!arr) { arr = []; map.set(k, arr); }
      arr.push(obj);
    }
  }
  addCircle(x, z, r, flags = CF.ALL, tag = null) {
    const o = { t: 0, x, z, r, flags, tag, s: 0 };
    this.colliders.push(o);
    this._insert(this.grid, o, x - r, z - r, x + r, z + r);
    return o;
  }
  // oriented box; local +z = (sin a, cos a)
  addBox(cx, cz, hw, hd, a, flags = CF.ALL, tag = null) {
    const o = { t: 1, x: cx, z: cz, hw, hd, c: Math.cos(a), sn: Math.sin(a), flags, tag, s: 0 };
    const R = Math.hypot(hw, hd);
    this.colliders.push(o);
    this._insert(this.grid, o, cx - R, cz - R, cx + R, cz + R);
    return o;
  }
  addSegment(ax, az, bx, bz, r = 0.08, flags = CF.ALL, tag = null) {
    const o = { t: 2, ax, az, bx, bz, r, flags, tag, s: 0 };
    this.colliders.push(o);
    this._insert(this.grid, o, Math.min(ax, bx) - r, Math.min(az, bz) - r, Math.max(ax, bx) + r, Math.max(az, bz) + r);
    return o;
  }
  remove(o) { o.flags = 0; }
  addDynamicBox() { const o = { t: 1, x: 0, z: 0, hw: 1, hd: 1, c: 1, sn: 0, flags: 0, tag: 'dynamic', s: 0 }; this.dynamic.push(o); return o; }

  // Push a circle (pos.x, pos.z, radius) out of colliders. Returns the accumulated push normal (or null).
  resolve(pos, radius, mask) {
    let hit = null;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      const stamp = ++this._stamp;
      const c = this.cell;
      const ax = Math.floor((pos.x - radius - 1) / c), bx = Math.floor((pos.x + radius + 1) / c);
      const az = Math.floor((pos.z - radius - 1) / c), bz = Math.floor((pos.z + radius + 1) / c);
      const test = (o) => {
          if (o.s === stamp || !(o.flags & mask)) return;
          o.s = stamp;
          let nx = 0, nz = 0, pen = 0;
          if (o.t === 0) {
            const dx = pos.x - o.x, dz = pos.z - o.z, d = Math.hypot(dx, dz), rr = o.r + radius;
            if (d >= rr) return;
            if (d < 1e-6) { nx = 1; nz = 0; } else { nx = dx / d; nz = dz / d; }
            pen = rr - d;
          } else if (o.t === 1) {
            const dx = pos.x - o.x, dz = pos.z - o.z;
            const lx = dx * o.c - dz * o.sn, lz = dx * o.sn + dz * o.c;
            const qx = Math.max(-o.hw, Math.min(o.hw, lx)), qz = Math.max(-o.hd, Math.min(o.hd, lz));
            const ex = lx - qx, ez = lz - qz;
            const d = Math.hypot(ex, ez);
            let lnx, lnz;
            if (d < 1e-6) {
              const px = o.hw - Math.abs(lx), pz = o.hd - Math.abs(lz);
              if (px < pz) { lnx = Math.sign(lx) || 1; lnz = 0; pen = px + radius; } else { lnx = 0; lnz = Math.sign(lz) || 1; pen = pz + radius; }
            } else {
              if (d >= radius) return;
              lnx = ex / d; lnz = ez / d; pen = radius - d;
            }
            nx = lnx * o.c + lnz * o.sn; nz = -lnx * o.sn + lnz * o.c;
          } else {
            const dx = o.bx - o.ax, dz = o.bz - o.az, L2 = dx * dx + dz * dz || 1e-9;
            let t = ((pos.x - o.ax) * dx + (pos.z - o.az) * dz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
            const px = o.ax + dx * t, pz = o.az + dz * t;
            const ex = pos.x - px, ez = pos.z - pz, d = Math.hypot(ex, ez), rr = o.r + radius;
            if (d >= rr) return;
            if (d < 1e-6) { nx = -dz; nz = dx; const l = Math.hypot(nx, nz); nx /= l; nz /= l; } else { nx = ex / d; nz = ez / d; }
            pen = rr - d;
          }
          pos.x += nx * pen; pos.z += nz * pen;
          moved = true;
          if (!hit) hit = { x: 0, z: 0, tag: o.tag };
          hit.x += nx; hit.z += nz;
      };
      for (let i = ax; i <= bx; i++) for (let j = az; j <= bz; j++) {
        const arr = this.grid.get(this.key(i, j));
        if (arr) for (const o of arr) test(o);
      }
      for (const o of this.dynamic) test(o);
      if (!moved) break;
    }
    if (hit) { const l = Math.hypot(hit.x, hit.z) || 1; hit.x /= l; hit.z /= l; }
    return hit;
  }

  // ---- walkable surfaces ----
  // box with height linear along local z: h0 at lz=-hd, h1 at lz=+hd
  addPlatform(cx, cz, hw, hd, a, h0, h1 = h0, surface = 'concrete', tag = null) {
    const p = { t: 0, x: cx, z: cz, hw, hd, c: Math.cos(a), sn: Math.sin(a), h0, h1, surface, tag };
    const R = Math.hypot(hw, hd);
    this.platforms.push(p);
    this._insert(this.pgrid, p, cx - R, cz - R, cx + R, cz + R);
    return p;
  }
  // ribbon along points [x, z, h] with half width
  addRibbon(pts, halfW, surface = 'asphalt', tag = null) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const p = { t: 1, ax: a[0], az: a[1], ah: a[2], bx: b[0], bz: b[1], bh: b[2], w: halfW, surface, tag };
      this.platforms.push(p);
      this._insert(this.pgrid, p, Math.min(a[0], b[0]) - halfW, Math.min(a[1], b[1]) - halfW, Math.max(a[0], b[0]) + halfW, Math.max(a[1], b[1]) + halfW);
    }
  }
  // highest platform surface under (x,z) that is not far above y (step up allowance). Returns null if none.
  platformAt(x, z, y, stepUp = 0.6, out = {}) {
    const arr = this.pgrid.get(this.key(Math.floor(x / this.cell), Math.floor(z / this.cell)));
    if (!arr) return null;
    let best = -1e9, surf = null;
    for (const p of arr) {
      let h;
      if (p.t === 0) {
        const dx = x - p.x, dz = z - p.z;
        const lx = dx * p.c - dz * p.sn, lz = dx * p.sn + dz * p.c;
        if (Math.abs(lx) > p.hw || Math.abs(lz) > p.hd) continue;
        h = p.h0 + (p.h1 - p.h0) * ((lz + p.hd) / (2 * p.hd));
      } else {
        const dx = p.bx - p.ax, dz = p.bz - p.az, L2 = dx * dx + dz * dz || 1e-9;
        let t = ((x - p.ax) * dx + (z - p.az) * dz) / L2;
        if (t < -0.01 || t > 1.01) continue;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const d = Math.hypot(x - p.ax - dx * t, z - p.az - dz * t);
        if (d > p.w) continue;
        h = p.ah + (p.bh - p.ah) * t;
      }
      if (h > y + stepUp) continue;
      if (h > best) { best = h; surf = p.surface; }
    }
    if (surf === null) return null;
    out.h = best; out.surface = surf;
    return out;
  }
}
