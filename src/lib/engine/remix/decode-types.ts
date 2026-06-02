/**
 * Phase 03 Plan 01 — Decode Engine Types + Zod Schemas.
 *
 * DecodeResult is the payload shape for variants.remix.decode (D-10).
 * overall_score stays null on decode rows — completion is signaled by
 * variants.remix != null, NOT by overall_score.
 *
 * Invariants:
 *   D-06: beats MUST be exactly 4, in fixed order: hook_pattern → structure_pacing → the_turn → emotional_beat
 *   D-02: absent beats carry an honest body line, never fabricated content
 *   D-04: luck array is always length >= 1 (backstop in runDecode)
 *   D-05: luck categories restricted to fixed taxonomy via Zod enum
 *   D-07: body lines are third-person, no advice verbs
 */
import { z } from "zod";

// =====================================================
// Beat IDs — fixed order, must match the model's required output
// =====================================================

export type BeatId = "hook_pattern" | "structure_pacing" | "the_turn" | "emotional_beat";

export const BEAT_IDS: BeatId[] = [
  "hook_pattern",
  "structure_pacing",
  "the_turn",
  "emotional_beat",
];

// =====================================================
// Luck category taxonomy — D-05: restricted to this fixed enum
// =====================================================

export type LuckCategory =
  | "timing_trend_moment"
  | "existing_audience_reach"
  | "algorithmic_outlier"
  | "topic_zeitgeist";

// =====================================================
// TypeScript interfaces
// =====================================================

export interface DecodeBeat {
  id: BeatId;
  /** 1-2 honest declarative lines, third-person, no advice verbs (D-06/D-07) */
  body: string;
  verdict: "present" | "weak" | "absent";
}

export interface DecodeResult {
  /** EXACTLY 4 beats in fixed order (D-06) */
  beats: DecodeBeat[];
  /** Structural moves the creator can repeat */
  repeatable: string[];
  /** length >= 1 ALWAYS — pure-TS backstop in runDecode ensures this (D-04) */
  luck: { category: LuckCategory; note: string }[];
}

/** Subset of OmniAnalysisOutput fields consumed by the decode engine */
export interface OmniStructuralInput {
  hook_decomposition: {
    visual_stop_power: number;
    audio_hook_quality: number;
    text_overlay_score: number;
    first_words_speech_score: number;
    weakest_modality: string;
    visual_audio_coherence: number;
    cognitive_load: number;
  };
  factors: Array<{
    name: string;
    score: number;
    rationale: string;
    improvement_tip?: string;
  }>;
  segments?: Array<{
    t_start: number;
    t_end: number;
    visual_event: string;
    audio_event: string;
    scene_boundary_reason?: string;
    is_hook_zone?: boolean;
  }>;
  video_signals: {
    visual_production_quality: number;
    pacing_score: number;
    transition_quality: number;
  };
  emotion_arc?: Array<{
    timestamp_ms: number;
    intensity_0_1: number;
    label?: "low" | "mid" | "high";
  }>;
  content_summary: string;
  overall_impression: string;
  content_type: string;
  niche_primary_slug: string;
}

// =====================================================
// Zod schemas — enforce D-06 (beats.length 4) + D-04 (luck.min 1) + D-05 (enum)
// =====================================================

export const DecodeBeatSchema = z.object({
  id: z.enum(["hook_pattern", "structure_pacing", "the_turn", "emotional_beat"]),
  body: z.string().min(1),
  verdict: z.enum(["present", "weak", "absent"]),
});

export const LuckCategoryEnum = z.enum([
  "timing_trend_moment",
  "existing_audience_reach",
  "algorithmic_outlier",
  "topic_zeitgeist",
]);

export const DecodeResultZodSchema = z.object({
  beats: z.array(DecodeBeatSchema).length(4),
  repeatable: z.array(z.string()).min(1),
  luck: z.array(
    z.object({
      category: LuckCategoryEnum,
      note: z.string().min(1),
    }),
  ).min(1),
});

export type DecodeResultZod = z.infer<typeof DecodeResultZodSchema>;
