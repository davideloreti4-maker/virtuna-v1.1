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
import type { Reconciliation } from "./reconciliation-repo";

export interface LoopReceipt {
  id: string;
  /** 0..100 match, or null when public metrics were too thin to compare (honest). */
  matchPct: number | null;
  /** Plain-language standout ("Your savers showed up stronger…"), or null. */
  headline: string | null;
  /** Pre-formatted relative label ("today" · "yesterday" · "3d ago" · "2w ago"). */
  whenLabel: string;
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

/** Map recent reconciliation rows → honest receipts (newest first, as read). */
export function buildLoopReceipts(rows: Reconciliation[], nowMs: number): LoopReceipt[] {
  return rows.map((r) => {
    const readout = buildOutcomeReadout(r.predicted_vector, r.realized_vector);
    return {
      id: r.id,
      matchPct: readout.matchPct,
      headline: readout.headline,
      whenLabel: relativeWhen(r.created_at, nowMs),
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
