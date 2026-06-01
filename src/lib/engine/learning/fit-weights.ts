/**
 * 1:1 E2E learning loop — per-niche signal-weight fitting.
 *
 * THE learning that leverages all Qwen layers. The Qwen models are frozen (can't
 * retrain their weights), but the aggregator BLENDS their outputs — 8 signal
 * scores — with weights that were HAND-SET (SCORE_WEIGHTS, user decision
 * 2026-05-22), never learned. This module learns, PER NICHE, how much to trust
 * each Qwen signal given the real outcomes the 1:1 engine was validated against.
 *
 * Method (interpretable, $0, deterministic — no solver/training infra):
 *   weight(signal) ∝ Cohen's-d separation of that signal between the niche's
 *   viral and under videos. A signal that cleanly separates real winners from
 *   losers earns weight; a noisy or wrong-direction signal earns ~0. Normalized
 *   to sum 1 over available signals. Falls back to DEFAULT_WEIGHTS when a niche
 *   lacks both classes.
 *
 * Pure + fully unit-testable. The softmax (`ml`) is just one of the 8 inputs here.
 */
import type { OutcomeBucket } from "./labeling";
import { bucketFromPercentile, type BucketThresholds, DEFAULT_THRESHOLDS } from "./labeling";

export type SignalKey =
  | "behavioral"
  | "gemini"
  | "ml"
  | "rules"
  | "trends"
  | "audio"
  | "retrieval"
  | "platform_fit";

export const SIGNAL_KEYS: SignalKey[] = [
  "behavioral",
  "gemini",
  "ml",
  "rules",
  "trends",
  "audio",
  "retrieval",
  "platform_fit",
];

export type SignalScores = Partial<Record<SignalKey, number | null>>;
export type NicheWeights = Record<SignalKey, number>;

/** The current hand-set aggregator weights (aggregator.ts SCORE_WEIGHTS), as the fallback baseline. */
export const DEFAULT_WEIGHTS: NicheWeights = {
  behavioral: 0.4,
  gemini: 0.35,
  audio: 0.05,
  trends: 0.1,
  platform_fit: 0.05,
  ml: 0,
  retrieval: 0,
  rules: 0,
};

export interface LabeledSignalRow {
  id: string;
  niche: string;
  signals: SignalScores;
  real_bucket: OutcomeBucket;
}

/** Minimum viral AND under examples in a niche before we trust a fitted weight set. */
export const MIN_CLASS_SIZE = 4;

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function variance(xs: number[], m: number): number {
  return xs.length > 1 ? xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1) : 0;
}

/** Cohen's d of a signal between viral (+) and under (−) cohorts. >0 = higher for winners. */
function cohensD(viral: number[], under: number[]): number {
  if (viral.length < 2 || under.length < 2) return 0;
  const mv = mean(viral);
  const mu = mean(under);
  const pooled = Math.sqrt((variance(viral, mv) + variance(under, mu)) / 2);
  if (pooled === 0) return 0;
  return (mv - mu) / pooled;
}

/** Fit weights for a single niche's labeled rows. Returns null when classes too small. */
export function fitWeightsForNiche(rows: LabeledSignalRow[]): NicheWeights | null {
  const viral = rows.filter((r) => r.real_bucket === "viral");
  const under = rows.filter((r) => r.real_bucket === "under");
  if (viral.length < MIN_CLASS_SIZE || under.length < MIN_CLASS_SIZE) return null;

  const raw: Partial<NicheWeights> = {};
  let sum = 0;
  for (const key of SIGNAL_KEYS) {
    const v = viral
      .map((r) => r.signals[key])
      .filter((x): x is number => typeof x === "number");
    const u = under
      .map((r) => r.signals[key])
      .filter((x): x is number => typeof x === "number");
    const d = Math.max(0, cohensD(v, u)); // only reward correct-direction separation
    raw[key] = d;
    sum += d;
  }
  if (sum === 0) return null; // no signal separates → keep defaults

  const weights = {} as NicheWeights;
  for (const key of SIGNAL_KEYS) weights[key] = (raw[key] ?? 0) / sum;
  return weights;
}

/** Fit per-niche weights over a labeled set; niches without enough data keep DEFAULT_WEIGHTS. */
export function fitNicheWeights(
  rows: LabeledSignalRow[],
): { weightsByNiche: Record<string, NicheWeights>; fittedNiches: string[]; defaultedNiches: string[] } {
  const byNiche = new Map<string, LabeledSignalRow[]>();
  for (const r of rows) {
    const list = byNiche.get(r.niche) ?? [];
    list.push(r);
    byNiche.set(r.niche, list);
  }
  const weightsByNiche: Record<string, NicheWeights> = {};
  const fittedNiches: string[] = [];
  const defaultedNiches: string[] = [];
  for (const [niche, list] of byNiche) {
    const fitted = fitWeightsForNiche(list);
    if (fitted) {
      weightsByNiche[niche] = fitted;
      fittedNiches.push(niche);
    } else {
      weightsByNiche[niche] = { ...DEFAULT_WEIGHTS };
      defaultedNiches.push(niche);
    }
  }
  return { weightsByNiche, fittedNiches, defaultedNiches };
}

/** Weighted blend of available signal scores, weights renormalized over present signals. */
export function blendScore(signals: SignalScores, weights: NicheWeights): number {
  let num = 0;
  let den = 0;
  for (const key of SIGNAL_KEYS) {
    const s = signals[key];
    const w = weights[key];
    if (typeof s === "number" && w > 0) {
      num += w * s;
      den += w;
    }
  }
  return den > 0 ? num / den : 0;
}

// ---- evaluation: does the re-weighted blend rank real outcomes better? ----

function macroF1(
  pairs: Array<{ predicted: OutcomeBucket; actual: OutcomeBucket }>,
): number {
  const classes: OutcomeBucket[] = ["viral", "average", "under"];
  let sum = 0;
  for (const c of classes) {
    const tp = pairs.filter((p) => p.predicted === c && p.actual === c).length;
    const fp = pairs.filter((p) => p.predicted === c && p.actual !== c).length;
    const fn = pairs.filter((p) => p.predicted !== c && p.actual === c).length;
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    sum += precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  }
  return sum / classes.length;
}

export interface WeightEvalResult {
  n: number;
  matchRate: number;
  macroF1: number;
}

/**
 * Re-blend each row's signals with the given weights, rank WITHIN niche → bucket,
 * and score against the real bucket. Pass DEFAULT_WEIGHTS as a baseline to compare
 * fitted-vs-handset lift. Mirrors how real outcomes are labeled (percentile-in-niche).
 */
export function evaluateWeights(
  rows: LabeledSignalRow[],
  weightsByNiche: Record<string, NicheWeights>,
  thresholds: BucketThresholds = DEFAULT_THRESHOLDS,
): WeightEvalResult {
  const byNiche = new Map<string, LabeledSignalRow[]>();
  for (const r of rows) {
    const list = byNiche.get(r.niche) ?? [];
    list.push(r);
    byNiche.set(r.niche, list);
  }

  const pairs: Array<{ predicted: OutcomeBucket; actual: OutcomeBucket }> = [];
  for (const [niche, list] of byNiche) {
    const weights = weightsByNiche[niche] ?? DEFAULT_WEIGHTS;
    const blends = list.map((r) => ({ id: r.id, blend: blendScore(r.signals, weights) }));
    const n = blends.length;
    for (const r of list) {
      const self = blends.find((b) => b.id === r.id)!.blend;
      const below = blends.filter((b) => b.blend < self).length;
      const percentile = n > 1 ? below / (n - 1) : 0;
      pairs.push({ predicted: bucketFromPercentile(percentile, thresholds), actual: r.real_bucket });
    }
  }

  const matchRate = pairs.length
    ? pairs.filter((p) => p.predicted === p.actual).length / pairs.length
    : 0;
  return { n: pairs.length, matchRate, macroF1: macroF1(pairs) };
}
