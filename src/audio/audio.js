// Procedural soundscape. Every sound is synthesised with WebAudio at runtime — the game ships no audio files.

const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const band = (h, a, b, r = 0.5) => ss(a - r, a + r, h) * (1 - ss(b - r, b + r, h));

// original pentatonic evening melody for the village loudspeaker (C D E G A)
const N = { C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0, C5: 523.25, D5: 587.33 };
// festival flute (shinobue) tune in the min'yo scale, in eighth notes; 8 bars, then the drums play on alone
const FUE_N = { D5: 587.33, F5: 698.46, G5: 783.99, A5: 880.0, C6: 1046.5, D6: 1174.66, F6: 1396.91 };
const FUE = [
  ['A5', 2], ['C6', 1], ['D6', 1], ['C6', 2], ['A5', 2], ['G5', 1], ['A5', 1], ['G5', 1], ['F5', 1], ['D5', 4],
  ['F5', 2], ['G5', 1], ['A5', 1], ['C6', 2], ['D6', 1], ['C6', 1], ['A5', 3], ['G5', 1], ['A5', 4],
  ['D6', 2], ['F6', 1], ['D6', 1], ['C6', 2], ['D6', 2], ['C6', 1], ['A5', 1], ['G5', 2], ['A5', 4],
  ['G5', 2], ['F5', 1], ['G5', 1], ['A5', 2], ['C6', 1], ['A5', 1], ['G5', 2], ['F5', 2], ['D5', 4],
];
const MELODY = [
  ['E4', 1], ['G4', 1], ['A4', 1], ['G4', 1], ['E4', 1], ['D4', 1], ['C4', 2],
  ['D4', 1], ['E4', 1], ['G4', 1], ['E4', 1], ['D4', 4],
  ['E4', 1], ['G4', 1], ['A4', 1], ['C5', 1], ['A4', 1], ['G4', 1], ['E4', 2],
  ['D4', 1], ['E4', 1], ['D4', 1], ['C4', 1], ['C4', 4],
];

export class AudioEngine {
  constructor() { this.ctx = null; this.ready = false; this.settings = { vol: 0.8, amb: 1 }; this.voices = []; this.next = {}; }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain(); this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 3.5; comp.attack.value = 0.008; comp.release.value = 0.3;
    const makeup = ctx.createGain(); makeup.gain.value = 1.5;
    this.master.connect(comp).connect(makeup).connect(ctx.destination);
    this.ambOut = ctx.createGain(); this.ambOut.gain.value = this.settings.amb;
    this.ambLP = ctx.createBiquadFilter(); this.ambLP.type = 'lowpass'; this.ambLP.frequency.value = 18000;
    this.ambOut.connect(this.ambLP).connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.revIn = ctx.createGain();
    const rev = ctx.createConvolver(); rev.buffer = this.makeIR(3.4);
    const revOut = ctx.createGain(); revOut.gain.value = 0.55;
    this.revIn.connect(rev).connect(revOut).connect(this.master);
    this.white = this.noise('white', 4); this.pink = this.noise('pink', 4); this.brown = this.noise('brown', 4);
    this.buildBeds();
    this.buildBike();
    this.buildCritters();
    this.master.gain.setTargetAtTime(this.settings.vol, ctx.currentTime + 0.2, 1.2);
    this.ready = true;
  }
  setVolume(v) { this.settings.vol = v; if (this.ready) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1); }
  setAmbience(v) { this.settings.amb = v; if (this.ready) this.ambOut.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1); }
  suspend(s) { if (!this.ctx) return; if (s) this.ctx.suspend(); else this.ctx.resume(); }

  noise(kind, sec) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'white') d[i] = w * 0.5;
        else if (kind === 'pink') {
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.09; b6 = w * 0.115926;
        } else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
      }
    }
    return buf;
  }
  makeIR(sec) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / ctx.sampleRate;
        lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4;
        let v = lp * Math.pow(1 - t / sec, 2.2) * Math.exp(-t * 1.1);
        // a few discrete echoes off the hills
        for (const e of [0.19, 0.37, 0.61]) if (Math.abs(t - e - ch * 0.013) < 0.004) v += (Math.random() - 0.5) * 0.9 * (1 - e);
        d[i] = v;
      }
    }
    return buf;
  }
  loop(buf, dest, rate = 1) {
    const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate;
    s.loopStart = Math.random() * 2; s.start(0, Math.random() * 3); s.connect(dest); return s;
  }
  filt(type, f, q = 1) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  gain(v = 0) { const g = this.ctx.createGain(); g.gain.value = v; return g; }
  osc(type, f) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; }
  panner(x, y, z, ref = 5, roll = 1) {
    const p = this.ctx.createPanner();
    p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = roll; p.maxDistance = 10000;
    this.setPos(p, x, y, z);
    return p;
  }
  setPos(p, x, y, z) {
    if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
  }
  // spatial chain: returns input gain node; auto-disconnects nothing (GC handles finished graphs)
  spot(x, y, z, o = {}) {
    const g = this.gain(o.gain ?? 1);
    const p = this.panner(x, y, z, o.ref ?? 6, o.roll ?? 1);
    g.connect(p); p.connect(o.sfx ? this.sfx : this.ambOut);
    if (o.rev) { const s = this.gain(o.rev); p.connect(s); s.connect(this.revIn); }
    return g;
  }

  // ---------------------------------------------------------------- continuous beds
  buildBeds() {
    const c = this.ctx;
    const B = (this.beds = {});
    // wind
    B.windLP = this.filt('lowpass', 500, 0.5); B.wind = this.gain(0);
    this.loop(this.brown, B.windLP); B.windLP.connect(B.wind).connect(this.ambOut);
    // leaves rustle
    B.leafBP = this.filt('bandpass', 2600, 0.6); B.leaf = this.gain(0);
    this.loop(this.white, B.leafBP, 0.9); B.leafBP.connect(B.leaf).connect(this.ambOut);
    // aburazemi chorus: sizzling noise with fast amplitude modulation, two layers
    const cic = (f, q, am, depth) => {
      const bp = this.filt('bandpass', f, q), bp2 = this.filt('peaking', f * 1.3, 2); bp2.gain.value = 6;
      const amg = this.gain(1 - depth);
      const lfo = this.osc('sine', am); const lg = this.gain(depth); lfo.connect(lg).connect(amg.gain); lfo.start();
      const out = this.gain(0);
      this.loop(this.white, bp, rnd(0.95, 1.05)); bp.connect(bp2).connect(amg).connect(out);
      return { out, lfo };
    };
    B.abura1 = cic(4300, 1.4, 68, 0.6); B.abura2 = cic(5900, 1.8, 94, 0.5);
    const sp = c.createStereoPanner ? c.createStereoPanner() : null;
    if (sp) { sp.pan.value = -0.35; B.abura1.out.connect(sp).connect(this.ambOut); } else B.abura1.out.connect(this.ambOut);
    const sp2 = c.createStereoPanner ? c.createStereoPanner() : null;
    if (sp2) { sp2.pan.value = 0.4; B.abura2.out.connect(sp2).connect(this.ambOut); } else B.abura2.out.connect(this.ambOut);
    // distant hill chorus (minmin wash), slow swells
    B.far = cic(3400, 3, 23, 0.7); B.far.out.connect(this.ambOut);
    const farRev = this.gain(0.6); B.far.out.connect(farRev).connect(this.revIn);
    // night insect bed (many crickets far away)
    B.night1 = cic(4400, 9, 38, 0.85); B.night1.out.connect(this.ambOut);
    B.night2 = cic(5300, 12, 24, 0.9); B.night2.out.connect(this.ambOut);
    // frog chorus far
    B.frog = cic(1500, 3, 13, 0.9); B.frog.out.connect(this.ambOut);
    const frogRev = this.gain(0.5); B.frog.out.connect(frogRev).connect(this.revIn);
    // river
    B.riverLP = this.filt('lowpass', 1500, 0.5); B.riverBP = this.filt('bandpass', 700, 1.4);
    B.river = this.gain(0); B.riverP = this.panner(0, 0, 0, 7, 1.1);
    this.loop(this.pink, B.riverLP); this.loop(this.white, B.riverBP, 0.7);
    B.riverLP.connect(B.river); const rb = this.gain(0.35); B.riverBP.connect(rb).connect(B.river);
    B.river.connect(B.riverP).connect(this.ambOut);
    // vending machine hum
    B.hum = this.gain(0); B.humP = this.panner(0, 0, 0, 1.5, 1.6);
    const h1 = this.osc('sine', 100), h2 = this.osc('sine', 200), h3 = this.osc('triangle', 300);
    const hg2 = this.gain(0.4), hg3 = this.gain(0.08);
    h1.connect(B.hum); h2.connect(hg2).connect(B.hum); h3.connect(hg3).connect(B.hum);
    const fan = this.filt('lowpass', 380, 0.7); const fg = this.gain(0.9); this.loop(this.pink, fan); fan.connect(fg).connect(B.hum);
    h1.start(); h2.start(); h3.start();
    B.hum.connect(B.humP).connect(this.ambOut);
    B.rainHP = this.filt('highpass', 450, 0.5); B.rainLP = this.filt('lowpass', 7500, 0.5); B.rain = this.gain(0);
    this.loop(this.white, B.rainHP, 0.8); B.rainHP.connect(B.rainLP).connect(B.rain).connect(this.ambOut);
    B.rainLow = this.gain(0); B.rainLowLP = this.filt('lowpass', 600, 0.6);
    this.loop(this.pink, B.rainLowLP, 0.9); B.rainLowLP.connect(B.rainLow).connect(this.ambOut);
  }
  buildBike() {
    const K = (this.bikeN = {});
    K.rollLP = this.filt('lowpass', 300, 0.7); K.roll = this.gain(0);
    this.loop(this.brown, K.rollLP); K.rollLP.connect(K.roll).connect(this.sfx);
    K.gravBP = this.filt('bandpass', 1900, 0.8); K.grav = this.gain(0);
    const crackle = this.gain(0.5); const clfo = this.osc('square', 23); const clg = this.gain(0.5); clfo.connect(clg).connect(crackle.gain); clfo.start();
    this.loop(this.white, K.gravBP, 1.1); K.gravBP.connect(crackle).connect(K.grav).connect(this.sfx);
    K.chainBP = this.filt('bandpass', 3300, 3); K.chain = this.gain(0);
    this.loop(this.white, K.chainBP, 1.3); K.chainBP.connect(K.chain).connect(this.sfx);
    K.sq = this.gain(0);
    const so = this.osc('triangle', 2850), vib = this.osc('sine', 7), vg = this.gain(35);
    vib.connect(vg).connect(so.frequency); so.connect(K.sq).connect(this.sfx); so.start(); vib.start();
    K.windRush = this.filt('highpass', 600, 0.5); K.rush = this.gain(0);
    this.loop(this.pink, K.windRush, 1.2); K.windRush.connect(K.rush).connect(this.sfx);
    this.tickT = 0;
    this.tickBuf = (() => { const len = Math.floor(this.ctx.sampleRate * 0.006); const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.18)) + Math.sin(i * 0.9) * 0.4 * Math.exp(-i / (len * 0.3)); return b; })();
  }
  // persistent spatial voices: crickets in the grass, frogs in the paddies
  buildCritters() {
    this.crickets = [];
    for (let i = 0; i < 7; i++) {
      const kind = pick(['suzu', 'suzu', 'matsu', 'koro', 'kane']);
      const f = kind === 'suzu' ? rnd(4100, 4700) : kind === 'matsu' ? rnd(3600, 4100) : kind === 'kane' ? rnd(5200, 5900) : rnd(4600, 5200);
      const o = this.osc('sine', f);
      const am = this.gain(0.5); const lfo = this.osc('square', kind === 'koro' ? 26 : kind === 'kane' ? 17 : 48); const lg = this.gain(0.5);
      lfo.connect(lg).connect(am.gain); lfo.start();
      const env = this.gain(0);
      const p = this.panner(0, 0, 0, 2.5, 1.3);
      o.connect(am).connect(env).connect(p).connect(this.ambOut);
      o.start();
      this.crickets.push({ kind, o, env, p, next: 0, x: 0, z: 0, y: 0, placed: false, vol: rnd(0.12, 0.25) });
    }
    this.frogs = [];
    for (let i = 0; i < 9; i++) {
      const big = Math.random() < 0.2;
      const o = this.osc('square', big ? rnd(380, 520) : rnd(1100, 1700));
      const bp = this.filt('bandpass', big ? 700 : 1900, big ? 2 : 3);
      const am = this.gain(0.5); const lfo = this.osc('square', big ? 18 : rnd(38, 60)); const lg = this.gain(0.5);
      lfo.connect(lg).connect(am.gain); lfo.start();
      const env = this.gain(0);
      const p = this.panner(0, 0, 0, 7, 1.0);
      o.connect(bp).connect(am).connect(env).connect(p).connect(this.ambOut);
      const s = this.gain(0.25); p.connect(s).connect(this.revIn);
      o.start();
      this.frogs.push({ big, o, env, p, next: 0, x: 0, z: 0, y: 0, placed: false, vol: big ? rnd(0.5, 0.8) : rnd(0.3, 0.55) });
    }
  }

  // ---------------------------------------------------------------- per-frame
  // env: {hour, gust, trees(0..1), paddy(0..1), grass(0..1), river:{x,y,z,d}, hum:{x,y,z,d}, night, listener, bike:{...}, indoor, findTree(), findPaddy(), findGrass(), houses()}
  update(dt, env) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime, B = this.beds, h = env.hour;
    const L = c.listener, cam = env.cam;
    if (L.positionX) {
      L.positionX.value = cam.x; L.positionY.value = cam.y; L.positionZ.value = cam.z;
      L.forwardX.value = env.fwd.x; L.forwardY.value = env.fwd.y; L.forwardZ.value = env.fwd.z;
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else { L.setPosition(cam.x, cam.y, cam.z); L.setOrientation(env.fwd.x, env.fwd.y, env.fwd.z, 0, 1, 0); }
    const set = (param, v, tc = 0.6) => param.setTargetAtTime(v, t, tc);
    this.lastCam = cam;
    const gust = env.gust;
    set(B.wind.gain, (0.05 + 0.17 * gust) * (env.indoor ? 0.3 : 1), 0.8);
    set(B.windLP.frequency, 260 + 520 * gust, 0.8);
    set(B.leaf.gain, gust * gust * 0.12 * (0.2 + env.trees), 0.5);
    const rain = env.rain || 0;
    set(B.rain.gain, rain * 0.5, 1.2); set(B.rainLow.gain, rain * 0.35, 1.2);
    const dry = 1 - rain;
    const abura = band(h, 7.2, 17.4, 1.1) * dry, minmin = band(h, 8.3, 15.8, 1.0) * dry;
    const higu = Math.max(band(h, 4.5, 6.4, 0.35), band(h, 17.5, 19.4, 0.35));
    const cricket = Math.max(ss(18.4, 19.6, h), 1 - ss(3.8, 5.0, h));
    const frog = Math.min(1, Math.max(ss(18.0, 19.3, h), 1 - ss(2.5, 4.2, h)) + rain * 0.7 + (env.wet || 0) * 0.3);
    set(B.abura1.out.gain, abura * (0.28 + 0.85 * env.trees), 1.5);
    set(B.abura2.out.gain, abura * (0.14 + 0.45 * env.trees), 1.5);
    set(B.far.out.gain, Math.max(abura * 0.6, higu * 0.4) * 0.5, 2);
    set(B.night1.out.gain, cricket * (0.3 + 0.8 * env.grass), 2);
    set(B.night2.out.gain, cricket * 0.35, 2);
    set(B.frog.out.gain, frog * (0.08 + 0.85 * env.paddy), 2);
    if (env.river) { this.setPos(B.riverP, env.river.x, env.river.y, env.river.z); set(B.river.gain, 0.55 * ss(70, 8, env.river.d), 0.4); }
    if (env.hum) { this.setPos(B.humP, env.hum.x, env.hum.y, env.hum.z); set(B.hum.gain, 0.03 * ss(14, 2, env.hum.d), 0.3); }
    set(this.ambLP.frequency, env.indoor ? 1800 : 18000, 0.3);
    this.updateBikeSound(env.bike, t);
    // scheduled critters
    const sch = (key, rate, fn) => { if (!this.next[key]) this.next[key] = t + rnd(1, 5); if (t > this.next[key]) { this.next[key] = t + rate * rnd(0.5, 1.5); fn(); } };
    if (minmin > 0.05) sch('minmin', 9 / minmin, () => { const tr = env.findTree(45); if (tr) this.minmin(tr.x, tr.y + rnd(3, 7), tr.z); });
    if (higu > 0.05) sch('higu', 5.5 / higu, () => { const tr = env.findTree(90, 20); if (tr) this.higurashi(tr.x, tr.y + rnd(4, 9), tr.z); });
    const kuma = band(h, 5.8, 10.6, 0.6) * dry, tsuku = band(h, 12.5, 17.4, 0.8) * dry;
    if (kuma > 0.1) sch('kuma', 9 / kuma, () => { const tr = env.findTree(40); if (tr) this.kumazemi(tr.x, tr.y + rnd(3, 7), tr.z); });
    if (tsuku > 0.1) sch('tsuku', 24 / tsuku, () => { const tr = env.findTree(60, 8); if (tr) this.tsukutsuku(tr.x, tr.y + rnd(3, 8), tr.z); });
    if (abura > 0.1) sch('abura', 7 / abura, () => { const tr = env.findTree(30); if (tr) this.aburazemi(tr.x, tr.y + rnd(2, 6), tr.z); });
    const morning = band(h, 4.9, 9.5, 0.4), dusk = band(h, 16.6, 19.0, 0.4), day = band(h, 6, 18, 1);
    if (morning > 0.1 || day > 0.5) sch('sparrow', 6 / Math.max(morning, day * 0.25), () => { const p = env.findHouse(40); if (p) this.sparrow(p.x, p.y + rnd(3, 6), p.z); });
    if (morning + dusk > 0.1) sch('crow', 16 / (morning * 0.5 + dusk), () => this.crow(cam.x + rnd(-150, 150), cam.y + rnd(20, 50), cam.z + rnd(-150, 150)));
    if (band(h, 9, 16, 0.5) > 0.1) sch('kite', 55, () => this.kite(cam.x + rnd(-120, 120), cam.y + rnd(50, 90), cam.z + rnd(-120, 120)));
    if (morning > 0.1) sch('uguisu', 22 / morning, () => { const tr = env.findTree(120, 40); if (tr) this.uguisu(tr.x, tr.y + 5, tr.z); });
    if (env.night > 0.8 && (h > 21 || h < 3)) sch('dog', 70, () => this.dog(cam.x + rnd(-200, 200), cam.y, cam.z + rnd(-200, 200)));
    // furin on gusts
    if (gust > 0.62) sch('furin', 2.2, () => { const f = env.findFurin(30); if (f) this.furin(f.x, f.y, f.z); });
    this.updateCrickets(env, cricket, t);
    this.updateFrogs(env, frog, t);
  }
  updateCrickets(env, level, t) {
    for (const v of this.crickets) {
      const d = Math.hypot(v.x - env.cam.x, v.z - env.cam.z);
      if (!v.placed || d > 28) {
        const p = env.findGrass(4, 20);
        if (p) { v.x = p.x; v.y = p.y + 0.1; v.z = p.z; v.placed = true; this.setPos(v.p, v.x, v.y, v.z); }
      }
      if (level < 0.05 || !v.placed) continue;
      if (t + 0.25 > v.next) {
        const s = Math.max(v.next, t + 0.02), g = v.env.gain, A = v.vol * level;
        if (v.kind === 'suzu') { g.setValueAtTime(0, s); g.linearRampToValueAtTime(A, s + 0.05); g.setValueAtTime(A, s + 0.32); g.linearRampToValueAtTime(0, s + 0.42); v.next = s + rnd(0.7, 1.6); }
        else if (v.kind === 'matsu') { for (const [a, b] of [[0, 0.05], [0.12, 0.17], [0.28, 0.58]]) { g.setValueAtTime(0, s + a); g.linearRampToValueAtTime(A, s + a + 0.01); g.setValueAtTime(A, s + b); g.linearRampToValueAtTime(0, s + b + 0.02); } v.next = s + rnd(1.2, 2.4); }
        else if (v.kind === 'kane') { for (let k = 0; k < 3; k++) { g.setValueAtTime(0, s + k * 0.22); g.linearRampToValueAtTime(A, s + k * 0.22 + 0.01); g.exponentialRampToValueAtTime(0.0005, s + k * 0.22 + 0.18); } v.next = s + rnd(1.6, 3.2); }
        else { g.setValueAtTime(0, s); g.linearRampToValueAtTime(A * 0.8, s + 0.03); g.setValueAtTime(A * 0.8, s + 0.45); g.linearRampToValueAtTime(0, s + 0.55); v.next = s + rnd(0.6, 1.2); }
      }
    }
  }
  updateFrogs(env, level, t) {
    for (const v of this.frogs) {
      const d = Math.hypot(v.x - env.cam.x, v.z - env.cam.z);
      if (!v.placed || d > 75) {
        const p = env.findPaddy(60);
        if (p) { v.x = p.x; v.y = p.y + 0.1; v.z = p.z; v.placed = true; this.setPos(v.p, v.x, v.y, v.z); } else v.placed = false;
      }
      if (level < 0.05 || !v.placed) continue;
      if (t + 0.3 > v.next) {
        const s = Math.max(v.next, t + 0.02), g = v.env.gain, A = v.vol * level;
        const n = v.big ? 2 : Math.floor(rnd(3, 9)), per = v.big ? 0.6 : rnd(0.1, 0.14), on = v.big ? 0.4 : 0.06;
        for (let k = 0; k < n; k++) { const a = s + k * per; g.setValueAtTime(0, a); g.linearRampToValueAtTime(A, a + 0.01); g.setValueAtTime(A, a + on); g.linearRampToValueAtTime(0, a + on + 0.02); }
        v.next = s + n * per + rnd(0.6, 3.5);
      }
    }
  }
  updateBikeSound(b, t) {
    const K = this.bikeN;
    const set = (p, v, tc = 0.08) => p.setTargetAtTime(v, t, tc);
    if (!b || !b.riding) { set(K.roll.gain, 0); set(K.grav.gain, 0); set(K.chain.gain, 0); set(K.sq.gain, 0); set(K.rush.gain, 0); return; }
    const v = Math.abs(b.speed);
    const paved = b.surface === 'asphalt' || b.surface === 'concrete' || b.surface === 'wood';
    set(K.roll.gain, Math.min(0.2, v * 0.022) * (paved ? 1 : 0.6));
    set(K.rollLP.frequency, 180 + v * 70);
    set(K.grav.gain, paved ? 0 : Math.min(0.25, v * 0.035) * (b.surface === 'grass' ? 0.4 : 1));
    set(K.chain.gain, b.pedaling * Math.min(0.012, v * 0.003));
    set(K.sq.gain, b.braking && v > 1 ? Math.min(0.035, v * 0.006) : 0, 0.05);
    set(K.rush.gain, Math.max(0, v - 3) * 0.006);
    // freewheel ticking when coasting
    if (!b.pedaling && v > 0.4) {
      const rate = v / (2 * Math.PI * 0.33) * 18;
      if (this.tickT < t) this.tickT = t;
      while (this.tickT < t + 0.08) {
        const s = this.ctx.createBufferSource(); s.buffer = this.tickBuf; s.playbackRate.value = rnd(0.9, 1.1);
        const g = this.gain(0.06 + Math.min(0.05, v * 0.007)); s.connect(g).connect(this.sfx); s.start(this.tickT);
        this.tickT += 1 / rate;
      }
    } else this.tickT = t;
  }

  // ---------------------------------------------------------------- creatures
  minmin(x, y, z) {
    const c = this.ctx, t0 = c.currentTime + 0.05;
    const out = this.spot(x, y, z, { gain: 1, ref: 7, rev: 0.25 });
    const o = this.osc('sawtooth', 520);
    const f1 = this.filt('bandpass', 1900, 3.5), f2 = this.filt('bandpass', 4600, 2);
    const am = this.gain(0.55); const lfo = this.osc('sine', rnd(105, 135)); const lg = this.gain(0.45); lfo.connect(lg).connect(am.gain);
    const env = this.gain(0);
    o.connect(f1).connect(am); o.connect(f2).connect(am); am.connect(env).connect(out);
    const n = Math.floor(rnd(5, 9)), per = rnd(0.38, 0.46), A = rnd(0.45, 0.75);
    const g = env.gain;
    g.setValueAtTime(0, t0); g.linearRampToValueAtTime(A * 0.45, t0 + 0.9);
    o.frequency.setValueAtTime(480, t0); o.frequency.linearRampToValueAtTime(540, t0 + 0.9);
    let ts = t0 + 0.9;
    for (let i = 0; i < n; i++) {
      const acc = 1 - (i / n) * 0.25;
      o.frequency.setValueAtTime(520, ts); o.frequency.linearRampToValueAtTime(650, ts + 0.12 * acc); o.frequency.linearRampToValueAtTime(560, ts + 0.32 * acc);
      f1.frequency.setValueAtTime(1600, ts); f1.frequency.linearRampToValueAtTime(2600, ts + 0.12 * acc); f1.frequency.linearRampToValueAtTime(1800, ts + 0.32 * acc);
      g.setValueAtTime(A * 0.4, ts); g.linearRampToValueAtTime(A, ts + 0.06); g.linearRampToValueAtTime(A * 0.9, ts + 0.26 * acc); g.linearRampToValueAtTime(A * 0.35, ts + per * acc);
      ts += per * acc;
    }
    o.frequency.linearRampToValueAtTime(600, ts + 0.3); g.linearRampToValueAtTime(A * 0.8, ts + 0.3); g.linearRampToValueAtTime(0, ts + 1.6);
    o.start(t0); lfo.start(t0); o.stop(ts + 1.7); lfo.stop(ts + 1.7);
  }
  aburazemi(x, y, z) {
    const c = this.ctx, t0 = c.currentTime + 0.05, dur = rnd(4, 9);
    const out = this.spot(x, y, z, { ref: 6, rev: 0.15 });
    const src = c.createBufferSource(); src.buffer = this.white; src.loop = true; src.playbackRate.value = rnd(0.9, 1.1);
    const bp = this.filt('bandpass', rnd(4000, 5200), 1.6);
    const am = this.gain(0.4); const lfo = this.osc('sawtooth', rnd(60, 90)); const lg = this.gain(0.6); lfo.connect(lg).connect(am.gain);
    const env = this.gain(0);
    src.connect(bp).connect(am).connect(env).connect(out);
    const A = rnd(0.7, 1.1), g = env.gain;
    g.setValueAtTime(0, t0); g.linearRampToValueAtTime(A, t0 + 1.2); g.setValueAtTime(A, t0 + dur); g.linearRampToValueAtTime(0, t0 + dur + 1.5);
    src.start(t0, rnd(0, 2)); lfo.start(t0); src.stop(t0 + dur + 1.6); lfo.stop(t0 + dur + 1.6);
  }
  // kumazemi: the big black cicada of summer mornings, a loud pulsing "shaa-shaa-shaa"
  kumazemi(x, y, z) {
    const c = this.ctx, t0 = c.currentTime + 0.05;
    const out = this.spot(x, y, z, { ref: 7, rev: 0.2 });
    const src = c.createBufferSource(); src.buffer = this.white; src.loop = true; src.playbackRate.value = rnd(0.92, 1.08);
    const bp = this.filt('bandpass', rnd(4300, 5300), 1.3), pk = this.filt('peaking', 3200, 1.5); pk.gain.value = 5;
    const am = this.gain(0.5); const lfo = this.osc('sawtooth', rnd(110, 140)); const lg = this.gain(0.5); lfo.connect(lg).connect(am.gain);
    const env = this.gain(0);
    src.connect(bp).connect(pk).connect(am).connect(env).connect(out);
    const n = Math.floor(rnd(10, 22)), A = rnd(0.5, 0.85), g = env.gain;
    let ts = t0, per = rnd(0.34, 0.42);
    g.setValueAtTime(0, t0);
    for (let i = 0; i < n; i++) {
      const k = Math.min(1, (i + 2) / 5) * (1 - Math.max(0, (i - n + 4) / 5));
      g.setValueAtTime(A * 0.06 * k, ts); g.linearRampToValueAtTime(A * k, ts + 0.035); g.linearRampToValueAtTime(A * 0.65 * k, ts + per * 0.55); g.linearRampToValueAtTime(A * 0.06 * k, ts + per * 0.95);
      ts += per; per *= 0.995;
    }
    g.linearRampToValueAtTime(0, ts + 0.3);
    src.start(t0, rnd(0, 2)); lfo.start(t0); src.stop(ts + 0.4); lfo.stop(ts + 0.4);
  }
  // tsukutsukuboshi: "jiii... o-shii tsuku-tsuku, o-shii tsuku-tsuku... ui-oosu, ui-oosu... jiii"
  tsukutsuku(x, y, z) {
    const c = this.ctx, t0 = c.currentTime + 0.05;
    const out = this.spot(x, y, z, { ref: 7, rev: 0.3 });
    const o = this.osc('sawtooth', 390);
    const hp = this.filt('highpass', 3600, 0.8), f1 = this.filt('bandpass', 5200, 3), f2 = this.filt('bandpass', 7400, 2.2);
    const am = this.gain(0.5); const lfo = this.osc('sine', rnd(150, 175)); const lg = this.gain(0.5); lfo.connect(lg).connect(am.gain);
    const env = this.gain(0);
    o.connect(hp); hp.connect(f1).connect(am); hp.connect(f2).connect(am); am.connect(env).connect(out);
    const A = rnd(0.5, 0.8), g = env.gain, F = f1.frequency;
    g.setValueAtTime(0, t0); g.linearRampToValueAtTime(A * 0.55, t0 + 0.8);
    let ts = t0 + 1.4;
    const n = Math.floor(rnd(9, 17));
    let per = 0.44;
    for (let i = 0; i < n; i++) {
      // o-shii
      F.setValueAtTime(4500, ts); F.linearRampToValueAtTime(5700, ts + 0.12);
      g.setValueAtTime(A * 0.3, ts); g.linearRampToValueAtTime(A * 0.95, ts + 0.05); g.linearRampToValueAtTime(A * 0.7, ts + 0.13);
      // tsu-ku
      for (const off of [0.15, 0.25]) {
        F.setValueAtTime(5400, ts + off); F.linearRampToValueAtTime(6000, ts + off + 0.03);
        g.linearRampToValueAtTime(A * 0.12, ts + off); g.linearRampToValueAtTime(A, ts + off + 0.02); g.linearRampToValueAtTime(A * 0.25, ts + off + 0.07);
      }
      g.linearRampToValueAtTime(A * 0.18, ts + per * 0.95);
      ts += per; per = Math.max(0.36, per * 0.988);
    }
    for (let i = 0; i < 4; i++) {
      // ui-oosu
      F.setValueAtTime(4800, ts); F.linearRampToValueAtTime(6300, ts + 0.18); F.linearRampToValueAtTime(4700, ts + 0.5);
      g.setValueAtTime(A * 0.2, ts); g.linearRampToValueAtTime(A * 0.85, ts + 0.15); g.linearRampToValueAtTime(A * 0.3, ts + 0.52);
      ts += 0.56;
    }
    g.linearRampToValueAtTime(A * 0.5, ts + 0.3); g.linearRampToValueAtTime(0, ts + 1.6);
    o.start(t0); lfo.start(t0); o.stop(ts + 1.7); lfo.stop(ts + 1.7);
  }
  higurashi(x, y, z) {
    const c = this.ctx, t0 = c.currentTime + 0.05;
    const out = this.spot(x, y, z, { ref: 10, roll: 0.7, rev: 0.75 });
    const o = this.osc('sine', 4500), o2 = this.osc('sine', 9000);
    const g2 = this.gain(0.18); o2.connect(g2);
    const am = this.gain(0.5); const ring = this.osc('sine', rnd(170, 210)); const rg = this.gain(0.5); ring.connect(rg).connect(am.gain);
    const env = this.gain(0);
    o.connect(am); g2.connect(am); am.connect(env).connect(out);
    const n = Math.floor(rnd(18, 34)), f0 = rnd(4200, 4900), A = rnd(0.25, 0.4);
    let tp = t0, iv = 0.105;
    const g = env.gain;
    g.setValueAtTime(0, t0);
    for (let i = 0; i < n; i++) {
      const k = i / n;
      const amp = A * Math.min(1, (i + 1) / 3) * (1 - k * 0.8);
      const f = f0 * (1 - 0.07 * k);
      o.frequency.setValueAtTime(f * 0.93, tp); o.frequency.linearRampToValueAtTime(f, tp + 0.02); o.frequency.linearRampToValueAtTime(f * 0.95, tp + 0.08);
      o2.frequency.setValueAtTime(f * 1.86, tp); o2.frequency.linearRampToValueAtTime(f * 2, tp + 0.02);
      g.setValueAtTime(0.0001, tp); g.linearRampToValueAtTime(amp, tp + 0.008); g.exponentialRampToValueAtTime(Math.max(amp * 0.05, 0.0001), tp + iv * 0.85);
      tp += iv; iv += 0.0025 + rnd(0, 0.002);
    }
    o.start(t0); o2.start(t0); ring.start(t0); const end = tp + 0.3; o.stop(end); o2.stop(end); ring.stop(end);
  }
  sparrow(x, y, z) {
    const c = this.ctx; let t = c.currentTime + 0.05;
    const out = this.spot(x, y, z, { ref: 5, rev: 0.1 });
    const n = Math.floor(rnd(2, 6));
    for (let i = 0; i < n; i++) {
      const o = this.osc('sine', 4000), g = this.gain(0);
      o.connect(g).connect(out);
      const f = rnd(3600, 5200), d = rnd(0.05, 0.09);
      o.frequency.setValueAtTime(f * 0.8, t); o.frequency.linearRampToValueAtTime(f * 1.2, t + d * 0.4); o.frequency.linearRampToValueAtTime(f, t + d);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + d);
      o.start(t); o.stop(t + d + 0.02);
      t += d + rnd(0.05, 0.22);
    }
  }
  crow(x, y, z) {
    const c = this.ctx; let t = c.currentTime + 0.05;
    const out = this.spot(x, y, z, { ref: 18, roll: 0.8, rev: 0.5 });
    const n = Math.floor(rnd(2, 5));
    for (let i = 0; i < n; i++) {
      const o = this.osc('sawtooth', rnd(480, 560));
      const f1 = this.filt('bandpass', 1150, 1.6), f2 = this.filt('bandpass', 2400, 2.5);
      const g = this.gain(0);
      const ns = c.createBufferSource(); ns.buffer = this.white; ns.loop = true; const nf = this.filt('bandpass', 1500, 1.2); const ng = this.gain(0.35);
      o.connect(f1).connect(g); o.connect(f2).connect(g); ns.connect(nf).connect(ng).connect(g); g.connect(out);
      const d = rnd(0.3, 0.42);
      o.frequency.setValueAtTime(o.frequency.value, t); o.frequency.linearRampToValueAtTime(o.frequency.value * 0.86, t + d);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.4, t + 0.04); g.gain.setValueAtTime(0.38, t + d * 0.6); g.gain.linearRampToValueAtTime(0, t + d);
      o.start(t); ns.start(t, rnd(0, 2)); o.stop(t + d + 0.05); ns.stop(t + d + 0.05);
      t += d + rnd(0.22, 0.45);
    }
  }
  kite(x, y, z) {
    const c = this.ctx, t = c.currentTime + 0.05;
    const out = this.spot(x, y, z, { ref: 30, roll: 0.6, rev: 0.6 });
    const o = this.osc('sine', 2600), g = this.gain(0);
    const lfo = this.osc('sine', 13), lg = this.gain(0); lfo.connect(lg).connect(o.frequency);
    o.connect(g).connect(out);
    o.frequency.setValueAtTime(2500, t); o.frequency.linearRampToValueAtTime(3150, t + 0.75);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.15, t + 0.1); g.gain.setValueAtTime(0.15, t + 0.7); g.gain.linearRampToValueAtTime(0.03, t + 0.82);
    o.frequency.setValueAtTime(3050, t + 0.85); o.frequency.linearRampToValueAtTime(2250, t + 2.3);
    lg.gain.setValueAtTime(0, t + 0.85); lg.gain.linearRampToValueAtTime(260, t + 1.0);
    g.gain.linearRampToValueAtTime(0.13, t + 0.95); g.gain.linearRampToValueAtTime(0.0, t + 2.35);
    o.start(t); lfo.start(t); o.stop(t + 2.5); lfo.stop(t + 2.5);
  }
  uguisu(x, y, z) {
    const c = this.ctx, t = c.currentTime + 0.05;
    const out = this.spot(x, y, z, { ref: 20, roll: 0.7, rev: 0.6 });
    const o = this.osc('sine', 1150), g = this.gain(0);
    o.connect(g).connect(out);
    const F = o.frequency, A = g.gain;
    F.setValueAtTime(1100, t); F.linearRampToValueAtTime(1320, t + 1.3);
    A.setValueAtTime(0, t); A.linearRampToValueAtTime(0.13, t + 0.35); A.setValueAtTime(0.13, t + 1.2); A.linearRampToValueAtTime(0, t + 1.35);
    const notes = [[1.5, 0.08, 2150, 2200], [1.62, 0.1, 2950, 2700], [1.78, 0.38, 2650, 2350]];
    for (const [s, d, fa, fb] of notes) { F.setValueAtTime(fa, t + s); F.linearRampToValueAtTime(fb, t + s + d); A.setValueAtTime(0, t + s); A.linearRampToValueAtTime(0.14, t + s + 0.015); A.setValueAtTime(0.13, t + s + d * 0.7); A.linearRampToValueAtTime(0, t + s + d); }
    o.start(t); o.stop(t + 2.3);
  }
  dog(x, y, z) {
    const c = this.ctx; let t = c.currentTime + 0.05;
    const out = this.spot(x, y, z, { ref: 25, roll: 0.8, rev: 0.6 });
    for (let i = 0; i < Math.floor(rnd(2, 4)); i++) {
      const o = this.osc('sawtooth', rnd(380, 450)), f = this.filt('bandpass', 900, 1.5), g = this.gain(0);
      o.connect(f).connect(g).connect(out);
      o.frequency.setValueAtTime(o.frequency.value * 1.2, t); o.frequency.exponentialRampToValueAtTime(o.frequency.value * 0.7, t + 0.16);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.start(t); o.stop(t + 0.2); t += rnd(0.28, 0.4);
    }
  }
  furin(x, y, z) {
    const c = this.ctx; let t = c.currentTime + 0.03;
    const out = this.spot(x, y, z, { ref: 3, roll: 1.2, rev: 0.35 });
    const f0 = rnd(2400, 3100);
    for (let k = 0; k < Math.floor(rnd(1, 4)); k++) {
      [[1, 1, 1.8], [2.74, 0.45, 1.0], [5.07, 0.25, 0.5], [8.0, 0.1, 0.3]].forEach(([r, a, d]) => {
        if (f0 * r > 16000) return;
        const o = this.osc('sine', f0 * r * rnd(0.998, 1.002)), g = this.gain(0);
        o.connect(g).connect(out);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.1 * a, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0002, t + d);
        o.start(t); o.stop(t + d + 0.05);
      });
      t += rnd(0.12, 0.35);
    }
  }

  // ---------------------------------------------------------------- one-shots (non-spatial)
  metal(t, partials, dest, amp = 1) {
    for (const [f, a, d] of partials) {
      const o = this.osc('sine', f), g = this.gain(0);
      o.connect(g).connect(dest);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a * amp, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.start(t); o.stop(t + d + 0.02);
    }
  }
  bell() {
    if (!this.ready) return;
    const t0 = this.ctx.currentTime + 0.01;
    const P = [[2340, 0.16, 0.7], [3990, 0.09, 0.45], [5630, 0.05, 0.3], [7870, 0.02, 0.18]];
    for (const burst of [0, 0.36]) for (let k = 0; k < 8; k++) this.metal(t0 + burst + k * 0.032, P, this.sfx, Math.pow(0.82, k));
  }
  click() { if (!this.ready) return; this.metal(this.ctx.currentTime, [[3200, 0.04, 0.05]], this.sfx); }
  burst(t, f, q, dur, amp, dest = this.sfx, type = 'bandpass') {
    const s = this.ctx.createBufferSource(); s.buffer = this.white; s.loop = true;
    const fl = this.filt(type, f, q), g = this.gain(0);
    s.connect(fl).connect(g).connect(dest);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.start(t, Math.random() * 3); s.stop(t + dur + 0.02);
  }
  thump(t, f0, f1, dur, amp, dest = this.sfx) {
    const o = this.osc('sine', f0), g = this.gain(0);
    o.connect(g).connect(dest);
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }
  step(surface, k = 0.6) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + 0.005, a = k * rnd(0.8, 1.1) * 2.6;
    switch (surface) {
      case 'gravel': case 'dirt': for (let i = 0; i < 4; i++) this.burst(t + i * rnd(0.008, 0.02), rnd(1800, 3200), 0.9, 0.05, 0.07 * a); this.thump(t, 110, 60, 0.06, 0.06 * a); break;
      case 'grass': case 'tall': this.burst(t, 1100, 0.6, 0.12, 0.05 * a, this.sfx, 'lowpass'); this.burst(t + 0.02, 4200, 0.8, 0.08, 0.025 * a); break;
      case 'paddy': case 'water': this.burst(t, 700, 0.8, 0.22, 0.09 * a, this.sfx, 'lowpass'); this.burst(t + 0.04, 2200, 1.2, 0.15, 0.04 * a); break;
      case 'wood': this.thump(t, 160, 90, 0.09, 0.14 * a); this.burst(t, 2400, 1.5, 0.03, 0.04 * a); break;
      case 'stone': this.burst(t, 2600, 1.4, 0.035, 0.08 * a); this.thump(t, 140, 80, 0.05, 0.07 * a); break;
      default: this.burst(t, 1300, 1.0, 0.045, 0.08 * a); this.thump(t, 120, 70, 0.05, 0.08 * a);
    }
  }
  kickstand() { if (!this.ready) return; const t = this.ctx.currentTime; this.burst(t, 3000, 2, 0.04, 0.12); this.burst(t + 0.09, 2600, 2, 0.05, 0.1); this.thump(t + 0.09, 150, 70, 0.08, 0.1); }
  bump(k) { if (!this.ready) return; const t = this.ctx.currentTime; this.thump(t, 95, 45, 0.18, 0.35 * k); this.burst(t, 600, 0.8, 0.12, 0.2 * k, this.sfx, 'lowpass'); this.metal(t + 0.01, [[2340, 0.02 * k, 0.4]], this.sfx); }
  vending() {
    if (!this.ready) return;
    const t = this.ctx.currentTime + 0.05;
    for (const d of [0, 0.2, 0.36]) { this.metal(t + d, [[4300, 0.05, 0.08], [6100, 0.03, 0.05]], this.sfx); this.burst(t + d, 5000, 2, 0.02, 0.03); }
    this.thump(t + 0.62, 1350, 1350, 0.1, 0.05);
    this.burst(t + 1.05, 380, 0.7, 0.16, 0.35, this.sfx, 'lowpass'); this.thump(t + 1.05, 150, 50, 0.14, 0.3);
    this.burst(t + 1.12, 950, 3, 0.25, 0.06);
    this.burst(t + 1.9, 2600, 0.5, 0.2, 0.12, this.sfx, 'highpass'); this.burst(t + 1.88, 3800, 3, 0.015, 0.1);
  }
  coinBox() {
    if (!this.ready) return;
    const t = this.ctx.currentTime + 0.05;
    for (const d of [0, 0.07, 0.15]) this.burst(t + d, 1300, 2.5, 0.05, 0.09);
    const sx = this.revIn;
    for (let k = 0; k < 14; k++) this.metal(t + 0.7 + k * rnd(0.03, 0.07), [[rnd(4000, 4600), 0.025, 0.25], [rnd(6000, 7000), 0.015, 0.18]], this.sfx);
    for (const d of [1.8, 2.25]) { this.burst(t + d, 1700, 0.7, 0.06, 0.32); this.burst(t + d, 1700, 0.7, 0.06, 0.25, sx); }
  }
  shopChime() { if (!this.ready) return; const t = this.ctx.currentTime; this.metal(t, [[1318, 0.06, 0.9], [2636, 0.015, 0.4]], this.sfx); this.metal(t + 0.42, [[1046, 0.06, 1.1], [2092, 0.015, 0.5]], this.sfx); }
  eat() { if (!this.ready) return; const t = this.ctx.currentTime; for (let i = 0; i < 6; i++) this.burst(t + i * 0.25, 900, 1, 0.08, 0.05); }

  // ---------------------------------------------------------------- train
  trainStart() {
    if (!this.ready) return;
    if (!this.trainN) {
      const T = (this.trainN = {});
      T.p = this.panner(0, -500, 0, 14, 0.9);
      T.out = this.gain(1); T.out.connect(T.p).connect(this.ambOut);
      const rs = this.gain(0.35); T.p.connect(rs).connect(this.revIn);
      T.rumbleLP = this.filt('lowpass', 200, 0.7); T.rumble = this.gain(0);
      this.loop(this.brown, T.rumbleLP); T.rumbleLP.connect(T.rumble).connect(T.out);
      T.eng = this.osc('sawtooth', 46); T.engLP = this.filt('lowpass', 320, 1.2); T.engG = this.gain(0);
      const am = this.gain(0.6); const lfo = this.osc('sine', 9); const lg = this.gain(0.4); lfo.connect(lg).connect(am.gain);
      T.eng.connect(T.engLP).connect(am).connect(T.engG).connect(T.out); T.eng.start(); lfo.start();
      T.sq = this.osc('triangle', 3300); const vib = this.osc('sine', 5.5), vg = this.gain(60); vib.connect(vg).connect(T.sq.frequency);
      T.sqG = this.gain(0); T.sq.connect(T.sqG).connect(T.out); T.sq.start(); vib.start();
    }
  }
  trainUpdate(pos, v, braking, dwell) {
    const T = this.trainN; if (!T) return;
    const t = this.ctx.currentTime;
    this.setPos(T.p, pos.x, pos.y, pos.z);
    T.rumble.gain.setTargetAtTime(Math.min(0.5, 0.02 + v * 0.028), t, 0.3);
    T.rumbleLP.frequency.setTargetAtTime(120 + v * 12, t, 0.3);
    T.engG.gain.setTargetAtTime(dwell ? 0.09 : 0.06 + Math.min(0.1, v * 0.006), t, 0.4);
    T.eng.frequency.setTargetAtTime(dwell ? 38 : 44 + v * 2.2, t, 0.5);
    T.sqG.gain.setTargetAtTime(braking ? 0.035 : 0, t, 0.15);
  }
  trainStop() { const T = this.trainN; if (!T) return; const t = this.ctx.currentTime; for (const g of [T.rumble, T.engG, T.sqG]) g.gain.setTargetAtTime(0, t, 0.5); }
  trainClack(pos, v) {
    if (!this.ready) return;
    const out = this.spot(pos.x, pos.y, pos.z, { ref: 10, roll: 0.9, rev: 0.2 });
    const t = this.ctx.currentTime + 0.01, gap = Math.min(0.35, 2.1 / Math.max(v, 1));
    for (const d of [0, gap]) { this.burst(t + d, 900, 1.2, 0.06, 0.25, out); this.thump(t + d, 140, 70, 0.07, 0.25, out); }
  }
  trainHorn(pos, dur = 1) {
    if (!this.ready) return;
    const out = this.spot(pos.x, pos.y + 2, pos.z, { ref: 45, roll: 0.7, rev: 0.7 });
    const t = this.ctx.currentTime + 0.02;
    const lp = this.filt('lowpass', 1700, 0.8); const g = this.gain(0); lp.connect(g).connect(out);
    for (const f of [440, 523.3]) { const o = this.osc('square', f); const og = this.gain(0.5); o.connect(og).connect(lp); o.start(t); o.stop(t + dur + 0.3); }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.06); g.gain.setValueAtTime(0.15, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.25);
  }
  trainDoors(pos) {
    if (!this.ready) return;
    const out = this.spot(pos.x, pos.y + 1.5, pos.z, { ref: 8, rev: 0.3 });
    const t = this.ctx.currentTime + 0.4;
    for (let k = 0; k < 2; k++) { this.metal(t + k * 0.9, [[1318, 0.07, 0.6]], out); this.metal(t + k * 0.9 + 0.35, [[1046, 0.07, 0.7]], out); }
    this.burst(t + 1.9, 3200, 0.5, 0.7, 0.12, out, 'highpass');
  }
  crossingBell(x, y, z) {
    if (!this.ready) return;
    const out = this.spot(x, y, z, { ref: 9, roll: 1, rev: 0.25 });
    this.metal(this.ctx.currentTime + 0.01, [[742, 0.3, 0.32], [1489, 0.12, 0.22], [2215, 0.07, 0.16], [2970, 0.035, 0.1]], out);
  }

  purr(x, y, z) {
    if (!this.ready) return;
    const out = this.spot(x, y, z, { ref: 1.5, roll: 1.4 });
    const t = this.ctx.currentTime, s = this.ctx.createBufferSource(); s.buffer = this.brown; s.loop = true;
    const lp = this.filt('lowpass', 160, 1), am = this.gain(0.4), lfo = this.osc('sine', 24), lg = this.gain(0.6), g = this.gain(0);
    lfo.connect(lg).connect(am.gain); s.connect(lp).connect(am).connect(g).connect(out);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.3); g.gain.setValueAtTime(0.5, t + 2.4); g.gain.linearRampToValueAtTime(0, t + 3);
    s.start(t, Math.random() * 2); lfo.start(t); s.stop(t + 3.1); lfo.stop(t + 3.1);
  }
  meow(x, y, z, angry = false) {
    if (!this.ready) return;
    const out = this.spot(x, y, z, { ref: 3, roll: 1.1, rev: 0.15 });
    const t = this.ctx.currentTime + 0.02, d = angry ? 0.35 : 0.65;
    const o = this.osc('sawtooth', 500), f1 = this.filt('bandpass', 900, 3), f2 = this.filt('bandpass', 2600, 4), g = this.gain(0);
    o.connect(f1).connect(g); o.connect(f2).connect(g); g.connect(out);
    o.frequency.setValueAtTime(angry ? 700 : 520, t); o.frequency.linearRampToValueAtTime(angry ? 900 : 760, t + d * 0.35); o.frequency.linearRampToValueAtTime(angry ? 600 : 480, t + d);
    f1.frequency.setValueAtTime(700, t); f1.frequency.linearRampToValueAtTime(1300, t + d * 0.4); f1.frequency.linearRampToValueAtTime(800, t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.05); g.gain.setValueAtTime(0.14, t + d * 0.7); g.gain.linearRampToValueAtTime(0, t + d);
    o.start(t); o.stop(t + d + 0.05);
  }

  thunder(dist) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime + dist / 343;
    const close = dist < 1200;
    const s = c.createBufferSource(); s.buffer = this.brown; s.loop = true;
    const lp = this.filt('lowpass', close ? 380 : 180, 0.7), g = this.gain(0);
    s.connect(lp).connect(g).connect(this.ambOut); const rs = this.gain(0.8); g.connect(rs).connect(this.revIn);
    const A = Math.min(1.4, 1300 / dist);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(A, t + (close ? 0.08 : 0.5));
    for (let k = 1; k < 6; k++) g.gain.linearRampToValueAtTime(A * (0.4 + Math.random() * 0.6) * (1 - k / 7), t + k * 0.7);
    g.gain.linearRampToValueAtTime(0, t + 6);
    s.start(t, Math.random() * 3); s.stop(t + 6.2);
    if (close) this.burst(t, 1800, 0.4, 0.4, 0.5 * A, this.ambOut, 'highpass');
  }

  wingFlap(x, y, z) {
    if (!this.ready) return;
    const out = this.spot(x, y, z, { ref: 6, rev: 0.2 });
    const t = this.ctx.currentTime;
    for (let k = 0; k < 6; k++) this.burst(t + k * 0.13, 500, 0.5, 0.1, 0.25 * (1 - k / 7), out, 'lowpass');
  }

  // ---------------------------------------------------------------- road traffic
  vehicle(v, pos) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    if (!v.voice) {
      if (!pos) return;
      const p = this.panner(0, -500, 0, 6, 1.2);
      const o = this.osc('sawtooth', 60), lp = this.filt('lowpass', 650, 1.2), am = this.gain(0.6), lfo = this.osc('sine', 27), lg = this.gain(0.4);
      lfo.connect(lg).connect(am.gain);
      const g = this.gain(0), tg = this.gain(0), tl = this.filt('lowpass', 420, 0.6);
      o.connect(lp).connect(am).connect(g).connect(p); this.loop(this.brown, tl); tl.connect(tg).connect(p);
      p.connect(this.ambOut);
      o.start(); lfo.start();
      v.voice = { p, o, g, tg, lfo };
    }
    const V = v.voice;
    if (!pos) { V.g.gain.setTargetAtTime(0, t, 0.3); V.tg.gain.setTargetAtTime(0, t, 0.3); return; }
    this.setPos(V.p, pos.x, pos.y, pos.z);
    const bus = v.kind === 'bus';
    V.o.frequency.setTargetAtTime((bus ? 36 : 52) + v.v * (bus ? 4 : 7.5), t, 0.3);
    V.lfo.frequency.setTargetAtTime((bus ? 18 : 26) + v.v * 2, t, 0.3);
    V.g.gain.setTargetAtTime((0.06 + v.v * 0.01) * (bus ? 1.5 : 1), t, 0.25);
    V.tg.gain.setTargetAtTime(v.v * 0.03, t, 0.25);
  }
  // the tofu seller's brass horn: a short low "puu", then a long "paa" that sags at the end
  tofuHorn(p) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime + 0.05;
    const out = this.spot(p.x, p.y + 1.6, p.z, { ref: 14, roll: 0.8, rev: 0.45 });
    const o = this.osc('sawtooth', 560), o2 = this.osc('square', 560);
    const bp = this.filt('bandpass', 1250, 1.1), lp = this.filt('lowpass', 3000, 0.7), g = this.gain(0), g2 = this.gain(0.22);
    o.connect(bp); o2.connect(g2).connect(bp); bp.connect(lp).connect(g).connect(out);
    for (let rep = 0; rep < 2; rep++) {
      const t0 = t + rep * 2.1, f1 = 560, f2 = 630;
      for (const os of [o, o2]) {
        os.frequency.setValueAtTime(f1 * 0.96, t0); os.frequency.linearRampToValueAtTime(f1, t0 + 0.06);
        os.frequency.setValueAtTime(f2 * 0.97, t0 + 0.44); os.frequency.linearRampToValueAtTime(f2, t0 + 0.52);
        os.frequency.setValueAtTime(f2, t0 + 1.3); os.frequency.linearRampToValueAtTime(f2 * 0.92, t0 + 1.62);
      }
      const G = g.gain;
      G.setValueAtTime(0, t0); G.linearRampToValueAtTime(0.3, t0 + 0.05); G.setValueAtTime(0.28, t0 + 0.36); G.linearRampToValueAtTime(0.04, t0 + 0.42);
      G.linearRampToValueAtTime(0.34, t0 + 0.49); G.setValueAtTime(0.32, t0 + 1.35); G.linearRampToValueAtTime(0, t0 + 1.64);
    }
    for (const os of [o, o2]) { os.start(t); os.stop(t + 3.9); }
  }
  horn(pos, kind) {
    if (!this.ready) return;
    const out = this.spot(pos.x, pos.y, pos.z, { ref: 12, roll: 0.9, rev: 0.3 });
    const t = this.ctx.currentTime + 0.02, f = kind === 'bus' ? 330 : kind === 'kei' ? 400 : 440;
    for (const d of [0, 0.22]) for (const r of [1, 1.26]) {
      const o = this.osc('square', f * r), lp = this.filt('lowpass', 1800, 0.7), g = this.gain(0);
      o.connect(lp).connect(g).connect(out);
      g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(0.12, t + d + 0.01); g.gain.setValueAtTime(0.12, t + d + 0.13); g.gain.linearRampToValueAtTime(0, t + d + 0.16);
      o.start(t + d); o.stop(t + d + 0.2);
    }
  }
  busDoors(pos) {
    if (!this.ready) return;
    const out = this.spot(pos.x, pos.y, pos.z, { ref: 8, rev: 0.2 });
    const t = this.ctx.currentTime + 0.3;
    this.burst(t, 2600, 0.5, 0.6, 0.18, out, 'highpass');
    this.metal(t + 0.8, [[1318, 0.08, 0.6]], out); this.metal(t + 1.15, [[1046, 0.08, 0.7]], out);
    this.burst(t + 7.5, 2600, 0.5, 0.6, 0.15, out, 'highpass');
  }

  // ---------------------------------------------------------------- fireworks & sparklers
  delayTo(x, y, z) { const c = this.lastCam; return c ? Math.hypot(x - c.x, y - c.y, z - c.z) / 343 : 0; }
  fwLaunch(x, y, z) {
    if (!this.ready) return;
    const out = this.spot(x, y + 40, z, { ref: 80, roll: 0.6, rev: 0.4 });
    const t = this.ctx.currentTime + this.delayTo(x, y, z);
    const o = this.osc('sine', 500), g = this.gain(0);
    o.connect(g).connect(out);
    o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(1500, t + 2.2);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.2); g.gain.linearRampToValueAtTime(0, t + 2.3);
    o.start(t); o.stop(t + 2.4);
    this.burst(t, 3000, 0.6, 0.4, 0.05, out, 'highpass');
  }
  fwBurst(x, y, z, type) {
    if (!this.ready) return;
    const out = this.spot(x, y, z, { ref: 120, roll: 0.5, rev: 0.9 });
    const t = this.ctx.currentTime + this.delayTo(x, y, z);
    this.thump(t, 85, 32, 1.4, 0.9, out);
    this.burst(t, 420, 0.6, 0.9, 0.7, out, 'lowpass');
    this.burst(t + 0.02, 1400, 0.7, 0.25, 0.25, out);
    if (type === 'senrin' || type === 'kamuro') for (let k = 0; k < 34; k++) this.burst(t + 0.7 + Math.random() * 1.6, 2500 + Math.random() * 3000, 1.5, 0.025, 0.12, out);
  }
  sparklerStart() { this.spark = 0; }
  sparklerUpdate(phase, dt) {
    if (!this.ready) return;
    const rate = [6, 70, 34, 10, 0][phase];
    this.spark = (this.spark || 0) + rate * dt;
    const t = this.ctx.currentTime;
    while (this.spark > 1) { this.spark -= 1; this.burst(t + Math.random() * 0.05, 3500 + Math.random() * 4000, 2, 0.012 + Math.random() * 0.015, phase === 1 ? 0.06 : 0.035); }
  }
  sparklerStop() { this.spark = 0; }

  // village loudspeaker melody at 17:00
  // ---------------------------------------------------------------- the shop's little TV: koshien baseball
  tvUpdate(level, pos, key = 'store') {
    const tvs = (this.tvs ||= {});
    if (!this.ready || (!tvs[key] && level < 0.01)) return;
    const c = this.ctx, now = c.currentTime;
    if (!tvs[key]) {
      const T = (tvs[key] = { out: this.gain(0), next: now + 3 });
      const p = this.panner(pos.x, pos.y, pos.z, 1.2, 1.5);
      const hp = this.filt('highpass', 320, 0.7), lp = this.filt('lowpass', 3600, 0.7);
      T.out.connect(hp).connect(lp).connect(p).connect(this.sfx);
      // stadium crowd and brass band wash
      T.crowd = this.gain(0.12);
      const cb = this.filt('bandpass', 900, 0.7);
      this.loop(this.pink, cb); cb.connect(T.crowd).connect(T.out);
      const sw = this.osc('sine', 0.07), sg = this.gain(0.05); sw.connect(sg).connect(T.crowd.gain); sw.start();
      // the announcer: formant noise in syllables, switched on and off in phrases
      T.voice = this.gain(0);
      const am = this.gain(0), f1 = this.filt('bandpass', 650, 4), f2 = this.filt('bandpass', 1700, 5), mix = this.gain(0.6);
      this.loop(this.white, f1, 1.02).connect(f2);
      f1.connect(am); f2.connect(mix).connect(am); am.connect(T.voice).connect(T.out);
      const l1 = this.osc('sine', 4.6), g1 = this.gain(0.6); l1.connect(g1).connect(am.gain); l1.start();
      const l2 = this.osc('sine', 2.3), g2 = this.gain(0.3); l2.connect(g2).connect(am.gain); l2.start();
    }
    const T = tvs[key];
    T.out.gain.setTargetAtTime(level * 0.5, now, 0.4);
    if (level < 0.01 || now < T.next) return;
    // a phrase of commentary, now and then the crack of a bat and a cheer
    const t = now + 0.05, dur = rnd(1.2, 3.2);
    T.voice.gain.setTargetAtTime(0.9, t, 0.05); T.voice.gain.setTargetAtTime(0, t + dur, 0.08);
    if (Math.random() < 0.18) {
      const tb = t + dur + 0.4;
      this.metal(tb, [[1900, 0.25, 0.05], [3100, 0.12, 0.04]], T.out);
      T.crowd.gain.setTargetAtTime(0.5, tb + 0.1, 0.25); T.crowd.gain.setTargetAtTime(0.12, tb + 2.5, 1.2);
      T.next = tb + rnd(4, 7);
    } else T.next = t + dur + rnd(0.4, 1.6);
  }
  // ---------------------------------------------------------------- radio calisthenics: a cassette of bouncy piano
  // Returns the audio time at which the count-in starts, so the exercises can follow the beat.
  taiso(pos) {
    if (!this.ready) return undefined;
    const c = this.ctx, t0 = c.currentTime + 0.4, beat = 60 / 132;
    const out = this.spot(pos.x, pos.y, pos.z, { ref: 10, roll: 0.9, rev: 0.3, gain: 0.55 });
    const hp = this.filt('highpass', 170, 0.7), lp = this.filt('lowpass', 3800, 0.7), pk = this.filt('peaking', 1500, 1); pk.gain.value = 4;
    const bus = this.gain(1); bus.connect(hp).connect(lp).connect(pk).connect(out);
    const NOTE = (s) => { const m = /^([A-G])(\d)$/.exec(s); const i = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]]; return 440 * Math.pow(2, ((+m[2] - 4) * 12 + i - 9) / 12); };
    const ev = [];
    // whistle, then a staccato count-in
    ev.push([0, 'whistle']);
    for (let b = 4; b < 8; b++) for (const n of ['C4', 'E4', 'G4']) ev.push([b, NOTE(n), 0.18, 0.18]);
    const MEL = [['E5', 2], ['G5', 1], ['E5', 1], ['C5', 2], ['G4', 2], ['A4', 1], ['B4', 1], ['C5', 1], ['D5', 1], ['E5', 4],
      ['F5', 2], ['A5', 1], ['F5', 1], ['D5', 2], ['B4', 2], ['C5', 1], ['D5', 1], ['E5', 1], ['F5', 1], ['G5', 4],
      ['A5', 2], ['G5', 1], ['F5', 1], ['E5', 2], ['C5', 2], ['D5', 1], ['E5', 1], ['F5', 1], ['D5', 1], ['G5', 4],
      ['E5', 2], ['C6', 2], ['B5', 1], ['A5', 1], ['G5', 1], ['F5', 1], ['E5', 2], ['D5', 2], ['C5', 4]];
    const CH = [['C3', ['C4', 'E4', 'G4']], ['A2', ['A3', 'C4', 'E4']], ['D3', ['D4', 'F4', 'A4']], ['G2', ['G3', 'B3', 'D4']],
      ['F2', ['F3', 'A3', 'C4']], ['G2', ['G3', 'B3', 'F4']], ['C3', ['C4', 'E4', 'G4']], ['C3', ['C4', 'E4', 'G4']]];
    for (let rep = 0; rep < 3; rep++) {
      const b0 = 8 + rep * 32;
      let e = 0;
      for (const [n, d] of MEL) { ev.push([b0 + e / 2, NOTE(n) * (rep === 1 ? 2 : 1), d * beat * 0.5 * 0.92, 0.3]); e += d; }
      CH.forEach(([root, tri], bar) => {
        const bb = b0 + bar * 4, rf = NOTE(root);
        ev.push([bb, rf, beat * 0.8, 0.34]); ev.push([bb + 2, rf * 1.5, beat * 0.8, 0.3]);
        for (const k of [1, 3]) for (const n of tri) ev.push([bb + k, NOTE(n), beat * 0.45, 0.12]);
      });
    }
    for (const n of ['C2', 'C3', 'C4', 'E4', 'G4', 'C5']) ev.push([104, NOTE(n), beat * 3.5, 0.22]);
    ev.sort((a, b) => a[0] - b[0]);
    // schedule a little ahead at a time instead of creating every voice at once
    let k = 0;
    const pump = () => {
      const until = c.currentTime + 2.5;
      while (k < ev.length && t0 + ev[k][0] * beat < until) {
        const [b, f, dur, vel] = ev[k++], t = t0 + b * beat;
        if (f === 'whistle') this.whistle(t, bus); else this.piano(t, f, dur, vel, bus);
      }
      if (k < ev.length) setTimeout(pump, 400);
    };
    pump();
    return t0;
  }
  piano(t, f, dur, vel, dest) {
    const o1 = this.osc('triangle', f), o2 = this.osc('sine', f * 2), o3 = this.osc('sine', f * 3.01);
    const g = this.gain(0), g2 = this.gain(0.32), g3 = this.gain(0.1);
    o1.connect(g); o2.connect(g2).connect(g); o3.connect(g3).connect(g); g.connect(dest);
    const G = g.gain, end = t + dur + 0.3;
    G.setValueAtTime(0, t); G.linearRampToValueAtTime(vel, t + 0.004); G.exponentialRampToValueAtTime(vel * 0.35, t + 0.28); G.exponentialRampToValueAtTime(0.0001, end);
    for (const o of [o1, o2, o3]) { o.start(t); o.stop(end + 0.02); }
  }
  whistle(t, dest) {
    for (const [t1, d] of [[0, 0.16], [0.24, 0.5]]) {
      const o = this.osc('sine', 2900), g = this.gain(0), tr = this.osc('square', 34), tg = this.gain(120);
      tr.connect(tg).connect(o.frequency); o.connect(g).connect(dest);
      g.gain.setValueAtTime(0, t + t1); g.gain.linearRampToValueAtTime(0.16, t + t1 + 0.01); g.gain.setValueAtTime(0.16, t + t1 + d - 0.03); g.gain.linearRampToValueAtTime(0, t + t1 + d);
      o.start(t + t1); tr.start(t + t1); o.stop(t + t1 + d + 0.02); tr.stop(t + t1 + d + 0.02);
    }
  }
  // ---------------------------------------------------------------- summer festival: taiko, kane, shinobue, crowd
  // one player per place: the shrine festival ('shrine') and the bon dance on the school ground ('bon')
  festivalUpdate(music, pos, sizzlePos, on, key = 'shrine') {
    const fests = (this.fests ||= {});
    if (!this.ready || (!fests[key] && on < 0.01)) return;
    const c = this.ctx, now = c.currentTime;
    const F = fests[key] || (fests[key] = this.buildFestival(pos, sizzlePos));
    F.out.gain.setTargetAtTime(music * 0.55, now, 0.6);
    F.crowd.gain.setTargetAtTime(on * 0.5, now, 0.8);
    if (F.sizzle) F.sizzle.gain.setTargetAtTime(on * 0.05, now, 0.8);
    // from far away only the big drum carries
    const cam = this.lastCam;
    if (cam) F.lp.frequency.setTargetAtTime(Math.max(500, 9000 - Math.hypot(cam.x - pos.x, cam.z - pos.z) * 26), now, 0.3);
    // schedule ahead by more than the gap between frames, so slow frames don't leave holes in the music
    const look = Math.min(2, Math.max(0.3, 1.6 * (now - (F.lastCall ?? now))));
    F.lastCall = now;
    if (music < 0.02) { F.next = now + 0.2; F.step = 0; F.t0 = F.next; return; }
    if (F.next < now) { F.next = now + 0.05; F.t0 = F.next - F.step * F.dt; }
    while (F.next < now + look) { this.festStep(F, F.next); F.next += F.dt; F.step++; }
  }
  // beats (quarter notes) since the music started at this place, or null when it is not playing
  festBeat(key) {
    const F = this.fests?.[key];
    if (!this.ready || !F || F.t0 === undefined || F.step === 0) return null;
    return (this.ctx.currentTime - F.t0) / (F.dt * 4);
  }
  buildFestival(pos, sp) {
    const c = this.ctx;
    const F = { dt: 60 / 108 / 4, step: 0, next: c.currentTime + 0.3, fue: new Map() };
    let e = 0;
    for (const [n, d] of FUE) { F.fue.set(e, [FUE_N[n], d]); e += d; }
    F.out = this.gain(0); F.lp = this.filt('lowpass', 8000, 0.5);
    const p = this.panner(pos.x, pos.y, pos.z, 24, 0.85);
    F.out.connect(F.lp).connect(p).connect(this.ambOut);
    const rs = this.gain(0.45); p.connect(rs).connect(this.revIn);
    // murmur of a crowd: formant-filtered noise with syllable-rate wobble
    F.crowd = this.gain(0);
    const cp = this.panner(pos.x, pos.y - 1, pos.z, 9, 1.1);
    F.crowd.connect(cp).connect(this.ambOut);
    for (let i = 0; i < 6; i++) {
      const f1 = this.filt('bandpass', 380 + i * 90, 5), f2 = this.filt('bandpass', 1100 + i * 230, 6), am = this.gain(0), mix = this.gain(0.5);
      this.loop(this.white, f1, 0.9 + i * 0.03).connect(f2);
      f1.connect(am); f2.connect(mix).connect(am); am.connect(F.crowd);
      const l1 = this.osc('sine', 2.6 + i * 0.73), g1 = this.gain(0.5); l1.connect(g1).connect(am.gain); l1.start();
      const l2 = this.osc('sine', 0.11 + i * 0.05), g2 = this.gain(0.4); l2.connect(g2).connect(am.gain); l2.start();
    }
    if (!sp) return F;
    // the takoyaki griddle
    F.sizzle = this.gain(0);
    const sp2 = this.panner(sp.x, sp.y, sp.z, 2.5, 1.6);
    const hp = this.filt('highpass', 3800, 0.7), crackle = this.gain(0.6);
    this.loop(this.white, hp);
    hp.connect(crackle).connect(F.sizzle).connect(sp2).connect(this.ambOut);
    const cl = this.osc('square', 11.3), cg = this.gain(0.35); cl.connect(cg).connect(crackle.gain); cl.start();
    return F;
  }
  festStep(F, t) {
    const st = F.step % 16, bar = Math.floor(F.step / 16) % 10, B = F.out;
    const fill = bar === 9;
    const DON = fill ? [0, 2, 4, 6, 8, 9, 10, 11, 12] : bar % 2 ? [0, 4, 8, 10, 12, 14] : [0, 6, 8, 12];
    const KA = fill ? [14] : bar % 2 ? [2, 6] : [3, 10, 14];
    if (DON.includes(st)) this.taiko(t, st === 0 ? 1 : 0.72 + Math.random() * 0.1, B);
    if (KA.includes(st)) { this.burst(t, 2400, 3, 0.05, 0.16, B); this.metal(t, [[1580, 0.05, 0.04]], B); }
    if (st % 2 === 0) this.shime(t, st % 8 === 4 ? 0.2 : 0.08, B);
    const K = { 0: 0.3, 2: 0.07, 3: 0.08, 4: 0.2, 6: 0.07, 8: 0.26, 10: 0.07, 11: 0.08, 12: 0.2, 14: 0.07 }[st];
    if (K) { const open = K > 0.1; this.metal(t, [[2380, K * 0.32, open ? 0.24 : 0.05], [3510, K * 0.2, open ? 0.14 : 0.04], [5230, K * 0.12, 0.07]], B); }
    if (bar < 8 && st % 2 === 0) {
      const n = F.fue.get(bar * 8 + st / 2);
      if (n) this.fue(t, n[0], n[1] * F.dt * 2 * 0.96, B);
    }
  }
  taiko(t, a, dest) {
    this.thump(t, 118, 50, 0.95, 0.55 * a, dest);
    this.thump(t, 185, 92, 0.2, 0.2 * a, dest);
    const s = this.ctx.createBufferSource(); s.buffer = this.brown; s.loop = true;
    const lp = this.filt('lowpass', 420), g = this.gain(0);
    s.connect(lp).connect(g).connect(dest);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5 * a, t + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    s.start(t, Math.random() * 3); s.stop(t + 0.15);
  }
  shime(t, a, dest) { this.thump(t, 430, 310, 0.09, a, dest); this.burst(t, 1600, 1.4, 0.045, a * 0.45, dest); }
  fue(t, f, dur, dest) {
    const c = this.ctx;
    const o = this.osc('triangle', f), o2 = this.osc('sine', f * 2), g = this.gain(0), g2 = this.gain(0.1);
    const lp = this.filt('lowpass', f * 2.6, 0.6);
    o.connect(g); o2.connect(g2).connect(g); g.connect(lp).connect(dest);
    // a quick slide up into each note, then vibrato that grows on long notes
    o.frequency.setValueAtTime(f * 0.94, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    o2.frequency.setValueAtTime(f * 1.88, t); o2.frequency.exponentialRampToValueAtTime(f * 2, t + 0.05);
    const v = this.osc('sine', 5.4), vg = this.gain(0); v.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency);
    vg.gain.setValueAtTime(0, t + 0.1); vg.gain.linearRampToValueAtTime(f * 0.011, t + Math.max(0.15, dur * 0.8));
    const A = 0.13;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(A, t + 0.035); g.gain.setValueAtTime(A, t + dur - 0.07); g.gain.linearRampToValueAtTime(0, t + dur);
    // breath
    const n = c.createBufferSource(); n.buffer = this.white; n.loop = true;
    const nb = this.filt('bandpass', f * 1.5, 1.2), ng = this.gain(0);
    n.connect(nb).connect(ng).connect(dest);
    ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(0.05, t + 0.02); ng.gain.linearRampToValueAtTime(0.012, t + 0.12); ng.gain.setValueAtTime(0.012, t + dur - 0.07); ng.gain.linearRampToValueAtTime(0, t + dur);
    for (const s of [o, o2, v]) { s.start(t); s.stop(t + dur + 0.05); }
    n.start(t, Math.random() * 3); n.stop(t + dur + 0.05);
  }
  chime(x, y, z) {
    if (!this.ready) return;
    const c = this.ctx, t0 = c.currentTime + 0.1;
    const out = this.spot(x, y, z, { ref: 120, roll: 0.5, gain: 1 });
    const bp1 = this.filt('highpass', 380, 0.7), bp2 = this.filt('lowpass', 3400, 0.7);
    const shp = c.createWaveShaper(); const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x2 = i / 128 - 1; curve[i] = Math.tanh(x2 * 1.8); } shp.curve = curve;
    const dl = c.createDelay(1.5); dl.delayTime.value = 0.44; const fb = this.gain(0.38);
    const sum = this.gain(0.7);
    sum.connect(bp1).connect(bp2).connect(shp).connect(out);
    shp.connect(dl); dl.connect(fb).connect(dl); dl.connect(out);
    const rs = this.gain(0.9); shp.connect(rs).connect(this.revIn);
    let t = t0; const beat = 0.62;
    for (const [nn, b] of MELODY) {
      const f = N[nn];
      for (const [r, a, d] of [[1, 0.5, 1.6], [2, 0.18, 0.8], [3.01, 0.06, 0.4], [0.5, 0.06, 1.2]]) {
        const o = this.osc(r === 1 ? 'triangle' : 'sine', f * r), g = this.gain(0);
        o.connect(g).connect(sum);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0005, t + Math.min(d, b * beat * 1.4 + 0.4));
        o.start(t); o.stop(t + d + 0.1);
      }
      t += b * beat;
    }
    return t - t0;
  }
  templeBell(x, y, z, delay = 0) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime + 0.1 + delay;
    const out = this.spot(x, y, z, { ref: 200, roll: 0.4, rev: 0.8 });
    const P = [[57, 0.5, 14], [81.3, 0.32, 10], [114.6, 0.3, 8], [140.2, 0.18, 6], [171, 0.14, 5], [207, 0.1, 4], [252, 0.08, 3], [310, 0.05, 2.4]];
    for (const [f, a, d] of P) for (const det of [0, 0.42]) {
      const o = this.osc('sine', f + det), g = this.gain(0);
      o.connect(g).connect(out);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a * 0.5, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.start(t); o.stop(t + d + 0.1);
    }
    const s = c.createBufferSource(); s.buffer = this.brown; s.loop = true; const g = this.gain(0); s.connect(g).connect(out);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    s.start(t); s.stop(t + 0.5);
  }
}
