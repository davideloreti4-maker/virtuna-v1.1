/**
 * author-baseline.ts — the DENOMINATOR for an outlier multiplier.
 *
 * ⚠️ Replaces the defect in `outlier-compute.ts`, where `baseline = median(views of the RETURNED
 * set)` made the multiplier a WITHIN-SET statistic: measured 2026-08-10, one real video printed
 * 1.4× at resultsPerPage 3 and 28.4× at 20. A receipt whose value depends on a request parameter
 * is not a receipt. The denominator here is per-AUTHOR and cannot move with scrape size.
 *
 * THREE BASES, deliberately not interchangeable (honesty spine, ui-skill-cards.md §0.5b):
 *   · own-median-views  — median views of that creator's OWN posts. The corpus's basis. Needs
 *     several of their posts in hand, so it belongs to a PROFILE pull.
 *   · followers         — views ÷ follower count. The durable receipt already locked in
 *     `grounding/outlier-gate.ts` (§12/§14). Wholly independent of the returned set, and the
 *     only basis a NICHE pull can honestly carry (see the measurement note below).
 *   · lifetime-avg-likes — likes ÷ (heart/videoCount). Free, but ⚠️ MEASURED UNRELIABLE
 *     2026-08-11: `heart` is lifetime likes across every post EVER, while `videoCount` counts
 *     only currently-public posts, so the two do not divide. A real creator returned
 *     heart 585k ÷ videoCount 2 = 292k "average likes" on a post with 1k likes → 0.0×. Do not
 *     put this basis on a badge. It survives only as a last-resort internal signal.
 *
 * ⚠️ Why a niche pull cannot use own-median-views (measured 2026-08-11, 20 real posts for
 * "startup founder"): the set held 18 distinct authors, 16 of whom contributed exactly ONE
 * post. A one-post median IS the post being measured, so every such tile prints 1.0×. The
 * per-author denominator is only meaningful when the author has several posts in the set.
 */

export type BaselineBasis = "own-median-views" | "followers" | "lifetime-avg-likes";

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

/**
 * views ÷ follower count — the durable receipt metric locked in `grounding/outlier-gate.ts`.
 *
 * `outlier-gate.ts`'s header says this is "computable only after a per-survivor profile scrape
 * (§14: follower_count is not inline on a niche/search pull, and VideoData carries none)". That
 * stopped being true when Phase 1 added `VideoData.author.fans` — measured 2026-08-11 at 20/20
 * coverage on a live niche pull. It now costs nothing.
 *
 * Returns null on a missing/zero/non-finite follower count — a brand-new account gets NO badge
 * rather than a division by nothing.
 */
export function followerBaseline(fans: number | null | undefined): AuthorBaseline | null {
  if (!fans || !Number.isFinite(fans) || fans <= 0) return null;
  return { basis: "followers", value: fans, label: "vs followers" };
}

export function multiplierFor(
  video: { views: number; likes: number },
  baseline: AuthorBaseline,
): number {
  if (baseline.value <= 0) return 0;
  // LIKES only on the likes basis. Both view-denominated bases take views — a `followers`
  // baseline reading `likes` would silently print an engagement rate under a reach label.
  const numerator = baseline.basis === "lifetime-avg-likes" ? video.likes : video.views;
  return numerator / baseline.value;
}

export function formatMultiplier(m: number): string {
  return m > PRINTABLE_MAX ? `${PRINTABLE_MAX}×+` : `${m.toFixed(1)}×`;
}
