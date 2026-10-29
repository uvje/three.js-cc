import { hillDist } from '../world/terrain.js';
import { F, THETA, CU, CV } from '../world/planner.js';

// DOM HUD: clock, prompts, toasts, place titles, map, diary stamps, shop menus and the pause page.

const $ = (id) => document.getElementById(id);

export const STAMPS = [
  { id: 'vending', seal: '缶', ru: 'Купить баночку в автомате' },
  { id: 'dagashi', seal: '菓', ru: 'Купить сладости в «Нацумэ сётэн»' },
  { id: 'shrine', seal: '祈', ru: 'Помолиться в святилище на холме' },
  { id: 'sunset', seal: '夕', ru: 'Встретить закат на смотровой' },
  { id: 'chime', seal: '鐘', ru: 'Услышать вечернюю мелодию в 17:00' },
  { id: 'fireflies', seal: '蛍', ru: 'Увидеть светлячков у реки' },
  { id: 'night', seal: '夜', ru: 'Проехать ночью с фарой 500 м' },
  { id: 'mist', seal: '霧', ru: 'Застать утренний туман' },
  { id: 'ride', seal: '輪', ru: 'Накатать на велосипеде 5 км' },
  { id: 'camphor', seal: '楠', ru: 'Найти великое камфорное дерево' },
  { id: 'sunflower', seal: '向', ru: 'Найти поле подсолнухов' },
  { id: 'river', seal: '川', ru: 'Постоять у реки' },
  { id: 'school', seal: '学', ru: 'Заглянуть в пустую школу' },
  { id: 'diner', seal: '食', ru: 'Пообедать в столовой «Фудзи»' },
  { id: 'station', seal: '駅', ru: 'Встретить поезд на станции' },
  { id: 'busstop', seal: '待', ru: 'Посидеть на автобусной остановке' },
  { id: 'melon', seal: '瓜', ru: 'Съесть арбуз у бабушки' },
  { id: 'granny', seal: '婆', ru: 'Поговорить с бабушкой' },
  { id: 'engawa', seal: '縁', ru: 'Посидеть вечером на энгаве' },
  { id: 'sleep', seal: '眠', ru: 'Проснуться утром в бабушкином доме' },
  { id: 'rain', seal: '雨', ru: 'Попасть под летний ливень' },
  { id: 'cat', seal: '猫', ru: 'Погладить деревенскую кошку' },
  { id: 'hanabi', seal: '花', ru: 'Посмотреть летний фейерверк над рекой' },
  { id: 'senko', seal: '線', ru: 'Зажечь сэнко-ханаби тёплой ночью' },
  { id: 'matsuri', seal: '祭', ru: 'Побывать на летнем празднике у святилища' },
  { id: 'kingyo', seal: '魚', ru: 'Поймать золотую рыбку сачком из бумаги' },
  { id: 'meteor', seal: '星', ru: 'Увидеть падающую звезду' },
  { id: 'taiso', seal: '体', ru: 'Сделать утреннюю радиозарядку с детьми у школы' },
  { id: 'bon', seal: '踊', ru: 'Станцевать бон-одори вокруг ягуры' },
];

export class HUD {
  constructor() {
    this.el = {
      clock: $('clock'), t: document.querySelector('#clock .t'), d: document.querySelector('#clock .d'), s: document.querySelector('#clock .s'),
      money: $('money'), place: $('place'), placeJp: document.querySelector('#place .jp'), placeRu: document.querySelector('#place .ru'), placeSeal: document.querySelector('#place .seal'),
      prompt: $('prompt'), toasts: $('toasts'), speed: $('speed'), dot: $('dot'), hint: $('hint'),
      map: $('mapView'), mapCanvas: $('mapCanvas'), diary: $('diaryView'), stamps: $('stamps'), diaryInfo: $('diaryInfo'),
      shop: $('shopView'), shopTitle: $('shopTitle'), shopSub: $('shopSub'), shopList: $('shopList'),
    };
    this.lastPrompt = '';
    this.placeTimer = 0;
    this.money = 0;
  }
  showHud(v) { for (const k of ['clock', 'money', 'dot', 'hint']) this.el[k].hidden = !v; }
  clock(time, speedLabel) {
    const t = time.clock();
    if (t !== this._t) { this._t = t; this.el.t.textContent = t; this.el.d.textContent = time.dateJP(); this.el.s.textContent = speedLabel; }
  }
  setMoney(v, note = '') {
    this.money = v;
    this.el.money.firstChild.textContent = '¥ ' + v.toLocaleString('ru-RU') + ' ';
    this.el.money.querySelector('small').textContent = note;
  }
  toast(msg) {
    const d = document.createElement('div');
    d.className = 'toast'; d.textContent = msg;
    this.el.toasts.appendChild(d);
    setTimeout(() => d.remove(), 4300);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
  }
  prompt(p) {
    const s = p ? p.key + '|' + p.text : '';
    if (s === this.lastPrompt) return;
    this.lastPrompt = s;
    if (!p) { this.el.prompt.classList.remove('show'); return; }
    this.el.prompt.innerHTML = '';
    const k = document.createElement('kbd'); k.textContent = p.key;
    this.el.prompt.append(k, document.createTextNode(p.text));
    this.el.prompt.classList.add('show');
  }
  place(r) {
    this.el.placeJp.textContent = r.jp; this.el.placeRu.textContent = r.ru; this.el.placeSeal.textContent = r.seal || '夏';
    this.el.place.classList.add('show');
    clearTimeout(this.placeTimer);
    this.placeTimer = setTimeout(() => this.el.place.classList.remove('show'), 5200);
  }
  speed(v, show) {
    this.el.speed.classList.toggle('show', show);
    if (show) { const kmh = Math.round(Math.abs(v) * 3.6); if (kmh !== this._kmh) { this._kmh = kmh; this.el.speed.firstChild.textContent = kmh; } }
  }
  hint(text) { if (text !== this._hint) { this._hint = text; this.el.hint.textContent = text; } }

  // ---------------- diary
  renderDiary(got, stats) {
    const s = this.el.stamps;
    s.innerHTML = '';
    for (const st of STAMPS) {
      const d = document.createElement('div');
      d.className = 'stamp' + (got.has(st.id) ? ' got' : '');
      const c = document.createElement('div'); c.className = 'c'; c.textContent = st.seal;
      const l = document.createElement('div'); l.className = 'lbl'; l.textContent = st.ru;
      d.append(c, l); s.appendChild(d);
    }
    this.el.diaryInfo.textContent = `Штампов: ${got.size} из ${STAMPS.length} · проехано ${(stats.ridden / 1000).toFixed(1)} км · день ${stats.day + 1}`;
  }

  // ---------------- shop
  openShop(title, sub, items, money, onBuy) {
    this.el.shopTitle.textContent = title;
    this.el.shopSub.textContent = sub;
    const L = this.el.shopList;
    L.innerHTML = '';
    for (const it of items) {
      const b = document.createElement('button');
      b.type = 'button';
      const a = document.createElement('span'); a.textContent = it.name;
      const p = document.createElement('span'); p.textContent = '¥' + it.price;
      b.append(a, p);
      b.disabled = money < it.price;
      b.addEventListener('click', () => onBuy(it));
      L.appendChild(b);
    }
    this.el.shop.hidden = false;
  }
  closeShop() { this.el.shop.hidden = true; }

  // ---------------- map
  buildMap(W) {
    const cv = this.el.mapCanvas, ctx = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    const X0 = -780, X1 = 780, Z0 = -405, Z1 = 455;
    this.mapT = { X0, X1, Z0, Z1, w, h };
    const sx = (x) => ((x - X0) / (X1 - X0)) * w, sz = (z) => ((z - Z0) / (Z1 - Z0)) * h;
    const base = document.createElement('canvas'); base.width = w; base.height = h;
    const g = base.getContext('2d');
    g.fillStyle = '#f1eedf'; g.fillRect(0, 0, w, h);
    // terrain shading
    const step = 4;
    for (let py = 0; py < h; py += step) for (let px = 0; px < w; px += step) {
      const x = X0 + (px / w) * (X1 - X0), z = Z0 + (py / h) * (Z1 - Z0);
      const hd = hillDist(x, z);
      const y = W.hm.sample(x, z);
      const occ = W.plan.occAt(x, z);
      let col = null;
      if (occ & F.FIELD) col = '#dfe8bf';
      if (hd > 2 || y - 9 > 3) { const k = Math.min(1, (y - 6) / 70); col = `rgb(${Math.round(170 - k * 70)},${Math.round(196 - k * 60)},${Math.round(150 - k * 70)})`; }
      if (col) { g.fillStyle = col; g.fillRect(px, py, step, step); }
    }
    // paddy grid lines
    g.strokeStyle = 'rgba(120,150,80,0.45)'; g.lineWidth = 1;
    const c = Math.cos(THETA), s = Math.sin(THETA);
    for (const cell of W.plan.cells.values()) {
      const pts = [[0, 0], [CU, 0], [CU, CV], [0, CV]].map(([a, b]) => { const u = cell.iu * CU + a, v = cell.iv * CV + b; return [sx(u * c - v * s), sz(u * s + v * c)]; });
      g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.closePath(); g.stroke();
      if (cell.type === 'sunflower') { g.fillStyle = 'rgba(240,190,30,0.7)'; g.fill(); }
    }
    // river
    g.strokeStyle = '#7fb4d4'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); W.plan.river.poly.pts.forEach(([x, z], i) => (i ? g.lineTo(sx(x), sz(z)) : g.moveTo(sx(x), sz(z)))); g.stroke();
    g.strokeStyle = '#a9d0e6'; g.lineWidth = 4; g.stroke();
    // roads
    const drawRoad = (r, wOut, wIn, cIn) => {
      g.beginPath(); r.poly.pts.forEach(([x, z], i) => (i ? g.lineTo(sx(x), sz(z)) : g.moveTo(sx(x), sz(z))));
      g.strokeStyle = '#7d7666'; g.lineWidth = wOut; g.stroke(); g.strokeStyle = cIn; g.lineWidth = wIn; g.stroke();
    };
    for (const r of W.plan.roads) if (r.type === 'farm') drawRoad(r, 2.5, 1.2, '#f6f2e4');
    for (const r of W.plan.roads) if (r.type === 'path') drawRoad(r, 3, 1.5, '#e8dcc0');
    for (const r of W.plan.roads) if (r.type === 'local') drawRoad(r, 5, 3, '#ffffff');
    drawRoad(W.plan.byName.main, 8, 5.5, '#fff6d8');
    // railway
    const rail = W.plan.rail;
    g.beginPath(); rail.poly.pts.forEach(([x, z], i) => (i ? g.lineTo(sx(x), sz(z)) : g.moveTo(sx(x), sz(z))));
    g.strokeStyle = '#2a2a2a'; g.lineWidth = 5; g.stroke();
    g.setLineDash([10, 10]); g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.stroke(); g.setLineDash([]);
    // buildings
    g.fillStyle = '#6a5f55';
    for (const l of W.plan.lots) {
      g.save(); g.translate(sx(l.x), sz(l.z)); g.rotate(-l.ang);
      const bw = (l.w * 0.55) / (X1 - X0) * w, bd = (l.d * 0.45) / (Z1 - Z0) * h;
      g.fillRect(-bw / 2, -bd / 2 - 1, bw, bd);
      g.restore();
    }
    // icons
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const ic of W.landmarkIcons) {
      if (ic.small) { g.fillStyle = '#d6402e'; g.beginPath(); g.arc(sx(ic.x), sz(ic.z), 3, 0, 7); g.fill(); continue; }
      g.font = '700 22px "Zen Old Mincho", serif';
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(sx(ic.x), sz(ic.z), 14, 0, 7); g.fill();
      g.strokeStyle = '#7d7666'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = ic.icon === '⛩' ? '#c8382a' : '#2a2a2a';
      g.fillText(ic.icon, sx(ic.x), sz(ic.z) + 1);
    }
    // labels
    g.font = '700 17px "Zen Old Mincho", serif'; g.fillStyle = '#3a3a34';
    for (const r of W.plan.regions) if (r.x !== undefined && r.r > 25) { g.fillText(r.jp, sx(r.x), sz(r.z) - 26); }
    g.font = '600 13px "M PLUS Rounded 1c", sans-serif'; g.fillStyle = '#5a5a50';
    for (const r of W.plan.regions) if (r.x !== undefined && r.r > 25) g.fillText(r.ru, sx(r.x), sz(r.z) - 9);
    g.font = '700 15px "Zen Old Mincho", serif'; g.fillStyle = '#4a7aa0';
    g.fillText('夏目川 · река Нацумэ', sx(150), sz(222));
    // compass
    g.font = '800 18px sans-serif'; g.fillStyle = '#3a3a34'; g.fillText('北 ↑', w - 40, 28);
    this.mapBase = base;
    this.mapSX = sx; this.mapSZ = sz;
  }
  drawMap(player) {
    const cv = this.el.mapCanvas, g = cv.getContext('2d');
    g.drawImage(this.mapBase, 0, 0);
    const sx = this.mapSX, sz = this.mapSZ;
    const b = player.bike;
    if (player.mode !== 'bike') { g.strokeStyle = '#2a6ab0'; g.lineWidth = 3; g.beginPath(); g.arc(sx(b.x), sz(b.z), 7, 0, 7); g.stroke(); }
    const yaw = player.mode === 'bike' ? b.heading + Math.PI + player.headYaw : player.yaw;
    const px = sx(player.pos.x), pz = sz(player.pos.z);
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    g.save(); g.translate(px, pz); g.rotate(Math.atan2(fx, -fz));
    g.fillStyle = '#d6402e'; g.strokeStyle = '#ffffff'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(0, -14); g.lineTo(9, 10); g.lineTo(0, 5); g.lineTo(-9, 10); g.closePath(); g.stroke(); g.fill();
    g.restore();
  }
}
