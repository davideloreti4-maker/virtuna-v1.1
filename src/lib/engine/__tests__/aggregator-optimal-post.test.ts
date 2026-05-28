/**
 * Phase 1 (R6.1, D-13, D-15) — aggregator's optimal_post_window wiring tests.
 *
 * Plan 01-01 shipped 4 it.todo placeholders; Plan 01-05 T3 fills them with real
 * assertions exercising the wiring inside aggregateScores().
 *
 * Contract:
 *  - The aggregator calls computeOptimalPostWindow BEFORE Stage 10/11 (Pitfall #5)
 *    so critique + counterfactuals see optimal_post_window on the assembled result.
 *  - Helper returns are surfaced verbatim: source='niche' on hit, FALLBACK on
 *    unknown niche, null on error.
 *  - Errors thrown by the helper are caught (non-fatal per D-15) — field set to null.
 *
 * Mock pattern mirrors aggregator-anti-virality.test.ts:
 * stubs supabase/sentry/cache/ml/calibration/gemini/deepseek/stage10/stage11 so
 * the aggregator runs without touching the network/DB. computeOptimalPostWindow
 * is stubbed at module level so tests can drive deterministic returns.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// =====================================================
// Mocks — external dependencies imported transitively by aggregator.ts
// =====================================================

vi.mock("@/lib/logger", () => ({
  createLogger: () => {
    const stub = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: () => stub,
    };
    return stub;
  },
}));

// createServiceClient — aggregator constructs one before calling
// computeOptimalPostWindow. Returns a stub object so the helper mock can
// receive it without crashing during shape checks.
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({ from: vi.fn() })),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock("@/lib/cache", () => ({
  createCache: () => ({
    get: vi.fn(() => null),
    set: vi.fn(),
    invalidate: vi.fn(),
  }),
}));

vi.mock("../ml", () => ({
  predictWithML: vi.fn().mockResolvedValue(50),
  featureVectorToMLInput: vi.fn().mockReturnValue(Array(15).fill(0.5)),
}));

vi.mock("../calibration", () => ({
  getPlattParameters: vi.fn().mockResolvedValue(null),
  applyPlattScaling: vi.fn((score: number, _params: unknown) => score),
}));

vi.mock("../gemini", () => ({
  GEMINI_MODEL: "gemini-test",
}));

vi.mock("../deepseek", () => ({
  DEEPSEEK_MODEL: "deepseek-test",
  isCircuitOpen: vi.fn(() => true),
}));

// computeOptimalPostWindow mock — preserves the real FALLBACK_POST_WINDOW
// constant so tests can use it as a return-value sentinel without redeclaring
// the shape.
const mockCompute = vi.fn();
vi.mock("../optimal-post", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../optimal-post")>();
  return {
    ...actual,
    computeOptimalPostWindow: (
      ...args: Parameters<typeof actual.computeOptimalPostWindow>
    ) => mockCompute(...args),
  };
});

// Stage-event tracker shared by stage10 + stage11 mocks so we can assert
// ordering relative to computeOptimalPostWindow (Pitfall #5).
const callOrder: string[] = [];

vi.mock("../stage10-critique", () => ({
  runStage10Critique: vi.fn(async () => {
    callOrder.push("stage10");
    return null;
  }),
  applyCritiqueAdjustment: vi.fn((c: number) => c),
}));

vi.mock("../stage11-counterfactuals", async (importOriginal) => {
  const orig =
    await importOriginal<typeof import("../stage11-counterfactuals")>();
  return {
    ...orig,
    runStage11Counterfactuals: vi.fn().mockImplementation(
      async (
        _result: unknown,
        _videoContext: unknown,
        onEvent?: (e: {
          type: string;
          stage: string;
          wave: string;
          timestamp_ms?: number;
          duration_ms?: number;
          cost_cents?: number;
          ok?: boolean;
        }) => void,
      ) => {
        callOrder.push("stage11");
        const ts = performance.now();
        onEvent?.({
          type: "stage_start",
          stage: "stage_11_counterfactuals",
          wave: "post",
          timestamp_ms: ts,
        });
        onEvent?.({
          type: "stage_end",
          stage: "stage_11_counterfactuals",
          wave: "post",
          duration_ms: 1,
          cost_cents: 0,
          ok: true,
        });
        return null;
      },
    ),
  };
});

// =====================================================
// Imports (after mocks)
// =====================================================

import { aggregateScores } from "../aggregator";
import { FALLBACK_POST_WINDOW } from "../optimal-post";
import { makePipelineResult } from "./factories";

// =====================================================
// aggregateScores — optimal_post_window wiring tests
// =====================================================

describe("aggregateScores — optimal_post_window", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCompute.mockReset();
    callOrder.length = 0;
  });

  it("populates result.optimal_post_window for known niche", async () => {
    mockCompute.mockResolvedValueOnce({
      day_of_week: "Wed",
      hour_range: [19, 21],
      timezone: "UTC",
      reasoning: "Your niche peaks Wed 19:00-21:00 UTC (n=42 videos)",
      source: "niche",
    });
    const result = await aggregateScores(makePipelineResult());
    expect(result.optimal_post_window?.source).toBe("niche");
    expect(result.optimal_post_window?.day_of_week).toBe("Wed");
    expect(result.optimal_post_window?.hour_range).toEqual([19, 21]);
    expect(result.optimal_post_window?.timezone).toBe("UTC");
  });

  it("populates result.optimal_post_window = FALLBACK when niche unknown", async () => {
    mockCompute.mockResolvedValueOnce(FALLBACK_POST_WINDOW);
    const result = await aggregateScores(makePipelineResult());
    expect(result.optimal_post_window?.source).toBe("fallback");
    expect(result.optimal_post_window).toEqual(FALLBACK_POST_WINDOW);
  });

  it("sets result.optimal_post_window = null when computeOptimalPostWindow throws (non-fatal per D-15)", async () => {
    mockCompute.mockRejectedValueOnce(new Error("network"));
    const result = await aggregateScores(makePipelineResult());
    expect(result.optimal_post_window).toBeNull();
  });

  it("computeOptimalPostWindow is called BEFORE Stage 10/11 (Pitfall #5 ordering)", async () => {
    mockCompute.mockImplementationOnce(async () => {
      callOrder.push("optimal_post");
      return FALLBACK_POST_WINDOW;
    });
    await aggregateScores(makePipelineResult());
    // Ordering invariant: helper resolves before Stage 10 critique fires, which
    // itself runs before Stage 11 counterfactuals.
    const opIdx = callOrder.indexOf("optimal_post");
    const s10Idx = callOrder.indexOf("stage10");
    const s11Idx = callOrder.indexOf("stage11");
    expect(opIdx).toBeGreaterThanOrEqual(0);
    expect(s10Idx).toBeGreaterThan(opIdx);
    expect(s11Idx).toBeGreaterThan(s10Idx);
  });
});
