import { describe, it, expect, vi } from "vitest";
import { featureVectorToMLInput, stratifiedSplit } from "../ml";
import { makeFeatureVector } from "./factories";

// =====================================================
// Mocks — external dependencies
// =====================================================

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  }),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        download: vi.fn(),
        upload: vi.fn(),
      })),
    },
  })),
}));

vi.mock("fs", () => ({
  readFileSync: vi.fn(),
}));

// =====================================================
// featureVectorToMLInput
// =====================================================

describe("featureVectorToMLInput", () => {
  it("produces a 15-element array", () => {
    const result = featureVectorToMLInput(makeFeatureVector());
    expect(result).toHaveLength(15);
  });

  it("all values in 0-1 range", () => {
    const result = featureVectorToMLInput(makeFeatureVector());
    for (const val of result) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    }
  });

  it("maps shareability to shareRate (index 0)", () => {
    const result = featureVectorToMLInput(
      makeFeatureVector({ shareability: 8 })
    );
    expect(result[0]).toBe(0.8);
  });

  it("maps commentProvocation to commentRate (index 1)", () => {
    const result = featureVectorToMLInput(
      makeFeatureVector({ commentProvocation: 6 })
    );
    expect(result[1]).toBe(0.6);
  });

  it("handles null durationSeconds with default 30/180", () => {
    const result = featureVectorToMLInput(
      makeFeatureVector({ durationSeconds: null })
    );
    // durationSeconds slot is index 6, default 30 / 180
    expect(result[6]).toBeCloseTo(30 / 180, 3);
  });

  it("handles null audioTrendingMatch as 0", () => {
    const result = featureVectorToMLInput(
      makeFeatureVector({ audioTrendingMatch: null })
    );
    // hasTrendingSound is index 8
    expect(result[8]).toBe(0);
  });

  it("clamps extreme high values to <= 1", () => {
    const result = featureVectorToMLInput(
      makeFeatureVector({ shareability: 15 })
    );
    expect(result[0]).toBeLessThanOrEqual(1.0);
  });

  it("clamps extreme low (negative) values to >= 0", () => {
    const result = featureVectorToMLInput(
      makeFeatureVector({ shareability: -5 })
    );
    expect(result[0]).toBeGreaterThanOrEqual(0);
  });

  it("defaults mid-range (0.5) for missing DeepSeek signals", () => {
    // Pass empty partial — all DeepSeek-derived features should default to 5/10 = 0.5
    const result = featureVectorToMLInput({});
    // shareRate (shareability default 5) -> 0.5
    expect(result[0]).toBe(0.5);
    // commentRate (commentProvocation default 5) -> 0.5
    expect(result[1]).toBe(0.5);
    // likeRate (emotionalCharge default 5) -> 0.5
    expect(result[2]).toBe(0.5);
    // saveRate (saveWorthiness default 5) -> 0.5
    expect(result[3]).toBe(0.5);
  });
});

// =====================================================
// stratifiedSplit
// =====================================================

describe("stratifiedSplit", () => {
  // Simple deterministic RNG (linear congruential generator)
  function makeRng() {
    let state = 12345;
    return () => {
      state = (state * 1664525 + 1013904223) % 2 ** 32;
      return (state >>> 0) / 2 ** 32;
    };
  }

  // Build dataset: 50 label-1, 30 label-2, 20 label-3
  function buildDataset() {
    const features: number[][] = [];
    const labels: number[] = [];
    for (let i = 0; i < 50; i++) {
      features.push(Array(15).fill(i / 50));
      labels.push(1);
    }
    for (let i = 0; i < 30; i++) {
      features.push(Array(15).fill(0.5 + i / 60));
      labels.push(2);
    }
    for (let i = 0; i < 20; i++) {
      features.push(Array(15).fill(0.8 + i / 100));
      labels.push(3);
    }
    return { features, labels };
  }

  it("preserves label proportions (within +/- 1)", () => {
    const { features, labels } = buildDataset();
    const { test } = stratifiedSplit(features, labels, 0.2, makeRng());

    const counts = new Map<number, number>();
    for (const l of test.labels) {
      counts.set(l, (counts.get(l) ?? 0) + 1);
    }

    // 20% of 50 = 10, 20% of 30 = 6, 20% of 20 = 4
    expect(counts.get(1) ?? 0).toBeGreaterThanOrEqual(9);
    expect(counts.get(1) ?? 0).toBeLessThanOrEqual(11);
    expect(counts.get(2) ?? 0).toBeGreaterThanOrEqual(5);
    expect(counts.get(2) ?? 0).toBeLessThanOrEqual(7);
    expect(counts.get(3) ?? 0).toBeGreaterThanOrEqual(3);
    expect(counts.get(3) ?? 0).toBeLessThanOrEqual(5);
  });

  it("train + test = total (no samples lost)", () => {
    const { features, labels } = buildDataset();
    const { train, test } = stratifiedSplit(features, labels, 0.2, makeRng());

    expect(train.features.length + test.features.length).toBe(100);
    expect(train.labels.length + test.labels.length).toBe(100);
  });

  it("deterministic with same seed", () => {
    const { features, labels } = buildDataset();
    const result1 = stratifiedSplit(features, labels, 0.2, makeRng());
    const result2 = stratifiedSplit(features, labels, 0.2, makeRng());

    expect(result1.train.labels).toEqual(result2.train.labels);
    expect(result1.test.labels).toEqual(result2.test.labels);
  });
});
