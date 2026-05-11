/**
 * Apify scrape job configs for the training corpus (D-06).
 *
 * Produces 3 scrape configs per niche × 5 niches = 15 jobs per refresh.
 * Pure config builder; no Apify calls in this module. The orchestrator
 * (Plan D) is responsible for actually invoking client.actor().call().
 *
 * ─── MIGRATION: clockworks → apidojo (Block A, 2026-05-11) ──────────────────
 * Switched from the clockworks actor (~$3.70/1K posts) to
 * apidojo/tiktok-scraper (~$0.30/1K posts) — ~12× cheaper.
 *
 * Input shape changes:
 *   - `startUrls: string[]` replaces `hashtags: string[]`
 *     (apidojo expects full TikTok hashtag page URLs)
 *   - `maxItems: number` replaces the old clockworks count-per-page field
 *   - `location: "US"` is required
 *   - Dropped: `newestPostDate`, `oldestPostDate`, `excludePinnedPosts`
 *     (`dateRange` is only available on search-type URLs, not hashtag URLs;
 *      the 7-day age filter is applied client-side in normalize-scrape.ts:190)
 *   - Dropped: `sortType` (search-only; TikTok default ordering applies)
 *
 * Known apidojo asymmetries vs the former clockworks actor (documented for evaluators):
 *   1. `follower_count` is NOT in the per-post payload. `follower_tier` will
 *      be null for all apidojo-scraped rows. (v2.1 eval reads follower data
 *      from `tiktok_creator_profiles`, a separate table — no regression.)
 *   2. `sound_name` is not reliably exposed; always mapped to null.
 *
 * Normalizer: `normalize-scrape.ts:170-217` handles the apidojo output shape.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * NOTE: `Niche` and `NICHES` are also defined here (and re-exported) so this
 * module is self-contained. The sibling Wave 1 plan 01-02 creates
 * `eval-config.ts` which will also export `Niche` (identical string-literal
 * union); both definitions are structurally compatible. A future
 * consolidation plan can collapse them into a single source.
 */

/** Locked 5-niche set (D-03). Keep in sync with eval-config.ts NICHES. */
export const NICHES = [
  "beauty",
  "fitness",
  "edu",
  "comedy",
  "lifestyle",
] as const;

export type Niche = (typeof NICHES)[number];

export type ScrapeConfigKind = "trending" | "average" | "under";

export interface ApifyScrapeConfig {
  actorId: string;
  input: Record<string, unknown>;
  expectedItems: number;
}

/** Niche-specific hashtags (D-03; 4 per niche balances breadth/precision). */
const NICHE_HASHTAGS: Record<Niche, string[]> = {
  beauty: ["beauty", "skincare", "makeup", "glowup"],
  fitness: ["fitness", "gym", "workout", "gymtok"],
  edu: ["learnontiktok", "education", "studytips", "edutok"],
  comedy: ["comedy", "funny", "humor", "fyp"],
  lifestyle: ["lifestyle", "dayinmylife", "morningroutine", "aesthetic"],
};

/** High-traffic hashtags for viral candidate sourcing — D-02 trending strategy. */
const TRENDING_FEED_HASHTAGS: Record<Niche, string[]> = {
  beauty: ["beauty", "fyp"],
  fitness: ["fitness", "fyp"],
  edu: ["learnontiktok", "fyp"],
  comedy: ["comedy", "fyp"],
  lifestyle: ["lifestyle", "fyp"],
};

const ACTOR_APIDOJO_TIKTOK = "apidojo/tiktok-scraper";

/** Convert a hashtag name to a full TikTok tag URL (apidojo input format). */
function hashtagToUrl(hashtag: string): string {
  return `https://www.tiktok.com/tag/${hashtag}`;
}

/**
 * Build the three Apify configs per niche (D-06).
 *
 * Pilot mode: smaller maxItems for smoke testing / calibration runs.
 * Full mode: targets ~25K raw items across 5 niches; after the ~25% qualifying
 * rate (Pitfall 1 age filter + CORPUS-08 quality filter), expect ~6-8K labeled
 * rows. Bump maxItems here if calibration shows we need more headroom.
 *
 * maxItems budget (full mode):
 *   trending: 800, average: 1200, under: 3000
 *   → 5000 raw per niche × 5 niches = 25K raw total
 *   → ~6-8K labeled (at ~25% qualifying rate)
 *
 * NOTE: `dateRange` is NOT used — it only applies to search-type URLs.
 * The 7-day Pitfall 1 age filter is applied client-side in normalize-scrape.ts.
 * apidojo minimum: 10 posts per startUrl (enforced by the actor).
 */
export function buildApifyJobs(
  niche: Niche,
  isPilot: boolean
): Record<ScrapeConfigKind, ApifyScrapeConfig> {
  return {
    trending: {
      actorId: ACTOR_APIDOJO_TIKTOK,
      input: {
        startUrls: TRENDING_FEED_HASHTAGS[niche].map(hashtagToUrl),
        maxItems: isPilot ? 80 : 800,
        location: "US",
      },
      expectedItems: isPilot ? 80 : 800,
    },
    average: {
      actorId: ACTOR_APIDOJO_TIKTOK,
      input: {
        startUrls: NICHE_HASHTAGS[niche].map(hashtagToUrl),
        maxItems: isPilot ? 120 : 1200,
        location: "US",
      },
      expectedItems: isPilot ? 120 : 1200,
    },
    under: {
      actorId: ACTOR_APIDOJO_TIKTOK,
      input: {
        startUrls: NICHE_HASHTAGS[niche].map(hashtagToUrl),
        // Larger maxItems to ensure enough low-view content passes the
        // client-side under-ceiling filter (Pitfall 2 — no server-side
        // ascending-views sort available in apidojo for hashtag URLs).
        maxItems: isPilot ? 300 : 3000,
        location: "US",
      },
      expectedItems: isPilot ? 300 : 3000,
    },
  };
}

/** Returns a defensive copy of the niche-specific hashtag list. */
export function listNicheHashtags(niche: Niche): string[] {
  return [...NICHE_HASHTAGS[niche]];
}
