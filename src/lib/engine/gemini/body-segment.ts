/**
 * Phase 5 Plan 02 — Body segment helper.
 *
 * Gemini Flash analysis of the 5s → duration-3s body window. Returns 3 video_signals
 * (visual_production_quality, pacing_score, transition_quality) + a body_summary string.
 *
 * Pattern source: src/lib/engine/wave0/content-type-detector.ts:146-219 (Phase 4 verified
 * single-upload + native videoMetadata-scoped generateContent + Zod-at-boundary + Sentry
 * per-stage tag + emit start/end events). hook_visual_impact is hook's territory — body
 * never returns it (merge contract D-13).
 *
 * Architectural invariants (CONTEXT D-03, D-08, D-10, D-14 + AI-SPEC §4b retry budget):
 *  - Window is "5s" → `${max(5, duration-3)}s` (template literal — Pitfall #4).
 *  - Skipped entirely when duration ≤ 8s (orchestrator decision; this helper is invoked
 *    only when duration > 8s, defensive clamp here regardless).
 *  - Flash tier permits 1 corrective retry on Zod failure (cheap; AI-SPEC §4b).
 *  - Owns its own AbortController + setTimeout + clearTimeout (Pitfall #5).
 *  - MUST NOT delete the Files API upload — that's segmented.ts outer finally (Pitfall #1).
 *  - Emits ONE stage_start + ONE stage_end pair under wave: 1, stage: "gemini_body" (D-14).
 */
import type { GoogleGenAI } from "@google/genai";
import * as Sentry from "@sentry/nextjs";
import { createLogger } from "@/lib/logger";
import { stripFences, GEMINI_BODY_MODEL } from "../gemini";
import {
  BodySegmentZodSchema,
  BODY_SEGMENT_GEMINI_SCHEMA,
  type BodySegmentResult,
} from "./schemas";
import { buildBodyPrompt, type SegmentedPromptOptions } from "./prompts";
import { calculateCost } from "./cost";
import { emitStageStart, emitStageEnd, type StageEventCallback } from "../events";
import type { SegmentResult } from "./hook-segment";

const log = createLogger({ module: "engine.gemini.body" });

const BODY_TIMEOUT_MS = 30_000;
const BODY_MAX_OUTPUT_TOKENS = 1000;
const BODY_COST_SOFT_CAP_CENTS = 0.7;
const BODY_COST_HARD_CAP_CENTS = 1.0;
const BODY_MAX_RETRIES = 1;              // AI-SPEC §4b "Retry logic" — 1 corrective retry on Flash

export interface BodySegmentOptions extends SegmentedPromptOptions {
  onStageEvent?: StageEventCallback;
  durationSeconds: number;   // REQUIRED — body window = 5s → max(5, duration-3)s
}

/**
 * Gemini Flash analysis of the 5s → max(5, duration-3)s body window.
 *
 * D-03: window dynamic — `"5s"` start, end constructed via template literal.
 * Skipped entirely at orchestrator level when duration ≤ 8s; defensive clamp here.
 * AI-SPEC §4b: 1 corrective retry on Zod failure (Flash tier — retries are cheap and worth it).
 * D-14: emits ONE stage_start + ONE stage_end pair under wave: 1, stage: "gemini_body".
 */
export async function runBodySegment(
  ai: GoogleGenAI,
  fileUri: string,
  mimeType: string,
  opts: BodySegmentOptions,
): Promise<SegmentResult<BodySegmentResult>> {
  const startTs = emitStageStart(opts.onStageEvent, "gemini_body", 1);
  const model = GEMINI_BODY_MODEL;

  // Compute window. Cap at 45s past start so Flash doesn't get an unbounded window on long videos.
  const rawEnd = Math.max(5, opts.durationSeconds - 3);
  const endOffsetSec = Math.min(rawEnd, 50); // body window: 5s → max 50s
  const endOffset = `${endOffsetSec}s`;

  let lastError: unknown = null;
  try {
    for (let attempt = 0; attempt <= BODY_MAX_RETRIES; attempt++) {
      // CR-02: Per-attempt AbortController + setTimeout so each retry gets a
      // fresh BODY_TIMEOUT_MS budget. Reusing a single outer controller would
      // (a) burn timeout budget across attempts and (b) on the retry pass
      // submit an already-aborted signal — guaranteeing AbortError before any
      // wire activity.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), BODY_TIMEOUT_MS);
      try {
        const prompt = attempt === 0
          ? buildBodyPrompt(opts)
          : `${buildBodyPrompt(opts)}\n\nYour previous response was not valid JSON matching the schema. Return ONLY the JSON object matching BodySegmentZodSchema.`;

        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                opts.inlineVideoData
                  ? { inlineData: { mimeType: opts.inlineVideoData.mimeType, data: opts.inlineVideoData.buffer.toString("base64") } }
                  : {
                      fileData: { fileUri, mimeType },
                      videoMetadata: { startOffset: "5s", endOffset },
                    },
              ],
            },
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: BODY_SEGMENT_GEMINI_SCHEMA,
            abortSignal: controller.signal,
            maxOutputTokens: BODY_MAX_OUTPUT_TOKENS,
          },
        });

        const rawText = response.text ?? "";
        const cleaned = stripFences(rawText);
        let parsed: unknown;
        try {
          parsed = JSON.parse(cleaned);
        } catch (parseErr) {
          lastError = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
          if (attempt < BODY_MAX_RETRIES) {
            log.warn("Body segment JSON parse retry", { attempt: attempt + 1, error: String(lastError) });
            continue;
          }
          throw lastError;
        }
        const result = BodySegmentZodSchema.safeParse(parsed);
        if (!result.success) {
          lastError = new Error(
            `Body segment Zod validation failed (attempt ${attempt + 1}): ${result.error.message}`,
          );
          if (attempt < BODY_MAX_RETRIES) {
            log.warn("Body segment Zod retry", {
              attempt: attempt + 1,
              error: String(lastError),
            });
            continue;
          }
          throw lastError;
        }

        const cost_cents = calculateCost(model, response.usageMetadata);
        if (cost_cents > BODY_COST_HARD_CAP_CENTS) {
          log.warn("Body segment cost EXCEEDS HARD CAP", { model, cost_cents });
          opts.onStageEvent?.({
            type: "pipeline_warning",
            message: `Gemini body segment cost ${cost_cents.toFixed(4)}¢ exceeds hard cap ${BODY_COST_HARD_CAP_CENTS}¢`,
            stage: "gemini_body",
          });
        } else if (cost_cents > BODY_COST_SOFT_CAP_CENTS) {
          log.warn("Body segment cost exceeds soft cap", { model, cost_cents });
        }

        log.info("Body segment complete", {
          stage: "gemini_body",
          model,
          cost_cents: +cost_cents.toFixed(4),
          attempt: attempt + 1,
        });

        emitStageEnd(opts.onStageEvent, "gemini_body", 1, startTs, {
          cost_cents: +cost_cents.toFixed(4),
          ok: true,
        });

        return { ok: true, analysis: result.data, cost_cents, model };
      } catch (innerError) {
        lastError = innerError;
        // WR-09: Do NOT retry on AbortError — the per-attempt timeout already
        // fired, so retrying immediately would just hit the same wall (now with
        // less of the overall fan-out budget). Other transport errors fall
        // through to the retry below.
        if (innerError instanceof Error && innerError.name === "AbortError") break;
        if (attempt >= BODY_MAX_RETRIES) break;
      } finally {
        // Clear THIS attempt's timer so a successful retry doesn't keep the
        // previous attempt's timer ticking.
        clearTimeout(timeout);
      }
    }
    throw lastError ?? new Error("Body segment failed after retries");
  } catch (error) {
    Sentry.captureException(error, { tags: { stage: "gemini_body", model } });
    const message = error instanceof Error ? error.message : String(error);
    log.warn("Body segment failed", { error: message, model });
    emitStageEnd(opts.onStageEvent, "gemini_body", 1, startTs, {
      cost_cents: 0,
      ok: false,
      warning: message,
    });
    return { ok: false, error };
  }
}
