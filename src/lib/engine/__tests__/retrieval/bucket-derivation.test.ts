/**
 * Unit tests for retrieval/bucket-derivation.ts —
 *  - D-03a all 3 branches: training_corpus (carry forward), calibrated (5 niches),
 *    non-calibrated (5 niches with placeholder 0/0 → average fallback).
 *  - Corpus niche alias edu↔education.
 *  - bucketValue() mapping.
 *  - Division-by-zero protection (views=0).
 *
 * Pure module — no IO. Defensively mocks logger + sentry in case of future addition.
 */

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

import {
  deriveBucket,
  bucketValue,
  NON_CORPUS_ENGAGEMENT_PERCENTILES,
  CORPUS_NICHE_ALIASES,
} from "@/lib/engine/retrieval/bucket-derivation";

describe("deriveBucket — training_corpus branch (bucket_source: corpus)", () => {
  it("carries forward 'viral' bucket from training_corpus row", () => {
    const result = deriveBucket({
      source_pool: "training_corpus",
      bucket_label: "viral",
      niche: "beauty",
      views: 1,
      likes: 0,
      shares: 0,
      comments: 0,
      saves: 0,
    });
    expect(result).toEqual({ bucket_label: "viral", bucket_source: "corpus" });
  });

  it("carries forward 'average' bucket from training_corpus row", () => {
    const result = deriveBucket({
      source_pool: "training_corpus",
      bucket_label: "average",
      niche: "fitness",
      views: 1,
      likes: 0,
      shares: 0,
      comments: 0,
      saves: null,
    });
    expect(result).toEqual({
      bucket_label: "average",
      bucket_source: "corpus",
    });
  });

  it("falls through to derived path when training_corpus bucket_label is null (corrupt row)", () => {
    const result = deriveBucket({
      source_pool: "training_corpus",
      bucket_label: null,
      niche: "beauty",
      views: 10_000_000,
      likes: 0,
      shares: 0,
      comments: 0,
      saves: null,
    });
    // 10M views ≥ 5.12M viralFloor for beauty → viral
    expect(result).toEqual({ bucket_label: "viral", bucket_source: "derived" });
  });
});

describe("deriveBucket — scraped_videos calibrated niches (bucket_source: derived)", () => {
  it("returns viral when views >= viralFloor (beauty: 5_120_000)", () => {
    const result = deriveBucket({
      source_pool: "scraped_videos",
      bucket_label: null,
      niche: "beauty",
      views: 10_000_000,
      likes: 100,
      shares: 10,
      comments: 20,
      saves: 5,
    });
    expect(result).toEqual({ bucket_label: "viral", bucket_source: "derived" });
  });

  it("returns under when views <= underCeiling (beauty: 250_840)", () => {
    const result = deriveBucket({
      source_pool: "scraped_videos",
      bucket_label: null,
      niche: "beauty",
      views: 100_000,
      likes: 10,
      shares: 1,
      comments: 2,
      saves: 0,
    });
    expect(result).toEqual({ bucket_label: "under", bucket_source: "derived" });
  });

  it("returns average for beauty when views between underCeiling and viralFloor", () => {
    const result = deriveBucket({
      source_pool: "scraped_videos",
      bucket_label: null,
      niche: "beauty",
      views: 1_000_000,
      likes: 100,
      shares: 10,
      comments: 20,
      saves: 5,
    });
    expect(result).toEqual({
      bucket_label: "average",
      bucket_source: "derived",
    });
  });

  it("aliases 'education' (NICHE_TREE form) to 'edu' (corpus form) for threshold lookup", () => {
    // edu thresholds: viralFloor=2_000_000, underCeiling=368_500
    // 'education' is the NICHE_TREE form; alias maps to 'edu' for THRESHOLD_SNAPSHOTS lookup.
    const viral = deriveBucket({
      source_pool: "scraped_videos",
      bucket_label: null,
      niche: "education",
      views: 5_000_000,
      likes: 0,
      shares: 0,
      comments: 0,
      saves: null,
    });
    expect(viral).toEqual({ bucket_label: "viral", bucket_source: "derived" });

    const under = deriveBucket({
      source_pool: "scraped_videos",
      bucket_label: null,
      niche: "education",
      views: 100_000,
      likes: 0,
      shares: 0,
      comments: 0,
      saves: null,
    });
    expect(under).toEqual({ bucket_label: "under", bucket_source: "derived" });
  });

  it("CORPUS_NICHE_ALIASES maps education → edu (matches migration constraint)", () => {
    expect(CORPUS_NICHE_ALIASES.education).toBe("edu");
  });
});

describe("deriveBucket — scraped_videos non-calibrated niches", () => {
  it("returns average when percentile placeholder is 0/0 (tech-gadgets — Plan 05 unbacked)", () => {
    expect(NON_CORPUS_ENGAGEMENT_PERCENTILES["tech-gadgets"]).toEqual({
      p80: 0,
      p40: 0,
    });
    const result = deriveBucket({
      source_pool: "scraped_videos",
      bucket_label: null,
      niche: "tech-gadgets",
      views: 1_000_000,
      likes: 50_000, // high engagement
      shares: 1_000,
      comments: 500,
      saves: 200,
    });
    expect(result).toEqual({
      bucket_label: "average",
      bucket_source: "derived",
    });
  });

  it("returns viral when engagement_rate >= p80 (simulated post-Plan-05 percentiles)", () => {
    // Mutate the placeholder for this test only — restore after.
    const original = { ...NON_CORPUS_ENGAGEMENT_PERCENTILES["tech-gadgets"] };
    NON_CORPUS_ENGAGEMENT_PERCENTILES["tech-gadgets"] = { p80: 0.05, p40: 0.01 };
    try {
      const result = deriveBucket({
        source_pool: "scraped_videos",
        bucket_label: null,
        niche: "tech-gadgets",
        views: 1_000,
        likes: 100, // engagement_rate = 0.10 ≥ p80 0.05
        shares: 0,
        comments: 0,
        saves: 0,
      });
      expect(result).toEqual({
        bucket_label: "viral",
        bucket_source: "derived",
      });
    } finally {
      NON_CORPUS_ENGAGEMENT_PERCENTILES["tech-gadgets"] = original;
    }
  });

  it("returns under when engagement_rate <= p40 (simulated post-Plan-05 percentiles)", () => {
    const original = { ...NON_CORPUS_ENGAGEMENT_PERCENTILES["gaming"] };
    NON_CORPUS_ENGAGEMENT_PERCENTILES["gaming"] = { p80: 0.05, p40: 0.01 };
    try {
      const result = deriveBucket({
        source_pool: "scraped_videos",
        bucket_label: null,
        niche: "gaming",
        views: 1_000_000,
        likes: 1_000, // engagement_rate = 0.001 ≤ p40 0.01
        shares: 0,
        comments: 0,
        saves: null,
      });
      expect(result).toEqual({
        bucket_label: "under",
        bucket_source: "derived",
      });
    } finally {
      NON_CORPUS_ENGAGEMENT_PERCENTILES["gaming"] = original;
    }
  });

  it("declares all 5 non-calibrated niches as placeholders", () => {
    const expectedKeys = [
      "tech-gadgets",
      "gaming",
      "fashion-style",
      "music-performance",
      "food-cooking",
    ];
    for (const k of expectedKeys) {
      expect(NON_CORPUS_ENGAGEMENT_PERCENTILES[k]).toEqual({ p80: 0, p40: 0 });
    }
  });
});

describe("deriveBucket — edge cases", () => {
  it("does not divide by zero when views = 0 (calibrated niche)", () => {
    expect(() =>
      deriveBucket({
        source_pool: "scraped_videos",
        bucket_label: null,
        niche: "beauty",
        views: 0,
        likes: 0,
        shares: 0,
        comments: 0,
        saves: 0,
      }),
    ).not.toThrow();
  });

  it("does not divide by zero when views = 0 (non-calibrated niche)", () => {
    const original = { ...NON_CORPUS_ENGAGEMENT_PERCENTILES["fashion-style"] };
    NON_CORPUS_ENGAGEMENT_PERCENTILES["fashion-style"] = {
      p80: 0.05,
      p40: 0.01,
    };
    try {
      expect(() =>
        deriveBucket({
          source_pool: "scraped_videos",
          bucket_label: null,
          niche: "fashion-style",
          views: 0,
          likes: 0,
          shares: 0,
          comments: 0,
          saves: 0,
        }),
      ).not.toThrow();
    } finally {
      NON_CORPUS_ENGAGEMENT_PERCENTILES["fashion-style"] = original;
    }
  });

  it("returns average when niche is not in any known set (safe default)", () => {
    const result = deriveBucket({
      source_pool: "scraped_videos",
      bucket_label: null,
      niche: "unknown-niche-xyz",
      views: 1_000_000,
      likes: 100,
      shares: 10,
      comments: 5,
      saves: 0,
    });
    expect(result).toEqual({
      bucket_label: "average",
      bucket_source: "derived",
    });
  });
});

describe("bucketValue (D-03 score formula mapping)", () => {
  it("maps viral → 1.0", () => {
    expect(bucketValue("viral")).toBe(1.0);
  });
  it("maps average → 0.5", () => {
    expect(bucketValue("average")).toBe(0.5);
  });
  it("maps under → 0.0", () => {
    expect(bucketValue("under")).toBe(0.0);
  });
});
