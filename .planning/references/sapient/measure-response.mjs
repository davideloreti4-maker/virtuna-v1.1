/**
 * measure-response — re-derive the per-network normalisers from the drive model, BOTH SIGNS.
 *
 * RESPONSE_P95 was measured on the old UNSIGNED contrast, so it only ever described how hard a
 * network runs ABOVE rest. The contrast is signed now, and the suppression side has a completely
 * different reachable range (the DMN rests at 0.42 and can fall a long way; attention rests at 0.08
 * and can barely fall at all). Normalising the negative half by the positive half's p95 pegged the
 * DMN at −1.000 — full deep blue, permanently, with no dynamic range left.
 *
 * So: sample the model over the grid of drives it can actually be given, and take the p95 of the
 * positive headroom and the p95 of the |negative| headroom, per network. Same method as the original
 * constants; one more tail.
 */
import { createJiti } from 'jiti';

const ROOT = process.cwd();   // run from the worktree root
const jiti = createJiti(ROOT + '/probe.mjs', { alias: { '@': ROOT + '/src' }, interopDefault: true });
const sim = await jiti.import(ROOT + '/src/lib/brain/cortex-sim.ts');
const { NETWORK_IDS, RESTING_BOLD, predictedBold } = sim;

const pos = Object.fromEntries(NETWORK_IDS.map((n) => [n, []]));
const neg = Object.fromEntries(NETWORK_IDS.map((n) => [n, []]));

const SEEDS = ['a-card', 'b-card', 'c-card', 'd-card', 'e-card'];
const STOPS = [0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95];
// GROUNDED runs carry a real retention curve; sample three shapes (cliff, linear, flat).
const CURVES = [
  undefined,
  (u) => Math.max(0.05, 1 - u * 1.6),
  (u) => 1 - u * 0.5,
  (u) => 0.9 - 0.1 * u,
];

for (const mode of ['simulated', 'grounded']) {
  for (const seedKey of SEEDS) {
    for (const stopRatio of STOPS) {
      for (const retentionAt of CURVES) {
        if (mode === 'simulated' && retentionAt) continue;
        const durationS = mode === 'grounded' ? 30 : 15;
        for (let i = 0; i <= 24; i++) {
          const t = (i / 24) * durationS;
          const bold = predictedBold({ mode, stopRatio, durationS, retentionAt, seedKey }, t);
          for (const id of NETWORK_IDS) {
            const rest = RESTING_BOLD[id];
            const d = bold[id] - rest;
            const h = d >= 0 ? d / Math.max(1e-6, 1 - rest) : d / Math.max(1e-6, rest);
            (h >= 0 ? pos[id] : neg[id]).push(Math.abs(h));
          }
        }
      }
    }
  }
}

const p95 = (a) => {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))];
};

console.log('network              n+     p95(above)    n−     p95(below)');
const above = {}, below = {};
for (const id of NETWORK_IDS) {
  above[id] = +p95(pos[id]).toFixed(3);
  below[id] = +p95(neg[id]).toFixed(3);
  console.log(
    `  ${id.padEnd(18)} ${String(pos[id].length).padStart(5)}  ${above[id].toFixed(3).padStart(9)}` +
    `   ${String(neg[id].length).padStart(5)}  ${below[id].toFixed(3).padStart(9)}`,
  );
}
console.log('\nRESPONSE_P95   =', JSON.stringify(above, null, 2).replace(/"/g, ''));
console.log('SUPPRESSION_P95 =', JSON.stringify(below, null, 2).replace(/"/g, ''));
