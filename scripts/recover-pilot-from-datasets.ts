/**
 * Recovery script: re-process pilot datasets already stored in Apify
 * and upsert to training_corpus without making new API calls.
 *
 * Used after a DB-write failure to recover from stored Apify datasets.
 * Dataset IDs correspond to the 10 successful pilot runs from 2026-05-11.
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";

// Load .env.local before anything else
config({ path: resolve(process.cwd(), ".env.local") });

// Register tsconfig paths for @ aliases
const tsconfig = JSON.parse(readFileSync(resolve(process.cwd(), "tsconfig.json"), "utf-8"));
register({ baseUrl: process.cwd(), paths: tsconfig.compilerOptions?.paths ?? {} });

// Now import the corpus pipeline modules
const { normalizeScrapedItem } = require("@/lib/engine/corpus/normalize-scrape");
const { bucketByViews } = require("@/lib/engine/corpus/bucketing");
const { getThresholds } = require("@/lib/engine/corpus/thresholds");
const { createServiceClient } = require("@/lib/supabase/service");
const { ApifyClient } = require("apify-client");
const { createLogger } = require("@/lib/logger");

const log = createLogger({ module: "corpus/recover-pilot" });

// Mapping: (niche, config) → Apify dataset ID from the 2026-05-11 pilot run
const PILOT_DATASETS: Array<{
  niche: string;
  config: string;
  datasetId: string;
}> = [
  { niche: "beauty", config: "trending", datasetId: "kjfWbGVCFE7Ni5E52" },
  { niche: "beauty", config: "average", datasetId: "FBBWlLs13E9v5XnIr" },
  { niche: "beauty", config: "under", datasetId: "oXidXu94HqjdOzTNn" },
  { niche: "fitness", config: "trending", datasetId: "atJC4XEReD6X3xHc5" },
  { niche: "fitness", config: "average", datasetId: "XCzrwjr8LmvnkO92q" },
  { niche: "fitness", config: "under", datasetId: "tF89K4NdsZXPcFBhL" },
  { niche: "edu", config: "trending", datasetId: "Dq4xvkbXFK7xXhFsG" },
  { niche: "edu", config: "average", datasetId: "t0pC5H2iCuVexwRCc" },
  { niche: "edu", config: "under", datasetId: "RKb3wcG7D2QCbNApw" },
  { niche: "comedy", config: "trending", datasetId: "WI4qaGbKavPQmzy6b" },
];

const CORPUS_VERSION = "pilot.2026-05-12";
const MAX_PER_CREATOR = 3;

interface BucketedRow {
  row: ReturnType<typeof normalizeScrapedItem>;
  bucket: string;
}

async function main(): Promise<void> {
  const apify = new ApifyClient({ token: process.env.APIFY_TOKEN });
  const supabase = createServiceClient();
  const thresholds = getThresholds(CORPUS_VERSION);

  const allRows: BucketedRow[] = [];
  let rawCount = 0;
  let skippedSchema = 0;
  let skippedQuality = 0;

  // Step 1: Fetch datasets and normalize items
  for (const { niche, config: scrapeKind, datasetId } of PILOT_DATASETS) {
    log.info("Fetching dataset", { niche, scrapeKind, datasetId });
    try {
      const { items } = await apify.dataset(datasetId).listItems();
      log.info("Dataset fetched", { niche, scrapeKind, itemCount: items.length });
      rawCount += items.length;

      for (const item of items) {
        const normalized = normalizeScrapedItem(item, niche, CORPUS_VERSION, scrapeKind);
        if (!normalized) {
          skippedSchema++;
          continue;
        }
        // CORPUS-08 quality filter
        if (normalized.views < 1) {
          skippedQuality++;
          continue;
        }
        // Bucket by views
        const bucket = bucketByViews(
          { views: normalized.views, niche: normalized.niche },
          thresholds
        );
        allRows.push({ row: normalized, bucket });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error("Failed to fetch dataset", { niche, scrapeKind, datasetId, error: msg });
    }
  }

  log.info("All datasets fetched", {
    rawCount,
    normalized: allRows.length,
    skippedSchema,
    skippedQuality,
  });

  // Step 2: Dedup (max 3 per creator per bucket)
  const creatorBucketCount: Map<string, Map<string, number>> = new Map();
  const dedupedRows: BucketedRow[] = [];
  for (const { row, bucket } of allRows) {
    const handle = row.creator_handle ?? "__unknown__";
    if (!creatorBucketCount.has(handle)) creatorBucketCount.set(handle, new Map());
    const bucketMap = creatorBucketCount.get(handle)!;
    const count = bucketMap.get(bucket) ?? 0;
    if (count >= MAX_PER_CREATOR) continue;
    bucketMap.set(bucket, count + 1);
    dedupedRows.push({ row, bucket });
  }

  log.info("After dedup", {
    before: allRows.length,
    after: dedupedRows.length,
    buckets: {
      viral: dedupedRows.filter((r) => r.bucket === "viral").length,
      average: dedupedRows.filter((r) => r.bucket === "average").length,
      under: dedupedRows.filter((r) => r.bucket === "under").length,
    },
  });

  // Step 3: Stratify — pilot targets: 10 viral / 20 average / 20 under
  const TARGETS = { viral: 10, average: 20, under: 20 };
  const bucketCounts = { viral: 0, average: 0, under: 0 };
  const finalRows: Array<{ row: ReturnType<typeof normalizeScrapedItem>; bucket: string }> = [];

  for (const { row, bucket } of dedupedRows) {
    const b = bucket as keyof typeof bucketCounts;
    if (!(b in TARGETS)) continue;
    if (bucketCounts[b] >= TARGETS[b]) continue;
    bucketCounts[b]++;
    finalRows.push({ row, bucket });
  }

  // Step 4: Build bucket_target from scrape_kind
  const bucketTargetFor = (kind: string): string => {
    if (kind === "trending") return "viral";
    if (kind === "under") return "under";
    return "average";
  };

  // Per-niche count
  const perNicheCount: Record<string, number> = {};
  for (const { row } of finalRows) {
    perNicheCount[row.niche] = (perNicheCount[row.niche] ?? 0) + 1;
  }

  log.info("After stratification", {
    total: finalRows.length,
    buckets: bucketCounts,
    perNicheCount,
  });

  // Step 5: Upsert to training_corpus
  const insertRows = finalRows.map(({ row, bucket }) => ({
    platform: row.platform,
    platform_video_id: row.platform_video_id,
    video_url: row.video_url,
    creator_handle: row.creator_handle,
    niche: row.niche,
    corpus_version: row.corpus_version,
    scrape_kind: row.scrape_kind,
    bucket,
    bucket_target: bucketTargetFor(row.scrape_kind),
    views: row.views,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    saves: row.saves,
    duration_seconds: row.duration_seconds,
    completion_pct: row.completion_pct,
    follower_count: row.follower_count,
    follower_tier: row.follower_tier,
    caption: row.caption,
    hashtags: row.hashtags,
    sound_name: row.sound_name,
    posted_at: row.posted_at?.toISOString(),
    scraped_at: row.scraped_at?.toISOString(),
  }));

  const { error } = await supabase
    .from("training_corpus")
    .upsert(insertRows, {
      onConflict: "corpus_version,platform_video_id",
      ignoreDuplicates: false,
    });

  if (error) {
    log.error("Upsert failed", { error: error.message });
    process.exit(1);
  }

  log.info("Upsert complete", { count: insertRows.length, perNicheCount });
  console.log(JSON.stringify({ ok: true, count: insertRows.length, perNicheCount, buckets: bucketCounts }, null, 2));
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
