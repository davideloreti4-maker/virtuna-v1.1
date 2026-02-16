import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import type { Database } from "../src/types/database.types";

// Load .env.local (Next.js convention)
config({ path: resolve(__dirname, "../.env.local") });

// ─── Types ──────────────────────────────────────────────────────────
type ScrapedVideo = Database["public"]["Tables"]["scraped_videos"]["Row"];

interface TrainingFeature {
  shareRate: number;
  commentRate: number;
  likeRate: number;
  saveRate: number;
  shareToLikeRatio: number;
  commentToLikeRatio: number;
  durationSeconds: number;
  hashtagCount: number;
  hasTrendingSound: number;
  captionLength: number;
  hasFollowerData: number;
  followerTier: number;
  viewsPerFollower: number;
  weekdayPosted: number;
  hourPosted: number;
}

interface TrainingSample {
  features: number[];
  label: number; // virality tier 1-5
}

interface TrainingDataOutput {
  generatedAt: string;
  featureNames: string[];
  trainSet: { features: number[][]; labels: number[]; count: number };
  testSet: { features: number[][]; labels: number[]; count: number };
  labelDistribution: Record<string, number>;
}

// ─── Utility Functions ──────────────────────────────────────────────
// Copied from analyze-dataset.ts (standalone scripts don't share imports)

const log = (msg: string) => console.log(`[extract-training] ${msg}`);

function sortedNumbers(arr: number[]): number[] {
  return [...arr].sort((a, b) => a - b);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower]!;
  const weight = index - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

// ─── Feature Names (order matters — must match feature array indices) ──
const FEATURE_NAMES: (keyof TrainingFeature)[] = [
  "shareRate",
  "commentRate",
  "likeRate",
  "saveRate",
  "shareToLikeRatio",
  "commentToLikeRatio",
  "durationSeconds",
  "hashtagCount",
  "hasTrendingSound",
  "captionLength",
  "hasFollowerData",
  "followerTier",
  "viewsPerFollower",
  "weekdayPosted",
  "hourPosted",
];

// ─── Feature Extraction ─────────────────────────────────────────────

function getFollowerTier(followers: number | null): number {
  if (followers == null) return 0.5; // unknown
  if (followers < 10_000) return 0.1; // nano
  if (followers < 100_000) return 0.3; // micro
  if (followers < 500_000) return 0.5; // mid
  if (followers < 1_000_000) return 0.7; // macro
  return 0.9; // mega
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function extractFeatures(video: ScrapedVideo): TrainingFeature {
  const views = Number(video.views) || 1;
  const likes = Number(video.likes) || 0;
  const comments = Number(video.comments) || 0;
  const shares = Number(video.shares) || 0;
  const meta = video.metadata as Record<string, unknown> | null;
  const bookmarks = Number(meta?.bookmarks) || 0;
  const followers = meta?.followers != null ? Number(meta.followers) : null;
  const uploadedAt = meta?.uploaded_at ? new Date(String(meta.uploaded_at)) : null;

  // Engagement rates (already roughly 0-1 for most content)
  const shareRate = clamp01(shares / views);
  const commentRate = clamp01(comments / views);
  const likeRate = clamp01(likes / views);
  const saveRate = clamp01(bookmarks / views);

  // Depth ratios (cap at 1 for normalization)
  const shareToLikeRatio = likes > 0 ? clamp01(shares / likes) : 0;
  const commentToLikeRatio = likes > 0 ? clamp01(comments / likes) : 0;

  // Duration normalized (divide by 180s, cap at 1)
  const durationSeconds = clamp01((Number(video.duration_seconds) || 0) / 180);

  // Hashtag count normalized (divide by 30, cap at 1)
  const hashtagCount = clamp01((video.hashtags?.length ?? 0) / 30);

  // Sound presence binary
  const hasTrendingSound = video.sound_name && video.sound_name.trim().length > 0 ? 1 : 0;

  // Caption length normalized (divide by 2000, cap at 1)
  const captionLength = clamp01((video.description ?? "").length / 2000);

  // Follower data
  const hasFollowerData = followers != null ? 1 : 0;
  const followerTier = getFollowerTier(followers);

  // Views per follower (cap at 50, normalize /50)
  const viewsPerFollower =
    followers != null && followers > 0 ? clamp01(views / followers / 50) : 0;

  // Time signals from uploaded_at
  let weekdayPosted = 0.5; // default unknown
  let hourPosted = 0.5; // default unknown
  if (uploadedAt && !isNaN(uploadedAt.getTime())) {
    weekdayPosted = uploadedAt.getUTCDay() / 6; // 0-6 normalized to 0-1
    hourPosted = uploadedAt.getUTCHours() / 23; // 0-23 normalized to 0-1
  }

  return {
    shareRate,
    commentRate,
    likeRate,
    saveRate,
    shareToLikeRatio,
    commentToLikeRatio,
    durationSeconds,
    hashtagCount,
    hasTrendingSound,
    captionLength,
    hasFollowerData,
    followerTier,
    viewsPerFollower,
    weekdayPosted,
    hourPosted,
  };
}

function featureToArray(f: TrainingFeature): number[] {
  return FEATURE_NAMES.map((name) => f[name]);
}

// ─── Label Assignment ───────────────────────────────────────────────

interface CalibrationBaseline {
  virality_tiers: Array<{
    tier: number;
    weighted_score_threshold: { min: number; max: number };
  }>;
}

function loadCalibrationBaseline(): CalibrationBaseline {
  const path = resolve(__dirname, "../src/lib/engine/calibration-baseline.json");
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as CalibrationBaseline;
}

function computeWES(video: ScrapedVideo): number {
  const views = Number(video.views) || 1;
  const likes = Number(video.likes) || 0;
  const comments = Number(video.comments) || 0;
  const shares = Number(video.shares) || 0;
  return (likes * 1 + comments * 2 + shares * 3) / views;
}

function assignViralityTier(
  wes: number,
  tiers: CalibrationBaseline["virality_tiers"]
): number {
  // Tiers are ordered 1-5, check from highest to lowest
  for (let i = tiers.length - 1; i >= 0; i--) {
    const tier = tiers[i]!;
    if (i === tiers.length - 1) {
      // Tier 5: >= min threshold
      if (wes >= tier.weighted_score_threshold.min) return tier.tier;
    } else if (i === 0) {
      // Tier 1: < max threshold (catch-all)
      return tier.tier;
    } else {
      // Middle tiers: >= min threshold
      if (wes >= tier.weighted_score_threshold.min) return tier.tier;
    }
  }
  return 1; // fallback
}

// ─── Deterministic Shuffle ──────────────────────────────────────────

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}

function deterministicShuffle<T>(arr: T[], seeds: string[]): T[] {
  const result = [...arr];
  // Seed-based Fisher-Yates using video IDs as seeds
  for (let i = result.length - 1; i > 0; i--) {
    const seed = seeds[i] ?? String(i);
    const j = simpleHash(seed + String(i)) % (i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

// ─── Main Script ────────────────────────────────────────────────────

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    log("ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

  // ─── Step 1: Load calibration baseline ─────────────────────────
  log("Step 1: Loading calibration baseline for tier assignment...");
  const baseline = loadCalibrationBaseline();
  log(`  Loaded ${baseline.virality_tiers.length} virality tiers`);
  for (const tier of baseline.virality_tiers) {
    log(
      `  Tier ${tier.tier}: WES ${tier.weighted_score_threshold.min.toFixed(6)} - ${tier.weighted_score_threshold.max.toFixed(6)}`
    );
  }

  // ─── Step 2: Fetch scraped videos in batches ──────────────────
  log("Step 2: Fetching scraped_videos from Supabase...");

  const allRows: ScrapedVideo[] = [];
  const BATCH_SIZE = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("scraped_videos")
      .select("*")
      .is("archived_at", null)
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      log(`ERROR fetching batch at offset ${offset}: ${error.message}`);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allRows.push(...data);
      offset += BATCH_SIZE;
      if (data.length < BATCH_SIZE) hasMore = false;
    }
  }

  log(`  Fetched ${allRows.length} total rows`);

  if (allRows.length === 0) {
    log("ERROR: No data found. Cannot produce training data.");
    process.exit(1);
  }

  // ─── Step 3: Filter (views > 0, duration > 0) ────────────────
  log("Step 3: Filtering invalid records...");

  let nullViews = 0,
    zeroViews = 0,
    nullDuration = 0,
    zeroDuration = 0;

  const filtered = allRows.filter((v) => {
    if (v.views === null || v.views === undefined) {
      nullViews++;
      return false;
    }
    if (Number(v.views) === 0) {
      zeroViews++;
      return false;
    }
    if (v.duration_seconds === null || v.duration_seconds === undefined) {
      nullDuration++;
      return false;
    }
    if (Number(v.duration_seconds) === 0) {
      zeroDuration++;
      return false;
    }
    return true;
  });

  const removed = nullViews + zeroViews + nullDuration + zeroDuration;
  log(
    `  Removed ${removed} records (null views: ${nullViews}, zero views: ${zeroViews}, null duration: ${nullDuration}, zero duration: ${zeroDuration})`
  );
  log(`  Valid records: ${filtered.length}`);

  // ─── Step 4: Extract features and assign labels ───────────────
  log("Step 4: Extracting features and assigning virality tier labels...");

  const samples: TrainingSample[] = [];
  const labelCounts: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  const videoIds: string[] = [];

  for (const video of filtered) {
    const features = extractFeatures(video);
    const featureArray = featureToArray(features);

    // Verify all features are in 0-1 range
    const outOfRange = featureArray.some((f) => f < 0 || f > 1);
    if (outOfRange) {
      log(`  WARNING: Feature out of range for video ${video.platform_video_id}`);
      continue;
    }

    const wes = computeWES(video);
    const tier = assignViralityTier(wes, baseline.virality_tiers);

    samples.push({ features: featureArray, label: tier });
    labelCounts[String(tier)] = (labelCounts[String(tier)] || 0) + 1;
    videoIds.push(video.platform_video_id);
  }

  log(`  Extracted ${samples.length} training samples with ${FEATURE_NAMES.length} features each`);
  log(`  Label distribution: ${JSON.stringify(labelCounts)}`);

  // ─── Step 5: Deterministic shuffle and 80/20 split ────────────
  log("Step 5: Shuffling (deterministic) and splitting 80/20...");

  const shuffled = deterministicShuffle(samples, videoIds);
  const splitIndex = Math.floor(shuffled.length * 0.8);

  const trainSamples = shuffled.slice(0, splitIndex);
  const testSamples = shuffled.slice(splitIndex);

  log(`  Train set: ${trainSamples.length}, Test set: ${testSamples.length}`);

  // Verify split distribution
  const trainDist: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  const testDist: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  for (const s of trainSamples) trainDist[String(s.label)] = (trainDist[String(s.label)] || 0) + 1;
  for (const s of testSamples) testDist[String(s.label)] = (testDist[String(s.label)] || 0) + 1;
  log(`  Train distribution: ${JSON.stringify(trainDist)}`);
  log(`  Test distribution: ${JSON.stringify(testDist)}`);

  // Spot-check: verify a few samples have features in 0-1 range
  const spotChecks = [0, Math.floor(trainSamples.length / 2), trainSamples.length - 1];
  for (const idx of spotChecks) {
    const sample = trainSamples[idx];
    if (sample) {
      const allInRange = sample.features.every((f) => f >= 0 && f <= 1);
      log(`  Spot check sample ${idx}: ${allInRange ? "OK" : "OUT OF RANGE"} (label: ${sample.label})`);
    }
  }

  // ─── Step 6: Write output ─────────────────────────────────────
  log("Step 6: Writing training-data.json...");

  const output: TrainingDataOutput = {
    generatedAt: new Date().toISOString(),
    featureNames: FEATURE_NAMES as string[],
    trainSet: {
      features: trainSamples.map((s) => s.features),
      labels: trainSamples.map((s) => s.label),
      count: trainSamples.length,
    },
    testSet: {
      features: testSamples.map((s) => s.features),
      labels: testSamples.map((s) => s.label),
      count: testSamples.length,
    },
    labelDistribution: labelCounts,
  };

  const outputPath = resolve(__dirname, "../src/lib/engine/training-data.json");
  writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n", "utf-8");
  log(`  Written to ${outputPath}`);

  // Final summary
  log("");
  log("=== Training Data Extraction Complete ===");
  log(`  Total samples: ${samples.length}`);
  log(`  Train: ${trainSamples.length} (${((trainSamples.length / samples.length) * 100).toFixed(1)}%)`);
  log(`  Test: ${testSamples.length} (${((testSamples.length / samples.length) * 100).toFixed(1)}%)`);
  log(`  Features: ${FEATURE_NAMES.length}`);
  log(`  Labels: 1-5 virality tiers`);
}

// ─── Run ─────────────────────────────────────────────────────────────

main().catch((err) => {
  log(`FATAL ERROR: ${err instanceof Error ? err.message : String(err)}`);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
