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
const ACTOR_CLOCKWORKS_TIKTOK = "clockworks/tiktok-scraper";

/** Convert a hashtag name to a full TikTok tag URL (apidojo input format). */
function hashtagToUrl(hashtag: string): string {
  return `https://www.tiktok.com/tag/${hashtag}`;
}

/**
 * Legacy fallback escape hatch: when `APIFY_ACTOR_LEGACY=clockworks` is set
 * in env, the orchestrator uses `clockworks/tiktok-scraper` with the legacy
 * input shape. Use case: Apify FREE-tier accounts that cannot run apidojo
 * (apidojo's actor refuses unpaid Apify plans). Default: apidojo (12× cheaper).
 *
 * The polyglot normalizer (`normalize-scrape.ts:71-105`) handles both output
 * formats transparently — no code path differences downstream of the scrape.
 */
function isClockworksMode(): boolean {
  return process.env.APIFY_ACTOR_LEGACY === "clockworks";
}

/** clockworks UTC-date helper (Pitfall 1 server-side filter for legacy actor). */
function daysAgoISO(n: number): string {
  const d = new Date(Date.now() - n * 86400_000);
  const datePart = d.toISOString().split("T")[0];
  if (!datePart) throw new Error("daysAgoISO: failed to format date");
  return datePart;
}

function buildClockworksInput(hashtags: string[], perPage: number): Record<string, unknown> {
  return {
    hashtags,
    resultsPerPage: perPage,
    newestPostDate: daysAgoISO(7),
    oldestPostDate: daysAgoISO(90),
    excludePinnedPosts: true,
  };
}

function buildApidojoInput(hashtags: string[], maxItems: number): Record<string, unknown> {
  return {
    startUrls: hashtags.map(hashtagToUrl),
    maxItems,
    location: "US",
  };
}

/**
 * Build the three Apify configs per niche (D-06).
 *
 * Mode-dependent volume targets (each config = hashtags × per-config-cap):
 *
 *   apidojo (default, requires paid Apify plan):
 *     Pilot:  trending=80,  average=120,  under=300  → ~25K raw / 5 niches ≈ $1.50
 *     Full:   trending=800, average=1200, under=3000 → ~25K raw / 5 niches ≈ $7.50
 *
 *   clockworks (APIFY_ACTOR_LEGACY=clockworks, FREE-tier fallback):
 *     Pilot:  trending=10,  average=8,    under=20   → ~660 raw  / 5 niches ≈ $2.45
 *     Full:   trending=20,  average=15,   under=40   → ~1300 raw / 5 niches ≈ $4.80
 *
 * Clockworks budgets are TIGHTLY tuned to fit a $5 FREE Apify quota — bump only
 * if you've verified additional headroom. apidojo budgets target ~6-8K labeled
 * rows after Pitfall 1 (age) + CORPUS-08 (quality) filters apply (~25% pass).
 *
 * NOTE on `dateRange` (apidojo): apidojo's `dateRange` only applies to search
 * URLs, not hashtag URLs. The 7-day Pitfall 1 age filter is applied
 * client-side in normalize-scrape.ts:190 for BOTH actor shapes.
 * apidojo minimum: 10 posts per startUrl (enforced by the actor).
 */
export function buildApifyJobs(
  niche: Niche,
  isPilot: boolean
): Record<ScrapeConfigKind, ApifyScrapeConfig> {
  const clockworks = isClockworksMode();
  const actorId = clockworks ? ACTOR_CLOCKWORKS_TIKTOK : ACTOR_APIDOJO_TIKTOK;
  const buildInput = clockworks ? buildClockworksInput : buildApidojoInput;

  // Per-hashtag / per-call caps.
  const caps = clockworks
    ? (isPilot
        ? { trending: 10, average: 8,  under: 20 }
        : { trending: 20, average: 15, under: 40 })
    : (isPilot
        ? { trending: 80,  average: 120,  under: 300 }
        : { trending: 800, average: 1200, under: 3000 });

  return {
    trending: {
      actorId,
      input: buildInput(TRENDING_FEED_HASHTAGS[niche], caps.trending),
      // For clockworks resultsPerPage is per-hashtag; for apidojo maxItems is total
      expectedItems: clockworks
        ? caps.trending * TRENDING_FEED_HASHTAGS[niche].length
        : caps.trending,
    },
    average: {
      actorId,
      input: buildInput(NICHE_HASHTAGS[niche], caps.average),
      expectedItems: clockworks
        ? caps.average * NICHE_HASHTAGS[niche].length
        : caps.average,
    },
    under: {
      actorId,
      input: buildInput(NICHE_HASHTAGS[niche], caps.under),
      expectedItems: clockworks
        ? caps.under * NICHE_HASHTAGS[niche].length
        : caps.under,
    },
  };
}

/** Returns a defensive copy of the niche-specific hashtag list. */
export function listNicheHashtags(niche: Niche): string[] {
  return [...NICHE_HASHTAGS[niche]];
}
