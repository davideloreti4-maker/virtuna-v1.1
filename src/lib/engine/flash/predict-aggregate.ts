/**
 * SIM-1 Flash — Predict pure aggregate (Plan 06-02 Task 1). The ONE genuinely novel module.
 *
 * aggregatePredict: PredictAnalyst[] → { band, range:{min,max}, confidence, factors[] }
 *
 * D-01 / D-04 / D-05 honesty spine — the SAME pure-derivation discipline as `aggregateFlash`
 * (flash-aggregate.ts) and `two-audience-read.buildDelta`:
 *   - range:      the panel SPREAD = Math.min / Math.max of each analyst's lean mapped through
 *                 LEAN_POS. It is the ONLY numeric, and it is DERIVED — never a model field
 *                 (the function takes ONLY PredictAnalyst[], so a number CANNOT be sourced from
 *                 a model output). Two different disagreement profiles → two different ranges
 *                 (panel-grounded, not a decorative fixed band→range lookup). (D-01)
 *   - band:       the qualitative likelihood WORD at the centre of the lean distribution
 *                 (median position → bandFromCenter). NO 0-100 single value. (D-01 / F-01)
 *   - confidence: the TIGHTNESS of the range — tight→High, wide→Low. Pure, no extra call,
 *                 no model self-report. (D-05)
 *   - factors:    one receipt per analyst — every factor NAMES its analyst archetype. (D-04)
 *
 * Field names mirror PredictionGaugeBlockSchema.props (06-04) so the 06-05 runner assembles
 * the block with no adapter.
 *
 * Isolation (leaf): imports ONLY the `PredictAnalyst` TYPE from `./predict-schema`. No model
 * client, no engine runner, no scorer, no version imports — this makes the D-01 guarantee
 * structural: with no model output in scope, the range provably cannot come from a model field.
 */

import type { PredictAnalyst } from "./predict-schema";

// ─── Ordinal lean → position map (A1 — code constant, NOT a model field) ──────────
//
// Each per-analyst ordinal lean maps to a representative position on a 0..100
// likelihood-of-yes rail. This is NOT the D-01-rejected "fixed final-band → range" lookup:
// it maps EACH analyst's individual lean, so the displayed range moves with the panel's
// ACTUAL disagreement (two different distributions → different spreads → different ranges).
// Test-locked alongside the confidence thresholds — adjust ONLY in lockstep with
// predict-aggregate.test.ts.

export const LEAN_POS = {
  strongly_no: 10,
  lean_no: 35,
  toss_up: 50,
  lean_yes: 65,
  strongly_yes: 90,
} as const;

// ─── Confidence thresholds (D-05 tightness — named, test-locked) ──────────────────
// Mirror the `STRONG_THRESHOLD` / `MIXED_THRESHOLD` naming discipline in flash-aggregate.ts:
// confidence is the spread (= range.max - range.min) bucketed into tight / mid / wide.

/** Spread ≤ this → "High" confidence (the panel agrees tightly). */
export const CONF_TIGHT = 15;
/** Spread ≤ this (and > CONF_TIGHT) → "Medium"; above → "Low" (the panel is split). */
export const CONF_MID = 40;

// ─── Band-centre cutoffs (the midpoints between adjacent LEAN_POS positions) ──────
// bandFromCenter buckets the distribution's median position into one likelihood WORD.
// Cutoffs are the midpoints between neighbouring LEAN_POS values so each lean's own
// position lands squarely in its matching band:
//   strongly_no 10 → Unlikely · lean_no 35 → Lean no · toss_up 50 → Toss-up ·
//   lean_yes 65 → Lean yes · strongly_yes 90 → Likely.

const BAND_LIKELY = 77.5; // midpoint lean_yes(65)/strongly_yes(90)
const BAND_LEAN_YES = 57.5; // midpoint toss_up(50)/lean_yes(65)
const BAND_TOSS_UP = 42.5; // midpoint lean_no(35)/toss_up(50)
const BAND_LEAN_NO = 22.5; // midpoint strongly_no(10)/lean_no(35)

export type PredictBand = "Likely" | "Lean yes" | "Lean no" | "Toss-up" | "Unlikely";
export type PredictConfidence = "High" | "Medium" | "Low";

export interface PredictFactor {
  analystArchetype: string;
  driver: string;
  direction: "for" | "against";
}

export interface PredictAggregate {
  band: PredictBand;
  range: { min: number; max: number };
  confidence: PredictConfidence;
  factors: PredictFactor[];
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────────

/** Median of a numeric array (even length → mean of the two middle values). Pure. */
export function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

/** Map a centre position (0..100 likelihood-of-yes) to its likelihood band WORD. Pure. */
export function bandFromCenter(center: number): PredictBand {
  if (center >= BAND_LIKELY) return "Likely";
  if (center >= BAND_LEAN_YES) return "Lean yes";
  if (center >= BAND_TOSS_UP) return "Toss-up";
  if (center >= BAND_LEAN_NO) return "Lean no";
  return "Unlikely";
}

// ─── The pure honest collapse ──────────────────────────────────────────────────────
// Same input → identical output. No side effects, no randomness, no network.

/**
 * Collapse the panel's per-analyst ordinal leans into a likelihood BAND (centre) + a coarse
 * RANGE (panel spread, the single sanctioned numeric) + CONFIDENCE (range tightness) + clustered
 * FACTORS (receipts, one per analyst).
 *
 * @param analysts - the already-Zod-validated PredictAnalyst panel (≥1).
 * @returns { band, range:{min,max}, confidence, factors[] } — matches PredictionGaugeBlockSchema.props.
 *
 * D-01: `range` is `Math.min`/`Math.max` of the mapped lean positions — derived from the panel,
 * structurally never a model field. D-05: `confidence` is the spread tightness. D-04: every
 * factor names its analyst archetype.
 */
export function aggregatePredict(analysts: PredictAnalyst[]): PredictAggregate {
  const positions = analysts.map((a) => LEAN_POS[a.lean]);

  const min = Math.min(...positions);
  const max = Math.max(...positions);
  const spread = max - min;

  const band = bandFromCenter(median(positions));

  const confidence: PredictConfidence =
    spread <= CONF_TIGHT ? "High" : spread <= CONF_MID ? "Medium" : "Low";

  const factors: PredictFactor[] = analysts.map((a) => ({
    analystArchetype: a.archetype,
    driver: a.factor,
    direction: a.factorDirection,
  }));

  return { band, range: { min, max }, confidence, factors };
}
