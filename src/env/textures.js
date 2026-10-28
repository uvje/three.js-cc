import * as THREE from 'three';
import { mulberry32 } from '../core/noise.js';

// All textures are painted procedurally on canvases — the project ships no image assets.

export const JP_SERIF = '"Zen Old Mincho", "Hiragino Mincho ProN", "Yu Mincho", "IPAMincho", "IPAexMincho", "Noto Serif JP", serif';
export const JP_SANS = '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Yu Gothic", "IPAGothic", "Noto Sans JP", sans-serif';

let maxAniso = 4;
export function setMaxAnisotropy(a) { maxAniso = a; }

export function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: true })];
}
export function tex(c, o = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = o.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.anisotropy = o.aniso ?? maxAniso;
  if (o.repeat) t.repeat.set(o.repeat[0], o.repeat[1]);
  if (o.nearest) { t.magFilter = THREE.NearestFilter; }
  t.needsUpdate = true;
  return t;
}

// periodic value noise in [0,1], size x size, `cells` lattice cells per side
export function periodicNoise(size, cells, seed = 1, octaves = 4) {
  const out = new Float32Array(size * size);
  const rnd = mulberry32(seed);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const n = cells << o;
    const lat = new Float32Array(n * n);
    for (let i = 0; i < lat.length; i++) lat[i] = rnd();
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * n, iy = Math.floor(fy), ty = fy - iy, sy = ty * ty * (3 - 2 * ty);
      const y0 = iy % n, y1 = (iy + 1) % n;
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * n, ix = Math.floor(fx), tx = fx - ix, sx = tx * tx * (3 - 2 * tx);
        const x0 = ix % n, x1 = (ix + 1) % n;
        const a = lat[y0 * n + x0], b = lat[y0 * n + x1], c = lat[y1 * n + x0], d = lat[y1 * n + x1];
        out[y * size + x] += amp * ((a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy);
      }
    }
    total += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function noiseFill(ctx, size, base, amount, seed, cells = 8, oct = 4) {
  const n = periodicNoise(size, cells, seed, oct);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < n.length; i++) {
    const k = (n[i] - 0.5) * amount;
    d[i * 4] = Math.max(0, Math.min(255, (base ? base[0] : d[i * 4]) + k));
    d[i * 4 + 1] = Math.max(0, Math.min(255, (base ? base[1] : d[i * 4 + 1]) + k));
    d[i * 4 + 2] = Math.max(0, Math.min(255, (base ? base[2] : d[i * 4 + 2]) + k));
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
function speckle(ctx, w, h, count, colors, rnd, rmin = 0.5, rmax = 1.6) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
    const r = rmin + rnd() * (rmax - rmin);
    ctx.beginPath(); ctx.arc(rnd() * w, rnd() * h, r, 0, Math.PI * 2); ctx.fill();
  }
}

export function makeTextures() {
  const T = {};
  const R = mulberry32(99);

  { // kawara: S-tile columns running down the slope (texture = 2.4m x 2.4m)
    const [c, x] = canvas(256);
    x.fillStyle = '#c8c8c8'; x.fillRect(0, 0, 256, 256);
    const cols = 8, colW = 256 / cols;
    for (let i = 0; i < cols; i++) {
      const g = x.createLinearGradient(i * colW, 0, (i + 1) * colW, 0);
      g.addColorStop(0, '#8a8a8a'); g.addColorStop(0.25, '#e6e6e6'); g.addColorStop(0.55, '#d4d4d4'); g.addColorStop(0.85, '#9a9a9a'); g.addColorStop(1, '#6e6e6e');
      x.fillStyle = g; x.fillRect(i * colW, 0, colW, 256);
    }
    for (let r = 0; r < 8; r++) {
      const y = r * 32;
      x.fillStyle = 'rgba(40,40,40,0.55)'; x.fillRect(0, y, 256, 3);
      x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(0, y + 3, 256, 2);
    }
    const img = x.getImageData(0, 0, 256, 256); const n = periodicNoise(256, 16, 3, 3);
    for (let i = 0; i < n.length; i++) { const k = (n[i] - 0.5) * 34; for (let j = 0; j < 3; j++) img.data[i * 4 + j] = Math.max(0, Math.min(255, img.data[i * 4 + j] + k)); }
    x.putImageData(img, 0, 0);
    T.kawara = tex(c, { repeat: [1 / 2.4, 1 / 2.4] });
  }
  { // corrugated tin (1m)
    const [c, x] = canvas(128);
    for (let i = 0; i < 128; i++) { const v = 170 + 60 * Math.sin((i / 128) * Math.PI * 2 * 13); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(i, 0, 1, 128); }
    const img = x.getImageData(0, 0, 128, 128); const n = periodicNoise(128, 6, 5, 4);
    for (let i = 0; i < n.length; i++) { const k = (n[i] - 0.5) * 70; img.data[i * 4] += k; img.data[i * 4 + 1] += k * 0.8; img.data[i * 4 + 2] += k * 0.6; }
    x.putImageData(img, 0, 0);
    T.tin = tex(c, { repeat: [1, 1] });
  }
  { // vertical wood boards (1.6m)
    const [c, x] = canvas(256);
    noiseFill(x, 256, [196, 196, 196], 40, 11, 4, 3);
    for (let i = 0; i < 8; i++) {
      const px = i * 32;
      x.fillStyle = `rgba(0,0,0,${0.05 + R() * 0.12})`; x.fillRect(px, 0, 32, 256);
      for (let g = 0; g < 7; g++) { x.strokeStyle = `rgba(60,40,30,${0.15 + R() * 0.2})`; x.lineWidth = 1; x.beginPath(); const gx = px + 3 + R() * 26; x.moveTo(gx, 0); x.bezierCurveTo(gx + R() * 6 - 3, 80, gx + R() * 6 - 3, 170, gx, 256); x.stroke(); }
      x.fillStyle = 'rgba(20,12,8,0.7)'; x.fillRect(px, 0, 2, 256);
    }
    T.wood = tex(c, { repeat: [1 / 1.6, 1 / 1.6] });
  }
  { // plaster (2m)
    const [c, x] = canvas(256);
    noiseFill(x, 256, [236, 236, 236], 22, 21, 6, 5);
    const img = x.getImageData(0, 0, 256, 256); const n = periodicNoise(256, 3, 23, 2);
    for (let i = 0; i < n.length; i++) { const k = Math.max(0, n[i] - 0.62) * 60; for (let j = 0; j < 3; j++) img.data[i * 4 + j] -= k; }
    x.putImageData(img, 0, 0);
    T.plaster = tex(c, { repeat: [0.5, 0.5] });
  }
  { // lap siding (2m)
    const [c, x] = canvas(256);
    noiseFill(x, 256, [226, 226, 226], 14, 31, 8, 3);
    for (let i = 0; i < 11; i++) {
      const y = Math.round(i * (256 / 11));
      const g = x.createLinearGradient(0, y, 0, y + 23);
      g.addColorStop(0, 'rgba(0,0,0,0.28)'); g.addColorStop(0.15, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0.05)');
      x.fillStyle = g; x.fillRect(0, y, 256, 24);
    }
    T.siding = tex(c, { repeat: [0.5, 0.5] });
  }
  { // concrete block wall (1.6m): 40x20cm blocks
    const [c, x] = canvas(256);
    noiseFill(x, 256, [200, 200, 196], 34, 41, 16, 4);
    x.fillStyle = 'rgba(70,70,70,0.55)';
    for (let r = 0; r < 8; r++) {
      x.fillRect(0, r * 32, 256, 3);
      const off = (r % 2) * 32;
      for (let k = 0; k < 5; k++) x.fillRect((off + k * 64) % 256, r * 32, 3, 32);
    }
    const img = x.getImageData(0, 0, 256, 256); const n = periodicNoise(256, 2, 43, 3);
    for (let i = 0; i < n.length; i++) { const yy = Math.floor(i / 256); const k = Math.max(0, n[i] - 0.5) * 50 * (yy / 256); for (let j = 0; j < 3; j++) img.data[i * 4 + j] -= k; }
    x.putImageData(img, 0, 0);
    T.block = tex(c, { repeat: [1 / 1.6, 1 / 1.6] });
  }
  { // concrete (4m)
    const [c, x] = canvas(256);
    noiseFill(x, 256, [190, 190, 186], 40, 51, 8, 5);
    x.fillStyle = 'rgba(60,60,60,0.35)';
    x.fillRect(0, 0, 256, 2); x.fillRect(0, 0, 2, 256);
    T.concrete = tex(c, { repeat: [0.25, 0.25] });
  }
  { // namako wall (kura base) 1.2m: diagonal white grid on slate
    const [c, x] = canvas(128);
    x.fillStyle = '#3a3e44'; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = '#e8e6df'; x.lineWidth = 7;
    for (let k = -128; k <= 256; k += 64) {
      x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 128, 128); x.stroke();
      x.beginPath(); x.moveTo(k, 128); x.lineTo(k + 128, 0); x.stroke();
    }
    T.namako = tex(c, { repeat: [1 / 1.2, 1 / 1.2] });
  }
  { // asphalt base noise for roads: u across [0,1] (road width), v along (repeat 12m)
    const mk = (lines) => {
      const [c, x] = canvas(256, 512);
      const img = x.createImageData(256, 512);
      const n = periodicNoise(256, 32, 61, 3), n2 = periodicNoise(256, 4, 63, 3);
      for (let y = 0; y < 512; y++) for (let xx = 0; xx < 256; xx++) {
        const i = (y * 256 + xx) * 4, k = n[(y % 256) * 256 + xx], k2 = n2[(y % 256) * 256 + xx];
        const v = 92 + (k - 0.5) * 40 + (k2 - 0.5) * 26 + (R() - 0.5) * 18;
        img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v + 3; img.data[i + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      // wheel tracks darker
      x.fillStyle = 'rgba(0,0,0,0.08)'; x.fillRect(46, 0, 30, 512); x.fillRect(180, 0, 30, 512);
      if (lines.edge) { x.fillStyle = 'rgba(238,238,230,0.92)'; x.fillRect(lines.edge, 0, lines.edgeW, 512); x.fillRect(256 - lines.edge - lines.edgeW, 0, lines.edgeW, 512); }
      if (lines.center) { x.fillStyle = 'rgba(238,238,230,0.9)'; x.fillRect(126, 0, 5, 256); }
      // cracks / patches
      for (let i = 0; i < 6; i++) { x.fillStyle = `rgba(30,30,30,${0.08 + R() * 0.1})`; x.fillRect(R() * 220, R() * 480, 10 + R() * 40, 8 + R() * 60); }
      x.strokeStyle = 'rgba(20,20,20,0.25)'; x.lineWidth = 1;
      for (let i = 0; i < 5; i++) { x.beginPath(); let px = R() * 256, py = R() * 512; x.moveTo(px, py); for (let s = 0; s < 6; s++) { px += R() * 20 - 10; py += R() * 20 - 4; x.lineTo(px, py); } x.stroke(); }
      return c;
    };
    T.roadMain = tex(mk({ edge: 10, edgeW: 5, center: true }), { repeat: [1, 1 / 12] });
    T.roadLocal = tex(mk({ edge: 8, edgeW: 5 }), { repeat: [1, 1 / 12] });
  }
  { // gravel farm road (u: width, v: 4m)
    const [c, x] = canvas(256);
    noiseFill(x, 256, [166, 156, 138], 50, 71, 16, 3);
    speckle(x, 256, 256, 2600, ['#7d7466', '#d8d0c0', '#9a8f7c', '#605848', '#b8ae9c'], R, 0.6, 1.8);
    // two wheel ruts with sparse grass in the middle
    x.fillStyle = 'rgba(80,110,50,0.35)'; x.fillRect(110, 0, 36, 256);
    speckle(x, 256, 256, 260, ['rgba(70,110,40,0.7)', 'rgba(110,140,60,0.6)'], R, 1, 2.5);
    x.fillStyle = 'rgba(90,110,50,0.5)'; x.fillRect(0, 0, 14, 256); x.fillRect(242, 0, 14, 256);
    T.gravel = tex(c, { repeat: [1, 1 / 4] });
  }
  { // dirt path
    const [c, x] = canvas(256);
    noiseFill(x, 256, [150, 128, 98], 46, 73, 8, 4);
    speckle(x, 256, 256, 900, ['#7a6248', '#b49a78', '#5e4c3a'], R, 0.6, 1.6);
    x.fillStyle = 'rgba(80,110,50,0.45)'; x.fillRect(0, 0, 20, 256); x.fillRect(236, 0, 20, 256);
    T.dirt = tex(c, { repeat: [1, 1 / 4] });
  }
  { // ballast (u across 3m, v 3m)
    const [c, x] = canvas(256);
    noiseFill(x, 256, [128, 124, 120], 40, 81, 32, 2);
    speckle(x, 256, 256, 3000, ['#5c5854', '#9c9690', '#7e7872', '#b4aea6', '#6a5a50'], R, 1, 2.6);
    T.ballast = tex(c, { repeat: [1, 1 / 3] });
  }
  { // terrain detail: R fine grain, G coarse blotches, B grass streaks (linear data)
    const [c, x] = canvas(256);
    const img = x.createImageData(256, 256);
    const a = periodicNoise(256, 32, 91, 3), b = periodicNoise(256, 4, 93, 4), s = periodicNoise(256, 64, 95, 2);
    for (let i = 0; i < a.length; i++) { img.data[i * 4] = a[i] * 255; img.data[i * 4 + 1] = b[i] * 255; img.data[i * 4 + 2] = s[i] * 255; img.data[i * 4 + 3] = 255; }
    x.putImageData(img, 0, 0);
    T.detail = tex(c, { linear: true });
  }
  { // paddy surface seen from afar: rows of rice
    const [c, x] = canvas(128);
    noiseFill(x, 128, [120, 160, 70], 50, 101, 8, 4);
    for (let i = 0; i < 128; i += 4) { x.fillStyle = 'rgba(30,50,20,0.28)'; x.fillRect(0, i, 128, 1); }
    T.paddy = tex(c, { repeat: [1 / 2, 1 / 2] });
  }
  { // light pool (radial)
    const [c, x] = canvas(128);
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(0.7, 'rgba(255,255,255,0.1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    T.pool = tex(c, { clamp: true, linear: true });
  }
  { // soft glow sprite
    const [c, x] = canvas(64);
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    T.glow = tex(c, { clamp: true, linear: true });
  }
  T.windowDay = tex(drawWindow(false), { clamp: true });
  T.windowLit = tex(drawWindow(true), { clamp: true });
  T.shojiDay = tex(drawShoji(false), { clamp: true });
  T.shojiLit = tex(drawShoji(true), { clamp: true });
  T.doorDay = tex(drawDoor(false), { clamp: true });
  T.doorLit = tex(drawDoor(true), { clamp: true });
  T.shutter = tex(drawShutter(), { clamp: true });
  T.vending = [0, 1, 2].map((i) => tex(drawVending(i), { clamp: true }));
  return T;
}

function drawWindow(lit) {
  const [c, x] = canvas(128);
  if (lit) {
    const g = x.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, '#ffd89a'); g.addColorStop(1, '#ffb45c');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    // curtains
    x.fillStyle = 'rgba(255,240,210,0.55)';
    for (let i = 0; i < 128; i += 8) x.fillRect(i, 0, 4, 128);
    x.fillStyle = 'rgba(120,70,30,0.35)'; x.fillRect(0, 96, 128, 32);
  } else {
    const g = x.createLinearGradient(0, 0, 128, 128);
    g.addColorStop(0, '#5f7488'); g.addColorStop(0.45, '#2b3846'); g.addColorStop(0.55, '#3d4c5c'); g.addColorStop(1, '#1d2630');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    x.fillStyle = 'rgba(255,255,255,0.12)';
    x.beginPath(); x.moveTo(10, 128); x.lineTo(50, 0); x.lineTo(70, 0); x.lineTo(30, 128); x.fill();
    x.fillStyle = 'rgba(230,230,220,0.35)'; x.fillRect(4, 4, 56, 30); // curtain lace
  }
  // aluminium frame
  x.strokeStyle = lit ? '#6e655a' : '#b9bcbe'; x.lineWidth = 7; x.strokeRect(3, 3, 122, 122);
  x.lineWidth = 5; x.beginPath(); x.moveTo(64, 0); x.lineTo(64, 128); x.stroke();
  return c;
}
function drawShoji(lit) {
  const [c, x] = canvas(128);
  x.fillStyle = lit ? '#ffe2b0' : '#e9e4d6'; x.fillRect(0, 0, 128, 128);
  if (lit) { const g = x.createRadialGradient(64, 70, 10, 64, 70, 90); g.addColorStop(0, 'rgba(255,250,230,0.9)'); g.addColorStop(1, 'rgba(255,170,90,0.3)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
  x.strokeStyle = lit ? 'rgba(90,55,30,0.85)' : '#7a5a3e'; x.lineWidth = 2.5;
  for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo((i * 128) / 4, 0); x.lineTo((i * 128) / 4, 128); x.stroke(); }
  for (let j = 1; j < 6; j++) { x.beginPath(); x.moveTo(0, (j * 128) / 6); x.lineTo(128, (j * 128) / 6); x.stroke(); }
  x.lineWidth = 7; x.strokeRect(3, 3, 122, 122);
  x.beginPath(); x.moveTo(64, 0); x.lineTo(64, 128); x.stroke();
  return c;
}
function drawDoor(lit) {
  const [c, x] = canvas(128);
  x.fillStyle = lit ? '#f4c27a' : '#a9b2b6'; x.fillRect(0, 0, 128, 128);
  // frosted glass with lattice (genkan sliding door)
  x.strokeStyle = lit ? '#5a4128' : '#5f574e'; x.lineWidth = 3;
  for (let i = 1; i < 6; i++) { x.beginPath(); x.moveTo(0, (i * 128) / 6); x.lineTo(128, (i * 128) / 6); x.stroke(); }
  for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo((i * 128) / 4, 0); x.lineTo((i * 128) / 4, 128); x.stroke(); }
  x.lineWidth = 8; x.strokeRect(4, 4, 120, 120);
  x.beginPath(); x.moveTo(64, 0); x.lineTo(64, 128); x.stroke();
  return c;
}
function drawShutter() {
  const [c, x] = canvas(64);
  x.fillStyle = '#8f8a80'; x.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 64; i += 8) { x.fillStyle = 'rgba(0,0,0,0.2)'; x.fillRect(i, 0, 1, 64); x.fillStyle = 'rgba(255,255,255,0.15)'; x.fillRect(i + 1, 0, 1, 64); }
  return c;
}

export const DRINKS = [
  { name: 'Зелёный чай', jp: 'お茶', c1: '#3f8a3a', c2: '#d9ecc0' },
  { name: 'Холодный кофе', jp: 'コーヒー', c1: '#5b3a22', c2: '#c9a27a' },
  { name: 'Рамунэ-сода', jp: 'ラムネ', c1: '#6fc3df', c2: '#eaf8ff' },
  { name: 'Спортивный напиток', jp: 'スポーツ', c1: '#2a5fb0', c2: '#ffffff' },
  { name: 'Персиковая вода', jp: 'もも', c1: '#f0a0a0', c2: '#fff0e8' },
  { name: 'Ячменный чай', jp: '麦茶', c1: '#b07a2a', c2: '#f4e2b8' },
  { name: 'Апельсиновый сок', jp: 'オレンジ', c1: '#f08a1a', c2: '#fff2c8' },
  { name: 'Кальпис', jp: 'カルピ', c1: '#ffffff', c2: '#3a68c8' },
  { name: 'Кола', jp: 'コーラ', c1: '#b8202a', c2: '#f4f4f4' },
  { name: 'Минеральная вода', jp: '天然水', c1: '#d8eef8', c2: '#3a8ac8' },
];

function drawVending(variant) {
  const [c, x] = canvas(320, 384);
  const R = mulberry32(200 + variant);
  x.fillStyle = '#f8fbff'; x.fillRect(0, 0, 320, 384);
  const g = x.createLinearGradient(0, 0, 0, 384); g.addColorStop(0, 'rgba(200,230,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 320, 384);
  const rows = 3, perRow = 7;
  for (let r = 0; r < rows; r++) {
    const y0 = 14 + r * 124;
    x.fillStyle = 'rgba(0,0,0,0.07)'; x.fillRect(6, y0 + 82, 308, 2);
    for (let i = 0; i < perRow; i++) {
      const d = DRINKS[Math.floor(R() * DRINKS.length)];
      const cx = 10 + i * 43 + 21, w = 28;
      const can = R() < 0.55;
      const h = can ? 56 : 74, top = y0 + 80 - h;
      x.fillStyle = d.c1; x.fillRect(cx - w / 2, top + (can ? 4 : 20), w, h - (can ? 4 : 20));
      if (can) { x.fillStyle = '#c8ccd0'; x.fillRect(cx - w / 2, top, w, 5); }
      else { x.fillStyle = d.c1; x.fillRect(cx - 6, top + 6, 12, 16); x.fillStyle = '#eee'; x.fillRect(cx - 5, top, 10, 7); }
      x.fillStyle = d.c2; x.fillRect(cx - w / 2 + 3, top + h * 0.45, w - 6, h * 0.25);
      x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(cx - w / 2 + 2, top + 8, 4, h - 12);
      x.fillStyle = '#1a1a1a'; x.font = 'bold 14px sans-serif'; x.textAlign = 'center';
      x.fillText(['100', '120', '130', '150', '160'][Math.floor(R() * 5)], cx, y0 + 100);
      x.fillStyle = R() < 0.85 ? '#2fd06a' : '#e03a2a'; x.fillRect(cx - 8, y0 + 105, 16, 7);
    }
    x.fillStyle = r < 2 ? '#2a6fd8' : '#d8402a'; x.fillRect(6, y0 + 86, 58, 15);
    x.fillStyle = '#fff'; x.font = 'bold 11px ' + JP_SANS; x.textAlign = 'left';
    x.fillText(r < 2 ? 'つめた〜い' : 'あったか〜い', 9, y0 + 98);
  }
  return c;
}

export function drawSign(text, o = {}) {
  const w = o.w || 512, h = o.h || 128;
  const [c, x] = canvas(w, h);
  x.fillStyle = o.bg || '#f4efe2'; x.fillRect(0, 0, w, h);
  if (o.border) { x.strokeStyle = o.border; x.lineWidth = o.borderW || 8; x.strokeRect(x.lineWidth / 2, x.lineWidth / 2, w - x.lineWidth, h - x.lineWidth); }
  x.fillStyle = o.fg || '#1d1d1d';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  if (o.vertical) {
    const chars = [...text];
    const fs = Math.min(w * 0.75, (h * 0.9) / chars.length);
    x.font = `${o.weight || 900} ${fs}px ${o.font || JP_SERIF}`;
    chars.forEach((ch, i) => x.fillText(ch, w / 2, h * 0.05 + fs * (i + 0.5)));
  } else {
    let fs = o.size || h * 0.62;
    x.font = `${o.weight || 900} ${fs}px ${o.font || JP_SERIF}`;
    const mw = x.measureText(text).width;
    if (mw > w * 0.9) { fs *= (w * 0.9) / mw; x.font = `${o.weight || 900} ${fs}px ${o.font || JP_SERIF}`; }
    x.fillText(text, w / 2, h * (o.baseline || 0.54));
    if (o.sub) { x.font = `700 ${h * 0.16}px ${JP_SANS}`; x.fillText(o.sub, w / 2, h * 0.86); }
  }
  return tex(c, { clamp: true });
}
