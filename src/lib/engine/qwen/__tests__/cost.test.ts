/**
 * Cost accounting for the platform's default model.
 *
 * `qwen3.7-flash` (the reasoning model since 2026-08-04) is priced by DashScope in CONTEXT BANDS,
 * not at one flat rate, and it is deliberately absent from the flat `PRICING` table. Two things can
 * go silently wrong there and both cost real money to discover:
 *   1. a banded model falling through to the unknown-model path, which rates it as qwen3.6-flash —
 *      8× the true base rate — while logging a warning nobody reads;
 *   2. a long call (video + 10 personas) rated at the cheap ≤32K band, understating every heavy run.
 * The band is chosen by INPUT size and moves BOTH rates, so these tests pin the boundaries.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { calculateCost, _resetCostWarnedModelsForTest } from "../cost";

beforeEach(() => _resetCostWarnedModelsForTest());

const cents = (usd: number) => usd * 100;

describe("calculateCost — banded pricing for qwen3.7-flash", () => {
  it("rates a short call at the base band ($0.03 / $0.13 per M)", () => {
    const c = calculateCost("qwen3.7-flash", { prompt_tokens: 10_000, completion_tokens: 1_000 });
    expect(c).toBeCloseTo(cents((10_000 * 0.03 + 1_000 * 0.13) / 1_000_000), 10);
  });

  it("steps to the mid band past 32K input — and the OUTPUT rate steps with it", () => {
    const c = calculateCost("qwen3.7-flash", { prompt_tokens: 40_000, completion_tokens: 1_000 });
    expect(c).toBeCloseTo(cents((40_000 * 0.10 + 1_000 * 0.40) / 1_000_000), 10);
    // the same output, one band down, is cheaper — proving output is not pinned to a flat rate
    const base = calculateCost("qwen3.7-flash", { prompt_tokens: 10_000, completion_tokens: 1_000 });
    expect(c).toBeGreaterThan(base);
  });

  it("steps to the top band past 256K input", () => {
    const c = calculateCost("qwen3.7-flash", { prompt_tokens: 300_000, completion_tokens: 2_000 });
    expect(c).toBeCloseTo(cents((300_000 * 0.20 + 2_000 * 0.80) / 1_000_000), 10);
  });

  it("holds the boundary exactly: 32,000 is the base band, 32,001 is not", () => {
    const at = calculateCost("qwen3.7-flash", { prompt_tokens: 32_000, completion_tokens: 0 });
    const over = calculateCost("qwen3.7-flash", { prompt_tokens: 32_001, completion_tokens: 0 });
    expect(at).toBeCloseTo(cents((32_000 * 0.03) / 1_000_000), 10);
    expect(over).toBeCloseTo(cents((32_001 * 0.10) / 1_000_000), 10);
  });

  it("never falls through to the unknown-model default — flash is an order of magnitude cheaper", () => {
    const flash = calculateCost("qwen3.7-flash", { prompt_tokens: 10_000, completion_tokens: 1_000 });
    // qwen3.6-flash is the unknown-model fallback ($0.25/$1.50); mis-resolving would inflate ~8×
    const fallback = calculateCost("qwen3.6-flash", { prompt_tokens: 10_000, completion_tokens: 1_000 });
    expect(flash).toBeLessThan(fallback / 4);
  });

  it("still rates the flat-priced models, including the plus rollback target", () => {
    const plus = calculateCost("qwen3.7-plus", { prompt_tokens: 10_000, completion_tokens: 1_000 });
    expect(plus).toBeCloseTo(cents((10_000 * 0.40 + 1_000 * 1.60) / 1_000_000), 10);
    // the omni audio sensor is unaffected by the reasoning-model move
    const omni = calculateCost("qwen3.5-omni-flash", { prompt_tokens: 10_000, completion_tokens: 1_000 });
    expect(omni).toBeCloseTo(cents((10_000 * 0.10 + 1_000 * 0.40) / 1_000_000), 10);
  });

  it("falls back on a genuinely unknown model rather than throwing", () => {
    expect(() => calculateCost("qwen9-imaginary", { prompt_tokens: 100, completion_tokens: 10 })).not.toThrow();
  });
});
