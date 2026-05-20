/**
 * Phase 9 Plan 03 — Platform Fit V3 Orchestrator (single-call variant).
 *
 * Exports `runPlatformFit()` — makes one V3 (deepseek-chat) call scoring all
 * targeted platforms together. Pattern follows wave3.ts (single-call subset):
 * circuit-breaker, client init, stable system prompt + volatile user message,
 * JSON response parsing with Zod validation.
 *
 * Must Haves:
 * - runPlatformFit() exported, returns PlatformFitResult[] | null
 * - Only platforms from creatorContext.target_platforms scored; empty Card 0 defaults to TikTok
 * - Creator follower_tier and watermark flags flow into user message
 * - Follows wave3.ts pattern exactly
 */
import * as Sentry from "@sentry/nextjs";
import OpenAI from "openai";
import { createLogger } from "@/lib/logger";
import type { ContentPayload, DeepSeekReasoning, PlatformFitResult } from "../types";
import type { CreatorContext } from "../creator";
import type { StageEventCallback } from "../events";
import { emitStageStart, emitStageEnd } from "../events";
import {
  STABLE_PLATFORM_FIT_SYSTEM_PROMPT,
  buildPlatformFitUserMessage,
  PlatformFitResponseSchema,
} from "./platform-fit-prompts";
import { isCircuitOpen } from "../deepseek";

const log = createLogger({ module: "platform-fit" });

/**
 * V4 Flash pricing (matches wave3.ts:38-40).
 * NOTE: re-verify against api-docs.deepseek.com/quick_start/pricing at deploy time.
 */
const CACHE_HIT_PRICE = 0.0028 / 1_000_000;
const CACHE_MISS_PRICE = 0.14 / 1_000_000;
const OUTPUT_PRICE = 0.28 / 1_000_000;

const PER_CALL_TIMEOUT_MS = 15_000;

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY environment variable");
    client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
  }
  return client;
}

/**
 * Single V3 call scoring all targeted platforms together.
 *
 * @param payload - ContentPayload with caption, hashtags, duration
 * @param creatorContext - Creator context with target_platforms, follower_count, niche
 * @param deepseekResult - Optional Wave 2 analysis (hook/retention scores)
 * @param watermarkDetected - Optional platform watermark flags from Gemini analysis
 * @param onEvent - Optional stage event callback
 * @returns PlatformFitResult[] when the V3 call succeeds, null on failure
 */
export async function runPlatformFit(
  payload: ContentPayload,
  creatorContext: CreatorContext,
  deepseekResult?: DeepSeekReasoning | null,
  watermarkDetected?: { tiktok?: boolean; ig?: boolean; yt?: boolean } | null,
  onEvent?: StageEventCallback,
): Promise<PlatformFitResult[] | null> {
  const stageStart = emitStageStart(onEvent, "platform_fit", 4);

  // Circuit-breaker fast-fail (matches wave3.ts:92-107 pattern)
  if (isCircuitOpen()) {
    log.warn("Circuit breaker open — skipping platform-fit");
    emitStageEnd(onEvent, "platform_fit", 4, stageStart, {
      cost_cents: 0,
      ok: false,
      warning: "circuit_breaker_open",
    });
    return null;
  }

  // Determine target platforms — empty/non-target defaults to TikTok
  const targetPlatforms = creatorContext.target_platforms ?? ["tiktok"];

  const ai = getClient();
  const systemPrompt = STABLE_PLATFORM_FIT_SYSTEM_PROMPT;
  const userMessage = buildPlatformFitUserMessage(
    payload,
    creatorContext,
    deepseekResult ?? null,
    watermarkDetected ?? null,
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);
  let costCents = 0;

  try {
    const response = await ai.chat.completions.create(
      {
        model: process.env.DEEPSEEK_PERSONA_MODEL ?? "deepseek-v4-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
      },
      { signal: controller.signal },
    );
    clearTimeout(timer);

    // Cache-aware cost telemetry (matches wave3.ts:180-194 pattern)
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
    costCents = +(inputCost + completion * OUTPUT_PRICE) * 100;

    const text = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text);
    const validated = PlatformFitResponseSchema.safeParse(parsed);

    if (!validated.success) {
      Sentry.captureException(new Error(`Platform-fit validation failed: ${validated.error.message}`), {
        tags: { stage: "platform_fit" },
      });
      log.error("Platform-fit V3 response validation failed", { error: validated.error.message });
      emitStageEnd(onEvent, "platform_fit", 4, stageStart, {
        cost_cents: costCents,
        ok: false,
        warning: "validation_failed",
      });
      return null;
    }

    // Filter results to only include requested target platforms
    const fits: PlatformFitResult[] = validated.data.platform_fits
      .filter((f) => targetPlatforms.includes(f.platform))
      .map((f) => ({
        platform: f.platform,
        fit_score: f.fit_score,
        rationale: f.rationale,
        watermark_penalty: f.watermark_penalty,
      }));

    emitStageEnd(onEvent, "platform_fit", 4, stageStart, {
      cost_cents: +costCents.toFixed(6),
      ok: true,
    });

    return fits;
  } catch (err) {
    clearTimeout(timer);
    const lastError = err instanceof Error ? err : new Error(String(err));
    Sentry.captureException(lastError, { tags: { stage: "platform_fit" } });
    log.error("Platform-fit V3 call failed", { error: lastError.message });

    emitStageEnd(onEvent, "platform_fit", 4, stageStart, {
      cost_cents: +costCents.toFixed(6),
      ok: false,
      warning: lastError.message,
    });

    return null;
  }
}
