import * as THREE from 'three';
import { U, FOG_APPLY } from '../env/materials.js';

// Flowing river water: procedural ripples along the flow direction, sky reflection by fresnel, sun & moon glints.
export function makeWaterMaterial() {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
  Object.assign(uniforms, {
    uTime: U.uTime, uSunDir: U.uSunDir, uSunCol: U.uSunCol, uFogSun: U.uFogSun, uMist: U.uMist,
    uZen: U.uSkyZen, uHor: U.uSkyHor, uMoonDir: U.uMoonDir, uMoonI: U.uMoonI, uNight: U.uNight,
  });
  return new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    vertexShader: /* glsl */`
      attribute vec2 flow;
      varying vec3 vWPos; varying vec2 vFlow; varying vec2 vUv;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWPos = wp.xyz; vFlow = flow; vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uMoonI, uNight;
      uniform vec3 uSunDir, uSunCol, uZen, uHor, uMoonDir, uFogSun, uMist;
      uniform vec3 fogColor; uniform float fogDensity;
      varying vec3 vWPos; varying vec2 vFlow; varying vec2 vUv;
      float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      float wave(vec2 p) { return vn(p) * 0.5 + vn(p * 2.3 + 3.1) * 0.3 + vn(p * 5.1 + 7.7) * 0.2; }
      void main() {
        vec2 dir = normalize(vFlow + vec2(1e-4));
        vec2 perp = vec2(-dir.y, dir.x);
        vec2 p = vec2(dot(vWPos.xz, perp), dot(vWPos.xz, dir));
        vec2 q = p * vec2(1.1, 0.45) - vec2(0.0, uTime * 0.9);
        vec2 q2 = p * vec2(2.6, 1.3) - vec2(uTime * 0.05, uTime * 1.6);
        float e = 0.12;
        float h0 = wave(q) + 0.4 * wave(q2);
        float hx = wave(q + vec2(e, 0.0)) + 0.4 * wave(q2 + vec2(e, 0.0));
        float hy = wave(q + vec2(0.0, e)) + 0.4 * wave(q2 + vec2(0.0, e));
        vec2 g = vec2(hx - h0, hy - h0) / e;
        vec2 gw = perp * g.x + dir * g.y;
        vec3 N = normalize(vec3(-gw.x * 0.22, 1.0, -gw.y * 0.22));
        vec3 V = normalize(cameraPosition - vWPos);
        float fres = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 R = reflect(-V, N);
        vec3 sky = mix(uHor, uZen, pow(clamp(R.y, 0.0, 1.0), 0.6));
        float edge = smoothstep(0.0, 0.3, min(vUv.x, 1.0 - vUv.x));
        vec3 shallow = vec3(0.16, 0.17, 0.11), deep = vec3(0.025, 0.07, 0.065);
        vec3 base = mix(shallow, deep, edge) * (0.25 + 0.75 * (1.0 - uNight)) * (0.6 + 0.6 * dot(uSunCol, vec3(0.33)));
        vec3 col = mix(base, sky, clamp(fres * 0.9, 0.0, 1.0));
        col += uSunCol * pow(max(dot(R, uSunDir), 0.0), 160.0) * 5.0;
        col += vec3(0.75, 0.82, 1.0) * pow(max(dot(R, uMoonDir), 0.0), 350.0) * 1.6 * uMoonI;
        float foam = smoothstep(0.78, 0.95, h0) * (1.0 - edge) * 0.25;
        col += foam * (sky * 0.6 + 0.1);
        gl_FragColor = vec4(col, 1.0);
        ${FOG_APPLY.replace(/#ifdef USE_FOG|#endif/g, '')}
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
