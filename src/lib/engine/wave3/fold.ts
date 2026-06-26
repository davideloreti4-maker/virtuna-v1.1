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
 * D-08 bounds: FOLD_MAX_TOKENS=8000 (thinking OFF — the fold is a simulation, not reasoning).
 * T-04-01 mitigation: FoldResponseSchema.safeParse + segment-count guard at model boundary.
 * T-04-02 mitigation: max_tokens + AbortController PER_CALL_TIMEOUT_MS.
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
  coerceFoldResponse,
  type FoldResponse,
} from "./fold-prompts";
import type { PersonaSlot } from "./persona-registry";
import { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } from "../qwen/client";
import { stripModelOutput } from "../utils/strip";
import type { PersonaSimulationResult, SegmentGrid, EmotionArcPoint } from "../types";
import type { Pass2PersonaResult } from "./weighted-aggregator";

const log = createLogger({ module: "wave3.fold" });

// =====================================================
// D-08 bounds — env-overridable for latency tuning.
// PER_CALL_TIMEOUT_MS mirrors pass2.ts:36 (CR-03 tail latency lesson).
// 90s is also the fold's LATENCY BUDGET: a hard ceiling, not a soft limit to be raised.
// If the fold can't fit, make the call cheaper (lower FOLD_MAX_TOKENS), don't extend it.
// FOLD_MAX_TOKENS: sized for 10-archetype × N-segment output.
// =====================================================

const PER_CALL_TIMEOUT_MS = 90_000;
// FOLD_MAX_TOKENS default 8000 (reconciled to MODEL-POLICY 2026-06-25): output scales with
// segment count (10 personas × N segments × {attention,swipe} + 6 intents each); 4000 risked
// truncation → Zod fail → silent audience-half drop on long videos. Unused max_tokens isn't
// billed (rail, not lever) — a tight cap is the only real risk. Override via env.
const FOLD_MAX_TOKENS = Number(process.env.FOLD_MAX_TOKENS) || 8000;
// Model (2026-06-25): qwen3.7-plus — SIGHTED (watches the video) but DEAF; audio arrives as
// text via Wave 0's per-segment `audio_event`. omni-flash retired from the fold — omni now runs
// ONLY as the Wave 0 sensor (the one place audio is ingested). plus is smart enough to keep the
// 10 personas DISTINCT: the old diversity collapse was a small-model + greedy + single-call
// artifact, not a model-capability limit. thinking stays OFF — this is a SIMULATION, not a
// reasoning task; the independence directive in fold-prompts.ts is the divergence lever.
// Env override: FOLD_MODEL=<raw model id> for experiments.
const FOLD_MODEL = process.env.FOLD_MODEL ?? QWEN_REASONING_MODEL;
// FOLD_TEMPERATURE default 0 (greedy = reproducible scores). Reproducibility is no longer a
// HARD requirement (2026-06-25); the diversity retry below auto-perturbs temperature on a
// collapse, and this env lets the operator raise the BASE temperature if needed.
const FOLD_TEMPERATURE = Number(process.env.FOLD_TEMPERATURE) || 0;
// On a diversity-collapse retry, PERTURB temperature so the re-attempt can actually diverge.
// (The old retry re-ran the identical deterministic call → byte-identical collapse = a no-op.)
const FOLD_DIVERSITY_RETRY_TEMP = Number(process.env.FOLD_DIVERSITY_RETRY_TEMP) || 0.7;
const COST_ALERT_THRESHOLD_CENTS = 50; // D-24 pattern from pass2.ts

// F18/F19/F20 (plan 01-05) — bounded fold retry: ONE re-attempt on a transient parse/
// validation/timeout failure (F18; salvage valid personas, F20) + one diversity retry-nudge
// (F19) that now PERTURBS temperature (FOLD_DIVERSITY_RETRY_TEMP) so it is no longer a no-op.
// Each attempt bounded by FOLD_ATTEMPT_TIMEOUT_MS; 2 × 45s = 90s = the PER_CALL_TIMEOUT_MS
// HARD ceiling, which is NEVER raised (PITFALL 2 — make the call cheaper, not the timeout).
const FOLD_RETRY_ATTEMPTS = 2;
// The 2 attempts share the 90s ceiling (45s each) — derived so the ceiling stays the single
// source of truth (never raise PER_CALL_TIMEOUT_MS; make the call cheaper instead).
const FOLD_ATTEMPT_TIMEOUT_MS =
  Number(process.env.FOLD_ATTEMPT_TIMEOUT_MS) || Math.floor(PER_CALL_TIMEOUT_MS / FOLD_RETRY_ATTEMPTS);
// F20 salvage floor — keep the audience read meaningful: succeed when ≥6 of 10 archetype personas
// have a valid segment-reaction count, dropping only the mismatched ones (was all-or-nothing).
const MIN_VALID_PERSONAS = 6;

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
 *   segment_reactions ← fold.segment_reactions (attention, swipe_predicted); t_start/t_end
 *                       re-attached from segments[i] by index (not requested from the model)
 *   pass2_latency_ms  = 0 (fold is a single call — no per-persona latency)
 *   pass2_cost_cents  = 0 (fold cost is tracked on Wave3FoldOutcome.cost_cents)
 * assembleHeatmapPayload derives swipe_predicted_at + segment_reasons from segment_reactions.
 */
export function adaptFoldToPass2Results(
  fold: FoldResponse,
  slots: PersonaSlot[],
  segments: SegmentGrid[],
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
      // t_start/t_end + reason dropped from the fold OUTPUT (2026-06-05) — they only
      // echoed the input grid / were discarded downstream. Timing is re-attached here
      // from segments[i] by index (the model returns one reaction per segment, in grid
      // order; the segment-count guard in runFold guarantees alignment). segment_reasons
      // downstream yields {} gracefully now that reason is gone.
      segment_reactions: persona.segment_reactions.map((r, i) => ({
        t_start: segments[i]?.t_start ?? 0,
        t_end: segments[i]?.t_end ?? 0,
        attention: r.attention,
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
 * Fire ONE bounded qwen3.7-plus call (sighted, deaf, thinking OFF) to produce behavioral
 * intents + segment reactions for all 10 archetypes simultaneously (the 20→1 fold).
 *
 * The call pattern mirrors pass2.ts:134-300 with these deltas:
 * - No 10× loop — single call covers all archetypes
 * - thinking OFF — a simulation, not a reasoning task (independence directive is the lever)
 * - FOLD_MAX_TOKENS (8000) caps the 10-archetype × N-segment response
 * - Bounded retry (2× 45s): parse/validation salvage + a temperature-perturbing diversity nudge
 *
 * Emits wave_3_fold stage events so the referee can assert exactly 1 audience-sim call.
 */
export async function runFold(
  slots: PersonaSlot[],
  segments: SegmentGrid[],
  verbatim: string,
  emotionArc: EmotionArcPoint[],
  videoUrl: string | null,
  onStageEvent?: StageEventCallback,
  // R1′b — per-archetype repaint map (archetype → reaction_frame) for the active calibrated
  // audience, built upstream via buildAudienceRepaint(audience). undefined for General/no
  // audience → buildFoldUserContent is byte-identical to pre-R1′b (regression-gate-safe).
  // A primitive map (not the Audience domain type) keeps this engine module isolated.
  audienceRepaint?: Record<string, string>,
): Promise<Wave3FoldOutcome> {
  const stageStart = emitStageStart(onStageEvent, "wave_3_fold", 4);

  const ai = getQwenClient();
  log.info("fold start", {
    model: FOLD_MODEL,
    segments: segments.length,
    // R1′b: true when a calibrated audience repaint is threaded in (vs generic archetypes).
    audience_repaint: audienceRepaint ? Object.keys(audienceRepaint).length : 0,
  });
  const warnings: string[] = [];
  let fold_success = false;
  let costCents = 0;
  let foldPersonas: FoldResponse | null = null; // set on a successful parse + (salvaged) segment guard
  // F19 fallback: a valid-but-homogenized result kept across a diversity retry-nudge so a failed
  // nudge re-attempt never costs us a usable (if homogenized) fold.
  let bestEffort: FoldResponse | null = null;

  // Build the bounded call ONCE — identical input across attempts (mirrors pass2.ts:157-181).
  const callParams = {
    model: FOLD_MODEL,
    messages: [
      { role: "system" as const, content: STABLE_FOLD_SYSTEM_PROMPT }, // byte-stable cache prefix (D-17)
      {
        role: "user" as const,
        content: buildFoldUserContent(slots, segments, verbatim, emotionArc, videoUrl, audienceRepaint) as never,
      },
    ],
    response_format: { type: "json_object" as const },
  };
  // @ts-expect-error — DashScope extension: thinking OFF (simulation, not reasoning)
  callParams.enable_thinking = false;
  // @ts-expect-error — seed pins residual sampling nondeterminism
  callParams.seed = QWEN_SEED;
  // @ts-expect-error — max_tokens caps the 10-archetype × N-segment output (D-08)
  callParams.max_tokens = FOLD_MAX_TOKENS;
  // temperature is set PER-ATTEMPT in the loop below: base FOLD_TEMPERATURE, then perturbed to
  // FOLD_DIVERSITY_RETRY_TEMP on a diversity-collapse retry (so the re-attempt can diverge).
  let attemptTemperature = FOLD_TEMPERATURE;

  // F18/F19/F20 (plan 01-05) — bounded retry loop. ONE re-attempt on a transient
  // parse/validation/timeout failure (F18) so a single hiccup no longer silently drops the
  // audience half; salvage valid personas instead of all-or-nothing (F20); one diversity
  // retry-nudge when the curves are homogenized (F19). Each attempt is bounded by
  // FOLD_ATTEMPT_TIMEOUT_MS; the 90s PER_CALL_TIMEOUT_MS ceiling is NEVER raised (PITFALL 2).
  for (let attempt = 1; attempt <= FOLD_RETRY_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FOLD_ATTEMPT_TIMEOUT_MS);
    // @ts-expect-error — DashScope temperature; perturbed on a diversity-collapse retry
    callParams.temperature = attemptTemperature;
    try {
      const response = await ai.chat.completions.create(callParams as never, { signal: controller.signal });
      clearTimeout(timer);

      // Cache-aware cost telemetry — ACCUMULATE across attempts (mirrors wave3.ts hasBreakdown).
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
      costCents += (inputCost + completion * OUTPUT_PRICE) * 100;

      // ROBUST parse: stripModelOutput removes <think>/fences + extracts the first balanced JSON
      // value (no-op on clean omni-plus, salvage on flash). Bare JSON.parse would throw → the
      // latent silent audience-half drop.
      const raw = response.choices[0]?.message?.content ?? "{}";
      const text = stripModelOutput(raw);
      const parsed = JSON.parse(text) as unknown;

      // Coerce small-model (omni-flash) TYPE/shape sloppiness before Zod — flash fails the
      // fold on FORMAT (non-number scroll_past_second, bare top-level array), not the TASK.
      // No-op on clean omni-plus output; salvages flash. Zod still enforces the 10-persona contract.
      const coerced = coerceFoldResponse(parsed);

      // T-04-01 mitigation: validate at the model boundary (V5).
      const validated = FoldResponseSchema.safeParse(coerced);
      if (!validated.success) {
        const msg = `fold validation failed (attempt ${attempt}/${FOLD_RETRY_ATTEMPTS}): ${validated.error.message}`;
        warnings.push(msg);
        Sentry.captureException(new Error(msg), { tags: { stage: "wave_3_fold", archetype: "all_10" } });
        continue; // F18 — retry on a transient parse/validation failure
      }

      // F20 salvage (T-04-01 segment-count guard): keep personas whose segment_reactions match
      // segments.length, DROP only the mismatched ones (was all-or-nothing). Succeed when ≥
      // MIN_VALID_PERSONAS remain so the audience read stays meaningful.
      const validPersonas = validated.data.personas.filter((p) => p.segment_reactions.length === segments.length);
      const mismatched = validated.data.personas.filter((p) => p.segment_reactions.length !== segments.length);
      if (mismatched.length > 0) {
        const archetypes = mismatched.map((p) => p.archetype).join(", ");
        const msg = `fold dropped ${mismatched.length} persona(s) with a segment-count mismatch: ${archetypes} (expected ${segments.length} each)`;
        warnings.push(msg);
        Sentry.captureException(new Error(msg), { tags: { stage: "wave_3_fold", archetype: "all_10" } });
      }
      if (validPersonas.length < MIN_VALID_PERSONAS) {
        warnings.push(
          `fold has only ${validPersonas.length}/${validated.data.personas.length} valid personas (< ${MIN_VALID_PERSONAS} floor) (attempt ${attempt}/${FOLD_RETRY_ATTEMPTS})`,
        );
        continue; // F18 — too few to trust; retry if attempts remain
      }

      const salvaged: FoldResponse = { ...validated.data, personas: validPersonas };

      // F19 diversity nudge: below DIVERSITY_FLOOR the curves are homogenized. Keep this result as
      // a fallback, then nudge ONE retry before accepting; on the final attempt, accept with the
      // warn-only fallback (never throw — D-07). The retry PERTURBS temperature so it can actually
      // diverge (a same-temp re-run of a deterministic call would just reproduce the collapse).
      const avgRange = computeAvgCurveRange(validPersonas);
      const { warn } = checkDiversityGuard(avgRange);
      if (warn && attempt < FOLD_RETRY_ATTEMPTS) {
        bestEffort = salvaged;
        attemptTemperature = FOLD_DIVERSITY_RETRY_TEMP;
        warnings.push(
          `fold diversity retry-nudge: avgCurveRange=${avgRange} below DIVERSITY_FLOOR=${DIVERSITY_FLOOR} (attempt ${attempt}) — retrying at temperature=${attemptTemperature} for diversity (D-07/F19)`,
        );
        continue;
      }
      if (warn) {
        warnings.push(
          `fold diversity guard: avgCurveRange=${avgRange} below DIVERSITY_FLOOR=${DIVERSITY_FLOOR} (accepted on final attempt) (D-07)`,
        );
      }

      foldPersonas = salvaged;
      fold_success = true;
      break;
    } catch (err) {
      clearTimeout(timer);
      const error = err instanceof Error ? err : new Error(String(err));
      const isTimeout = error.name === "AbortError";
      const msg = isTimeout
        ? `fold call aborted (FOLD_ATTEMPT_TIMEOUT_MS exceeded, attempt ${attempt}/${FOLD_RETRY_ATTEMPTS})`
        : `${error.message} (attempt ${attempt}/${FOLD_RETRY_ATTEMPTS})`;
      warnings.push(msg);
      Sentry.captureException(error, { tags: { stage: "wave_3_fold", archetype: "all_10" } });
      // loop retries if attempts remain (F18)
    }
  }

  // F19 fallback: if every attempt after a diversity nudge failed, accept the homogenized-but-valid
  // result rather than dropping the whole audience half (a homogenized fold beats no fold).
  if (!fold_success && bestEffort !== null) {
    warnings.push("fold accepted a homogenized result after the diversity retry-nudge re-attempt failed (F19 fallback)");
    foldPersonas = bestEffort;
    fold_success = true;
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
  const pass2Results = foldPersonas ? adaptFoldToPass2Results(foldPersonas, slots, segments) : [];
  const personaSimResults = foldPersonas ? adaptFoldToPersonaSimResults(foldPersonas, slots) : [];

  return {
    pass2Results,
    personaSimResults,
    warnings,
    cost_cents: waveCostCents,
    fold_success,
  };
}
