import { describe, it, expect } from "vitest";
import {
  aggregateStageLatencies,
  quantile,
} from "../metrics/stage-latency";
import type { StageTiming } from "@/lib/engine/pipeline";

describe("quantile (linear interpolation)", () => {
  it("empty array → 0", () => {
    expect(quantile([], 0.5)).toBe(0);
  });

  it("single value → that value at any quantile", () => {
    expect(quantile([42], 0.5)).toBe(42);
    expect(quantile([42], 0.95)).toBe(42);
  });

  it("[1,2,3,4,5] median (q=0.5) → 3 (exact midpoint)", () => {
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
  });

  it("[1,2,3,4] median (q=0.5) → 2.5 (linear interp between positions 1.5)", () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
  });

  it("q=0 → min, q=1 → max", () => {
    expect(quantile([10, 20, 30, 40], 0)).toBe(10);
    expect(quantile([10, 20, 30, 40], 1)).toBe(40);
  });

  it("sorts before computing (unsorted input)", () => {
    expect(quantile([5, 1, 4, 2, 3], 0.5)).toBe(3);
  });
});

describe("aggregateStageLatencies", () => {
  it("empty input → empty array", () => {
    expect(aggregateStageLatencies([])).toEqual([]);
  });

  it("single run with two gemini timings → one record with p50=150, count=2", () => {
    const runs: StageTiming[][] = [
      [
        { stage: "gemini", duration_ms: 100 },
        { stage: "gemini", duration_ms: 200 },
      ],
    ];
    const result = aggregateStageLatencies(runs);
    expect(result).toHaveLength(1);
    const gemini = result[0]!;
    expect(gemini.stage).toBe("gemini");
    expect(gemini.p50_ms).toBe(150); // (100 + 200) / 2 via linear interp at pos 0.5
    expect(gemini.count).toBe(2);
  });

  it("single run, single stage, single sample → p50=p95=p99=value, count=1", () => {
    const runs: StageTiming[][] = [[{ stage: "a", duration_ms: 100 }]];
    const result = aggregateStageLatencies(runs);
    const a = result.find((r) => r.stage === "a")!;
    expect(a.p50_ms).toBe(100);
    expect(a.p95_ms).toBe(100);
    expect(a.p99_ms).toBe(100);
    expect(a.count).toBe(1);
  });

  it("multi-run, multi-stage — values bucketed by stage name", () => {
    const runs: StageTiming[][] = [
      [
        { stage: "gemini", duration_ms: 100 },
        { stage: "deepseek", duration_ms: 500 },
      ],
      [
        { stage: "gemini", duration_ms: 200 },
        { stage: "deepseek", duration_ms: 600 },
      ],
      [
        { stage: "gemini", duration_ms: 300 },
        { stage: "deepseek", duration_ms: 700 },
      ],
    ];
    const result = aggregateStageLatencies(runs);
    expect(result).toHaveLength(2);
    const gemini = result.find((r) => r.stage === "gemini")!;
    const deepseek = result.find((r) => r.stage === "deepseek")!;
    expect(gemini.count).toBe(3);
    expect(deepseek.count).toBe(3);
    expect(gemini.p50_ms).toBe(200); // [100,200,300] median
    expect(deepseek.p50_ms).toBe(600); // [500,600,700] median
  });

  it("p95 / p99 on a known distribution", () => {
    // 100 samples: 1..100. p95 = 95.05 (linear interp), p99 = 99.01
    const runs: StageTiming[][] = [
      Array.from({ length: 100 }, (_, i) => ({
        stage: "x",
        duration_ms: i + 1,
      })),
    ];
    const result = aggregateStageLatencies(runs);
    const x = result.find((r) => r.stage === "x")!;
    expect(x.count).toBe(100);
    // pos at q=0.95 in sorted [1..100]: (100-1)*0.95 = 94.05 → between sorted[94]=95 and sorted[95]=96
    // value = 95 + (96-95)*0.05 = 95.05
    expect(x.p95_ms).toBeCloseTo(95.05, 2);
    expect(x.p99_ms).toBeCloseTo(99.01, 2);
  });
});
