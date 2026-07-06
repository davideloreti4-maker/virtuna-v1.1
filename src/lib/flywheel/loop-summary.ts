/**
 * loop-summary — the /start "the loop" feed derivation (FLYWHEEL, receipt UI).
 *
 * Pure, deterministic. Turns the user's recent `reconciliations` rows into honest receipts
 * (predicted-vs-actual match % + a plain standout + a "when" label) and an aggregate accuracy,
 * reusing `buildOutcomeReadout` so a receipt and the inline capture readout speak the same
 * language. `nowMs` is passed in (computed server-side) so this stays testable AND the "when"
 * label is stamped at SSR — never a client `new Date()` (hydration).
 */

import { buildOutcomeReadout } from "./outcome-readout";
import type { LoopRow, Reconciliation } from "./reconciliation-repo";
import type { RawMetrics } from "./outcome-repo";

/** One real public number ("12.4K" / "views") — the "actual" proof beside the match %. */
export interface ReceiptMetric {
  value: string;
  label: string;
}

export interface LoopReceipt {
  id: string;
  /** 0..100 match, or null when public metrics were too thin to compare (honest). */
  matchPct: number | null;
  /** Plain-language standout ("Your savers showed up stronger…"), or null. */
  headline: string | null;
  /** Pre-formatted relative label ("today" · "yesterday" · "3d ago" · "2w ago"). */
  whenLabel: string;
  /** Real public numbers (views-first, ≤ 2, non-null only). Empty when none were captured. */
  metrics: ReceiptMetric[];
  /** The actual post's URL, or null — the receipt links out to the real thing when present. */
  link: string | null;
}

export interface LoopAccuracy {
  /** Average match % across the measured posts (rows with a comparable match). */
  pct: number;
  /** How many measured posts feed the average. */
  n: number;
  /** Trend vs the older half, in points (+improving); null when < 4 measured posts. */
  trendPts: number | null;
}

const DAY = 86_400_000;

/** SSR clock read, isolated in a lib so the server component render stays "pure" (react-hooks/
 *  purity), mirroring `currentMonth()`. Pass the result into buildLoopReceipts for the when-labels. */
export function nowMs(): number {
  return Date.now();
}

/** A short relative label from an ISO timestamp vs a reference time (SSR-stamped). */
export function relativeWhen(iso: string, nowMs: number): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "recently";
  const days = Math.floor((nowMs - t) / DAY);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

/** Compact a count for a glanceable receipt: 940 · 12.4K · 1.2M · 63.9M (no trailing .0). */
export function compactCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  const trim = (x: number): string => {
    const s = x.toFixed(1);
    return s.endsWith(".0") ? s.slice(0, -2) : s;
  };
  if (n >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (n >= 1_000) return `${trim(n / 1_000)}K`;
  return String(Math.round(n));
}

/** Priority order for the ≤2 receipt numbers: reach first, then the strongest engagement signal. */
const METRIC_ORDER: ReadonlyArray<{ key: keyof RawMetrics; label: string }> = [
  { key: "views", label: "views" },
  { key: "saves", label: "saves" },
  { key: "likes", label: "likes" },
  { key: "shares", label: "shares" },
  { key: "comments", label: "comments" },
];

/**
 * Pick the ≤2 most meaningful REAL public numbers off a raw-metrics blob — views first (reach),
 * then the strongest available engagement signal. Only present, finite, non-negative counts show
 * (never a fabricated or null number). Empty array when nothing was captured (honest).
 */
export function buildReceiptMetrics(raw: RawMetrics | null | undefined): ReceiptMetric[] {
  if (!raw) return [];
  const out: ReceiptMetric[] = [];
  for (const { key, label } of METRIC_ORDER) {
    const v = raw[key];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      out.push({ value: compactCount(v), label });
      if (out.length === 2) break;
    }
  }
  return out;
}

/** Map recent reconciliation rows → honest receipts (newest first, as read). */
export function buildLoopReceipts(rows: LoopRow[], nowMs: number): LoopReceipt[] {
  return rows.map((r) => {
    const readout = buildOutcomeReadout(r.predicted_vector, r.realized_vector);
    return {
      id: r.id,
      matchPct: readout.matchPct,
      headline: readout.headline,
      whenLabel: relativeWhen(r.created_at, nowMs),
      metrics: buildReceiptMetrics(r.outcome?.raw_metrics),
      link: r.outcome?.platform_post_url ?? null,
    };
  });
}

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Aggregate accuracy across the measured posts, or null when nothing is comparable yet. */
export function buildLoopAccuracy(rows: Reconciliation[]): LoopAccuracy | null {
  // Order preserved (rows are newest-first) → the split below is recent-vs-older.
  const matches = rows
    .map((r) => buildOutcomeReadout(r.predicted_vector, r.realized_vector).matchPct)
    .filter((m): m is number => m != null);

  if (matches.length === 0) return null;

  const pct = Math.round(mean(matches));
  let trendPts: number | null = null;
  if (matches.length >= 4) {
    const half = Math.floor(matches.length / 2);
    const recent = matches.slice(0, half); // newest
    const older = matches.slice(matches.length - half); // oldest
    trendPts = Math.round(mean(recent) - mean(older));
  }

  return { pct, n: matches.length, trendPts };
}
