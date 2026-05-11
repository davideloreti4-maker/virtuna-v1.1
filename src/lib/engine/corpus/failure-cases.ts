import type { RawEvalResult } from "./eval-runner";
import type { Bucket } from "./eval-config";

export interface CuratedFailureCase {
  corpus_row_id: string;
  niche: string;
  actual_bucket: Bucket;
  predicted_bucket: Bucket | null;
  predicted_score: number | null;
  severity: number;
  top_warnings: string[];
}

/**
 * Curate the top-10 mispredictions by severity for the failure_cases JSONB column.
 * Severity rubric:
 *   viral<->under (worst): 2
 *   viral<->avg or avg<->under: 1
 *   correct or null: 0
 *
 * Returns max 10 entries; orders by severity desc, then by largest predicted_score desc.
 */
export function top10Mispredictions(results: RawEvalResult[]): CuratedFailureCase[] {
  const severity = (actual: Bucket, predicted: Bucket | null): number => {
    if (predicted === null || actual === predicted) return 0;
    const pair = new Set([actual, predicted]);
    if (pair.has("viral") && pair.has("under")) return 2;
    return 1;
  };

  const candidates = results
    .map((r) => ({
      corpus_row_id: r.corpus_row_id,
      niche: r.niche,
      actual_bucket: r.actual_bucket,
      predicted_bucket: r.predicted_bucket,
      predicted_score: r.predicted_overall_score,
      severity: severity(r.actual_bucket, r.predicted_bucket),
      top_warnings: r.warnings.slice(0, 3),
    }))
    .filter((c) => c.severity > 0);

  candidates.sort((a, b) => {
    if (b.severity !== a.severity) return b.severity - a.severity;
    // Tiebreak: row with no warnings or all-null predicted_score is more interesting
    return (b.predicted_score ?? 50) - (a.predicted_score ?? 50);
  });

  return candidates.slice(0, 10);
}
