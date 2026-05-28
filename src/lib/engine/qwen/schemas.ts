/**
 * Qwen Omni analysis schemas — merged Wave 0 + Wave 1 output.
 *
 * Preserves all field names from the legacy Gemini segmented schemas so that
 * the aggregator, pipeline, and downstream consumers are unchanged.
 *
 * POLARITY WARNING: cognitive_load uses INVERTED polarity (higher = WORSE retention).
 * Never average with other hook fields without inverting first (10 - cognitive_load).
 */

import { z } from "zod";

const ScoreSchema = z.number().min(0).max(10);

export const HookDecompositionZodSchema = z.object({
  visual_stop_power:        ScoreSchema,
  audio_hook_quality:       ScoreSchema,
  text_overlay_score:       ScoreSchema,
  first_words_speech_score: ScoreSchema,
  weakest_modality: z.enum([
    "visual_stop_power",
    "audio_hook_quality",
    "text_overlay_score",
    "first_words_speech_score",
  ]),
  visual_audio_coherence: ScoreSchema,
  // POLARITY INVERTED: higher score = MORE cognitive load = WORSE retention.
  cognitive_load: ScoreSchema,
  watermark_detected: z.object({
    tiktok: z.boolean().optional(),
    ig:     z.boolean().optional(),
    yt:     z.boolean().optional(),
  }).optional(),
});

const HookFactorSchema = z.object({
  name: z.enum([
    "Scroll-Stop Power",
    "Completion Pull",
    "Rewatch Potential",
    "Share Trigger",
    "Emotional Charge",
  ]),
  score:           ScoreSchema,
  rationale:       z.string().min(1).max(300),
  improvement_tip: z.string().max(300).optional(),
});

// =====================================================
// Phase 1 (R1.7) — Emotion arc timeline point
// =====================================================
// Per-segment emotion intensity emitted by Omni Plus. Adds the curve that
// downstream P3 emotion-arc panel renders. Existing factors[].name="Emotional
// Charge" single-score remains unchanged (multiple downstream consumers).
// Backward compat: emotion_arc is .optional() on OmniAnalysisZodSchema (see A3).
export const EmotionArcPointSchema = z.object({
  timestamp_ms:  z.number().min(0),
  intensity_0_1: z.number().min(0).max(1),
  label:         z.enum(["low", "mid", "high"]).optional(),
});

/** Phase 1 (R1.7) — Inferred TS type used by aggregator + types.ts. */
export type EmotionArcPoint = z.infer<typeof EmotionArcPointSchema>;

// D-07: Wave 0 hybrid segment grid (scene-boundary primary, fixed-bucket fallback).
// Server-side normalizer (Plan 06) sets is_hook_zone after validation per D-07.
export const SegmentSchema = z.object({
  t_start: z.number().min(0),
  t_end:   z.number().min(0),
  visual_event: z.string().max(200),
  audio_event:  z.string().max(200),
  scene_boundary_reason: z.string().max(300).optional(),
  is_hook_zone: z.boolean().optional(),
  idx: z.number().int().min(0).optional(),
});
export type SegmentGrid = z.infer<typeof SegmentSchema>;

export const CtaSegmentZodSchema = z
  .object({
    cta_present: z.boolean(),
    strength:    ScoreSchema.nullable(),
    type: z.enum([
      "follow",
      "comment",
      "link_in_bio",
      "watch_next",
      "engage_question",
      "other",
    ]).nullable(),
    rationale: z.string().min(1).max(400),
  })
  .refine(
    (v) => (v.cta_present
      ? v.strength !== null && v.type !== null
      : v.strength === null && v.type === null),
    { message: "When cta_present=true, strength and type must be non-null; when false, both must be null." },
  );

// Matches GeminiAudioSignalsSchema in types.ts exactly (nullable per D-A2 when content_type ∈ slideshow/b_roll).
const GeminiAudioSignalsSchema = z.object({
  voice_clarity_0_10:       ScoreSchema.nullable(),
  audio_hook_first_2s_0_10: ScoreSchema.nullable(),
  silence_ratio:            z.number().min(0).max(1),
  voiceover_ratio:          z.number().min(0).max(1),
  music_ratio:              z.number().min(0).max(1),
  audio_description:        z.string().min(10).max(280),
});

// Wave 0 fields merged into the unified Omni response
const Wave0FieldsSchema = z.object({
  content_type:       z.string().min(1),
  niche_primary_slug: z.string().min(1),
  niche_micro_slug:   z.string().nullable().optional(),
});

/**
 * OmniAnalysisZodSchema — full output of a single qwen3.5-omni-plus call.
 * Maps to GeminiVideoAnalysis + Wave0ContentTypeExtendedResult so aggregator is unchanged.
 */
export const OmniAnalysisZodSchema = z.object({
  // Wave 0
  ...Wave0FieldsSchema.shape,

  // Overall (from Gemini legacy shape)
  factors:            z.array(HookFactorSchema).length(5),
  overall_impression: z.string().min(1).max(500),
  content_summary:    z.string().min(1).max(500),

  // Hook segment
  hook_decomposition: HookDecompositionZodSchema,
  hook_visual_impact: ScoreSchema,

  // Body segment (video_signals)
  video_signals: z.object({
    visual_production_quality: ScoreSchema,
    pacing_score:              ScoreSchema,
    transition_quality:        ScoreSchema,
  }),

  // CTA segment
  cta_segment: CtaSegmentZodSchema,

  // Audio signals (matches GeminiAudioSignalsSchema in types.ts — nullable fields preserved)
  audio_signals: GeminiAudioSignalsSchema,

  // Audio perceptual score (0-100) — derived from Omni's audio analysis.
  // Separate from audio_signals so it maps cleanly to PipelineResult.audio_perceptual_score.
  audio_perceptual_score: z.number().min(0).max(100),

  /** Phase 1 (R1.7) — Optional emotion arc timeline. Backward compat: existing
   *  Omni responses without this field continue to validate (Assumption A3). */
  emotion_arc: z.array(EmotionArcPointSchema).optional(),

  /** Phase 3 (D-07) — Optional segment grid from Wave 0 omni. Backward compat:
   *  existing responses without this field continue to validate. Server-side normalizer
   *  sets is_hook_zone and idx after validation. */
  segments: z.array(z.object({
    t_start: z.number().min(0),
    t_end:   z.number().min(0),
    visual_event: z.string().max(200),
    audio_event:  z.string().max(200),
    scene_boundary_reason: z.string().max(300).optional(),
  })).optional(),
});

export type OmniAnalysisResult = z.infer<typeof OmniAnalysisZodSchema>;
export type HookDecomposition  = z.infer<typeof HookDecompositionZodSchema>;
export type CtaSegmentResult   = z.infer<typeof CtaSegmentZodSchema>;
