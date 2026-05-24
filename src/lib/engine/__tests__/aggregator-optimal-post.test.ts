/**
 * Stub test file for the aggregator's optimal_post_window plug-in
 * (R6.1, D-13, D-15 — Plan 01-05).
 *
 * Plan 01-01 ships placeholders; Plan 01-05 fills assertions.
 */
import { describe, it } from "vitest";

describe("aggregateScores — optimal_post_window", () => {
  it.todo("aggregateScores populates result.optimal_post_window for known niche");
  it.todo("aggregateScores sets result.optimal_post_window = FALLBACK when niche unknown");
  it.todo("aggregateScores sets result.optimal_post_window = null when computeOptimalPostWindow throws (non-fatal per D-15)");
  it.todo("optimal_post_window inserted into result BEFORE Stage 10/11 run (Pitfall #5 ordering)");
});
