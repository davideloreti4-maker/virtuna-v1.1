/**
 * Unit tests for calibration.ts pure functions:
 * - computeECE: Expected Calibration Error computation
 * - fitPlattScaling: Logistic regression parameter fitting
 * - applyPlattScaling: Sigmoid score recalibration
 */

import { vi } from "vitest";

// Mock module-level dependencies before importing calibration
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/cache", () => ({
  createCache: () => ({
    get: vi.fn(() => null),
    set: vi.fn(),
    invalidate: vi.fn(),
  }),
}));

import {
  computeECE,
  fitPlattScaling,
  applyPlattScaling,
} from "../calibration";
import type { OutcomePair } from "../calibration";

// =====================================================
// computeECE
// =====================================================

describe("computeECE", () => {
  it("returns ECE=0 and empty bins for empty input", () => {
    const result = computeECE([]);
    expect(result.ece).toBe(0);
    expect(result.bins).toEqual([]);
  });

  it("returns ECE near 0 for perfect calibration", () => {
    // 100 pairs where predicted === actual
    const pairs: OutcomePair[] = Array.from({ length: 100 }, (_, i) => ({
      predicted: (i + 0.5) / 100,
      actual: (i + 0.5) / 100,
    }));
    const result = computeECE(pairs);
    expect(result.ece).toBeCloseTo(0, 2);
  });

  it("returns high ECE for worst calibration", () => {
    // predicted always 0.9, actual always 0.1 => gap ~0.8
    const pairs: OutcomePair[] = Array.from({ length: 100 }, () => ({
      predicted: 0.9,
      actual: 0.1,
    }));
    const result = computeECE(pairs);
    expect(result.ece).toBeGreaterThanOrEqual(0.7);
    expect(result.ece).toBeLessThanOrEqual(0.9);
  });

  it("returns correct number of bins", () => {
    const pairs: OutcomePair[] = Array.from({ length: 50 }, (_, i) => ({
      predicted: i / 50,
      actual: i / 50,
    }));

    const result10 = computeECE(pairs, 10);
    expect(result10.bins).toHaveLength(10);

    const result5 = computeECE(pairs, 5);
    expect(result5.bins).toHaveLength(5);
  });

  it("has correct bin boundaries for 10 bins", () => {
    const pairs: OutcomePair[] = [{ predicted: 0.5, actual: 0.5 }];
    const result = computeECE(pairs, 10);

    const firstBin = result.bins[0]!;
    expect(firstBin.binStart).toBe(0);
    expect(firstBin.binEnd).toBe(0.1);

    const lastBin = result.bins[9]!;
    expect(lastBin.binStart).toBe(0.9);
    expect(lastBin.binEnd).toBe(1);
  });

  it("concentrates all samples in a single bin", () => {
    // All predicted=0.15 falls in bin index 1 (0.1-0.2)
    const pairs: OutcomePair[] = Array.from({ length: 10 }, () => ({
      predicted: 0.15,
      actual: 0.15,
    }));
    const result = computeECE(pairs, 10);

    for (let i = 0; i < result.bins.length; i++) {
      const bin = result.bins[i]!;
      if (i === 1) {
        expect(bin.count).toBe(10);
      } else {
        expect(bin.count).toBe(0);
      }
    }
  });

  it("places predicted=1.0 in the last bin", () => {
    const pairs: OutcomePair[] = [{ predicted: 1.0, actual: 0.9 }];
    const result = computeECE(pairs, 10);

    const lastBin = result.bins[9]!;
    expect(lastBin.count).toBe(1);

    // All other bins have count 0
    for (let i = 0; i < 9; i++) {
      expect(result.bins[i]!.count).toBe(0);
    }
  });

  it("ECE is always in [0, 1] range", () => {
    // Random-ish pairs
    const pairs: OutcomePair[] = Array.from({ length: 200 }, (_, i) => ({
      predicted: (i % 100) / 100,
      actual: ((i * 7 + 13) % 100) / 100,
    }));
    const result = computeECE(pairs);
    expect(result.ece).toBeGreaterThanOrEqual(0);
    expect(result.ece).toBeLessThanOrEqual(1);
  });
});

// =====================================================
// fitPlattScaling
// =====================================================

describe("fitPlattScaling", () => {
  it("returns null for fewer than 50 samples", () => {
    const pairs: OutcomePair[] = Array.from({ length: 49 }, () => ({
      predicted: 0.5,
      actual: 0.5,
    }));
    expect(fitPlattScaling(pairs)).toBeNull();
  });

  it("returns PlattParameters for >= 50 samples", () => {
    // 100 pairs with realistic spread
    const pairs: OutcomePair[] = Array.from({ length: 100 }, (_, i) => ({
      predicted: i / 100,
      actual: Math.min(1, Math.max(0, i / 100 + (i % 3 === 0 ? 0.05 : -0.03))),
    }));
    const result = fitPlattScaling(pairs);
    expect(result).not.toBeNull();
    expect(typeof result!.a).toBe("number");
    expect(typeof result!.b).toBe("number");
    expect(typeof result!.fittedAt).toBe("string");
    expect(result!.sampleCount).toBe(100);
  });

  it("parameter a is negative for well-calibrated models", () => {
    // Pairs where predicted roughly correlates with actual
    const pairs: OutcomePair[] = Array.from({ length: 100 }, (_, i) => ({
      predicted: i / 100,
      actual: Math.min(1, Math.max(0, (i / 100) * 0.9 + 0.05)),
    }));
    const result = fitPlattScaling(pairs);
    expect(result).not.toBeNull();
    expect(result!.a).toBeLessThan(0);
  });

  it("returns non-null for exactly 50 samples", () => {
    const pairs: OutcomePair[] = Array.from({ length: 50 }, () => ({
      predicted: 0.5,
      actual: 0.5,
    }));
    expect(fitPlattScaling(pairs)).not.toBeNull();
  });

  it("is deterministic (same input yields same output)", () => {
    const pairs: OutcomePair[] = Array.from({ length: 100 }, (_, i) => ({
      predicted: i / 100,
      actual: Math.min(1, Math.max(0, i / 100 + 0.02)),
    }));
    const result1 = fitPlattScaling(pairs);
    const result2 = fitPlattScaling(pairs);
    expect(result1).not.toBeNull();
    expect(result2).not.toBeNull();
    expect(result1!.a).toBe(result2!.a);
    expect(result1!.b).toBe(result2!.b);
  });
});

// =====================================================
// applyPlattScaling
// =====================================================

describe("applyPlattScaling", () => {
  it("returns rawScore unchanged when params is null", () => {
    expect(applyPlattScaling(75, null)).toBe(75);
  });

  it("returns value in 0-100 range for all inputs", () => {
    const params = {
      a: -2,
      b: 1,
      fittedAt: new Date().toISOString(),
      sampleCount: 100,
    };
    for (const score of [0, 25, 50, 75, 100]) {
      const result = applyPlattScaling(score, params);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    }
  });

  it("has sigmoid shape (higher input yields higher output for negative a)", () => {
    // With a=-2, b=0: sigmoid(a * normalized + b)
    // normalized=0 -> 1/(1+exp(0))=0.5 -> 50
    // normalized=1 -> 1/(1+exp(-2))~0.88 -> ~88
    // So score 100 should map higher than score 0
    const params = {
      a: -2,
      b: 0,
      fittedAt: new Date().toISOString(),
      sampleCount: 100,
    };
    expect(applyPlattScaling(100, params)).toBeGreaterThan(
      applyPlattScaling(0, params)
    );
  });

  it("returns a number in range for identity-ish params (a=-1, b=0)", () => {
    const params = {
      a: -1,
      b: 0,
      fittedAt: new Date().toISOString(),
      sampleCount: 100,
    };
    const result = applyPlattScaling(50, params);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
    expect(typeof result).toBe("number");
  });

  it("rounds to at most 2 decimal places", () => {
    const params = {
      a: -2,
      b: 1,
      fittedAt: new Date().toISOString(),
      sampleCount: 100,
    };
    for (const score of [0, 33, 50, 67, 100]) {
      const result = applyPlattScaling(score, params);
      const decimalPart = result.toString().split(".")[1];
      if (decimalPart) {
        expect(decimalPart.length).toBeLessThanOrEqual(2);
      }
    }
  });
});
