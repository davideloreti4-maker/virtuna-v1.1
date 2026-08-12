import { describe, it, expect } from "vitest";
import {
  isRenormalisable,
  normalizeShares,
  normalizeWeights,
  WEIGHT_KEYS,
  RENORMALISABLE_MIN,
  RENORMALISABLE_MAX,
} from "../normalize-shares";

/**
 * The repair that stops a completed calibration being thrown away over a rounding error.
 *
 * Observed live on a production build 2026-08-04, twice in five runs: the Apify scrape
 * SUCCEEDED (36 requests, 0 failed, ~$0.05), ~135 seconds elapsed, and then
 *
 *   calibration returned scrape_failed — "persona shares must sum to 1.0 (±0.02)"
 *
 * so the creator was shown "Calibration failed. Check the handle and try again." about a public
 * handle that had just been read successfully. The model had returned shares summing to
 * something like 0.97.
 */

const personas = (shares: number[]) => shares.map((share, i) => ({ archetype: `a${i}`, share }));
const sum = (ps: { share: number }[]) => ps.reduce((s, p) => s + p.share, 0);

describe("normalizeShares", () => {
  it("repairs the near-miss that was binning real calibrations", () => {
    // 10 shares summing to 0.97 — the live failure.
    const ps = personas([0.15, 0.12, 0.1, 0.1, 0.1, 0.1, 0.1, 0.08, 0.07, 0.05]);
    expect(sum(ps)).toBeCloseTo(0.97, 5);

    const fixed = normalizeShares(ps);
    expect(sum(fixed)).toBeCloseTo(1, 10);
  });

  it("preserves every relative magnitude", () => {
    // The whole justification for repairing rather than rejecting: these are proportions, and
    // their meaning is the ratios between them. Scaling must not reorder or reweight anything.
    const ps = personas([0.4, 0.2, 0.1, 0.2]);
    const fixed = normalizeShares(ps);

    expect(fixed[0]!.share / fixed[1]!.share).toBeCloseTo(2, 10);
    expect(fixed[1]!.share / fixed[2]!.share).toBeCloseTo(2, 10);
    expect(fixed.map((p) => p.archetype)).toEqual(ps.map((p) => p.archetype));
  });

  it("leaves an already-exact distribution byte-identical", () => {
    // Exact model output must not be re-derived — no float drift introduced for free.
    const ps = personas([0.5, 0.3, 0.2]);
    expect(normalizeShares(ps)).toBe(ps);
  });

  it("does not divide by zero on all-zero shares", () => {
    const ps = personas([0, 0, 0]);
    expect(() => normalizeShares(ps)).not.toThrow();
    expect(normalizeShares(ps)).toBe(ps);
  });

  it("keeps the other persona fields intact", () => {
    const ps = [{ archetype: "a", share: 0.5, reaction_frame: "keeps watching", extra: 1 }];
    const [fixed] = normalizeShares(ps);
    expect(fixed).toMatchObject({ archetype: "a", reaction_frame: "keeps watching", extra: 1 });
    expect(fixed!.share).toBeCloseTo(1, 10);
  });
});

describe("isRenormalisable — the band, and why it is not infinite", () => {
  it("accepts a rounding artifact", () => {
    expect(isRenormalisable(0.97)).toBe(true);
    expect(isRenormalisable(1.03)).toBe(true);
    expect(isRenormalisable(1)).toBe(true);
  });

  it("rejects output that answered a different question", () => {
    // Percentages (sum 100) or per-persona confidences are not a distribution with a rounding
    // error in it — renormalising those would fabricate one. Still a hard failure.
    expect(isRenormalisable(100)).toBe(false);
    expect(isRenormalisable(4)).toBe(false);
    expect(isRenormalisable(0)).toBe(false);
    expect(isRenormalisable(0.1)).toBe(false);
  });

  it("is exclusive at both bounds", () => {
    expect(isRenormalisable(RENORMALISABLE_MIN)).toBe(false);
    expect(isRenormalisable(RENORMALISABLE_MAX)).toBe(false);
  });
});

describe("normalizeWeights", () => {
  it("repairs the four named weights", () => {
    const w = { fyp: 0.4, niche: 0.3, loyalist: 0.2, cross_niche: 0.05 }; // 0.95
    const fixed = normalizeWeights(w, WEIGHT_KEYS);
    expect(WEIGHT_KEYS.reduce((s, k) => s + fixed[k], 0)).toBeCloseTo(1, 10);
    // Ratios preserved, as above.
    expect(fixed.fyp / fixed.niche).toBeCloseTo(0.4 / 0.3, 10);
  });

  it("leaves an exact set alone", () => {
    const w = { fyp: 0.25, niche: 0.25, loyalist: 0.25, cross_niche: 0.25 };
    expect(normalizeWeights(w, WEIGHT_KEYS)).toBe(w);
  });
});
