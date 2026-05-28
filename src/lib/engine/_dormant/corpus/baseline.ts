import { ENGINE_VERSION } from "@/lib/engine/aggregator";
import { runEvalHarness, type BenchmarkReport } from "./eval-harness";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "corpus/baseline" });

/**
 * D-20 deliverable: measure the v2.1 baseline on a sealed corpus_version.
 * Persists ONE row to benchmark_results with engine_version = "2.1.0"
 * (D-21 — hardcoded literal from aggregator.ts:17 until Phase 3 refactors versioning).
 */
export async function measureV21Baseline(
  corpusVersion: string,
  opts: { leaveOneOut?: boolean; maxTotalCostCents?: number; rateLimitDelayMs?: number } = {},
): Promise<BenchmarkReport> {
  log.info("v2.1 baseline measurement", { corpusVersion });
  const report = await runEvalHarness({
    corpusVersion,
    engineVersion: ENGINE_VERSION,   // = "2.1.0" (D-21)
    leaveOneOut: opts.leaveOneOut,
    maxTotalCostCents: opts.maxTotalCostCents,
    rateLimitDelayMs: opts.rateLimitDelayMs,
    persist: true,
  });
  log.info("v2.1 baseline persisted", { macro_f1: report.macro_f1, ece: report.ece });
  return report;
}
