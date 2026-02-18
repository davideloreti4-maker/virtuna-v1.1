import { describe, it, expect, vi, beforeEach } from "vitest";
import { featureVectorToMLInput, stratifiedSplit, trainModel } from "../ml";
import { makeFeatureVector } from "./factories";

// =====================================================
// Mocks — external dependencies
// =====================================================

const mockDownload = vi.fn();
const mockUpload = vi.fn();

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
        download: mockDownload,
        upload: mockUpload,
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

// =====================================================
// predictWithML
// =====================================================

describe("predictWithML", () => {
  beforeEach(() => {
    vi.resetModules();
    mockDownload.mockReset();
    mockUpload.mockReset();
  });

  // Helper: build minimal valid ModelWeights JSON blob
  function makeModelWeightsBlob() {
    const weights: number[][] = Array.from({ length: 5 }, (_, c) =>
      Array.from({ length: 15 }, (_, f) => (c * 15 + f) * 0.001)
    );
    const biases = [0.1, -0.05, 0.02, -0.1, 0.03];
    const featureNames = Array.from({ length: 15 }, (_, i) => `feature_${i}`);

    const modelWeights = {
      weights,
      biases,
      featureNames,
      numClasses: 5,
      trainedAt: "2026-01-01T00:00:00Z",
      accuracy: 0.65,
      confusionMatrix: Array.from({ length: 5 }, () =>
        Array.from({ length: 5 }, () => 0)
      ),
    };

    return new Blob([JSON.stringify(modelWeights)], {
      type: "application/json",
    });
  }

  it("returns null when model is not available", async () => {
    mockDownload.mockResolvedValue({
      data: null,
      error: { message: "not found" },
    });

    // Dynamic import to get fresh module (cleared cachedWeights)
    const { predictWithML } = await import("../ml");
    const result = await predictWithML(Array(15).fill(0.5));
    expect(result).toBeNull();
  });

  it("returns 0-100 score when model is loaded", async () => {
    const blob = makeModelWeightsBlob();
    mockDownload.mockResolvedValue({ data: blob, error: null });

    const { predictWithML } = await import("../ml");
    const result = await predictWithML(Array(15).fill(0.5));

    expect(result).not.toBeNull();
    expect(typeof result).toBe("number");
    expect(result!).toBeGreaterThanOrEqual(0);
    expect(result!).toBeLessThanOrEqual(100);
  });

  it("score is deterministic", async () => {
    const blob = makeModelWeightsBlob();
    mockDownload.mockResolvedValue({ data: blob, error: null });

    const mod = await import("../ml");
    const features = Array(15).fill(0.5);
    const result1 = await mod.predictWithML(features);
    const result2 = await mod.predictWithML(features);

    expect(result1).toBe(result2);
  });

  it("handles all-zero features without NaN", async () => {
    const blob = makeModelWeightsBlob();
    mockDownload.mockResolvedValue({ data: blob, error: null });

    const { predictWithML } = await import("../ml");
    const result = await predictWithML(Array(15).fill(0));

    expect(result).not.toBeNull();
    expect(typeof result).toBe("number");
    expect(Number.isNaN(result)).toBe(false);
  });

  it("returns null when download throws an exception", async () => {
    mockDownload.mockRejectedValue(new Error("Network error"));

    const { predictWithML } = await import("../ml");
    const result = await predictWithML(Array(15).fill(0.5));
    expect(result).toBeNull();
  });
});

// =====================================================
// trainModel
// =====================================================

describe("trainModel", () => {
  beforeEach(() => {
    vi.resetModules();
    mockDownload.mockReset();
    mockUpload.mockReset();
  });

  // Build minimal training data with 5 tiers (labels 1-5)
  function makeTrainingData() {
    const features: number[][] = [];
    const labels: number[] = [];

    // 20 samples per tier = 100 total
    for (let tier = 1; tier <= 5; tier++) {
      for (let i = 0; i < 20; i++) {
        // Features correlate with tier (higher tier = higher values)
        const base = (tier - 1) * 0.2;
        features.push(
          Array.from({ length: 15 }, (_, f) =>
            Math.min(1, Math.max(0, base + (f * 0.01) + (i * 0.005)))
          )
        );
        labels.push(tier);
      }
    }

    // Split 80/20
    const splitIdx = Math.floor(features.length * 0.8);

    return {
      featureNames: Array.from({ length: 15 }, (_, i) => `feature_${i}`),
      trainSet: {
        features: features.slice(0, splitIdx),
        labels: labels.slice(0, splitIdx),
      },
      testSet: {
        features: features.slice(splitIdx),
        labels: labels.slice(splitIdx),
      },
    };
  }

  it("trains with pre-computed data object and returns TrainingResult", async () => {
    mockUpload.mockResolvedValue({ error: null });

    const data = makeTrainingData();
    const result = await trainModel(data);

    expect(result).toBeDefined();
    expect(result.weights).toBeDefined();
    expect(result.weights.weights).toHaveLength(5); // 5 classes
    expect(result.weights.weights[0]).toHaveLength(15); // 15 features
    expect(result.weights.biases).toHaveLength(5);
    expect(result.weights.numClasses).toBe(5);
    expect(typeof result.trainAccuracy).toBe("number");
    expect(typeof result.testAccuracy).toBe("number");
    expect(result.trainAccuracy).toBeGreaterThanOrEqual(0);
    expect(result.trainAccuracy).toBeLessThanOrEqual(1);
  });

  it("uploads weights to Supabase Storage", async () => {
    mockUpload.mockResolvedValue({ error: null });

    const data = makeTrainingData();
    await trainModel(data);

    expect(mockUpload).toHaveBeenCalledTimes(1);
  });

  it("throws when upload fails", async () => {
    mockUpload.mockResolvedValue({
      error: { message: "Storage quota exceeded" },
    });

    const data = makeTrainingData();
    await expect(trainModel(data)).rejects.toThrow(
      /Failed to persist ML weights/
    );
  });

  it("produces confusion matrix with correct dimensions", async () => {
    mockUpload.mockResolvedValue({ error: null });

    const data = makeTrainingData();
    const result = await trainModel(data);

    expect(result.confusionMatrix).toHaveLength(5);
    for (const row of result.confusionMatrix) {
      expect(row).toHaveLength(5);
    }
  });

  it("trains with non-zero accuracy on structured data", async () => {
    mockUpload.mockResolvedValue({ error: null });

    const data = makeTrainingData();
    const result = await trainModel(data);

    // With 100 well-structured samples across 5 tiers,
    // the model should achieve > 0% accuracy
    expect(result.trainAccuracy).toBeGreaterThan(0);
  });
});
