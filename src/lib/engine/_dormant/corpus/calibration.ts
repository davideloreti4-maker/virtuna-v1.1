/**
 * Calibration math for empirical threshold derivation (D-09).
 *
 * Pure-function module — no file I/O, no process.exit. Importable in both
 * scripts and tests without side effects.
 *
 * Usage flow (scripts/calibrate-thresholds.ts):
 *   1. Read raw JSONL cache via readRawCache()
 *   2. Group rows by niche
 *   3. Call computeNicheStats() per niche
 *   4. Call buildSanityWarnings() to flag noisy or too-tight distributions
 *   5. Call formatThresholdCodeBlock() to produce the TypeScript snippet to paste
 */

import type { Niche } from "./eval-config";
import { NICHES } from "./eval-config";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NicheStats {
  niche: Niche;
  rowCount: number;
  p10: number;
  p30: number;
  p50: number;
  p70: number;
  p90: number;
  proposedViralFloor: number;  // = p{pViralPercentile}
  proposedUnderCeiling: number; // = p{pUnderPercentile}
}

export interface SanityWarning {
  niche: Niche;
  level: "warn" | "error";
  message: string;
}

export interface CalibrationResult {
  stats: NicheStats[];
  warnings: SanityWarning[];
  /** True if any niche had a fatal error (empty or NaN views). */
  hasErrors: boolean;
}

// ─── Percentile computation ───────────────────────────────────────────────────

/**
 * Compute the p-th percentile (0–100) of a sorted array using linear interpolation.
 * Input array MUST be sorted ascending.
 *
 * Returns NaN for empty arrays.
 */
export function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return NaN;
  if (sortedValues.length === 1) return sortedValues[0]!;
  const rank = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  const fraction = rank - lower;
  const lv = sortedValues[lower] ?? 0;
  const uv = sortedValues[upper] ?? 0;
  return lv + fraction * (uv - lv);
}

// ─── Per-niche stats ──────────────────────────────────────────────────────────

/**
 * Compute stats for a single niche from its view count array.
 *
 * @param niche - niche label
 * @param viewCounts - all views values for that niche (unsorted OK)
 * @param pViralPercentile - percentile to use as viralFloor (default 90)
 * @param pUnderPercentile - percentile to use as underCeiling (default 30)
 */
export function computeNicheStats(
  niche: Niche,
  viewCounts: number[],
  pViralPercentile: number = 90,
  pUnderPercentile: number = 30
): NicheStats {
  const sorted = [...viewCounts].sort((a, b) => a - b);
  return {
    niche,
    rowCount: sorted.length,
    p10: percentile(sorted, 10),
    p30: percentile(sorted, 30),
    p50: percentile(sorted, 50),
    p70: percentile(sorted, 70),
    p90: percentile(sorted, 90),
    proposedViralFloor: Math.round(percentile(sorted, pViralPercentile)),
    proposedUnderCeiling: Math.round(percentile(sorted, pUnderPercentile)),
  };
}

// ─── Sanity checks ────────────────────────────────────────────────────────────

const MIN_ROWS_FOR_RELIABLE_ESTIMATE = 100;
const MIN_SEPARATION_RATIO = 3;

/**
 * Run sanity checks on per-niche stats and return warnings/errors.
 *
 * Checks:
 * 1. row_count < 100 → warn (P estimates may be noisy)
 * 2. viralFloor <= underCeiling * 3 → warn (bucket separation unusually tight)
 * 3. all-zero or NaN → error
 */
export function buildSanityWarnings(stats: NicheStats[]): SanityWarning[] {
  const warnings: SanityWarning[] = [];

  for (const s of stats) {
    if (s.rowCount === 0 || isNaN(s.p90) || isNaN(s.p30)) {
      warnings.push({
        niche: s.niche,
        level: "error",
        message: `Niche "${s.niche}" has ${s.rowCount} rows — cannot compute percentiles. Check if the cache file contains data for this niche.`,
      });
      continue;
    }

    if (s.rowCount < MIN_ROWS_FOR_RELIABLE_ESTIMATE) {
      warnings.push({
        niche: s.niche,
        level: "warn",
        message: `Niche "${s.niche}" has only ${s.rowCount} rows. P-estimates may be noisy; consider scraping more data before sealing thresholds.`,
      });
    }

    if (s.proposedViralFloor <= s.proposedUnderCeiling * MIN_SEPARATION_RATIO) {
      warnings.push({
        niche: s.niche,
        level: "warn",
        message: `Niche "${s.niche}" bucket separation is unusually tight: viralFloor=${s.proposedViralFloor} is not > ${MIN_SEPARATION_RATIO}× underCeiling=${s.proposedUnderCeiling}. Review view distribution before sealing.`,
      });
    }
  }

  return warnings;
}

// ─── Code block formatter ─────────────────────────────────────────────────────

/**
 * Format a number with underscore separators for TypeScript readability.
 * e.g. 250000 → "250_000"
 */
export function formatNumber(n: number): string {
  if (!isFinite(n) || isNaN(n)) return "0";
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "_");
}

// Internal alias for use in formatThresholdCodeBlock
const formatNumberWithUnderscores = formatNumber;

/**
 * Generate the TypeScript code block to paste into THRESHOLD_SNAPSHOTS.
 *
 * Outputs a block like:
 * ```typescript
 * // Empirically calibrated from <version> distributions (D-09).
 * // See scripts/calibrate-thresholds.ts — run date <today>
 * // Per D-13 these values are IMMUTABLE once committed.
 * "<version>": {
 *   beauty:    { viralFloor: 250_000, underCeiling: 5_000 },
 *   ...
 * },
 * ```
 */
export function formatThresholdCodeBlock(
  version: string,
  stats: NicheStats[],
  runDate: string = new Date().toISOString().split("T")[0] ?? ""
): string {
  const niches = NICHES as readonly Niche[];
  const statsByNiche = new Map(stats.map((s) => [s.niche, s]));

  const entries = niches.map((n) => {
    const s = statsByNiche.get(n);
    if (!s) {
      return `  ${n.padEnd(9)}: { viralFloor: 0, underCeiling: 0 }, // MISSING — no data for this niche`;
    }
    const vf = formatNumberWithUnderscores(s.proposedViralFloor);
    const uc = formatNumberWithUnderscores(s.proposedUnderCeiling);
    return `  ${n.padEnd(9)}: { viralFloor: ${vf}, underCeiling: ${uc} },`;
  });

  return [
    `  // ──────────────────────────────────────────────────────────────────────`,
    `  // Empirically calibrated from ${version} raw scrape distributions (D-09).`,
    `  // Generated by scripts/calibrate-thresholds.ts on ${runDate}.`,
    `  // See .planning/cache/raw-${version}.jsonl for source data.`,
    `  // Sealed per D-13 — IMMUTABLE once committed to thresholds.ts.`,
    `  // ──────────────────────────────────────────────────────────────────────`,
    `  "${version}": {`,
    ...entries,
    `  },`,
  ].join("\n");
}

// ─── Full calibration pipeline ────────────────────────────────────────────────

/**
 * Run full calibration from a view-count map (niche → views[]).
 * Returns stats + warnings + error flag.
 */
export function calibrate(
  viewsByNiche: Partial<Record<Niche, number[]>>,
  pViralPercentile: number = 90,
  pUnderPercentile: number = 30
): CalibrationResult {
  const stats: NicheStats[] = [];

  for (const niche of NICHES) {
    const views = viewsByNiche[niche] ?? [];
    stats.push(computeNicheStats(niche, views, pViralPercentile, pUnderPercentile));
  }

  const warnings = buildSanityWarnings(stats);
  const hasErrors = warnings.some((w) => w.level === "error");

  return { stats, warnings, hasErrors };
}
