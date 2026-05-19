/**
 * Phase 5 Plan 02 Task 3 — Segmented video analysis orchestrator.
 *
 * Drop-in replacement for the legacy `analyzeVideoWithGemini` (preserved per D-11)
 * that performs ONE Files API upload, polls to ACTIVE, then fans out THREE parallel
 * `generateContent` calls via `Promise.allSettled` against the SAME `fileUri`:
 *
 *   - Hook (Gemini Pro)   on 0-5s
 *   - Body (Gemini Flash) on 5s → duration-3s     [SKIPPED when duration ≤ 8s]
 *   - CTA  (Gemini Flash) on max(5, duration-3)s → duration
 *
 * Architecture (CONTEXT D-10, D-11, D-14 + RESEARCH Pitfalls #1, #3, #4, #5):
 *  1. Size-cap check (50MB) — reject oversized buffers before any API call.
 *  2. ai.files.upload(blob) — ONE upload.
 *  3. Poll ai.files.get until state === ACTIVE (or throw on FAILED).
 *  4. Fan out three parallel scoped generateContent calls via Promise.allSettled.
 *     Each helper owns its OWN AbortController + setTimeout + clearTimeout (Pitfall #5).
 *     Helpers DO NOT delete the Files API upload (Pitfall #1).
 *  5. mergeSegments(...) — null-safe merge; emits pipeline_warning per failed segment
 *     (D-08), or ONE consolidated `gemini_video_unavailable` warning if 3-of-3 fail (D-09).
 *  6. Outer finally: Files API best-effort cleanup (Pitfall #1 — NEVER inside per-segment helpers).
 *
 * D-14: The three per-segment events (gemini_hook / _body / _cta) REPLACE the
 * legacy `gemini_video_analysis` wrapper event. Orchestrator emits NO wrapper.
 *
 * Returns: { analysis, cost_cents, signalAvailability } — pipeline.ts (Plan 03)
 * reads signalAvailability into the aggregator for weight redistribution.
 */
import * as Sentry from "@sentry/nextjs";
import { createLogger } from "@/lib/logger";
import { getClient } from "../gemini";
import { runHookSegment } from "./hook-segment";
import { runBodySegment } from "./body-segment";
import { runCtaSegment } from "./cta-segment";
import { mergeSegments, type MergedSegmentedResult } from "./merge";
import type { SegmentedPromptOptions } from "./prompts";
import type { StageEventCallback } from "../events";
import type { SegmentResult } from "./hook-segment";
import type { BodySegmentResult } from "./schemas";

const log = createLogger({ module: "engine.gemini.segmented" });

const VIDEO_MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB — matches gemini.ts:33 legacy cap
const VIDEO_POLL_INTERVAL_MS = 500; // matches gemini.ts:34
const VIDEO_POLL_TIMEOUT_MS = 60_000; // matches gemini.ts:35
const SHORT_VIDEO_THRESHOLD_SEC = 8; // CONTEXT short-video Claude's Discretion option a

export interface SegmentedAnalysisOptions extends SegmentedPromptOptions {
  onStageEvent?: StageEventCallback;
  /**
   * REQUIRED — drives body + CTA window math + short-video skip branch.
   * Body window = 5s → max(5, durationSeconds-3)s.
   * CTA window  = max(5, durationSeconds-3)s → durationSeconds.
   * When durationSeconds ≤ 8s, the body segment is skipped entirely.
   */
  durationSeconds: number;
}

/**
 * Analyze a TikTok-style vertical video as 3 parallel Gemini segments against
 * ONE Files API upload. See file-level docstring for the full architecture.
 *
 * @param videoBuffer  Raw video bytes (≤ 50MB enforced before upload).
 * @param mimeType     Standard video MIME (e.g. "video/mp4", "video/webm").
 * @param opts         Prompt options + onStageEvent callback + durationSeconds.
 * @returns Merged analysis + per-video cost + signalAvailability triple.
 * @throws Error on size-cap rejection, Files API upload failure, processing FAILED state.
 *         Per-segment failures do NOT throw — they become `{ ok: false }` results
 *         that mergeSegments converts to `pipeline_warning` events + null-fill fields.
 */
export async function analyzeVideoSegmented(
  videoBuffer: Buffer,
  mimeType: string,
  opts: SegmentedAnalysisOptions,
): Promise<MergedSegmentedResult> {
  // ============================================================================
  // 1. Size-cap check — reject oversized buffers before any API call.
  // ============================================================================
  if (videoBuffer.byteLength > VIDEO_MAX_SIZE_BYTES) {
    throw new Error(
      "Video exceeds maximum size (50MB / ~3 minutes). Trim the video before uploading.",
    );
  }

  const ai = getClient();
  let uploadedFileName: string | undefined;

  try {
    // ==========================================================================
    // 2. Single Files API upload (reuses gemini.ts:455-464 pattern verbatim).
    // ==========================================================================
    const blob = new Blob([new Uint8Array(videoBuffer)], { type: mimeType });
    const uploadResult = await ai.files.upload({
      file: blob,
      config: { mimeType },
    });

    if (!uploadResult.name) {
      throw new Error(
        "Video upload failed: no file name returned from Gemini Files API",
      );
    }
    uploadedFileName = uploadResult.name;

    // ==========================================================================
    // 3. Poll for ACTIVE state (Pitfall #2 — fan-out MUST wait for state === ACTIVE).
    // ==========================================================================
    let fileState = uploadResult.state;
    let fileUri = uploadResult.uri;
    const pollStart = Date.now();
    while (fileState === "PROCESSING") {
      if (Date.now() - pollStart > VIDEO_POLL_TIMEOUT_MS) {
        throw new Error(
          `Video processing timed out after ${VIDEO_POLL_TIMEOUT_MS / 1000}s. The file may be too large or complex.`,
        );
      }
      await new Promise((r) => setTimeout(r, VIDEO_POLL_INTERVAL_MS));
      const info = await ai.files.get({ name: uploadedFileName });
      fileState = info.state;
      fileUri = info.uri;
    }
    if (fileState === "FAILED") {
      throw new Error(
        "Video processing failed in Gemini Files API. The file may be corrupt or in an unsupported format.",
      );
    }
    // CR-01: Guard against any state that is neither PROCESSING (handled in the loop)
    // nor FAILED (handled above) nor ACTIVE. Examples include "PENDING", "UNKNOWN",
    // null, undefined, or empty-string. Without this check, the three parallel
    // generateContent calls fan out against a not-actually-ready file and produce
    // cryptic 503/404 errors — a 3-of-3 cascade with no actionable upstream signal.
    if (fileState !== "ACTIVE") {
      throw new Error(
        `Video processing returned unexpected state "${fileState ?? "<undefined>"}". Expected ACTIVE.`,
      );
    }
    if (!fileUri) {
      throw new Error(
        "Video upload succeeded but no file URI was returned.",
      );
    }

    Sentry.addBreadcrumb({
      category: "engine.gemini.segmented",
      message: "Files API upload ACTIVE — fanning out 3 segments",
      level: "info",
      data: {
        uploadedFileName,
        durationSeconds: opts.durationSeconds,
      },
    });

    // ==========================================================================
    // 4. Short-video skip branch (CONTEXT Claude's Discretion option a):
    //    For duration ≤ 8s, body window collapses or inverts → skip body call.
    // ==========================================================================
    const skipBody = opts.durationSeconds <= SHORT_VIDEO_THRESHOLD_SEC;
    if (skipBody) {
      log.info("Short-video body-skip branch", {
        durationSeconds: opts.durationSeconds,
        threshold: SHORT_VIDEO_THRESHOLD_SEC,
      });
    }

    // ==========================================================================
    // 5. Fan-out via Promise.allSettled.
    //    Each helper owns its own AbortController + setTimeout + clearTimeout (Pitfall #5).
    //    Helpers MUST NOT delete the Files API upload (Pitfall #1) — outer finally below.
    // ==========================================================================
    const bodyPromise: Promise<SegmentResult<BodySegmentResult>> = skipBody
      ? Promise.resolve({
          ok: false as const,
          error: new Error("body skipped (short video ≤ 8s)"),
        })
      : runBodySegment(ai, fileUri, mimeType, opts);

    const [hookSettled, bodySettled, ctaSettled] = await Promise.allSettled([
      runHookSegment(ai, fileUri, mimeType, opts),
      bodyPromise,
      runCtaSegment(ai, fileUri, mimeType, opts),
    ]);

    // ==========================================================================
    // 6. Null-safe merge — emits pipeline_warning per failed segment (D-08/D-09).
    //
    //    When skipBody=true and body returned a synthetic { ok: false } above,
    //    mergeSegments would naturally emit a `gemini_body` pipeline_warning. The
    //    short-video branch is INTENDED, not a failure — suppress that one warning
    //    via a wrapping callback. All other events (hook, cta, aggregate cost cap)
    //    pass through to the original callback.
    // ==========================================================================
    const onStageEventForMerge: StageEventCallback | undefined = skipBody
      ? (event) => {
          if (
            event.type === "pipeline_warning" &&
            event.stage === "gemini_body"
          ) {
            // Replace with an info log — skip is by design, not a degradation.
            log.info("Body segment skipped (short video ≤ 8s)", {
              durationSeconds: opts.durationSeconds,
            });
            return;
          }
          opts.onStageEvent?.(event);
        }
      : opts.onStageEvent;

    return mergeSegments(
      hookSettled,
      bodySettled,
      ctaSettled,
      onStageEventForMerge,
    );
  } catch (error) {
    Sentry.captureException(error, {
      tags: { stage: "gemini_video_segmented" },
    });
    if (error instanceof Error) throw error;
    throw new Error(`Segmented video analysis failed: ${String(error)}`);
  } finally {
    // ==========================================================================
    // 7. Best-effort delete AFTER all 3 segments settle (Pitfall #1 — never in helpers).
    //    File server-side TTL provides eventual cleanup if delete throws.
    // ==========================================================================
    if (uploadedFileName) {
      try {
        await ai.files.delete({ name: uploadedFileName });
      } catch {
        // Best-effort cleanup — file expires server-side anyway. Do not throw.
      }
    }
  }
}
