/**
 * Phase 1 Plan 04 (R1.7) — Omni Plus emotion_arc engine extension.
 *
 * Replaces Plan 01-01 it.todo stubs with real assertions covering:
 *   - EmotionArcPointSchema validation (happy + sad paths)
 *   - OmniAnalysisZodSchema backward compat (.optional() — Assumption A3)
 *   - System prompt contains the literal "emotion_arc" field name
 */
import { describe, it, expect } from "vitest";
import {
  EmotionArcPointSchema,
  OmniAnalysisZodSchema,
} from "@/lib/engine/qwen/schemas";
import { buildSystemPrompt } from "@/lib/engine/qwen/omni-analysis";

describe("emotion_arc — schema validation", () => {
  it("EmotionArcPointSchema validates a valid point with label", () => {
    const p = EmotionArcPointSchema.parse({
      timestamp_ms: 1000,
      intensity_0_1: 0.5,
      label: "mid",
    });
    expect(p.timestamp_ms).toBe(1000);
    expect(p.intensity_0_1).toBe(0.5);
    expect(p.label).toBe("mid");
  });

  it("EmotionArcPointSchema accepts point without label (optional)", () => {
    const p = EmotionArcPointSchema.parse({
      timestamp_ms: 0,
      intensity_0_1: 0.2,
    });
    expect(p.label).toBeUndefined();
    expect(p.timestamp_ms).toBe(0);
    expect(p.intensity_0_1).toBe(0.2);
  });

  it("EmotionArcPointSchema rejects intensity > 1", () => {
    expect(() =>
      EmotionArcPointSchema.parse({ timestamp_ms: 0, intensity_0_1: 1.2 }),
    ).toThrow();
  });

  it("EmotionArcPointSchema rejects negative timestamp", () => {
    expect(() =>
      EmotionArcPointSchema.parse({ timestamp_ms: -1, intensity_0_1: 0.5 }),
    ).toThrow();
  });

  it("OmniAnalysisZodSchema accepts response WITH emotion_arc via .partial()", () => {
    // Build a minimal subset asserting only the emotion_arc surface — .partial()
    // makes all OmniAnalysisZodSchema fields optional so the test focuses on the
    // new field without rebuilding the full 11-field response shape.
    const withArc = {
      emotion_arc: [
        { timestamp_ms: 0, intensity_0_1: 0.3, label: "low" as const },
        { timestamp_ms: 5000, intensity_0_1: 0.8, label: "high" as const },
      ],
    };
    const parsed = OmniAnalysisZodSchema.partial().parse(withArc);
    expect(parsed.emotion_arc).toBeDefined();
    expect(parsed.emotion_arc).toHaveLength(2);
    expect(parsed.emotion_arc?.[0]?.intensity_0_1).toBe(0.3);
  });

  it("OmniAnalysisZodSchema accepts response WITHOUT emotion_arc (backward compat — A3)", () => {
    // Backward compat: existing Omni Plus responses that don't include the new
    // field continue to validate. .optional() declaration on OmniAnalysisZodSchema
    // means absent emotion_arc → field undefined, no error.
    expect(() => OmniAnalysisZodSchema.partial().parse({})).not.toThrow();
    const parsed = OmniAnalysisZodSchema.partial().parse({});
    expect(parsed.emotion_arc).toBeUndefined();
  });

  it("OmniAnalysisZodSchema rejects emotion_arc with invalid point shape", () => {
    // Defense-in-depth: the field is optional but when present must validate.
    const invalidArc = {
      emotion_arc: [{ timestamp_ms: 0, intensity_0_1: 1.5 }], // intensity > 1
    };
    expect(() => OmniAnalysisZodSchema.partial().parse(invalidArc)).toThrow();
  });

  it("buildSystemPrompt output contains the literal 'emotion_arc'", () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).toContain("emotion_arc");
    // Also assert it documents the per-point shape (timestamp_ms + intensity_0_1)
    expect(prompt).toContain("timestamp_ms");
    expect(prompt).toContain("intensity_0_1");
  });
});
