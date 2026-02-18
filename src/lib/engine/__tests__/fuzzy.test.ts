/**
 * Unit tests for fuzzy.ts — Jaro-Winkler similarity and bestFuzzyMatch.
 *
 * No mocks needed — fuzzy.ts is fully pure (no I/O, no external deps).
 */
import { jaroWinklerSimilarity, bestFuzzyMatch } from "../fuzzy";

describe("jaroWinklerSimilarity", () => {
  it("returns 1.0 for identical strings", () => {
    expect(jaroWinklerSimilarity("hello", "hello")).toBe(1.0);
  });

  it("returns 1.0 for case-insensitive identical strings", () => {
    expect(jaroWinklerSimilarity("Hello", "hello")).toBe(1.0);
    expect(jaroWinklerSimilarity("HELLO", "hello")).toBe(1.0);
    expect(jaroWinklerSimilarity("HeLLo", "hElLO")).toBe(1.0);
  });

  it("returns 0.0 when one string is empty", () => {
    expect(jaroWinklerSimilarity("", "hello")).toBe(0.0);
    expect(jaroWinklerSimilarity("hello", "")).toBe(0.0);
  });

  it("returns 1.0 when both strings are empty (identical)", () => {
    expect(jaroWinklerSimilarity("", "")).toBe(1.0);
  });

  it("returns a low value for completely different strings", () => {
    const score = jaroWinklerSimilarity("abc", "xyz");
    expect(score).toBeLessThan(0.5);
  });

  it("returns high value for classic Jaro-Winkler test case (martha/marhta)", () => {
    const score = jaroWinklerSimilarity("martha", "marhta");
    expect(score).toBeGreaterThan(0.9);
  });

  it("gives higher score for common prefix (Winkler prefix boost)", () => {
    const withPrefix = jaroWinklerSimilarity("prefix_abc", "prefix_xyz");
    const withoutPrefix = jaroWinklerSimilarity("abc_prefix", "xyz_prefix");
    expect(withPrefix).toBeGreaterThan(withoutPrefix);
  });

  it("always returns scores between 0 and 1", () => {
    const pairs: [string, string][] = [
      ["hello", "world"],
      ["test", "testing"],
      ["abc", "abcdef"],
      ["a", "z"],
      ["", "something"],
      ["same", "same"],
      ["x", "x"],
      ["abcdefghijklmnop", "zyxwvutsrqponmlk"],
    ];
    for (const [a, b] of pairs) {
      const score = jaroWinklerSimilarity(a, b);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

describe("bestFuzzyMatch", () => {
  it("returns score 1.0 for exact substring match", () => {
    const result = bestFuzzyMatch("viral sound", "This viral sound is trending");
    expect(result.score).toBe(1.0);
    expect(result.matched).toBe(true);
  });

  it("returns matched:false for no match below threshold", () => {
    const result = bestFuzzyMatch("completely unrelated", "hello world", 0.7);
    expect(result.matched).toBe(false);
  });

  it("returns score 0 and matched:false for empty target", () => {
    const result = bestFuzzyMatch("", "some content");
    expect(result.score).toBe(0);
    expect(result.matched).toBe(false);
  });

  it("returns score 0 and matched:false for empty content", () => {
    const result = bestFuzzyMatch("target", "");
    expect(result.score).toBe(0);
    expect(result.matched).toBe(false);
  });

  it("respects custom threshold — low threshold matches, high does not", () => {
    // "soudn" is close to "sound" (JW ~0.953) — should match with low threshold
    const lowThreshold = bestFuzzyMatch("sound", "soudn typo", 0.5);
    expect(lowThreshold.matched).toBe(true);

    // With a threshold above the actual score (0.96), it should not match
    const highThreshold = bestFuzzyMatch("sound", "soudn typo", 0.96);
    expect(highThreshold.matched).toBe(false);
  });

  it("returns score 1.0 for multi-word exact substring in content", () => {
    const result = bestFuzzyMatch(
      "trending audio",
      "This is a trending audio clip for TikTok"
    );
    expect(result.score).toBe(1.0);
    expect(result.matched).toBe(true);
  });

  it("produces a high score for near-match (fuzzy)", () => {
    // "trnding" is close to "trending" — single missing character
    const result = bestFuzzyMatch("trending", "trnding");
    expect(result.score).toBeGreaterThan(0.7);
    expect(result.matched).toBe(true);
  });
});
