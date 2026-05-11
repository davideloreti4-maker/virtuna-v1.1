import { ApifyClient } from "apify-client";
import * as Sentry from "@sentry/nextjs";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";
import { createReadStream, createWriteStream, mkdirSync, existsSync } from "fs";
import { createInterface } from "readline";
import { dirname, join } from "path";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  NICHES,
  type Niche,
  type Bucket,
  TARGET_DISTRIBUTION_PILOT,
  TARGET_DISTRIBUTION_FULL,
} from "./eval-config";
import { buildApifyJobs, type ScrapeConfigKind } from "./apify-jobs";
import { normalizeScrapedItem, type NormalizedCorpusRow } from "./normalize-scrape";
import { bucketByViews } from "./bucketing";
import { getThresholds, type CorpusVersion } from "./thresholds";

const log = createLogger({ module: "corpus/orchestrator" });

const CONFIGS: ScrapeConfigKind[] = ["trending", "average", "under"];

// ─── Legacy BuildCorpus API (kept for backward compat) ───────────────────────

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

// ─── New split API ────────────────────────────────────────────────────────────

export interface ScrapeRawToCacheOptions {
  version: string;
  niches?: Niche[];
  configs?: ScrapeConfigKind[];
  apifyClient: ApifyClient;
  isPilot: boolean;
  apifyWaitSecs?: number;
}

export interface BucketAndPersistOptions {
  rows: NormalizedCorpusRow[];
  version: string;
  supabase: SupabaseClient;
  bucketCaps?: Record<Bucket, number>;
}

export interface BucketAndPersistResult {
  upserted: number;
  perNicheBucket: Record<string, number>;
  skipped: number;
}

// ─── Cache file helpers ───────────────────────────────────────────────────────

const DEFAULT_CACHE_DIR = ".planning/cache";

/** Resolve default cache path for a version slug. */
export function defaultCachePath(version: string): string {
  return join(DEFAULT_CACHE_DIR, `raw-${version}.jsonl`);
}

/**
 * Serialize normalized rows to a JSONL file.
 * Date fields (posted_at, scraped_at) are stored as ISO strings.
 */
export async function writeRawCache(
  rows: NormalizedCorpusRow[],
  filePath: string
): Promise<void> {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const ws = createWriteStream(filePath, { encoding: "utf-8" });
  await new Promise<void>((resolve, reject) => {
    ws.on("error", reject);
    ws.on("finish", resolve);
    for (const row of rows) {
      const serialized = {
        ...row,
        posted_at: row.posted_at.toISOString(),
        scraped_at: row.scraped_at.toISOString(),
      };
      ws.write(JSON.stringify(serialized) + "\n");
    }
    ws.end();
  });
  log.info("Cache written", { path: filePath, rows: rows.length });
}

/**
 * Read normalized rows from a JSONL cache file.
 * Date fields are parsed back into Date objects.
 */
export async function readRawCache(
  filePath: string
): Promise<NormalizedCorpusRow[]> {
  const rows: NormalizedCorpusRow[] = [];
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const obj = JSON.parse(trimmed) as Record<string, unknown>;
    rows.push({
      ...(obj as Omit<NormalizedCorpusRow, "posted_at" | "scraped_at">),
      posted_at: new Date(obj["posted_at"] as string),
      scraped_at: new Date(obj["scraped_at"] as string),
    } as NormalizedCorpusRow);
  }
  log.info("Cache read", { path: filePath, rows: rows.length });
  return rows;
}

// ─── scrapeRawToCache ─────────────────────────────────────────────────────────

/**
 * Phase 1 of the two-phase corpus build: scrape all configs via Apify,
 * normalize via normalizeScrapedItem(), deduplicate by platform_video_id,
 * apply CORPUS-08 quality filter and Pitfall 1 age filter.
 *
 * Does NOT bucket and does NOT write to training_corpus.
 * Returns the array of normalized rows for the caller to cache or process.
 */
export async function scrapeRawToCache(
  opts: ScrapeRawToCacheOptions
): Promise<NormalizedCorpusRow[]> {
  const {
    version,
    niches = [...NICHES],
    configs = [...CONFIGS],
    apifyClient,
    isPilot,
    apifyWaitSecs = 600,
  } = opts;

  const rawRows: NormalizedCorpusRow[] = [];
  const failed: Array<{ niche: Niche; config: ScrapeConfigKind; error: string }> = [];

  for (const niche of niches) {
    const jobs = buildApifyJobs(niche, isPilot);
    for (const config of configs) {
      const job = jobs[config];
      log.info("Starting scrape", { niche, config, actorId: job.actorId });
      try {
        const run = await apifyClient
          .actor(job.actorId)
          .call(job.input, { waitSecs: apifyWaitSecs });
        const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
        log.info("Scrape complete", { niche, config, rawItems: items.length });

        for (const item of items) {
          const normalized = normalizeScrapedItem(
            item,
            niche,
            version,
            config
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
          tags: { stage: "corpus_scrape", niche, config, corpusVersion: version },
        });
        failed.push({ niche, config, error: msg });
      }
    }
  }

  const rawCount = rawRows.length;
  log.info("All scrapes complete", { rawCount, failures: failed.length });

  // CORPUS-08 quality filter
  const qualityFiltered = rawRows.filter(
    (r) =>
      r.views >= 1 &&
      r.likes + r.comments + r.shares + r.saves > 0 &&
      Date.now() - r.posted_at.getTime() >= 7 * 24 * 60 * 60 * 1000
  );

  // Deduplicate by platform_video_id (a video can appear in multiple configs)
  const seenIds = new Set<string>();
  const deduped = qualityFiltered.filter((r) => {
    if (seenIds.has(r.platform_video_id)) return false;
    seenIds.add(r.platform_video_id);
    return true;
  });

  log.info("scrapeRawToCache complete", {
    rawCount,
    afterQualityFilter: qualityFiltered.length,
    afterDedup: deduped.length,
    failures: failed.length,
  });

  return deduped;
}

// ─── bucketAndPersist ─────────────────────────────────────────────────────────

/**
 * Phase 2 of the two-phase corpus build: takes already-normalized rows
 * (from scrapeRawToCache or readRawCache), applies bucket classification,
 * per-niche × per-bucket cap stratification, and upserts to training_corpus.
 *
 * Requires the version to be sealed in thresholds.ts THRESHOLD_SNAPSHOTS.
 * Throws if getThresholds(version) returns no entry.
 */
export async function bucketAndPersist(
  opts: BucketAndPersistOptions
): Promise<BucketAndPersistResult> {
  const {
    rows,
    version,
    supabase,
    bucketCaps,
  } = opts;

  // Throws if version not sealed — enforces D-13 immutability guard
  const thresholds = getThresholds(version);

  // Default stratification caps: viral 20%, average 40%, under 40% of total per niche
  const totalPerNiche = Math.ceil(rows.length / NICHES.length);
  const defaultCaps: Record<Bucket, number> = {
    viral: Math.ceil(totalPerNiche * 0.2),
    average: Math.ceil(totalPerNiche * 0.4),
    under: Math.ceil(totalPerNiche * 0.4),
  };
  const caps = bucketCaps ?? defaultCaps;

  // Bucket rows
  const bucketed = rows.map((r) => ({
    ...r,
    bucket: bucketByViews({ views: r.views, niche: r.niche }, thresholds),
  }));

  // Per-creator dedup (max 3 per creator per bucket) — preserves 8261876 fix
  const dedup = (
    bucketRows: typeof bucketed,
    dir: "desc" | "asc"
  ): typeof bucketed => {
    const byCreator = new Map<string, typeof bucketed>();
    for (const r of bucketRows) {
      const key = r.creator_handle ?? `__anon_${r.platform_video_id}`;
      const arr = byCreator.get(key) ?? [];
      arr.push(r);
      byCreator.set(key, arr);
    }
    const out: typeof bucketed = [];
    for (const arr of byCreator.values()) {
      const sorted = [...arr].sort((a, b) =>
        dir === "desc" ? b.views - a.views : a.views - b.views
      );
      out.push(...sorted.slice(0, 3));
    }
    return out;
  };

  // Per-niche × per-bucket stratification
  const final: typeof bucketed = [];
  const perNicheBucket: Record<string, number> = {};
  let skipped = 0;

  for (const niche of NICHES) {
    const nicheRows = bucketed.filter((r) => r.niche === niche);
    const viralRows = dedup(nicheRows.filter((r) => r.bucket === "viral"), "desc");
    const avgRows = dedup(nicheRows.filter((r) => r.bucket === "average"), "desc");
    const underRows = dedup(nicheRows.filter((r) => r.bucket === "under"), "asc");

    const viralSample = viralRows.slice(0, caps.viral);
    const avgSample = avgRows.slice(0, caps.average);
    const underSample = underRows.slice(0, caps.under);

    skipped +=
      (viralRows.length - viralSample.length) +
      (avgRows.length - avgSample.length) +
      (underRows.length - underSample.length);

    perNicheBucket[`${niche}.viral`] = viralSample.length;
    perNicheBucket[`${niche}.average`] = avgSample.length;
    perNicheBucket[`${niche}.under`] = underSample.length;

    final.push(...viralSample, ...avgSample, ...underSample);
  }

  if (final.length === 0) {
    log.warn("bucketAndPersist: no rows to upsert after stratification");
    return { upserted: 0, perNicheBucket, skipped };
  }

  // Build DB rows
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
    bucket_target: bucketTargetFor(r),
  }));

  // Batch-dedup on platform_video_id before upsert (8261876 fix: ON CONFLICT
  // throws if the same row appears twice in a single batch)
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
      ignoreDuplicates: false,
    });

  if (error) {
    log.error("Upsert failed", { error: error.message });
    throw error;
  }

  log.info("bucketAndPersist complete", {
    version,
    upserted: dedupedDbRows.length,
    skipped,
  });

  return {
    upserted: dedupedDbRows.length,
    perNicheBucket,
    skipped,
  };
}

// ─── Legacy single-pass runCorpusBuild (thin wrapper) ────────────────────────

/**
 * Apify client factory — overridable for tests.
 */
let apifyFactory: () => ApifyClient = () =>
  new ApifyClient({ token: process.env.APIFY_TOKEN ?? "" });

export function __setApifyFactoryForTests(f: () => ApifyClient): void {
  apifyFactory = f;
}

/**
 * Legacy single-pass corpus build. Kept for backward compatibility with
 * existing build-corpus.ts CLI and tests. Thin wrapper over
 * scrapeRawToCache + bucketAndPersist.
 *
 * @deprecated Prefer the two-phase flow: scrapeRawToCache → writeRawCache →
 * calibrate-thresholds.ts → readRawCache → bucketAndPersist.
 */
export async function buildCorpus(
  opts: BuildCorpusOptions
): Promise<BuildCorpusResult> {
  const { corpusVersion, isPilot, dryRun = false } = opts;
  const supabase = createServiceClient();
  const apify = apifyFactory();
  const thresholds = getThresholds(corpusVersion);

  const failed: BuildCorpusResult["failed"] = [];
  const rawRows: NormalizedCorpusRow[] = [];

  // 5 niches × 3 configs sequential (per RESEARCH §A.2)
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
          const normalized = normalizeScrapedItem(
            item,
            niche,
            String(corpusVersion),
            config
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
      }
    }
  }

  const rawCount = rawRows.length;
  log.info("All scrapes complete", { rawCount });

  // CORPUS-08 quality filter
  const qualityFiltered = rawRows.filter(
    (r) =>
      r.views >= 1 &&
      r.likes + r.comments + r.shares + r.saves > 0 &&
      Date.now() - r.posted_at.getTime() >= 7 * 24 * 60 * 60 * 1000
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
    dir: "desc" | "asc"
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
        dir === "desc" ? b.views - a.views : a.views - b.views
      );
      out.push(...sorted.slice(0, 3));
    }
    return out;
  };

  const viral = dedup(
    bucketed.filter((r) => r.bucket === "viral"),
    "desc"
  );
  const average = dedup(
    bucketed.filter((r) => r.bucket === "average"),
    "desc"
  );
  const under = dedup(
    bucketed.filter((r) => r.bucket === "under"),
    "asc"
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
    {} as Record<Niche, number>
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
    bucket_target: bucketTargetFor(r),
  }));

  // Dedup within the batch on (corpus_version, platform_video_id) — 8261876 fix
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
      ignoreDuplicates: false,
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
 */
function bucketTargetFor(
  r: NormalizedCorpusRow & { bucket: "viral" | "average" | "under" }
): "viral" | "average" | "under" {
  switch (r.scrape_kind) {
    case "trending":
      return "viral";
    case "average":
      return "average";
    case "under":
      return "under";
    default:
      return r.bucket;
  }
}
