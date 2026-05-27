/**
 * Phase 3 Pass 2 — Per-Persona Timeline Orchestrator (Plan 06 Task 2).
 *
 * Mirrors src/lib/engine/wave3.ts end-to-end with these deltas:
 * - model = QWEN_REASONING_MODEL ("qwen3.6-plus")
 * - enable_thinking: true + thinking_budget: 8000
 * - PER_CALL_TIMEOUT_MS = 60_000 (thinking-mode slower than flash)
 * - Input: segments[], keyframeUris[], pass1Results[], demo?
 * - Output: Wave3Pass2Outcome (pass2Results, warnings, cost_cents, pass2_success_count, pass2_aggregate_built)
 *
 * D-23: logs pass2_latency_ms + pass2_cost_cents per persona.
 * D-24: flags cost ceiling at 50 cents/analysis.
 * T-03-06-04: thinking_budget: 8000 caps per-call tokens.
 */
import * as Sentry from "@sentry/nextjs";
import { createLogger } from "@/lib/logger";
import type { StageEventCallback } from "../events";
import { emitStageStart, emitStageEnd } from "../events";
import { selectPersonaSlots, type PersonaSlot } from "./persona-registry";
import {
  STABLE_PASS2_SYSTEM_PROMPT,
  buildPass2UserContent,
  Pass2ResponseSchema,
  type DemographicContext,
} from "./persona-prompts-pass2";
import { getQwenClient, QWEN_REASONING_MODEL } from "../qwen/client";
import { calculateCost } from "../qwen/cost";
import type { PersonaSimulationResult, SegmentGrid } from "../types";

// Re-export Pass2PersonaResult — single source of truth lives in weighted-aggregator.ts (Plan 04).
export type { Pass2PersonaResult } from "./weighted-aggregator";
import type { Pass2PersonaResult } from "./weighted-aggregator";

const log = createLogger({ module: "wave3.pass2" });

const PER_CALL_TIMEOUT_MS = 60_000; // thinking-mode is slower than flash (was 45_000)
const SUCCESS_THRESHOLD = 7; // D-06: ≥7/10 Pass 2 successes for non-null heatmap
const COST_ALERT_THRESHOLD_CENTS = 50; // D-24: 0.50 dollars

/**
 * Phase 3 D-06 Pass 2 wave outcome.
 * - pass2Results: successful per-persona results.
 * - warnings: per-persona failure messages.
 * - cost_cents: wave-level cost roll-up.
 * - pass2_success_count: number of successful personas.
 * - pass2_aggregate_built: true when ≥7/10 succeeded (D-06).
 */
export interface Wave3Pass2Outcome {
  pass2Results: Pass2PersonaResult[];
  warnings: string[];
  cost_cents: number;
  pass2_success_count: number;
  pass2_aggregate_built: boolean;
}

/**
 * Phase 3 Pass 2 orchestrator — fires 10 parallel qwen3.6-plus thinking-mode calls,
 * one per persona slot, each receiving segments + keyframeUris + pass1 verdict + archetype.
 *
 * Mirrors wave3.ts: Promise.allSettled, retry-once on Zod failure, D-23 telemetry,
 * D-24 cost ceiling. Returns pass2_aggregate_built=false when < 7 succeed.
 */
export async function runWave3Pass2(
  segments: SegmentGrid[],
  keyframeUris: (string | null)[],
  pass1Results: PersonaSimulationResult[],
  demo?: DemographicContext,
  onEvent?: StageEventCallback,
): Promise<Wave3Pass2Outcome> {
  const stageStart = emitStageStart(onEvent, "wave_3_pass2", 3);

  // D-11: routing — use "other" fallback since we don't re-run slot selection here.
  // Slots are pre-determined by the upstream pipeline using wave0 content_type + niche.
  // For Pass 2 we use the same 10 slots as Pass 1 — selectPersonaSlots with null args gives
  // the "other" row (6 fyp / 2 niche_deep / 1 loyalist / 1 cross_niche = 10 slots).
  const slots = selectPersonaSlots(null, null);

  const ai = getQwenClient();
  let totalCostCents = 0;

  const callPersona = async (
    slot: PersonaSlot,
    pass1: PersonaSimulationResult,
  ): Promise<Pass2PersonaResult> => {
    const stageName = `wave_3_pass2_persona_${slot.archetype}_${slot.slot_type}`;
    const callStart = emitStageStart(onEvent, stageName, 3);

    // Emit pass2_persona_start event (Plan 02 event type)
    onEvent?.({
      type: "pass2_persona_start",
      persona_id: slot.persona_id,
      archetype: slot.archetype,
    });

    let attempt = 0;
    let lastError: Error | null = null;
    // Accumulate cost across ALL attempts (CR-02 / WR-04 pattern from wave3.ts).
    let callCostAccum = 0;

    while (attempt <= 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);
      let attemptCostCents = 0;

      try {
        // Build call params with DashScope extensions (not in OpenAI types).
        const callParams = {
          model: QWEN_REASONING_MODEL,
          messages: [
            { role: "system" as const, content: STABLE_PASS2_SYSTEM_PROMPT }, // STABLE — cache prefix (D-17)
            {
              role: "user" as const,
              content: buildPass2UserContent(slot, pass1, segments, keyframeUris, demo) as never,
            },
          ],
          response_format: { type: "json_object" as const },
        };
        // @ts-expect-error — DashScope extension: enable_thinking not in OpenAI types
        callParams.enable_thinking = true;
        // @ts-expect-error — DashScope extension: thinking_budget not in OpenAI types (T-03-06-04)
        callParams.thinking_budget = 8000;
        const response = await ai.chat.completions.create(
          callParams as never,
          { signal: controller.signal },
        );
        clearTimeout(timer);

        // Cost telemetry — mirrors wave3.ts pattern using calculateCost helper.
        attemptCostCents = calculateCost(QWEN_REASONING_MODEL, response.usage ?? undefined);
        callCostAccum += attemptCostCents;

        const text = response.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(text) as unknown;
        const validated = Pass2ResponseSchema.safeParse(parsed);

        if (!validated.success) {
          throw new Error(`validation failed: ${validated.error.message}`);
        }

        // D-06 quality guard: segment count must match exactly
        if (validated.data.segment_reactions.length !== segments.length) {
          throw new Error(
            `validation failed: segment_reactions.length mismatch (${validated.data.segment_reactions.length} vs ${segments.length})`,
          );
        }

        const latencyMs = Math.round(performance.now() - callStart);
        const costCents = +callCostAccum.toFixed(6);

        const result: Pass2PersonaResult = {
          persona_id: slot.persona_id,
          archetype: slot.archetype as Pass2PersonaResult["archetype"],
          slot_type: slot.slot_type as Pass2PersonaResult["slot_type"],
          segment_reactions: validated.data.segment_reactions,
          pass2_latency_ms: latencyMs,
          pass2_cost_cents: costCents,
        };

        // D-23 telemetry: log per-persona latency + cost
        log.info("pass2 persona complete", {
          archetype: slot.archetype,
          persona_id: slot.persona_id,
          pass2_latency_ms: latencyMs,
          pass2_cost_cents: costCents,
        });

        // Emit pass2_persona_end event (success path)
        onEvent?.({
          type: "pass2_persona_end",
          persona_id: slot.persona_id,
          archetype: slot.archetype,
          latency_ms: latencyMs,
          cost_cents: costCents,
          ok: true,
        });

        emitStageEnd(onEvent, stageName, 3, callStart, {
          cost_cents: costCents,
          ok: true,
        });

        totalCostCents += callCostAccum;
        return result;
      } catch (err) {
        clearTimeout(timer);
        lastError = err instanceof Error ? err : new Error(String(err));
        const isTimeout = lastError.name === "AbortError";
        const isValidation = lastError.message.includes("validation failed");

        // ONE retry only on validation failure; no retry on timeout or second attempt.
        if (isTimeout || attempt === 1 || !isValidation) {
          Sentry.captureException(lastError, {
            tags: {
              stage: "wave_3_pass2",
              archetype: slot.archetype,
              slot_type: slot.slot_type,
            },
          });

          // Emit pass2_persona_end event (error path)
          onEvent?.({
            type: "pass2_persona_end",
            persona_id: slot.persona_id,
            archetype: slot.archetype,
            latency_ms: Math.round(performance.now() - callStart),
            cost_cents: +callCostAccum.toFixed(6),
            ok: false,
          });

          emitStageEnd(onEvent, stageName, 3, callStart, {
            cost_cents: +callCostAccum.toFixed(6),
            ok: false,
            warning: lastError.message,
          });

          // WR-04: credit any cost accumulated before failure
          if (callCostAccum > 0) totalCostCents += callCostAccum;
          throw lastError;
        }

        attempt++;
        log.info("Retrying Pass 2 persona call after schema failure", {
          archetype: slot.archetype,
          slot_type: slot.slot_type,
          first_attempt_cost_cents: +attemptCostCents.toFixed(6),
        });
      }
    }

    throw lastError ?? new Error("Unreachable Pass 2 persona call state");
  };

  const settledResults = await Promise.allSettled(
    slots.map((slot, i) => callPersona(slot, pass1Results[i]!)),
  );

  const pass2Results: Pass2PersonaResult[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < settledResults.length; i++) {
    const outcome = settledResults[i]!;
    if (outcome.status === "fulfilled") {
      pass2Results.push(outcome.value);
    } else {
      const slot = slots[i]!;
      const reason =
        outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
      warnings.push(`Persona ${slot.archetype}/${slot.slot_type} failed: ${reason}`);
    }
  }

  const pass2_success_count = pass2Results.length;
  const pass2_aggregate_built = pass2_success_count >= SUCCESS_THRESHOLD;

  // D-24 cost ceiling: flag if any single analysis Pass 2 exceeds 0.50 dollars
  if (totalCostCents > COST_ALERT_THRESHOLD_CENTS) {
    log.error("pass2 cost ceiling exceeded", {
      total_cost_cents: totalCostCents,
      threshold_cents: COST_ALERT_THRESHOLD_CENTS,
    });
    Sentry.captureException(new Error("pass2_cost_ceiling"), {
      tags: { stage: "wave_3_pass2" },
    });
  }

  const waveCostCents = +totalCostCents.toFixed(4);

  emitStageEnd(onEvent, "wave_3_pass2", 3, stageStart, {
    cost_cents: waveCostCents,
    ok: pass2_aggregate_built,
    warning: pass2_aggregate_built ? undefined : "wave_3_pass2_below_threshold",
  });

  return {
    pass2Results,
    warnings,
    cost_cents: waveCostCents,
    pass2_success_count,
    pass2_aggregate_built,
  };
}
