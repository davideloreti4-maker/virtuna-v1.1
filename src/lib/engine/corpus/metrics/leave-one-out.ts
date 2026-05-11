/**
 * Per-signal leave-one-out score computation, replicating
 * aggregator.selectWeights math directly (RESEARCH §C.3 caveat, Pitfall 7).
 *
 * We do NOT call aggregator.aggregateScores() with a mutated PipelineResult,
 * because aggregator's signal-availability detection relies on warning-string
 * matching that is fragile to refactors. Instead, given the five base signal
 * scores and a flag for which signal to force unavailable, we replicate the
 * selectWeights proportional redistribution and return the resulting weighted
 * aggregate.
 *
 * Canonical weights mirror src/lib/engine/aggregator.ts:23-29 — keep these
 * in sync if aggregator weights ever change. Phase 10 (calibration training)
 * may revise; this constant is the snapshot at engine v2.1.
 */

export const SCORE_WEIGHTS_BASE = {
  behavioral: 0.35,
  gemini: 0.25,
  ml: 0.15,
  rules: 0.15,
  trends: 0.1,
} as const;

export type Signal = keyof typeof SCORE_WEIGHTS_BASE;

export const SIGNALS: Signal[] = [
  "behavioral",
  "gemini",
  "ml",
  "rules",
  "trends",
];

export interface SignalScores {
  behavioral: number;
  gemini: number;
  ml: number;
  rules: number;
  trends: number;
}

/**
 * Weighted aggregate of all five signals using the canonical base weights.
 * Output rounded to 2 decimals (matches aggregator output convention).
 */
export function scoreBaseline(signals: SignalScores): number {
  let weighted = 0;
  for (const sig of SIGNALS) {
    weighted += signals[sig] * SCORE_WEIGHTS_BASE[sig];
  }
  return round2(weighted);
}

/**
 * Aggregate when one signal is forced unavailable.
 * Weights of the missing signal are redistributed proportionally to the
 * remaining signals so the renormalized weights sum to 1.0 — matches
 * aggregator.selectWeights at aggregator.ts:50-85.
 */
export function scoreWithoutSignal(
  signals: SignalScores,
  forceUnavailable: Signal,
): number {
  const available = SIGNALS.filter((s) => s !== forceUnavailable);
  const baseSum = available.reduce((s, k) => s + SCORE_WEIGHTS_BASE[k], 0);
  if (baseSum === 0) return 0;

  let weighted = 0;
  for (const sig of available) {
    const normalizedWeight = SCORE_WEIGHTS_BASE[sig] / baseSum;
    weighted += signals[sig] * normalizedWeight;
  }
  return round2(weighted);
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
