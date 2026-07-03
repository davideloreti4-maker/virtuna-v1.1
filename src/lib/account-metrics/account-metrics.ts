/**
 * account-metrics — pure derivation of the /start stat-row tiles from the
 * account_snapshots time-series. No DB, no I/O (the repo owns those) so this is
 * unit-testable and safe to run in a server component.
 *
 * Honesty spine: we ONLY surface what the scrape truthfully gives —
 * cumulative Followers / Likes (heartCount) / Posts (videoCount) counters, plus
 * the weekly follower gain derived from the series. There is NO account-level
 * "Views" counter on a TikTok profile, so the Views tile is NOT a fabricated
 * total: it is the honest SUM of public views across the creator's posts in the
 * trailing window (`recent_views`, captured by the daily cron's video scrape).
 * It is optional — a snapshot without it (calibration capture, a failed video
 * scrape) simply omits the tile. Point-in-time values are real on day one;
 * deltas + sparklines fill in as the daily cron accumulates snapshots — a single
 * snapshot yields real totals with an honest "—" delta and a flat spark, never a
 * made-up trend.
 */

import type { StatCard } from "@/lib/room-contract/mock-room";

/** One row of the account_snapshots series (the fields the tiles read). */
export interface AccountSnapshot {
  snapshot_date: string; // "YYYY-MM-DD"
  follower_count: number;
  heart_count: number;
  video_count: number;
  /**
   * Sum of public views across posts in the trailing window (the daily cron's
   * video scrape). Optional/nullable: NULL = not captured (Views tile omitted),
   * 0 = real no-recent-posts, >0 = real sum. Never fabricated.
   */
  recent_views?: number | null;
}

// ── views aggregation (ingestion-side, used by the daily cron) ──────────────────

/** A scraped post, narrowed to the two fields the views sum needs. */
export interface RecentVideo {
  views: number;
  postedAt: Date;
}

/**
 * Sum public views across posts published within the trailing `windowDays` of `now`.
 * Pure over (videos, windowDays, now) so the cron's ingestion is unit-testable. This
 * is the ONLY honest account-level "Views" figure (TikTok exposes no profile total).
 * A post with an out-of-window / future `postedAt` is excluded; a non-finite view
 * count contributes 0 (never NaN-poisons the sum). Callers treat an EMPTY scrape as
 * "no data" (store NULL), distinct from a real 0 returned here for a genuinely quiet
 * window.
 */
export function sumRecentViews(
  videos: ReadonlyArray<RecentVideo>,
  windowDays: number,
  now: Date,
): number {
  const cutoffMs = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
  return videos.reduce((sum, v) => {
    const t = v.postedAt.getTime();
    if (Number.isNaN(t) || t < cutoffMs || t > now.getTime()) return sum;
    return sum + (Number.isFinite(v.views) ? v.views : 0);
  }, 0);
}

// ── formatting ────────────────────────────────────────────────────────────────

/** 42_100 → "42.1K", 1_240_000 → "1.2M", 1_300_000_000 → "1.3B", 820 → "820". */
export function formatCount(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${trim(n / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (abs >= 1_000) return `${trim(n / 1_000)}K`;
  return `${Math.round(n)}`;
}

/** +820 → "+820", -30 → "-30", 0 → "flat". */
function formatDelta(n: number): string {
  if (n === 0) return "flat";
  const sign = n > 0 ? "+" : "-";
  return `${sign}${formatCount(Math.abs(n))}`;
}

function trim(n: number): string {
  // one decimal, but drop a trailing ".0"
  return (Math.round(n * 10) / 10).toString();
}

// ── sparkline ─────────────────────────────────────────────────────────────────

/**
 * Map a value series to the StatRow sparkline viewBox (0..72 × 0..18), higher
 * value = higher on screen (smaller y). One point → a flat mid-line.
 */
function sparkPoints(series: number[]): string {
  const n = series.length;
  if (n === 0) return "0,9 72,9";
  if (n === 1) return "0,9 72,9";
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  return series
    .map((v, i) => {
      const x = Math.round((i / (n - 1)) * 72);
      const y = Math.round(16 - ((v - min) / range) * 14); // → [2, 16]
      return `${x},${y}`;
    })
    .join(" ");
}

// ── tiles ─────────────────────────────────────────────────────────────────────

/**
 * Build the stat-row tiles from the snapshot series (any order). Returns null
 * when there are NO snapshots yet — the caller renders an honest empty state
 * rather than fabricating numbers.
 */
export function buildAccountStats(snapshots: AccountSnapshot[]): StatCard[] | null {
  if (snapshots.length === 0) return null;

  // oldest → newest
  const series = [...snapshots].sort((a, b) =>
    a.snapshot_date < b.snapshot_date ? -1 : a.snapshot_date > b.snapshot_date ? 1 : 0,
  );
  const latest = series[series.length - 1]!;

  // Baseline = the oldest snapshot within the trailing 7 days (falls back to the
  // oldest we have, so 2 days of data still yields an honest recent delta).
  const cutoff = daysAgo(latest.snapshot_date, 7);
  const windowed = series.filter((s) => s.snapshot_date >= cutoff);
  const baseline = windowed.length >= 2 ? windowed[0]! : null;

  const tile = (
    label: string,
    pick: (s: AccountSnapshot) => number,
  ): StatCard => {
    const value = pick(latest);
    const points = sparkPoints(series.map(pick));
    if (!baseline) {
      // Single point / no trailing baseline — honest: real total, no invented trend.
      return { label, value: formatCount(value), delta: "—", up: false, spark: points };
    }
    const change = value - pick(baseline);
    return { label, value: formatCount(value), delta: formatDelta(change), up: change > 0, spark: points };
  };

  const newFollowers: StatCard = (() => {
    const points = sparkPoints(series.map((s) => s.follower_count));
    if (!baseline) {
      return { label: "New followers", value: "—", delta: "7d", up: false, spark: points };
    }
    const gain = latest.follower_count - baseline.follower_count;
    return {
      label: "New followers",
      value: gain === 0 ? "0" : formatDelta(gain),
      delta: "7d",
      up: gain > 0,
      spark: points,
    };
  })();

  const tiles: StatCard[] = [
    tile("Followers", (s) => s.follower_count),
    newFollowers,
    tile("Likes", (s) => s.heart_count),
    tile("Posts", (s) => s.video_count),
  ];

  // Views (5th) — optional: only when the cron has captured recent_views on at least
  // one snapshot. Real windowed sum, or omit the tile entirely (honesty spine).
  const views = optionalTile("Views", series, (s) => s.recent_views);
  if (views) tiles.push(views);

  return tiles;
}

/**
 * Build one tile from a metric that may be ABSENT on some snapshots (e.g. recent_views,
 * which only lands once the daily cron has scraped videos). Filters to the snapshots
 * that carry it, then applies the same latest/baseline/spark logic as the core tiles.
 * Returns null when NO snapshot carries the metric → the caller omits the tile (honest).
 */
function optionalTile(
  label: string,
  series: AccountSnapshot[], // full series, oldest → newest
  pick: (s: AccountSnapshot) => number | null | undefined,
): StatCard | null {
  const present = series.filter((s) => pick(s) != null);
  if (present.length === 0) return null;

  const vals = present.map((s) => pick(s) as number);
  const latestVal = vals[vals.length - 1]!;
  const points = sparkPoints(vals);

  // Baseline = the oldest carrying snapshot within the trailing 7 days of the latest
  // carrying one (mirrors the core tile()). <2 points → honest "—", no invented trend.
  const latestDate = present[present.length - 1]!.snapshot_date;
  const cutoff = daysAgo(latestDate, 7);
  const windowed = present.filter((s) => s.snapshot_date >= cutoff);
  if (windowed.length < 2) {
    return { label, value: formatCount(latestVal), delta: "—", up: false, spark: points };
  }
  const change = latestVal - (pick(windowed[0]!) as number);
  return { label, value: formatCount(latestVal), delta: formatDelta(change), up: change > 0, spark: points };
}

/** "YYYY-MM-DD" minus n days, as "YYYY-MM-DD" (UTC, string-comparable). */
function daysAgo(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
