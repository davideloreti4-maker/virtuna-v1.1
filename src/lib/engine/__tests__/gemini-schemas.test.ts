/**
 * Phase 5 Plan 01 Task 1 — schemas / cost / prompt foundations.
 *
 * Verifies the three foundational modules under `src/lib/engine/gemini/`:
 *   • schemas.ts — Zod schemas + Gemini OpenAPI-3-subset responseSchema literals
 *   • cost.ts    — per-model `calculateCost(model, usageMetadata)` helper
 *   • prompts.ts — buildHookPrompt / buildBodyPrompt / buildCtaPrompt
 *
 * No live Gemini calls — pure schema + builder validation.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// =====================================================
// Imports — SUT
// =====================================================

import {
  HookSegmentZodSchema,
  BodySegmentZodSchema,
  CtaSegmentZodSchema,
  HookDecompositionZodSchema,
  HOOK_SEGMENT_GEMINI_SCHEMA,
  BODY_SEGMENT_GEMINI_SCHEMA,
  CTA_SEGMENT_GEMINI_SCHEMA,
  type HookSegmentResult,
  type BodySegmentResult,
  type CtaSegmentResult,
  type HookDecomposition,
} from "../gemini/schemas";
import { calculateCost } from "../gemini/cost";
import { buildHookPrompt, buildBodyPrompt, buildCtaPrompt } from "../gemini/prompts";

// =====================================================
// Calibration stub (CalibrationData-shaped literal)
// =====================================================

const STUB_CAL = {
  primary_kpis: {
    share_rate: { viral_threshold: 0.1 },
    weighted_engagement_score: { percentiles: { p90: 85 } },
  },
  duration_analysis: {
    sweet_spot_by_weighted_score: { optimal_range_seconds: [15, 45] },
  },
  viral_vs_average: {
    differentiators: [
      { factor: "hook_strength", difference_pct: 40, description: "Strong hooks boost engagement" },
      { factor: "pacing", difference_pct: -15, description: "Tighter pacing wins" },
      { factor: "audio_match", difference_pct: 25, description: "Trending sound match correlates" },
    ],
  },
};

// =====================================================
// Hook fixtures
// =====================================================

const VALID_HOOK_FIXTURE: HookSegmentResult = {
  factors: [
    { name: "Scroll-Stop Power", score: 7.5, rationale: "Strong opening", improvement_tip: "Add more visual contrast" },
    { name: "Completion Pull", score: 7.0, rationale: "Promise is clear", improvement_tip: "Tighten the question" },
    { name: "Rewatch Potential", score: 6.5, rationale: "Layered detail", improvement_tip: "Hide a second beat" },
    { name: "Share Trigger", score: 6.0, rationale: "Relatable", improvement_tip: "Add a tag-someone moment" },
    { name: "Emotional Charge", score: 7.0, rationale: "Excitement", improvement_tip: "Push the music drop earlier" },
  ],
  overall_impression: "Strong hook with clear promise.",
  content_summary: "Beauty creator opens with a bold visual claim.",
  hook_decomposition: {
    visual_stop_power: 8.0,
    audio_hook_quality: 6.5,
    text_overlay_score: 7.0,
    first_words_speech_score: 7.5,
    weakest_modality: "audio_hook_quality",
    visual_audio_coherence: 7.0,
    cognitive_load: 4.5,
  },
};

// =====================================================
// Tests — Zod schemas
// =====================================================

describe("HookSegmentZodSchema", () => {
  it("Test 1: parses a valid hook fixture with all 6 hook_decomposition fields and 5 factor names", () => {
    const result = HookSegmentZodSchema.safeParse(VALID_HOOK_FIXTURE);
    expect(result.success).toBe(true);
    if (result.success) {
      // All 7 hook_decomposition keys present
      expect(result.data.hook_decomposition.visual_stop_power).toBe(8.0);
      expect(result.data.hook_decomposition.audio_hook_quality).toBe(6.5);
      expect(result.data.hook_decomposition.text_overlay_score).toBe(7.0);
      expect(result.data.hook_decomposition.first_words_speech_score).toBe(7.5);
      expect(result.data.hook_decomposition.weakest_modality).toBe("audio_hook_quality");
      expect(result.data.hook_decomposition.visual_audio_coherence).toBe(7.0);
      expect(result.data.hook_decomposition.cognitive_load).toBe(4.5);
      // Factor names match the 5-name enum
      const names = result.data.factors.map((f) => f.name).sort();
      expect(names).toEqual([
        "Completion Pull",
        "Emotional Charge",
        "Rewatch Potential",
        "Scroll-Stop Power",
        "Share Trigger",
      ]);
    }
  });

  it("Test 2: rejects out-of-range score, missing factor, and invalid weakest_modality enum", () => {
    // Out-of-range score
    const oor = {
      ...VALID_HOOK_FIXTURE,
      factors: [
        { ...VALID_HOOK_FIXTURE.factors[0]!, score: 11 },
        ...VALID_HOOK_FIXTURE.factors.slice(1),
      ],
    };
    expect(HookSegmentZodSchema.safeParse(oor).success).toBe(false);

    // Missing factor (only 4 factors)
    const missing = {
      ...VALID_HOOK_FIXTURE,
      factors: VALID_HOOK_FIXTURE.factors.slice(0, 4),
    };
    expect(HookSegmentZodSchema.safeParse(missing).success).toBe(false);

    // Invalid weakest_modality
    const badModality = {
      ...VALID_HOOK_FIXTURE,
      hook_decomposition: {
        ...VALID_HOOK_FIXTURE.hook_decomposition,
        weakest_modality: "color_palette" as unknown as HookDecomposition["weakest_modality"],
      },
    };
    expect(HookSegmentZodSchema.safeParse(badModality).success).toBe(false);
  });
});

describe("CtaSegmentZodSchema", () => {
  it("Test 3: rejects cta_present=true with null strength/type (cross-field .refine invariant)", () => {
    const invalid = {
      cta_present: true,
      strength: null,
      type: null,
      rationale: "creator says follow but model emitted nulls",
    };
    expect(CtaSegmentZodSchema.safeParse(invalid).success).toBe(false);
  });

  it("Test 4: rejects cta_present=false with non-null strength/type (cross-field .refine invariant)", () => {
    const invalid = {
      cta_present: false,
      strength: 5,
      type: "follow" as const,
      rationale: "no cta but model emitted scores",
    };
    expect(CtaSegmentZodSchema.safeParse(invalid).success).toBe(false);
  });

  it("Test 5: accepts cta_present=true with non-null strength + type", () => {
    const valid: CtaSegmentResult = {
      cta_present: true,
      strength: 7,
      type: "follow",
      rationale: "Creator clearly says 'follow for more' in the last 2 seconds.",
    };
    const result = CtaSegmentZodSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("accepts cta_present=false with null strength and type", () => {
    const valid: CtaSegmentResult = {
      cta_present: false,
      strength: null,
      type: null,
      rationale: "No call-to-action detected — typical for comedy content.",
    };
    expect(CtaSegmentZodSchema.safeParse(valid).success).toBe(true);
  });
});

describe("BodySegmentZodSchema", () => {
  it("Test 6: accepts body fixture with exactly 3 video_signals fields (no hook_visual_impact)", () => {
    const valid: BodySegmentResult = {
      video_signals: {
        visual_production_quality: 7,
        pacing_score: 6,
        transition_quality: 5,
      },
      body_summary: "Talking-head segment with steady cuts and reasonable lighting.",
    };
    const result = BodySegmentZodSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      // Verify hook_visual_impact is NOT in the body schema (passthrough from hook).
      expect((result.data.video_signals as Record<string, number>).hook_visual_impact).toBeUndefined();
    }
  });
});

// =====================================================
// Tests — Per-model cost helper
// =====================================================

describe("calculateCost (per-model)", () => {
  it("Test 7a: returns ~1.218¢ for gemini-3.1-pro-preview on 1290 prompt + 800 candidate tokens", () => {
    // (1290 × 2/1M + 800 × 12/1M) × 100 = (0.00258 + 0.0096) × 100 = 1.218¢
    const cost = calculateCost("gemini-3.1-pro-preview", {
      promptTokenCount: 1290,
      candidatesTokenCount: 800,
    });
    expect(cost).toBeCloseTo(1.218, 2);
  });

  it("Test 7b: legacy gemini-2.5-flash on 2000/800 returns pre-Plan-01 value (~0.078¢)", () => {
    // (2000 × 0.15/1M + 800 × 0.60/1M) × 100 = (0.0003 + 0.00048) × 100 = 0.078¢
    const cost = calculateCost("gemini-2.5-flash", {
      promptTokenCount: 2000,
      candidatesTokenCount: 800,
    });
    expect(cost).toBeCloseTo(0.078, 6);
  });

  it("Test 8: unknown model falls back to gemini-3-flash-preview pricing (does NOT throw)", () => {
    // Flash preview: $0.50/M in, $3/M out — (2000 × 0.50/1M + 800 × 3/1M) × 100 = (0.001 + 0.0024) × 100 = 0.34¢
    expect(() => calculateCost("unknown-model-xyz", { promptTokenCount: 2000, candidatesTokenCount: 800 })).not.toThrow();
    const fallback = calculateCost("unknown-model-xyz", { promptTokenCount: 2000, candidatesTokenCount: 800 });
    const flashPreview = calculateCost("gemini-3-flash-preview", { promptTokenCount: 2000, candidatesTokenCount: 800 });
    expect(fallback).toBeCloseTo(flashPreview, 6);
  });
});

// =====================================================
// Tests — Prompt builders
// =====================================================

describe("buildHookPrompt", () => {
  it("Test 9: returns string with hook-window directive, niche, cognitive_load polarity warning, and absent-modality guard", () => {
    const out = buildHookPrompt({
      calibration: STUB_CAL,
      niche: "beauty",
      contentType: "tutorial",
    });
    expect(out).toContain("Analyze ONLY the 0-5s hook of this video");
    expect(out).toContain("beauty");
    expect(out).toContain("HIGHER = WORSE");
    expect(out).toContain("do NOT name it as weakest_modality");
  });
});

describe("buildBodyPrompt and buildCtaPrompt", () => {
  it("Test 10: each returns non-empty string containing niche + contentType from opts", () => {
    const body = buildBodyPrompt({
      calibration: STUB_CAL,
      niche: "fitness",
      contentType: "talking_head",
    });
    expect(body.length).toBeGreaterThan(0);
    expect(body).toContain("fitness");
    expect(body).toContain("talking_head");

    const cta = buildCtaPrompt({
      calibration: STUB_CAL,
      niche: "comedy",
      contentType: "vlog",
    });
    expect(cta.length).toBeGreaterThan(0);
    expect(cta).toContain("comedy");
    expect(cta).toContain("vlog");
  });
});

// =====================================================
// Tests — Gemini responseSchema literals exist and have expected shape
// =====================================================

describe("Gemini responseSchema literals", () => {
  it("HOOK_SEGMENT_GEMINI_SCHEMA exposes the expected required keys", () => {
    expect(HOOK_SEGMENT_GEMINI_SCHEMA.required).toEqual(
      expect.arrayContaining(["factors", "overall_impression", "content_summary", "hook_decomposition"]),
    );
  });

  it("BODY_SEGMENT_GEMINI_SCHEMA exposes the expected required keys", () => {
    expect(BODY_SEGMENT_GEMINI_SCHEMA.required).toEqual(
      expect.arrayContaining(["video_signals", "body_summary"]),
    );
  });

  it("CTA_SEGMENT_GEMINI_SCHEMA exposes propertyOrdering with cta_present first", () => {
    expect((CTA_SEGMENT_GEMINI_SCHEMA as { propertyOrdering: string[] }).propertyOrdering[0]).toBe("cta_present");
  });
});

// =====================================================
// Type-only smoke: ensure HookDecomposition + segment result types are importable
// =====================================================

describe("inferred types", () => {
  it("HookDecomposition + segment result types are exported as TS types", () => {
    // Type-only smoke — the import at the top of this file is the assertion.
    // If the types are removed, this test file fails to compile.
    const _hd: HookDecomposition = VALID_HOOK_FIXTURE.hook_decomposition;
    expect(_hd).toBeDefined();
  });
});
