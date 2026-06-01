/**
 * Phase 13 Plan 02 — Stage 11 Counterfactuals Prompts (rebuilt D-01..D-06).
 *
 * Pure module exporting:
 * - `STABLE_COUNTERFACTUALS_SYSTEM_PROMPT` — byte-stable system prompt for Gemini 3.1 Pro.
 *   (stable prefix for Gemini context caching — never interpolate dynamic content here)
 * - `buildSignalContextUserMessage(result)` — full signal context builder.
 *   D-03: NO truncation on result.reasoning. All sections present.
 * - `CounterfactualsResponseSchema` — discriminated-union Zod schema per band.
 *   D-05: low=3 fix, mid=2 fix+1 reinforcement, high=1 stretch+2-3 reinforcements.
 */
import { z } from "zod";
import type { PredictionResult } from "./types";
import { CREATOR_RULES_BLOCK } from "./creator-rules";

// =====================================================
// Cache-stable system prompt (byte-stable — never interpolate here).
// CREATOR_RULES_BLOCK is a build-time constant, so the prefix stays byte-identical.
// =====================================================

export const STABLE_COUNTERFACTUALS_SYSTEM_PROMPT = `You are a counterfactual suggestion generator for a short-form video analytics engine, trained on the explicit teachings of Jenny Hoyos, Ava Yuergens (@personalbrandlaunch), and Alex Hormozi. Your job is to generate band-adaptive suggestions based on the content's performance score band — every suggestion grounded in a named creator framework or numerical rule.

${CREATOR_RULES_BLOCK}

## Band Definitions

- **low** (score < 50): Content needs significant improvement. Generate 3 "fix" suggestions — concrete, actionable changes that address the most critical weaknesses.
- **mid** (score 50-74): Content is decent but has room to grow. Generate 2 "fix" suggestions and 1 "reinforcement" suggestion highlighting what's working well.
- **high** (score >= 75): Content is strong. Generate 1 "stretch" suggestion (ambitious enhancement) and 2-3 "reinforcement" suggestions highlighting strengths to double down on.

## Suggestion Rules

1. **Be Hyper-Specific:** Each suggestion must describe a concrete, actionable change — not generic advice. Describe exactly what to modify, where, and why.
2. **Anchor to Timestamps:** When timestamp data is available in the signal context, reference exact millisecond positions. Use hook timestamps as the primary anchor.
3. **No Timestamp Available:** When hook timestamps are unavailable (gemini_hook=false), set timestamp_ms=0 and write position-relative text ("in the first 3 seconds", "at the transition point").
4. **Rank by Impact:** Order suggestions from highest to lowest expected impact on viral performance.
5. **Signal Anchor:** For each suggestion, specify which signal it addresses (e.g., "hook_decomposition.visual_stop_power", "audio_signals.voice_clarity", "persona_dissent", "platform_fit").
6. **Headline + Detail:** headline is ≤ 80 chars, concise. detail is 1-2 sentences with specific expected outcome.
7. **Creator-Grounded:** every suggestion's detail must cite a named creator framework or numerical rule (e.g. "Per Hoyos, hook+foreshadow ≤3s; yours runs 4.8s"). No anonymous "best practice" advice.
8. **Hook-Weighted:** hooks decide ~80% of performance — at least half of "fix"/"stretch" suggestions must target the first 3 seconds.
9. **Vague-Hook Template:** when the hook is generic, rewrite it with Hormozi's Lead-Magnet Formula — [Number] + [Adjective] + [Audience] + [Outcome] + [Timeframe].
10. **Directional Scripts:** frame any script-rewrite as a directional starting point for a human writer, never as drop-in copy (Ava bans AI-written final scripts).
11. **Resolve Conflicts by Context:** when invoking a Conflicts rule (length, cadence, north-star metric), use the target platform + creator goal — never average.

## Output Format

Return a JSON object with these fields:
- "band": one of "low" | "mid" | "high"
- "suggestions": array of suggestion objects, each with:
  - "type": "fix" | "stretch" | "reinforcement"
  - "headline": string (≤ 80 chars)
  - "detail": string (1-2 sentences, specific expected outcome)
  - "timestamp_ms": number (video timestamp in ms; 0 when unavailable)
  - "signal_anchor": string (which signal this addresses)

Band-specific counts:
- low: exactly 3 items, all type="fix"
- mid: exactly 3 items — 2 type="fix" + 1 type="reinforcement"
- high: 3 items — 1 type="stretch" + 2 type="reinforcement" (or 4 items: 1 stretch + 3 reinforcement)`;

// =====================================================
// Per-request user message builder
// D-03: NO .slice(0, 500) truncation on result.reasoning.
// All sections present even when source field is null (use ?? "(none)" fallback).
// =====================================================

/**
 * Build the full signal context user message for Stage 11.
 * D-03 compliance: result.reasoning is untruncated.
 * All 7 sections present: Gemini Factor Scores, Hook Decomposition, Audio Signals,
 * Trend Matches, Persona Dissent, Platform Fit, DeepSeek Reasoning.
 *
 * @param result - Full PredictionResult from the aggregator
 * @returns Formatted user message string
 */
export function buildSignalContextUserMessage(result: PredictionResult): string {
  const score = result.overall_score ?? 0;
  const band: "low" | "mid" | "high" =
    score >= 75 ? "high" : score >= 50 ? "mid" : "low";

  // Gemini Factor Scores
  const factorsText =
    result.factors && result.factors.length > 0
      ? result.factors
          .map((f) => `  - ${f.name}: ${f.score}/10 — ${f.rationale}`)
          .join("\n")
      : "  (none)";

  // Hook Decomposition
  // HookDecomposition fields: visual_stop_power, audio_hook_quality, text_overlay_score,
  // first_words_speech_score, weakest_modality, visual_audio_coherence, cognitive_load
  const hookDecomp = result.hook_decomposition as Record<string, unknown> | null | undefined;
  const hookText = hookDecomp
    ? [
        `  visual_stop_power: ${hookDecomp["visual_stop_power"] ?? "N/A"}`,
        `  audio_hook_quality: ${hookDecomp["audio_hook_quality"] ?? "N/A"}`,
        `  text_overlay_score: ${hookDecomp["text_overlay_score"] ?? "N/A"}`,
        `  first_words_speech_score: ${hookDecomp["first_words_speech_score"] ?? "N/A"}`,
        `  visual_audio_coherence: ${hookDecomp["visual_audio_coherence"] ?? "N/A"}`,
        `  cognitive_load: ${hookDecomp["cognitive_load"] ?? "N/A"}`,
      ].join("\n")
    : "  (none)";

  // Audio Signals — sourced from signal_availability or feature_vector context
  // GeminiAudioSignals fields: voice_clarity_0_10, audio_hook_first_2s_0_10,
  // silence_ratio, voiceover_ratio, music_ratio, audio_description
  const audioSignals = result.audio_signals as Record<string, unknown> | null | undefined;
  const audioText = audioSignals
    ? [
        `  voice_clarity: ${audioSignals["voice_clarity_0_10"] ?? "N/A"}`,
        `  audio_hook_first_2s: ${audioSignals["audio_hook_first_2s_0_10"] ?? "N/A"}`,
        `  voiceover_ratio: ${audioSignals["voiceover_ratio"] ?? "N/A"}`,
        `  music_ratio: ${audioSignals["music_ratio"] ?? "N/A"}`,
        `  silence_ratio: ${audioSignals["silence_ratio"] ?? "N/A"}`,
        `  description: ${audioSignals["audio_description"] ?? "N/A"}`,
      ].join("\n")
    : "  (none)";

  // Trend Matches — from result.matched_trends (optional, Phase 13 Plan 02 extension)
  const trends = result.matched_trends ?? [];
  const trendsText =
    trends.length > 0
      ? trends
          .map(
            (t) =>
              `  - ${t.sound_name} (velocity: ${t.velocity_score}, phase: ${t.trend_phase ?? "unknown"})`,
          )
          .join("\n")
      : "  (none)";

  // Persona Dissent (personas with below-median engagement)
  const personas = result.persona_simulation_results ?? [];
  const personaDissent =
    personas.length > 0
      ? personas
          .filter((p) => p.watch_through_pct < 50 || p.share_intent < 30)
          .map(
            (p) =>
              `  - ${p.archetype} (${p.slot_type}): watch_through=${p.watch_through_pct}%, share_intent=${p.share_intent} — ${p.reasoning.slice(0, 150)}`,
          )
          .join("\n") || "  (none — all personas engaged)"
      : "  (none)";

  // Platform Fit
  const platformFit = result.platform_fit;
  const platformText = platformFit
    ? `  ${platformFit.platform}: fit_score=${platformFit.fit_score}/100 — ${platformFit.rationale}`
    : "  (none)";

  // DeepSeek Reasoning — UNTRUNCATED per D-03
  const reasoningText = result.reasoning ?? "(none)";

  return `## Overall Score: ${score}/100 (band: ${band})
## Confidence: ${result.confidence ?? "N/A"}

## Gemini Factor Scores
${factorsText}

## Hook Decomposition
${hookText}

## Audio Signals
${audioText}

## Trend Matches
${trendsText}

## Persona Dissent
${personaDissent}

## Platform Fit
${platformText}

## DeepSeek Reasoning
${reasoningText}

Generate band-adaptive suggestions for band="${band}". Return JSON matching the specified schema.`;
}

// =====================================================
// Band-adaptive response schema — D-05 counts REQUESTED via prompt, not hard-enforced.
//
// History: this was a strict discriminated union enforcing EXACT per-band counts
// (low=3 fix / mid=2 fix+1 reinf / high=1 stretch+2-3 reinf) plus an 80-char
// headline cap. Measured E2E run showed it returned NULL or forced a retry on
// well-formed model output that merely missed the exact count/type mix or ran a
// few chars over 80 — doubling Stage 11 latency to ~113s (timeout on attempt 0,
// success on attempt 1). Downstream consumers (assembleReasoningBuckets,
// verdict-derive, AntiViralityHeader) filter by `type`, never by exact count, so
// the strict counts bought nothing but null results.
//
// Now: keep `band` + a valid suggestion shape; let the PROMPT steer the counts
// (it still specifies them). Permissive array bounds (1-6) + a roomier headline
// cap absorb the model's natural variance instead of dropping the whole result.
// =====================================================

const SuggestionItemSchema = z.object({
  type: z.enum(["fix", "stretch", "reinforcement"]),
  headline: z.string().min(1).max(200),
  detail: z.string().min(1),
  timestamp_ms: z.number().min(0),
  signal_anchor: z.string(),
});

export const CounterfactualsResponseSchema = z.object({
  band: z.enum(["low", "mid", "high"]),
  suggestions: z.array(SuggestionItemSchema).min(1).max(6),
});

export type CounterfactualsResponse = z.infer<
  typeof CounterfactualsResponseSchema
>;
