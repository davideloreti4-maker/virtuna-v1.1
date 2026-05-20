import * as Sentry from "@sentry/nextjs";
import OpenAI from "openai";
import { createLogger } from "@/lib/logger";
import type { PredictionResult, CounterfactualResult } from "./types";
import type { StageEventCallback } from "./events";
import { emitStageStart, emitStageEnd } from "./events";
import { isCircuitOpen } from "./deepseek";
import {
  STABLE_COUNTERFACTUALS_SYSTEM_PROMPT,
  buildCounterfactualsUserMessage,
  CounterfactualsResponseSchema,
} from "./stage11-counterfactuals-prompts";

const log = createLogger({ module: "stage11-counterfactuals" });

const COUNTERFACTUALS_MODEL = process.env.DEEPSEEK_COUNTERFACTUALS_MODEL ?? "deepseek-v4-flash";

const CACHE_HIT_PRICE = 0.0028 / 1_000_000;
const CACHE_MISS_PRICE = 0.14 / 1_000_000;
const OUTPUT_PRICE = 0.28 / 1_000_000;

const PER_CALL_TIMEOUT_MS = 15_000;

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY environment variable");
    _client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
  }
  return _client;
}

/**
 * Pure-TS check (NOT model-generated). Appends a LIKELY_FLOP warning to
 * result.warnings[] when overall_score < 30 AND post-critique confidence > 0.70.
 * Uses POST-CRITIQUE confidence (PredictionResult.confidence after Stage 10 adjustment).
 */
export function maybeAppendLikelyFlopWarning(result: PredictionResult): void {
  const score = result.overall_score;
  const confidence = result.confidence;

  if (score < 30 && confidence > 0.70) {
    log.warn("LIKELY_FLOP detected", { score, confidence });
    result.warnings.push(
      "LIKELY_FLOP: This content scores below 30 with high confidence (>70%), " +
        "indicating strong consensus that it will underperform. Consider significant " +
        "revisions to the hook, structure, or platform targeting before publishing.",
    );
  }
}

/**
 * Phase 9 contract: counterfactual suggestions tied to retention drop points.
 * Per CONTEXT.md D-17: generates exactly 3 hyper-specific, ranked suggestions.
 * Returns null when content scores high (≥70) — no actionable changes needed.
 */
export async function runStage11Counterfactuals(
  aggregateResult: PredictionResult,
  onEvent?: StageEventCallback,
): Promise<CounterfactualResult | null> {
  const start = emitStageStart(onEvent, "stage_11_counterfactuals", "post");
  let costCents = 0;

  // Short-circuit for high-scoring content — no counterfactuals needed
  if ((aggregateResult.overall_score ?? 0) >= 70) {
    emitStageEnd(onEvent, "stage_11_counterfactuals", "post", start, {
      cost_cents: 0,
      ok: true,
      warning: "high_score_no_actionable_changes",
    });
    return null;
  }

  if (isCircuitOpen()) {
    emitStageEnd(onEvent, "stage_11_counterfactuals", "post", start, {
      cost_cents: 0,
      ok: false,
      warning: "circuit_breaker_open",
    });
    return null;
  }

  const ai = getClient();
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);
    try {
      const userMessage = buildCounterfactualsUserMessage(aggregateResult);
      const response = await ai.chat.completions.create(
        {
          model: COUNTERFACTUALS_MODEL,
          messages: [
            { role: "system", content: STABLE_COUNTERFACTUALS_SYSTEM_PROMPT },
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
      const parsed = CounterfactualsResponseSchema.safeParse(JSON.parse(text));
      if (!parsed.success) {
        lastError = new Error(`validation failed: ${parsed.error.message}`);
        if (attempt === 0) {
          attempt++;
          continue;
        }
        throw lastError;
      }

      emitStageEnd(onEvent, "stage_11_counterfactuals", "post", start, {
        cost_cents: +costCents.toFixed(4),
        ok: true,
      });

      return {
        suggestions: parsed.data.suggestions,
      };
    } catch (err) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.name === "AbortError" || attempt >= 1) break;
      attempt++;
    }
  }

  Sentry.captureException(lastError, { tags: { stage: "stage_11_counterfactuals" } });
  emitStageEnd(onEvent, "stage_11_counterfactuals", "post", start, {
    cost_cents: +costCents.toFixed(4),
    ok: false,
    warning: lastError?.message,
  });
  return null;
}
