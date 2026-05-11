/**
 * Apify scrape job configs for the training corpus (D-06).
 *
 * Produces 3 scrape configs per niche × 5 niches = 15 jobs per refresh.
 * Pure config builder; no Apify calls in this module. The orchestrator
 * (Plan D) is responsible for actually invoking client.actor().call().
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

/** D-04: min video age = 7 days. Apify date helper (UTC date, no time). */
function daysAgoISO(n: number): string {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  const iso = d.toISOString();
  // toISOString returns YYYY-MM-DDTHH:mm:ss.sssZ — slice the date part safely
  const datePart = iso.split("T")[0];
  if (!datePart) {
    // Should never happen — defensive guard for strict typing
    throw new Error("daysAgoISO: failed to format date");
  }
  return datePart;
}

const ACTOR_CLOCKWORKS_TIKTOK = "clockworks/tiktok-scraper";

/**
 * Build the three Apify configs per niche (D-06).
 * Pilot uses smaller resultsPerPage; full uses ~5x larger.
 *
 * IMPORTANT (Pitfall 1): `newestPostDate` is 7 days ago, not today.
 * This means "only videos uploaded ON OR BEFORE 7 days ago" — i.e., the
 * video has had ≥ 7 days to plateau (D-04).
 */
export function buildApifyJobs(
  niche: Niche,
  isPilot: boolean
): Record<ScrapeConfigKind, ApifyScrapeConfig> {
  const sizeMultiplier = isPilot ? 1 : 5;
  const newestPostDate = daysAgoISO(7); // D-04 age floor
  const oldestPostDate = daysAgoISO(90); // sanity ceiling

  const baseInput = {
    newestPostDate,
    oldestPostDate,
    excludePinnedPosts: true,
  };

  return {
    trending: {
      actorId: ACTOR_CLOCKWORKS_TIKTOK,
      input: {
        ...baseInput,
        hashtags: TRENDING_FEED_HASHTAGS[niche],
        resultsPerPage: 40 * sizeMultiplier,
      },
      expectedItems: isPilot ? 15 : 60,
    },
    average: {
      actorId: ACTOR_CLOCKWORKS_TIKTOK,
      input: {
        ...baseInput,
        hashtags: NICHE_HASHTAGS[niche],
        resultsPerPage: 60 * sizeMultiplier,
      },
      expectedItems: isPilot ? 25 : 100,
    },
    under: {
      actorId: ACTOR_CLOCKWORKS_TIKTOK,
      input: {
        ...baseInput,
        hashtags: NICHE_HASHTAGS[niche],
        resultsPerPage: 80 * sizeMultiplier,
        // Pitfall 2: no server-side ascending-by-views sort. Scrape broadly;
        // client-side filter (in orchestrator, Plan D) drops to ≤ underCeiling.
      },
      expectedItems: isPilot ? 25 : 100,
    },
  };
}

/** Returns a defensive copy of the niche-specific hashtag list. */
export function listNicheHashtags(niche: Niche): string[] {
  return [...NICHE_HASHTAGS[niche]];
}
