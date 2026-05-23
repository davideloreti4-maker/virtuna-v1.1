import * as Sentry from "@sentry/nextjs";
import { createLogger } from "@/lib/logger";
import type {
  ContentPayload,
  DeepSeekReasoning,
  PersonaSimulationResult,
  Wave0Result,
  PersonaBehavioralAggregate,
} from "./types";
import type { CreatorContext } from "./creator";
import type { StageEventCallback } from "./events";
import { emitStageStart, emitStageEnd } from "./events";
import { selectPersonaSlots, type PersonaSlot } from "./wave3/persona-registry";
import {
  buildPersonaSystemPrompt,
  buildPersonaUserMessage,
  PersonaResponseSchema,
} from "./wave3/persona-prompts";
import { aggregatePersonaResults } from "./wave3/aggregator";
import { isCircuitOpen } from "./deepseek";
import { getQwenClient, QWEN_FAST_MODEL } from "./qwen/client";

const log = createLogger({ module: "wave3" });

/**
 * Phase 7 PERSONA-09: uses QWEN_FAST_MODEL (qwen3.6-flash) — cheap, parallel-friendly,
 * thinking disabled via extra_body. Migrated from DeepSeek V4 Flash per DashScope International.
 */

/**
 * Qwen pricing — see src/lib/engine/qwen/cost.ts for authoritative rates.
 */
const CACHE_HIT_PRICE = 0.0028 / 1_000_000;
const CACHE_MISS_PRICE = 0.14 / 1_000_000;
const OUTPUT_PRICE = 0.28 / 1_000_000;

const PER_CALL_TIMEOUT_MS = 15_000;
const SUCCESS_THRESHOLD = 7; // D-13: ≥7-of-10 personas required for non-null aggregate

/**
 * Phase 7 Wave 3 outcome — widens the Phase 3 D-17 stub return shape.
 * - `aggregate`: PersonaBehavioralAggregate when ≥7 personas succeed; null otherwise.
 * - `results`: every successful PersonaSimulationResult (≤10 entries).
 * - `warnings`: per-persona failure messages + wave-level threshold warnings.
 * - `cost_cents`: wave-level cost roll-up across every persona call (success + failure paths
 *   that incurred provider charges). Surfaced so the aggregator can fold Wave 3 spend into
 *   `PredictionResult.cost_cents` (CR-01 fix) — otherwise the eval-runner cost cap is
 *   silently bypassed for hidden Wave 3 spend.
 */
export interface Wave3Outcome {
  aggregate: PersonaBehavioralAggregate | null;
  results: PersonaSimulationResult[];
  warnings: string[];
  cost_cents: number;
}

/**
 * Phase 7 contract: fires 10 parallel deepseek-chat calls — one per persona slot —
 * with per-slot stage events, ≥7-of-10 threshold (D-13), and graceful degradation.
 *
 * Per CONTEXT D-08: this signal is ADDITIVE on PredictionResult. The legacy
 * aggregator.ts read of deepseek.behavioral_predictions stays unchanged (Plan 07-03
 * adds an OPT-IN swap via the new behavioralSource param).
 *
 * Inherits the Phase 1 / Phase 3 graceful-degradation contract: NEVER throws.
 * Returns null aggregate + warning on any failure mode (circuit open, all 10 fail, etc.).
 */
export async function runWave3(
  payload: ContentPayload,
  deepseekResult: DeepSeekReasoning | null,
  wave0Result: Wave0Result,
  creatorContext: CreatorContext,
  onEvent?: StageEventCallback,
): Promise<Wave3Outcome> {
  const stageStart = emitStageStart(onEvent, "wave_3_personas", 3);

  // Circuit-breaker fast-fail (PATTERNS cross-cutting note #3) — don't burn 10 calls
  // when DeepSeek is known-down. isCircuitOpen is exported from deepseek.ts:736 (existing).
  if (isCircuitOpen()) {
    log.warn("Circuit breaker open — skipping Wave 3");
    emitStageEnd(onEvent, "wave_3_personas", 3, stageStart, {
      cost_cents: 0,
      ok: false,
      warning: "circuit_breaker_open",
    });
    return {
      aggregate: null,
      results: [],
      warnings: ["wave_3_circuit_breaker_open"],
      cost_cents: 0,
    };
  }

  // D-11: routing — wave0Result.content_type.type → 7-row allocation table → 10 slots.
  // D-10: null content_type OR mixed_content_detected warning → "other" row fallback
  // (handled inside selectPersonaSlots).
  const contentTypeSlug = wave0Result.content_type?.type ?? null;
  // D-17: niche shape changed from { primary, sub, micro, ... } to { primary_slug, micro_slug, confidence }
  const nicheSlug = wave0Result.niche?.primary_slug ?? null;

  let slots: PersonaSlot[];
  try {
    slots = selectPersonaSlots(contentTypeSlug, nicheSlug);
  } catch (err) {
    // Pitfall 2: selectPersonaSlots throws on length mismatch — defensive guard.
    const lastError = err instanceof Error ? err : new Error(String(err));
    Sentry.captureException(lastError, { tags: { stage: "wave_3_personas" } });
    log.error("selectPersonaSlots failed", { error: lastError.message });
    emitStageEnd(onEvent, "wave_3_personas", 3, stageStart, {
      cost_cents: 0,
      ok: false,
      warning: lastError.message,
    });
    return {
      aggregate: null,
      results: [],
      warnings: [`wave_3_slot_allocation_failed: ${lastError.message}`],
      cost_cents: 0,
    };
  }

  const ai = getQwenClient();
  let totalCostCents = 0;

  const callPersona = async (slot: PersonaSlot): Promise<PersonaSimulationResult> => {
    const stageName = `wave_3_persona_${slot.archetype}_${slot.slot_type}`;
    const callStart = emitStageStart(onEvent, stageName, 3);

    const systemPrompt = buildPersonaSystemPrompt(slot);
    const userMessage = buildPersonaUserMessage(
      payload,
      deepseekResult,
      creatorContext,
      wave0Result,
      slot,
    );

    let attempt = 0;
    let lastError: Error | null = null;
    // CR-02 / WR-04 fix: accumulate cost across ALL attempts. A successful first attempt
    // that fails Zod validation still incurs provider charges; the retry attempt adds more
    // charges on top. Without accumulation, the first-attempt charge is overwritten on
    // retry and lost from both per-call telemetry and wave-level total — breaking the
    // D-18 "per-call sum == wave-level total" invariant. We also credit terminal-failure
    // costs (WR-04) so failure modes don't systematically under-report wave-level spend.
    let callCostAccum = 0;

    while (attempt <= 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);
      let attemptCostCents = 0;
      try {
        const response = await ai.chat.completions.create(
          {
            model: QWEN_FAST_MODEL,
            messages: [
              { role: "system", content: systemPrompt }, // STABLE — cache prefix (D-17)
              { role: "user", content: userMessage }, // VOLATILE per-call
            ],
            response_format: { type: "json_object" },
          },
          { signal: controller.signal },
        );
        clearTimeout(timer);

        // Cache-aware cost telemetry — mirrors wave0/niche-detector.ts:89-102 (Phase 4 pattern).
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
        attemptCostCents = (inputCost + completion * OUTPUT_PRICE) * 100;
        callCostAccum += attemptCostCents;

        const text = response.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(text);
        const validated = PersonaResponseSchema.safeParse(parsed);
        if (!validated.success) {
          throw new Error(`validation failed: ${validated.error.message}`);
        }

        const result: PersonaSimulationResult = {
          persona_id: slot.persona_id,
          archetype: slot.archetype,
          slot_type: slot.slot_type,
          niche: slot.niche,
          ...validated.data,
        };

        emitStageEnd(onEvent, stageName, 3, callStart, {
          cost_cents: +callCostAccum.toFixed(6),
          ok: true,
        });
        // Add to wave-level total — accumulator includes any prior failed attempt's charge.
        totalCostCents += callCostAccum;
        return result;
      } catch (err) {
        clearTimeout(timer);
        lastError = err instanceof Error ? err : new Error(String(err));
        const isTimeout = lastError.name === "AbortError";
        const isValidation = lastError.message.includes("validation failed");

        // ONE retry only on validation failure; no retry on timeout, no retry on second attempt.
        if (isTimeout || attempt === 1 || !isValidation) {
          Sentry.captureException(lastError, {
            tags: {
              stage: "wave_3_persona",
              archetype: slot.archetype,
              slot_type: slot.slot_type,
            },
          });
          emitStageEnd(onEvent, stageName, 3, callStart, {
            cost_cents: +callCostAccum.toFixed(6),
            ok: false,
            warning: lastError.message,
          });
          // WR-04: credit any non-zero cost accumulated so far. If the API was actually
          // called (line 182-ish set attemptCostCents to a non-zero value), the provider
          // charged for it. AbortError typically aborts before usage is read, leaving the
          // accumulator at 0 — that path stays at 0 spend from our point of view (provider
          // reconciliation handled out of band).
          if (callCostAccum > 0) totalCostCents += callCostAccum;
          throw lastError;
        }
        attempt++;
        log.info("Retrying persona call after schema failure", {
          archetype: slot.archetype,
          slot_type: slot.slot_type,
          first_attempt_cost_cents: +attemptCostCents.toFixed(6),
        });
      }
    }
    throw lastError ?? new Error("Unreachable persona call state");
  };

  const settledResults = await Promise.allSettled(slots.map(callPersona));
  const survivors: PersonaSimulationResult[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < settledResults.length; i++) {
    const outcome = settledResults[i]!;
    if (outcome.status === "fulfilled") {
      survivors.push(outcome.value);
    } else {
      const slot = slots[i]!;
      const reason =
        outcome.reason instanceof Error
          ? outcome.reason.message
          : String(outcome.reason);
      warnings.push(`Persona ${slot.archetype}/${slot.slot_type} failed: ${reason}`);
    }
  }

  const { aggregate, warnings: aggregatorWarnings } = aggregatePersonaResults(
    survivors,
    SUCCESS_THRESHOLD,
  );
  warnings.push(...aggregatorWarnings);

  const waveCostCents = +totalCostCents.toFixed(4);
  emitStageEnd(onEvent, "wave_3_personas", 3, stageStart, {
    cost_cents: waveCostCents,
    ok: aggregate !== null,
    warning: aggregate === null ? "wave_3_below_threshold" : undefined,
  });

  return {
    aggregate,
    results: survivors,
    warnings,
    // CR-01: surface wave-level cost so the aggregator can fold it into PredictionResult.cost_cents.
    cost_cents: waveCostCents,
  };
}
