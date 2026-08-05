/**
 * Zod contracts for the MODALITY SPLIT (omni stops watching).
 *
 * Today one omni call both watches and hears. The split runs two:
 *   - the VIDEO leg on QWEN_REASONING_MODEL (flash) — sighted, deaf. It OWNS the time grid,
 *     because it is the leg that can see scene cuts.
 *   - the AUDIO leg on QWEN_OMNI_MODEL (omni) — hears an mp3 with no video attached.
 * `merge.ts` folds the two into the shape `OmniAnalysisZodSchema` already accepts, so every
 * downstream consumer (aggregator, fold, Apollo, decode, filmstrip) is untouched by design.
 *
 * Field ownership is NOT a style choice — it follows what each model can actually perceive.
 * A deaf model must never be asked for an audio score and vice versa; that is the exact
 * failure mode (a confident number from a model with no access to the signal) this whole
 * split could otherwise introduce.
 *
 * The ONE field neither leg can produce is `visual_audio_coherence`, which by definition
 * needs both. It gets its own text-only call — see CoherenceZodSchema below.
 */

import { z } from "zod";

const ScoreSchema = z.number().min(0).max(10);

/** Mirrors CONTENT_TYPE_VALUES in omni-analysis.ts (kept as a plain string + coerce there). */
const CONTENT_TYPE_ENUM = [
  "talking_head", "b_roll", "slideshow", "action",
  "tutorial", "vlog", "comedy", "other",
] as const;

const CTA_TYPE_ENUM = [
  "follow", "comment", "link_in_bio", "watch_next", "engage_question", "other",
] as const;

/**
 * A CTA observation from ONE modality. Deliberately looser than CtaSegmentZodSchema: a single
 * leg is allowed to report `cta_present: true` with a null strength/type, because half a CTA
 * ("link in bio" on screen, no spoken ask) is a real observation. `mergeCtaObservations` is
 * what resolves the pair into the strict paired shape the engine schema demands — and it
 * NEVER invents a strength to satisfy the pairing.
 */
export const CtaObservationSchema = z.object({
  cta_present: z.boolean(),
  strength:    ScoreSchema.nullable().optional(),
  type:        z.enum(CTA_TYPE_ENUM).nullable().optional().catch(null),
  rationale:   z.string().max(400).nullable().optional(),
});
export type CtaObservation = z.infer<typeof CtaObservationSchema>;

/** Emotion-arc point — identical to EmotionArcPointSchema, restated so a leg can be parsed
 *  standalone. Label drift is tolerated the same way (the parent schema re-validates). */
const ArcPointSchema = z.object({
  timestamp_ms:  z.number().min(0),
  intensity_0_1: z.number().min(0).max(1),
  label:         z.string().optional(),
});

// ============================================================================
// VIDEO leg — flash. Sighted and DEAF. Owns the grid.
// ============================================================================

/** One cell of the authoritative time grid. `audio_event` is absent BY DESIGN: a deaf model
 *  reporting one would be describing sound it cannot hear. merge.ts fills it from the audio
 *  leg by timestamp overlap. */
export const VideoSegmentSchema = z.object({
  t_start: z.number().min(0),
  t_end:   z.number().min(0),
  visual_event: z.string().max(200),
  scene_boundary_reason: z.string().max(300).optional(),
  on_screen_text: z.string().max(500).nullable().optional(),
});

export const VideoLegZodSchema = z.object({
  content_type:       z.enum(CONTENT_TYPE_ENUM).catch("other"),
  niche_primary_slug: z.string().min(1),
  niche_micro_slug:   z.string().nullable().optional(),

  hook_visual_impact: ScoreSchema,

  // The three hook modalities a sighted model can measure. audio_hook_quality and
  // first_words_speech_score are NOT here — flash is deaf.
  visual_stop_power:  ScoreSchema,
  text_overlay_score: ScoreSchema,
  // POLARITY INVERTED: higher = MORE load = WORSE retention (same as the unified read).
  cognitive_load:     ScoreSchema,

  watermark_detected: z.object({
    tiktok: z.boolean().optional(),
    ig:     z.boolean().optional(),
    yt:     z.boolean().optional(),
  }).optional(),

  video_signals: z.object({
    visual_production_quality: ScoreSchema,
    pacing_score:              ScoreSchema,
    transition_quality:        ScoreSchema,
  }),

  visual_cta: CtaObservationSchema,

  /** Verbatim overlay text in the first ~3s. The spoken half comes from the audio leg. */
  hook_on_screen_text: z.string().max(280).nullable().optional(),

  /** FALLBACK ONLY. The audio leg owns the arc (affect is carried mostly by voice/music);
   *  this is what keeps a silent b-roll or slideshow from losing its curve entirely. */
  emotion_arc: z.array(ArcPointSchema).optional(),

  segments: z.array(VideoSegmentSchema).optional(),
});
export type VideoLegResult = z.infer<typeof VideoLegZodSchema>;

// ============================================================================
// AUDIO leg — omni. Hears an mp3, sees NOTHING.
// ============================================================================

/** An audio event on omni's OWN timeline. These do not have to line up with the video grid —
 *  merge.ts aligns them onto it by overlap, which is the whole reason flash owns the grid. */
export const AudioEventSchema = z.object({
  t_start: z.number().min(0),
  t_end:   z.number().min(0),
  audio_event: z.string().max(200),
  spoken_text: z.string().max(500).nullable().optional(),
});

export const AudioLegZodSchema = z.object({
  // F46 parity: null on genuinely silent / music-only audio, never a fabricated 0.
  audio_hook_quality:       ScoreSchema.nullable(),
  first_words_speech_score: ScoreSchema.nullable(),

  // The three ratios are nullable for the adapter's sake, not the model's — `qwen/audio-mix.ts`
  // blanks a mix that contradicts itself after a bounded retry. The prompt still demands the sum.
  audio_signals: z.object({
    voice_clarity_0_10:       ScoreSchema.nullable(),
    audio_hook_first_2s_0_10: ScoreSchema.nullable(),
    silence_ratio:            z.number().min(0).max(1).nullable(),
    voiceover_ratio:          z.number().min(0).max(1).nullable(),
    music_ratio:              z.number().min(0).max(1).nullable(),
    audio_description:        z.string().min(1).max(280),
  }),

  audio_perceptual_score: z.number().min(0).max(100),

  /** Verbatim speech in the first ~3s. null = genuinely no speech (D-02). */
  hook_spoken_words: z.string().max(280).nullable().optional(),

  /** PRIMARY emotion arc — voice/music affect is what the curve is mostly made of. */
  emotion_arc: z.array(ArcPointSchema).optional(),

  /** A CTA that is SPOKEN. The on-screen half comes from the video leg. */
  spoken_cta: CtaObservationSchema,

  audio_events: z.array(AudioEventSchema).optional(),
});
export type AudioLegResult = z.infer<typeof AudioLegZodSchema>;

// ============================================================================
// Coherence — the one field that needs both modalities
// ============================================================================

/**
 * Graded by a THIRD, text-only call that receives both legs' descriptions. It is a genuine
 * cross-modal judgment, so it is asked for rather than computed: deriving it from timestamp
 * overlap would be an adapter inventing a score the models never gave.
 */
export const CoherenceZodSchema = z.object({
  visual_audio_coherence: ScoreSchema,
  rationale: z.string().max(300).optional(),
});
export type CoherenceResult = z.infer<typeof CoherenceZodSchema>;
