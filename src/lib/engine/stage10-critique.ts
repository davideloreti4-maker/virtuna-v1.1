import * as Sentry from "@sentry/nextjs";
import type { PredictionResult, CritiqueResult } from "./types";
import type { StageEventCallback } from "./events";
import { emitStageStart, emitStageEnd } from "./events";
import { isCircuitOpen } from "./deepseek";
import { getQwenClient, QWEN_FAST_MODEL } from "./qwen/client";
import {
  STABLE_CRITIQUE_SYSTEM_PROMPT,
  buildCritiqueUserMessage,
  CritiqueResponseSchema,
} from "./stage10-critique-prompts";
import type { CreatorContext } from "./creator";


/**
 * Qwen pricing — see src/lib/engine/qwen/cost.ts for authoritative rates.
 */
const CACHE_HIT_PRICE = 0.0028 / 1_000_000;
const CACHE_MISS_PRICE = 0.14 / 1_000_000;
const OUTPUT_PRICE = 0.28 / 1_000_000;

const PER_CALL_TIMEOUT_MS = 45_000;

/**
 * D-11: Clamp confidence_adjustment to [-0.20, 0] in TypeScript — never trust model range.
 * Called by pipeline.ts (Plan 09-07) AFTER runStage10Critique returns.
 */
export function applyCritiqueAdjustment(
  currentConfidence: number,
  critique: CritiqueResult,
): number {
  const adj = Math.max(-0.20, Math.min(0, critique.confidence_adjustment));
  return Math.max(0, Math.min(1, currentConfidence + adj));
}

/**
 * Phase 9 contract: self-critique pass that grades aggregator output for consistency.
 * Per CONTEXT.md D-18. Returns null when critique cannot be produced.
 *
 * Adds optional creatorContext parameter (non-breaking) for Card 6 historical match
 * check in the critique prompt. The no-op stub only used _aggregateResult (unused).
 */
export async function runStage10Critique(
  aggregateResult: PredictionResult,
  onEvent?: StageEventCallback,
  creatorContext?: CreatorContext,
): Promise<CritiqueResult | null> {
  const start = emitStageStart(onEvent, "stage_10_critique", "post");
  let costCents = 0;

  if (isCircuitOpen()) {
    emitStageEnd(onEvent, "stage_10_critique", "post", start, {
      cost_cents: 0,
      ok: false,
      warning: "circuit_breaker_open",
    });
    return null;
  }

  const ai = getQwenClient();
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);
    try {
      const userMessage = buildCritiqueUserMessage(aggregateResult, creatorContext ?? null);
      const response = await ai.chat.completions.create(
        {
          model: QWEN_FAST_MODEL,
          messages: [
            { role: "system", content: STABLE_CRITIQUE_SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
          response_format: { type: "json_object" },
        },
        { signal: controller.signal },
      );
      clearTimeout(timer);

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

      const text = response.choices[0]?.message?.content ?? "{}";
      const parsed = CritiqueResponseSchema.safeParse(JSON.parse(text));
      if (!parsed.success) {
        lastError = new Error(`validation failed: ${parsed.error.message}`);
        if (attempt === 0) {
          attempt++;
          continue;
        }
        throw lastError;
      }

      emitStageEnd(onEvent, "stage_10_critique", "post", start, {
        cost_cents: +costCents.toFixed(4),
        ok: true,
      });
      return {
        consistency_score: parsed.data.consistency_score,
        flags: parsed.data.flags,
        confidence_adjustment: parsed.data.confidence_adjustment,
      };
    } catch (err) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.name === "AbortError" || attempt >= 1) break;
      attempt++;
    }
  }

  Sentry.captureException(lastError, { tags: { stage: "stage_10_critique" } });
  emitStageEnd(onEvent, "stage_10_critique", "post", start, {
    cost_cents: +costCents.toFixed(4),
    ok: false,
    warning: lastError?.message,
  });
  return null;
}
