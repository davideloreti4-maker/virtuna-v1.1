import * as THREE from 'three';

/**
 * cortex-porcelain — the result page's look for the cortex (new look, behind NEXT_PUBLIC_NEW_LOOK).
 *
 * Same mesh, same field, same camera, pose and light rig as the "scan" look in `CortexCanvas.tsx`;
 * a different surface. Where the scan paints every vertex from a diverging ramp, porcelain is a pale
 * body that warms only where a region runs above its resting level, and cools faintly where it runs
 * below. It is the look of the mock's stills, ported as they were made:
 * `.scratch/next-look/part2/design/brain/entry4.ts` (shader `FRAG2`, materials `light` and `pearl`).
 *
 * The material numbers are albedo in LINEAR space: they reach the shader as Vector3 uniforms, which
 * three does not colour-manage, and the shader converts to the output space at its end.
 * (No backticks inside the shader: they end the template literal.)
 */
export type PorcelainLook = 'porcelain-light' | 'porcelain-dark';

export const PORCELAIN_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uLight; uniform vec3 uRim; uniform vec3 uKeyCol; uniform vec3 uFillCol; uniform vec3 uFillDir; uniform vec3 uAmbient;
  uniform float uSpanWarm; uniform float uSpanCold;
  uniform vec3 uBase; uniform vec3 uHot1; uniform vec3 uHot2; uniform vec3 uCold; uniform float uEmis; uniform float uRimK; uniform float uSpec; uniform float uLo; uniform float uHi;
  varying float vCurv; varying float vVal; varying vec3 vNormal; varying vec3 vView;
  void main() {
    vec3 N = normalize(vNormal); vec3 V = normalize(vView); vec3 L = normalize(uLight);
    float curv01 = clamp(vCurv * 0.5 + 0.5, 0.0, 1.0);
    float a = clamp(vVal / (uSpanWarm * 1.3), 0.0, 1.0);
    float c = clamp(-vVal / uSpanCold, 0.0, 1.0);
    vec3 act = mix(uHot1, uHot2, smoothstep(0.35, 1.0, a));
    float k = smoothstep(uLo, uHi, a);
    vec3 albedo = mix(uBase, act, k);
    albedo = mix(albedo, uCold, c * 0.30);
    float ao = mix(0.50, 1.0, smoothstep(0.03, 0.55, curv01));
    float wrap = clamp((dot(N, L) + 0.55) / 1.55, 0.0, 1.0);
    float fill = max(dot(N, uFillDir), 0.0);
    vec3 light = uAmbient * 0.50 + uKeyCol * (0.72 * wrap) + uFillCol * (0.26 * fill);
    vec3 col = albedo * light * ao;
    vec3 H = normalize(L + V);
    col += vec3(1.0, 0.99, 0.97) * pow(max(dot(N, H), 0.0), 70.0) * uSpec * mix(0.25, 1.0, curv01);
    float fr = pow(1.0 - max(dot(N, V), 0.0), 2.6);
    col += uRim * fr * uRimK;
    col += act * k * k * uEmis * mix(0.55, 1.0, curv01);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

type Rgb = readonly [number, number, number];

interface PorcelainMaterial {
  /** The body. */
  base: Rgb;
  /** Warm, where a region first runs above rest. */
  hot1: Rgb;
  /** Hot, where it runs as hard as it ever runs. */
  hot2: Rgb;
  /** Below rest (mixed in at 30% at most). */
  cold: Rgb;
  emis: number;
  /** Fresnel rim: negative darkens the silhouette (on a light card), positive lifts it (on a dark one). */
  rimK: number;
  spec: number;
  amb: Rgb;
  /** The activation band the warmth fades in over. */
  lo: number;
  hi: number;
}

/** entry4.ts `light` (the light theme) and `pearl` (the dark theme), unchanged. */
const PORCELAIN: Record<PorcelainLook, PorcelainMaterial> = {
  'porcelain-light': {
    base: [0.955, 0.94, 0.915],
    hot1: [1.0, 0.78, 0.66],
    hot2: [0.9, 0.2, 0.13],
    cold: [0.74, 0.8, 0.88],
    emis: 0.0,
    rimK: -0.16,
    spec: 0.3,
    amb: [1.02, 1.0, 0.98],
    lo: 0.14,
    hi: 0.8,
  },
  'porcelain-dark': {
    base: [0.9, 0.89, 0.875],
    hot1: [1.0, 0.76, 0.63],
    hot2: [0.96, 0.23, 0.15],
    cold: [0.62, 0.72, 0.86],
    emis: 0.05,
    rimK: 0.16,
    spec: 0.42,
    amb: [0.8, 0.8, 0.82],
    lo: 0.14,
    hi: 0.8,
  },
};

const vec3 = (c: Rgb) => new THREE.Vector3(c[0], c[1], c[2]);

/**
 * The porcelain uniforms: the scan look's light rig (`shared`, passed in so the two looks cannot
 * drift apart), with the material's ambient and the porcelain terms.
 */
export function porcelainUniforms(
  look: PorcelainLook,
  shared: Record<string, THREE.IUniform>,
): Record<string, THREE.IUniform> {
  const m = PORCELAIN[look];
  return {
    ...shared,
    uAmbient: { value: vec3(m.amb) },
    uBase: { value: vec3(m.base) },
    uHot1: { value: vec3(m.hot1) },
    uHot2: { value: vec3(m.hot2) },
    uCold: { value: vec3(m.cold) },
    uEmis: { value: m.emis },
    uRimK: { value: m.rimK },
    uSpec: { value: m.spec },
    uLo: { value: m.lo },
    uHi: { value: m.hi },
  };
}

/** Linear → sRGB, one channel (the transfer `colorspace_fragment` applies). */
const toSrgb = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);

/**
 * The key's warm end for a look ("calm → active"): the material's two hot colours as the screen
 * shows them, so the legend and the surface cannot drift. CSS colours, warm then hot.
 */
export function porcelainLegend(look: PorcelainLook): [warm: string, hot: string] {
  const css = (c: Rgb) => `rgb(${c.map((x) => Math.round(toSrgb(x) * 255)).join(' ')})`;
  const m = PORCELAIN[look];
  return [css(m.hot1), css(m.hot2)];
}
