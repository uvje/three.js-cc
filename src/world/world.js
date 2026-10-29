import * as THREE from 'three';
import { makeTextures, setMaxAnisotropy } from '../env/textures.js';
import { makeMaterials, U } from '../env/materials.js';
import { Heightmap, buildGroundTextures, buildHeightTexture, buildTerrainMesh, buildFarMountains, G } from './terrain.js';
import { Planner, F } from './planner.js';
import { ChunkedBuilders } from '../core/builder.js';
import { Collision } from './collision.js';
import { buildRoads, buildRiver, buildRail } from './roads.js';
import { buildLots } from './buildings.js';
import { buildLandmarks } from './landmarks.js';
import { buildFields, paddyMaterial } from './fields.js';
import { buildPoles, buildVending, buildMirrorsAndSigns, buildGuardrails, buildLightPools } from './props.js';
import { Forest } from './vegetation.js';
import { GrassSystem } from './grass.js';
import { Fireflies, Moths, LightPool } from './fx.js';
import { Festival } from './festival.js';
import { Home } from './home.js';
import { RadioTaiso } from './taiso.js';
import { BonOdori } from './bonodori.js';
import { Toro } from './toro.js';

// Builds the whole village and answers spatial queries (ground height, surfaces) for the player and the soundscape.

const SURF = {
  [G.GRASS]: 'grass', [G.ASPHALT]: 'asphalt', [G.GRAVEL]: 'gravel', [G.YARD]: 'gravel', [G.FOREST]: 'grass', [G.PADDY]: 'paddy',
  [G.WATER]: 'water', [G.BALLAST]: 'gravel', [G.STONE]: 'stone', [G.SAND]: 'dirt', [G.CONCRETE]: 'concrete', [G.DIRT]: 'dirt',
  [G.FIELD]: 'dirt', [G.TALL]: 'tall', [G.WOOD]: 'wood',
};
const NO_SHADOW = ['paddy', 'roadMain', 'roadLocal', 'gravel', 'dirt', 'lampGlow', 'vend0', 'vend1', 'vend2', 'winA', 'winB', 'winC', 'winT', 'winDark', 'shojiA', 'shojiB', 'shojiDark', 'doorA', 'doorB', 'doorDark'];

export class World {
  constructor(scene, renderer, quality) {
    this.scene = scene; this.renderer = renderer; this.quality = quality;
    this.extras = []; this.vending = []; this.lamps = []; this.lampSources = []; this.pools = []; this.hums = [];
    this.interact = []; this.sitSpots = []; this.furin = []; this.flags = []; this.glowSigns = []; this.barberPoles = [];
    this.landmarkIcons = []; this.shopSpots = {}; this.tallGrassLots = []; this.paddies = []; this.sunflowerFields = [];
    this.lampsLevel = 0;
    this._p = {};
  }
  async generate(progress) {
    const step = async (p, label) => { progress(p, label); await new Promise((r) => setTimeout(r, 16)); };
    setMaxAnisotropy(Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));
    await step(0.04, 'Рисуем черепицу и вывески');
    this.T = makeTextures();
    this.M = makeMaterials(this.T);
    this.M.paddy = paddyMaterial(this.T);
    await step(0.1, 'Насыпаем холмы и прокладываем реку');
    this.hm = new Heightmap();
    this.plan = new Planner(this.hm);
    this.plan.run();
    await step(0.34, 'Строим дома и магазинчики');
    this.chunks = new ChunkedBuilders(200);
    this.col = new Collision();
    buildRoads(this.plan, this.chunks, this.col, this.extras);
    buildRiver(this.plan, this.chunks, this.col, this.extras);
    buildRail(this.plan, this.chunks, this.extras);
    // grandma's house: the farmhouse a short ride west of the shops
    const farms = this.plan.lots.filter((l) => !l.shop && l.style === 'farm');
    farms.sort((a, b) => Math.hypot(a.x + 250, a.z - 60) - Math.hypot(b.x + 250, b.z - 60));
    if (farms.length) farms[0].home = true;
    buildLots(this);
    await step(0.48, 'Святилище, станция и школа');
    buildLandmarks(this);
    buildFields(this);
    await step(0.56, 'Тянем провода');
    buildPoles(this);
    buildVending(this);
    buildMirrorsAndSigns(this);
    buildGuardrails(this);
    this.festival = new Festival(this);
    this.home = new Home(this);
    this.taiso = new RadioTaiso(this);
    this.bon = new BonOdori(this);
    this.toro = new Toro(this);
    for (const l of this.tallGrassLots) this.plan.markRect(l.x, l.z, l.w / 2 - 1, l.d / 2 - 1, l.ang, 0, G.TALL);
    await step(0.64, 'Сажаем траву и рис');
    Object.assign(this, buildGroundTextures(this.hm, this.plan.ground, this.plan.noise));
    this.heightTex = buildHeightTexture(this.hm);
    this.terrain = buildTerrainMesh(this.hm, this.groundTex, this.T.detail);
    this.scene.add(this.terrain);
    this.scene.add(buildFarMountains());
    await step(0.74, 'Растим кедры и бамбук');
    this.forest = new Forest(this, this.quality);
    this.grass = new GrassSystem(this, this.quality);
    await step(0.86, 'Зажигаем фонари');
    buildLightPools(this, this.T);
    this.fireflies = new Fireflies(this);
    this.moths = new Moths(this);
    this.lightPool = new LightPool(this.scene, this, this.quality === 'low' ? 3 : 5);
    for (const m of this.chunks.buildMeshes(this.M, { noShadow: NO_SHADOW })) this.scene.add(m);
    for (const m of this.extras) {
      if (m.castShadow === undefined) m.castShadow = true;
      this.scene.add(m);
    }
    await step(0.97, 'Почти готово');
  }
  groundAt(x, z, y = 1e9) {
    const th = this.hm.sample(x, z);
    const p = this.col.platformAt(x, z, y, 0.6, this._p);
    if (p && p.h >= th - 0.05) return { h: Math.max(p.h, th), surface: p.surface, platform: true };
    return { h: th, surface: SURF[this.plan.groundAt(x, z)] || 'grass', platform: false };
  }
  setQuality(q) { this.quality = q; this.forest.setQuality(q); this.grass.setQuality(q); }
  update(dt, tSec, cam, time) {
    this.lampsLevel = time.lamps;
    U.uLamps.value = time.lamps;
    this.forest.update(cam);
    this.grass.update(cam);
    const pr = this.renderer.getPixelRatio(), hgt = this.renderer.domElement.height / pr;
    this.fireflies.update(time, pr, hgt);
    this.moths.update(pr, hgt);
    this.lightPool.update(cam, time);
    this.store?.update(dt, tSec, time, cam);
    for (const s of this.sunflowerMeshes || []) {
      const d = Math.hypot(s.x - cam.x, s.z - cam.z);
      s.mesh.visible = d < 330;
      s.mesh.castShadow = d < 110;
    }
    const M = this.M;
    for (const m of M.windowGroups.A) m.emissiveIntensity = time.winA * (m === M.doorA ? 0.7 : 0.95);
    for (const m of M.windowGroups.B) m.emissiveIntensity = time.winB * (m === M.doorB ? 0.7 : 0.95);
    for (const m of M.windowGroups.C) m.emissiveIntensity = time.winC * 0.95;
    // TV glow: a new shot every couple of seconds, with a fast shimmer on top
    this.tvT = (this.tvT || 0) - dt;
    if (this.tvT <= 0) { this.tvT = 0.6 + Math.random() * 2.8; this.tvB = 0.35 + Math.random() * 0.65; }
    M.winT.emissiveIntensity = time.winA * (this.tvB || 0.6) * (0.85 + 0.15 * Math.sin(tSec * 23) * Math.sin(tSec * 7.7));
    const vend = 0.55 + 0.4 * time.night;
    M.vend0.emissiveIntensity = vend; M.vend1.emissiveIntensity = vend; M.vend2.emissiveIntensity = vend;
    M.lampGlow.color.setScalar(1 + 3 * time.lamps);
    for (const s of this.glowSigns) s.mat.emissiveIntensity = s.k * time.lamps;
    for (const t of this.barberPoles) { t.offset.y = (t.offset.y + dt * 0.35) % 1; }
    const gust = U.uGust.value;
    this.flags.forEach((m, i) => {
      if (m.userData.baseRot === undefined) m.userData.baseRot = m.rotation.y;
      m.rotation.y = m.userData.baseRot + Math.sin(tSec * 1.7 + i * 1.3) * 0.18 * (0.3 + gust);
    });
    if (this.clock) {
      const h = time.hour % 12, mnt = (time.hour * 60) % 60;
      this.clock.hh.rotation.z = -(h / 12) * Math.PI * 2;
      this.clock.mh.rotation.z = -(mnt / 60) * Math.PI * 2;
    }
  }
  // ---------- queries for the soundscape
  nearestRiver(x, z) {
    const q = this.plan.river.poly.nearest(x, z, 140);
    if (!q) return null;
    const y = this.plan.river.poly.sampleArray(this.plan.river.water, q.s);
    return { x: q.x, y, z: q.z, d: q.d };
  }
  nearestHum(x, z) {
    let best = null, bd = 30;
    for (const h of this.hums) { const d = Math.hypot(h.x - x, h.z - z); if (d < bd) { bd = d; best = h; } }
    return best ? { ...best, d: bd } : null;
  }
  envAt(x, z) {
    const trees = this.forest.treesNear(x, z, 30, this._trees || (this._trees = [])).length;
    let pd = 1e9;
    for (const p of this.paddies) { const d = Math.hypot(p.x - x, p.z - z) - 15; if (d < pd) pd = d; }
    const W = this.maskW, ix = Math.round((x + 1000) / 2), iz = Math.round((z + 1000) / 2);
    const grass = ix >= 0 && iz >= 0 && ix < W && iz < W ? this.maskData[(iz * W + ix) * 4] / 255 : 0;
    return { trees: Math.min(1, trees / 22), paddy: Math.max(0, Math.min(1, 1 - pd / 70)), grass };
  }
}
