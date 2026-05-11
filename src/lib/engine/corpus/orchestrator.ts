import { ApifyClient } from "apify-client";
import * as Sentry from "@sentry/nextjs";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";

import {
  NICHES,
  type Niche,
  TARGET_DISTRIBUTION_PILOT,
  TARGET_DISTRIBUTION_FULL,
} from "./eval-config";
import { buildApifyJobs, type ScrapeConfigKind } from "./apify-jobs";
import { normalizeScrapedItem, type NormalizedCorpusRow } from "./normalize-scrape";
import { bucketByViews } from "./bucketing";
import { getThresholds, type CorpusVersion } from "./thresholds";

const log = createLogger({ module: "corpus/orchestrator" });

const CONFIGS: ScrapeConfigKind[] = ["trending", "average", "under"];

export interface BuildCorpusOptions {
  corpusVersion: CorpusVersion | string;
  isPilot: boolean;
  dryRun?: boolean;
  apifyWaitSecs?: number; // override for testing
}

export interface BuildCorpusResult {
  inserted: number;
  failed: Array<{ niche: Niche; config: ScrapeConfigKind; error: string }>;
  summary: {
    rawCount: number;
    afterQualityFilter: number;
    afterBucketing: { viral: number; average: number; under: number };
    afterDedup: { viral: number; average: number; under: number };
    afterStratification: { viral: number; average: number; under: number };
    perNicheCount: Record<Niche, number>;
  };
}

/**
 * Apify client factory — overridable for tests.
 */
let apifyFactory: () => ApifyClient = () =>
  new ApifyClient({ token: process.env.APIFY_TOKEN ?? "" });

export function __setApifyFactoryForTests(f: () => ApifyClient): void {
  apifyFactory = f;
}

export async function buildCorpus(
  opts: BuildCorpusOptions,
): Promise<BuildCorpusResult> {
  const { corpusVersion, isPilot, dryRun = false } = opts;
  const supabase = createServiceClient();
  const apify = apifyFactory();
  const thresholds = getThresholds(corpusVersion);

  const failed: BuildCorpusResult["failed"] = [];
  const rawRows: NormalizedCorpusRow[] = [];

  // 5 niches x 3 configs sequential (per RESEARCH §A.2 reasoning: Apify concurrency caps + per-failure isolation)
  for (const niche of NICHES) {
    const jobs = buildApifyJobs(niche, isPilot);
    for (const config of CONFIGS) {
      const job = jobs[config];
      log.info("Starting scrape", { niche, config, actorId: job.actorId });
      try {
        const run = await apify
          .actor(job.actorId)
          .call(job.input, { waitSecs: opts.apifyWaitSecs ?? 600 });
        const { items } = await apify.dataset(run.defaultDatasetId).listItems();
        log.info("Scrape complete", { niche, config, rawItems: items.length });

        for (const item of items) {
          // W6: pass `config` (the ScrapeConfigKind) into normalize so bucket_target propagates
          const normalized = normalizeScrapedItem(
            item,
            niche,
            String(corpusVersion),
            config,
          );
          if (normalized) rawRows.push(normalized);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error("Scrape failed; continuing to next config", {
          niche,
          config,
          error: msg,
        });
        Sentry.captureException(err, {
          tags: {
            stage: "corpus_scrape",
            niche,
            config,
            corpusVersion: String(corpusVersion),
          },
        });
        failed.push({ niche, config, error: msg });
        // Continue — per refresh-competitors:99 isolation pattern
      }
    }
  }

  const rawCount = rawRows.length;
  log.info("All scrapes complete", { rawCount });

  // CORPUS-08 quality filter (orchestrator-level — belt-and-suspenders over normalize-scrape)
  const qualityFiltered = rawRows.filter(
    (r) =>
      r.views >= 1 &&
      r.likes + r.comments + r.shares + r.saves > 0 &&
      Date.now() - r.posted_at.getTime() >= 7 * 24 * 60 * 60 * 1000,
  );

  // Pitfall 3 ORDER: bucket FIRST, dedup AFTER
  const bucketed = qualityFiltered.map((r) => ({
    ...r,
    bucket: bucketByViews({ views: r.views, niche: r.niche }, thresholds),
  }));

  const countBucket = (label: "viral" | "average" | "under") =>
    bucketed.filter((r) => r.bucket === label).length;
  const afterBucketing = {
    viral: countBucket("viral"),
    average: countBucket("average"),
    under: countBucket("under"),
  };

  // Dedup max-3-per-creator within each bucket
  const dedup = (
    rows: typeof bucketed,
    dir: "desc" | "asc",
  ): typeof bucketed => {
    const byCreator = new Map<string, typeof bucketed>();
    for (const r of rows) {
      const key = r.creator_handle ?? `__anon_${r.platform_video_id}`;
      const arr = byCreator.get(key) ?? [];
      arr.push(r);
      byCreator.set(key, arr);
    }
    const out: typeof bucketed = [];
    for (const arr of byCreator.values()) {
      const sorted = [...arr].sort((a, b) =>
        dir === "desc" ? b.views - a.views : a.views - b.views,
      );
      out.push(...sorted.slice(0, 3)); // D-05 max 3 per creator
    }
    return out;
  };

  const viral = dedup(
    bucketed.filter((r) => r.bucket === "viral"),
    "desc",
  );
  const average = dedup(
    bucketed.filter((r) => r.bucket === "average"),
    "desc",
  );
  const under = dedup(
    bucketed.filter((r) => r.bucket === "under"),
    "asc",
  );
  const afterDedup = {
    viral: viral.length,
    average: average.length,
    under: under.length,
  };

  // Stratified sample down to targets
  const targets = isPilot ? TARGET_DISTRIBUTION_PILOT : TARGET_DISTRIBUTION_FULL;
  const sampleTo = (rows: typeof bucketed, n: number) => rows.slice(0, n);
  const final = [
    ...sampleTo(viral, targets.viral),
    ...sampleTo(average, targets.average),
    ...sampleTo(under, targets.under),
  ];
  const afterStratification = {
    viral: Math.min(viral.length, targets.viral),
    average: Math.min(average.length, targets.average),
    under: Math.min(under.length, targets.under),
  };

  const perNicheCount = NICHES.reduce(
    (acc, n) => ({ ...acc, [n]: final.filter((r) => r.niche === n).length }),
    {} as Record<Niche, number>,
  );

  log.info("Pipeline complete", {
    rawCount,
    afterQualityFilter: qualityFiltered.length,
    afterBucketing,
    afterDedup,
    afterStratification,
    perNicheCount,
  });

  if (dryRun) {
    log.info("Dry run — skipping DB write", { wouldInsert: final.length });
    return {
      inserted: 0,
      failed,
      summary: {
        rawCount,
        afterQualityFilter: qualityFiltered.length,
        afterBucketing,
        afterDedup,
        afterStratification,
        perNicheCount,
      },
    };
  }

  // Strip the Date instances back to ISO strings for the DB insert
  const dbRows = final.map((r) => ({
    platform: r.platform,
    platform_video_id: r.platform_video_id,
    video_url: r.video_url,
    creator_handle: r.creator_handle,
    posted_at: r.posted_at.toISOString(),
    scraped_at: r.scraped_at.toISOString(),
    views: r.views,
    likes: r.likes,
    comments: r.comments,
    shares: r.shares,
    saves: r.saves,
    duration_seconds: r.duration_seconds,
    completion_pct: r.completion_pct,
    follower_count: r.follower_count,
    follower_tier: r.follower_tier,
    caption: r.caption,
    hashtags: r.hashtags,
    sound_name: r.sound_name,
    corpus_version: r.corpus_version,
    niche: r.niche,
    bucket: r.bucket,
    bucket_target: bucketTargetFor(r), // W6: from scrape_kind, not from bucket
  }));

  // Dedup within the batch on (corpus_version, platform_video_id) — a video
  // can appear in multiple scrape configs (e.g., trending + average feeds both
  // return the same viral video). PostgreSQL ON CONFLICT DO UPDATE throws if
  // the same row appears twice in a single batch; deduplicate here to avoid it.
  const seenVideoIds = new Set<string>();
  const dedupedDbRows = dbRows.filter((r) => {
    if (seenVideoIds.has(r.platform_video_id)) return false;
    seenVideoIds.add(r.platform_video_id);
    return true;
  });

  const { error } = await supabase
    .from("training_corpus")
    .upsert(dedupedDbRows, {
      onConflict: "corpus_version,platform_video_id",
      ignoreDuplicates: false, // update any pre-existing rows with fresh data
    });

  if (error) {
    log.error("Upsert failed", { error: error.message });
    throw error;
  }

  log.info("Corpus build complete", {
    corpusVersion,
    inserted: final.length,
  });
  return {
    inserted: final.length,
    failed,
    summary: {
      rawCount,
      afterQualityFilter: qualityFiltered.length,
      afterBucketing,
      afterDedup,
      afterStratification,
      perNicheCount,
    },
  };
}

/**
 * W6 fix: bucket_target encodes the SCRAPE INTENT (which ScrapeConfigKind
 * produced the row), distinct from `bucket` which is the empirical classification.
 * `ScrapeConfigKind = "trending" | "average" | "under"`. "trending" intent maps
 * to "viral" target (the trending feed sources viral candidates per D-02);
 * "average" and "under" map directly.
 */
function bucketTargetFor(
  r: NormalizedCorpusRow & { bucket: "viral" | "average" | "under" },
): "viral" | "average" | "under" {
  switch (r.scrape_kind) {
    case "trending":
      return "viral";
    case "average":
      return "average";
    case "under":
      return "under";
    default:
      return r.bucket; // legacy fallback if scrape_kind missing
  }
}
