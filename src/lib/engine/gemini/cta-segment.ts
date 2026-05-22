/**
 * Phase 5 Plan 02 — CTA segment helper.
 *
 * Gemini Flash analysis of the last 3 seconds of a TikTok-style vertical video. Returns
 * a presence-aware shape: { cta_present: boolean, strength: number|null, type: enum|null,
 * rationale: string } per D-05. When cta_present=true, strength + type are required;
 * when false, both MUST be null (enforced by Zod .refine cross-field invariant).
 *
 * Pattern source: src/lib/engine/wave0/content-type-detector.ts:146-219 (Phase 4 verified
 * single-upload + native videoMetadata-scoped generateContent + Zod-at-boundary + Sentry
 * per-stage tag + emit start/end events).
 *
 * Architectural invariants (CONTEXT D-03, D-05, D-07, D-08, D-10, D-14):
 *  - Window is `${max(5, duration-3)}s` → `${duration}s` (Pitfall #4 — string with "s").
 *  - presence-aware shape with cross-field invariant (Pitfall #7 — Zod .refine).
 *  - Flash tier permits 1 corrective retry on Zod failure (AI-SPEC §4b).
 *  - Owns its own AbortController + setTimeout + clearTimeout (Pitfall #5).
 *  - MUST NOT delete the Files API upload — that's segmented.ts outer finally (Pitfall #1).
 *  - Emits ONE stage_start + ONE stage_end pair under wave: 1, stage: "gemini_cta" (D-14).
 */
import type { GoogleGenAI } from "@google/genai";
import * as Sentry from "@sentry/nextjs";
import { createLogger } from "@/lib/logger";
import { stripFences, GEMINI_CTA_MODEL } from "../gemini";
import {
  CtaSegmentZodSchema,
  CTA_SEGMENT_GEMINI_SCHEMA,
  type CtaSegmentResult,
} from "./schemas";
import { buildCtaPrompt, type SegmentedPromptOptions } from "./prompts";
import { calculateCost } from "./cost";
import { emitStageStart, emitStageEnd, type StageEventCallback } from "../events";
import type { SegmentResult } from "./hook-segment";

const log = createLogger({ module: "engine.gemini.cta" });

const CTA_TIMEOUT_MS = 30_000;
const CTA_MAX_OUTPUT_TOKENS = 600;       // CTA output is the smallest of the three segments
const CTA_COST_SOFT_CAP_CENTS = 0.4;
const CTA_COST_HARD_CAP_CENTS = 0.6;
const CTA_MAX_RETRIES = 1;

export interface CtaSegmentOptions extends SegmentedPromptOptions {
  onStageEvent?: StageEventCallback;
  durationSeconds: number;  // REQUIRED — CTA window = max(5, duration-3) → duration
}

/**
 * Gemini Flash analysis of the duration-3s → duration window (clamped to 5s start min).
 *
 * D-03: window is `${max(5, duration-3)}s` → `${duration}s`.
 * D-05: presence-aware shape — Zod .refine enforces cta_present=true XOR (strength,type)=(null,null) pair.
 * D-07: rationale field carries user-facing copy for the M2 UI.
 * D-14: emits ONE stage_start + ONE stage_end pair under wave: 1, stage: "gemini_cta".
 */
export async function runCtaSegment(
  ai: GoogleGenAI,
  fileUri: string,
  mimeType: string,
  opts: CtaSegmentOptions,
): Promise<SegmentResult<CtaSegmentResult>> {
  const startTs = emitStageStart(opts.onStageEvent, "gemini_cta", 1);
  const model = GEMINI_CTA_MODEL;

  // Window: last 3s, clamped to 5s minimum start.
  const startOffsetSec = Math.max(5, opts.durationSeconds - 3);
  const startOffset = `${startOffsetSec}s`;
  const endOffset = `${opts.durationSeconds}s`;

  let lastError: unknown = null;
  try {
    for (let attempt = 0; attempt <= CTA_MAX_RETRIES; attempt++) {
      // CR-02: Per-attempt AbortController + setTimeout so each retry gets a
      // fresh CTA_TIMEOUT_MS budget (same bug pattern as body-segment.ts).
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CTA_TIMEOUT_MS);
      try {
        const prompt = attempt === 0
          ? buildCtaPrompt(opts)
          : `${buildCtaPrompt(opts)}\n\nYour previous response was not valid JSON matching the schema. Return ONLY the JSON object matching CtaSegmentZodSchema. CRITICAL: cta_present is the discriminator; when false, strength and type MUST both be null.`;

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
                      videoMetadata: { startOffset, endOffset },
                    },
              ],
            },
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: CTA_SEGMENT_GEMINI_SCHEMA,
            abortSignal: controller.signal,
            maxOutputTokens: CTA_MAX_OUTPUT_TOKENS,
          },
        });

        const rawText = response.text ?? "";
        const cleaned = stripFences(rawText);
        const parsed = JSON.parse(cleaned);
        const result = CtaSegmentZodSchema.safeParse(parsed);
        if (!result.success) {
          lastError = new Error(
            `CTA segment Zod validation failed (attempt ${attempt + 1}): ${result.error.message}`,
          );
          if (attempt < CTA_MAX_RETRIES) {
            log.warn("CTA segment Zod retry", {
              attempt: attempt + 1,
              error: String(lastError),
            });
            continue;
          }
          throw lastError;
        }

        const cost_cents = calculateCost(model, response.usageMetadata);
        if (cost_cents > CTA_COST_HARD_CAP_CENTS) {
          log.warn("CTA segment cost EXCEEDS HARD CAP", { model, cost_cents });
          opts.onStageEvent?.({
            type: "pipeline_warning",
            message: `Gemini CTA segment cost ${cost_cents.toFixed(4)}¢ exceeds hard cap ${CTA_COST_HARD_CAP_CENTS}¢`,
            stage: "gemini_cta",
          });
        } else if (cost_cents > CTA_COST_SOFT_CAP_CENTS) {
          log.warn("CTA segment cost exceeds soft cap", { model, cost_cents });
        }

        log.info("CTA segment complete", {
          stage: "gemini_cta",
          model,
          cost_cents: +cost_cents.toFixed(4),
          cta_present: result.data.cta_present,
          attempt: attempt + 1,
        });

        emitStageEnd(opts.onStageEvent, "gemini_cta", 1, startTs, {
          cost_cents: +cost_cents.toFixed(4),
          ok: true,
        });

        return { ok: true, analysis: result.data, cost_cents, model };
      } catch (innerError) {
        lastError = innerError;
        // WR-09: Do NOT retry on AbortError — the per-attempt timeout already
        // fired, so retrying immediately would just hit the same wall.
        if (innerError instanceof Error && innerError.name === "AbortError") break;
        if (attempt >= CTA_MAX_RETRIES) break;
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastError ?? new Error("CTA segment failed after retries");
  } catch (error) {
    Sentry.captureException(error, { tags: { stage: "gemini_cta", model } });
    const message = error instanceof Error ? error.message : String(error);
    log.warn("CTA segment failed", { error: message, model });
    emitStageEnd(opts.onStageEvent, "gemini_cta", 1, startTs, {
      cost_cents: 0,
      ok: false,
      warning: message,
    });
    return { ok: false, error };
  }
}
