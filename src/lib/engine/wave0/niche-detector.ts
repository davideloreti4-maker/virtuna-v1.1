import * as Sentry from "@sentry/nextjs";
import OpenAI from "openai";
import { createLogger } from "@/lib/logger";
import type { ContentPayload, Wave0NicheResult } from "../types";
import { Wave0NicheResultSchema } from "../types";
import type { CreatorContext } from "../creator";
import type { StageEventCallback } from "../events";
import { emitStageStart, emitStageEnd } from "../events";
import { NICHE_TREE, getNicheBranches } from "@/lib/niches/taxonomy";
import { NICHE_SYSTEM_PROMPT, buildNicheUserMessage } from "./prompts";

const log = createLogger({ module: "wave0.niche" });

// Phase 4 D-03 deviation (per RESEARCH Topic #12 + PATTERNS Critical Cross-File Constraint #4):
// Introduce a NEW env separate from DEEPSEEK_MODEL (which routes deepseek-reasoner → V4 Flash
// thinking-mode until 2026-07-24 deadline). DEEPSEEK_NICHE_MODEL defaults to bare V4 Flash
// (non-thinking) — appropriate for cheap text classification.
const DEEPSEEK_NICHE_MODEL = process.env.DEEPSEEK_NICHE_MODEL ?? "deepseek-v4-flash";

// V4 Flash pricing — RESEARCH Topic #2 verified 2026-05-18.
const CACHE_HIT_PRICE = 0.0028 / 1_000_000;
const CACHE_MISS_PRICE = 0.14 / 1_000_000;
const OUTPUT_PRICE = 0.28 / 1_000_000;

// Env-overridable confidence thresholds per CONTEXT Claude's Discretion.
const CONFIDENCE_THRESHOLD = parseFloat(process.env.NICHE_CONFIDENCE_THRESHOLD ?? "0.6");
const MICRO_THRESHOLD = parseFloat(process.env.NICHE_MICRO_CONFIDENCE_THRESHOLD ?? "0.6");

const TIMEOUT_MS = 15_000;

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY environment variable");
    client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
  }
  return client;
}

function isPrimarySlugValid(slug: string): boolean {
  return NICHE_TREE.some((p) => p.slug === slug);
}

/**
 * Detects hierarchical niche via DeepSeek V4 Flash text classifier.
 * Per CONTEXT D-02..D-08 + D-16: NEVER throws — returns null on any failure.
 */
export async function detectNiche(
  payload: ContentPayload,
  creatorContext: CreatorContext,
  onEvent?: StageEventCallback,
): Promise<Wave0NicheResult | null> {
  const startTs = emitStageStart(onEvent, "wave_0_niche_detector", 0);
  let costCents = 0;

  try {
    const ai = getClient();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const userMessage = buildNicheUserMessage(payload, creatorContext);

    let response;
    try {
      response = await ai.chat.completions.create(
        {
          model: DEEPSEEK_NICHE_MODEL,
          messages: [
            // STABLE prefix: byte-identical across calls → DeepSeek cache hit on prefix
            { role: "system", content: NICHE_SYSTEM_PROMPT },
            // VOLATILE: per-request dynamic content
            { role: "user", content: userMessage },
          ],
          response_format: { type: "json_object" },
        },
        { signal: controller.signal },
      );
    } finally {
      clearTimeout(timeout);
    }

    // Cache telemetry — Phase 3 D-12 pattern with GAP-04-02 fallback for missing cache breakdown.
    // When DeepSeek omits prompt_cache_hit_tokens / prompt_cache_miss_tokens (caching disabled,
    // model variant doesn't report cache stats, transient infra events), fall back to
    // prompt_tokens × CACHE_MISS_PRICE so input cost is NEVER silently 0. Mirrors
    // deepseek.ts:338-362 (calculateDeepSeekCost) — single source of truth for DeepSeek cost
    // semantics in the codebase.
    const usage = response.usage as unknown as {
      prompt_tokens?: number;
      prompt_cache_hit_tokens?: number;
      prompt_cache_miss_tokens?: number;
      completion_tokens?: number;
    } | undefined;
    const cacheHit = usage?.prompt_cache_hit_tokens ?? 0;
    const cacheMiss = usage?.prompt_cache_miss_tokens ?? 0;
    const completion = usage?.completion_tokens ?? 0;
    const hasCacheBreakdown = cacheHit > 0 || cacheMiss > 0;
    const inputCost = hasCacheBreakdown
      ? cacheHit * CACHE_HIT_PRICE + cacheMiss * CACHE_MISS_PRICE
      : (usage?.prompt_tokens ?? 0) * CACHE_MISS_PRICE;
    costCents = (inputCost + completion * OUTPUT_PRICE) * 100;

    const text = response.choices[0]?.message?.content ?? "{}";
    const raw = JSON.parse(text);

    // Two-stage validation (RESEARCH Topic #8):
    // (1) Zod shape validation
    const validatedAi = Wave0NicheResultSchema.safeParse({
      primary: raw.primary,
      sub: raw.sub,
      micro: raw.micro ?? null,
      confidence: raw.confidence,
      source: "ai",
    });
    if (!validatedAi.success) {
      throw new Error(`Niche response validation failed: ${validatedAi.error.message}`);
    }
    let result: Wave0NicheResult = validatedAi.data;

    // (2) Slug validation against NICHE_TREE (PATTERNS Pitfall 3)
    if (!isPrimarySlugValid(result.primary)) {
      throw new Error(`Unknown primary niche slug: ${result.primary}`);
    }
    const branches = getNicheBranches(result.primary);
    if (!branches.some((s) => s.slug === result.sub)) {
      throw new Error(`Unknown sub niche slug: ${result.sub} for primary ${result.primary}`);
    }

    // Micro null at low micro_confidence (D-07)
    if (typeof raw.micro_confidence === "number" && raw.micro_confidence < MICRO_THRESHOLD) {
      result = { ...result, micro: null };
    }

    // Card 1 fallback / drift detection (D-05, D-06, Pitfall 4)
    if (result.confidence < CONFIDENCE_THRESHOLD) {
      const card1Primary = creatorContext.niche_primary;
      const card1Sub = creatorContext.niche_sub;
      // Pitfall 4: Card 1 must itself be a valid NICHE_TREE slug to use as fallback
      if (card1Primary && card1Sub && isPrimarySlugValid(card1Primary)) {
        const card1Branches = getNicheBranches(card1Primary);
        if (card1Branches.some((s) => s.slug === card1Sub)) {
          result = {
            primary: card1Primary,
            sub: card1Sub,
            micro: null,
            confidence: result.confidence,
            source: "card1_fallback",
          };
        } else {
          result = { ...result, source: "ai", warning: "niche_low_confidence_no_fallback" };
        }
      } else {
        result = { ...result, source: "ai", warning: "niche_low_confidence_no_fallback" };
      }
    } else {
      // D-06: AI wins disagreements when confident; emit drift warning if Card 1 disagrees
      if (
        creatorContext.niche_primary &&
        isPrimarySlugValid(creatorContext.niche_primary) &&
        creatorContext.niche_primary !== result.primary
      ) {
        result = { ...result, source: "ai", warning: "niche_drift_detected" };
      } else {
        result = { ...result, source: "ai" };
      }
    }

    log.info("Niche detection complete", {
      stage: "wave_0_niche_detector",
      primary: result.primary,
      sub: result.sub,
      confidence: result.confidence,
      source: result.source,
      cache_hit_tokens: cacheHit,
      cache_miss_tokens: cacheMiss,
      cost_cents: +costCents.toFixed(4),
    });

    emitStageEnd(onEvent, "wave_0_niche_detector", 0, startTs, {
      cost_cents: +costCents.toFixed(4),
      ok: true,
      warning: result.warning,
    });
    return result;
  } catch (error) {
    Sentry.captureException(error, { tags: { stage: "wave_0_niche_detector" } });
    const message = error instanceof Error ? error.message : String(error);
    log.warn("Niche detection failed", { error: message });
    emitStageEnd(onEvent, "wave_0_niche_detector", 0, startTs, {
      cost_cents: +costCents.toFixed(4),
      ok: false,
      warning: message,
    });
    return null;
  }
}
