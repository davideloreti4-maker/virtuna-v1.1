import type { BenchmarkRetrievalResult } from "./types";

/**
 * Synthesized empty BenchmarkRetrievalResult — Phase 1 D-09/D-10 single swap point.
 * Aggregator's null-safe path (aggregator.ts:890) treats score as 0; the 0.05
 * retrieval weight redistributes across other stages without aggregator edits.
 * M2 corpus milestone restores by swapping this call for runBenchmarkRetrieval().
 */
export function createEmptyRetrievalResult(): BenchmarkRetrievalResult {
  return {
    evidence: [],
    score: null,
    availability: false,
    cost_cents: 0,
  };
}
