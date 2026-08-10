/**
 * author-baseline.ts — the DENOMINATOR for an outlier multiplier.
 *
 * ⚠️ Replaces the defect in `outlier-compute.ts`, where `baseline = median(views of the RETURNED
 * set)` made the multiplier a WITHIN-SET statistic: measured 2026-08-10, one real video printed
 * 1.4× at resultsPerPage 3 and 28.4× at 20. A receipt whose value depends on a request parameter
 * is not a receipt. The denominator here is per-AUTHOR and cannot move with scrape size.
 *
 * TWO BASES, deliberately not interchangeable (honesty spine, ui-skill-cards.md §0.5b):
 *   · own-median-views  — median views of that creator's OWN posts. The corpus's basis.
 *   · lifetime-avg-likes — likes ÷ (heart/videoCount). Free (authorMeta is on every scraped row),
 *     stable, but a LIFETIME AVERAGE of LIKES, so a creator who improved is flattered by their own
 *     weak back catalogue. It must never wear the views label.
 */

export type BaselineBasis = "own-median-views" | "lifetime-avg-likes";

export interface AuthorBaseline {
  basis: BaselineBasis;
  value: number;
  /** The creator-facing basis label. Never render a multiplier without it. */
  label: string;
}

/** Ceiling on a printed multiplier — above this a badge reads as broken (spec D4). */
const PRINTABLE_MAX = 50;

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function computeAuthorBaseline(
  author: { heart: number; videoCount: number },
  ownPostViews?: number[],
): AuthorBaseline | null {
  if (ownPostViews && ownPostViews.length > 0) {
    const value = median(ownPostViews);
    if (value > 0) return { basis: "own-median-views", value, label: "vs their usual views" };
  }
  if (author.videoCount > 0 && author.heart > 0) {
    return {
      basis: "lifetime-avg-likes",
      value: author.heart / author.videoCount,
      label: "vs their lifetime average",
    };
  }
  return null;
}

export function multiplierFor(
  video: { views: number; likes: number },
  baseline: AuthorBaseline,
): number {
  if (baseline.value <= 0) return 0;
  const numerator = baseline.basis === "own-median-views" ? video.views : video.likes;
  return numerator / baseline.value;
}

export function formatMultiplier(m: number): string {
  return m > PRINTABLE_MAX ? `${PRINTABLE_MAX}×+` : `${m.toFixed(1)}×`;
}
