import * as Sentry from "@sentry/nextjs";
import { GoogleGenAI, Type } from "@google/genai";
import { createLogger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentPayload, Wave0ContentTypeResult } from "../types";
import { Wave0ContentTypeResultSchema } from "../types";
import type { StageEventCallback } from "../events";
import { emitStageStart, emitStageEnd } from "../events";

const log = createLogger({ module: "wave0.content-type" });

// Phase 4 D-04: separate model env (do NOT touch gemini.ts GEMINI_MODEL).
// Default is "gemini-3-flash-preview" (NOT "gemini-3-flash" — bare alias invalid as of 2026-05-18).
const GEMINI_WAVE0_MODEL = process.env.GEMINI_WAVE0_MODEL ?? "gemini-3-flash-preview";

// Pricing constants for Gemini 3 Flash per RESEARCH Topic #13.
const INPUT_PRICE_PER_TOKEN = 0.50 / 1_000_000;  // $0.50/M input tokens
const OUTPUT_PRICE_PER_TOKEN = 3.00 / 1_000_000; // $3/M output tokens
const FALLBACK_INPUT_TOKENS = 500;
const FALLBACK_OUTPUT_TOKENS = 80;

const TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 60_000;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    type: {
      type: Type.STRING,
      enum: ["talking_head", "b_roll", "slideshow", "action", "tutorial", "vlog", "other"],
    },
    confidence: { type: Type.NUMBER },
    mixed: { type: Type.BOOLEAN },
    dominant_seconds: { type: Type.NUMBER },
    secondary_type: {
      type: Type.STRING,
      enum: ["talking_head", "b_roll", "slideshow", "action", "tutorial", "vlog", "other"],
    },
  },
  required: ["type", "confidence", "mixed"],
};

const SYSTEM_PROMPT = `You are a TikTok content-type classifier. Watch the provided video segment (first 5 seconds of a TikTok-style short) and classify it into ONE of:

- talking_head: a person speaking directly to camera (interview-style, vlog-style, monologue)
- b_roll: aesthetic visuals with voiceover or text overlay, often product/lifestyle footage
- slideshow: still images or text cards swiped/fading in sequence (no motion footage)
- action: motion-heavy content (dance, sports, stunts, vehicles, choreography)
- tutorial: step-by-step demonstration of how to do something (recipe, makeup how-to, coding screencast)
- vlog: casual handheld self-recorded daily life, walk-and-talk, day-in-the-life
- other: anything not clearly in the above (music, ASMR, gaming, animation, abstract, etc.)

Return a confidence (0.0-1.0) reflecting how clearly the video fits the chosen category.
If the video shifts type mid-stream (e.g., 2s talking-head then 3s b-roll), set mixed=true, return the DOMINANT type (most seconds), set dominant_seconds to how many of the 5 the dominant type covered, and set secondary_type to the other type observed.
If clarity is below 0.6, prefer 'other' over a forced guess.
Score visual + audio together; do not over-index on a single modality.`;

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY environment variable");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

/**
 * Detects content type from first 5 seconds of video via Gemini 3 Flash.
 * Per CONTEXT D-01: 5s window, native videoMetadata, returns Wave0ContentTypeResult.
 * Per CONTEXT D-16: NEVER throws — returns null on any failure + emits stage_end with ok:false.
 *
 * Phase 4 GAP-04-01 fix: accepts a SupabaseClient and downloads via storage.from("videos").download()
 * instead of calling fetch(payload.video_url). Pre-fix, normalize.ts aliased the storage key into
 * video_url, causing fetch() to throw TypeError in production (raw key != valid URL).
 */
export async function detectContentType(
  payload: ContentPayload,
  supabase: SupabaseClient,
  onEvent?: StageEventCallback,
): Promise<Wave0ContentTypeResult | null> {
  const startTs = emitStageStart(onEvent, "wave_0_content_type", 0);

  // No video to classify — emit start/end pair and return null gracefully (preserves stub contract).
  if (payload.input_mode !== "video_upload" || !payload.video_storage_path) {
    emitStageEnd(onEvent, "wave_0_content_type", 0, startTs, {
      cost_cents: 0,
      ok: true,
      warning: "no_video_input_skipping_content_type",
    });
    return null;
  }

  let costCents = 0;
  let uploadedFileName: string | undefined;

  try {
    const ai = getClient();

    // Phase 4 GAP-04-01 fix: download via Supabase Storage, NOT fetch().
    // Pre-revision, normalize.ts aliased video_url to the storage key, which made
    // fetch() throw TypeError in production. Post-revision (Option A), video_url is
    // NEVER the storage key — the detector reads video_storage_path explicitly.
    // Canonical pattern: pipeline.ts:336-352.
    const { data: videoBlob, error: downloadError } = await supabase
      .storage
      .from("videos")
      .download(payload.video_storage_path);

    if (downloadError || !videoBlob) {
      throw new Error(
        `Wave 0 video download failed: ${downloadError?.message ?? "no data"}`,
      );
    }

    const buffer = Buffer.from(await videoBlob.arrayBuffer());
    const ext = payload.video_storage_path.split(".").pop()?.toLowerCase() ?? "mp4";
    const mimeType = ext === "mov" ? "video/quicktime" : "video/mp4";

    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    const uploadResult = await ai.files.upload({ file: blob, config: { mimeType } });
    if (!uploadResult.name) throw new Error("Gemini Files API upload returned no name");
    uploadedFileName = uploadResult.name;

    // Poll for ACTIVE state (gemini.ts:454-475 pattern).
    let fileState = uploadResult.state;
    let fileUri = uploadResult.uri;
    const pollStart = Date.now();
    while (fileState === "PROCESSING") {
      if (Date.now() - pollStart > POLL_TIMEOUT_MS) {
        throw new Error(`Gemini Files API processing timed out after ${POLL_TIMEOUT_MS / 1000}s`);
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const info = await ai.files.get({ name: uploadedFileName });
      fileState = info.state;
      fileUri = info.uri;
    }
    if (fileState === "FAILED" || !fileUri) {
      throw new Error(`Gemini Files API processing failed (state=${fileState})`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response;
    try {
      response = await ai.models.generateContent({
        model: GEMINI_WAVE0_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              { text: SYSTEM_PROMPT },
              {
                // CRITICAL: startOffset/endOffset are STRING durations per RESEARCH Anti-Pattern.
                fileData: { fileUri, mimeType },
                videoMetadata: { startOffset: "0s", endOffset: "5s" },
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          abortSignal: controller.signal,
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    const promptTokens = response.usageMetadata?.promptTokenCount ?? FALLBACK_INPUT_TOKENS;
    const candidateTokens = response.usageMetadata?.candidatesTokenCount ?? FALLBACK_OUTPUT_TOKENS;
    costCents =
      (promptTokens * INPUT_PRICE_PER_TOKEN + candidateTokens * OUTPUT_PRICE_PER_TOKEN) * 100;

    const rawText = response.text ?? "{}";
    const raw = JSON.parse(rawText);
    const validated = Wave0ContentTypeResultSchema.safeParse({
      type: raw.type,
      confidence: raw.confidence,
      // warning is set below based on confidence/mixed signals
    });
    if (!validated.success) {
      throw new Error(`Content-type response validation failed: ${validated.error.message}`);
    }

    let result: Wave0ContentTypeResult = validated.data;
    if (raw.mixed === true) {
      result = { ...result, warning: "mixed_content_detected" };
    } else if (result.confidence < 0.6) {
      result = { ...result, warning: "low_confidence" };
    }

    log.info("Content-type detection complete", {
      stage: "wave_0_content_type",
      type: result.type,
      confidence: result.confidence,
      cost_cents: +costCents.toFixed(4),
      warning: result.warning,
    });

    emitStageEnd(onEvent, "wave_0_content_type", 0, startTs, {
      cost_cents: +costCents.toFixed(4),
      ok: true,
      warning: result.warning,
    });
    return result;
  } catch (error) {
    Sentry.captureException(error, { tags: { stage: "wave_0_content_type" } });
    const message = error instanceof Error ? error.message : String(error);
    log.warn("Content-type detection failed", { error: message });
    emitStageEnd(onEvent, "wave_0_content_type", 0, startTs, {
      cost_cents: +costCents.toFixed(4),
      ok: false,
      warning: message,
    });
    return null;
  } finally {
    if (uploadedFileName) {
      try {
        const ai = getClient();
        await ai.files.delete({ name: uploadedFileName });
      } catch {
        // best-effort cleanup
      }
    }
  }
}
