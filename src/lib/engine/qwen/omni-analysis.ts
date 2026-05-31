/**
 * Wave 0 + Wave 1 unified analysis via qwen3.5-omni-plus.
 *
 * Single call replaces:
 *   - Gemini segmented (hook/body/CTA — 3 parallel calls via Files API)
 *   - Wave 0 content-type + niche detector
 *   - Audio signals extraction
 *
 * Video is passed as a Supabase signed URL — no upload, no polling, no cleanup.
 */

import * as Sentry from "@sentry/nextjs";
import { createLogger } from "@/lib/logger";
import type { GeminiVideoAnalysis, Wave0Result } from "../types";
import type { StageEventCallback } from "../events";
import { getQwenClient, QWEN_OMNI_MODEL, QWEN_SEED } from "./client";
import { calculateCost } from "./cost";
import { OmniAnalysisZodSchema } from "./schemas";
import type { SegmentGrid } from "./schemas";
import { normalizeSegments } from "./normalize-segments";
import { stripModelOutput } from "../utils/strip";

const log = createLogger({ module: "engine.qwen.omni" });

const MAX_RETRIES = 1; // 2 total attempts
const TIMEOUT_MS  = 60_000;

export interface OmniAnalysisOptions {
  niche?:        string;
  content_type?: string;
  onEvent?:      StageEventCallback;
}

export interface OmniAnalysisOutput {
  geminiResult: { analysis: GeminiVideoAnalysis; cost_cents: number } | null;
  wave0Result:  Wave0Result;
  audio_perceptual_score: number | null;
  signalAvailability: {
    gemini_hook: boolean;
    gemini_body: boolean;
    gemini_cta:  boolean;
  };
  /** Phase 3 (D-07) — Normalized segment grid from Wave 0. Undefined when omni skips
   *  segments or normalizer falls back gracefully (normalizer always returns non-empty
   *  after normalization; undefined only when the full omni call failed). */
  segments?: SegmentGrid[];
}

const CONTENT_TYPE_VALUES = [
  "talking_head", "b_roll", "slideshow", "action",
  "tutorial", "vlog", "comedy", "other",
] as const;

export function buildSystemPrompt(opts: OmniAnalysisOptions): string {
  const nicheHint = opts.niche        ? `\nCreator niche hint: ${opts.niche}` : "";
  const ctypeHint = opts.content_type ? `\nContent-type hint: ${opts.content_type}` : "";

  return `You are an expert TikTok content analyst. Analyze the provided video and return a single JSON object with the exact structure below. All scores are 0-10 unless noted otherwise.

IMPORTANT: cognitive_load uses INVERTED polarity — higher score means MORE cognitive load and WORSE viewer retention.${nicheHint}${ctypeHint}

Return ONLY valid JSON matching this exact structure:

{
  "content_type": "<one of: talking_head|b_roll|slideshow|action|tutorial|vlog|comedy|other>",
  "niche_primary_slug": "<primary niche slug e.g. fitness, cooking, comedy, education>",
  "niche_micro_slug": "<specific sub-niche or null>",

  "factors": [
    { "name": "Scroll-Stop Power", "score": 0-10, "rationale": "...", "improvement_tip": "..." },
    { "name": "Completion Pull",   "score": 0-10, "rationale": "...", "improvement_tip": "..." },
    { "name": "Rewatch Potential", "score": 0-10, "rationale": "...", "improvement_tip": "..." },
    { "name": "Share Trigger",     "score": 0-10, "rationale": "...", "improvement_tip": "..." },
    { "name": "Emotional Charge",  "score": 0-10, "rationale": "...", "improvement_tip": "..." }
  ],
  "overall_impression": "<overall assessment, max 500 chars>",
  "content_summary": "<brief content description, max 500 chars>",

  "hook_visual_impact": 0-10,
  "hook_decomposition": {
    "visual_stop_power":        0-10,
    "audio_hook_quality":       0-10,
    "text_overlay_score":       0-10,
    "first_words_speech_score": 0-10,
    "weakest_modality": "<one of: visual_stop_power|audio_hook_quality|text_overlay_score|first_words_speech_score>",
    "visual_audio_coherence":   0-10,
    "cognitive_load":           0-10,
    "watermark_detected": { "tiktok": bool, "ig": bool, "yt": bool }
  },

  "video_signals": {
    "visual_production_quality": 0-10,
    "pacing_score":              0-10,
    "transition_quality":        0-10
  },

  "cta_segment": {
    "cta_present": true|false,
    "strength":    0-10 or null,
    "type":        "follow"|"comment"|"link_in_bio"|"watch_next"|"engage_question"|"other" or null,
    "rationale":   "..."
  },

  "audio_signals": {
    "voice_clarity_0_10":       0-10 or null,
    "audio_hook_first_2s_0_10": 0-10 or null,
    "silence_ratio":   0-1,
    "voiceover_ratio": 0-1,
    "music_ratio":     0-1,
    "audio_description": "<50-150 char audio description>"
  },
  "audio_perceptual_score": 0-100,

  "emotion_arc": [
    { "timestamp_ms": 0,    "intensity_0_1": 0.3, "label": "low" },
    { "timestamp_ms": 5000, "intensity_0_1": 0.8, "label": "high" }
  ],

  "segments": [
    {
      "t_start": 0.0,
      "t_end": 2.8,
      "visual_event": "<brief description of dominant visual change>",
      "audio_event": "<brief description of dominant audio/speech change>",
      "scene_boundary_reason": "<why this is a scene boundary, optional>"
    }
  ]
}

Rules:
- cta_present=true requires strength and type non-null; cta_present=false requires both null.
- silence_ratio + voiceover_ratio + music_ratio must sum to ~1.0 (±0.1).
- voice_clarity and audio_hook are null only for slideshow or silent content.
- watermark_detected fields are optional (omit if none detected).
- emotion_arc is REQUIRED whenever video is present: you MUST emit 3-8 points across
  the timeline at emotional inflection points (or evenly spaced if the affect is flat —
  never return an empty array for video). Use intensity_0_1 in [0,1]; label is a
  categorical helper ("low"|"mid"|"high"). ONLY omit the emotion_arc field entirely for
  non-video / silent / slideshow content where no temporal affect signal exists.

Rules for segments:
- Detect natural scene boundaries (cut, transition, topic shift, pacing change).
- Hook zone 0-3s MUST be its own segment even if no boundary detected.
- Minimum segment duration: 1s (merge shorter cuts into adjacent segment).
- If fewer than 4 boundaries detected: return 2s fixed buckets (1s for <8s videos).
- Sort by t_start ascending. No overlap. t_end of segment[i] = t_start of segment[i+1].`;
}

export async function analyzeVideoWithOmni(
  videoUrl: string,
  opts: OmniAnalysisOptions = {},
): Promise<OmniAnalysisOutput> {
  const ai    = getQwenClient();
  const model = QWEN_OMNI_MODEL;

  const nullAvailability = { gemini_hook: false, gemini_body: false, gemini_cta: false };
  const nullWave0: Wave0Result = { content_type: null, niche: null };

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      log.info("omni analysis start", { model, attempt, videoUrl: videoUrl.slice(0, 80) });

      const extraInstruction = attempt > 0
        ? "\nIMPORTANT: Your previous response was not valid JSON. Return ONLY the raw JSON object, no explanation."
        : "";

      const completion = await ai.chat.completions.create(
        {
          model,
          messages: [
            {
              role: "system",
              content: buildSystemPrompt(opts) + extraInstruction,
            },
            {
              role: "user",
              content: [
                {
                  type: "video_url" as never,
                  video_url: { url: videoUrl },
                } as never,
                {
                  type: "text",
                  text: "Analyze this TikTok video and return the JSON object as specified.",
                },
              ],
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0, // reproducible factors/hook/segments — same video → same score
          seed: QWEN_SEED,
        },
        { signal: controller.signal },
      );

      clearTimeout(timer);

      const raw     = completion.choices[0]?.message?.content ?? "";
      const cleaned = stripModelOutput(raw);
      const parsed  = JSON.parse(cleaned);
      const result  = OmniAnalysisZodSchema.safeParse(parsed);

      if (!result.success) {
        log.warn("Omni Zod validation failed", { attempt, error: result.error.message });
        lastError = result.error;
        continue;
      }

      const data       = result.data;
      const cost_cents = calculateCost(model, completion.usage ?? undefined);

      // D-07 + D-08: normalize segments after Zod parse, before returning to consumers.
      // Derive video duration from highest t_end as defensive fallback when not passed in opts.
      const rawDuration = data.segments?.reduce((max, s) => Math.max(max, s.t_end), 0) ?? 0;
      const videoDurationSeconds = rawDuration > 0 ? rawDuration : 30; // 30s fallback if no segments
      const normalizedSegments: SegmentGrid[] = normalizeSegments(data.segments as SegmentGrid[] | undefined, videoDurationSeconds);

      const ctypeSlug = CONTENT_TYPE_VALUES.includes(data.content_type as never)
        ? (data.content_type as (typeof CONTENT_TYPE_VALUES)[number])
        : "other";

      const wave0Result: Wave0Result = {
        content_type: { type: ctypeSlug, confidence: 1.0 },
        niche: {
          primary_slug: data.niche_primary_slug,
          micro_slug:   data.niche_micro_slug ?? null,
          confidence:   1.0,
        },
      };

      const analysis = {
        factors:            data.factors,
        overall_impression: data.overall_impression,
        content_summary:    data.content_summary,
        video_signals: {
          visual_production_quality: data.video_signals.visual_production_quality,
          hook_visual_impact:        data.hook_visual_impact,
          pacing_score:              data.video_signals.pacing_score,
          transition_quality:        data.video_signals.transition_quality,
        },
        audio_signals:      data.audio_signals,
        hook_decomposition: data.hook_decomposition,
        cta_segment:        data.cta_segment,
        // emotion_arc MUST be threaded here. The aggregator plucks it off
        // geminiResult.analysis.emotion_arc (aggregator.ts ~692). Omitting it
        // — the original bug — silently dropped a Zod-parsed field on EVERY run,
        // so emotion_arc was null on 100% of persisted rows despite the prompt
        // marking it REQUIRED (26/26 rows null, confirmed in prod). GeminiVideoAnalysis
        // doesn't declare the field (Omni-only extension), so it rides through the
        // `as` cast and the aggregator's matching `as unknown as { emotion_arc? }` read.
        // Do NOT "clean up" by removing it — that re-introduces the drop.
        emotion_arc:        data.emotion_arc,
      } as GeminiVideoAnalysis;

      // emotion_arc_points surfaces whether the MODEL actually emitted the field
      // (vs the assembly dropping it). After this fix, a run logging 0 points means
      // the model genuinely returned none — a prompt problem, not a plumbing one.
      log.info("omni analysis complete", { model, cost_cents, attempt, emotion_arc_points: data.emotion_arc?.length ?? 0 });

      return {
        geminiResult: { analysis, cost_cents },
        wave0Result,
        audio_perceptual_score: data.audio_perceptual_score,
        signalAvailability: { gemini_hook: true, gemini_body: true, gemini_cta: true },
        segments: normalizedSegments,
      };

    } catch (err: unknown) {
      clearTimeout(timer);
      lastError = err;
      const isAbort = err instanceof Error && err.name === "AbortError";
      log.warn("Omni analysis attempt failed", { attempt, error: String(err), isAbort });
      if (attempt >= MAX_RETRIES) break;
    }
  }

  Sentry.captureException(lastError, { tags: { stage: "omni_analysis" } });
  log.error("Omni analysis failed after all retries", { error: String(lastError) });

  return {
    geminiResult:           null,
    wave0Result:            nullWave0,
    audio_perceptual_score: null,
    signalAvailability:     nullAvailability,
  };
}
