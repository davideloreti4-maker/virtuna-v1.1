/**
 * outlier-receipt.ts — the number a creator actually SEES on an outlier tile.
 *
 * `outlier-compute.ts` ranks a pull by `views ÷ median(views of the RETURNED set)`. That is a
 * fine SELECTION signal and a broken RECEIPT: the denominator is a property of the request, so
 * the same video printed 12.1× at `resultsPerPage` 20 and 1.3× at 10 (measured 2026-08-11 on a
 * live "startup founder" pull). A receipt whose value depends on a request parameter is not a
 * receipt. `grounding/outlier-gate.ts` already draws this exact line for the corpus; this module
 * draws it for Discover and Explore.
 *
 * What survives: `rankKey`, and therefore the order and the audience-fit math in
 * `explore-rank.ts` (whose `tileTempDemand` reads the within-set multiplier as a reach proxy).
 * What is REPLACED: `multiplier` + `baselineLabel`, which become the per-author receipt — or
 * null, when no honest denominator exists for that row.
 *
 * ⚠️ The replacement is why the return type is `Omit<T, …> &` rather than an extra field. A tile
 * carrying both numbers is a renderer one autocomplete away from printing the wrong one.
 *
 * BASIS BY MODE (owner ruling 2026-08-11, on measurements in
 * scripts/probe-author-baseline-coverage.ts):
 *   · profile → own-median-views, "vs their usual views". A profile pull holds many posts by
 *     the same creator, so their own median is real. Grouped BY AUTHOR, because explore's CR-02
 *     `mergeInputs` competitors pull is also mode:"profile" but spans several handles.
 *   · niche → followers, "vs followers". A niche pull returned 18 distinct authors across 20
 *     posts, 16 with a single post each — a one-post median is the post itself (1.0× for
 *     everyone), and the lifetime-avg-likes basis measured 0.0× on a 32k-view video. Follower
 *     count is the only denominator in the payload that is both present (20/20) and honest.
 *
 * Everything here is pure arithmetic — no network, no Supabase, no clock.
 */
import {
  computeAuthorBaseline,
  followerBaseline,
  multiplierFor,
  type AuthorBaseline,
} from "@/lib/discover/author-baseline";
import type { OutlierMode, RankedOutlier } from "@/lib/discover/outlier-compute";

/**
 * Fewest own posts before a median means anything. At n=1 the median IS the post being
 * measured, so every tile prints exactly 1.0×; at n=2 it is the midpoint of a pair. Below this
 * the honest output is no badge at all.
 */
export const MIN_OWN_POSTS = 3;

/**
 * A tile whose multiplier is the durable per-author receipt. Both fields are nullable: a row
 * with no author aggregates, or a creator with no usable denominator, gets NO number — never a
 * fabricated one, and never a bare figure without its basis (D-05).
 */
export type ReceiptedOutlier<T extends RankedOutlier = RankedOutlier> = Omit<
  T,
  "multiplier" | "baselineLabel"
> & {
  multiplier: number | null;
  baselineLabel: string | null;
};

/**
 * Replace each tile's within-set multiplier with the per-author receipt.
 *
 * Generic over the tile type so it composes after `rankWithAudienceFit` — Explore ranks, then
 * fits, then receipts, which keeps the fit estimate reading the selection signal it was
 * calibrated against while the badge shows the durable number.
 *
 * Order is preserved exactly; this annotates, it never re-ranks.
 */
export function attachOutlierReceipt<T extends RankedOutlier>(
  tiles: T[],
  mode: OutlierMode,
): ReceiptedOutlier<T>[] {
  // Profile mode needs every post a creator contributed to THIS set before it can take their
  // median, so the grouping pass has to finish before any tile is resolved.
  const ownViewsByAuthor = new Map<string, number[]>();
  if (mode === "profile") {
    for (const t of tiles) {
      const handle = t.author?.handle;
      if (!handle) continue;
      const views = ownViewsByAuthor.get(handle) ?? [];
      views.push(t.views);
      ownViewsByAuthor.set(handle, views);
    }
  }

  return tiles.map((tile) => {
    const { multiplier: _selection, baselineLabel: _setLabel, ...rest } = tile;
    const baseline = baselineForTile(tile, mode, ownViewsByAuthor);
    return {
      ...rest,
      multiplier: baseline ? multiplierFor(tile, baseline) : null,
      baselineLabel: baseline?.label ?? null,
    } as ReceiptedOutlier<T>;
  });
}

function baselineForTile(
  tile: RankedOutlier,
  mode: OutlierMode,
  ownViewsByAuthor: Map<string, number[]>,
): AuthorBaseline | null {
  const author = tile.author;
  if (!author) return null;

  if (mode === "niche") return followerBaseline(author.fans);

  const ownViews = ownViewsByAuthor.get(author.handle) ?? [];
  if (ownViews.length < MIN_OWN_POSTS) return null;

  // Pass ONLY the own-posts array: computeAuthorBaseline falls back to lifetime-avg-likes when
  // the median is unusable, and that basis measured 0.0× on a real 32k-view post. A profile
  // tile with no usable median gets no badge instead.
  const baseline = computeAuthorBaseline(author, ownViews);
  return baseline?.basis === "own-median-views" ? baseline : null;
}
