import * as THREE from 'three';

// Bug catching, the business of every summer holiday: cicadas sit on tree trunks and give themselves away by
// singing, rhinoceros and stag beetles come to the trees at night, and empty cicada shells cling to the bark.
// Up to five are about near the player at a time; caught ones go into the collection in the diary.

export const BUGS = [
  { id: 'abura', jp: 'アブラゼミ', ru: 'Абурадзэми', note: 'Самая шумная цикада лета: шипит, как масло на сковородке.', hours: [[7.5, 17.5]], w: 5, kind: 'cicada', body: 0x5a3a22, wing: 0x7a5432, wo: 1, song: 'aburazemi' },
  { id: 'minmin', jp: 'ミンミンゼミ', ru: 'Минминдзэми', note: 'Зелёно-чёрная, с прозрачными крыльями. Поёт «мин-мин-мин-мии».', hours: [[8.5, 15.8]], w: 3, kind: 'cicada', body: 0x2e4a32, wing: 0xd0e4ea, wo: 0.4, song: 'minmin' },
  { id: 'higurashi', jp: 'ヒグラシ', ru: 'Хигураси', note: 'Поёт на рассвете и в сумерках: «кана-кана-кана». Самая печальная песня лета.', hours: [[4.5, 6.8], [17.2, 19.6]], w: 4, kind: 'cicada', body: 0x6a5a30, wing: 0xdae8e0, wo: 0.4, song: 'higurashi' },
  { id: 'kumazemi', jp: 'クマゼミ', ru: 'Кумадзэми', note: 'Большая чёрная цикада, кричит по утрам «ся-ся-ся».', hours: [[6, 10.6]], w: 3, kind: 'cicada', body: 0x161616, wing: 0xd0dde4, wo: 0.4, song: 'kumazemi', big: true },
  { id: 'kabuto', jp: 'カブトムシ', ru: 'Жук-носорог', note: 'Король летних каникул. Любит сок дуба и арбузные корки.', hours: [[19.5, 24], [0, 6.2]], w: 3, kind: 'kabuto', body: 0x3a1c10 },
  { id: 'kuwagata', jp: 'ノコギリクワガタ', ru: 'Жук-олень', note: 'Челюсти как пила. Цепляется так, что не оторвать.', hours: [[20.5, 24], [0, 5]], w: 1.4, kind: 'kuwa', body: 0x24120a },
  { id: 'nukegara', jp: 'セミの抜け殻', ru: 'Шкурка цикады', note: 'Пустая оболочка личинки. Кто-то этим утром стал цикадой.', hours: [[0, 24]], w: 1.6, kind: 'shell', body: 0xa86a2a },
];
const TRUNK = { sugi: 0.27, broad: 0.32, pine: 0.2, sakura: 0.24, kaki: 0.17, maple: 0.12 };
const inHours = (b, h) => b.hours.some(([a, c]) => h >= a && h < c);

function model(b) {
  const g = new THREE.Group();
  const M = (color, o = {}) => new THREE.MeshLambertMaterial({ color, ...o });
  const body = M(b.body);
  if (b.kind === 'cicada' || b.kind === 'shell') {
    const shell = b.kind === 'shell';
    const bm = shell ? M(b.body, { transparent: true, opacity: 0.8 }) : body;
    const k = b.big ? 1.25 : 1;
    const t = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), bm); t.scale.set(0.013 * k, 0.03 * k, 0.012 * k); g.add(t);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.03 * k, 0.012 * k, 0.014 * k), bm); head.position.set(0, 0.03 * k, 0.002); g.add(head);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.005 * k, 5, 4), M(shell ? b.body : 0x2a2a2a)); eye.position.set(s * 0.015 * k, 0.031 * k, 0.004); g.add(eye);
      for (const y of [-0.012, 0, 0.012]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.02 * k, 0.002, 0.002), bm); leg.position.set(s * 0.016 * k, y * k, -0.004); leg.rotation.z = s * 0.4; g.add(leg); }
      if (!shell) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(0.018 * k, 0.05 * k), M(b.wing, { transparent: b.wo < 1, opacity: b.wo, side: THREE.DoubleSide }));
        w.position.set(s * 0.008 * k, -0.008 * k, 0.012 * k); w.rotation.set(0, s * 0.5, s * 0.1); g.add(w);
      }
    }
  } else {
    const kuwa = b.kind === 'kuwa';
    const t = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), M(b.body, { emissive: 0x0a0402 })); t.scale.set(kuwa ? 0.016 : 0.02, 0.032, kuwa ? 0.008 : 0.013); g.add(t);
    const pro = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), body); pro.scale.set(kuwa ? 0.014 : 0.017, 0.012, kuwa ? 0.007 : 0.011); pro.position.y = 0.032; g.add(pro);
    if (kuwa) {
      for (const s of [-1, 1]) { const j = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.03, 0.004), body); j.position.set(s * 0.007, 0.055, 0.002); j.rotation.z = -s * 0.35; g.add(j); }
    } else {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.04, 5), body); horn.position.set(0, 0.058, 0.01); horn.rotation.x = 0.5; g.add(horn);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, 0.004), body); tip.position.set(0, 0.076, 0.02); g.add(tip);
    }
    for (const s of [-1, 1]) for (const y of [-0.014, 0, 0.016]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.003, 0.003), body); leg.position.set(s * 0.018, y, -0.004); leg.rotation.z = s * 0.5; g.add(leg); }
  }
  g.scale.setScalar(1.7); // a bit larger than life, so they can be spotted on the bark
  return g;
}

export class Insects {
  constructor(W, audio) {
    this.W = W; this.audio = audio;
    this.models = new Map();
    this.slots = Array.from({ length: 5 }, () => {
      const it = { x: 0, y: -100, z: 0, r: 1.3, kind: 'bug', label: '', bug: null, when: null };
      const s = { it, bug: null, g: null, next: 0 };
      it.when = () => !!s.bug;
      it.slot = s;
      W.interact.push(it);
      return s;
    });
    this.tmp = [];
    this.t = 0;
  }
  update(dt, time, cam) {
    this.t += dt;
    const h = time.hour, W = this.W;
    for (const s of this.slots) {
      if (s.bug) {
        const d = Math.hypot(s.it.x - cam.x, s.it.z - cam.z);
        if (d > 70 || !inHours(s.bug, h)) this.clear(s);
        else if (s.bug.song && d < 40 && this.t > s.next) {
          s.next = this.t + 9 + Math.random() * 8;
          if (this.audio?.ready) this.audio[s.bug.song](s.it.x, s.it.y + 1.4, s.it.z);
        }
        continue;
      }
      if (this.t < s.next) continue;
      s.next = this.t + 2 + Math.random() * 3;
      // pick a tree in a ring around the player that no other bug is on
      const trees = W.forest.treesNear(cam.x, cam.z, 45, this.tmp).filter((t) => TRUNK[t.type] && Math.hypot(t.x - cam.x, t.z - cam.z) > 10);
      if (!trees.length) continue;
      const tr = trees[Math.floor(Math.random() * trees.length)];
      if (this.slots.some((o) => o.tree === tr)) continue;
      const pool = BUGS.filter((b) => inHours(b, h));
      let r = Math.random() * pool.reduce((a, b) => a + b.w, 0);
      const bug = pool.find((b) => (r -= b.w) < 0) || pool[0];
      if (!bug) continue;
      const a = Math.random() * Math.PI * 2, rr = TRUNK[tr.type] * (tr.s || 1) + 0.012;
      const gy = W.hm.sample(tr.x, tr.z), y = gy + 0.9 + Math.random() * 0.8;
      const g = this.model(bug);
      g.position.set(tr.x + Math.cos(a) * rr, y, tr.z + Math.sin(a) * rr);
      g.rotation.set(0, Math.atan2(Math.cos(a), Math.sin(a)), (Math.random() - 0.5) * 0.3);
      g.visible = true;
      Object.assign(s, { bug, g, tree: tr });
      Object.assign(s.it, { x: g.position.x, y: gy, z: g.position.z, label: bug.kind === 'shell' ? 'Снять шкурку цикады' : `Поймать: ${bug.ru}` });
      s.next = this.t + 2 + Math.random() * 6;
    }
  }
  model(bug) {
    let list = this.models.get(bug.id);
    if (!list) this.models.set(bug.id, (list = []));
    let g = list.find((m) => !m.visible);
    if (!g) { g = model(bug); g.visible = false; this.W.scene.add(g); list.push(g); }
    return g;
  }
  clear(s) { if (s.g) s.g.visible = false; s.bug = null; s.g = null; s.tree = null; s.it.y = -100; s.next = this.t + 4; }
  // returns { bug, escaped }
  catch(it) {
    const s = it.slot, bug = s.bug;
    if (!bug) return null;
    const escaped = bug.kind === 'cicada' && Math.random() < 0.3;
    if (escaped) this.audio?.cicadaEscape?.(it.x, s.g.position.y, it.z);
    this.clear(s);
    return { bug, escaped };
  }
}
