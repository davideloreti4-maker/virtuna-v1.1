/**
 * Phase 5 — Gemini segmented analysis schemas.
 *
 * Two-layer discipline (AI-SPEC §4b lines 640-643):
 *   1. responseSchema (OpenAPI-3 subset) — sent to Gemini so the *decoder* is constrained.
 *   2. Zod schema — applied client-side to `response.text`. Catches what the decoder slips through.
 *
 * Hand-written TWICE (Zod + Gemini literal) by intent — the two schemas serve different layers
 * and `zod-to-json-schema` emits Gemini-incompatible keywords (`$schema`, `additionalProperties`,
 * `$ref`). See 05-RESEARCH.md Pitfall #7.
 *
 * Polarity warning: `cognitive_load` uses the SAME 0-10 range but INVERTED semantics —
 * higher score = MORE cognitive load = WORSE retention. Every downstream consumer needs
 * a comment-level annotation.
 */

import { z } from "zod";
import { Type } from "@google/genai";

// Reusable score schema (0-10 with one decimal precision — matches existing FactorSchema convention at types.ts:238).
// POLARITY WARNING for downstream consumers: cognitive_load uses this SAME range but inverted semantics (higher = WORSE).
const ScoreSchema = z.number().min(0).max(10);

// ====================
// Hook segment
// ====================

/**
 * HookDecomposition — 7-field hook diagnostic shape.
 *
 * POLARITY CONTRACT — DOWNSTREAM CONSUMERS READ CAREFULLY:
 *   • visual_stop_power, audio_hook_quality, text_overlay_score,
 *     first_words_speech_score, visual_audio_coherence:
 *       — Standard polarity: higher score = BETTER (matches every other 0-10
 *         signal in this engine).
 *   • cognitive_load:
 *       — INVERTED polarity: higher score = MORE cognitive load = WORSE
 *         retention. NEVER average cognitive_load with the other hook fields
 *         without first inverting it (e.g. `10 - cognitive_load`), or the
 *         resulting composite is mathematically meaningless and Phase 10 ML
 *         retrain / Phase 7 persona simulation will silently learn against
 *         the wrong gradient.
 *
 * Aggregator paths that flow this type forward (Phase 5 Plan 03 → FeatureVector
 * → ML) must keep cognitive_load isolated. The pin test in
 * __tests__/gemini-types-widening.test.ts asserts no aggregator code path
 * averages cognitive_load with other hook fields.
 */
export const HookDecompositionZodSchema = z.object({
  visual_stop_power: ScoreSchema,          // HOOK-01
  audio_hook_quality: ScoreSchema,         // HOOK-02 (D-04: derived from Gemini Pro multi-modal hook analysis)
  text_overlay_score: ScoreSchema,         // HOOK-03
  first_words_speech_score: ScoreSchema,   // HOOK-04
  weakest_modality: z.enum([                // HOOK-05
    "visual_stop_power",
    "audio_hook_quality",
    "text_overlay_score",
    "first_words_speech_score",
  ]),
  visual_audio_coherence: ScoreSchema,     // HOOK-06
  cognitive_load: ScoreSchema,             // HOOK-07 — POLARITY INVERTED: higher score = MORE load = WORSE retention. See JSDoc above.
  watermark_detected: z.object({           // ALGO-06 — optional, back-compat with pre-Phase-9 cache
    tiktok: z.boolean().optional(),
    ig: z.boolean().optional(),
    yt: z.boolean().optional(),
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
  score: ScoreSchema,
  rationale: z.string().min(1).max(300),
  improvement_tip: z.string().max(300).optional(),
});

export const HookSegmentZodSchema = z.object({
  factors: z.array(HookFactorSchema).length(5),
  overall_impression: z.string().min(1).max(300),
  content_summary: z.string().min(1).max(300),
  hook_decomposition: HookDecompositionZodSchema,
});

// ====================
// Body segment — 3 video_signals (hook_visual_impact is HOOK's passthrough, NOT in body schema per merge contract).
// ====================

export const BodySegmentZodSchema = z.object({
  video_signals: z.object({
    visual_production_quality: ScoreSchema,
    pacing_score: ScoreSchema,
    transition_quality: ScoreSchema,
  }),
  body_summary: z.string().min(1).max(800),
});

// ====================
// CTA segment — presence-aware shape per D-05, cross-field .refine invariant per Pitfall #7.
// ====================

export const CtaSegmentZodSchema = z
  .object({
    cta_present: z.boolean(),
    strength: ScoreSchema.nullable(),
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

// Inferred TS types for downstream consumers (merge, aggregator widening).
export type HookSegmentResult = z.infer<typeof HookSegmentZodSchema>;
export type BodySegmentResult = z.infer<typeof BodySegmentZodSchema>;
export type CtaSegmentResult  = z.infer<typeof CtaSegmentZodSchema>;

/**
 * HookDecomposition (inferred from HookDecompositionZodSchema).
 *
 * IN-01 POLARITY REMINDER:
 *   The `cognitive_load` field uses INVERTED polarity (higher = WORSE retention).
 *   Every other score in this object uses the standard "higher = better" polarity.
 *   Downstream consumers (FeatureVector, ML retrain, persona simulation) MUST
 *   either (a) treat cognitive_load as a standalone signal or (b) invert it
 *   (e.g. `10 - cognitive_load`) before mixing into composite averages.
 *
 * See HookDecompositionZodSchema docstring for the full polarity contract.
 */
export type HookDecomposition = z.infer<typeof HookDecompositionZodSchema>;

// ====================
// Gemini responseSchema literals (hand-written, OpenAPI-3 subset — NOT via zod-to-json-schema per Pitfall #7).
// Discriminator + nullable expresses the presence-aware CTA shape (Gemini's dialect has no oneOf).
// ====================

export const HOOK_SEGMENT_GEMINI_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    factors: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            enum: [
              "Scroll-Stop Power",
              "Completion Pull",
              "Rewatch Potential",
              "Share Trigger",
              "Emotional Charge",
            ],
          },
          score: { type: Type.NUMBER },
          rationale: { type: Type.STRING },
        },
        required: ["name", "score", "rationale"],
      },
    },
    overall_impression: { type: Type.STRING },
    content_summary: { type: Type.STRING },
    hook_decomposition: {
      type: Type.OBJECT,
      properties: {
        visual_stop_power: { type: Type.NUMBER },
        audio_hook_quality: { type: Type.NUMBER },
        text_overlay_score: { type: Type.NUMBER },
        first_words_speech_score: { type: Type.NUMBER },
        weakest_modality: {
          type: Type.STRING,
          enum: [
            "visual_stop_power",
            "audio_hook_quality",
            "text_overlay_score",
            "first_words_speech_score",
          ],
        },
        visual_audio_coherence: { type: Type.NUMBER },
        cognitive_load: { type: Type.NUMBER },
        watermark_detected: {
          type: Type.OBJECT,
          properties: {
            tiktok: { type: Type.BOOLEAN },
            ig: { type: Type.BOOLEAN },
            yt: { type: Type.BOOLEAN },
          },
        },
      },
      required: [
        "visual_stop_power",
        "audio_hook_quality",
        "text_overlay_score",
        "first_words_speech_score",
        "weakest_modality",
        "visual_audio_coherence",
        "cognitive_load",
      ],
    },
  },
  required: ["factors", "overall_impression", "content_summary", "hook_decomposition"],
};

export const BODY_SEGMENT_GEMINI_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    video_signals: {
      type: Type.OBJECT,
      properties: {
        visual_production_quality: { type: Type.NUMBER },
        pacing_score: { type: Type.NUMBER },
        transition_quality: { type: Type.NUMBER },
      },
      required: ["visual_production_quality", "pacing_score", "transition_quality"],
    },
    body_summary: { type: Type.STRING },
  },
  required: ["video_signals", "body_summary"],
};

export const CTA_SEGMENT_GEMINI_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    cta_present: { type: Type.BOOLEAN },
    strength: { type: Type.NUMBER, nullable: true },
    type: {
      type: Type.STRING,
      nullable: true,
      enum: ["follow", "comment", "link_in_bio", "watch_next", "engage_question", "other"],
    },
    rationale: { type: Type.STRING },
  },
  required: ["cta_present", "strength", "type", "rationale"],
  // Bias model toward emitting cta_present first (boosts null-when-absent rate per RESEARCH line 878).
  propertyOrdering: ["cta_present", "strength", "type", "rationale"],
};
