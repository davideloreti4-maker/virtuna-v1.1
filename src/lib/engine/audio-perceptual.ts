/**
 * Phase 6 audio perceptual score (D-G3 — content-type-adaptive formula).
 *
 * Pure function: takes Gemini audio sub-scores + Phase 4 content type, returns
 * a 0-100 score BEFORE the audio_fingerprint_boost is applied by the aggregator
 * (per D-G3). Locked coefficients here are LOAD-BEARING — Phase 10 ML audit may
 * revise based on corpus benchmark evidence; modification requires a Phase 10
 * commit + engine version bump.
 *
 * Idiom mirrors src/lib/engine/wave0/content-type-weights.ts (locked matrix +
 * pure transform + null-safe content-type fallback).
 */

import type {
  GeminiAudioSignals,
  AudioPerceptualResult,
  ContentTypeSlug,
} from "./types";

type VoiceCoefficients = {
  voice_clarity: number;
  audio_hook: number;
  voiceover_ratio: number;
};
type AmbientCoefficients = {
  music_ratio: number;
  description_quality: number;
};

type PerceptualFormula =
  | { mode: "voice"; coefficients: VoiceCoefficients }
  | { mode: "ambient"; coefficients: AmbientCoefficients }
  | { mode: "balanced"; coefficients: Record<string, number> };

/**
 * LOCKED per CONTEXT D-G3 + Plan 06-03 action. Phase 10 may revise.
 *
 * Voice-driven (talking_head, tutorial, vlog):
 *   weightedSum = voice_clarity_weight * voice_clarity_0_10
 *               + audio_hook_weight    * audio_hook_first_2s_0_10
 *               + voiceover_weight     * (voiceover_ratio * 10)
 *   raw0to10    = weightedSum / sum(weights actually used)
 *   score0to100 = round(clamp(raw0to10 * 10, 0, 100))
 *
 * Ambient-driven (slideshow, b_roll, action):
 *   weightedSum = music_ratio_weight        * (music_ratio * 10)
 *               + description_quality_weight * description_quality_score(audio_description)
 *
 * Balanced (other): average of all non-null sub-scores (voice/audio_hook as 0-10; ratios * 10).
 */
// prettier-ignore
const PERCEPTUAL_FORMULA_BY_TYPE: Record<ContentTypeSlug, PerceptualFormula> = {
  talking_head: { mode: "voice",    coefficients: { voice_clarity: 0.45, audio_hook: 0.35, voiceover_ratio: 0.20 } },
  tutorial:     { mode: "voice",    coefficients: { voice_clarity: 0.40, audio_hook: 0.35, voiceover_ratio: 0.25 } },
  vlog:         { mode: "voice",    coefficients: { voice_clarity: 0.35, audio_hook: 0.30, voiceover_ratio: 0.35 } },
  slideshow:    { mode: "ambient",  coefficients: { music_ratio: 0.60, description_quality: 0.40 } },
  b_roll:       { mode: "ambient",  coefficients: { music_ratio: 0.55, description_quality: 0.45 } },
  action:       { mode: "ambient",  coefficients: { music_ratio: 0.55, description_quality: 0.45 } },
  // Phase 5 CR-04 added `comedy` to ContentTypeSlug — voice-led format (punchline delivery).
  comedy:       { mode: "voice",    coefficients: { voice_clarity: 0.35, audio_hook: 0.40, voiceover_ratio: 0.25 } },
  other:        { mode: "balanced", coefficients: {} },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Description-quality heuristic — longer + more-descriptive descriptions score higher.
 * Range: <50 chars → 0-10 linear ramp; 50-150 chars → 10 (optimal); >150 → mild decay.
 * Phase 10 may refine with richer signals (vocabulary diversity, genre keyword presence, etc.).
 */
function descriptionQualityScore(description: string): number {
  const len = description?.length ?? 0;
  if (len < 50) return clamp(len / 5, 0, 10); // 0-10 ramp below 50 chars
  if (len <= 150) return 10; // optimal range
  return clamp(10 - (len - 150) / 50, 0, 10); // mild decay above 150
}

/**
 * Computes audio_perceptual_score (0-100) from Gemini audio fields + Phase 4 content type.
 *
 * Returns a NEW object (does not mutate input). Pure — no side effects.
 *
 * Behavior per D-G3:
 * - Voice mode (talking_head/tutorial/vlog): weights voice_clarity + audio_hook + voiceover_ratio.
 *   Null voice_clarity / audio_hook are excluded from the formula (renormalizes via
 *   weightedSum / sum(weights actually used)) — no NaN propagation.
 * - Ambient mode (slideshow/b_roll/action): weights music_ratio + description_quality.
 *   voice_clarity / audio_hook IGNORED even if Gemini emitted them (D-A2 contract violation
 *   tolerance — slideshow/b_roll/action should have null voice fields per D-A2, but if Gemini
 *   emits them anyway, ambient mode does not include them in sub_scores_used or in the formula).
 * - Balanced mode (other): averages all non-null sub-scores treating each on a 0-10 scale.
 * - Null contentType falls back to "other" (balanced passthrough) — preserves the Wave 0 failure contract.
 *
 * Result clamped to [0, 100] BEFORE the audio_fingerprint_boost is applied by the aggregator
 * (per D-G3) — keeps the boost magnitude comparable across content types.
 */
export function computeAudioPerceptualScore(
  signals: GeminiAudioSignals,
  contentType: ContentTypeSlug | null,
): AudioPerceptualResult {
  const formula = PERCEPTUAL_FORMULA_BY_TYPE[contentType ?? "other"];
  const subScoresUsed: string[] = [];
  let weightedSum = 0;
  let totalWeight = 0;

  if (formula.mode === "voice") {
    const { voice_clarity_0_10, audio_hook_first_2s_0_10, voiceover_ratio } = signals;
    if (voice_clarity_0_10 != null) {
      weightedSum += formula.coefficients.voice_clarity * voice_clarity_0_10;
      totalWeight += formula.coefficients.voice_clarity;
      subScoresUsed.push("voice_clarity");
    }
    if (audio_hook_first_2s_0_10 != null) {
      weightedSum += formula.coefficients.audio_hook * audio_hook_first_2s_0_10;
      totalWeight += formula.coefficients.audio_hook;
      subScoresUsed.push("audio_hook");
    }
    // voiceover_ratio is 0-1, scale to 0-10
    weightedSum += formula.coefficients.voiceover_ratio * (voiceover_ratio * 10);
    totalWeight += formula.coefficients.voiceover_ratio;
    subScoresUsed.push("voiceover_ratio");
  } else if (formula.mode === "ambient") {
    const { music_ratio, audio_description } = signals;
    weightedSum += formula.coefficients.music_ratio * (music_ratio * 10);
    totalWeight += formula.coefficients.music_ratio;
    subScoresUsed.push("music_ratio");
    weightedSum +=
      formula.coefficients.description_quality * descriptionQualityScore(audio_description);
    totalWeight += formula.coefficients.description_quality;
    subScoresUsed.push("description_quality");
  } else {
    // balanced — average all non-null sub-scores treating each on 0-10 scale
    const scores: number[] = [];
    if (signals.voice_clarity_0_10 != null) {
      scores.push(signals.voice_clarity_0_10);
      subScoresUsed.push("voice_clarity");
    }
    if (signals.audio_hook_first_2s_0_10 != null) {
      scores.push(signals.audio_hook_first_2s_0_10);
      subScoresUsed.push("audio_hook");
    }
    scores.push(signals.voiceover_ratio * 10);
    subScoresUsed.push("voiceover_ratio");
    scores.push(signals.music_ratio * 10);
    subScoresUsed.push("music_ratio");
    scores.push(descriptionQualityScore(signals.audio_description));
    subScoresUsed.push("description_quality");
    weightedSum = scores.reduce((a, b) => a + b, 0);
    totalWeight = scores.length;
  }

  // Renormalize: weightedSum / totalWeight ∈ [0, 10] → scale to [0, 100]
  const raw0to10 = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const score0to100 = Math.round(clamp(raw0to10 * 10, 0, 100));

  return {
    audio_perceptual_score: score0to100,
    formula_mode: formula.mode,
    sub_scores_used: subScoresUsed,
  };
}
