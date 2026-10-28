import * as THREE from 'three';
import { smoothstep, clamp } from '../core/noise.js';

// Time of day for an early-August day in central Japan (lat ~35°N): sunrise ≈ 5:00, sunset ≈ 18:55.

const LAT = THREE.MathUtils.degToRad(35.2);
const DECL = THREE.MathUtils.degToRad(16.5);

// Colors are sRGB hex. Interpolated in linear space.
const KEYS = [
  { h: 0.0, zen: 0x050a1c, hor: 0x16203a, sun: 0x9ab0e0, si: 0, hs: 0x22305c, hg: 0x0c0f1a, hi: 0.42, fog: 0x121b33, fd: 0.0009, mist: 0.004, haze: 0x223052, stars: 1, cl: 0x2c3654, cd: 0x121830, exp: 1.15 },
  { h: 3.7, zen: 0x060b1f, hor: 0x1a2440, sun: 0x9ab0e0, si: 0, hs: 0x22305c, hg: 0x0c0f1a, hi: 0.4, fog: 0x141d36, fd: 0.0009, mist: 0.012, haze: 0x26345a, stars: 1, cl: 0x2c3654, cd: 0x121830, exp: 1.15 },
  { h: 4.45, zen: 0x12204a, hor: 0x48466a, sun: 0xff9a66, si: 0, hs: 0x3c4a7c, hg: 0x16161e, hi: 0.45, fog: 0x3c3c5a, fd: 0.0011, mist: 0.03, haze: 0x9a6a70, stars: 0.6, cl: 0x5a5470, cd: 0x2a2840, exp: 1.25 },
  { h: 4.95, zen: 0x2c4482, hor: 0xe09e86, sun: 0xff9a66, si: 0.5, hs: 0x6878a8, hg: 0x2c2626, hi: 0.6, fog: 0xc0989a, fd: 0.0012, mist: 0.045, haze: 0xffb08a, stars: 0.12, cl: 0xf4a894, cd: 0x5a5070, exp: 1.12 },
  { h: 5.6, zen: 0x4c72b6, hor: 0xf2bc96, sun: 0xffb87c, si: 1.6, hs: 0x90a6d0, hg: 0x4a4038, hi: 0.85, fog: 0xdcc0ac, fd: 0.001, mist: 0.04, haze: 0xffcca0, stars: 0, cl: 0xffdcc0, cd: 0x8a849c, exp: 1.02 },
  { h: 6.8, zen: 0x5288d2, hor: 0xe2dcca, sun: 0xffe4be, si: 2.5, hs: 0xa8c2e4, hg: 0x5c5640, hi: 1.05, fog: 0xccd6dc, fd: 0.00075, mist: 0.012, haze: 0xffe6c4, stars: 0, cl: 0xfff4e8, cd: 0xa0aec4, exp: 1.0 },
  { h: 8.6, zen: 0x3c7ed8, hor: 0xc0daee, sun: 0xfff2e2, si: 3.1, hs: 0xb4d2f2, hg: 0x5e5a40, hi: 1.25, fog: 0xbcd4e8, fd: 0.00055, mist: 0.002, haze: 0xfff0dc, stars: 0, cl: 0xffffff, cd: 0xb8c4d4, exp: 1.0 },
  { h: 12.0, zen: 0x3279da, hor: 0xc0dcf2, sun: 0xfffaf2, si: 3.4, hs: 0xb8d6f6, hg: 0x626044, hi: 1.3, fog: 0xbed6ec, fd: 0.0005, mist: 0, haze: 0xfff6e8, stars: 0, cl: 0xffffff, cd: 0xbcc8d8, exp: 1.0 },
  { h: 15.5, zen: 0x3a7ed6, hor: 0xc8dcee, sun: 0xfff2de, si: 3.2, hs: 0xb4d0ee, hg: 0x646044, hi: 1.25, fog: 0xc2d6e6, fd: 0.00052, mist: 0, haze: 0xfff0d8, stars: 0, cl: 0xffffff, cd: 0xbcc6d4, exp: 1.0 },
  { h: 17.1, zen: 0x4c82cc, hor: 0xead4ac, sun: 0xffd69c, si: 2.7, hs: 0xacc2de, hg: 0x6a5a40, hi: 1.05, fog: 0xd6ccb6, fd: 0.0006, mist: 0, haze: 0xffd292, stars: 0, cl: 0xfff0d8, cd: 0xb0a8b0, exp: 1.0 },
  { h: 18.25, zen: 0x46669e, hor: 0xf4a868, sun: 0xffa45c, si: 2.0, hs: 0x98a2c6, hg: 0x5a4434, hi: 0.9, fog: 0xe0ac84, fd: 0.0007, mist: 0.002, haze: 0xffa262, stars: 0, cl: 0xffc898, cd: 0x8a6c88, exp: 1.02 },
  { h: 18.85, zen: 0x34488c, hor: 0xf27e4e, sun: 0xff7038, si: 1.1, hs: 0x7c7ca8, hg: 0x40302c, hi: 0.78, fog: 0xc88270, fd: 0.0008, mist: 0.004, haze: 0xff7a40, stars: 0, cl: 0xffa070, cd: 0x6a4a70, exp: 1.05 },
  { h: 19.35, zen: 0x24306c, hor: 0xb86a7a, sun: 0xff5030, si: 0, hs: 0x504c84, hg: 0x221c26, hi: 0.62, fog: 0x7a5c76, fd: 0.0009, mist: 0.006, haze: 0xd86c62, stars: 0.12, cl: 0xc87a8a, cd: 0x3a3058, exp: 1.12 },
  { h: 20.0, zen: 0x141d4a, hor: 0x48426e, sun: 0x9ab0e0, si: 0, hs: 0x303a6c, hg: 0x14121c, hi: 0.5, fog: 0x2c2c4c, fd: 0.0009, mist: 0.006, haze: 0x5a4a70, stars: 0.55, cl: 0x4a4466, cd: 0x1c1a34, exp: 1.22 },
  { h: 20.9, zen: 0x0a1234, hor: 0x1e2a4e, sun: 0x9ab0e0, si: 0, hs: 0x24325e, hg: 0x0c0f1a, hi: 0.44, fog: 0x141e38, fd: 0.0009, mist: 0.005, haze: 0x26345a, stars: 1, cl: 0x2c3654, cd: 0x121830, exp: 1.15 },
  { h: 24.0, zen: 0x050a1c, hor: 0x16203a, sun: 0x9ab0e0, si: 0, hs: 0x22305c, hg: 0x0c0f1a, hi: 0.42, fog: 0x121b33, fd: 0.0009, mist: 0.004, haze: 0x223052, stars: 1, cl: 0x2c3654, cd: 0x121830, exp: 1.15 },
];
const COLOR_FIELDS = ['zen', 'hor', 'sun', 'hs', 'hg', 'fog', 'haze', 'cl', 'cd'];
const NUM_FIELDS = ['si', 'hi', 'fd', 'mist', 'stars', 'exp'];
const LIN = KEYS.map((k) => {
  const o = { h: k.h };
  for (const f of COLOR_FIELDS) o[f] = new THREE.Color(k[f]);
  for (const f of NUM_FIELDS) o[f] = k[f];
  return o;
});

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
const WEEK_RU = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

export class TimeOfDay {
  constructor(hour = 15.5) {
    this.hour = hour;
    this.day = 0;          // days since start (Aug 7, Wed)
    this.speed = 60;       // game seconds per real second
    this.boost = 1;
    this.s = {};
    for (const f of COLOR_FIELDS) this.s[f] = new THREE.Color();
    this.sunDir = new THREE.Vector3();
    this.moonDir = new THREE.Vector3();
    this.lightDir = new THREE.Vector3();
    this.update(0);
  }
  get totalHours() { return this.day * 24 + this.hour; }
  update(dt) {
    this.hour += (dt * this.speed * this.boost) / 3600;
    while (this.hour >= 24) { this.hour -= 24; this.day++; }
    while (this.hour < 0) { this.hour += 24; this.day--; }
    const h = this.hour;
    // keyframe interpolation
    let i = 0;
    while (i < LIN.length - 2 && LIN[i + 1].h <= h) i++;
    const a = LIN[i], b = LIN[i + 1];
    const t = clamp((h - a.h) / (b.h - a.h), 0, 1);
    for (const f of COLOR_FIELDS) this.s[f].copy(a[f]).lerp(b[f], t);
    for (const f of NUM_FIELDS) this.s[f] = a[f] + (b[f] - a[f]) * t;

    sunVector(h, DECL, this.sunDir);
    sunVector(h + 12.4, -0.12, this.moonDir);
    const sunSin = this.sunDir.y;
    this.sunSin = sunSin;
    this.dayLight = smoothstep(-0.03, 0.08, sunSin);
    this.sunI = this.s.si * smoothstep(-0.015, 0.06, sunSin);
    this.moonI = 0.38 * smoothstep(-0.05, -0.16, sunSin) * smoothstep(0.0, 0.12, this.moonDir.y);
    this.useMoon = sunSin < -0.05;
    this.lightDir.copy(this.useMoon ? this.moonDir : this.sunDir);
    this.night = 1 - smoothstep(-0.1, 0.05, sunSin);         // 0 day .. 1 night
    this.lamps = 1 - smoothstep(-0.02, 0.09, sunSin);         // street lamps by light sensor
    // windows: A evening family, B night owls, C early-rising farmers
    const dark = 1 - smoothstep(0.0, 0.12, sunSin);
    this.winA = dark * band(h, 17.2, 22.7);
    this.winB = dark * Math.max(band(h, 18.0, 24.0), band(h, 0, 1.3));
    this.winC = dark * Math.max(band(h, 4.1, 6.2), band(h, 18.6, 21.3));
  }
  // formatted clock
  clock() {
    const h = Math.floor(this.hour), m = Math.floor((this.hour - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  dateJP() {
    const d = 7 + this.day, w = (3 + this.day) % 7;
    const month = d > 31 ? 9 : 8, dd = d > 31 ? d - 31 : d;
    const wx = this.hour > 19.4 || this.hour < 4.6 ? 'よる' : this.hour < 7 ? 'あさ' : 'はれ';
    return `${month}月${dd}日（${WEEK[w]}）${wx}`;
  }
  dateRU() { return WEEK_RU[(3 + this.day) % 7]; }
}

function band(h, a, b) { // smooth 0..1 inside [a,b] with ~15 min ramps
  return smoothstep(a - 0.12, a + 0.12, h) * (1 - smoothstep(b - 0.12, b + 0.12, h));
}

const _v = new THREE.Vector3();
export function sunVector(hour, decl, out) {
  const H = ((hour - 12.05) / 24) * Math.PI * 2;
  const sinEl = Math.sin(LAT) * Math.sin(decl) + Math.cos(LAT) * Math.cos(decl) * Math.cos(H);
  const east = -Math.cos(decl) * Math.sin(H);
  const north = Math.sin(decl) * Math.cos(LAT) - Math.cos(decl) * Math.sin(LAT) * Math.cos(H);
  out.set(east, sinEl, -north).normalize();
  return out;
}
