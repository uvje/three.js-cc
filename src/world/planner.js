import { Polyline, catmullRom, resample, smoothArray, inRect } from './geo.js';
import { WH, CELL, N, floorH, hillDist, baseHeight, G, SATOYAMA } from './terrain.js';
import { RNG, Simplex, smoothstep, lerp, clamp } from '../core/noise.js';

// Lays out the village: river, railway, roads, special areas, shops, house lots, rice-paddy grid and forest.

export const F = { ROAD: 1, BUF: 2, RIVER: 4, RAIL: 8, LOT: 16, SPECIAL: 32, FIELD: 64, NOTREE: 128 };
const BLOCK = F.ROAD | F.BUF | F.RIVER | F.RAIL | F.LOT | F.SPECIAL;

const RIVER_CTRL = [[-700, -470], [-560, -330], [-470, -250], [-420, -195], [-375, -120], [-338, -50], [-305, 15], [-262, 75], [-200, 120], [-120, 152], [-30, 175], [60, 186], [160, 195], [280, 210], [420, 236], [560, 265], [700, 300], [860, 340], [1000, 372]];
const RAIL_CTRL = [[-1000, -150], [-820, -178], [-640, -200], [-420, -208], [-200, -212], [0, -212], [200, -208], [420, -196], [640, -174], [820, -145], [1000, -108]];
const ROAD_DEFS = [
  { name: 'main', type: 'main', w: 7, ctrl: [[-1000, 40], [-820, 44], [-640, 38], [-480, 30], [-340, 22], [-200, 30], [-60, 40], [60, 46], [200, 60], [360, 80], [520, 92], [680, 84], [840, 70], [1000, 60]] },
  { name: 'north', type: 'local', w: 5, ctrl: [[-60, 40], [-62, -10], [-68, -80], [-72, -150], [-71, -195], [-69, -230], [-68, -262]] },
  { name: 'south', type: 'local', w: 5, ctrl: [[60, 46], [62, 100], [60, 150], [58, 190], [62, 230], [80, 268], [120, 292], [180, 310]] },
  { name: 'w1', type: 'local', w: 4, ctrl: [[-520, 33], [-528, -10], [-548, -55], [-590, -82], [-640, -90]] },
  { name: 'w2', type: 'local', w: 4, ctrl: [[-480, 30], [-478, 80], [-500, 128], [-555, 150], [-620, 148]] },
  { name: 'e1', type: 'local', w: 4.5, ctrl: [[330, 77], [348, 20], [378, -40], [420, -92], [480, -122], [560, -132], [640, -128]] },
  { name: 'rs1', type: 'local', w: 4, ctrl: [[-71, -196], [-115, -194], [-200, -192], [-300, -189], [-380, -184]] },
  { name: 'rs2', type: 'local', w: 4, ctrl: [[-70, -198], [40, -198], [150, -195], [260, -189]] },
  { name: 'sato', type: 'path', w: 2.6, ctrl: [[378, -40], [334, -58], [294, -78], [262, -97], [242, -106]] },
];
export const THETA = 0.045, CU = 34, CV = 24, IU0 = -26, IU1 = 26, IV0 = -13, IV1 = 15;

export class Planner {
  constructor(hm, seed = 77) {
    this.hm = hm;
    this.rng = new RNG(seed);
    this.noise = new Simplex(seed + 5);
    this.occ = new Uint8Array(N * N);
    this.ground = new Uint8Array(N * N);
    this.riverD = new Float32Array(N * N).fill(1e4);
    this.bestDn = new Float32Array(N * N).fill(1e4);
    this.roads = []; this.byName = {};
    this.bridges = [];
    this.lots = [];
    this.shops = [];
    this.cells = new Map();
    this.trees = [];
    this.areas = {};
    this.regions = [];
  }
  idx(x, z) { return Math.round((z + WH) / CELL) * N + Math.round((x + WH) / CELL); }
  occAt(x, z) { if (Math.abs(x) >= WH || Math.abs(z) >= WH) return 0; return this.occ[this.idx(x, z)]; }
  groundAt(x, z) { if (Math.abs(x) >= WH || Math.abs(z) >= WH) return 0; return this.ground[this.idx(x, z)]; }
  riverDist(x, z) { if (Math.abs(x) >= WH || Math.abs(z) >= WH) return 1e4; return this.riverD[this.idx(x, z)]; }
  mark(x0, z0, x1, z1, test, flags, gtype = -1) {
    this.hm.forBox(x0, z0, x1, z1, (i, x, z) => { if (test(x, z)) { this.occ[i] |= flags; if (gtype >= 0) this.ground[i] = gtype; } });
  }

  run(progress) {
    this.hm.generate();
    progress?.(0.12);
    this.buildRiver();
    this.buildRail();
    this.buildRoads();
    progress?.(0.2);
    this.buildSpecial();
    this.buildEmbankPath();
    this.buildShops();
    this.buildHamlets();
    progress?.(0.26);
    this.buildFarmland();
    this.buildFarmRoads();
    progress?.(0.32);
    this.buildTrees();
    this.buildRegions();
  }

  // ---------- river ----------
  buildRiver() {
    const poly = new Polyline(catmullRom(RIVER_CTRL, 3));
    const n = poly.pts.length;
    let bank = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const [x, z] = poly.pts[i];
      bank[i] = floorH(x, z) - 0.15 + Math.max(0, hillDist(x, z)) * 0.07;
    }
    for (let i = 1; i < n; i++) bank[i] = Math.min(bank[i], bank[i - 1]);
    bank = smoothArray(bank, 6, 2);
    for (let i = 1; i < n; i++) bank[i] = Math.min(bank[i], bank[i - 1]);
    const water = bank.map((b) => b - 2.1);
    this.river = { poly, bank, water, half: 6.5, bankW: 10 };
    const bestS = new Float32Array(N * N);
    const R = 40;
    for (let i = 0; i < n - 1; i++) {
      const a = poly.pts[i], b = poly.pts[i + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz;
      this.hm.forBox(Math.min(a[0], b[0]) - R, Math.min(a[1], b[1]) - R, Math.max(a[0], b[0]) + R, Math.max(a[1], b[1]) + R, (c, x, z) => {
        let t = ((x - a[0]) * dx + (z - a[1]) * dz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const d = Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
        if (d < this.riverD[c]) { this.riverD[c] = d; bestS[c] = poly.s[i] + (poly.s[i + 1] - poly.s[i]) * t; }
      });
    }
    const h = this.hm.h;
    for (let c = 0; c < N * N; c++) {
      const d = this.riverD[c];
      if (d > R) continue;
      const s = bestS[c];
      const bk = poly.sampleArray(bank, s), wl = bk - 2.1;
      let nh;
      if (d < 6.5) nh = wl - 1.1;
      else if (d < 10) nh = lerp(wl - 0.9, bk - 0.3, (d - 6.5) / 3.5);
      else nh = Math.min(h[c], bk + (d - 10) * 0.5);
      h[c] = d < 10 ? nh : Math.min(h[c], nh);
      if (d < 10.5) { this.occ[c] |= F.RIVER | F.NOTREE; this.ground[c] = d < 6.5 ? G.WATER : G.CONCRETE; }
    }
  }

  // ---------- railway ----------
  buildRail() {
    const poly = new Polyline(catmullRom(RAIL_CTRL, 2));
    const n = poly.pts.length;
    const base = new Float32Array(n), emb = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const [x, z] = poly.pts[i];
      base[i] = floorH(x, z);
      emb[i] = lerp(1.25, 0.35, smoothstep(-330, -250, x) * (1 - smoothstep(20, 100, x)));
    }
    const sb = smoothArray(base, 30, 3);
    const top = new Float32Array(n);
    const tunnel = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      top[i] = sb[i] + emb[i];
      const [x, z] = poly.pts[i];
      tunnel[i] = baseHeight(x, z) - top[i] > 9 ? 1 : 0;
    }
    // portals: first tunnel index going outward from the middle
    const mid = n >> 1;
    let west = 0, east = n - 1;
    for (let i = mid; i >= 0; i--) if (tunnel[i]) { west = i; break; }
    for (let i = mid; i < n; i++) if (tunnel[i]) { east = i; break; }
    for (let i = 0; i < n; i++) tunnel[i] = i <= west || i >= east ? 1 : 0;
    this.rail = { poly, top, tunnel, west, east };
    const h = this.hm.h;
    const bestD = new Float32Array(N * N).fill(1e4), bestT = new Float32Array(N * N);
    const R = 22;
    for (let i = west; i < east; i++) {
      const a = poly.pts[i], b = poly.pts[i + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz;
      this.hm.forBox(Math.min(a[0], b[0]) - R, Math.min(a[1], b[1]) - R, Math.max(a[0], b[0]) + R, Math.max(a[1], b[1]) + R, (c, x, z) => {
        let t = ((x - a[0]) * dx + (z - a[1]) * dz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const d = Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
        if (d < bestD[c]) { bestD[c] = d; bestT[c] = top[i] + (top[i + 1] - top[i]) * t; }
      });
    }
    for (let c = 0; c < N * N; c++) {
      const d = bestD[c];
      if (d > R || this.riverD[c] < 10.8) continue;
      const tp = bestT[c] - 0.45;
      let nh;
      if (d < 2.4) nh = tp;
      else if (h[c] < tp) nh = Math.max(h[c], tp - (d - 2.4) / 1.5);
      else nh = Math.min(h[c], tp + (d - 2.4) * 1.3);
      h[c] = nh;
      if (d < 3.6) { this.occ[c] |= F.RAIL | F.NOTREE; if (d < 2.6) this.ground[c] = G.BALLAST; }
      else if (d < 6) this.occ[c] |= F.BUF | F.NOTREE;
    }
  }

  // ---------- roads ----------
  addRoad(def, pts) {
    const poly = new Polyline(pts);
    const n = poly.pts.length;
    const raw = new Float32Array(n);
    for (let i = 0; i < n; i++) raw[i] = def.type === 'farm' ? this.hm.sample(poly.pts[i][0], poly.pts[i][1]) : baseHeight(poly.pts[i][0], poly.pts[i][1]);
    let prof = smoothArray(raw, def.type === 'farm' ? 2 : 8, def.type === 'farm' ? 1 : 3);
    const road = { ...def, poly, prof, bridges: [], crossing: null };
    // level crossings with the railway
    if (def.type !== 'farm') {
      const rp = this.rail.poly;
      for (let i = 0; i < n; i++) {
        const q = rp.nearest(poly.pts[i][0], poly.pts[i][1], 12);
        if (q && q.d < 6) {
          const rt = rp.sampleArray(this.rail.top, q.s) + 0.2;
          for (let k = -16; k <= 16; k++) {
            const j = i + k; if (j < 0 || j >= n) continue;
            const w = 1 - smoothstep(4, 16, Math.abs(k));
            prof[j] = lerp(prof[j], rt, w);
          }
          road.crossing = { i, x: q.x, z: q.z, tx: q.tx, tz: q.tz, h: rt };
          break;
        }
      }
    }
    // junction snapping to earlier roads
    for (const endI of [0, n - 1]) {
      const [x, z] = poly.pts[endI];
      for (const other of this.roads) {
        const q = other.poly.nearest(x, z, 10);
        if (!q || q.d > other.w / 2 + 2) continue;
        const oh = other.poly.sampleArray(other.prof, q.s);
        const span = 18;
        for (let k = 0; k <= span; k++) {
          const j = endI === 0 ? k : n - 1 - k;
          if (j < 0 || j >= n) continue;
          prof[j] = lerp(oh, prof[j], smoothstep(0, span, k));
        }
        break;
      }
    }
    // bridges over the river
    let inB = -1;
    for (let i = 0; i <= n; i++) {
      const over = i < n && this.riverDist(poly.pts[i][0], poly.pts[i][1]) < 11;
      if (over && inB < 0) inB = i;
      if (!over && inB >= 0) {
        const a = Math.max(0, inB - 3), b = Math.min(n - 1, i + 2);
        const ha = prof[a], hb = prof[b];
        const top = Math.max(ha, hb);
        for (let j = a; j <= b; j++) {
          const t = (j - a) / (b - a || 1);
          prof[j] = lerp(ha, hb, t) + Math.sin(t * Math.PI) * (0.35 + (top - Math.min(ha, hb)) * 0.1);
        }
        road.bridges.push({ a, b });
        this.bridges.push({ road, a, b });
        inB = -1;
      }
    }
    road.prof = prof;
    this.roads.push(road);
    this.byName[def.name] = road;
    return road;
  }
  stampRoad(road) {
    const h = this.hm.h;
    const F2 = road.type === 'farm' ? 1.8 : road.type === 'path' ? 2.5 : 5;
    const hw = road.w / 2;
    const R = hw + F2;
    const { poly, prof } = road;
    const tmpH = this._tmpH || (this._tmpH = new Float32Array(N * N));
    const seen = this._seen || (this._seen = new Int32Array(N * N));
    const pass = (this._pass = (this._pass || 0) + 1);
    const myId = this.roads.indexOf(road) + 1;
    const touched = [];
    for (let i = 0; i < poly.pts.length - 1; i++) {
      const a = poly.pts[i], b = poly.pts[i + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1e-9;
      this.hm.forBox(Math.min(a[0], b[0]) - R, Math.min(a[1], b[1]) - R, Math.max(a[0], b[0]) + R, Math.max(a[1], b[1]) + R, (c, x, z) => {
        let t = ((x - a[0]) * dx + (z - a[1]) * dz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const d = Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
        const dn = d - hw;
        if (dn < this.bestDn[c] && dn < F2) {
          if (seen[c] !== pass) { seen[c] = pass; touched.push(c); }
          this.bestDn[c] = dn;
          tmpH[c] = prof[i] + (prof[i + 1] - prof[i]) * t;
          this._owner[c] = myId;
        }
      });
    }
    const gt = road.type === 'farm' || road.gravel ? G.GRAVEL : road.type === 'path' ? G.DIRT : G.ASPHALT;
    for (const c of touched) {
      if (this._owner[c] !== myId) continue;
      if (this.riverD[c] < 10.8) continue;
      const dn = this.bestDn[c];
      const target = tmpH[c] - 0.04;
      if (dn <= 0.6) h[c] = target;
      else h[c] = lerp(target, h[c], smoothstep(0.6, F2, dn));
      if (dn < 0.4) { this.occ[c] |= F.ROAD | F.NOTREE; this.ground[c] = gt; }
      if (dn < (road.type === 'farm' ? 0.6 : 1.0)) this.occ[c] |= F.BUF | F.NOTREE;
    }
  }
  buildRoads() {
    this._owner = new Uint16Array(N * N);
    for (const def of ROAD_DEFS) {
      const r = this.addRoad(def, catmullRom(def.ctrl, 2));
      this.stampRoad(r);
    }
  }

  // ---------- special areas ----------
  flattenRect(cx, cz, hw, hd, a, H, Fo = 4, skipRoad = true) {
    const h = this.hm.h;
    const c = Math.cos(a), s = Math.sin(a);
    const R = Math.hypot(hw, hd) + Fo;
    this.hm.forBox(cx - R, cz - R, cx + R, cz + R, (i, x, z) => {
      if (skipRoad && (this.occ[i] & (F.ROAD | F.RIVER | F.RAIL))) return;
      const dx = x - cx, dz = z - cz;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      const ex = Math.max(Math.abs(lx) - hw, 0), ez = Math.max(Math.abs(lz) - hd, 0);
      const d = Math.hypot(ex, ez);
      if (d <= 0) h[i] = typeof H === 'function' ? H(lx, lz) : H;
      else if (d < Fo) h[i] = lerp(typeof H === 'function' ? H(clamp(lx, -hw, hw), clamp(lz, -hd, hd)) : H, h[i], smoothstep(0, Fo, d));
    });
  }
  markRect(cx, cz, hw, hd, a, flags, gtype = -1, margin = 0) {
    const R = Math.hypot(hw, hd) + margin + 2;
    this.mark(cx - R, cz - R, cx + R, cz + R, (x, z) => inRect(x, z, cx, cz, hw, hd, a, margin), flags, gtype);
  }
  rectFree(cx, cz, hw, hd, a, mask = BLOCK, step = 2) {
    const c = Math.cos(a), s = Math.sin(a);
    for (let lx = -hw; lx <= hw + 0.01; lx += step) for (let lz = -hd; lz <= hd + 0.01; lz += step) {
      const x = cx + lx * c + lz * s, z = cz - lx * s + lz * c;
      if (Math.abs(x) > 790 || Math.abs(z) > 900) return false;
      if (this.occAt(x, z) & mask) return false;
    }
    return true;
  }
  buildSpecial() {
    const A = this.areas;
    // Shrine at the end of the north road: torii, stone stairs, terrace on the hillside
    const nr = this.byName.north;
    const e = nr.poly.pts[nr.poly.pts.length - 1], e2 = nr.poly.pts[nr.poly.pts.length - 6];
    let tx = e[0] - e2[0], tz = e[1] - e2[1]; const tl = Math.hypot(tx, tz); tx /= tl; tz /= tl;
    const bottomH = nr.prof[nr.prof.length - 1];
    const bx = e[0] + tx * 5, bz = e[1] + tz * 5;
    const rise = clamp(baseHeight(bx + tx * 34, bz + tz * 34) - bottomH, 8, 15);
    const run = rise * 1.6, topH = bottomH + rise;
    const ang = Math.atan2(tx, tz);
    const tcx = bx + tx * (run + 17), tcz = bz + tz * (run + 17);
    A.shrine = { torii: [e[0] + tx * 2.5, e[1] + tz * 2.5], bottom: [bx, bz], top: [bx + tx * run, bz + tz * run], tx, tz, ang, bottomH, topH, run, center: [tcx, tcz], hw: 16, hd: 17 };
    // approach area at the bottom
    this.flattenRect(bx - tx * 2, bz - tz * 2, 4, 4, ang, bottomH, 3, false);
    this.flattenRect(bx + tx * run / 2, bz + tz * run / 2, 3.4, run / 2, ang, (lx, lz) => lerp(bottomH, topH, (lz + run / 2) / run) - 0.25, 3, false);
    this.flattenRect(tcx, tcz, 16, 17, ang, topH, 7, false);
    this.markRect(bx + tx * run / 2, bz + tz * run / 2, 3.6, run / 2 + 4, ang, F.SPECIAL | F.NOTREE, G.STONE);
    this.markRect(tcx, tcz, 16, 17, ang, F.SPECIAL | F.NOTREE, G.YARD);
    this.markRect(tcx, tcz, 2.2, 15, ang, 0, G.STONE);

    // Station: platform south of the track around x=-130
    const rp = this.rail.poly;
    const q = rp.nearest(-130, -205, 30);
    const rtop = rp.sampleArray(this.rail.top, q.s);
    let nx = -q.tz, nzz = q.tx; if (nzz < 0) { nx = -nx; nzz = -nzz; }
    const pang = Math.atan2(nx, nzz); // local +z points away from the track (south)
    A.station = { x: q.x, z: q.z, tx: q.tx, tz: q.tz, nx, nz: nzz, ang: pang, railTop: rtop, platH: rtop + 0.2 + 0.85, len: 64 };
    const pc = [q.x + nx * 3.8, q.z + nzz * 3.8];
    A.station.plat = pc;
    this.markRect(pc[0], pc[1], 2.25, 32, pang + Math.PI / 2, F.SPECIAL | F.NOTREE, G.CONCRETE);
    const hc = [q.x + nx * 9.6, q.z + nzz * 9.6];
    A.station.house = hc;
    this.flattenRect(hc[0], hc[1], 7, 3.2, pang, rtop - 0.4, 3);
    this.markRect(hc[0], hc[1], 7, 3.4, pang, F.SPECIAL | F.NOTREE, G.CONCRETE);
    // station plaza by the north road
    A.plaza = [-86, -190];
    this.flattenRect(-86, -190, 9, 6, 0, this.hm.sample(-75, -190), 3);
    this.markRect(-86, -190, 9, 6, 0, F.SPECIAL | F.NOTREE, G.CONCRETE);

    // School west of the south road
    const sh = baseHeight(0, 262);
    A.school = { x: 2, z: 262, hw: 44, hd: 34, h: sh };
    this.flattenRect(2, 262, 44, 34, 0, sh, 6);
    this.markRect(2, 262, 44, 34, 0, F.SPECIAL | F.NOTREE, G.SAND);
    // Community hall with the village loudspeaker
    const hh = baseHeight(-152, 68);
    A.hall = { x: -152, z: 68, h: hh };
    this.flattenRect(-152, 68, 12, 9, 0, hh, 4);
    this.markRect(-152, 68, 12, 9, 0, F.SPECIAL | F.NOTREE, G.YARD);
    // Satoyama lookout clearing
    const sx = SATOYAMA.x + 4, sz = SATOYAMA.z + 2;
    const sth = baseHeight(sx, sz);
    A.lookout = { x: sx, z: sz, h: sth };
    this.flattenRect(sx, sz, 9, 9, 0.3, sth, 5);
    this.markRect(sx, sz, 9, 9, 0.3, F.SPECIAL | F.NOTREE, G.DIRT);
    // Great camphor tree with a small shrine
    A.camphor = { x: -88, z: 4, h: baseHeight(-88, 4) };
    this.flattenRect(-88, 4, 7, 7, 0, A.camphor.h, 3);
    this.markRect(-88, 4, 7, 7, 0, F.SPECIAL | F.NOTREE, G.YARD);
  }

  // ---------- shops along the main road ----------
  buildShops() {
    const SHOPS = [
      { type: 'store', x: -26, side: -1, w: 11, d: 10 },
      { type: 'liquor', x: -128, side: -1, w: 11, d: 10 },
      { type: 'post', x: 96, side: -1, w: 12, d: 10 },
      { type: 'barber', x: 14, side: 1, w: 8, d: 9 },
      { type: 'diner', x: -92, side: 1, w: 10, d: 10 },
      { type: 'hardware', x: 142, side: 1, w: 11, d: 10 },
    ];
    const road = this.byName.main;
    for (const sp of SHOPS) {
      // find arc length at given x
      let best = 0, bd = 1e9;
      for (let i = 0; i < road.poly.pts.length; i++) { const d = Math.abs(road.poly.pts[i][0] - sp.x); if (d < bd) { bd = d; best = i; } }
      const s = road.poly.s[best];
      const lot = this.lotAt(road, s, sp.side, sp.w, sp.d, 1.5);
      if (!lot) { console.warn('shop blocked', sp.type); continue; }
      lot.shop = sp.type;
      lot.style = 'shop';
      this.commitLot(lot);
      this.shops.push(lot);
    }
  }
  lotAt(road, s, side, w, d, setback = 1.6) {
    const p = road.poly.at(s);
    const nx = -p.tz * side, nz = p.tx * side;
    const off = road.w / 2 + setback + d / 2;
    const cx = p.x + nx * off, cz = p.z + nz * off;
    const ang = Math.atan2(-nx, -nz); // local +z faces the road
    // test rect: exact front edge, 0.6 m margin on the sides and back
    if (!this.rectFree(cx + nx * 0.3, cz + nz * 0.3, w / 2 + 0.6, d / 2 + 0.3, ang)) return null;
    if (hillDist(cx, cz) > 22) return null;
    let mn = 1e9, mx = -1e9;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const c = Math.cos(ang), sn = Math.sin(ang);
      const lx = i * w / 2, lz = j * d / 2;
      const hh = this.hm.sample(cx + lx * c + lz * sn, cz - lx * sn + lz * c);
      mn = Math.min(mn, hh); mx = Math.max(mx, hh);
    }
    if (mx - mn > 3.5) return null;
    const roadH = road.poly.sampleArray(road.prof, s);
    return { x: cx, z: cz, w, d, ang, h: roadH + 0.12, road: road.name, s, side };
  }
  commitLot(lot) {
    this.flattenRect(lot.x, lot.z, lot.w / 2, lot.d / 2, lot.ang, lot.h, 4);
    this.markRect(lot.x, lot.z, lot.w / 2, lot.d / 2, lot.ang, F.LOT | F.NOTREE, G.YARD, 1.0);
    this.lots.push(lot);
  }

  // ---------- hamlets ----------
  buildHamlets() {
    const H = [
      { name: 'center', x: -40, z: 40, r: 190, count: 34, roads: ['main', 'north', 'south'], style: 'town' },
      { name: 'west', x: -545, z: 30, r: 165, count: 22, roads: ['main', 'w1', 'w2'], style: 'farm' },
      { name: 'east', x: 430, z: -50, r: 150, count: 18, roads: ['e1', 'main'], style: 'farm' },
      { name: 'south', x: 110, z: 280, r: 120, count: 11, roads: ['south'], style: 'mixed' },
      { name: 'station', x: -140, z: -185, r: 130, count: 12, roads: ['rs1', 'rs2', 'north'], style: 'mixed' },
    ];
    const rng = this.rng;
    for (const hm of H) {
      const cand = [];
      for (const rn of hm.roads) {
        const road = this.byName[rn];
        for (let s = 4; s < road.poly.length - 4; s += 5) {
          const p = road.poly.at(s);
          const dd = Math.hypot(p.x - hm.x, p.z - hm.z);
          if (dd > hm.r) continue;
          cand.push({ road, s, side: 1, w8: dd }, { road, s, side: -1, w8: dd });
        }
      }
      // shuffle, slightly favoring the hamlet core
      for (const c of cand) c.k = rng.next() + c.w8 / hm.r * 0.6;
      cand.sort((a, b) => a.k - b.k);
      let placed = 0;
      for (const c of cand) {
        if (placed >= hm.count) break;
        let w, d;
        if (hm.style === 'farm') { w = rng.float(19, 27); d = rng.float(19, 26); }
        else if (hm.style === 'town') { w = rng.float(12, 16); d = rng.float(13, 18); }
        else { w = rng.float(14, 20); d = rng.float(15, 21); }
        const lot = this.lotAt(c.road, c.s, c.side, w, d, rng.float(1.4, 2.4));
        if (!lot) continue;
        lot.style = hm.style === 'mixed' ? (rng.chance(0.5) ? 'farm' : 'town') : hm.style;
        lot.hamlet = hm.name;
        this.commitLot(lot);
        placed++;
      }
    }
  }

  // ---------- rice paddy grid ----------
  g2w(gu, gv) { const c = Math.cos(THETA), s = Math.sin(THETA); return [gu * c - gv * s, gu * s + gv * c]; }
  w2g(x, z) { const c = Math.cos(THETA), s = Math.sin(THETA); return [x * c + z * s, -x * s + z * c]; }
  buildFarmland() {
    const rng = this.rng;
    const lotsNear = (x, z, r) => this.lots.some((l) => Math.hypot(l.x - x, l.z - z) < r);
    const valid = [];
    for (let iu = IU0; iu < IU1; iu++) for (let iv = IV0; iv < IV1; iv++) {
      let ok = true, mn = 1e9, mx = -1e9, sum = 0, cnt = 0;
      for (let a = 0; a <= 5 && ok; a++) for (let b = 0; b <= 4 && ok; b++) {
        const gu = iu * CU + 1.4 + (a / 5) * (CU - 2.8), gv = iv * CV + 1.4 + (b / 4) * (CV - 2.8);
        const [x, z] = this.g2w(gu, gv);
        if (Math.abs(x) > 790 || this.occAt(x, z) & BLOCK) { ok = false; break; }
        if (hillDist(x, z) > 2) { ok = false; break; }
        const bh = baseHeight(x, z);
        if (bh - floorH(x, z) > 0.8) { ok = false; break; }
        mn = Math.min(mn, bh); mx = Math.max(mx, bh); sum += bh; cnt++;
      }
      if (!ok || mx - mn > 1.6) continue;
      const [cx, cz] = this.g2w((iu + 0.5) * CU, (iv + 0.5) * CV);
      valid.push({ iu, iv, h: Math.round((sum / cnt) * 20) / 20, x: cx, z: cz });
    }
    // special picks: sunflower fields near the south road and the satoyama hill
    const pickNear = (x, z) => { let b = null, bd = 1e9; for (const c of valid) { const d = Math.hypot(c.x - x, c.z - z); if (d < bd && !c.type) { bd = d; b = c; } } return b; };
    for (const [x, z] of [[100, 130], [300, -20]]) { const c = pickNear(x, z); if (c) c.type = 'sunflower'; }
    for (const c of valid) {
      if (!c.type) {
        const near = lotsNear(c.x, c.z, 75);
        const r = rng.next();
        if (near && r < 0.3) c.type = 'veg';
        else if (r < 0.04) c.type = 'greenhouse';
        else if (r < 0.09) c.type = 'fallow';
        else if (!near && r < 0.12) c.type = 'veg';
        else c.type = 'rice';
      }
      this.cells.set(c.iu * 1000 + c.iv, c);
    }
    // flatten & mark
    const gt = { rice: G.PADDY, veg: G.FIELD, greenhouse: G.DIRT, fallow: G.TALL, sunflower: G.FIELD };
    const c0 = Math.cos(THETA), s0 = Math.sin(THETA);
    const ang = -THETA; // local x along u
    for (const c of this.cells.values()) {
      // rotation such that local x = grid u: inRect uses local +z = (sin a, cos a); with a=-THETA local x -> (cos, sin)
      this.flattenRect(c.x, c.z, CU / 2, CV / 2, ang, c.h, 1.5);
      this.markRect(c.x, c.z, CU / 2 - 0.3, CV / 2 - 0.3, ang, F.FIELD | F.NOTREE, gt[c.type]);
    }
    void c0; void s0;
  }
  cell(iu, iv) { return this.cells.get(iu * 1000 + iv); }
  buildFarmRoads() {
    const segsU = new Map(), segsV = new Map(); // key line -> set of indices
    for (const c of this.cells.values()) {
      const { iu, iv } = c;
      // u-lines (constant u) at iu and iu+1 when divisible by 4
      for (const lu of [iu, iu + 1]) if (((lu % 4) + 4) % 4 === 0) { if (!segsU.has(lu)) segsU.set(lu, new Set()); segsU.get(lu).add(iv); }
      for (const lv of [iv, iv + 1]) if (((lv % 2) + 2) % 2 === 0) { if (!segsV.has(lv)) segsV.set(lv, new Set()); segsV.get(lv).add(iu); }
    }
    const lines = [];
    const collect = (map, isU) => {
      for (const [line, set] of map) {
        const arr = [...set].sort((a, b) => a - b);
        let start = arr[0], prev = arr[0];
        for (let k = 1; k <= arr.length; k++) {
          const v = arr[k];
          if (v !== prev + 1) {
            if (isU) lines.push([[line * CU, start * CV], [line * CU, (prev + 1) * CV]]);
            else lines.push([[start * CU, line * CV], [(prev + 1) * CU, line * CV]]);
            start = v;
          }
          prev = v;
        }
      }
    };
    collect(segsU, true); collect(segsV, false);
    this.farmLines = [];
    for (const [ga, gb] of lines) {
      let a = this.g2w(ga[0], ga[1]), b = this.g2w(gb[0], gb[1]);
      // extend ends toward nearby real roads
      const ext = (p, q) => {
        const dx = p[0] - q[0], dz = p[1] - q[1], L = Math.hypot(dx, dz);
        const ux = dx / L, uz = dz / L;
        for (let t = 2; t <= 34; t += 2) {
          const x = p[0] + ux * t, z = p[1] + uz * t;
          const o = this.occAt(x, z);
          if (o & F.ROAD) return [x + ux * 1.5, z + uz * 1.5];
          if (o & (F.RIVER | F.RAIL | F.LOT | F.SPECIAL)) return p;
          if (hillDist(x, z) > 4) return p;
        }
        return p;
      };
      a = ext(a, b); b = ext(b, a);
      const pts = resample([a, b], 2);
      if (pts.length < 3) continue;
      const r = this.addRoad({ name: 'farm' + this.farmLines.length, type: 'farm', w: 3.2 }, pts);
      this.stampRoad(r);
      this.farmLines.push(r);
    }
  }
  buildEmbankPath() {
    const rv = this.river.poly;
    const pts = [];
    for (let i = 0; i < rv.pts.length; i++) {
      const [x, z] = rv.pts[i];
      if (x < -240 || x > 430) continue;
      const a = rv.pts[Math.max(0, i - 1)], b = rv.pts[Math.min(rv.pts.length - 1, i + 1)];
      let nx = -(b[1] - a[1]), nzz = b[0] - a[0]; const l = Math.hypot(nx, nzz); nx /= l; nzz /= l;
      if (nzz > 0) { nx = -nx; nzz = -nzz; }
      pts.push([x + nx * 13.5, z + nzz * 13.5]);
    }
    const sm = catmullRom(resample(pts, 12), 2);
    // split where the path would run through special areas
    let run = [], k = 0;
    const flush = () => {
      if (run.length >= 8) { const r = this.addRoad({ name: k ? 'embank' + k : 'embank', type: 'path', w: 2.6, gravel: true }, run); this.stampRoad(r); k++; }
      run = [];
    };
    for (const p of sm) { if (this.occAt(p[0], p[1]) & (F.LOT | F.SPECIAL | F.RAIL)) flush(); else run.push(p); }
    flush();
  }

  // ---------- trees ----------
  buildTrees() {
    const rng = new RNG(901), nz = this.noise;
    const S = 8.5;
    for (let gx = -WH + 4; gx < WH - 4; gx += S) for (let gz = -WH + 4; gz < WH - 4; gz += S) {
      const x = gx + rng.float(-3.6, 3.6), z = gz + rng.float(-3.6, 3.6);
      const o = this.occAt(x, z);
      if (o & (BLOCK | F.FIELD | F.NOTREE)) continue;
      const hd = hillDist(x, z);
      const y = this.hm.sample(x, z);
      const elev = y - floorH(x, z);
      const inHill = hd > 4 || elev > 2.2;
      const patch = nz.noise(x * 0.004, z * 0.004);
      if (inHill) {
        if (rng.next() > 0.93) continue;
        const bamboo = hd < 70 && nz.noise(x * 0.012 + 50, z * 0.012) > 0.42;
        if (bamboo) {
          for (let k = 0; k < 6; k++) this.trees.push({ type: 'bamboo', x: x + rng.float(-4, 4), z: z + rng.float(-4, 4), s: rng.float(0.8, 1.15), r: rng.float(0, 6.28) });
          continue;
        }
        const t = patch > -0.15 && hd > 18 ? 'sugi' : 'broad';
        this.trees.push({ type: t, x, z, s: rng.float(0.8, 1.25) * (t === 'sugi' ? 1 : 0.95), r: rng.float(0, 6.28) });
      } else {
        // valley: scattered trees, small groves near the river and between hamlets
        const grove = nz.noise(x * 0.01 + 20, z * 0.01 - 7);
        const nearRiver = this.riverDist(x, z) < 22;
        const p = grove > 0.55 ? 0.55 : nearRiver ? 0.25 : 0.025;
        if (rng.next() < p) {
          const t = grove > 0.7 && rng.chance(0.5) ? 'bamboo' : rng.chance(0.12) ? 'kaki' : 'broad';
          if (t === 'bamboo') { for (let k = 0; k < 5; k++) this.trees.push({ type: 'bamboo', x: x + rng.float(-3, 3), z: z + rng.float(-3, 3), s: rng.float(0.8, 1.1), r: rng.float(0, 6.28) }); }
          else this.trees.push({ type: t, x, z, s: rng.float(0.7, 1.1), r: rng.float(0, 6.28) });
        }
      }
    }
    // sakura row along the embankment path
    const em = this.byName.embank;
    if (em) for (let s = 6; s < em.poly.length; s += 11) {
      const p = em.poly.at(s);
      const side = -1;
      const x = p.x + -p.tz * side * 3.2, z = p.z + p.tx * side * 3.2;
      if (this.occAt(x, z) & (F.ROAD | F.LOT | F.RIVER | F.SPECIAL)) continue;
      this.trees.push({ type: 'sakura', x, z, s: rng.float(0.85, 1.05), r: rng.float(0, 6.28) });
    }
    // shrine forest (chinju no mori) — cedars around the terrace
    const sa = this.areas.shrine;
    for (let k = 0; k < 140; k++) {
      const a = rng.float(0, Math.PI * 2), rr = rng.float(19, 42);
      const x = sa.center[0] + Math.cos(a) * rr, z = sa.center[1] + Math.sin(a) * rr;
      if (this.occAt(x, z) & (F.SPECIAL | F.ROAD | F.RAIL)) continue;
      this.trees.push({ type: rng.chance(0.75) ? 'sugi' : 'broad', x, z, s: rng.float(1.1, 1.45), r: rng.float(0, 6.28) });
    }
    for (const t of this.trees) t.y = this.hm.sample(t.x, t.z);
  }

  // named regions for the HUD place titles
  buildRegions() {
    const A = this.areas;
    this.regions = [
      { jp: 'なつめ神社', ru: 'Святилище Нацумэ', x: A.shrine.center[0], z: A.shrine.center[1], r: 30, seal: '神' },
      { jp: 'なつめ駅', ru: 'Станция Нацумэ', x: A.station.house[0], z: A.station.house[1], r: 45, seal: '駅' },
      { jp: '商店街', ru: 'Торговая улица', x: -40, z: 40, r: 75, seal: '店' },
      { jp: '大楠', ru: 'Великое камфорное дерево', x: A.camphor.x, z: A.camphor.z, r: 18, seal: '木' },
      { jp: 'なつめ小学校', ru: 'Деревенская школа', x: A.school.x, z: A.school.z, r: 50, seal: '学' },
      { jp: '里山の見晴らし台', ru: 'Смотровая на холме', x: A.lookout.x, z: A.lookout.z, r: 22, seal: '見' },
      { jp: '西の集落', ru: 'Западный хутор', x: -545, z: 30, r: 120, seal: '西' },
      { jp: '東の集落', ru: 'Восточный хутор', x: 430, z: -50, r: 110, seal: '東' },
      { jp: '南の集落', ru: 'Южный хутор', x: 120, z: 285, r: 80, seal: '南' },
      { jp: '夏目川', ru: 'Река Нацумэ', river: true, r: 26, seal: '川' },
      { jp: '田んぼ道', ru: 'Дорога через рисовые поля', fields: true, seal: '田' },
    ];
  }
}
