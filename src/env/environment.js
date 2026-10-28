import * as THREE from 'three';
import { TimeOfDay } from './time.js';
import { Sky } from './sky.js';
import { U } from './materials.js';
import { Simplex } from '../core/noise.js';

// Drives sun/moon light, hemisphere light, fog, mist, exposure and wind from the time of day.
export class Environment {
  constructor(scene, renderer, quality) {
    this.scene = scene;
    this.renderer = renderer;
    this.time = new TimeOfDay(15.5);
    this.noise = new Simplex(4242);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = quality !== 'low';
    const sh = this.sun.shadow;
    sh.mapSize.set(quality === 'high' ? 4096 : 2048, quality === 'high' ? 4096 : 2048);
    this.shadowExtent = quality === 'high' ? 90 : 70;
    const cam = sh.camera;
    cam.left = -this.shadowExtent; cam.right = this.shadowExtent; cam.top = this.shadowExtent; cam.bottom = -this.shadowExtent;
    cam.near = 10; cam.far = 700;
    sh.bias = -0.0004;
    sh.normalBias = 0.06;
    scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xbcd6f4, 0x60603f, 1.2);
    scene.add(this.hemi);

    scene.fog = new THREE.FogExp2(0xbcd4e8, 0.0005);
    this.sky = new Sky();
    this.skyScene = new THREE.Scene();
    this.skyScene.add(this.sky.group);

    this.windAngle = 0.6;
    this.gust = 0.3;
    this.mistBase = 4;
    this._lp = new THREE.Vector3();
    this._grey = new THREE.Color();
    this.weather = null;
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3();
  }
  setQuality(q) {
    this.sun.castShadow = q !== 'low';
  }
  update(dt, tSec, camera, focus) {
    const time = this.time;
    time.update(dt);
    const s = time.s;
    // light
    const L = this.sun;
    if (time.useMoon) { L.color.setRGB(0.62, 0.72, 1.0); L.intensity = time.moonI; }
    else { L.color.copy(s.sun); L.intensity = time.sunI; }
    // stable shadow: snap the light target to shadow texels
    const ext = this.shadowExtent;
    const texel = (ext * 2) / L.shadow.mapSize.x;
    const dir = time.lightDir;
    const right = this._right.set(0, 1, 0).cross(dir).normalize();
    if (right.lengthSq() < 1e-4) right.set(1, 0, 0);
    const up = this._up.copy(dir).cross(right).normalize();
    const fx = focus.dot(right), fy = focus.dot(up), fz = focus.dot(dir);
    const sx = Math.round(fx / texel) * texel, sy = Math.round(fy / texel) * texel;
    this._lp.copy(right).multiplyScalar(sx).addScaledVector(up, sy).addScaledVector(dir, fz);
    L.target.position.copy(this._lp);
    L.position.copy(this._lp).addScaledVector(dir, 350);
    L.target.updateMatrixWorld();

    const Wt = this.weather, cl = Wt ? Wt.cloud : 0, fl = Wt ? Wt.flash : 0;
    L.intensity *= 1 - 0.82 * cl;
    this.hemi.color.copy(s.hs);
    this.hemi.groundColor.copy(s.hg);
    this.hemi.intensity = s.hi * (1 - 0.25 * cl) + fl * 2.5;
    this.scene.fog.color.copy(s.fog);
    this.scene.fog.density = s.fd * (1 + 2.4 * cl);
    if (cl > 0.001) {
      const grey = (c, k) => { const l = c.r * 0.3 + c.g * 0.55 + c.b * 0.15; c.lerp(this._grey.setRGB(l * 0.95, l * 0.98, l * 1.04), k); };
      grey(this.hemi.color, cl * 0.8); grey(this.scene.fog.color, cl * 0.85); this.scene.fog.color.multiplyScalar(1 - 0.35 * cl);
    }
    this.renderer.toneMappingExposure = s.exp;

    // wind & gusts
    const n = this.noise;
    this.windAngle = 0.6 + n.noise(tSec * 0.003, 3.1) * 1.2;
    const g = 0.5 + 0.5 * n.noise(tSec * 0.09, 7.7) + 0.25 * n.noise(tSec * 0.31, 1.3);
    this.gust = Math.max(0, Math.min(1.2, g));
    U.uWind.value.set(Math.cos(this.windAngle), 0.8 + 0.4 * n.noise(tSec * 0.02, 9.1), Math.sin(this.windAngle));
    U.uGust.value = this.gust;
    U.uTime.value = tSec;
    U.uSunDir.value.copy(time.sunDir);
    U.uSunCol.value.copy(s.sun).multiplyScalar(time.sunI / 3.2);
    U.uFogSun.value.copy(s.haze);
    // morning mist pooled in the valley, breathing slowly
    const breathe = 0.75 + 0.25 * n.noise(tSec * 0.01, 2.2);
    U.uMist.value.set(s.mist * breathe + cl * 0.006, 0.11, this.mistBase);
    U.uNight.value = time.night;
    U.uSkyZen.value.copy(s.zen).multiplyScalar(1.2);
    U.uSkyHor.value.copy(s.hor).multiplyScalar(1.2);
    U.uMoonDir.value.copy(time.moonDir);
    U.uMoonI.value = time.moonI / 0.38;

    this.sky.update(camera, time, tSec, cl, fl);
  }
}
