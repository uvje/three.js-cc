import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Input } from './core/input.js';
import { Environment } from './env/environment.js';
import { U } from './env/materials.js';
import { DRINKS } from './env/textures.js';
import { World } from './world/world.js';
import { F } from './world/planner.js';
import { Player } from './player/player.js';
import { AudioEngine } from './audio/audio.js';
import { HUD, STAMPS } from './ui/hud.js';
import { Trains } from './world/train.js';
import { Fireworks, Sparkler } from './world/fireworks.js';
import { Villagers } from './world/npc.js';
import { Traffic } from './world/traffic.js';
import { Weather } from './env/weather.js';
import { Wildlife } from './world/wildlife.js';
import { TouchControls } from './ui/touch.js';
import { Insects } from './world/insects.js';

const SPEEDS = [10, 20, 40, 60, 120, 240, 600];
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('natsume:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('natsume:' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
};

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.38 }, uNight: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime, uVig, uNight; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - dot(d, d) * uVig * 2.2;
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(c.rgb, mix(vec3(l), c.rgb, 0.8) * vec3(0.9, 0.97, 1.1), uNight * 0.55);
      c.rgb = mix(c.rgb, c.rgb * vec3(1.03, 1.0, 0.95), 1.0 - uNight);
      float n = fract(sin(dot(vUv * (fract(uTime) * 91.0 + 1.0), vec2(12.9898, 78.233))) * 43758.5453);
      c.rgb += (n - 0.5) * 0.01 * (0.5 + l);
      gl_FragColor = c;
    }`,
};

class Game {
  constructor() {
    this.settings = Object.assign({ sens: 1, vol: 0.8, amb: 1, quality: 'medium', invertY: false, mouseSteer: false, timeIdx: 3 }, store.get('settings', {}));
    this.stamps = new Set(store.get('stamps', []));
    this.money = store.get('money', 2000);
    this.sparklers = store.get('sparklers', 0);
    this.state = 'loading';
    this.tSec = 0;
    this.canvas = $('c');
    this.hud = new HUD();
    this.input = new Input(this.canvas);
    this.touch = new TouchControls(this.input, this.canvas);
    this.audio = new AudioEngine();
    this.audio.settings.vol = this.settings.vol; this.audio.settings.amb = this.settings.amb;
    this.initRenderer();
    this.bindUI();
    this.modal = null;
    this.lastRegion = null; this.regionCooldown = {};
    this.prevHour = null;
  }
  initRenderer() {
    const q = this.settings.quality;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: q === 'low', powerPreference: 'high-performance' }));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 6000);
    this.env = new Environment(this.scene, r, q);
    this.applyPixelRatio();
    this.composer = new EffectComposer(r, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 }));
    this.composer.addPass(new RenderPass(this.env.skyScene, this.camera));
    const mainPass = new RenderPass(this.scene, this.camera);
    mainPass.clear = false; mainPass.clearDepth = true;
    this.composer.addPass(mainPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.35, 0.6, 1.0);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    this.resize();
    addEventListener('resize', () => this.resize());
  }
  applyPixelRatio() {
    const q = this.settings.quality, dpr = devicePixelRatio || 1;
    this.renderer.setPixelRatio(q === 'high' ? Math.min(dpr, 1.75) : q === 'low' ? Math.min(dpr, 1) * 0.85 : Math.min(dpr, 1.25));
  }
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.composer) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h); }
  }
  setQuality(q) {
    this.settings.quality = q;
    this.applyPixelRatio(); this.resize();
    this.env.setQuality(q);
    this.world?.setQuality(q);
  }

  async load() {
    const bar = $('loadBar'), txt = $('loadText');
    const progress = (p, label) => { bar.style.width = Math.round(p * 100) + '%'; if (label) txt.textContent = label; };
    progress(0.01, 'Ждём шрифты');
    try { await Promise.race([Promise.all(['900 64px "Zen Old Mincho"', '700 32px "M PLUS Rounded 1c"'].map((f) => document.fonts.load(f, 'なつめ商店駅'))), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* offline: system fonts */ }
    this.world = new World(this.scene, this.renderer, this.settings.quality);
    this.world.game = this;
    await this.world.generate(progress);
    this.home = this.world.home;
    this.world.taiso.audio = this.audio;
    this.home.showGoldfish(!!store.get('kingyo', false));
    this.hud.buildMap(this.world);
    this.trains = new Trains(this.world, this.audio);
    const rv = this.world.plan.river, fq = rv.poly.nearest(330, 222, 60);
    this.fireworks = new Fireworks(this.scene, this.audio, { x: fq.x, y: rv.poly.sampleArray(rv.water, fq.s), z: fq.z });
    this.sparkler = new Sparkler(this.camera, this.scene, this.audio);
    this.villagers = new Villagers(this.world, this.audio);
    this.traffic = new Traffic(this.world, this.audio);
    this.weather = new Weather(this.scene, this.audio);
    this.env.weather = this.weather;
    this.env.sky.onMeteor = () => { if (this.state === 'play' && !this.modal) this.stamp('meteor'); };
    this.wildlife = new Wildlife(this.world, this.audio);
    this.insects = new Insects(this.world, this.audio);
    this.player = new Player(this.world, this.camera, this.input, this.audio, this.hud, this.settings);
    const sp = this.world.shopSpots.store;
    const road = this.world.plan.byName.main;
    const q = road.poly.nearest(sp.x, sp.z, 40);
    const yaw = Math.atan2(-(q.x - sp.x), -(q.z - sp.z)) + 1.2;
    this.player.spawn(sp.x + (q.x - sp.x) * 0.55, sp.z + (q.z - sp.z) * 0.55, yaw);
    this.applyTimeSpeed();
    this.renderer.compile(this.scene, this.camera);
    progress(1, 'Готово. Лето ждёт.');
    const b = $('startBtn'); b.disabled = false; b.textContent = 'Поехали'; b.focus();
    this.state = 'title';
    window.__game = this;
  }
  start() {
    if (this.state !== 'title' && this.state !== 'paused') return;
    $('title').hidden = true;
    this.hud.showHud(true);
    this.audio.start();
    this.audio.setVolume(this.settings.vol); this.audio.setAmbience(this.settings.amb);
    this.input.enabled = true;
    this.input.requestLock();
    this.state = 'play';
    this.hud.setMoney(this.money);
    this.hud.place({ jp: 'なつめ村', ru: 'Деревня Нацумэ · 15:30, август', seal: '夏' });
    setTimeout(() => this.hud.toast('W — идти, E — сесть на велосипед. Он стоит справа от тебя.'), 1500);
    setTimeout(() => this.hud.toast('Бабушкин дом отмечен на карте (M) знаком 家 — там можно переночевать.'), 7000);
    this.canvas.focus();
  }

  bindUI() {
    $('startBtn').addEventListener('click', () => this.start());
    $('resumeBtn').addEventListener('click', () => this.resume());
    $('shopClose').addEventListener('click', () => this.closeModal());
    $('diaryClose').addEventListener('click', () => this.closeModal());
    $('mapView').addEventListener('click', () => this.closeModal());
    this.input.onUnlock = () => { if (this.state === 'play' && !this.modal && !this.input.lockFailed) this.pause(); };
    addEventListener('keydown', (e) => {
      if (this.state === 'title' && (e.code === 'Enter' || e.code === 'Space') && !$('startBtn').disabled) { e.preventDefault(); this.start(); return; }
      if (e.code === 'Escape') {
        if (this.modal) this.closeModal();
        else if (this.state === 'play') this.pause();
        else if (this.state === 'paused') this.resume();
      }
      if (this.state === 'play' || this.modal) {
        if (e.code === 'KeyM') { e.preventDefault(); this.modal === 'map' ? this.closeModal() : this.openModal('map'); }
        if (e.code === 'Tab') { e.preventDefault(); this.modal === 'diary' ? this.closeModal() : this.openModal('diary'); }
      }
      if (this.state === 'play' && !this.modal) {
        if (e.code === 'KeyH') document.body.classList.toggle('hide-hud');
        if (e.code === 'KeyF') this.lightSparkler();
        if (e.code === 'BracketRight') { this.settings.timeIdx = Math.min(SPEEDS.length - 1, this.settings.timeIdx + 1); this.applyTimeSpeed(true); }
        if (e.code === 'BracketLeft') { this.settings.timeIdx = Math.max(0, this.settings.timeIdx - 1); this.applyTimeSpeed(true); }
      }
    });
    const bindRange = (id, key, fmt, apply) => {
      const el = $(id), out = $(id + 'Out');
      el.value = this.settings[key];
      const upd = () => { this.settings[key] = parseFloat(el.value); out.textContent = fmt(this.settings[key]); apply?.(this.settings[key]); store.set('settings', this.settings); };
      el.addEventListener('input', upd); upd();
    };
    bindRange('setTime', 'timeIdx', (v) => this.speedLabel(v), () => this.applyTimeSpeed());
    bindRange('setSens', 'sens', (v) => v.toFixed(2));
    bindRange('setVol', 'vol', (v) => Math.round(v * 100) + '%', (v) => this.audio.setVolume(v));
    bindRange('setAmb', 'amb', (v) => Math.round(v * 100) + '%', (v) => this.audio.setAmbience(v));
    const hourEl = $('setHour');
    hourEl.addEventListener('input', () => { const h = parseFloat(hourEl.value); this.env.time.hour = h; $('setHourOut').textContent = this.env.time.clock(); this.prevHour = h; });
    const qEl = $('setQuality'); qEl.value = this.settings.quality;
    qEl.addEventListener('change', () => { this.settings.qualityManual = true; this.setQuality(qEl.value); store.set('settings', this.settings); });
    const inv = $('setInvert'); inv.checked = this.settings.invertY; inv.addEventListener('change', () => { this.settings.invertY = inv.checked; store.set('settings', this.settings); });
    const ms = $('setMouseSteer'); ms.checked = this.settings.mouseSteer; ms.addEventListener('change', () => { this.settings.mouseSteer = ms.checked; store.set('settings', this.settings); });
  }
  speedLabel(i) { const s = SPEEDS[i]; const min = (24 * 3600) / s / 60; return min >= 60 ? `сутки за ${(min / 60).toFixed(1).replace('.0', '')} ч` : `сутки за ${Math.round(min)} мин`; }
  applyTimeSpeed(toast) { this.env.time.speed = SPEEDS[this.settings.timeIdx]; if (toast) this.hud.toast('Время: ' + this.speedLabel(this.settings.timeIdx)); store.set('settings', this.settings); }
  pause() {
    if (this.state !== 'play') return;
    this.state = 'paused';
    this.input.exitLock(); this.input.clear();
    $('pause').hidden = false;
    $('setHour').value = this.env.time.hour; $('setHourOut').textContent = this.env.time.clock();
    $('pauseInfo').textContent = `${this.env.time.dateJP()} · ${this.env.time.clock()} · штампов ${this.stamps.size}/${STAMPS.length}`;
  }
  resume() {
    if (this.state !== 'paused') return;
    $('pause').hidden = true;
    this.state = 'play';
    this.input.requestLock();
    this.canvas.focus();
  }
  openModal(kind, data) {
    this.modal = kind;
    this.input.exitLock(); this.input.clear();
    if (kind === 'map') { this.hud.drawMap(this.player); $('mapView').hidden = false; }
    if (kind === 'diary') { this.hud.renderDiary(this.stamps, { ridden: this.player.ridden, day: this.env.time.day, bugs: new Set(store.get('bugs', [])) }); $('diaryView').hidden = false; }
    if (kind === 'shop') this.openShop(data);
  }
  closeModal() {
    $('mapView').hidden = true; $('diaryView').hidden = true; this.hud.closeShop();
    this.modal = null;
    this.input.clear();
    if (this.state === 'play') { this.input.requestLock(); this.canvas.focus(); }
  }

  // ---------------- interactions
  interact(it) {
    const P = this.player;
    if (it.kind === 'vending') {
      if (this.money < 130) { this.hud.toast('Не хватает мелочи…'); return; }
      this.addMoney(-130);
      this.audio.vending();
      const d = DRINKS[Math.floor(Math.random() * DRINKS.length)];
      setTimeout(() => this.hud.toast(`${d.jp} — ${d.name}. Холодная банка в ладони.`), 1100);
      this.stamp('vending');
    } else if (it.kind === 'shop') this.openModal('shop', it.shop);
    else if (it.kind === 'stall') this.openModal('shop', it.stall);
    else if (it.kind === 'granny') { this.hud.toast('Бабушка: «' + this.home.grannyLine(this.env.time.hour) + '»'); this.stamp('granny'); }
    else if (it.kind === 'bug') {
      const r = this.insects.catch(it);
      if (!r) return;
      if (r.escaped) { this.hud.toast(`${r.bug.ru} с треском вырвалась из рук и улетела, напоследок обрызгав тебя. Лето!`); return; }
      const got = new Set(store.get('bugs', []));
      const fresh = !got.has(r.bug.id);
      got.add(r.bug.id); store.set('bugs', [...got]);
      this.audio.click();
      this.hud.toast(`${r.bug.jp} — ${r.bug.ru}${fresh ? ' · новая в коллекции!' : ''} ${r.bug.note}`);
      if (r.bug.id === 'kabuto') this.stamp('kabuto');
      if (got.size >= 5) this.stamp('mushi');
    }
    else if (it.kind === 'closed') this.hud.toast('Двери заперты, внутри темно. Магазин откроется в 6:30.');
    else if (it.kind === 'melon') {
      this.audio.eat();
      this.hud.toast(['Сочно и холодно. Косточки — в сад, кто дальше.', 'Арбуз из колодца, ледяной. Бабушка посолила кончик — так слаще.'][Math.floor(Math.random() * 2)]);
      this.stamp('melon');
    } else if (it.kind === 'sleep') this.sleep();
    else if (it.kind === 'cat') {
      this.villagers.pet(it.cat);
      this.hud.toast(['Мррр… Кошка щурится на солнце.', 'Кошка подставляет ухо. Мурлычет.', 'Тёплая, пахнет нагретой травой.'][Math.floor(Math.random() * 3)]);
      this.stamp('cat');
    }
    else if (it.kind === 'pray') {
      if (this.money < 5) { this.hud.toast('Нужна хотя бы монетка в 5 иен'); return; }
      this.addMoney(-5);
      this.audio.coinBox();
      const fortunes = [['大吉', 'Большая удача'], ['中吉', 'Средняя удача'], ['小吉', 'Маленькая удача'], ['吉', 'Удача'], ['末吉', 'Удача придёт позже']];
      const f = fortunes[Math.floor(Math.random() * fortunes.length)];
      setTimeout(() => this.hud.toast(`Хлоп-хлоп. Желание загадано. Омикудзи: ${f[0]} — ${f[1]}.`), 2400);
      this.stamp('shrine');
    } else if (it.kind === 'timetable') {
      const tr = this.trains.nextTrains(this.env.time.hour);
      const sp = this.env.time.speed / 3600;
      const fmt = (h) => { h = ((h % 24) + 24) % 24; const H = Math.floor(h), M = Math.floor((h - H) * 60); return `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`; };
      const txt = tr.map((e) => `${fmt(e.t + 50 * sp)} → ${e.dir === 'east' ? 'Хигасияма' : 'Мидзусава'}`).join(' · ');
      this.hud.toast('Расписание, なつめ駅: ' + txt);
    }
    void P;
  }
  openShop(kind) {
    const SH = {
      store: {
        title: 'なつめ商店', sub: 'Дедушка откладывает газету и кивает. Под потолком лениво крутится вентилятор, по телевизору — школьный бейсбол.',
        items: [
          { name: 'Рамунэ — газировка со стеклянным шариком', price: 100, msg: 'Щёлк! Шарик проваливается в горлышко. Шипит и пахнет лимонадом.' },
          { name: 'Фруктовый лёд на палочке', price: 80, msg: 'Тает быстрее, чем успеваешь доесть.' },
          { name: 'Какигори с клубничным сиропом', price: 200, msg: 'Голова чуть-чуть замёрзла. Это и есть лето.' },
          { name: 'Горсть дагаси — мелких сладостей', price: 50, msg: 'Жевательная конфета, кислый порошок и крошечное печенье в форме рыбки.' },
          { name: 'Кукурузная палочка', price: 15, msg: 'Хрустит. Пальцы в сырной пудре.' },
          { name: 'Сэнко-ханаби — 5 бенгальских огней', price: 300, msg: 'Бабушка улыбается: «Только когда стемнеет». Нажми F ночью, чтобы зажечь.', sparklers: 5 },
        ],
      },
      diner: {
        title: 'ふじ食堂', sub: 'Под потолком крутится вентилятор, по телевизору — бейсбол старшеклассников.',
        items: [
          { name: 'Хиясси тюка — холодная лапша', price: 650, msg: 'Ледяная лапша, огурец и кунжутная заправка. Идеально в жару.', meal: true },
          { name: 'Сёю-рамэн', price: 550, msg: 'Горячий бульон, хоть и жарко. Хозяйка добавила лишнее яйцо.', meal: true },
          { name: 'Карри-райс', price: 600, msg: 'Домашнее карри, как в школьной столовой.', meal: true },
          { name: 'Какигори с зелёным чаем и бобами', price: 280, msg: 'Горьковато-сладко. Тает на языке.' },
        ],
      },
      tako: {
        title: 'たこ焼き', sub: 'Хозяин ловко переворачивает шарики спицей. Шипит масло, пахнет соусом и бонито.',
        items: [
          { name: 'Такояки — шесть шариков с осьминогом', price: 400, msg: 'Горячо-горячо! Внутри кусочек осьминога, сверху пляшет стружка бонито.', snack: true },
          { name: 'Рамунэ из ведра со льдом', price: 150, msg: 'Ледяная бутылка, шарик звякает о стекло.' },
        ],
      },
      wata: {
        title: 'わたあめ', sub: 'В гудящем барабане из сахарных ниточек вырастает розовое облако.',
        items: [
          { name: 'Сахарная вата в пакете с героем мультика', price: 300, msg: 'Облако на палочке. Пальцы будут липкими до конца вечера.', snack: true },
          { name: 'Яблоко в карамели', price: 350, msg: 'Хрустящая красная глазурь, а внутри — кислое яблочко.', snack: true },
        ],
      },
      kori: {
        title: 'かき氷', sub: 'Ручная машинка скрипит и сыплет ледяную стружку горкой.',
        items: [
          { name: 'Какигори с клубничным сиропом', price: 250, msg: 'Сладко, холодно, голова чуть-чуть звенит.', snack: true },
          { name: 'Какигори «мэрон» — дынный', price: 250, msg: 'Ярко-зелёный, как светлячок. Пахнет дыней.', snack: true },
          { name: 'Какигори «блю гавайи»', price: 250, msg: 'Язык стал синим. Дети у соседнего лотка хохочут.', snack: true },
        ],
      },
      kingyo: {
        title: '金魚すくい', sub: 'В голубой ванне мелькают золотые рыбки. Сачок «пои» — бумага на пластиковой рамке.',
        items: [{ name: 'Одна попытка — один бумажный сачок', price: 300, kingyo: true }],
      },
    };
    const s = SH[kind];
    this.audio.shopChime();
    const refresh = () => this.hud.openShop(s.title, s.sub, s.items, this.money, (it) => {
      if (this.money < it.price) return;
      this.addMoney(-it.price);
      if (it.kingyo) this.tryGoldfish();
      else this.hud.toast(it.msg);
      if (it.snack) this.audio.eat();
      if (kind === 'store') this.stamp('dagashi');
      if (SH[kind] && ['tako', 'wata', 'kori', 'kingyo'].includes(kind)) this.stamp('matsuri');
      if (it.sparklers) { this.sparklers += it.sparklers; store.set('sparklers', this.sparklers); }
      if (it.meal) { this.audio.eat(); this.env.time.hour += 0.5; this.stamp('diner'); this.hud.toast('Пока ел, прошло полчаса.'); }
      refresh();
    });
    refresh();
  }
  tryGoldfish() {
    this.kingyoTries = (this.kingyoTries || 0) + 1;
    const luck = 0.2 + 0.15 * this.kingyoTries;
    if (Math.random() < luck) {
      this.kingyoTries = 0;
      this.hud.toast('Поймал! Хозяин пересаживает рыбку в пакетик с водой и завязывает узелком. Дома её ждёт стеклянная чаша.');
      this.stamp('kingyo');
      store.set('kingyo', true);
      this.home.showGoldfish(true);
    } else {
      const fail = ['Бумага намокла и порвалась… Рыбка махнула хвостом и уплыла.', 'Почти! Рыбка выскользнула у самого края.', 'Сачок порвался. Хозяин смеётся: «Ещё разок?»'];
      this.hud.toast(fail[Math.floor(Math.random() * fail.length)]);
    }
  }
  onSit(sp) {
    if (sp.dance) {
      this.hud.toast('Ты встаёшь в круг между тётушкой с веером и мальчиком в синей юкате. Хлоп-хлоп, шаг, ещё шаг… (E — выйти из круга)');
      this.stamp('bon');
      return;
    }
    this.env.time.boost = 6;
    this.hud.toast('Время течёт медленно и лениво… Держи T, чтобы оно бежало быстрее.');
    if (sp.busStop) this.stamp('busstop');
    if (sp.engawa && (this.env.time.hour > 17.5 || this.env.time.hour < 2)) this.stamp('engawa');
    const h = this.env.time.hour;
    if (sp.label.includes('закат') || sp.label.includes('долину')) { if (h > 17.8 && h < 19.5) this.stamp('sunset'); }
  }
  onStand() { this.env.time.boost = 1; }
  sleep() {
    const t = this.env.time, h = t.hour;
    if (h > 5 && h < 18.5) { this.hud.toast('Спать ещё рано. Бабушка зовёт ужинать к семи.'); return; }
    const fade = document.getElementById('fade');
    fade.classList.add('on');
    this.state = 'sleeping';
    this.input.clear();
    setTimeout(() => {
      if (h >= 18.5) t.day++;
      t.hour = 6.4; this.prevHour = 6.4;
      const P = this.player, hp = this.home.homePos;
      if (P.mode === 'sit') P.standUp();
      P.pos.set(hp.x, this.world.groundAt(hp.x, hp.z).h, hp.z);
      P.trans = 1;
      this.state = 'play';
      fade.classList.remove('on');
      this.hud.toast('Доброе утро! Пахнет мисо-супом и мокрой от росы травой. Дети уже бегут к школе на утреннюю радиозарядку.');
      this.stamp('sleep');
    }, 1800);
  }
  lightSparkler() {
    if (this.sparkler.active) return;
    if (this.sparklers <= 0) { this.hud.toast('Бенгальских огней нет — их продают в «Нацумэ сётэн»'); return; }
    if (this.env.time.night < 0.6) { this.hud.toast('Сэнко-ханаби зажигают, когда стемнеет'); return; }
    if (this.player.mode === 'bike') { this.hud.toast('Сначала слезь с велосипеда'); return; }
    this.sparklers--; store.set('sparklers', this.sparklers);
    this.sparkler.light_();
    this.hud.toast(`Шипит, разгорается… (осталось ${this.sparklers})`);
    this.stamp('senko');
  }
  onBusStop(s) {
    const P = this.player;
    if (P.mode === 'sit' && P.sit.busStop && Math.abs(this.traffic.road.poly.nearest(P.sit.x, P.sit.z, 20).s - s) < 15) {
      this.hud.toast('Автобус «なつめ村内線» открывает двери. Водитель вопросительно смотрит… Ты машешь: «Я просто посидеть».');
    }
  }
  onTrainArrive(run) {
    const P = this.player, S = this.world.plan.areas.station;
    const d = Math.hypot(P.pos.x - S.plat[0], P.pos.z - S.plat[1]);
    if (d < 40) { this.stamp('station'); this.hud.toast(`Пин-пон. Поезд на ${run.destRu} стоит у платформы.`); }
  }
  addMoney(v) { this.money += v; this.hud.setMoney(this.money); store.set('money', this.money); }
  stamp(id) {
    if (this.stamps.has(id)) return;
    this.stamps.add(id);
    store.set('stamps', [...this.stamps]);
    const s = STAMPS.find((x) => x.id === id);
    setTimeout(() => this.hud.toast(`Новый штамп в дневнике: 「${s.seal}」 ${s.ru}`), 600);
    this.audio.click();
  }

  // ---------------- per-second checks
  checks() {
    const P = this.player, W = this.world, time = this.env.time, h = time.hour;
    const x = P.pos.x, z = P.pos.z;
    // place titles
    let region = null;
    for (const r of W.plan.regions) {
      if (r.x !== undefined && Math.hypot(r.x - x, r.z - z) < r.r) { region = r; break; }
    }
    const rd = W.plan.riverDist(x, z);
    if (!region && rd < 22) region = W.plan.regions.find((r) => r.river);
    if (!region && W.plan.occAt(x, z) & (F.FIELD | F.ROAD) && W.paddies.some((p) => Math.abs(p.x - x) < 40 && Math.abs(p.z - z) < 40)) region = W.plan.regions.find((r) => r.fields);
    if (region !== this.lastRegion) {
      this.lastRegion = region;
      const now = this.tSec;
      if (region && (this.regionCooldown[region.jp] || -1e9) < now - 90) { this.regionCooldown[region.jp] = now; this.hud.place(region); }
    }
    // stamps
    const A = W.plan.areas;
    if (Math.hypot(A.camphor.x - x, A.camphor.z - z) < 16) this.stamp('camphor');
    if (W.sunflowerFields.some((f) => Math.hypot(f.x - x, f.z - z) < 28)) this.stamp('sunflower');
    if (rd < 16) this.stamp('river');
    if (Math.abs(x - A.school.x) < A.school.hw && Math.abs(z - A.school.z) < A.school.hd) this.stamp('school');
    if (Math.hypot(A.lookout.x - x, A.lookout.z - z) < 16 && h > 17.9 && h < 19.4) this.stamp('sunset');
    if (W.fireflies.u.uOn.value > 0.3 && rd < 30) this.stamp('fireflies');
    if (P.nightRide > 500) this.stamp('night');
    if (P.ridden > 5000) this.stamp('ride');
    if (this.weather.rain > 0.6) this.stamp('rain');
    if (h > 4.4 && h < 6.6 && U.uMist.value.x > 0.015) this.stamp('mist');
    if (W.festival.open && W.festival.near(P.pos)) this.stamp('matsuri');
    if (W.toro.glow > 0.5 && W.toro.nearest(P.pos) < 25) this.stamp('toro');
    store.set('ridden', Math.round(P.ridden));
  }
  timeEvents() {
    const h = this.env.time.hour, ph = this.prevHour;
    this.prevHour = h;
    if (ph === null || h < ph) { if (ph !== null && ph > 23) { /* new day */ } return; }
    const crossed = (x) => ph < x && h >= x;
    const W = this.world;
    if (crossed(17)) {
      const sp = W.speaker;
      if (sp) this.audio.chime(sp.x, sp.y, sp.z);
      this.hud.toast('♪ Из громкоговорителя над деревней плывёт вечерняя мелодия: пора домой.');
      this.stamp('chime');
    }
    if (crossed(18) || crossed(6)) {
      for (let k = 0; k < 3; k++) this.audio.templeBell(600, 60, 520, k * 9);
      this.hud.toast('Где-то за холмами звонит храмовый колокол.');
    }
    if (crossed(20.5)) this.hud.toast('У моста Нацумэ на воду опускают бумажные фонарики — тōро-нагаси. Они поплывут вниз по реке, к морю.');
    if (crossed(18.95)) this.hud.toast('На школьном дворе загорелись фонарики вокруг башни-ягуры: начинаются танцы бон-одори.');
    if (crossed(18.3)) this.hud.toast('На холме у святилища зажглись бумажные фонарики — начинается летний праздник, нацу-мацури.');
    if (crossed(22.2) && this.weather.cloud < 0.3) this.hud.toast('Этой ночью пик Персеид. Если долго смотреть в небо, можно поймать падающую звезду.');
    if (crossed(20) && !this.fireworks.show) {
      this.fireworks.start(150);
      this.hud.toast('Над рекой начинается летний фейерверк — ханаби!');
      this.stamp('hanabi');
    }
    if (this.weather.state && !this.rainToast) { this.rainToast = true; this.hud.toast('Небо темнеет, пахнет пылью и озоном. Кажется, будет ливень.'); }
    if (!this.weather.state) this.rainToast = false;
    if (crossed(7)) { this.addMoney(500); this.hud.toast('Утро. Бабушка оставила на столе 500 иен на карманные расходы.'); }
  }

  // On a slow machine, drop to low quality once, early on, unless the player picked the quality themselves.
  watchPerformance(raw) {
    if (this.perfDone || this.settings.qualityManual || this.settings.quality === 'low') return;
    this.playT = (this.playT || 0) + raw;
    if (this.playT < 3) return; // let shaders compile first
    this.perfT = (this.perfT || 0) + raw; this.perfN = (this.perfN || 0) + 1;
    if (this.perfT < 6) return;
    this.perfDone = true;
    if (this.perfT / this.perfN > 0.045) {
      this.setQuality('low');
      $('setQuality').value = 'low';
      store.set('settings', this.settings);
      this.hud.toast('Картинка стала проще, чтобы игра шла плавнее. Качество можно вернуть в меню (Esc).');
    }
  }

  // ---------------- loop
  frame(now) {
    const raw = (now - (this.last || now)) / 1000;
    const dt = Math.min(0.05, raw);
    this.last = now;
    this.tSec += dt;
    if (this.state === 'loading') { this.renderer.setClearColor(0x0e1530); this.renderer.clear(); return; }
    const P = this.player, time = this.env.time;
    const playing = this.state === 'play' && !this.modal;
    if (playing) {
      this.watchPerformance(raw);
      const fest = this.world.festival;
      const ts = this.world.taiso;
      const bon = this.world.bon;
      time.boost = this.input.down('KeyT') ? 40 : this.fireworks.show ? 0.15 : ts.state === 'playing' && ts.near(P.pos) ? 0.15 : (fest.open && fest.near(P.pos)) || (bon.open && bon.near(P.pos)) || (this.world.toro.active && this.world.toro.nearest(P.pos) < 45) ? 0.4 : P.mode === 'sit' && !P.sit.dance ? 6 : 1;
      P.update(dt, this.tSec, time);
      this.hud.prompt(P.prompt);
      this.hud.speed(P.bike.speed, P.mode === 'bike');
      this.hud.hint(P.mode === 'bike' ? 'W педали · S тормоз · A/D руль · Shift — налечь · R звонок · E слезть' : P.mode === 'sit' ? (P.sit.dance ? 'Мышь — смотреть · E — выйти из круга' : 'Мышь — смотреть · T — быстрее время · E — встать') : 'WASD идти · Shift бег · E действие · M карта · Tab дневник');
      this.checkTimer = (this.checkTimer || 0) + dt;
      if (this.checkTimer > 0.5) { this.checkTimer = 0; this.checks(); }
      this.timeEvents();
    } else if (this.state === 'title') {
      // slow establishing shot behind the title page
      const sp = this.world.shopSpots.store;
      const a = this.tSec * 0.04 + 2.4;
      this.camera.position.set(sp.x + Math.cos(a) * 34, P.pos.y + 11 + Math.sin(this.tSec * 0.1), sp.z + Math.sin(a) * 34);
      this.camera.lookAt(sp.x, P.pos.y + 3, sp.z);
    } else if (this.modal === 'map') this.hud.drawMap(P);
    const envDt = playing || this.state === 'title' ? dt : 0;
    this.env.update(envDt, this.tSec, this.camera, P.pos);
    this.world.update(dt, this.tSec, this.camera.position, time);
    if (this.state === 'play' || this.state === 'title') {
      this.trains.update(this.modal ? 0 : dt, time, this.tSec);
      const pr = this.renderer.getPixelRatio(), hh = this.renderer.domElement.height / pr;
      this.fireworks.update(this.modal ? 0 : dt, this.camera.position, pr, hh);
      this.sparkler.update(this.modal ? 0 : dt, pr, hh);
      this.villagers.update(this.modal ? 0 : dt, time, this.camera.position, this.player);
      this.traffic.update(this.modal ? 0 : dt, time, this.player);
      this.weather.update(this.modal ? 0 : dt, time, this.camera.position);
      this.wildlife.update(this.modal ? 0 : dt, time, this.camera.position, this.player);
      this.home.update(dt, this.tSec, time, this.camera.position);
      this.world.festival.update(this.modal ? 0 : dt, this.tSec, time, this.player);
      this.world.taiso.update(this.modal ? 0 : dt, this.tSec, time, this.player);
      this.world.bon.update(this.modal ? 0 : dt, this.tSec, time, this.player, this.audio);
      this.world.toro.update(this.modal ? 0 : dt, this.tSec, time, this.camera.position);
      this.insects.update(this.modal ? 0 : dt, time, this.camera.position);
    }
    this.hud.clock(time, this.speedLabel(this.settings.timeIdx) + (time.boost > 1 ? ' · ×' + time.boost : ''));
    if (this.state === 'play') this.updateAudio(dt);
    // post fx
    const night = time.night;
    this.bloom.strength = 0.25 + 0.35 * night;
    this.bloom.threshold = 1.0 - 0.12 * night;
    this.grade.uniforms.uTime.value = this.tSec;
    this.grade.uniforms.uNight.value = night;
    if (this.settings.quality === 'low') {
      const r = this.renderer;
      r.autoClear = false; r.clear(); r.render(this.env.skyScene, this.camera); r.clearDepth(); r.render(this.scene, this.camera);
    } else { this.renderer.autoClear = true; this.composer.render(); }
    this.input.endFrame();
  }
  updateAudio(dt) {
    const P = this.player, W = this.world, cam = this.camera.position;
    this.audioEnvT = (this.audioEnvT || 0) - dt;
    if (this.audioEnvT <= 0) { this.audioEnvT = 0.5; this.envCache = W.envAt(cam.x, cam.z); }
    const e = this.envCache;
    const fwd = this._fwd || (this._fwd = new THREE.Vector3());
    this.camera.getWorldDirection(fwd);
    const tmp = [];
    const F = W.festival;
    this.audio.festivalUpdate(F.music, F.center, F.sizzlePos, F.on);
    const B = W.bon;
    this.audio.festivalUpdate(B.music, { x: B.cx, y: B.y0 + 3, z: B.cz }, null, B.on, 'bon');
    const st = W.store;
    if (st) this.audio.tvUpdate(Math.hypot(cam.x - st.tvPos.x, cam.z - st.tvPos.z) < 25 ? st.light : 0, st.tvPos);
    const hm = this.home;
    if (hm?.tvPos) this.audio.tvUpdate(Math.hypot(cam.x - hm.tvPos.x, cam.z - hm.tvPos.z) < 25 ? hm.tvOn * 0.8 : 0, hm.tvPos, 'home');
    this.audio.update(dt, {
      hour: this.env.time.hour, gust: this.env.gust, night: this.env.time.night, rain: this.weather.rain, wet: this.weather.wet,
      cam, fwd, trees: e.trees, paddy: e.paddy, grass: e.grass, indoor: !!W.store?.inside(cam),
      river: W.nearestRiver(cam.x, cam.z), hum: W.nearestHum(cam.x, cam.z),
      bike: { riding: P.mode === 'bike', speed: P.bike.speed, pedaling: P.bike.pedaling, braking: P.bike.braking, surface: P.surface },
      findTree: (r, rmin = 0) => { const a = W.forest.treesNear(cam.x, cam.z, r, tmp).filter((t) => (t.x - cam.x) ** 2 + (t.z - cam.z) ** 2 > rmin * rmin); return a.length ? a[Math.floor(Math.random() * a.length)] : null; },
      findHouse: (r) => { const l = W.plan.lots.filter((l) => Math.abs(l.x - cam.x) < r && Math.abs(l.z - cam.z) < r); return l.length ? { x: l[0].x + (Math.random() - 0.5) * 8, y: l[0].h, z: l[0].z + (Math.random() - 0.5) * 8 } : null; },
      findFurin: (r) => { const f = W.furin.filter((f) => Math.hypot(f.x - cam.x, f.z - cam.z) < r); return f.length ? f[Math.floor(Math.random() * f.length)] : null; },
      findPaddy: (r) => { const p = W.paddies.filter((p) => Math.hypot(p.x - cam.x, p.z - cam.z) < r); if (!p.length) return null; const q = p[Math.floor(Math.random() * p.length)]; return { x: q.x + (Math.random() - 0.5) * q.hw * 2, y: q.y, z: q.z + (Math.random() - 0.5) * q.hd * 2 }; },
      findGrass: (rmin, rmax) => {
        for (let k = 0; k < 6; k++) {
          const a = Math.random() * Math.PI * 2, d = rmin + Math.random() * (rmax - rmin);
          const x = cam.x + Math.cos(a) * d, z = cam.z + Math.sin(a) * d;
          const ix = Math.round((x + 1000) / 2), iz = Math.round((z + 1000) / 2);
          if (W.maskData[(iz * W.maskW + ix) * 4] > 90) return { x, y: W.hm.sample(x, z), z };
        }
        return null;
      },
    });
  }
}

const game = new Game();
const loop = (t) => { requestAnimationFrame(loop); try { game.frame(t); } catch (e) { console.error(e); } };
requestAnimationFrame(loop);
game.load().catch((e) => { console.error(e); $('loadText').textContent = 'Ошибка загрузки: ' + e.message; });
