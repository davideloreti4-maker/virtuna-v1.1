import * as Sentry from "@sentry/nextjs";
import { GoogleGenAI, Type } from "@google/genai";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import {
  GeminiResponseSchema,
  GeminiVideoResponseSchema,
  type AnalysisInput,
  type GeminiAnalysis,
  type GeminiVideoAnalysis,
} from "./types";

const log = createLogger({ module: "gemini" });

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const MAX_RETRIES = 2; // 3 total attempts
const TEXT_TIMEOUT_MS = 15_000;
const VIDEO_TIMEOUT_MS = 30_000;
const VIDEO_MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const VIDEO_POLL_INTERVAL_MS = 500;
const VIDEO_POLL_TIMEOUT_MS = 60_000;

// Flash pricing (2025): input $0.15/1M tokens, output $0.60/1M tokens
const INPUT_PRICE_PER_TOKEN = 0.15 / 1_000_000;
const OUTPUT_PRICE_PER_TOKEN = 0.60 / 1_000_000;
const FALLBACK_INPUT_TOKENS = 2000;
const FALLBACK_OUTPUT_TOKENS = 800;

let client: GoogleGenAI | null = null;

// Calibration data cache
interface CalibrationData {
  primary_kpis: {
    share_rate: { viral_threshold: number };
    weighted_engagement_score: { percentiles: { p90: number } };
  };
  duration_analysis: {
    sweet_spot_by_weighted_score: { optimal_range_seconds: number[] };
  };
  viral_vs_average: {
    differentiators: Array<{
      factor: string;
      difference_pct: number;
      description: string;
    }>;
  };
}

export const CalibrationBaselineSchema = z.object({
  primary_kpis: z.object({
    share_rate: z.object({ viral_threshold: z.number() }),
    weighted_engagement_score: z.object({ percentiles: z.object({ p90: z.number() }) }),
  }),
  duration_analysis: z.object({
    sweet_spot_by_weighted_score: z.object({ optimal_range_seconds: z.array(z.number()) }),
  }),
  viral_vs_average: z.object({
    differentiators: z.array(z.object({
      factor: z.string(),
      difference_pct: z.number(),
      description: z.string(),
    })),
  }),
});

const FALLBACK_CALIBRATION: CalibrationData = {
  primary_kpis: {
    share_rate: { viral_threshold: 0.02 },
    weighted_engagement_score: { percentiles: { p90: 85 } },
  },
  duration_analysis: {
    sweet_spot_by_weighted_score: { optimal_range_seconds: [15, 60] },
  },
  viral_vs_average: { differentiators: [] },
};

let cachedCalibration: CalibrationData | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY environment variable");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

/** Strip markdown code fences from LLM output */
function stripFences(text: string): string {
  const fenced = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
  return fenced ? fenced[1]!.trim() : text.trim();
}

/** Parse and validate Gemini response with Zod */
function parseGeminiResponse(raw: string): GeminiAnalysis {
  const cleaned = stripFences(raw);
  const parsed = JSON.parse(cleaned);
  const result = GeminiResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Gemini response validation failed: ${result.error.message}`);
  }
  return result.data;
}

/** Parse and validate Gemini video response with Zod */
function parseGeminiVideoResponse(raw: string): GeminiVideoAnalysis {
  const cleaned = stripFences(raw);
  const parsed = JSON.parse(cleaned);
  const result = GeminiVideoResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Gemini video response validation failed: ${result.error.message}`);
  }
  return result.data;
}

/** Load calibration data from JSON file, cached after first read.
 *  Returns null on malformed/missing file — callers must handle null. */
async function loadCalibrationData(): Promise<CalibrationData | null> {
  if (cachedCalibration) return cachedCalibration;

  try {
    const calibrationPath = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      "calibration-baseline.json"
    );
    const raw = await fs.readFile(calibrationPath, "utf-8");
    const parsed = JSON.parse(raw);
    cachedCalibration = CalibrationBaselineSchema.parse(parsed) as CalibrationData;
    return cachedCalibration;
  } catch (error) {
    log.warn("Failed to load calibration data", {
      error: error instanceof Error ? error.message : String(error),
    });
    cachedCalibration = null;
    return null;
  }
}

/** Calculate cost in cents from token usage metadata */
function calculateCost(
  promptTokens: number | undefined,
  candidateTokens: number | undefined
): number {
  const input = promptTokens ?? FALLBACK_INPUT_TOKENS;
  const output = candidateTokens ?? FALLBACK_OUTPUT_TOKENS;
  return (input * INPUT_PRICE_PER_TOKEN + output * OUTPUT_PRICE_PER_TOKEN) * 100;
}

/**
 * Build the text analysis prompt with calibration data embedded
 */
function buildTextPrompt(
  input: AnalysisInput,
  calibration: CalibrationData,
  niche?: string
): string {
  // Get top 3 viral differentiators by difference_pct
  const topDifferentiators = [...calibration.viral_vs_average.differentiators]
    .sort((a, b) => Math.abs(b.difference_pct) - Math.abs(a.difference_pct))
    .slice(0, 3);

  const systemPrompt = `You are a TikTok content analysis expert. Your job is to evaluate content quality across 5 specific factors that predict viral performance.

## The 5 Factors

1. **Scroll-Stop Power**: Would a user stop scrolling? Measures hook strength, curiosity gap, pattern interrupt, opening frame/line impact.
2. **Completion Pull**: Would a user watch to the end? Measures narrative tension, pacing, payoff anticipation, information drip.
3. **Rewatch Potential**: Would a user watch again? Measures layered meaning, satisfying loops, "wait what" moments, rewatchable reveals.
4. **Share Trigger**: Would a user share this? Measures relatability, identity signaling, emotional provocation, "tag someone" energy.
5. **Emotional Charge**: Does this make the user FEEL something? Measures intensity of emotion (joy, outrage, awe, nostalgia, humor), not which emotion.

## Scoring Rules

- Score each factor 0.0-10.0 with one decimal precision (e.g. 7.3)
- Use ABSOLUTE scoring — universal quality standards, NOT niche-relative
- Most content should score 4-7; scores above 8 are exceptional
- For each factor provide: score + rationale (1-2 sentences WHY) + improvement_tip (actionable${niche ? ", niche-aware" : ""} suggestion)

## Calibration Data (from 7,321 analyzed TikTok videos)

- Viral share rate threshold (p90): ${calibration.primary_kpis.share_rate.viral_threshold}
- Viral weighted engagement score (p90): ${calibration.primary_kpis.weighted_engagement_score.percentiles.p90}
- Duration sweet spot: ${calibration.duration_analysis.sweet_spot_by_weighted_score.optimal_range_seconds[0]}-${calibration.duration_analysis.sweet_spot_by_weighted_score.optimal_range_seconds[1]} seconds
- Top viral differentiators:
${topDifferentiators.map((d) => `  - ${d.factor}: ${d.description}`).join("\n")}

## Important

Score content quality only. Do NOT apply algorithm weights or predict engagement metrics — that happens downstream.

Return JSON matching the schema exactly. The factors array must contain exactly 5 objects with names: "Scroll-Stop Power", "Completion Pull", "Rewatch Potential", "Share Trigger", "Emotional Charge".`;

  const userMessage = `${niche ? `Niche: ${niche}\n\n` : ""}Content type: ${input.content_type}\nContent:\n${input.content_text}`;

  return `${systemPrompt}\n\n---\n\n${userMessage}`;
}

/**
 * Build the video analysis prompt with calibration data embedded
 */
function buildVideoPrompt(
  calibration: CalibrationData,
  niche?: string
): string {
  const topDifferentiators = [...calibration.viral_vs_average.differentiators]
    .sort((a, b) => Math.abs(b.difference_pct) - Math.abs(a.difference_pct))
    .slice(0, 3);

  return `You are a TikTok video content analysis expert. Your job is to evaluate video content quality across 5 specific factors and 4 video production signals.

## The 5 Factors (evaluate based on visual AND audio content)

1. **Scroll-Stop Power**: Would a user stop scrolling? Measures hook strength in the first 1-3 seconds, curiosity gap, visual pattern interrupt, opening frame impact.
2. **Completion Pull**: Would a user watch to the end? Measures narrative tension, visual pacing, payoff anticipation, information drip through visuals and audio.
3. **Rewatch Potential**: Would a user watch again? Measures layered visual meaning, satisfying loops, "wait what" moments, rewatchable visual reveals.
4. **Share Trigger**: Would a user share this? Measures visual relatability, identity signaling, emotional visual provocation, "tag someone" energy.
5. **Emotional Charge**: Does this make the user FEEL something? Measures intensity of visual/audio emotion (joy, outrage, awe, nostalgia, humor), not which emotion.

## Video Signals (additional video-specific evaluation)

- **visual_production_quality**: Lighting, framing, resolution, overall visual polish (0-10)
- **hook_visual_impact**: First 3 seconds visual hook effectiveness (0-10)
- **pacing_score**: Cut frequency, rhythm, dead air avoidance (0-10)
- **transition_quality**: Smooth cuts, creative transitions, visual flow (0-10)

## Scoring Rules

- Score each factor and video signal 0.0-10.0 with one decimal precision (e.g. 7.3)
- Use ABSOLUTE scoring — universal quality standards, NOT niche-relative
- Most content should score 4-7; scores above 8 are exceptional
- For each factor provide: score + rationale (1-2 sentences WHY) + improvement_tip (actionable${niche ? ", niche-aware" : ""} suggestion)

## Calibration Data (from 7,321 analyzed TikTok videos)

- Viral share rate threshold (p90): ${calibration.primary_kpis.share_rate.viral_threshold}
- Viral weighted engagement score (p90): ${calibration.primary_kpis.weighted_engagement_score.percentiles.p90}
- Duration sweet spot: ${calibration.duration_analysis.sweet_spot_by_weighted_score.optimal_range_seconds[0]}-${calibration.duration_analysis.sweet_spot_by_weighted_score.optimal_range_seconds[1]} seconds
- Top viral differentiators:
${topDifferentiators.map((d) => `  - ${d.factor}: ${d.description}`).join("\n")}

## Important

Score content quality only. Do NOT apply algorithm weights or predict engagement metrics — that happens downstream.

Return JSON matching the schema exactly. The factors array must contain exactly 5 objects with names: "Scroll-Stop Power", "Completion Pull", "Rewatch Potential", "Share Trigger", "Emotional Charge". Include the video_signals object with all 4 fields.${niche ? `\n\nNiche: ${niche}` : ""}`;
}

/** Gemini structured output schema for text mode */
const TEXT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    factors: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          score: { type: Type.NUMBER },
          rationale: { type: Type.STRING },
          improvement_tip: { type: Type.STRING },
        },
        required: ["name", "score", "rationale", "improvement_tip"],
      },
    },
    overall_impression: { type: Type.STRING },
    content_summary: { type: Type.STRING },
  },
  required: ["factors", "overall_impression", "content_summary"],
};

/** Gemini structured output schema for video mode (includes video_signals) */
const VIDEO_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    factors: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          score: { type: Type.NUMBER },
          rationale: { type: Type.STRING },
          improvement_tip: { type: Type.STRING },
        },
        required: ["name", "score", "rationale", "improvement_tip"],
      },
    },
    overall_impression: { type: Type.STRING },
    content_summary: { type: Type.STRING },
    video_signals: {
      type: Type.OBJECT,
      properties: {
        visual_production_quality: { type: Type.NUMBER },
        hook_visual_impact: { type: Type.NUMBER },
        pacing_score: { type: Type.NUMBER },
        transition_quality: { type: Type.NUMBER },
      },
      required: [
        "visual_production_quality",
        "hook_visual_impact",
        "pacing_score",
        "transition_quality",
      ],
    },
  },
  required: [
    "factors",
    "overall_impression",
    "content_summary",
    "video_signals",
  ],
};

/**
 * Analyze text content with Gemini Flash
 * Uses structured output + Zod validation + retry logic + calibration data
 */
export async function analyzeWithGemini(
  input: AnalysisInput
): Promise<{ analysis: GeminiAnalysis; cost_cents: number }> {
  const startTime = performance.now();
  const ai = getClient();
  const calibration = (await loadCalibrationData()) ?? FALLBACK_CALIBRATION;
  const niche = input.society_id ?? undefined;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TEXT_TIMEOUT_MS);

      const prompt =
        attempt === 0
          ? buildTextPrompt(input, calibration, niche)
          : `Your previous response was not valid JSON. Return ONLY the JSON object with no extra text.\n\n${buildTextPrompt(input, calibration, niche)}`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: TEXT_RESPONSE_SCHEMA,
          abortSignal: controller.signal,
        },
      });

      clearTimeout(timeout);

      const text = response.text ?? "";
      const analysis = parseGeminiResponse(text);

      // Token-based cost estimation
      const promptTokens = response.usageMetadata?.promptTokenCount;
      const candidateTokens = response.usageMetadata?.candidatesTokenCount;
      const cost_cents = calculateCost(promptTokens, candidateTokens);

      if (cost_cents > 0.5) {
        log.warn("Text analysis cost exceeds soft cap", {
          cost_cents: +cost_cents.toFixed(4),
          soft_cap: 0.5,
        });
      }

      const duration_ms = Math.round(performance.now() - startTime);
      log.info("Text analysis complete", {
        stage: "gemini_text_analysis",
        duration_ms,
        cost_cents: +cost_cents.toFixed(4),
        model: GEMINI_MODEL,
      });

      Sentry.addBreadcrumb({
        category: "engine.gemini",
        message: "Text analysis complete",
        level: "info",
        data: { duration_ms, cost_cents: +cost_cents.toFixed(4), model: GEMINI_MODEL },
      });

      return { analysis, cost_cents };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (lastError.name === "AbortError") {
        throw new Error(`Gemini request timed out after ${TEXT_TIMEOUT_MS}ms`);
      }
      if (attempt === MAX_RETRIES) break;
      // Exponential backoff: 1s, 3s
      const delay = attempt === 0 ? 1000 : 3000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  Sentry.captureException(lastError, {
    tags: { stage: "gemini_text_analysis" },
  });
  throw new Error(
    `Gemini analysis failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`
  );
}

/**
 * Analyze video content with Gemini Flash via file upload
 *
 * Uploads video to Gemini Files API, waits for processing, analyzes with
 * video-specific prompt, returns 5 TikTok factors + 4 video signals.
 * Errors throw immediately — no partial results, no fallback to text mode.
 */
export async function analyzeVideoWithGemini(
  videoBuffer: Buffer,
  mimeType: string,
  niche?: string
): Promise<{ analysis: GeminiVideoAnalysis; cost_cents: number }> {
  const videoStartTime = performance.now();
  const ai = getClient();
  const calibration = (await loadCalibrationData()) ?? FALLBACK_CALIBRATION;

  // Size cap: reject videos over 50MB
  if (videoBuffer.byteLength > VIDEO_MAX_SIZE_BYTES) {
    throw new Error(
      "Video exceeds maximum size (50MB / ~3 minutes). Trim the video before uploading."
    );
  }

  // Upload video to Gemini Files API
  let uploadedFileName: string | undefined;
  try {
    const blob = new Blob([new Uint8Array(videoBuffer)], { type: mimeType });
    const uploadResult = await ai.files.upload({
      file: blob,
      config: { mimeType },
    });

    if (!uploadResult.name) {
      throw new Error("Video upload failed: no file name returned from Gemini Files API");
    }
    uploadedFileName = uploadResult.name;

    // Poll for file processing completion
    const pollStart = Date.now();
    let fileState = uploadResult.state;
    let fileUri = uploadResult.uri;

    while (fileState === "PROCESSING") {
      if (Date.now() - pollStart > VIDEO_POLL_TIMEOUT_MS) {
        throw new Error(
          `Video processing timed out after ${VIDEO_POLL_TIMEOUT_MS / 1000}s. The file may be too large or complex.`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, VIDEO_POLL_INTERVAL_MS));

      const fileInfo = await ai.files.get({ name: uploadedFileName });
      fileState = fileInfo.state;
      fileUri = fileInfo.uri;
    }

    if (fileState === "FAILED") {
      throw new Error("Video processing failed in Gemini Files API. The file may be corrupt or in an unsupported format.");
    }

    if (!fileUri) {
      throw new Error("Video upload succeeded but no file URI was returned.");
    }

    // Build video prompt and analyze
    const videoPrompt = buildVideoPrompt(calibration, niche);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VIDEO_TIMEOUT_MS);

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: videoPrompt },
            { fileData: { fileUri, mimeType } },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: VIDEO_RESPONSE_SCHEMA,
        abortSignal: controller.signal,
      },
    });

    clearTimeout(timeout);

    const text = response.text ?? "";
    const analysis = parseGeminiVideoResponse(text);

    // Token-based cost estimation (video tokens counted automatically by Gemini)
    const promptTokens = response.usageMetadata?.promptTokenCount;
    const candidateTokens = response.usageMetadata?.candidatesTokenCount;
    const cost_cents = calculateCost(promptTokens, candidateTokens);

    if (cost_cents > 2.0) {
      log.warn("Video analysis cost exceeds soft cap", {
        cost_cents: +cost_cents.toFixed(4),
        soft_cap: 2.0,
      });
    }

    const duration_ms = Math.round(performance.now() - videoStartTime);
    log.info("Video analysis complete", {
      stage: "gemini_video_analysis",
      duration_ms,
      cost_cents: +cost_cents.toFixed(4),
      model: GEMINI_MODEL,
    });

    Sentry.addBreadcrumb({
      category: "engine.gemini",
      message: "Video analysis complete",
      level: "info",
      data: { duration_ms, cost_cents: +cost_cents.toFixed(4), model: GEMINI_MODEL },
    });

    return { analysis, cost_cents };
  } catch (error) {
    Sentry.captureException(error, {
      tags: { stage: "gemini_video_analysis" },
    });
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Gemini video analysis timed out after ${VIDEO_TIMEOUT_MS}ms`);
    }
    // Re-throw with context if not already descriptive
    if (error instanceof Error) throw error;
    throw new Error(`Video analysis failed: ${String(error)}`);
  } finally {
    // Clean up: delete uploaded file (best-effort)
    if (uploadedFileName) {
      try {
        await ai.files.delete({ name: uploadedFileName });
      } catch {
        // Best-effort cleanup — don't throw if delete fails
      }
    }
  }
}

export { GEMINI_MODEL };
