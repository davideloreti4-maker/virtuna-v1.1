/**
 * predict-aggregate.test.ts — D-01 derivation + D-05 confidence guards (Wave 0, → 06-02).
 *
 * RED by design: imports `aggregatePredict` + `LEAN_POS` from `../predict-aggregate`, which
 * does NOT exist until 06-02 (module-not-found = the intended Nyquist RED). 06-02 turns it GREEN.
 *
 * The non-negotiable honesty contract this locks (06-RESEARCH § "The honesty guard"):
 *   - `range` = the EXACT Math.min / Math.max of the per-analyst mapped lean positions —
 *     proven DERIVED, never a model field (D-01).
 *   - two DIFFERENT lean distributions → DIFFERENT ranges (panel-grounded, NOT a fixed
 *     final-band → range lookup, which D-01 rejected as decorative).
 *   - `confidence` = the TIGHTNESS of that spread, pure (same input → same confidence);
 *     tight (spread ≤15) → "High", wide (spread >40) → "Low" (D-05 boundaries).
 *   - `factors[]` carries `analystArchetype` for every input analyst (receipts, D-04).
 */

import { describe, it, expect } from "vitest";
import { aggregatePredict, LEAN_POS } from "../predict-aggregate";
import type { Lean, PredictAnalyst } from "../predict-schema";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function analyst(archetype: string, lean: Lean): PredictAnalyst {
  return {
    archetype,
    lean,
    factor: `driver named by ${archetype}`,
    factorDirection: lean === "lean_no" || lean === "strongly_no" ? "against" : "for",
    reasoning: `${archetype} reasoned about the scenario likelihood.`,
  };
}

// ─── range = panel spread (D-01 derivation) ────────────────────────────────────────

describe("aggregatePredict — range is the panel spread (D-01 derivation)", () => {
  it("range.min / range.max equal Math.min / Math.max of the mapped lean positions", () => {
    const panel = [
      analyst("skeptic", "lean_no"),
      analyst("strategist", "lean_yes"),
      analyst("contrarian", "strongly_yes"),
      analyst("researcher", "toss_up"),
    ];
    const positions = panel.map((a) => LEAN_POS[a.lean]);
    const r = aggregatePredict(panel);
    expect(r.range.min).toBe(Math.min(...positions));
    expect(r.range.max).toBe(Math.max(...positions));
  });

  it("two DIFFERENT lean distributions produce DIFFERENT ranges (panel-grounded, not a fixed map)", () => {
    const tight = [analyst("a", "toss_up"), analyst("b", "lean_yes")];
    const split = [analyst("a", "strongly_no"), analyst("b", "strongly_yes")];
    expect(aggregatePredict(tight).range).not.toEqual(aggregatePredict(split).range);
  });
});

// ─── confidence = tightness, pure (D-05) ───────────────────────────────────────────

describe("aggregatePredict — confidence is the spread tightness (D-05)", () => {
  it("same input → same confidence (pure derivation, no model self-report)", () => {
    const panel = [
      analyst("a", "lean_no"),
      analyst("b", "lean_yes"),
      analyst("c", "toss_up"),
    ];
    expect(aggregatePredict(panel).confidence).toBe(aggregatePredict(panel).confidence);
  });

  it("a tight panel (spread ≤15) → confidence High", () => {
    // toss_up(50) + lean_yes(65) → spread 15 → High.
    const tight = [analyst("a", "toss_up"), analyst("b", "lean_yes")];
    expect(aggregatePredict(tight).confidence).toBe("High");
  });

  it("a wide panel (spread >40) → confidence Low", () => {
    // strongly_no(10) + strongly_yes(90) → spread 80 → Low.
    const wide = [analyst("a", "strongly_no"), analyst("b", "strongly_yes")];
    expect(aggregatePredict(wide).confidence).toBe("Low");
  });
});

// ─── band centre + factors[] receipts (D-04) ───────────────────────────────────────

describe("aggregatePredict — band + factor receipts", () => {
  it("returns a band word (the centre of the lean distribution)", () => {
    const panel = [analyst("a", "lean_yes"), analyst("b", "lean_yes"), analyst("c", "toss_up")];
    expect(typeof aggregatePredict(panel).band).toBe("string");
    expect(aggregatePredict(panel).band.length).toBeGreaterThan(0);
  });

  it("factors[] carries analystArchetype for every input analyst (receipts, D-04)", () => {
    const panel = [
      analyst("skeptic", "lean_no"),
      analyst("strategist", "lean_yes"),
      analyst("researcher", "toss_up"),
    ];
    const r = aggregatePredict(panel);
    expect(r.factors.map((f) => f.analystArchetype)).toEqual([
      "skeptic",
      "strategist",
      "researcher",
    ]);
  });
});
