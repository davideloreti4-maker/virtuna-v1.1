import type { Bucket } from "../eval-config";
import { computeMacroF1 } from "./macro-f1";

export interface BootstrapResult {
  pValue: number;
  observedDelta: number;
  ci95: [number, number];
  iterations: number;
}

/**
 * Paired bootstrap test (D-17): does engine B's macro-F1 exceed engine A's?
 *
 * H0: macro-F1(B) ≤ macro-F1(A). Reject if pValue < SIGNIFICANCE_ALPHA.
 *
 * Inputs are PAIRED — predictedA[i] and predictedB[i] are predictions for the
 * SAME corpus row at position i (Pitfall 6: same-corpus comparison only).
 *
 * mulberry32 seed → deterministic across runs.
 */
export function pairedBootstrapMacroF1(
  predictedA: Bucket[],
  predictedB: Bucket[],
  actual: Bucket[],
  iters: number = 200,
  seed: number = 42,
): BootstrapResult {
  if (
    predictedA.length !== predictedB.length ||
    predictedA.length !== actual.length
  ) {
    throw new Error(
      "predictedA, predictedB, actual must all be the same length",
    );
  }
  if (iters < 200) {
    throw new Error(`bootstrap iters must be >= 200 (D-17), got ${iters}`);
  }
  const n = actual.length;

  const observedDelta =
    computeMacroF1(predictedB, actual).macroF1 -
    computeMacroF1(predictedA, actual).macroF1;

  const rng = mulberry32(seed);
  const deltas: number[] = [];

  for (let it = 0; it < iters; it++) {
    // Resample paired indices with replacement
    const idx: number[] = new Array(n);
    for (let i = 0; i < n; i++) idx[i] = Math.floor(rng() * n);

    const sampleA: Bucket[] = idx.map((i) => predictedA[i] as Bucket);
    const sampleB: Bucket[] = idx.map((i) => predictedB[i] as Bucket);
    const sampleY: Bucket[] = idx.map((i) => actual[i] as Bucket);

    const delta =
      computeMacroF1(sampleB, sampleY).macroF1 -
      computeMacroF1(sampleA, sampleY).macroF1;
    deltas.push(delta);
  }

  // One-sided p-value: fraction of bootstrap deltas ≤ 0 (B not better than A)
  const pValue = deltas.filter((d) => d <= 0).length / iters;

  // 95% CI on the bootstrap delta distribution (percentile method)
  deltas.sort((a, b) => a - b);
  const loIdx = Math.floor(0.025 * iters);
  const hiIdx = Math.max(0, Math.ceil(0.975 * iters) - 1);
  const lo = deltas[loIdx] ?? 0;
  const hi = deltas[hiIdx] ?? 0;

  return {
    pValue: round4(pValue),
    observedDelta: round4(observedDelta),
    ci95: [round4(lo), round4(hi)],
    iterations: iters,
  };
}

/**
 * mulberry32 — seeded RNG. Mirrors src/lib/engine/ml.ts:85-93 idiom for
 * cross-module consistency (same seed, same sequence).
 */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round4(x: number): number {
  return Math.round(x * 10_000) / 10_000;
}
