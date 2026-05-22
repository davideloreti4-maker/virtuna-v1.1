import * as Sentry from "@sentry/nextjs";
import { GoogleGenAI, Type } from "@google/genai";
import { createLogger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentPayload, Wave0ContentTypeResult } from "../types";
import { Wave0ContentTypeResultSchema } from "../types";
import type { StageEventCallback } from "../events";
import { emitStageStart, emitStageEnd } from "../events";
import { NICHE_TREE } from "@/lib/niches/taxonomy";

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

// D-17: niche taxonomy slugs inlined for Gemini constrained output validation.
const NICHE_PRIMARY_SLUGS = NICHE_TREE.map((p) => p.slug);

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    type: {
      type: Type.STRING,
      enum: ["talking_head", "b_roll", "slideshow", "action", "tutorial", "vlog", "comedy", "other"],
    },
    confidence: { type: Type.NUMBER },
    mixed: { type: Type.BOOLEAN },
    dominant_seconds: { type: Type.NUMBER },
    secondary_type: {
      type: Type.STRING,
      enum: ["talking_head", "b_roll", "slideshow", "action", "tutorial", "vlog", "comedy", "other"],
    },
    // D-17: niche fields — returned alongside content_type in one Gemini call.
    niche_primary_slug: { type: Type.STRING },
    niche_micro_slug: { type: Type.STRING, nullable: true },
    niche_confidence: { type: Type.NUMBER },
  },
  required: ["type", "confidence", "mixed", "niche_primary_slug", "niche_confidence"],
};

// D-17: system prompt is constructed at module load (NICHE_TREE inlined once, byte-identical).
function buildSystemPrompt(): string {
  const primarySlugList = NICHE_PRIMARY_SLUGS.join(", ");
  const nicheTree = NICHE_TREE
    .map((p) => `- ${p.slug}: ${p.subs.map((s) => s.slug).join(", ")}`)
    .join("\n");

  return `You are a TikTok content-type and niche classifier. Watch the provided video segment (first 5 seconds of a TikTok-style short) and perform TWO tasks:

## Task 1: Content-Type Classification

Classify the video into ONE content type:

- talking_head: a person speaking directly to camera (interview-style, vlog-style, monologue)
- b_roll: aesthetic visuals with voiceover or text overlay, often product/lifestyle footage
- slideshow: still images or text cards swiped/fading in sequence (no motion footage)
- action: motion-heavy content (dance, sports, stunts, vehicles, choreography)
- tutorial: step-by-step demonstration of how to do something (recipe, makeup how-to, coding screencast)
- vlog: casual handheld self-recorded daily life, walk-and-talk, day-in-the-life
- comedy: skit/punchline-driven humor, character bits, reaction/duet jokes, joke-format content
- other: anything not clearly in the above (music, ASMR, gaming, animation, abstract, etc.)

Return a confidence (0.0-1.0) reflecting how clearly the video fits the chosen category.
If the video shifts type mid-stream, set mixed=true, return the DOMINANT type, set dominant_seconds, and set secondary_type.
If clarity is below 0.6, prefer 'other' over a forced guess.

## Task 2: Niche Classification (D-17)

Classify the video niche from this canonical taxonomy. Return ONLY slugs from this list.

Primary slugs: ${primarySlugList}

Sub-slugs by primary:
${nicheTree}

Return:
- niche_primary_slug: the primary niche slug that best describes this video content
- niche_micro_slug: an optional micro-niche slug in lowercase-hyphen format (e.g. "skincare-routine-morning"), or null if uncertain
- niche_confidence: confidence 0.0-1.0 that the niche classification is correct

ONLY return slugs from the taxonomy above for niche_primary_slug.
Score visual + audio together for both tasks; do not over-index on a single modality.`;
}

const SYSTEM_PROMPT = buildSystemPrompt();

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY environment variable");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

// D-17: extended return type includes niche fields from the folded Gemini call.
export interface Wave0ContentTypeExtendedResult extends Wave0ContentTypeResult {
  niche_primary_slug: string;
  niche_micro_slug: string | null;
  niche_confidence: number;
}

/**
 * Detects content type AND niche from first 5 seconds of video via Gemini 3 Flash.
 * Per CONTEXT D-01: 5s window, native videoMetadata, returns Wave0ContentTypeResult.
 * Per CONTEXT D-16: NEVER throws — returns null on any failure + emits stage_end with ok:false.
 *
 * D-17: niche fields (niche_primary_slug, niche_micro_slug, niche_confidence) folded into
 * the same Gemini call — eliminates the separate DeepSeek niche-detector call site.
 *
 * D-18: accepts optional videoContext — when provided, skips upload (caller owns lifecycle).
 *
 * Phase 4 GAP-04-01 fix: accepts a SupabaseClient and downloads via storage.from("videos").download()
 * instead of calling fetch(payload.video_url). Pre-fix, normalize.ts aliased the storage key into
 * video_url, causing fetch() to throw TypeError in production (raw key != valid URL).
 */
export async function detectContentType(
  payload: ContentPayload,
  supabase: SupabaseClient,
  videoContext?: { fileUri: string; mimeType: string } | null,
  onEvent?: StageEventCallback,
): Promise<Wave0ContentTypeExtendedResult | null> {
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
  // D-18: uploadedFileName is only set when WE upload (videoContext absent).
  // When videoContext is provided, caller owns lifecycle — no cleanup here.
  let uploadedFileName: string | undefined;

  try {
    const ai = getClient();

    let fileUri: string;
    let mimeType: string;
    let videoBuffer: Buffer | null = null; // hoisted for inlineData fallback

    if (videoContext) {
      // D-18: caller pre-uploaded; skip download + upload. Reference fileUri directly.
      fileUri = videoContext.fileUri;
      mimeType = videoContext.mimeType;
    } else {
      // Legacy path: download from Supabase Storage + upload to Gemini Files API.
      // Phase 4 GAP-04-01 fix: download via Supabase Storage, NOT fetch().
      // Pre-revision, normalize.ts aliased video_url to the storage key, which made
      // fetch() throw TypeError in production. Post-revision (Option A), video_url is
      // NEVER the storage key — the detector reads video_storage_path explicitly.
      // Canonical pattern: pipeline.ts:336-352.
      const { data: videoBlob, error: downloadError } = await supabase
        .storage
        .from("videos")
        .download(payload.video_storage_path!);

      if (downloadError || !videoBlob) {
        throw new Error(
          `Wave 0 video download failed: ${downloadError?.message ?? "no data"}`,
        );
      }

      videoBuffer = Buffer.from(await videoBlob.arrayBuffer());
      const buffer = videoBuffer;
      const ext = payload.video_storage_path!.split(".").pop()?.toLowerCase() ?? "mp4";
      mimeType = ext === "mov" ? "video/quicktime" : "video/mp4";

      const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
      const uploadResult = await ai.files.upload({ file: blob, config: { mimeType } });
      if (!uploadResult.name) throw new Error("Gemini Files API upload returned no name");
      uploadedFileName = uploadResult.name;

      // Poll for ACTIVE state (gemini.ts:454-475 pattern).
      let fileState = uploadResult.state;
      fileUri = uploadResult.uri ?? "";
      const pollStart = Date.now();
      while (fileState === "PROCESSING") {
        if (Date.now() - pollStart > POLL_TIMEOUT_MS) {
          throw new Error(`Gemini Files API processing timed out after ${POLL_TIMEOUT_MS / 1000}s`);
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        const info = await ai.files.get({ name: uploadedFileName });
        fileState = info.state;
        fileUri = info.uri ?? "";
      }
      if (fileState === "FAILED" || !fileUri) {
        // Files API outage fallback: use inlineData for videos ≤ 15MB (no upload needed).
        if (buffer && buffer.byteLength <= 15 * 1024 * 1024) {
          fileUri = ""; // signal to use inlineData path below
        } else {
          throw new Error(`Gemini Files API processing failed (state=${fileState})`);
        }
      }
    }

    // Determine video part: fileUri (Files API) or inlineData (fallback for FAILED/small).
    const videoPart = fileUri
      ? {
          fileData: { fileUri, mimeType },
          videoMetadata: { startOffset: "0s", endOffset: "5s" },
        }
      : {
          inlineData: { mimeType, data: videoBuffer!.toString("base64") },
        };

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
              videoPart,
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

    // D-17: validate niche_primary_slug is in taxonomy
    const nichePrimarySlug = typeof raw.niche_primary_slug === "string" && NICHE_PRIMARY_SLUGS.includes(raw.niche_primary_slug)
      ? raw.niche_primary_slug
      : NICHE_PRIMARY_SLUGS[0]; // fallback to first slug if Gemini returns unknown

    let result: Wave0ContentTypeExtendedResult = {
      ...validated.data,
      niche_primary_slug: nichePrimarySlug,
      niche_micro_slug: typeof raw.niche_micro_slug === "string" ? raw.niche_micro_slug : null,
      niche_confidence: typeof raw.niche_confidence === "number" ? raw.niche_confidence : 0,
    };

    if (raw.mixed === true) {
      result = { ...result, warning: "mixed_content_detected" };
    } else if (result.confidence < 0.6) {
      result = { ...result, warning: "low_confidence" };
    }

    log.info("Content-type + niche detection complete (D-17 folded)", {
      stage: "wave_0_content_type",
      type: result.type,
      confidence: result.confidence,
      niche_primary_slug: result.niche_primary_slug,
      niche_confidence: result.niche_confidence,
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
    // D-18: only delete if WE uploaded (uploadedFileName set). When videoContext
    // provided, caller owns lifecycle — do NOT delete here.
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
