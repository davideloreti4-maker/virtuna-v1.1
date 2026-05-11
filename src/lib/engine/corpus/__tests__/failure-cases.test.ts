import { describe, it, expect } from "vitest";
import type { RawEvalResult } from "../eval-runner";
import { top10Mispredictions } from "../failure-cases";

function makeRow(
  id: string,
  actual: "viral" | "average" | "under",
  predicted: "viral" | "average" | "under" | null,
  predictedScore = 50,
): RawEvalResult {
  return {
    corpus_row_id: id,
    niche: "beauty" as const,
    actual_bucket: actual,
    predicted_overall_score: predicted !== null ? predictedScore : null,
    predicted_bucket: predicted,
    signalScores: { behavioral: 50, gemini: 50, ml: 50, rules: 50, trends: 50 },
    pipelineTimings: [],
    cost_cents: 5,
    actual_views: 100000,
    actual_likes: 5000,
    actual_comments: 500,
    actual_shares: 100,
    actual_saves: 50,
    warnings: [],
    error: null,
  };
}

describe("top10Mispredictions", () => {
  it("returns empty array for empty input", () => {
    expect(top10Mispredictions([])).toEqual([]);
  });

  it("returns empty array when all predictions are correct", () => {
    const rows = [
      makeRow("r1", "viral", "viral"),
      makeRow("r2", "average", "average"),
      makeRow("r3", "under", "under"),
    ];
    expect(top10Mispredictions(rows)).toEqual([]);
  });

  it("returns empty array when all predicted_bucket are null", () => {
    const rows = [
      makeRow("r1", "viral", null),
      makeRow("r2", "average", null),
    ];
    expect(top10Mispredictions(rows)).toEqual([]);
  });

  it("orders viral<->under (severity 2) before other mispredictions (severity 1)", () => {
    const rows = [
      // 5 viral<->avg (severity 1)
      makeRow("a1", "viral", "average"),
      makeRow("a2", "viral", "average"),
      makeRow("a3", "viral", "average"),
      makeRow("a4", "viral", "average"),
      makeRow("a5", "viral", "average"),
      // 2 viral<->under (severity 2) — should come first
      makeRow("b1", "viral", "under"),
      makeRow("b2", "under", "viral"),
      // 3 correct
      makeRow("c1", "viral", "viral"),
      makeRow("c2", "average", "average"),
      makeRow("c3", "under", "under"),
      // 2 null predicted (no severity)
      makeRow("d1", "viral", null),
      makeRow("d2", "under", null),
    ];

    const result = top10Mispredictions(rows);
    // Total mispredictions: 7 (2 severity-2 + 5 severity-1)
    expect(result).toHaveLength(7);
    // First two must be severity 2 (viral<->under)
    expect(result[0]!.severity).toBe(2);
    expect(result[1]!.severity).toBe(2);
    // Remaining must be severity 1
    for (let i = 2; i < result.length; i++) {
      expect(result[i]!.severity).toBe(1);
    }
  });

  it("returns at most 10 even when there are more mispredictions", () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      makeRow(`r${i}`, "viral", "under"),
    );
    const result = top10Mispredictions(rows);
    expect(result.length).toBeLessThanOrEqual(10);
    expect(result).toHaveLength(10);
  });

  it("includes correct fields in each CuratedFailureCase", () => {
    const rows = [makeRow("r1", "viral", "under", 15)];
    rows[0]!.warnings = ["warn1", "warn2", "warn3", "warn4"]; // 4 warnings; only first 3 should appear
    const result = top10Mispredictions(rows);
    expect(result).toHaveLength(1);
    const entry = result[0]!;
    expect(entry.corpus_row_id).toBe("r1");
    expect(entry.actual_bucket).toBe("viral");
    expect(entry.predicted_bucket).toBe("under");
    expect(entry.predicted_score).toBe(15);
    expect(entry.severity).toBe(2);
    expect(entry.top_warnings).toHaveLength(3);
    expect(entry.top_warnings[0]).toBe("warn1");
  });

  it("avg<->under counts as severity 1", () => {
    const rows = [makeRow("r1", "average", "under")];
    const result = top10Mispredictions(rows);
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe(1);
  });
});
