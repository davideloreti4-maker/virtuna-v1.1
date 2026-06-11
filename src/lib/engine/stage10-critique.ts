/**
 * Stage 10 — Self-critique (deterministic).
 *
 * History: this was a qwen3.6-plus thinking call (D-21). The stage-10/11 analysis
 * (2026-05-31) found the call re-derived a deterministic formula and discarded most of
 * its output — `flags` are never persisted (no `critique` DB column) nor rendered, the
 * old `consistency_score` had zero consumers (since removed), and the only consumed
 * effect, `confidence_adjustment`, is fully determined by values already on the assembled
 * PredictionResult. The D-13 checks are pure arithmetic, so the LLM only ever
 * approximated them stochastically.
 *
 * F34 (plan 01-04): Check #1 (signal-agreement) dropped — dead on video after D-R1 and now
 * subsumed by the apollo-vs-fold agreement in calculateConfidence (F22). Three checks remain
 * (score-vs-factors, historical-flop, over-confidence-on-thin-signals) — all live and free.
 *
 * Now computed in TypeScript: instant, free, and fully reproducible — removing a ~42s
 * reasoning call from the post-pipeline tail and the non-determinism it introduced on the
 * one score-affecting path (audit F5). Flags stay creator-cited templates so they remain
 * useful if a "why we're unsure" surface is added later.
 */
import type { PredictionResult, CritiqueResult } from "./types";
import type { StageEventCallback } from "./events";
import { emitStageStart, emitStageEnd } from "./events";
import type { CreatorContext } from "./creator";

// Per-check confidence penalties (magnitude, subtracted). Sum clamped to [-0.20, 0] —
// preserves the prior prompt's "reduce 0.05–0.08 per fired check, cap -0.20" rule.
// F34 (plan 01-04): Check #1 (signal-agreement) was DROPPED — its |gemini − behavioral| basis
// died with D-R1 (gemini_score null on video) and the apollo-vs-fold agreement signal now lives
// in calculateConfidence (F22); re-checking it here as a penalty would double-count. Checks
// #2/#3/#4 (all live, free, orthogonal) are kept.
const PENALTY_SCORE_FACTOR_CONFLICT = 0.07;
const PENALTY_HISTORICAL_FLOP = 0.05;
const PENALTY_THIN_SIGNAL = 0.08;

const HIGH_SCORE = 70; // Check #2
const LOW_SCORE = 30;
const WEAK_FACTOR = 4; // factor score treated as "negative"
const STRONG_FACTOR = 7;
const HIGH_CONFIDENCE = 0.7; // Checks #3/#4
const WEAK_HOOK = 4; // hook visual_stop_power "weak" threshold

/**
 * D-11: Clamp confidence_adjustment to [-0.20, 0] — never let a reduction exceed the cap
 * or flip into a confidence boost. Applied by the aggregator after deriveCritique.
 */
export function applyCritiqueAdjustment(
  currentConfidence: number,
  critique: CritiqueResult,
): number {
  const adj = Math.max(-0.2, Math.min(0, critique.confidence_adjustment));
  return Math.max(0, Math.min(1, currentConfidence + adj));
}

/**
 * Deterministic self-critique. Runs the four D-13 consistency checks over the assembled
 * PredictionResult and returns a confidence penalty + creator-cited flag strings. Pure —
 * no I/O, no model call; same input always yields the same critique.
 */
export function deriveCritique(
  result: PredictionResult,
  creatorContext?: CreatorContext | null,
): CritiqueResult {
  // flags[] removed (Plan 04, D2.3): flag strings were never persisted (no critique DB column)
  // nor rendered. The only consumed effect, confidence_adjustment, is KEPT (D1.4/R5).
  let penalty = 0;

  // Check #1 (signal-agreement) DROPPED — F34 (plan 01-04). Its |gemini − behavioral| basis died
  // with D-R1 (gemini_score null on video); the independent apollo-vs-fold agreement now lives in
  // calculateConfidence (F22), so re-checking it here would double-count the same signal.

  // Check #2 — Score vs Factors: high score on weak factors, or low score on strong ones.
  const top3 = [...(result.factors ?? [])].sort((a, b) => b.score - a.score).slice(0, 3);
  if (top3.length === 3) {
    if (result.overall_score > HIGH_SCORE && top3.every((f) => f.score <= WEAK_FACTOR)) {
      penalty += PENALTY_SCORE_FACTOR_CONFLICT;
    } else if (result.overall_score < LOW_SCORE && top3.every((f) => f.score >= STRONG_FACTOR)) {
      penalty += PENALTY_SCORE_FACTOR_CONFLICT;
    }
  }

  // Check #3 — Historical-flop match: creator has documented flops + this shares the pattern.
  // Reads only past_flops.length — never a URL (the URL-safety invariant holds by construction).
  const flopCount = creatorContext?.past_flops?.length ?? 0;
  const hookWeak =
    (result.hook_decomposition?.visual_stop_power ?? 10) < WEAK_HOOK ||
    result.signal_availability.gemini_hook === false;
  if (flopCount > 0 && result.confidence > HIGH_CONFIDENCE && hookWeak) {
    penalty += PENALTY_HISTORICAL_FLOP;
  }

  // Check #4 — Over-confidence on thin signals: confidence>0.7 with ≥2 signals unavailable.
  // sa.audio and sa.retrieval sub-conditions removed (Plan 04, R9): those keys no longer
  // contribute to the blend. gemini_hook + personas remain as the thin-signal indicators.
  const sa = result.signal_availability;
  const unavailable = [
    sa.gemini_hook !== true && "gemini_hook",
    sa.personas !== true && "personas",
  ].filter(Boolean) as string[];
  if (result.confidence > HIGH_CONFIDENCE && unavailable.length >= 2) {
    penalty += PENALTY_THIN_SIGNAL;
  }

  return {
    flags: [], // Plan 04 (D2.3): flags vestigial — array retained in CritiqueResult type for back-compat
    confidence_adjustment: penalty === 0 ? 0 : Math.max(-0.2, -penalty),
  };
}

/**
 * Stage 10 entry point. Thin wrapper preserving the SSE stage-event timeline + call site;
 * the work is now synchronous. Returns `CritiqueResult` (never null — the deterministic
 * path cannot fail); the `| null` return type is kept for aggregator back-compat.
 */
export async function runStage10Critique(
  aggregateResult: PredictionResult,
  onEvent?: StageEventCallback,
  creatorContext?: CreatorContext | null,
): Promise<CritiqueResult | null> {
  const start = emitStageStart(onEvent, "stage_10_critique", "post");
  const critique = deriveCritique(aggregateResult, creatorContext ?? null);
  emitStageEnd(onEvent, "stage_10_critique", "post", start, { cost_cents: 0, ok: true });
  return critique;
}
