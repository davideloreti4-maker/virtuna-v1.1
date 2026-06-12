/**
 * Unit tests for the pure deterministic `fromPersistedRow` normalizer (D-11, 02-03).
 *
 * These assert the determinism + degrade-not-throw contract directly on CONSTRUCTED
 * row inputs (the deep-equal-against-a-REAL-fixture test lives in identical-render.test.ts,
 * built/captured in 02-04). Node env (pure module, no DOM).
 *
 * Contract under test:
 *   - PURE + DETERMINISTIC: fromPersistedRow(sameRow) twice → deep-equal (no Math.random,
 *     no Date/now, no DB call).
 *   - string confidence/overall_score → coerced to number.
 *   - row.heatmap null → CanonicalReading.heatmap is null (NEVER synthesized).
 *   - variants.apollo / variants.hero / variants.craft absent → null fields, no throw.
 *   - signal_availability dual-dead → analysisUnavailable; single-dead → partialAnalysis.
 *   - a row missing the entire variants bag → valid degraded CanonicalReading, no throw.
 */
import { describe, expect, it } from "vitest";
import { fromPersistedRow } from "../from-persisted-row";

/** Minimal-override raw-row factory (mirrors the verdict-derive.test.ts pattern). */
const row = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "00000000-0000-0000-0000-000000000000",
  overall_score: 77,
  confidence: 0.6,
  factors: [],
  suggestions: [],
  ...over,
});

describe("fromPersistedRow — purity + determinism", () => {
  it("is deterministic: same row normalizes byte-identically on repeated calls", () => {
    const r = row({
      heatmap: { segments: [], personas: [], weighted_curve: [] },
      signal_availability: { gemini: true, behavioral: true },
      variants: {
        hero: { verdict_line: "x", ceiling: null, the_one_fix: null, go_no_go: "go", post_window: null },
        apollo: { rewrites: [{ variant: "a" }], ceiling_capper: "c" },
        craft: { overall_impression: "oi", content_summary: "cs" },
      },
    });
    const a = fromPersistedRow(r);
    const b = fromPersistedRow(r);
    expect(a).toEqual(b);
  });

  it("coerces string confidence/overall_score to numbers (Pitfall 5)", () => {
    const r = row({ confidence: "0.42", overall_score: "63" });
    const out = fromPersistedRow(r);
    expect(out.confidence).toBe(0.42);
    expect(out.overallScore).toBe(63);
    expect(typeof out.confidence).toBe("number");
    expect(typeof out.overallScore).toBe("number");
  });
});

describe("fromPersistedRow — heatmap reads the column ONLY (no synth, D-14/Pitfall 3)", () => {
  it("row.heatmap null → CanonicalReading.heatmap is null, not synthesized", () => {
    const out = fromPersistedRow(
      row({ heatmap: null, personas: [{ persona_id: "p", watch_through_pct: 80 }] }),
    );
    expect(out.heatmap).toBeNull();
  });

  it("row.heatmap present → passed through verbatim", () => {
    const hm = { segments: [], personas: [], weighted_curve: [0.5] };
    const out = fromPersistedRow(row({ heatmap: hm }));
    expect(out.heatmap).toEqual(hm);
  });
});

describe("fromPersistedRow — degrades, never throws on partial variants", () => {
  it("variants.apollo absent → apolloReasoning null (no throw)", () => {
    const out = fromPersistedRow(row({ variants: { craft: {} } }));
    expect(out.apolloReasoning).toBeNull();
  });

  it("variants.hero absent → hero null (no throw)", () => {
    const out = fromPersistedRow(row({ variants: { apollo: { rewrites: [] } } }));
    expect(out.hero).toBeNull();
  });

  it("entire variants bag missing → valid degraded CanonicalReading, never throws", () => {
    let out!: ReturnType<typeof fromPersistedRow>;
    expect(() => {
      out = fromPersistedRow(row({ variants: null }));
    }).not.toThrow();
    expect(out.hero).toBeNull();
    expect(out.apolloReasoning).toBeNull();
    expect(out.contentSummary).toBeNull();
    expect(out.overallImpression).toBeNull();
  });
});

describe("fromPersistedRow — degradation tiers from signal_availability (D-14)", () => {
  it("dual-dead (!gemini && !behavioral) → analysisUnavailable true", () => {
    const out = fromPersistedRow(
      row({ signal_availability: { gemini: false, behavioral: false } }),
    );
    expect(out.analysisUnavailable).toBe(true);
  });

  it("single-dead (gemini !== behavioral) → partialAnalysis true", () => {
    const out = fromPersistedRow(
      row({ signal_availability: { gemini: true, behavioral: false } }),
    );
    expect(out.partialAnalysis).toBe(true);
    expect(out.analysisUnavailable).toBe(false);
  });

  it("both live → neither degradation flag set", () => {
    const out = fromPersistedRow(
      row({ signal_availability: { gemini: true, behavioral: true } }),
    );
    expect(out.analysisUnavailable).toBe(false);
    expect(out.partialAnalysis).toBe(false);
  });

  it("no signal_availability → both flags false (defensive)", () => {
    const out = fromPersistedRow(row({ signal_availability: null }));
    expect(out.analysisUnavailable).toBe(false);
    expect(out.partialAnalysis).toBe(false);
  });
});

describe("fromPersistedRow — confidence/anti-virality prefer persisted column", () => {
  it("prefers the persisted confidence_label column when present", () => {
    const out = fromPersistedRow(row({ confidence: 0.2, confidence_label: "HIGH" }));
    expect(out.confidenceLabel).toBe("HIGH");
  });

  it("derives confidence_label from thresholds only when column null (old rows)", () => {
    expect(fromPersistedRow(row({ confidence: 0.8, confidence_label: null })).confidenceLabel).toBe("HIGH");
    expect(fromPersistedRow(row({ confidence: 0.5, confidence_label: null })).confidenceLabel).toBe("MEDIUM");
    expect(fromPersistedRow(row({ confidence: 0.2, confidence_label: null })).confidenceLabel).toBe("LOW");
  });

  it("prefers persisted anti_virality_gated column when present", () => {
    const out = fromPersistedRow(row({ confidence: 0.9, anti_virality_gated: true }));
    expect(out.antiViralityGated).toBe(true);
  });

  it("derives anti_virality_gated from threshold only when column null", () => {
    expect(fromPersistedRow(row({ confidence: 0.2, anti_virality_gated: null })).antiViralityGated).toBe(true);
    expect(fromPersistedRow(row({ confidence: 0.6, anti_virality_gated: null })).antiViralityGated).toBe(false);
  });
});
