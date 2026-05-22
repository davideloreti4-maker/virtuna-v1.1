import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentPayload, Wave0Result } from "./types";
import type { CreatorContext } from "./creator";
import type { StageEventCallback } from "./events";
import { detectContentType } from "./wave0/content-type-detector";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "wave0" });

/**
 * Phase 4 — orchestrates Wave 0 detector (content-type + niche, now folded per D-17).
 *
 * D-17 (Phase 13 Plan 03): Wave 0 niche detection folded into the Gemini content-type
 * call. Single Gemini call returns { type, confidence, niche_primary_slug, niche_confidence }.
 * The separate DeepSeek niche-detector call site is eliminated.
 *
 * D-18 (Phase 13 Plan 03): accepts videoContext — when provided, detectContentType
 * skips upload (caller at pipeline.ts entry owns the Files API lifecycle).
 *
 * Per CONTEXT.md D-16: detectors emit their OWN stage_start/stage_end pairs.
 * This function is pure orchestration — no event emission, no caching (D-22).
 *
 * Phase 4 GAP-04-01 fix: supabase client forwarded to detectContentType so it can
 * download video via storage.from("videos").download() instead of fetch().
 * WR-01: rejected detector outcomes are captured to Sentry for observability.
 */
export async function runWave0(
  payload: ContentPayload,
  supabase: SupabaseClient,
  creatorContext: CreatorContext,
  videoContext?: { fileUri: string; mimeType: string } | null,
  onEvent?: StageEventCallback,
): Promise<Wave0Result> {
  // D-17: single call returns both content_type and niche fields (no separate DeepSeek call).
  const contentTypeOutcome = await detectContentType(payload, supabase, videoContext, onEvent)
    .catch((reason) => {
      Sentry.captureException(reason, {
        tags: { stage: "wave_0_content_type", source: "orchestrator" },
      });
      log.warn("Content-type detector rejected", {
        reason: String(reason),
      });
      return null;
    });

  return {
    content_type: contentTypeOutcome
      ? { type: contentTypeOutcome.type, confidence: contentTypeOutcome.confidence, warning: contentTypeOutcome.warning }
      : null,
    // D-17: niche is now derived from the same Gemini response (not a separate DeepSeek call).
    niche: contentTypeOutcome && contentTypeOutcome.niche_primary_slug
      ? {
          primary_slug: contentTypeOutcome.niche_primary_slug,
          micro_slug: contentTypeOutcome.niche_micro_slug ?? null,
          confidence: contentTypeOutcome.niche_confidence,
        }
      : null,
  };
}
