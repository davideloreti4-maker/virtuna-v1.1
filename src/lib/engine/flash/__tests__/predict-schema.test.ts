/**
 * predict-schema.test.ts — the ordinal-lean model boundary + the structural D-01 guard (06-01).
 *
 * GREEN this plan (predict-schema.ts ships in 06-01). Locks:
 *   - a valid multi-analyst payload parses;
 *   - the panel schema's `.strict()` rejects a smuggled top-level aggregate
 *     (`probability` / `range` / `confidence` / `score`) — the D-01 honesty guard, structural;
 *   - the per-analyst `.strict()` rejects an extra key (e.g. a smuggled `score`);
 *   - coercePredictResponse salvages a bare array + lowercases an upper-cased lean — without
 *     ever bypassing the Zod gate.
 */

import { describe, it, expect } from "vitest";
import {
  LEANS,
  PredictAnalystSchema,
  PredictPanelResultSchema,
  coercePredictResponse,
  FACTOR_MAX,
  REASONING_MAX,
  type PredictAnalyst,
} from "../predict-schema";

// ─── Fixtures ────────────────────────────────────────────────────────────────────

const validA: PredictAnalyst = {
  archetype: "tough_crowd",
  lean: "lean_no",
  factor: "The hook buries the payoff past the 3-second mark.",
  factorDirection: "against",
  reasoning: "Skeptics bounce before the value lands.",
};

const validB: PredictAnalyst = {
  archetype: "purposeful_viewer",
  lean: "lean_yes",
  factor: "The promise is concrete and time-bound.",
  factorDirection: "for",
  reasoning: "A clear deliverable earns the watch.",
};

const validC: PredictAnalyst = {
  archetype: "cross_niche_curiosity",
  lean: "strongly_yes",
  factor: "Novel framing travels beyond the core niche.",
  factorDirection: "for",
  reasoning: "The angle is fresh enough to cross over.",
};

const validD: PredictAnalyst = {
  archetype: "niche_deep_scout",
  lean: "toss_up",
  factor: "Depth is there but the proof is thin.",
  factorDirection: "against",
  reasoning: "Needs one more receipt to convince the scout.",
};

// ─── LEANS ordinal scale ──────────────────────────────────────────────────────────

describe("LEANS — the 5-point ordinal scale", () => {
  it("is the low→high ordered lean scale (no binary stop/scroll)", () => {
    expect([...LEANS]).toEqual([
      "strongly_no",
      "lean_no",
      "toss_up",
      "lean_yes",
      "strongly_yes",
    ]);
  });
});

// ─── Valid payloads parse ──────────────────────────────────────────────────────────

describe("PredictPanelResultSchema — valid payload", () => {
  it("parses a valid 4-analyst panel", () => {
    const res = PredictPanelResultSchema.safeParse({
      analysts: [validA, validB, validC, validD],
    });
    expect(res.success).toBe(true);
  });

  it("accepts a 2-analyst panel (.min(2), custom panels vary — not .length(4))", () => {
    const res = PredictPanelResultSchema.safeParse({ analysts: [validA, validB] });
    expect(res.success).toBe(true);
  });

  it("rejects a single-analyst panel (.min(2))", () => {
    const res = PredictPanelResultSchema.safeParse({ analysts: [validA] });
    expect(res.success).toBe(false);
  });
});

// ─── The structural D-01 honesty guard — no smuggled aggregate ─────────────────────

describe("PredictPanelResultSchema — .strict() rejects a smuggled aggregate (D-01)", () => {
  it("rejects a top-level probability key", () => {
    const res = PredictPanelResultSchema.safeParse({
      analysts: [validA, validB],
      probability: 0.7,
    });
    expect(res.success).toBe(false);
  });

  it("rejects a top-level range key", () => {
    const res = PredictPanelResultSchema.safeParse({
      analysts: [validA, validB],
      range: { min: 1, max: 2 },
    });
    expect(res.success).toBe(false);
  });

  it("rejects a top-level confidence key", () => {
    const res = PredictPanelResultSchema.safeParse({
      analysts: [validA, validB],
      confidence: "High",
    });
    expect(res.success).toBe(false);
  });
});

// ─── Per-analyst .strict() ──────────────────────────────────────────────────────────

describe("PredictAnalystSchema — .strict() rejects a smuggled per-analyst number", () => {
  it("rejects an extra score key on an analyst", () => {
    const res = PredictAnalystSchema.safeParse({
      archetype: "x",
      lean: "lean_yes",
      factor: "f",
      factorDirection: "for",
      reasoning: "r",
      score: 9,
    });
    expect(res.success).toBe(false);
  });

  it("rejects an invalid lean value", () => {
    const res = PredictAnalystSchema.safeParse({
      archetype: "x",
      lean: "definitely_yes",
      factor: "f",
      factorDirection: "for",
      reasoning: "r",
    });
    expect(res.success).toBe(false);
  });
});

// ─── coercePredictResponse — salvage without fabrication ───────────────────────────

describe("coercePredictResponse — format salvage", () => {
  it("wraps a bare analyst array into { analysts: [...] }", () => {
    const coerced = coercePredictResponse([validA, validB]);
    const res = PredictPanelResultSchema.safeParse(coerced);
    expect(res.success).toBe(true);
  });

  it("lowercases an upper-cased lean (LEAN_YES → lean_yes)", () => {
    const coerced = coercePredictResponse([
      { ...validA, lean: "LEAN_YES" },
      { ...validB, lean: "Strongly_No" },
    ]) as { analysts: Array<{ lean: string }> };
    expect(coerced.analysts[0]!.lean).toBe("lean_yes");
    expect(coerced.analysts[1]!.lean).toBe("strongly_no");
  });

  it("salvages an unknown lean to the neutral toss_up (never a fabricated yes/no)", () => {
    const coerced = coercePredictResponse([
      { ...validA, lean: "mostly_maybe" },
      validB,
    ]) as { analysts: Array<{ lean: string }> };
    expect(coerced.analysts[0]!.lean).toBe("toss_up");
  });

  it("parses a fenced JSON string of analysts", () => {
    const fenced = "```json\n" + JSON.stringify({ analysts: [validA, validB] }) + "\n```";
    const coerced = coercePredictResponse(fenced);
    const res = PredictPanelResultSchema.safeParse(coerced);
    expect(res.success).toBe(true);
  });

  it("returns an empty (Zod-failing) panel for unparseable input — never throws", () => {
    const coerced = coercePredictResponse("not json at all");
    const res = PredictPanelResultSchema.safeParse(coerced);
    expect(res.success).toBe(false);
  });

  it("truncates over-long factor/reasoning to the cap so a verbose model doesn't 500 the panel (WR-01)", () => {
    // A verbose small model blows factor.max(FACTOR_MAX) / reasoning.max(REASONING_MAX). Pre-fix this
    // fails Zod → runPredictPanel throws → the WHOLE Predict feature 500s. Coercion now trims the tail.
    const coerced = coercePredictResponse([
      { ...validA, factor: "F".repeat(FACTOR_MAX + 200), reasoning: "R".repeat(REASONING_MAX + 300) },
      validB,
    ]) as { analysts: Array<{ factor: string; reasoning: string }> };
    expect(coerced.analysts[0]!.factor.length).toBe(FACTOR_MAX);
    expect(coerced.analysts[0]!.reasoning.length).toBe(REASONING_MAX);
    // the panel now CLEARS Zod instead of nuking (the 500 is gone)
    expect(PredictPanelResultSchema.safeParse(coerced).success).toBe(true);
  });

  it("leaves an at-cap factor/reasoning untouched (no needless truncation)", () => {
    const coerced = coercePredictResponse([
      { ...validA, factor: "F".repeat(FACTOR_MAX), reasoning: "R".repeat(REASONING_MAX) },
      validB,
    ]) as { analysts: Array<{ factor: string; reasoning: string }> };
    expect(coerced.analysts[0]!.factor.length).toBe(FACTOR_MAX);
    expect(PredictPanelResultSchema.safeParse(coerced).success).toBe(true);
  });
});
