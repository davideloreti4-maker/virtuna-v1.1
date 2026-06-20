/**
 * explore-runner.ts — Phase 11, Plan 04, Task 1 (EXPLORE-03 / D-01 / D-02 / D-03).
 *
 * The Explore pipeline: pull → rank → audience-fit → build a validated outlier-grid
 * block. It lifts the P8 `/api/discover` pull/rank logic and adds the 11-01 audience-fit
 * re-rank, threading the profile-mode Track handle onto each tile.
 *
 * HARD HONESTY CONSTRAINT (D-02/D-03, RESEARCH Pitfall 6):
 *   NO SIM call on the grid. NO video-scoring call. NO engine-scoring import. The only
 *   network this runner does is the provider scrape. `rankWithAudienceFit` is pure
 *   deterministic math at the runner layer, so `ENGINE_VERSION` stays "3.19.0" and the
 *   SIM-1 Max regression gate is untouched. The fit signal is a re-ranked ESTIMATE
 *   (level word only) — never a band, model tag, numeric score, or fabricated quote.
 *   The real persona reaction is produced lazily, on tap, by the UNCHANGED remix-card
 *   (its P9 LensTrigger) — never here.
 *
 * Tiles carry the MEASURED multiplier (with its honest baselineLabel) + the audience-fit
 * ESTIMATE only. Profile-mode pulls are trackable (handle = the pull input); niche-mode
 * pulls are not (VideoData exposes no author handle — RESEARCH Q3).
 */

import { createScrapingProvider } from "@/lib/scraping";
import { rankOutliers } from "@/lib/discover/outlier-compute";
import { rankWithAudienceFit } from "@/lib/discover/explore-rank";
import { OutlierGridBlockSchema, type OutlierGridBlock } from "@/lib/tools/blocks";
import type { Audience } from "@/lib/audience/audience-types";

// Reuse the Discover scrape/tile band (RESEARCH §Don't Hand-Roll: do NOT re-roll the
// scrape budget or the tile cap — match /api/discover exactly).
const SCRAPE_LIMIT = 30; // over-pull a little so the 90d window + ranking has material
const MAX_TILES = 30; // D-16 — return ~20–30 tiles

export interface RunExploreInput {
  /** The active calibrated audience (loaded from active_audience_id — NEVER body, CR-01). */
  audience: Audience;
  /** profile pull (a handle) vs niche pull (free text) — drives source tag + trackability. */
  mode: "profile" | "niche";
  /** The normalized pull input (classifyDiscoverInput output: handle w/o @, or niche text). */
  normalizedInput: string;
  /** The serendipity valve: 0 = on-niche, 1 = widen beyond niche (D-06). */
  serendipity: number;
}

export interface RunExploreResult {
  block: OutlierGridBlock;
}

/**
 * D-15 source tag — mirrors Discover's display mapping:
 *   niche pulls tag the niche query; profile pulls tag "Competitor"
 *   (own-vs-competitor refinement is a W3/W4 concern; v1 tags the pull source).
 */
function sourceTag(mode: "profile" | "niche", normalizedInput: string): string {
  return mode === "niche" ? normalizedInput : "Competitor";
}

/**
 * Run the Explore pipeline.
 *
 * 1. Pull via the apidojo Discover provider (reused SCRAPE_LIMIT).
 * 2. Rank (measured, honest) via P8 rankOutliers, capped to MAX_TILES.
 * 3. Audience-fit re-rank (EXPLORE-03 / D-01) via 11-01 rankWithAudienceFit — PURE math.
 * 4. Build the extended outlier-grid block with per-tile fit + mode-appropriate
 *    trackable/trackHandle.
 * 5. D-14 belt-and-suspenders: OutlierGridBlockSchema.safeParse before returning.
 */
export async function runExplorePipeline(opts: RunExploreInput): Promise<RunExploreResult> {
  // ── (1) Pull — the only network call (no SIM, Pitfall 6) ──────────────────
  const provider = createScrapingProvider();
  const videos = await provider.scrapeVideos(opts.normalizedInput, SCRAPE_LIMIT);

  // ── (2) Rank (measured, honest) ───────────────────────────────────────────
  const ranked = rankOutliers(videos, opts.mode).slice(0, MAX_TILES);

  // ── (3) Audience-fit re-rank (EXPLORE-03 / D-01) — PURE math, NO SIM call ──
  const fitRanked = rankWithAudienceFit(ranked, opts.audience, opts.serendipity);

  // ── (4) Track handle source (RESEARCH Q3, resolved) ───────────────────────
  // Profile-mode pulls are trackable, handle = the pull input (no @, lowercased).
  // RESEARCH Q3: niche-mode video items expose no author handle on VideoData → not
  // trackable in P11 (profile-mode Track only). Still satisfies the producer half (D-08).
  const trackable = opts.mode === "profile";
  const trackHandle = trackable
    ? opts.normalizedInput.replace(/^@/, "").toLowerCase()
    : undefined;
  const source = sourceTag(opts.mode, opts.normalizedInput);

  // ── (5) Build the outlier-grid block (extended with fit/trackable/trackHandle) ──
  const block = {
    type: "outlier-grid" as const,
    props: {
      mode: opts.mode,
      tiles: fitRanked.map((t) => ({
        platformVideoId: t.platformVideoId,
        videoUrl: t.videoUrl,
        caption: t.caption,
        views: t.views,
        likes: t.likes,
        comments: t.comments,
        shares: t.shares,
        saves: t.saves,
        durationSeconds: t.durationSeconds,
        postedAt: t.postedAt.toISOString(), // block props are JSON-serializable
        multiplier: t.multiplier,
        baselineLabel: t.baselineLabel,
        source,
        // EXPLORE-03 (D-01): re-ranked fit estimate (level word only; null on degrade).
        fit: t.fit,
        // EXPLORE-05 (D-08): profile-mode Track affordance only (RESEARCH Q3).
        trackable,
        trackHandle: trackable ? trackHandle : undefined,
      })),
    },
  };

  // ── (6) D-14 belt-and-suspenders (mirrors hooks-runner safeParse — Pitfall 4) ──
  const parsed = OutlierGridBlockSchema.safeParse(block);
  if (!parsed.success) {
    throw new Error(`explore block validation failed: ${parsed.error.message}`);
  }

  return { block: parsed.data };
}
