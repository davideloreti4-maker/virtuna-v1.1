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
