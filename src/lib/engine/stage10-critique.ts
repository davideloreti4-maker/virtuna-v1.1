import * as Sentry from "@sentry/nextjs";
import type { PredictionResult, CritiqueResult } from "./types";
import type { StageEventCallback } from "./events";
import { emitStageStart, emitStageEnd } from "./events";
import { isCircuitOpen } from "./deepseek";
import { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } from "./qwen/client";
import { calculateCost } from "./qwen/cost";
import {
  STABLE_CRITIQUE_SYSTEM_PROMPT,
  buildCritiqueUserMessage,
  CritiqueResponseSchema,
} from "./stage10-critique-prompts";
import type { CreatorContext } from "./creator";

// D-21 (Phase 3): upgraded to QWEN_REASONING_MODEL (qwen3.6-plus) with thinking-mode
// (enable_thinking=true, thinking_budget=4000). Tighter confidence calibration reduces false-positives.

const PER_CALL_TIMEOUT_MS = 60_000; // bumped from 45s — thinking-mode is slower

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
          model: QWEN_REASONING_MODEL,  // D-21: thinking-mode upgrade (qwen3.6-plus)
          messages: [
            { role: "system", content: STABLE_CRITIQUE_SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
          response_format: { type: "json_object" },
          temperature: 0, // reproducible consistency_score / confidence_adjustment
          seed: QWEN_SEED,
          // @ts-expect-error — DashScope extensions not in OpenAI SDK types (enable_thinking + thinking_budget)
          enable_thinking: true,
          thinking_budget: 4000, // D-21: caps thinking at 4000 tokens (shorter than Pass 2's 8000)
        },
        { signal: controller.signal },
      );
      clearTimeout(timer);

      const usage = response.usage as
        | { prompt_tokens?: number; completion_tokens?: number }
        | undefined;
      costCents += calculateCost(QWEN_REASONING_MODEL, usage ?? undefined);

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
