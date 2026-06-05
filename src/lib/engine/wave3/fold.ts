/**
 * Phase 4 Audience-Sim Fold — Single Bounded Thinking Call (Plan 04-02 Task 2).
 *
 * This is the 20→1 fold (R7): ONE qwen3.6-plus thinking call replaces the original
 * 20-call wave (10× Pass-1 + 10× Pass-2). The call emits BOTH behavioral intents AND
 * segment reactions for all 10 archetypes in one response.
 *
 * Mirrors src/lib/engine/wave3/pass2.ts orchestration for ONE call (no 10× loop):
 * - Same bounded call envelope (AbortController + PER_CALL_TIMEOUT_MS = 90s, CR-03 lesson)
 * - Same @ts-expect-error DashScope extension pattern (enable_thinking, thinking_budget, etc.)
 * - Same cache-aware cost telemetry (wave3.ts:171-188 hasBreakdown pattern)
 * - Same Sentry error capture with stage tags
 *
 * Adapters (adaptFoldToPersonaSimResults, adaptFoldToPass2Results) are Plan 03.
 * Diversity guard utility functions (computeAvgCurveRange, checkDiversityGuard) live here
 * as pure helpers used by this orchestrator post-parse, per PATTERNS.md §fold.ts.
 *
 * D-08 bounds: FOLD_THINKING_BUDGET=4000 (2× pass2's 2000), FOLD_MAX_TOKENS=8000.
 * T-04-01 mitigation: FoldResponseSchema.safeParse + segment-count guard at model boundary.
 * T-04-02 mitigation: thinking_budget + max_tokens + AbortController PER_CALL_TIMEOUT_MS.
 * T-04-03 mitigation: STABLE_FOLD_SYSTEM_PROMPT byte-stable (verified: no Date.now/Math.random calls).
 */

import * as Sentry from "@sentry/nextjs";
import { createLogger } from "@/lib/logger";
import type { StageEventCallback } from "../events";
import { emitStageStart, emitStageEnd } from "../events";
import {
  STABLE_FOLD_SYSTEM_PROMPT,
  buildFoldUserContent,
  FoldResponseSchema,
  type FoldResponse,
} from "./fold-prompts";
import type { PersonaSlot } from "./persona-registry";
import { getQwenClient, QWEN_REASONING_MODEL, QWEN_FAST_MODEL, QWEN_SEED } from "../qwen/client";
import type { PersonaSimulationResult, SegmentGrid, EmotionArcPoint } from "../types";
import type { Pass2PersonaResult } from "./weighted-aggregator";

const log = createLogger({ module: "wave3.fold" });

// =====================================================
// D-08 bounds — env-overridable for latency tuning.
// PER_CALL_TIMEOUT_MS mirrors pass2.ts:36 (CR-03 tail latency lesson).
// 90s is also the fold's LATENCY BUDGET: the fold only earns the flip if its
// single call beats the 10-pass on wall-clock, so the cap is a hard ceiling,
// not a soft limit to be raised. If the fold can't fit, make it cheaper
// (lower FOLD_THINKING_BUDGET), don't extend the timeout.
// FOLD_THINKING_BUDGET: 2× pass2's 2000 (single call outputs 10 archetypes).
// FOLD_MAX_TOKENS: sized for 10-archetype × N-segment output.
// =====================================================

const PER_CALL_TIMEOUT_MS = 90_000;
// FOLD_THINKING_BUDGET default 1000: A/B-validated (2026-06-05) — budget=1000 returned
// in 89.9s (just under PER_CALL_TIMEOUT_MS=90s) with diverse curves on the good video.
// Margin is thin; future work may trim FOLD_MAX_TOKENS for additional headroom.
// Do NOT raise PER_CALL_TIMEOUT_MS — the fold only earns the flip if it beats the 10-pass.
const FOLD_THINKING_BUDGET = Number(process.env.FOLD_THINKING_BUDGET) || 1000;
const FOLD_MAX_TOKENS = Number(process.env.FOLD_MAX_TOKENS) || 8000;
// P4 flip (A/B-validated 2026-06-05): the fold runs on qwen3.6-flash WITHOUT thinking
// by DEFAULT. Why: flash lands the single fold call at ~25-62s vs plus's ~88s — plus hit
// the 90s wall and timed out on long videos. Diversity held above the D-07 floor; behavioral
// score 67-73 ≈ the deleted 10-pass's 72.5. Thinking on flash is a no-op (no quality gain,
// within run-to-run noise). Escape hatches:
//   FOLD_MODEL=plus   → qwen3.6-plus reasoning model (higher/tighter score, ~88s — short videos only)
//   FOLD_THINKING=1   → re-enable enable_thinking + thinking_budget (only meaningful with FOLD_MODEL=plus)
const FOLD_MODEL = process.env.FOLD_MODEL === "plus" ? QWEN_REASONING_MODEL : QWEN_FAST_MODEL;
const FOLD_USE_THINKING = process.env.FOLD_THINKING === "1";
const COST_ALERT_THRESHOLD_CENTS = 50; // D-24 pattern from pass2.ts

// Cache-aware pricing constants — mirrors wave3.ts:34-36.
const CACHE_HIT_PRICE = 0.0028 / 1_000_000;
const CACHE_MISS_PRICE = 0.14 / 1_000_000;
const OUTPUT_PRICE = 0.28 / 1_000_000;

// =====================================================
// Diversity guard (D-07) — pure utilities.
// Formula mirrors measure-pipeline.ts:146-160 (per-persona max−min, mean over all 10).
// These are exported here so fold-diversity-guard.test.ts can unit-test them in isolation.
// =====================================================

/** Minimum acceptable mean attention range across archetypes (D-07). */
export const DIVERSITY_FLOOR = 0.10;

/** Subset of FoldResponse.personas needed by the diversity computation. */
type PersonaWithReactions = {
  segment_reactions: { attention: number }[];
};

/**
 * Compute the mean of (max_attention − min_attention) across all personas.
 * Mirrors the avg-curve-range metric in measure-pipeline.ts:146-160.
 * Returns 0 when any persona has empty reactions.
 */
export function computeAvgCurveRange(personas: PersonaWithReactions[]): number {
  const ranges: number[] = [];
  for (const p of personas) {
    const att = p.segment_reactions.map((r) => r.attention);
    if (!att.length) continue;
    const range = +(Math.max(...att) - Math.min(...att)).toFixed(2);
    ranges.push(range);
  }
  return ranges.length ? +(ranges.reduce((a, b) => a + b, 0) / ranges.length).toFixed(2) : 0;
}

/**
 * Check diversity guard — warns when avgRange falls below DIVERSITY_FLOOR (D-07).
 * Never throws — warn only, let the A/B referee gate the production flip.
 */
export function checkDiversityGuard(avgRange: number): { warn: boolean } {
  if (avgRange < DIVERSITY_FLOOR) {
    log.warn("fold diversity guard: curves may be homogenized (D-07)", {
      avgRange,
      floor: DIVERSITY_FLOOR,
    });
    return { warn: true };
  }
  return { warn: false };
}

// =====================================================
// Wave3FoldOutcome — the fold's output shape.
// pass2Results + personaSimResults are populated by Plan 03 adapters.
// fold_success reflects only that the LLM call parsed successfully.
// =====================================================

export interface Wave3FoldOutcome {
  pass2Results: Pass2PersonaResult[];           // Plan 03 adapts — [] until then
  personaSimResults: PersonaSimulationResult[]; // Plan 03 adapts — [] until then
  warnings: string[];
  cost_cents: number;
  fold_success: boolean; // true when FoldResponseSchema.safeParse succeeded + segment-count guard passed
}

// =====================================================
// Plan 03 adapters — lossless mapping from FoldResponse to the two engine-compatible shapes.
// D-11/D-12: aggregatePersonaResults + buildWeightedCurve are NOT modified; the fold output
// is adapted to their input shapes instead.
// =====================================================

/**
 * niche_deep → niche slot_type map (Pitfall 5 / T-04-04 mitigation).
 * Pass2PersonaResult.slot_type has 4 values: fyp, niche, loyalist, cross_niche.
 * PersonaSlot.slot_type has a 5th value: niche_deep — which maps to the "niche" weight bucket.
 * assembleHeatmapPayload:240 applies the same map — this adapter must match exactly.
 */
function mapSlotType(
  slotType: string,
): "fyp" | "niche" | "loyalist" | "cross_niche" {
  if (slotType === "niche_deep") return "niche";
  return slotType as "fyp" | "niche" | "loyalist" | "cross_niche";
}

/**
 * Build a slot lookup map keyed by persona_id for O(1) access.
 * Falls back to archetype-keyed lookup when persona_id doesn't match.
 */
function buildSlotMap(slots: PersonaSlot[]): Map<string, PersonaSlot> {
  const map = new Map<string, PersonaSlot>();
  for (const slot of slots) {
    map.set(slot.persona_id, slot);
    // Also index by archetype for fallback (some fold fixture archetypes share the pattern)
    if (!map.has(slot.archetype)) map.set(slot.archetype, slot);
  }
  return map;
}

/**
 * Adapt FoldResponse → PersonaSimulationResult[] (Pass-1 shape).
 * aggregatePersonaResults accepts this array without modification (D-11).
 *
 * Field mapping (RESEARCH §Lossless output mapping):
 *   persona_id ← fold.persona_id
 *   archetype  ← fold.archetype (as string — typed assertion to PersonaArchetype for schema compat)
 *   slot_type  ← matching slot.slot_type (niche_deep allowed — PersonaSimulationResultSchema includes it)
 *   niche      ← matching slot.niche
 *   watch_through_pct ← fold.watch_through_pct
 *   share_intent      ← fold.share_intent
 *   comment_intent    ← fold.comment_intent
 *   save_intent       ← fold.save_intent
 *   rewatch_intent    ← fold.rewatch_intent
 *   scroll_past_second ← fold.scroll_past_second
 *   reasoning  ← synthesized from archetype (required field with min(1), not in fold output)
 */
export function adaptFoldToPersonaSimResults(
  fold: FoldResponse,
  slots: PersonaSlot[],
): PersonaSimulationResult[] {
  const slotMap = buildSlotMap(slots);
  return fold.personas.map((persona) => {
    // Prefer persona_id match, fall back to archetype match
    const slot = slotMap.get(persona.persona_id) ?? slotMap.get(persona.archetype);
    return {
      persona_id: persona.persona_id,
      archetype: persona.archetype as PersonaSimulationResult["archetype"],
      slot_type: (slot?.slot_type ?? "fyp") as PersonaSimulationResult["slot_type"],
      niche: slot?.niche ?? "general",
      watch_through_pct: persona.watch_through_pct,
      share_intent: persona.share_intent,
      comment_intent: persona.comment_intent,
      save_intent: persona.save_intent,
      rewatch_intent: persona.rewatch_intent,
      scroll_past_second: persona.scroll_past_second,
      // reasoning is required (min 1) but absent from fold output — synthesize from archetype
      reasoning: `fold-derived: ${persona.archetype}`,
    };
  });
}

/**
 * Adapt FoldResponse → Pass2PersonaResult[] (Pass-2 shape).
 * buildWeightedCurve + assembleHeatmapPayload accept this array without modification (D-12).
 *
 * Field mapping (RESEARCH §Lossless output mapping):
 *   persona_id     ← fold.persona_id
 *   slot_type      ← mapSlotType(slot.slot_type)  — niche_deep→niche (Pitfall 5 / T-04-04)
 *   archetype      ← fold.archetype
 *   segment_reactions ← fold.segment_reactions (t_start, t_end, attention, reason, swipe_predicted)
 *   pass2_latency_ms  = 0 (fold is a single call — no per-persona latency)
 *   pass2_cost_cents  = 0 (fold cost is tracked on Wave3FoldOutcome.cost_cents)
 * assembleHeatmapPayload derives swipe_predicted_at + segment_reasons from segment_reactions.
 */
export function adaptFoldToPass2Results(
  fold: FoldResponse,
  slots: PersonaSlot[],
): Pass2PersonaResult[] {
  const slotMap = buildSlotMap(slots);
  return fold.personas.map((persona) => {
    const slot = slotMap.get(persona.persona_id) ?? slotMap.get(persona.archetype);
    // Pitfall 5 / T-04-04: apply the niche_deep→niche map (same map assembleHeatmapPayload:240 uses)
    const slotType = mapSlotType(slot?.slot_type ?? "fyp");

    return {
      persona_id: persona.persona_id,
      archetype: persona.archetype as Pass2PersonaResult["archetype"],
      slot_type: slotType,
      segment_reactions: persona.segment_reactions.map((r) => ({
        t_start: r.t_start,
        t_end: r.t_end,
        attention: r.attention,
        reason: r.reason,
        swipe_predicted: r.swipe_predicted,
      })),
      pass2_latency_ms: 0,   // fold is a single call — no per-persona latency
      pass2_cost_cents: 0,   // fold cost tracked on Wave3FoldOutcome.cost_cents
    } satisfies Pass2PersonaResult;
  });
}

// =====================================================
// runFold — the single bounded qwen3.6-plus thinking call (R7 / one audience-sim call).
// =====================================================

/**
 * Fire ONE bounded qwen3.6-plus thinking call to produce behavioral intents + segment
 * reactions for all 10 archetypes simultaneously (the 20→1 fold).
 *
 * The call pattern mirrors pass2.ts:134-300 with these deltas:
 * - No 10× loop — single call covers all archetypes
 * - FOLD_THINKING_BUDGET (4000) vs PASS2_THINKING_BUDGET (2000): larger output shape
 * - FOLD_MAX_TOKENS (8000) caps the 10-archetype × N-segment response
 * - No retry loop — one attempt + validate + segment-count guard
 *
 * Emits wave_3_fold stage events so the referee can assert exactly 1 audience-sim call.
 */
export async function runFold(
  slots: PersonaSlot[],
  segments: SegmentGrid[],
  keyframeUris: (string | null)[],
  verbatim: string,
  emotionArc: EmotionArcPoint[],
  onStageEvent?: StageEventCallback,
): Promise<Wave3FoldOutcome> {
  const stageStart = emitStageStart(onStageEvent, "wave_3_fold", 4);

  const ai = getQwenClient();
  const warnings: string[] = [];
  let fold_success = false;
  let costCents = 0;
  let foldPersonas: FoldResponse | null = null; // set on successful parse + segment-count guard

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);

  try {
    // Build the bounded call — mirrors pass2.ts:157-181 + PATTERNS.md §fold.ts.
    const callParams = {
      model: FOLD_MODEL,
      messages: [
        { role: "system" as const, content: STABLE_FOLD_SYSTEM_PROMPT }, // byte-stable cache prefix (D-17)
        {
          role: "user" as const,
          content: buildFoldUserContent(slots, segments, keyframeUris, verbatim, emotionArc) as never,
        },
      ],
      response_format: { type: "json_object" as const },
    };

    if (FOLD_USE_THINKING) {
      // @ts-expect-error — DashScope extension: enable_thinking not in OpenAI types
      callParams.enable_thinking = true;
      // @ts-expect-error — DashScope extension: thinking_budget not in OpenAI types (D-08)
      callParams.thinking_budget = FOLD_THINKING_BUDGET;
    }
    // @ts-expect-error — temperature:0 + seed = reproducible fold scores (R8)
    callParams.temperature = 0;
    // @ts-expect-error — seed pins residual nondeterminism in thinking mode (R8)
    callParams.seed = QWEN_SEED;
    // @ts-expect-error — max_tokens caps the 10-archetype × N-segment output (D-08)
    callParams.max_tokens = FOLD_MAX_TOKENS;

    const response = await ai.chat.completions.create(
      callParams as never,
      { signal: controller.signal },
    );
    clearTimeout(timer);

    // Cache-aware cost telemetry — mirrors wave3.ts:171-188 hasBreakdown pattern verbatim.
    const usage = response.usage as unknown as
      | {
          prompt_tokens?: number;
          prompt_cache_hit_tokens?: number;
          prompt_cache_miss_tokens?: number;
          completion_tokens?: number;
        }
      | undefined;
    const cacheHit = usage?.prompt_cache_hit_tokens ?? 0;
    const cacheMiss = usage?.prompt_cache_miss_tokens ?? 0;
    const completion = usage?.completion_tokens ?? 0;
    const hasBreakdown = cacheHit > 0 || cacheMiss > 0;
    const inputCost = hasBreakdown
      ? cacheHit * CACHE_HIT_PRICE + cacheMiss * CACHE_MISS_PRICE
      : (usage?.prompt_tokens ?? 0) * CACHE_MISS_PRICE;
    costCents = (inputCost + completion * OUTPUT_PRICE) * 100;

    const text = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text) as unknown;

    // T-04-01 mitigation: validate at the model boundary (V5).
    const validated = FoldResponseSchema.safeParse(parsed);

    if (!validated.success) {
      const msg = `fold validation failed: ${validated.error.message}`;
      warnings.push(msg);
      Sentry.captureException(new Error(msg), {
        tags: { stage: "wave_3_fold", archetype: "all_10" },
      });
    } else {
      // T-04-01 mitigation: segment-count guard — mirrors pass2.ts:197-201.
      // Each persona's segment_reactions.length must match segments.length.
      const mismatchedPersonas = validated.data.personas.filter(
        (p) => p.segment_reactions.length !== segments.length,
      );
      if (mismatchedPersonas.length > 0) {
        const archetypes = mismatchedPersonas.map((p) => p.archetype).join(", ");
        const msg = `fold segment-count mismatch for archetypes: ${archetypes} (expected ${segments.length} reactions each)`;
        warnings.push(msg);
        Sentry.captureException(new Error(msg), {
          tags: { stage: "wave_3_fold", archetype: "all_10" },
        });
      } else {
        // D-07 diversity guard: warn when curves are homogenized (warn-only per D-07, never throw).
        const avgRange = computeAvgCurveRange(validated.data.personas);
        const { warn } = checkDiversityGuard(avgRange);
        if (warn) {
          warnings.push(`fold diversity guard: avgCurveRange=${avgRange} below DIVERSITY_FLOOR=${DIVERSITY_FLOOR} (D-07)`);
        }

        // Plan 03 adapters: stash validated data for post-try adapter calls.
        foldPersonas = validated.data;
        fold_success = true;
      }
    }
  } catch (err) {
    clearTimeout(timer);
    const error = err instanceof Error ? err : new Error(String(err));
    const isTimeout = error.name === "AbortError";
    const msg = isTimeout ? "fold call aborted (PER_CALL_TIMEOUT_MS exceeded)" : error.message;
    warnings.push(msg);
    Sentry.captureException(error, {
      tags: { stage: "wave_3_fold", archetype: "all_10" },
    });
  }

  // D-24 cost ceiling alert (mirrors pass2.ts pattern).
  if (costCents > COST_ALERT_THRESHOLD_CENTS) {
    log.error("fold cost ceiling exceeded", {
      cost_cents: costCents,
      threshold_cents: COST_ALERT_THRESHOLD_CENTS,
    });
    Sentry.captureException(new Error("fold_cost_ceiling"), {
      tags: { stage: "wave_3_fold" },
    });
  }

  const waveCostCents = +costCents.toFixed(4);

  emitStageEnd(onStageEvent, "wave_3_fold", 4, stageStart, {
    cost_cents: waveCostCents,
    ok: fold_success,
    warning: fold_success ? undefined : "wave_3_fold_failed",
  });

  // Plan 03 adapters: populate pass2Results + personaSimResults from the validated fold output.
  // Empty arrays when fold_success=false (parse failed or segment-count mismatch) so the
  // aggregator can detect fold_success=false and fall back gracefully.
  const pass2Results = foldPersonas ? adaptFoldToPass2Results(foldPersonas, slots) : [];
  const personaSimResults = foldPersonas ? adaptFoldToPersonaSimResults(foldPersonas, slots) : [];

  return {
    pass2Results,
    personaSimResults,
    warnings,
    cost_cents: waveCostCents,
    fold_success,
  };
}
