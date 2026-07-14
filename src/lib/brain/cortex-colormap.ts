/**
 * cortex-colormap — ONE ramp, shared by the surface shader and every legend that annotates it.
 *
 * WHY THIS FILE EXISTS. The colorbar used to build its gradient from its own copy of the pole
 * colours, with a comment promising it mapped "value → colour exactly as the shader paints it". That
 * promise is unenforceable when the two live in different files: change the shader and the legend
 * quietly starts LYING about the map, and a lying legend is worse than no legend. So the stops live
 * here, once, and both the GLSL and the DOM are generated from them.
 *
 * WHERE THE STOPS COME FROM. They are not invented and they are not a designer's diverging ramp.
 * They were MEASURED off the reference (thesapientcompany.com/intelligence) by hue-bucketing the
 * 40,727 cortex pixels of its own WebGL canvas:
 *
 *     hue     share   mean            hue     share   mean
 *       0deg   2.1%   #cd483a          165deg   3.9%  #7ec5b5
 *      15deg   9.0%   #d0633b          180deg   9.8%  #4fc1c6
 *      30deg  15.5%   #d38a40          195deg  10.1%  #409eb7
 *      45deg  26.3%   #d7b54e  <-- its single most common tone
 *      60deg  15.8%   #cfcc6d          90-150deg: ~0.5% TOTAL
 *      75deg   5.3%   #becd87
 *
 * The empty 90-150deg band is the identifying detail: a true "jet" carries a broad saturated green
 * through its middle, and this has none. It is the RdYlBu family, reversed — the standard diverging
 * map of neuroimaging — running cold blue -> cyan -> a PALE, near-neutral midpoint -> gold -> red.
 * The pale midpoint is what lets a cortex sitting near baseline read as anatomy rather than as noise.
 */

export type RGB = [number, number, number];

/**
 * Cold (-1, below baseline) -> hot (+1, above baseline). Ten stops, evenly spaced.
 *
 * ⚠️ THE MIDPOINT IS INDEX 4/5, AND IT IS DELIBERATELY PALE. If you saturate it, every vertex on a
 * resting cortex — which is most of them, most of the time — starts shouting, and the map goes back
 * to reading as stained glass. The reference's midpoint is nearly desaturated for exactly this reason.
 */
export const CORTEX_RAMP: readonly RGB[] = [
  [17, 75, 140], // #114b8c  deep blue   — the coldest end
  [37, 174, 210], // #25aed2  blue
  [52, 218, 225], // #34dae1  cyan
  [110, 213, 190], // #6ed5be  teal
  [199, 221, 119], // #c7dd77  sage       — the pale midpoint
  [229, 225, 87], // #e5e157  chartreuse
  [246, 197, 47], // #f6c52f  gold        — the reference's dominant tone
  [244, 138, 31], // #f48a1f  amber
  [242, 83, 25], // #f25319  orange
  [207, 24, 5], // #cf1805  red          — the hottest end
];

/**
 * ⚠️ THE HUES ARE THE MEASURED ONES; THE CHROMA IS RESTORED (×1.45), AND THAT IS NOT A LIBERTY.
 *
 * The table above is the mean colour of each hue bucket, and a MEAN OF A BUCKET IS DULLER THAN THE
 * COLOURS IN IT — it averages the lit crowns with the shaded sulci and everything between. Painting
 * those means back onto a lit surface applies the shading a second time, and the specimen came back
 * at mean saturation 0.35 against the reference's 0.59 (measured on both renders with the same
 * probe). So the chroma is scaled back up to what a stop must have been BEFORE the render averaged
 * it down, and the two ends are pushed deeper because an extreme that never reads as extreme is not
 * an extreme. Hue — the thing that actually identifies the colormap — is untouched.
 */

/** Sample the ramp. `s` is 0..1 (0 = coldest, 0.5 = baseline, 1 = hottest); out of range is clamped. */
export function rampAt(s: number): RGB {
  const t = (s < 0 ? 0 : s > 1 ? 1 : s) * (CORTEX_RAMP.length - 1);
  const i = Math.min(CORTEX_RAMP.length - 2, Math.floor(t));
  const f = t - i;
  const a = CORTEX_RAMP[i] ?? CORTEX_RAMP[0]!;
  const b = CORTEX_RAMP[i + 1] ?? a;
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

/**
 * A signed activation placed on the ramp's 0..1 axis, with ONE SPAN PER TAIL.
 *
 * ⚠️ A SINGLE SYMMETRIC SPAN CANNOT SERVE BOTH SIDES, because the two tails do not reach equally far.
 * Measured over the surface the model actually produces: the cold tail runs to −0.53 at p05 (the
 * default-mode system suppresses hard and over a lot of cortex) while the warm tail only reaches
 * +0.31 at p95. Under one span wide enough for the cold side, every warm value was crushed into the
 * middle of the ramp — 61% of the specimen's coloured pixels landed in a SINGLE hue bucket, against
 * 26% on the reference. Give each tail the span it actually occupies and the warm half spreads back
 * out across gold → amber → orange → red, which is what the reference does.
 *
 * These are DOWNSTREAM OF THE MODEL and go stale silently — by making the map flat, never by
 * throwing. Re-measure (scratchpad value-probe) if the drive model changes.
 */
export const SPAN_WARM = 0.4;
export const SPAN_COLD = 0.6;

export const valueToRamp = (v: number, _span?: number): number => {
  const s = v >= 0 ? 0.5 + v / (2 * SPAN_WARM) : 0.5 + v / (2 * SPAN_COLD);
  return s < 0 ? 0 : s > 1 ? 1 : s;
};

export const cssRamp = (s: number): string => {
  const [r, g, b] = rampAt(s);
  return `rgb(${r}, ${g}, ${b})`;
};

/**
 * The SAME ramp, as a GLSL function body, generated from the stops above so the surface and the
 * legend cannot drift apart.
 *
 * The chain-of-mix trick is exact at every stop and piecewise-linear between them: each `mix` takes
 * over completely once `t` passes its segment, because the weight saturates at 1. It needs no array
 * indexing, which GLSL ES 1.0 (what three compiles a ShaderMaterial to by default) will not do
 * dynamically.
 *
 * ⚠️ NO BACKTICKS may appear in the string this returns. It is interpolated into the shader's own
 * template literal, and a backtick there terminates it early — TS then parses the remaining GLSL as
 * JavaScript. That has broken this build twice.
 */
export function glslRamp(): string {
  const v = ([r, g, b]: RGB) => `vec3(${(r / 255).toFixed(4)}, ${(g / 255).toFixed(4)}, ${(b / 255).toFixed(4)})`;
  const first = CORTEX_RAMP[0]!;
  const rest = CORTEX_RAMP.slice(1);
  const lines = rest.map(
    (stop, i) => `    c = mix(c, ${v(stop)}, clamp(t - ${i.toFixed(1)}, 0.0, 1.0));`,
  );
  return [
    '  vec3 cortexRamp(float s) {',
    `    float t = clamp(s, 0.0, 1.0) * ${(CORTEX_RAMP.length - 1).toFixed(1)};`,
    `    vec3 c = ${v(first)};`,
    ...lines,
    '    return c;',
    '  }',
  ].join('\n');
}
