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
 *  1. Size-cap check (287MB — D-19) — reject oversized buffers before any API call.
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
import {
  getClient,
  // D-19 (Phase 13 Plan 03): import shared constants to stay in sync with gemini.ts literal.
  VIDEO_MAX_SIZE_BYTES,
  VIDEO_POLL_INTERVAL_MS,
  VIDEO_POLL_TIMEOUT_MS,
} from "../gemini";
import { runHookSegment } from "./hook-segment";
import { runBodySegment } from "./body-segment";
import { runCtaSegment } from "./cta-segment";
import { mergeSegments, type MergedSegmentedResult } from "./merge";
import type { SegmentedPromptOptions } from "./prompts";
import type { StageEventCallback } from "../events";
import type { SegmentResult } from "./hook-segment";
import type { BodySegmentResult } from "./schemas";

const log = createLogger({ module: "engine.gemini.segmented" });

// D-19: VIDEO_MAX_SIZE_BYTES, VIDEO_POLL_INTERVAL_MS, VIDEO_POLL_TIMEOUT_MS imported from ../gemini.
// WR-05: Raised from 8s to 10s so a duration=11s video produces a body window
// of `5s → 8s` (3-second minimum). Pre-fix, duration=9s gave a 1-second body
// window and Gemini Flash would hallucinate pacing / transition scores against
// a clip too short to score per the three-beat rubric.
// At threshold=10: duration ≤ 10 skips body. duration=11 → body window
// {5s, max(5, 8)} = {5s, 8s} = 3s (rubric-minimum). duration=12 → 4s body, etc.
// CTA window at duration=10 (when body IS skipped) is {5s, max(5, 7)} = {5s, 10s} — covers the back half cleanly.
const SHORT_VIDEO_THRESHOLD_SEC = 10; // CONTEXT short-video Claude's Discretion option a (WR-05 raised from 8)

export interface SegmentedAnalysisOptions extends SegmentedPromptOptions {
  onStageEvent?: StageEventCallback;
  /**
   * REQUIRED — drives body + CTA window math + short-video skip branch.
   * Body window = 5s → max(5, durationSeconds-3)s.
   * CTA window  = max(5, durationSeconds-3)s → durationSeconds.
   * When durationSeconds ≤ 10s, the body segment is skipped entirely (WR-05 —
   * was 8s; raised to ensure body windows are ≥ 3s, the three-beat rubric
   * minimum).
   */
  durationSeconds: number;
  /**
   * D-18 (Phase 13 Plan 03): when present, skip upload + poll. fileUri references
   * the file already uploaded by pipeline.ts entry block. Lifecycle is owned by
   * the caller — do NOT delete in finally{} when this is provided.
   */
  videoContext?: { fileUri: string; mimeType: string };
  /** Fallback: use inlineData when Files API is unavailable. Buffer sent as base64. */
  inlineVideoData?: { buffer: Buffer; mimeType: string };
}

/**
 * Analyze a TikTok-style vertical video as 3 parallel Gemini segments against
 * ONE Files API upload. See file-level docstring for the full architecture.
 *
 * D-18 (Phase 13 Plan 03): when opts.videoContext is provided, skip upload + poll.
 * fileUri comes from the caller (pipeline.ts entry block). Lifecycle is owned by caller.
 *
 * @param videoBuffer  Raw video bytes (≤ 287MB enforced before upload — D-19).
 * @param mimeType     Standard video MIME (e.g. "video/mp4", "video/webm").
 * @param opts         Prompt options + onStageEvent callback + durationSeconds.
 *                     opts.videoContext: when provided, skip upload (D-18).
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
  const ai = getClient();
  // D-18: uploadedFileName is only set when WE upload (videoContext absent).
  // Declare outside try/finally so finally block can always clean up.
  let uploadedFileName: string | undefined;

  try {
    let fileUri: string;
    let resolvedMimeType: string;

    if (opts.videoContext) {
      // D-18: caller pre-uploaded; skip size-cap + upload + poll. Use provided fileUri.
      fileUri = opts.videoContext.fileUri;
      resolvedMimeType = opts.videoContext.mimeType;
    } else {
      // Legacy path: size-cap + upload + poll.
      // ============================================================================
      // 1. Size-cap check — reject oversized buffers before any API call.
      // ============================================================================
      if (videoBuffer.byteLength > VIDEO_MAX_SIZE_BYTES) {
        throw new Error(
          "Video exceeds maximum size (287MB). Trim the video before uploading.",
        );
      }

      resolvedMimeType = mimeType;

      // ==========================================================================
      // 2. Single Files API upload (reuses gemini.ts:455-464 pattern verbatim).
      // ==========================================================================
      const blob = new Blob([new Uint8Array(videoBuffer)], { type: resolvedMimeType });
      const uploadResult = await ai.files.upload({
        file: blob,
        config: { mimeType: resolvedMimeType },
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
      fileUri = uploadResult.uri ?? "";
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
        fileUri = info.uri ?? "";
      }
      if (fileState === "FAILED") {
        // Files API outage: fall back to inlineData if buffer fits (~15MB raw).
        if (videoBuffer.byteLength <= 15 * 1024 * 1024) {
          opts.inlineVideoData = { buffer: videoBuffer, mimeType: resolvedMimeType };
          fileUri = ""; // segments will use inlineData path
        } else {
          throw new Error(
            "Video processing failed in Gemini Files API. The file may be corrupt or in an unsupported format.",
          );
        }
      }
      // CR-01: Guard against any state that is neither PROCESSING (handled in the loop)
      // nor FAILED (handled above) nor ACTIVE.
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
    }

    Sentry.addBreadcrumb({
      category: "engine.gemini.segmented",
      message: opts.videoContext
        ? "D-18: using caller-provided fileUri — fanning out 3 segments"
        : "Files API upload ACTIVE — fanning out 3 segments",
      level: "info",
      data: {
        uploadedFileName,
        durationSeconds: opts.durationSeconds,
        sharedFileUri: !!opts.videoContext,
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
      : runBodySegment(ai, fileUri, resolvedMimeType, opts);

    const [hookSettled, bodySettled, ctaSettled] = await Promise.allSettled([
      runHookSegment(ai, fileUri, resolvedMimeType, opts),
      bodyPromise,
      runCtaSegment(ai, fileUri, resolvedMimeType, opts),
    ]);

    // ==========================================================================
    // 6. Null-safe merge — emits pipeline_warning per failed segment (D-08/D-09).
    //
    //    When skipBody=true and body returned a synthetic { ok: false } above,
    //    mergeSegments would naturally emit a `gemini_body` pipeline_warning. The
    //    short-video branch is INTENDED, not a failure — suppress that one warning
    //    via a wrapping callback. All other events (hook, cta, aggregate cost cap)
    //    pass through to the original callback.
    //
    //    WR-04: Match the SPECIFIC "unavailable" message that mergeSegments emits
    //    for a failed body segment, NOT every gemini_body-staged event. This
    //    leaves the door open for future cost-cap or other body-attributed
    //    warnings (e.g. mergeSegments could emit a body-related cost-cap event)
    //    to flow through unsuppressed.
    // ==========================================================================
    const onStageEventForMerge: StageEventCallback | undefined = skipBody
      ? (event) => {
          const isSkipWarning =
            event.type === "pipeline_warning" &&
            event.stage === "gemini_body" &&
            event.message.includes("unavailable");
          if (isSkipWarning) {
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
    //    D-18: only delete if WE uploaded (uploadedFileName set). When videoContext
    //    was provided, caller (pipeline.ts) owns the lifecycle — do NOT delete here.
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
