/**
 * value-probe — the distribution of `aVal`, the per-vertex number the shader actually paints from.
 * This is the input; hue-probe measures the output. If the ramp is under-used, it is visible HERE.
 */
import { createJiti } from 'jiti';

const ROOT = process.cwd();   // run from the worktree root
const jiti = createJiti(ROOT + '/probe.mjs', {
  alias: { '@': ROOT + '/src' },
  interopDefault: true,
});

const sim = await jiti.import(ROOT + '/src/lib/brain/cortex-sim.ts');
const field = await jiti.import(ROOT + '/src/lib/brain/cortex-field.ts');

const { NETWORK_IDS, ACTIVATION_SPAN, predictedBold, contrastBold } = sim;
const { buildField, parcelTextures, surfaceValues } = field;

// The mesh isn't loadable outside the browser (it is a quantized GLB read through three), so build
// the field on a synthetic sphere of the same vertex count — the parcellation/blend maths is what
// we are probing, not the anatomy.
const N = 60000;
const pos = new Float32Array(N * 3);
for (let i = 0; i < N; i++) {
  const y = 1 - (i / (N - 1)) * 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const th = Math.PI * (3 - Math.sqrt(5)) * i;
  pos[i * 3] = Math.cos(th) * r * 70;
  pos[i * 3 + 1] = y * 70;
  pos[i * 3 + 2] = Math.sin(th) * r * 94;
}
const f = buildField(pos);
const tex = parcelTextures(f, 12345);

const stats = (a) => {
  const s = Float64Array.from(a).sort();
  const q = (p) => s[Math.floor((s.length - 1) * p)];
  const mean = s.reduce((x, y) => x + y, 0) / s.length;
  const sd = Math.sqrt(s.reduce((x, y) => x + (y - mean) ** 2, 0) / s.length);
  return { min: q(0), p05: q(0.05), p50: q(0.5), p95: q(0.95), max: q(1), mean, sd,
           negFrac: s.filter((v) => v < 0).length / s.length };
};

const drive = { hookStrength: 0.8, novelty: 0.7, emotion: 0.6, cognitiveLoad: 0.5, reward: 0.7,
                salience: 0.8, selfRelevance: 0.6, stopRatio: 0.5 };

console.log('span used by the shader: ACTIVATION_SPAN =', ACTIVATION_SPAN);
console.log('\nt      min    p05    p50    p95    max   |  mean    sd   negative%   ramp-span-used');
for (const t of [2, 5, 8, 12]) {
  const bold = predictedBold(drive, t, 'simulated');
  const v = surfaceValues(f, tex, bold, t);
  const s = stats(v);
  // What fraction of the 0..1 ramp do the middle 90% of vertices actually cover?
  const lo = s.p05 / ACTIVATION_SPAN / 2 + 0.5;
  const hi = s.p95 / ACTIVATION_SPAN / 2 + 0.5;
  console.log(
    `${String(t).padStart(2)}s  ${s.min.toFixed(3).padStart(6)} ${s.p05.toFixed(3).padStart(6)} ` +
    `${s.p50.toFixed(3).padStart(6)} ${s.p95.toFixed(3).padStart(6)} ${s.max.toFixed(3).padStart(6)}  | ` +
    `${s.mean.toFixed(3).padStart(6)} ${s.sd.toFixed(3).padStart(5)}  ${(100 * s.negFrac).toFixed(1).padStart(5)}%   ` +
    `${(100 * (hi - lo)).toFixed(0).padStart(3)}%  [${lo.toFixed(2)} .. ${hi.toFixed(2)}]`,
  );
}

const bold = predictedBold(drive, 8, 'simulated');
console.log('\nper-network contrast at t=8s (what drives the parcels):');
const resp = contrastBold(bold);
for (const n of NETWORK_IDS) console.log(`  ${n.padEnd(20)} ${resp[n].toFixed(3)}`);
