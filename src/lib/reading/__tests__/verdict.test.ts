/**
 * DATA-04 — verdict derivation: band + grounded why; `/100` demoted.
 *
 * RED state (Wave 0): `../view-model` (toReadingBlocks/canonicalFromLive) and
 * `../verdict-bands` (VERDICT_BANDS/bandFor) do NOT exist yet (Wave 2 builds
 * them). Collected by vitest, FAILS until then — the expected Wave-0 state.
 *
 * Asserts:
 *  - The verdict block carries a band (D-04 — from VERDICT_BANDS thresholds).
 *  - A grounded one-line `why` (D-05 — hero.verdict_line preferred; deterministic
 *    factor/the_one_fix fallback; NEVER a generic string).
 *  - Confidence expressed in band LANGUAGE, not a number (D-06).
 *  - The `/100` number appears ONLY as in-body supporting `score`, never as the
 *    headline (D-07 — judgment in the throne, metric demoted).
 *
 * Minimal-override factory pattern from the board analog.
 */
import { describe, it, expect } from "vitest";
import type { PredictionResult } from "@/lib/engine/types";
// RED until Wave 2 creates these modules:
import {
  toReadingBlocks,
  canonicalFromLive,
  type ReadingBlock,
} from "../view-model";
import { VERDICT_BANDS, bandFor } from "../verdict-bands";

type VerdictBlock = Extract<ReadingBlock, { kind: "verdict" }>;

const result = (over: Partial<PredictionResult> = {}): PredictionResult =>
  ({
    overall_score: 77,
    confidence: 0.6,
    confidence_label: "MEDIUM",
    anti_virality_gated: false,
    analysis_unavailable: false,
    partial_analysis: false,
    has_video: true,
    factors: [],
    ...over,
  }) as unknown as PredictionResult;

const verdictBlock = (over: Partial<PredictionResult> = {}): VerdictBlock => {
  const blocks = toReadingBlocks(canonicalFromLive(result(over)));
  const v = blocks.find((b): b is VerdictBlock => b.kind === "verdict");
  if (!v) throw new Error("verdict block missing — it must never be omitted");
  return v;
};

describe("VERDICT_BANDS (D-04)", () => {
  it("is a single source of band thresholds the verdict reads", () => {
    expect(VERDICT_BANDS.length).toBeGreaterThan(0);
    expect(bandFor(77).label).toBe("High potential");
    expect(bandFor(50).label).toBe("Solid contender");
    expect(bandFor(20).label).toBe("Needs work");
  });
});

describe("verdict block (DATA-04)", () => {
  it("carries a band derived from the score", () => {
    expect(verdictBlock({ overall_score: 77 }).band.label).toBe("High potential");
    expect(verdictBlock({ overall_score: 30 }).band.label).toBe("Needs work");
  });

  it("prefers the engine-authored grounded why (hero.verdict_line)", () => {
    const v = verdictBlock({
      hero: { verdict_line: "Strong hook, weak payoff" },
    } as unknown as Partial<PredictionResult>);
    expect(v.why).toBe("Strong hook, weak payoff");
  });

  it("never emits a generic why — grounds it in a real signal or leaves it empty", () => {
    const v = verdictBlock({
      hero: null,
      factors: [{ name: "Hook", score: 8, rationale: "opens on a question" }],
    } as unknown as Partial<PredictionResult>);
    expect(v.why).toBe("opens on a question");
  });

  it("expresses confidence in band language, NOT a number", () => {
    const v = verdictBlock({ confidence_label: "HIGH" });
    expect(typeof v.confidenceLanguage).toBe("string");
    expect(v.confidenceLanguage).not.toMatch(/\d/);
  });

  it("demotes the /100 number to an in-body score, never the headline", () => {
    const v = verdictBlock({ overall_score: 77 });
    // The number lives on the block as supporting evidence...
    expect(v.score).toBe(77);
    // ...but the headline-bearing fields carry judgment, not a "/100" metric.
    expect(v.band.label).not.toMatch(/\/\s*100/);
    expect(v.why).not.toMatch(/\/\s*100/);
  });
});
