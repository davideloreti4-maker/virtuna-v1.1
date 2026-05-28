import type { StageTiming } from "@/lib/engine/pipeline";

export interface StageLatencyMetric {
  stage: string;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  count: number;
}

/**
 * Aggregate per-stage latency across N pipeline runs.
 *
 * Input: timings[][] — outer index = run, inner = per-stage timing array.
 * Output: one StageLatencyMetric per unique stage name.
 *
 * Pure function. Uses linear-interpolation quantiles (matches RESEARCH §C.8).
 */
export function aggregateStageLatencies(
  allRunsTimings: StageTiming[][],
): StageLatencyMetric[] {
  const byStage = new Map<string, number[]>();
  for (const runTimings of allRunsTimings) {
    for (const t of runTimings) {
      let arr = byStage.get(t.stage);
      if (!arr) {
        arr = [];
        byStage.set(t.stage, arr);
      }
      arr.push(t.duration_ms);
    }
  }
  return Array.from(byStage.entries()).map(([stage, ds]) => ({
    stage,
    p50_ms: quantile(ds, 0.5),
    p95_ms: quantile(ds, 0.95),
    p99_ms: quantile(ds, 0.99),
    count: ds.length,
  }));
}

/**
 * Linear-interpolation quantile (matches RESEARCH §C.8 implementation).
 * Empty input → 0. Sorts a copy so the caller's array is unmodified.
 */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const sortedLo = sorted[lo];
  const sortedHi = sorted[hi];
  if (sortedLo === undefined || sortedHi === undefined) return 0;
  if (lo === hi) return sortedLo;
  return sortedLo + (sortedHi - sortedLo) * (pos - lo);
}
