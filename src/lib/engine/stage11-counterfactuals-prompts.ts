/**
 * Phase 9 Plan 06 — Stage 11 Counterfactuals Prompts (Plan 09-06).
 *
 * Pure module exporting:
 * - `STABLE_COUNTERFACTUALS_SYSTEM_PROMPT` — byte-identical constant guiding
 *   V3 to generate 3 hyper-specific, ranked counterfactual suggestions.
 * - `buildCounterfactualsUserMessage(result)` — volatile per-request user message
 *   with PredictionResult context. Includes hook timestamp availability signal.
 * - `CounterfactualsResponseSchema` — Zod boundary validator enforcing exactly 3
 *   suggestions per CONTEXT.md D-17.
 *
 * Pattern source: `stage10-critique-prompts.ts` — same stable-prefix + volatile-tail.
 */
import { z } from "zod";
import type { PredictionResult } from "./types";

// =====================================================
// Cache-stable system prompt (D-17 pattern).
// Byte-identical constant — never interpolate dynamic content here.
// =====================================================

export const STABLE_COUNTERFACTUALS_SYSTEM_PROMPT = `You are a counterfactual suggestion generator for a short-form video analytics engine. Your job is to generate exactly 3 hyper-specific, ranked suggestions for improving the viral potential of analyzed content.

## Counterfactual Generation Rules

1. **Be Hyper-Specific:** Each suggestion must describe a concrete, actionable change — not generic advice. Describe exactly what to modify, where, and why.
2. **Anchor to Timestamps:** When timestamp data is provided in the user message, reference exact millisecond positions in the video timeline. Use the hook timestamp range as the primary anchor.
3. **No Timestamp Available:** When the user message indicates hook timestamps are unavailable (gemini_hook=false), set timestamp_ms=0 and write text-only suggestions that describe position-relative changes ("in the first 3 seconds", "at the transition point").
4. **Rank by Impact:** Order suggestions from highest to lowest expected impact on viral performance.
5. **Be Constructive:** Each suggestion must frame what TO change, not just what's wrong.
6. **Expected Impact must be Specific:** Describe the measurable outcome (e.g., "improves completion rate by 15-20%", "increases shareability by adding a pattern interrupt").

## Output Format

Return a JSON object with a single key "suggestions" containing exactly 3 objects. Each object must have:
- "change": string — what to change (concrete action)
- "timestamp_ms": number — approximate video timestamp in ms (0 when hook timestamps unavailable)
- "expected_impact": string — specific expected outcome`;

// =====================================================
// Per-request user message builder
// =====================================================

/**
 * Build a user message for the V3 counterfactuals call.
 * Includes PredictionResult context with signal_availability flags.
 *
 * @param result - Full PredictionResult from the aggregator
 * @returns Formatted user message string
 */
export function buildCounterfactualsUserMessage(
  result: PredictionResult,
): string {
  const hookAvailable = result.signal_availability?.gemini_hook ?? false;
  const hookStatus = hookAvailable
    ? "AVAILABLE — Phase 5 hook decomposition data exists. Anchor suggestions to the hook segment timing (first 0-3000ms)."
    : "UNAVAILABLE — No hook decomposition data. Set timestamp_ms=0 and use position-relative text.";

  return `## Content Analysis Summary

**Overall Score:** ${result.overall_score ?? "N/A"}/100
**Confidence:** ${result.confidence ?? "N/A"}
**Hook Timestamps:** ${hookStatus}

## Existing Suggestions (from engine)
${(result.suggestions ?? []).length > 0
    ? (result.suggestions ?? []).map((s, i) => `${i + 1}. [${s.priority}] ${s.text} (${s.category})`).join("\n")
    : "No existing suggestions from earlier stages."}

## Video Context
${result.reasoning ? `**DeepSeek Reasoning:** ${result.reasoning.slice(0, 500)}` : ""}
${result.feature_vector?.durationSeconds ? `**Duration:** ${result.feature_vector.durationSeconds}s` : ""}

## Instructions
Generate exactly 3 counterfactual suggestions ranked by impact. Each must be a concrete, actionable change different from the existing suggestions above.`;
}

// =====================================================
// Zod response schema — enforces exactly 3 suggestions
// =====================================================

export const CounterfactualsResponseSchema = z.object({
  suggestions: z
    .array(
      z.object({
        change: z.string().min(1, "change must be non-empty"),
        timestamp_ms: z.number().min(0, "timestamp_ms must be >= 0"),
        expected_impact: z.string().min(1, "expected_impact must be non-empty"),
      }),
    )
    .length(3, "exactly 3 counterfactual suggestions required"),
});
