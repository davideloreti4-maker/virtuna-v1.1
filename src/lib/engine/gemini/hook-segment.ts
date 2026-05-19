/**
 * Phase 5 Plan 02 — Hook segment helper.
 *
 * Gemini Pro (3.1-preview default) analysis of the 0-5s hook window of a TikTok-style
 * vertical video. Returns 5 TikTok factors + 6-field hook_decomposition (4 sub-modalities
 * + weakest_modality + visual_audio_coherence + cognitive_load).
 *
 * Pattern source: src/lib/engine/wave0/content-type-detector.ts:146-219 (Phase 4 verified
 * single-upload + native videoMetadata-scoped generateContent + Zod-at-boundary + Sentry
 * per-stage tag + emit start/end events). Plan 02 fans this same shape out three times.
 *
 * Architectural invariants (CONTEXT D-03, D-04, D-08, D-10, D-14 + RESEARCH Pitfalls):
 *  - Window is "0s" → "5s" — STRING durations with trailing "s" (Pitfall #4).
 *  - videoMetadata is a SIBLING of fileData inside the SAME parts[] object (Pitfall #3).
 *  - audio_hook_quality is derived from this Pro call's multi-modal video analysis (D-04).
 *  - NEVER throws — failures return { ok: false } and the orchestrator's mergeSegments
 *    emits pipeline_warning (D-08).
 *  - Emits ONE stage_start + ONE stage_end pair under wave: 1, stage: "gemini_hook" (D-14).
 *  - Owns its own AbortController + setTimeout + clearTimeout (Pitfall #5 — NOT shared).
 *  - MUST NOT delete the Files API upload — that lives in segmented.ts outer finally (Pitfall #1).
 *  - Zod parse at the boundary via stripFences + safeParse (Pitfall #8).
 */
import type { GoogleGenAI } from "@google/genai";
import * as Sentry from "@sentry/nextjs";
import { createLogger } from "@/lib/logger";
import { stripFences, GEMINI_HOOK_MODEL } from "../gemini";
import {
  HookSegmentZodSchema,
  HOOK_SEGMENT_GEMINI_SCHEMA,
  type HookSegmentResult,
} from "./schemas";
import { buildHookPrompt, type SegmentedPromptOptions } from "./prompts";
import { calculateCost } from "./cost";
import { emitStageStart, emitStageEnd, type StageEventCallback } from "../events";

const log = createLogger({ module: "engine.gemini.hook" });

// Phase 5 §4 cost / latency budget — hook (Pro) ceilings.
const HOOK_TIMEOUT_MS = 30_000;          // per-segment AbortController ceiling
const HOOK_MAX_OUTPUT_TOKENS = 1500;     // hard ceiling — prevents runaway 6-score decomposition
const HOOK_COST_SOFT_CAP_CENTS = 1.6;    // log.warn
const HOOK_COST_HARD_CAP_CENTS = 2.0;    // pipeline_warning

export interface HookSegmentOptions extends SegmentedPromptOptions {
  onStageEvent?: StageEventCallback;
}

/**
 * Discriminated-union result for any segment helper. Re-exported via body/cta helpers
 * (they all share the same { ok, analysis, cost_cents, model } shape on success and
 * { ok: false, error } on failure). The orchestrator's `mergeSegments` consumes this.
 */
export type SegmentResult<T> =
  | { ok: true; analysis: T; cost_cents: number; model: string }
  | { ok: false; error: unknown };

/**
 * Gemini Pro (3.1-preview default) analysis of the 0-5s hook window.
 * Returns 5 TikTok factors + 6-field hook_decomposition (4 sub-modalities +
 * weakest_modality + visual_audio_coherence + cognitive_load).
 *
 * D-03: window is "0s" → "5s" (strings with "s" suffix per Pitfall #4).
 * D-04: audio_hook_quality is derived from this Pro call's multi-modal video analysis.
 * D-08: NEVER throws — failures return { ok: false } and mergeSegments emits the warning.
 * D-14: emits ONE stage_start + ONE stage_end pair under wave: 1, stage: "gemini_hook".
 * Pitfall #1: helper MUST NOT delete the Files API upload (outer finally in segmented.ts).
 * Pitfall #5: helper owns its own AbortController + setTimeout (NOT shared with body/cta).
 */
export async function runHookSegment(
  ai: GoogleGenAI,
  fileUri: string,
  mimeType: string,
  opts: HookSegmentOptions,
): Promise<SegmentResult<HookSegmentResult>> {
  const startTs = emitStageStart(opts.onStageEvent, "gemini_hook", 1);
  const model = GEMINI_HOOK_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HOOK_TIMEOUT_MS);

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { text: buildHookPrompt(opts) },
            {
              // CRITICAL Pitfall #3 + #4: videoMetadata is a SIBLING of fileData in the
              // SAME Part. startOffset/endOffset are STRING durations with trailing "s"
              // (NOT numbers, NOT ISO 8601).
              fileData: { fileUri, mimeType },
              videoMetadata: { startOffset: "0s", endOffset: "5s" },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: HOOK_SEGMENT_GEMINI_SCHEMA,
        abortSignal: controller.signal,
        maxOutputTokens: HOOK_MAX_OUTPUT_TOKENS,
      },
    });

    // Pitfall #8: response.text can be undefined even with responseSchema set.
    const rawText = response.text ?? "";
    const cleaned = stripFences(rawText);
    const parsed = JSON.parse(cleaned);
    const result = HookSegmentZodSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Hook segment Zod validation failed: ${result.error.message}`);
    }

    const cost_cents = calculateCost(model, response.usageMetadata);

    // Soft / hard cap warnings — Section 4b cost budget. Do NOT fail; tokens are sunk.
    if (cost_cents > HOOK_COST_HARD_CAP_CENTS) {
      log.warn("Hook segment cost EXCEEDS HARD CAP", {
        model,
        cost_cents,
        hard_cap: HOOK_COST_HARD_CAP_CENTS,
      });
      opts.onStageEvent?.({
        type: "pipeline_warning",
        message: `Gemini hook segment cost ${cost_cents.toFixed(4)}¢ exceeds hard cap ${HOOK_COST_HARD_CAP_CENTS}¢`,
        stage: "gemini_hook",
      });
    } else if (cost_cents > HOOK_COST_SOFT_CAP_CENTS) {
      log.warn("Hook segment cost exceeds soft cap", {
        model,
        cost_cents,
        soft_cap: HOOK_COST_SOFT_CAP_CENTS,
      });
    }

    log.info("Hook segment complete", {
      stage: "gemini_hook",
      model,
      cost_cents: +cost_cents.toFixed(4),
      weakest_modality: result.data.hook_decomposition.weakest_modality,
    });

    emitStageEnd(opts.onStageEvent, "gemini_hook", 1, startTs, {
      cost_cents: +cost_cents.toFixed(4),
      ok: true,
    });

    return { ok: true, analysis: result.data, cost_cents, model };
  } catch (error) {
    Sentry.captureException(error, { tags: { stage: "gemini_hook", model } });
    const message = error instanceof Error ? error.message : String(error);
    log.warn("Hook segment failed", { error: message, model });
    emitStageEnd(opts.onStageEvent, "gemini_hook", 1, startTs, {
      cost_cents: 0,
      ok: false,
      warning: message,
    });
    return { ok: false, error };
  } finally {
    // Per-segment AbortController cleanup (Pitfall #5).
    clearTimeout(timeout);
  }
}
