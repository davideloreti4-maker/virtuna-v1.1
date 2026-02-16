import { createServiceClient } from "@/lib/supabase/service";

// =====================================================
// Types
// =====================================================

export interface CalibrationBin {
  binStart: number;
  binEnd: number;
  avgPredicted: number;
  avgActual: number;
  count: number;
  gap: number;
}

export interface CalibrationReport {
  ece: number;
  bins: CalibrationBin[];
  totalSamples: number;
  generatedAt: string;
}

/** Internal pair of predicted vs actual scores, normalized to 0-1 */
export interface OutcomePair {
  predicted: number;
  actual: number;
}

// =====================================================
// Fetch Outcome Pairs
// =====================================================

/**
 * Query the outcomes table for predicted vs actual score pairs.
 *
 * Both `predicted_score` and `actual_score` are stored as 0-100 in the DB.
 * We normalize them to 0-1 for ECE computation.
 *
 * Uses the same cast-through-unknown pattern as validate-rules cron
 * because Supabase generated types may not include all v2 columns.
 */
export async function fetchOutcomePairs(
  supabase: ReturnType<typeof createServiceClient>,
  options?: { sinceDays?: number }
): Promise<OutcomePair[]> {
  let query = supabase
    .from("outcomes")
    .select("predicted_score, actual_score")
    .is("deleted_at", null)
    .not("actual_score", "is", null)
    .not("predicted_score", "is", null);

  if (options?.sinceDays) {
    const since = new Date(
      Date.now() - options.sinceDays * 24 * 60 * 60 * 1000
    ).toISOString();
    query = query.gte("created_at", since);
  }

  interface OutcomeRow {
    predicted_score: number;
    actual_score: number;
  }

  const { data, error } = (await query) as unknown as {
    data: OutcomeRow[] | null;
    error: { message: string } | null;
  };

  if (error) {
    console.error("[calibration] Failed to fetch outcome pairs:", error);
    throw new Error(`Failed to fetch outcome pairs: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Normalize 0-100 scores to 0-1 range
  return data.map((row) => ({
    predicted: Math.max(0, Math.min(1, row.predicted_score / 100)),
    actual: Math.max(0, Math.min(1, row.actual_score / 100)),
  }));
}

// =====================================================
// Compute Expected Calibration Error (ECE)
// =====================================================

/**
 * Pure function: compute ECE from predicted vs actual pairs.
 *
 * ECE = sum( |bin_count / total| * |avg_predicted - avg_actual| ) for each bin
 *
 * Bins predicted scores into `numBins` equal-width bins from 0 to 1.
 * Empty pairs returns ECE=0 with empty bins.
 * Bins with 0 samples get gap=0.
 */
export function computeECE(
  pairs: OutcomePair[],
  numBins = 10
): { ece: number; bins: CalibrationBin[] } {
  if (pairs.length === 0) {
    return { ece: 0, bins: [] };
  }

  const binWidth = 1 / numBins;
  const total = pairs.length;

  // Initialize bins
  const bins: CalibrationBin[] = Array.from({ length: numBins }, (_, i) => ({
    binStart: Math.round(i * binWidth * 1000) / 1000,
    binEnd: Math.round((i + 1) * binWidth * 1000) / 1000,
    avgPredicted: 0,
    avgActual: 0,
    count: 0,
    gap: 0,
  }));

  // Accumulators for computing averages
  const sumPredicted = new Array(numBins).fill(0);
  const sumActual = new Array(numBins).fill(0);

  // Assign each pair to a bin based on predicted score
  for (const pair of pairs) {
    // Determine bin index from predicted score
    let binIdx = Math.floor(pair.predicted / binWidth);
    // Clamp: predicted=1.0 falls into the last bin
    if (binIdx >= numBins) binIdx = numBins - 1;

    const bin = bins[binIdx];
    if (!bin) continue; // Safety check for noUncheckedIndexedAccess
    bin.count++;
    sumPredicted[binIdx] = (sumPredicted[binIdx] ?? 0) + pair.predicted;
    sumActual[binIdx] = (sumActual[binIdx] ?? 0) + pair.actual;
  }

  // Compute averages and gaps
  let ece = 0;
  for (let i = 0; i < numBins; i++) {
    const bin = bins[i];
    if (!bin || bin.count === 0) continue;

    const predSum = sumPredicted[i] ?? 0;
    const actSum = sumActual[i] ?? 0;

    bin.avgPredicted = Math.round((predSum / bin.count) * 10000) / 10000;
    bin.avgActual = Math.round((actSum / bin.count) * 10000) / 10000;
    bin.gap =
      Math.round(Math.abs(bin.avgPredicted - bin.avgActual) * 10000) / 10000;

    // Weighted contribution: (bin_count / total) * gap
    ece += (bin.count / total) * bin.gap;
    // Bins with count=0 keep defaults (avgPredicted=0, avgActual=0, gap=0)
  }

  // Round ECE to 4 decimal places
  ece = Math.round(ece * 10000) / 10000;

  return { ece, bins };
}

// =====================================================
// Generate Calibration Report
// =====================================================

/**
 * End-to-end calibration report: fetches outcome pairs from Supabase,
 * computes ECE, and returns a full CalibrationReport.
 *
 * If no outcome pairs found, returns report with ECE=0, empty bins, totalSamples=0.
 */
export async function generateCalibrationReport(
  options?: { sinceDays?: number }
): Promise<CalibrationReport> {
  const supabase = createServiceClient();
  const pairs = await fetchOutcomePairs(supabase, options);
  const { ece, bins } = computeECE(pairs);

  return {
    ece,
    bins,
    totalSamples: pairs.length,
    generatedAt: new Date().toISOString(),
  };
}
