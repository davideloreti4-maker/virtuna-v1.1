import { createServiceClient } from "@/lib/supabase/service";
import { createCache } from "@/lib/cache";

// =====================================================
// Types
// =====================================================

export interface PlattParameters {
  a: number;
  b: number;
  fittedAt: string;
  sampleCount: number;
}

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

// =====================================================
// Platt Scaling — Logistic Regression Recalibration
// =====================================================

const PLATT_MIN_SAMPLES = 50;
const PLATT_LEARNING_RATE = 0.01;
const PLATT_ITERATIONS = 1000;
const PLATT_EPSILON = 1e-7;

/**
 * Pure function: fit Platt scaling parameters (A, B) from outcome pairs
 * using gradient descent on cross-entropy loss.
 *
 * Logistic model: calibrated = 1 / (1 + exp(A * predicted + B))
 *
 * Returns null if fewer than 50 samples — insufficient data to fit reliably.
 * A should converge to a negative value for well-calibrated models.
 */
export function fitPlattScaling(
  pairs: OutcomePair[]
): PlattParameters | null {
  if (pairs.length < PLATT_MIN_SAMPLES) {
    return null;
  }

  let a = -1; // Reasonable default for score recalibration
  let b = 0;

  for (let iter = 0; iter < PLATT_ITERATIONS; iter++) {
    let gradA = 0;
    let gradB = 0;

    for (const pair of pairs) {
      // Sigmoid: sigma = 1 / (1 + exp(A * predicted + B))
      const logit = a * pair.predicted + b;
      let sigma = 1 / (1 + Math.exp(logit));

      // Clip to avoid log(0)
      sigma = Math.max(PLATT_EPSILON, Math.min(1 - PLATT_EPSILON, sigma));

      // Gradient of cross-entropy loss w.r.t. A and B
      // Loss = -sum(actual * log(sigma) + (1-actual) * log(1-sigma))
      // dL/dA = sum((sigma - actual) * predicted)
      // dL/dB = sum(sigma - actual)
      const diff = sigma - pair.actual;
      gradA += diff * pair.predicted;
      gradB += diff;
    }

    // Average gradients over sample count for stability
    gradA /= pairs.length;
    gradB /= pairs.length;

    // Update parameters
    a -= PLATT_LEARNING_RATE * gradA;
    b -= PLATT_LEARNING_RATE * gradB;
  }

  return {
    a,
    b,
    fittedAt: new Date().toISOString(),
    sampleCount: pairs.length,
  };
}

/**
 * Pure function: apply Platt scaling to a raw 0-100 score.
 *
 * If params is null (insufficient data), returns rawScore unchanged (identity).
 * Otherwise: normalize to 0-1, apply sigmoid(A * x + B), scale back to 0-100.
 */
export function applyPlattScaling(
  rawScore: number,
  params: PlattParameters | null
): number {
  if (params === null) {
    return rawScore;
  }

  // Normalize from 0-100 to 0-1
  const normalized = rawScore / 100;

  // Apply Platt sigmoid: calibrated = 1 / (1 + exp(A * normalized + B))
  const calibrated = 1 / (1 + Math.exp(params.a * normalized + params.b));

  // Scale back to 0-100, clamp, and round
  const scaled = calibrated * 100;
  const clamped = Math.max(0, Math.min(100, scaled));
  return Math.round(clamped * 100) / 100;
}

// =====================================================
// Cached Platt Parameters
// =====================================================

/**
 * Wrapper to distinguish "not in cache" (null) from "cached null result"
 * (insufficient data). Without this, a null PlattParameters would cause
 * cache.get() to return null, which looks like a miss, triggering re-fetch
 * on every call.
 */
interface PlattCacheEntry {
  params: PlattParameters | null;
}

/** 24-hour TTL cache for fitted Platt parameters */
const plattCache = createCache<PlattCacheEntry>(24 * 60 * 60 * 1000);

const PLATT_CACHE_KEY = "platt-params";

/**
 * Get cached Platt scaling parameters.
 *
 * On cache miss: fetches outcome pairs from Supabase, fits Platt scaling,
 * caches result (24hr TTL), and returns parameters.
 *
 * Returns null if insufficient data (<50 outcomes) — callers should
 * use raw scores unchanged.
 */
export async function getPlattParameters(): Promise<PlattParameters | null> {
  const cached = plattCache.get(PLATT_CACHE_KEY);
  if (cached !== null) {
    return cached.params;
  }

  const supabase = createServiceClient();
  const pairs = await fetchOutcomePairs(supabase);
  const params = fitPlattScaling(pairs);

  plattCache.set(PLATT_CACHE_KEY, { params });
  return params;
}
