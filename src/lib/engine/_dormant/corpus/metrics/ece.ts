/**
 * Expected Calibration Error (ECE) — generic metric for measuring how well
 * predicted scores correlate with actual outcomes.
 *
 * Relocated 2026-05-24 from src/lib/engine/calibration.ts when the Platt
 * calibration apparatus was dropped (see .planning/phases/15-.../15-DISCUSSION-LOG.md).
 * The metric itself is provider-agnostic — useful for evaluating any model that
 * emits 0-1 scores against binary outcomes.
 */

export interface CalibrationBin {
  binStart: number;
  binEnd: number;
  avgPredicted: number;
  avgActual: number;
  count: number;
  gap: number;
}

/** Pair of predicted vs actual scores, both normalized to 0-1. */
export interface OutcomePair {
  predicted: number;
  actual: number;
}

/**
 * Pure function: compute ECE from predicted vs actual pairs.
 *
 * ECE = sum( |bin_count / total| * |avg_predicted - avg_actual| ) for each bin.
 * Bins predicted scores into `numBins` equal-width bins from 0 to 1.
 * Empty pairs returns ECE=0 with empty bins.
 * Bins with 0 samples get gap=0.
 */
export function computeECE(
  pairs: OutcomePair[],
  numBins = 10,
): { ece: number; bins: CalibrationBin[] } {
  if (pairs.length === 0) {
    return { ece: 0, bins: [] };
  }

  const binWidth = 1 / numBins;
  const total = pairs.length;

  const bins: CalibrationBin[] = Array.from({ length: numBins }, (_, i) => ({
    binStart: Math.round(i * binWidth * 1000) / 1000,
    binEnd: Math.round((i + 1) * binWidth * 1000) / 1000,
    avgPredicted: 0,
    avgActual: 0,
    count: 0,
    gap: 0,
  }));

  const sumPredicted = new Array(numBins).fill(0);
  const sumActual = new Array(numBins).fill(0);

  for (const pair of pairs) {
    let binIdx = Math.floor(pair.predicted / binWidth);
    if (binIdx >= numBins) binIdx = numBins - 1;

    const bin = bins[binIdx];
    if (!bin) continue;
    bin.count++;
    sumPredicted[binIdx] = (sumPredicted[binIdx] ?? 0) + pair.predicted;
    sumActual[binIdx] = (sumActual[binIdx] ?? 0) + pair.actual;
  }

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

    ece += (bin.count / total) * bin.gap;
  }

  ece = Math.round(ece * 10000) / 10000;

  return { ece, bins };
}
