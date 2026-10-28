import * as THREE from 'three';

// Uniforms shared by every patched material: time, wind, sun direction, and the atmospheric fog terms.
export const U = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunCol: { value: new THREE.Color(1, 1, 1) },
  uFogSun: { value: new THREE.Color(1, 0.9, 0.8) },
  uMist: { value: new THREE.Vector3(0, 0.12, 4) }, // density at base, falloff per meter, base height
  uWind: { value: new THREE.Vector3(0.8, 1, 0.6) }, // dir.x, strength, dir.z
  uGust: { value: 0.3 },
  uNight: { value: 0 },
  uSkyZen: { value: new THREE.Color(0.2, 0.4, 0.8) },
  uSkyHor: { value: new THREE.Color(0.7, 0.8, 0.9) },
  uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
  uMoonI: { value: 0 },
  uLamps: { value: 0 },
  uWet: { value: 0 },
  uFest: { value: 0 }, // glow of the shrine festival lights
};

const FOG_PARS = /* glsl */`
varying vec3 vWPos;
uniform vec3 uSunDir;
uniform vec3 uFogSun;
uniform vec3 uMist;
`;
export const FOG_APPLY = /* glsl */`
#ifdef USE_FOG
{
  vec3 fr = vWPos - cameraPosition;
  float fd = length(fr);
  vec3 fdir = fr / max(fd, 1e-3);
  float fogF = 1.0 - exp(-fogDensity * fd);
  float kk = uMist.y * fdir.y;
  float integ = abs(kk) < 1e-4 ? fd : (1.0 - exp(-kk * fd)) / kk;
  float mist = min(uMist.x * exp(-uMist.y * (cameraPosition.y - uMist.z)) * integ, 30.0);
  fogF = 1.0 - (1.0 - fogF) * exp(-mist);
  float sunA = pow(max(dot(fdir, uSunDir), 0.0), 6.0);
  vec3 fcol = mix(fogColor, uFogSun, sunA * 0.85);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fcol, clamp(fogF, 0.0, 1.0));
}
#endif
`;
const WPOS_VERT = /* glsl */`
{
  vec4 _wp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  _wp = instanceMatrix * _wp;
  #endif
  vWPos = (modelMatrix * _wp).xyz;
}
`;
const WIND_VERT = /* glsl */`
{
  #ifdef USE_INSTANCING
  vec2 _ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
  #else
  vec2 _ip = vec2(modelMatrix[3][0], modelMatrix[3][2]) + position.xz * 0.15;
  #endif
  float _h = max(position.y - WIND_BASE, 0.0);
  float _ph = dot(_ip, vec2(0.071, 0.053));
  float _s = sin(uTime * 1.1 + _ph) * 0.55 + sin(uTime * 2.3 + _ph * 1.7 + position.x) * 0.25 + 0.35;
  float _amt = _s * (0.25 + uGust * 1.1) * uWind.y * WIND_AMT * _h * _h;
  transformed.x += uWind.x * _amt;
  transformed.z += uWind.z * _amt;
  transformed.y -= abs(_amt) * 0.08;
}
`;

// Adds world position, atmospheric fog and optional wind sway to a built-in material.
export function patch(mat, o = {}) {
  const key = 'p' + (o.wind ? 'w' + o.wind + '_' + (o.windBase || 0) : '') + (o.detail ? 'd' : '') + (o.key || '');
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uSunDir = U.uSunDir; sh.uniforms.uFogSun = U.uFogSun;
    sh.uniforms.uMist = U.uMist; sh.uniforms.uWind = U.uWind; sh.uniforms.uGust = U.uGust; sh.uniforms.uWet = U.uWet;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform float uTime;\nuniform vec3 uWind;\nuniform float uGust;\n')
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + WPOS_VERT);
    if (o.wind) {
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' +
        WIND_VERT.replace('WIND_AMT', o.wind.toFixed(5)).replace('WIND_BASE', (o.windBase || 0).toFixed(3)));
    }
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FOG_PARS + 'uniform float uWet;\n')
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb *= 1.0 - uWet * 0.26;\n' + FOG_APPLY);
    if (o.frag) o.frag(sh);
    if (prev) prev(sh, r);
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}

// Material library for the static village geometry. UVs from MeshBuilder are in meters; texture.repeat scales them.
export function makeMaterials(T) {
  const L = (opts, po) => patch(new THREE.MeshLambertMaterial({ vertexColors: true, ...opts }), po);
  const win = (day, lit) => L({ map: day, emissiveMap: lit, emissive: 0xffffff, emissiveIntensity: 0 }, { key: 'win' });
  const M = {
    plain: L({}),
    wood: L({ map: T.wood }),
    plaster: L({ map: T.plaster }),
    siding: L({ map: T.siding }),
    kawara: L({ map: T.kawara }),
    tin: L({ map: T.tin }),
    block: L({ map: T.block }),
    concrete: L({ map: T.concrete }),
    namako: L({ map: T.namako }),
    ballast: L({ map: T.ballast }),
    winA: win(T.windowDay, T.windowLit),
    winB: win(T.windowDay, T.windowLit),
    winC: win(T.windowDay, T.windowLit),
    winT: win(T.windowDay, T.windowLit),
    winDark: L({ map: T.windowDay }),
    shojiDark: L({ map: T.shojiDay }),
    doorDark: L({ map: T.doorDay }),
    vend0: L({ map: T.vending[0], emissiveMap: T.vending[0], emissive: 0xffffff, emissiveIntensity: 0.9 }, { key: 'vend' }),
    vend1: L({ map: T.vending[1], emissiveMap: T.vending[1], emissive: 0xffffff, emissiveIntensity: 0.9 }, { key: 'vend' }),
    vend2: L({ map: T.vending[2], emissiveMap: T.vending[2], emissive: 0xffffff, emissiveIntensity: 0.9 }, { key: 'vend' }),
    lampGlow: patch(new THREE.MeshBasicMaterial({ vertexColors: true }), { key: 'lampglow' }),
    shojiA: win(T.shojiDay, T.shojiLit),
    shojiB: win(T.shojiDay, T.shojiLit),
    doorA: win(T.doorDay, T.doorLit),
    doorB: win(T.doorDay, T.doorLit),
    shutter: L({ map: T.shutter }),
    foliage: L({}, { wind: 0.0016, windBase: 0.5 }),
    glow: patch(new THREE.MeshBasicMaterial({ vertexColors: true }), { key: 'glow' }),
    metal: patch(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.42 }), { key: 'metal' }),
    roadMain: patch(new THREE.MeshLambertMaterial({ map: T.roadMain, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), { key: 'road' }),
    roadLocal: patch(new THREE.MeshLambertMaterial({ map: T.roadLocal, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), { key: 'road' }),
    gravel: patch(new THREE.MeshLambertMaterial({ map: T.gravel, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), { key: 'road' }),
    dirt: patch(new THREE.MeshLambertMaterial({ map: T.dirt, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), { key: 'road' }),
  };
  // emissive night groups: windows lit in different hours
  M.windowGroups = { A: [M.winA, M.shojiA, M.doorA], B: [M.winB, M.shojiB, M.doorB], C: [M.winC] };
  M.winT.emissive.setHex(0x9ab4ff);
  return M;
}

// simple emissive-ish unlit material helpers
export function unlit(color, o = {}) {
  return patch(new THREE.MeshBasicMaterial({ color, ...o }), { key: 'unlit' });
}
