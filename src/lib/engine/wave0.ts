import type { ContentPayload, Wave0Result } from "./types";
import type { CreatorContext } from "./creator";
import type { StageEventCallback } from "./events";
import { detectContentType } from "./wave0/content-type-detector";
import { detectNiche } from "./wave0/niche-detector";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "wave0" });

/**
 * Phase 4 — orchestrates Wave 0 detectors (content-type + niche) in parallel
 * via Promise.allSettled. One detector failing leaves the other's result intact
 * (D-16 isolated graceful degradation).
 *
 * Per CONTEXT.md D-16: detectors emit their OWN stage_start/stage_end pairs
 * (event-emission ownership moved DOWN from this orchestrator per PATTERNS
 * Critical Cross-File Constraint #7). This function is pure orchestration —
 * no event emission, no caching (D-22).
 *
 * Per D-17/D-18: creatorContext is pre-fetched in pipeline.ts and passed in.
 */
export async function runWave0(
  payload: ContentPayload,
  creatorContext: CreatorContext,
  onEvent?: StageEventCallback,
): Promise<Wave0Result> {
  const [contentTypeOutcome, nicheOutcome] = await Promise.allSettled([
    detectContentType(payload, onEvent),
    detectNiche(payload, creatorContext, onEvent),
  ]);

  if (contentTypeOutcome.status === "rejected") {
    log.warn("Content-type detector rejected", {
      reason: String(contentTypeOutcome.reason),
    });
  }
  if (nicheOutcome.status === "rejected") {
    log.warn("Niche detector rejected", {
      reason: String(nicheOutcome.reason),
    });
  }

  return {
    content_type:
      contentTypeOutcome.status === "fulfilled" ? contentTypeOutcome.value : null,
    niche: nicheOutcome.status === "fulfilled" ? nicheOutcome.value : null,
  };
}
