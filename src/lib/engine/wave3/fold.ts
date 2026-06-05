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
import { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } from "../qwen/client";
import type { PersonaSimulationResult, SegmentGrid, EmotionArcPoint } from "../types";
import type { Pass2PersonaResult } from "./weighted-aggregator";

const log = createLogger({ module: "wave3.fold" });

// =====================================================
// D-08 bounds — env-overridable for latency tuning.
// PER_CALL_TIMEOUT_MS mirrors pass2.ts:36 (CR-03 tail latency lesson).
// FOLD_THINKING_BUDGET: 2× pass2's 2000 (single call outputs 10 archetypes).
// FOLD_MAX_TOKENS: sized for 10-archetype × N-segment output.
// =====================================================

const PER_CALL_TIMEOUT_MS = 90_000;
const FOLD_THINKING_BUDGET = Number(process.env.FOLD_THINKING_BUDGET) || 4000;
const FOLD_MAX_TOKENS = Number(process.env.FOLD_MAX_TOKENS) || 8000;
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
// Plan 03 adapter stubs — exported so fold-adapter.test.ts
// resolves its import; the real implementations live in Plan 03.
// =====================================================

// Plan 03 adapts
export function adaptFoldToPersonaSimResults(
  _fold: FoldResponse,
  _slots: PersonaSlot[],
): PersonaSimulationResult[] {
  // Plan 03 implements — returns [] so the fold compiles and the adapter test can import
  return [];
}

// Plan 03 adapts
export function adaptFoldToPass2Results(
  _fold: FoldResponse,
  _slots: PersonaSlot[],
): Pass2PersonaResult[] {
  // Plan 03 implements — returns [] so the fold compiles and the adapter test can import
  return [];
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);

  try {
    // Build the bounded call — mirrors pass2.ts:157-181 + PATTERNS.md §fold.ts.
    const callParams = {
      model: QWEN_REASONING_MODEL,
      messages: [
        { role: "system" as const, content: STABLE_FOLD_SYSTEM_PROMPT }, // byte-stable cache prefix (D-17)
        {
          role: "user" as const,
          content: buildFoldUserContent(slots, segments, keyframeUris, verbatim, emotionArc) as never,
        },
      ],
      response_format: { type: "json_object" as const },
    };

    // @ts-expect-error — DashScope extension: enable_thinking not in OpenAI types
    callParams.enable_thinking = true;
    // @ts-expect-error — DashScope extension: thinking_budget not in OpenAI types (D-08)
    callParams.thinking_budget = FOLD_THINKING_BUDGET;
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
        // D-07 diversity guard: warn when curves are homogenized.
        const avgRange = computeAvgCurveRange(validated.data.personas);
        checkDiversityGuard(avgRange);

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

  return {
    pass2Results: [], // Plan 03 adapts
    personaSimResults: [], // Plan 03 adapts
    warnings,
    cost_cents: waveCostCents,
    fold_success,
  };
}
