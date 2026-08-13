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
import { rankOutliers, type RankedOutlier } from "@/lib/discover/outlier-compute";
import { rankWithAudienceFit } from "@/lib/discover/explore-rank";
import { attachOutlierReceipt } from "@/lib/discover/outlier-receipt";
import { OutlierGridBlockSchema, type OutlierGridBlock } from "@/lib/tools/blocks";
import { buildVideoEvidence, evidenceMetric, type RunEvidence } from "@/lib/tools/evidence";
import { formatCount } from "@/lib/account-metrics/account-metrics";
import type { Audience } from "@/lib/audience/audience-types";
import type { VideoData } from "@/lib/scraping/types";

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
  /**
   * CR-02 — the "What competitors shipped" multi-source pull. When present, scrape EACH
   * of these handles (the session user's tracked accounts, already capped by the route)
   * and MERGE the VideoData before a SINGLE rank pass. `normalizedInput` is still the
   * primary source (used for the source tag / single-handle track attribution).
   *
   * Attribution note (RESEARCH Q3): VideoData carries no author handle, so when MORE than
   * one handle is merged we cannot attribute a tile back to its source account — those
   * tiles are therefore NOT individually trackable (and they are already tracked anyway,
   * which is the whole point of the competitors pull). A single-handle merge keeps the
   * normal profile-mode trackability.
   */
  mergeInputs?: string[];
  /**
   * Fires as each source's scrape LANDS, with the posts pulled so far.
   *
   * The pull is bracketed by a single active→done stage pair, so a cache MISS parked the spine
   * on one static row for the whole scrape and then flashed everything at once — while the
   * posts it is about to rank were already in memory. This is the seam that puts them on the
   * glass at the moment they exist.
   *
   * Emits on the REAL boundary (a provider promise resolving), never on a timer. Absent ⇒
   * nothing is built and the runner is byte-identical to its pre-evidence shape.
   */
  onEvidence?: (evidence: RunEvidence) => void;
}

export interface RunExploreResult {
  block: OutlierGridBlock;
  /**
   * The MEASURED ranked tiles (pre-fit, audience-independent) from this same pull.
   * The route caches these so a subsequent same-day pull skips the scrape and re-runs
   * the audience-fit re-rank per request (fit depends on the active audience). Exposing
   * them here avoids a wasteful second scrape just to fill the cache.
   */
  ranked: RankedOutlier[];
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
  // CR-02: a competitors pull merges several tracked handles. The route caps the list;
  // here we scrape each (single source = the [normalizedInput] one-element case) and
  // concat the VideoData before a single rank pass. Dedupe by platformVideoId so a video
  // that surfaces under two tracked handles is not double-counted in the baseline median.
  const provider = createScrapingProvider();
  const sources =
    opts.mergeInputs && opts.mergeInputs.length > 0
      ? opts.mergeInputs
      : [opts.normalizedInput];
  const isMerged = sources.length > 1;

  // clockworks needs the right input field per mode: a niche phrase must go through
  // `searchQueries` (profile mode would treat it as a username → no results). Merged
  // competitors pulls are always handles → profile mode.
  const scrapeMode = opts.mode === "niche" ? "search" : "profile";

  // Show the posts as they land, rather than after the whole pull + rank finishes.
  //
  // A merged competitors pull resolves its sources independently and out of order, so the rail
  // ACCUMULATES: each arrival re-emits the best of everything seen so far, and the payload is
  // pinned to the "Pulling outliers" row by name (the pull can finish while the spine has
  // already advanced, and the rail otherwise hangs off whichever row is currently active).
  //
  // Only ever built from rows we have: `buildVideoEvidence` drops anything with neither a cover
  // nor a handle and returns null if that leaves nothing — VideoData carries no author handle
  // (RESEARCH Q3), so a metadata-only scrape with no covers correctly shows no rail at all
  // rather than a row of blank tiles under a confident headline.
  const landed: VideoData[] = [];
  const emitLanded = opts.onEvidence
    ? (batch: VideoData[]) => {
        landed.push(...batch);
        const best = [...landed].sort((a, b) => b.views - a.views).slice(0, 8);
        const evidence = buildVideoEvidence(
          // Numberless on purpose. The grounding rail's "Reading shape from 5 proven videos"
          // keeps its count because that is a claim about the CREATIVE INPUT — what the model is
          // writing against, which the creator is paying for. A scrape volume is process trivia
          // about our own plumbing, and the owner's rule (2026-08-05) is that the loading UI
          // never reports how many things the pipeline pulled or watched.
          () => "What we pulled",
          best.map((v) => ({
            handle: null,
            image: v.coverUrl ?? null,
            metric: evidenceMetric({ views: v.views, formatCount }),
            href: v.videoUrl ?? null,
          })),
        );
        if (evidence) opts.onEvidence!({ ...evidence, step: "Pulling outliers" });
      }
    : null;

  const scraped = await Promise.all(
    sources.map(async (source) => {
      const vids = await provider.scrapeVideos(source, SCRAPE_LIMIT, scrapeMode);
      emitLanded?.(vids);
      return vids;
    }),
  );
  const seen = new Set<string>();
  const videos = scraped.flat().filter((v) => {
    if (seen.has(v.platformVideoId)) return false;
    seen.add(v.platformVideoId);
    return true;
  });

  // ── (2) Rank (measured, honest) ───────────────────────────────────────────
  const ranked = rankOutliers(videos, opts.mode).slice(0, MAX_TILES);

  // ── (3) Audience-fit re-rank (EXPLORE-03 / D-01) — PURE math, NO SIM call ──
  const fitRanked = rankWithAudienceFit(ranked, opts.audience, opts.serendipity);

  // ── (3b) Swap the within-set multiplier for the per-author RECEIPT (§2.7) ──
  // Strictly AFTER the fit re-rank: `tileTempDemand` reads `multiplier` as a reach proxy and
  // was calibrated against the selection signal, so receipting first would silently retune the
  // fit estimate. Ordering, fit levels and rankKey are all untouched by this step.
  const receipted = attachOutlierReceipt(fitRanked, opts.mode);

  // ── (4) Track handle source (RESEARCH Q3, resolved) ───────────────────────
  // Profile-mode SINGLE-handle pulls are trackable, handle = the pull input (no @,
  // lowercased). RESEARCH Q3: niche-mode video items expose no author handle on
  // VideoData → not trackable in P11 (profile-mode Track only).
  // CR-02: a MERGED competitors pull mixes several handles into one ranked set; with no
  // per-tile author we cannot attribute a tile to a handle, so merged tiles are NOT
  // individually trackable (and the accounts are already tracked — re-tracking is moot).
  const trackable = opts.mode === "profile" && !isMerged;
  const trackHandle = trackable
    ? opts.normalizedInput.replace(/^@/, "").toLowerCase()
    : undefined;
  const source = sourceTag(opts.mode, opts.normalizedInput);

  // ── (5) Build the outlier-grid block (extended with fit/trackable/trackHandle) ──
  const block = {
    type: "outlier-grid" as const,
    props: {
      mode: opts.mode,
      tiles: receipted.map((t) => ({
        platformVideoId: t.platformVideoId,
        videoUrl: t.videoUrl,
        caption: t.caption,
        // Cover thumbnail flows through RankedOutlier (extends VideoData). Omit when absent.
        ...(t.coverUrl ? { coverUrl: t.coverUrl } : {}),
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

  return { block: parsed.data, ranked };
}
