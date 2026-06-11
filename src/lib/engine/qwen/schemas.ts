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

// weakest_modality drift guard: qwen3.5-omni-flash intermittently returns a value
// OUTSIDE the 4-key enum (a synonym, a sentence, or an invented label). Because the
// parent OmniAnalysisZodSchema validates in one shot, a single drifted value used to
// fail the WHOLE ~17s Omni response → full retry (observed live, 05-HUMAN-UAT). But
// weakest_modality is a DERIVED field — the lowest-scoring of the 4 hook modalities —
// so the model never needed to name it. Accept a valid value when present, otherwise
// (.catch → undefined) compute it authoritatively from the 4 scores in a transform.
// Never a reason to nuke the expensive call. This also fixes model self-inconsistency
// (a named modality that isn't actually its lowest score).
const MODALITY_KEYS = [
  "visual_stop_power",
  "audio_hook_quality",
  "text_overlay_score",
  "first_words_speech_score",
] as const;

export const HookDecompositionZodSchema = z.object({
  visual_stop_power:        ScoreSchema,
  // F46: audio_hook_quality + first_words_speech_score are SPEECH/AUDIO-derived — on a
  // NO-SPEECH / no-audio video (b-roll, music-only, ASMR) the model legitimately returns
  // null (observed: Ashton Hall 79s clip). A required-NUMBER field rejected the WHOLE read
  // → silent total failure. Make them nullable (mirrors GeminiAudioSignalsSchema's D-A2
  // audio nulling). The weakest_modality derive below skips nulls so an absent modality is
  // not miscounted as "weakest".
  audio_hook_quality:       ScoreSchema.nullable(),
  text_overlay_score:       ScoreSchema,
  first_words_speech_score: ScoreSchema.nullable(),
  weakest_modality: z.enum(MODALITY_KEYS).optional().catch(undefined),
  visual_audio_coherence: ScoreSchema,
  // POLARITY INVERTED: higher score = MORE cognitive load = WORSE retention.
  cognitive_load: ScoreSchema,
  watermark_detected: z.object({
    tiktok: z.boolean().optional(),
    ig:     z.boolean().optional(),
    yt:     z.boolean().optional(),
  }).optional(),
}).transform((h) => {
  // Derive the weakest modality from the scores when the model omitted or drifted it.
  // F46: reduce only over the NON-null scores — a null modality (no speech/audio) is
  // absent, not "weakest". If the model already named a valid modality, keep it.
  if (h.weakest_modality) return { ...h, weakest_modality: h.weakest_modality };
  // scored is always non-empty: visual_stop_power + text_overlay_score are never
  // nullable, so a weakest_modality is always derivable (stays a required field).
  const scored = MODALITY_KEYS.filter((k) => typeof h[k] === "number");
  const weakest_modality = scored.reduce((min, k) => ((h[k] as number) < (h[min] as number) ? k : min));
  return { ...h, weakest_modality };
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
// emotion_arc.label drift guard: qwen3.5-omni-flash intermittently returns a
// synonym ("medium", "rising", "calm", capitalised "Low") instead of the strict
// low|mid|high enum. Because the parent OmniAnalysisZodSchema validates in one shot,
// a single drifted label used to fail the WHOLE ~17s Omni response → full retry
// (observed ~50% on a sample video, 05-HUMAN-UAT #1). label is an OPTIONAL,
// non-critical UI/fold-input field — dropping a bad value is the correct
// degradation, never a reason to nuke the expensive call. Normalize known
// synonyms, then .catch(undefined) so any remaining unknown degrades to absent.
const EMOTION_LABEL_SYNONYMS: Record<string, "low" | "mid" | "high"> = {
  low: "low", weak: "low", calm: "low", flat: "low", quiet: "low", minimal: "low",
  mid: "mid", medium: "mid", med: "mid", moderate: "mid", neutral: "mid", rising: "mid",
  high: "high", peak: "high", intense: "high", strong: "high", elevated: "high",
};
const EmotionLabelSchema = z.preprocess(
  (v) => (typeof v === "string" ? (EMOTION_LABEL_SYNONYMS[v.trim().toLowerCase()] ?? v) : v),
  z.enum(["low", "mid", "high"]).optional().catch(undefined),
);

export const EmotionArcPointSchema = z.object({
  timestamp_ms:  z.number().min(0),
  intensity_0_1: z.number().min(0).max(1),
  label:         EmotionLabelSchema,
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
  /** Phase 2 (R1) — Verbatim speech for this segment. null = silence/no speech (D-02).
   *  [inaudible] = present-but-unclear speech (D-04.2). Max 500 chars (D-04.4).
   *  Declared on the EXPORTED SegmentSchema (not just the inline validator) so
   *  SegmentGrid carries these fields through normalizeSegments into the aggregator.
   *  A field absent from SegmentSchema is stripped before persistence (the segment-axis
   *  emotion_arc drop). Both shapes must declare it: inline for parse-time acceptance,
   *  SegmentSchema for transport. */
  spoken_text:    z.string().max(500).nullable().optional(),
  on_screen_text: z.string().max(500).nullable().optional(),
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
  // F16: was min(10) — a terse but legit audio ("music", "silence") failed the WHOLE
  // parse on the length edge. min(1) keeps non-empty while accepting short descriptions.
  audio_description:        z.string().min(1).max(280),
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

  /** Phase 2 (R1) — Optional verbatim hook transcription. null per field = no speech/text (D-02).
   *  [inaudible] in spoken_words = present-but-unclear (D-04.2). Max 280 chars (D-04.4).
   *  .optional() mirrors emotion_arc backward-compat (A3): existing responses without this
   *  field continue to validate. */
  hook_verbatim: z.object({
    spoken_words:   z.string().max(280).nullable().optional(),
    on_screen_text: z.string().max(280).nullable().optional(),
  }).optional(),

  /** Phase 3 (D-07) — Optional segment grid from Wave 0 omni. Backward compat:
   *  existing responses without this field continue to validate. Server-side normalizer
   *  sets is_hook_zone and idx after validation.
   *  PITFALL 4: This INLINE z.object is the shape Omni output is parsed against at
   *  parse-time (NOT the exported SegmentSchema). Per-segment verbatim MUST be declared
   *  HERE for parse-time acceptance, AND on the exported SegmentSchema for transport. */
  segments: z.array(z.object({
    t_start: z.number().min(0),
    t_end:   z.number().min(0),
    visual_event: z.string().max(200),
    audio_event:  z.string().max(200),
    scene_boundary_reason: z.string().max(300).optional(),
    /** Phase 2 (R1) — Per-segment verbatim speech. null = silence (D-02). [inaudible] = unclear (D-04.2). */
    spoken_text:    z.string().max(500).nullable().optional(),
    on_screen_text: z.string().max(500).nullable().optional(),
  })).optional(),
});

export type OmniAnalysisResult = z.infer<typeof OmniAnalysisZodSchema>;
export type HookDecomposition  = z.infer<typeof HookDecompositionZodSchema>;
export type CtaSegmentResult   = z.infer<typeof CtaSegmentZodSchema>;
