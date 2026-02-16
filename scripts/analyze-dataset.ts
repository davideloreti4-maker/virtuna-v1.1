import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { resolve } from "path";
import type { Database } from "../src/types/database.types";

// Load .env.local (Next.js convention) — dotenv default only loads .env
config({ path: resolve(__dirname, "../.env.local") });

// ─── Types ──────────────────────────────────────────────────────────
type ScrapedVideo = Database["public"]["Tables"]["scraped_videos"]["Row"];

interface EnrichedVideo extends ScrapedVideo {
  engagement_rate: number;
  like_ratio: number;
  comment_ratio: number;
  share_ratio: number;
}

interface DurationBucket {
  range: string;
  min: number;
  max: number;
  count: number;
  median_er: number;
}

interface ViralityTier {
  tier: number;
  label: string;
  score_range: [number, number];
  engagement_rate_threshold: { min: number; max: number };
  video_count: number;
  percentage: number;
}

interface HashtagEntry {
  tag: string;
  count: number;
  median_er: number;
  is_power_hashtag: boolean;
}

interface SoundEntry {
  name: string;
  count: number;
  median_er: number;
  viral_overrepresentation: number;
}

interface KeyDifferentiator {
  factor: string;
  viral_avg: number;
  average_avg: number;
  difference_pct: number;
  description: string;
}

interface CategoryEntry {
  name: string;
  count: number;
  median_er: number;
  median_views: number;
}

interface CalibrationBaseline {
  generated_at: string;
  dataset_stats: {
    total_fetched: number;
    duplicates_removed: number;
    outliers_removed: number;
    outliers_breakdown: {
      zero_views: number;
      null_views: number;
      extreme_outliers: number;
      zero_duration: number;
      null_duration: number;
    };
    analyzed_count: number;
  };
  virality_tiers: ViralityTier[];
  engagement_percentiles: Record<string, number>;
  duration_sweet_spot: {
    optimal_range_seconds: [number, number];
    median_engagement_rate: number;
    duration_buckets: DurationBucket[];
  };
  top_hashtags: HashtagEntry[];
  top_sounds: SoundEntry[];
  engagement_ratios: {
    likes_per_100_views: number;
    comments_per_100_views: number;
    shares_per_100_views: number;
    like_comment_share_ratio: string;
  };
  key_differentiators: KeyDifferentiator[];
  view_percentiles: Record<string, number>;
  categories: CategoryEntry[];
  distribution_stats: {
    views: Record<string, number>;
    likes: Record<string, number>;
    shares: Record<string, number>;
    comments: Record<string, number>;
    engagement_rate: Record<string, number>;
    duration_seconds: Record<string, number>;
  };
}

// ─── Utility Functions ──────────────────────────────────────────────

const log = (msg: string) => console.log(`[analyze] ${msg}`);

/** Sort numbers ascending for percentile computation */
function sortedNumbers(arr: number[]): number[] {
  return [...arr].sort((a, b) => a - b);
}

/** Compute a percentile value from a sorted array using linear interpolation */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower]!;
  const weight = index - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

/** Compute median (p50) */
function median(arr: number[]): number {
  const sorted = sortedNumbers(arr);
  return percentile(sorted, 50);
}

/** Compute mean */
function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

/** Compute standard deviation */
function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const sqDiffs = arr.map((v) => (v - m) ** 2);
  return Math.sqrt(sqDiffs.reduce((sum, v) => sum + v, 0) / (arr.length - 1));
}

/** Compute all standard percentiles for an array */
function computePercentiles(arr: number[]): Record<string, number> {
  const sorted = sortedNumbers(arr);
  return {
    p10: round6(percentile(sorted, 10)),
    p25: round6(percentile(sorted, 25)),
    p50: round6(percentile(sorted, 50)),
    p75: round6(percentile(sorted, 75)),
    p90: round6(percentile(sorted, 90)),
    p95: round6(percentile(sorted, 95)),
    p99: round6(percentile(sorted, 99)),
    mean: round6(mean(arr)),
    stddev: round6(stddev(arr)),
  };
}

/** Round to 6 decimal places to avoid floating point noise */
function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

/** Round to 2 decimal places for human-readable output */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Main Script ────────────────────────────────────────────────────

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    log("ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    log("Ensure .env.local is present with both variables set.");
    process.exit(1);
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

  // ─── Step 1: Fetch and Deduplicate ─────────────────────────────
  log("Step 1: Fetching scraped_videos from Supabase...");

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

  const totalFetched = allRows.length;
  log(`  Fetched ${totalFetched} total rows`);

  if (totalFetched === 0) {
    log("WARNING: No data found in scraped_videos. Producing empty-state outputs.");
    writeEmptyOutputs();
    process.exit(0);
  }

  // Deduplicate by platform_video_id — keep latest (highest created_at)
  const deduped = new Map<string, ScrapedVideo>();
  for (const row of allRows) {
    const key = row.platform_video_id;
    const existing = deduped.get(key);
    if (!existing || (row.created_at && (!existing.created_at || row.created_at > existing.created_at))) {
      deduped.set(key, row);
    }
  }

  const uniqueVideos = Array.from(deduped.values());
  const duplicatesRemoved = totalFetched - uniqueVideos.length;
  log(`  Duplicates removed: ${duplicatesRemoved}`);
  log(`  Unique videos: ${uniqueVideos.length}`);

  // ─── Step 2: Outlier Filtering ─────────────────────────────────
  log("Step 2: Filtering outliers...");

  let nullViews = 0;
  let zeroViews = 0;
  let extremeOutliers = 0;
  let zeroDuration = 0;
  let nullDuration = 0;

  // First pass: remove null/0 views to compute p99.5 on valid data
  const viewsValid = uniqueVideos.filter((v) => {
    if (v.views === null || v.views === undefined) {
      nullViews++;
      return false;
    }
    if (v.views === 0) {
      zeroViews++;
      return false;
    }
    return true;
  });

  // Compute p99.5 threshold for celebrity/extreme outlier removal
  const viewValues = viewsValid.map((v) => Number(v.views));
  const sortedViews = sortedNumbers(viewValues);
  const p995Views = percentile(sortedViews, 99.5);
  log(`  View p99.5 threshold: ${p995Views.toLocaleString()}`);

  // Remove extreme outliers and null/0 duration
  const filtered = viewsValid.filter((v) => {
    if (Number(v.views) > p995Views) {
      extremeOutliers++;
      return false;
    }
    if (v.duration_seconds === null || v.duration_seconds === undefined) {
      nullDuration++;
      return false;
    }
    if (v.duration_seconds === 0) {
      zeroDuration++;
      return false;
    }
    return true;
  });

  const outliersRemoved = nullViews + zeroViews + extremeOutliers + zeroDuration + nullDuration;
  log(`  Null views: ${nullViews}`);
  log(`  Zero views: ${zeroViews}`);
  log(`  Extreme outliers (views > ${p995Views.toLocaleString()}): ${extremeOutliers}`);
  log(`  Null duration: ${nullDuration}`);
  log(`  Zero duration: ${zeroDuration}`);
  log(`  Total outliers removed: ${outliersRemoved}`);
  log(`  Analyzed count: ${filtered.length}`);

  if (filtered.length === 0) {
    log("WARNING: All videos filtered out. Producing empty-state outputs.");
    writeEmptyOutputs();
    process.exit(0);
  }

  // ─── Step 3: Compute Engagement Metrics ────────────────────────
  log("Step 3: Computing engagement metrics...");

  const enriched: EnrichedVideo[] = filtered.map((v) => {
    const views = Number(v.views) || 1; // avoid division by zero (shouldn't happen after filtering)
    const likes = Number(v.likes) || 0;
    const comments = Number(v.comments) || 0;
    const shares = Number(v.shares) || 0;

    return {
      ...v,
      engagement_rate: (likes + comments + shares) / views,
      like_ratio: likes / views,
      comment_ratio: comments / views,
      share_ratio: shares / views,
    };
  });

  log(`  Enriched ${enriched.length} videos with engagement metrics`);

  // ─── Step 4: Statistical Analysis ──────────────────────────────
  log("Step 4: Computing statistical distributions...");

  const erValues = enriched.map((v) => v.engagement_rate);
  const viewsArr = enriched.map((v) => Number(v.views));
  const likesArr = enriched.map((v) => Number(v.likes) || 0);
  const sharesArr = enriched.map((v) => Number(v.shares) || 0);
  const commentsArr = enriched.map((v) => Number(v.comments) || 0);
  const durationsArr = enriched.map((v) => Number(v.duration_seconds));

  const distributionStats = {
    views: computePercentiles(viewsArr),
    likes: computePercentiles(likesArr),
    shares: computePercentiles(sharesArr),
    comments: computePercentiles(commentsArr),
    engagement_rate: computePercentiles(erValues),
    duration_seconds: computePercentiles(durationsArr),
  };

  log(`  Engagement rate — p50: ${distributionStats.engagement_rate.p50}, p90: ${distributionStats.engagement_rate.p90}`);
  log(`  Views — p50: ${distributionStats.views.p50}, p90: ${distributionStats.views.p90}`);

  // Category counts
  const categoryCounts = new Map<string, number>();
  for (const v of enriched) {
    if (v.category) {
      categoryCounts.set(v.category, (categoryCounts.get(v.category) || 0) + 1);
    }
  }
  log(`  Categories with data: ${categoryCounts.size}`);

  // ─── Step 5: Derive Virality Tiers ─────────────────────────────
  log("Step 5: Deriving virality tiers from engagement rate distribution...");

  const sortedER = sortedNumbers(erValues);
  const erP25 = percentile(sortedER, 25);
  const erP50 = percentile(sortedER, 50);
  const erP75 = percentile(sortedER, 75);
  const erP90 = percentile(sortedER, 90);
  const erMin = sortedER[0]!;
  const erMax = sortedER[sortedER.length - 1]!;

  // Define tiers based on ER percentile boundaries
  const tierBoundaries: Array<{ min: number; max: number }> = [
    { min: erMin, max: erP25 },     // Tier 1: below p25
    { min: erP25, max: erP50 },     // Tier 2: p25-p50
    { min: erP50, max: erP75 },     // Tier 3: p50-p75
    { min: erP75, max: erP90 },     // Tier 4: p75-p90
    { min: erP90, max: erMax },     // Tier 5: above p90
  ];

  const tierLabels = [
    "Unlikely to perform",
    "Below average",
    "Average",
    "Strong potential",
    "Viral potential",
  ];

  const tierScoreRanges: Array<[number, number]> = [
    [0, 25],
    [25, 45],
    [45, 65],
    [65, 80],
    [80, 100],
  ];

  const viralityTiers: ViralityTier[] = tierBoundaries.map((bounds, i) => {
    // Count videos in this tier
    const count = enriched.filter((v) => {
      if (i === 0) return v.engagement_rate < bounds.max;
      if (i === tierBoundaries.length - 1) return v.engagement_rate >= bounds.min;
      return v.engagement_rate >= bounds.min && v.engagement_rate < bounds.max;
    }).length;

    return {
      tier: i + 1,
      label: tierLabels[i]!,
      score_range: tierScoreRanges[i]!,
      engagement_rate_threshold: {
        min: round6(bounds.min),
        max: round6(bounds.max),
      },
      video_count: count,
      percentage: round2((count / enriched.length) * 100),
    };
  });

  // Validate: check distribution shape
  const tier3Pct = viralityTiers[2]!.percentage;
  if (tier3Pct < 15 || tier3Pct > 40) {
    log(`  NOTE: Tier 3 (Average) has ${tier3Pct}% of videos — distribution may be skewed.`);
  }

  for (const t of viralityTiers) {
    log(`  Tier ${t.tier} (${t.label}): ${t.video_count} videos (${t.percentage}%), ER ${t.engagement_rate_threshold.min.toFixed(4)}-${t.engagement_rate_threshold.max.toFixed(4)}`);
  }

  // ─── Step 6: Key Differentiators (Viral vs Average) ────────────
  log("Step 6: Computing key differentiators (viral vs average)...");

  const viralVideos = enriched.filter((v) => v.engagement_rate >= erP90);
  const averageVideos = enriched.filter((v) => {
    const erP40 = percentile(sortedER, 40);
    const erP60 = percentile(sortedER, 60);
    return v.engagement_rate >= erP40 && v.engagement_rate <= erP60;
  });

  log(`  Viral-tier (p90+): ${viralVideos.length} videos`);
  log(`  Average-tier (p40-p60): ${averageVideos.length} videos`);

  const differentiators: KeyDifferentiator[] = [];

  // Duration comparison
  const viralDuration = mean(viralVideos.map((v) => Number(v.duration_seconds)));
  const avgDuration = mean(averageVideos.map((v) => Number(v.duration_seconds)));
  const durationDiff = avgDuration > 0 ? ((viralDuration - avgDuration) / avgDuration) * 100 : 0;
  differentiators.push({
    factor: "duration_seconds",
    viral_avg: round2(viralDuration),
    average_avg: round2(avgDuration),
    difference_pct: round2(durationDiff),
    description: `Viral videos are ${Math.abs(round2(durationDiff))}% ${durationDiff < 0 ? "shorter" : "longer"} on average (${round2(viralDuration)}s vs ${round2(avgDuration)}s)`,
  });

  // Hashtag count comparison
  const viralHashtagCount = mean(viralVideos.map((v) => (v.hashtags ?? []).length));
  const avgHashtagCount = mean(averageVideos.map((v) => (v.hashtags ?? []).length));
  const hashtagDiff = avgHashtagCount > 0 ? ((viralHashtagCount - avgHashtagCount) / avgHashtagCount) * 100 : 0;
  differentiators.push({
    factor: "hashtag_count",
    viral_avg: round2(viralHashtagCount),
    average_avg: round2(avgHashtagCount),
    difference_pct: round2(hashtagDiff),
    description: `Viral videos use ${Math.abs(round2(hashtagDiff))}% ${hashtagDiff < 0 ? "fewer" : "more"} hashtags (${round2(viralHashtagCount)} vs ${round2(avgHashtagCount)})`,
  });

  // Caption length comparison
  const viralCaptionLen = mean(viralVideos.map((v) => (v.description ?? "").length));
  const avgCaptionLen = mean(averageVideos.map((v) => (v.description ?? "").length));
  const captionDiff = avgCaptionLen > 0 ? ((viralCaptionLen - avgCaptionLen) / avgCaptionLen) * 100 : 0;
  differentiators.push({
    factor: "caption_length",
    viral_avg: round2(viralCaptionLen),
    average_avg: round2(avgCaptionLen),
    difference_pct: round2(captionDiff),
    description: `Viral video captions are ${Math.abs(round2(captionDiff))}% ${captionDiff < 0 ? "shorter" : "longer"} (${round2(viralCaptionLen)} vs ${round2(avgCaptionLen)} chars)`,
  });

  // Sound usage comparison
  const viralWithSound = viralVideos.filter((v) => v.sound_name).length;
  const viralSoundPct = viralVideos.length > 0 ? (viralWithSound / viralVideos.length) * 100 : 0;
  const avgWithSound = averageVideos.filter((v) => v.sound_name).length;
  const avgSoundPct = averageVideos.length > 0 ? (avgWithSound / averageVideos.length) * 100 : 0;
  const soundDiff = avgSoundPct > 0 ? ((viralSoundPct - avgSoundPct) / avgSoundPct) * 100 : 0;
  differentiators.push({
    factor: "sound_usage_pct",
    viral_avg: round2(viralSoundPct),
    average_avg: round2(avgSoundPct),
    difference_pct: round2(soundDiff),
    description: `${round2(viralSoundPct)}% of viral videos have a named sound vs ${round2(avgSoundPct)}% of average (${round2(Math.abs(soundDiff))}% ${soundDiff > 0 ? "higher" : "lower"})`,
  });

  // Share ratio comparison
  const viralShareRatio = mean(viralVideos.map((v) => v.share_ratio));
  const avgShareRatio = mean(averageVideos.map((v) => v.share_ratio));
  const shareRatioDiff = avgShareRatio > 0 ? ((viralShareRatio - avgShareRatio) / avgShareRatio) * 100 : 0;
  differentiators.push({
    factor: "share_ratio",
    viral_avg: round6(viralShareRatio),
    average_avg: round6(avgShareRatio),
    difference_pct: round2(shareRatioDiff),
    description: `Viral videos have ${Math.abs(round2(shareRatioDiff))}% ${shareRatioDiff > 0 ? "higher" : "lower"} share ratio (${(viralShareRatio * 100).toFixed(3)}% vs ${(avgShareRatio * 100).toFixed(3)}%)`,
  });

  // Comment ratio comparison
  const viralCommentRatio = mean(viralVideos.map((v) => v.comment_ratio));
  const avgCommentRatio = mean(averageVideos.map((v) => v.comment_ratio));
  const commentRatioDiff = avgCommentRatio > 0 ? ((viralCommentRatio - avgCommentRatio) / avgCommentRatio) * 100 : 0;
  differentiators.push({
    factor: "comment_ratio",
    viral_avg: round6(viralCommentRatio),
    average_avg: round6(avgCommentRatio),
    difference_pct: round2(commentRatioDiff),
    description: `Viral videos have ${Math.abs(round2(commentRatioDiff))}% ${commentRatioDiff > 0 ? "higher" : "lower"} comment ratio (${(viralCommentRatio * 100).toFixed(3)}% vs ${(avgCommentRatio * 100).toFixed(3)}%)`,
  });

  for (const d of differentiators) {
    log(`  ${d.description}`);
  }

  // ─── Step 7: Pattern Mining ────────────────────────────────────
  log("Step 7: Mining patterns...");

  // Duration sweet spot — bucket into 5s intervals
  const durationBucketMap = new Map<string, { min: number; max: number; ers: number[] }>();
  for (const v of enriched) {
    const dur = Number(v.duration_seconds);
    let bucketMin: number;
    let bucketMax: number;
    if (dur >= 60) {
      bucketMin = 60;
      bucketMax = Infinity;
    } else {
      bucketMin = Math.floor(dur / 5) * 5;
      bucketMax = bucketMin + 5;
    }
    const label = bucketMax === Infinity ? "60s+" : `${bucketMin}-${bucketMax}s`;
    if (!durationBucketMap.has(label)) {
      durationBucketMap.set(label, { min: bucketMin, max: bucketMax, ers: [] });
    }
    durationBucketMap.get(label)!.ers.push(v.engagement_rate);
  }

  const durationBuckets: DurationBucket[] = Array.from(durationBucketMap.entries())
    .map(([range, data]) => ({
      range,
      min: data.min,
      max: data.max === Infinity ? 999 : data.max,
      count: data.ers.length,
      median_er: round6(median(data.ers)),
    }))
    .sort((a, b) => a.min - b.min);

  // Find bucket with highest median ER (with at least 10 videos for statistical significance)
  const significantBuckets = durationBuckets.filter((b) => b.count >= 10);
  const bestBucket = significantBuckets.length > 0
    ? significantBuckets.reduce((best, b) => (b.median_er > best.median_er ? b : best))
    : durationBuckets[0]!;

  const optimalRange: [number, number] = [bestBucket.min, bestBucket.max === 999 ? 60 : bestBucket.max];
  log(`  Duration sweet spot: ${optimalRange[0]}-${optimalRange[1]}s (median ER: ${bestBucket.median_er})`);

  // Top hashtags
  const hashtagFreq = new Map<string, { count: number; ers: number[] }>();
  for (const v of enriched) {
    for (const tag of v.hashtags ?? []) {
      if (!tag) continue; // skip null/undefined entries in hashtag arrays
      const normalized = tag.toLowerCase().replace(/^#/, "");
      if (!normalized) continue;
      if (!hashtagFreq.has(normalized)) {
        hashtagFreq.set(normalized, { count: 0, ers: [] });
      }
      const entry = hashtagFreq.get(normalized)!;
      entry.count++;
      entry.ers.push(v.engagement_rate);
    }
  }

  const sortedHashtags = Array.from(hashtagFreq.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 50);

  // Compute median ER for top 20 and flag power hashtags
  const medianEROverall = median(erValues);
  const topHashtags: HashtagEntry[] = sortedHashtags.map(([tag, data], i) => {
    const medER = i < 20 ? median(data.ers) : 0;
    // Power hashtag: high frequency (top 20) AND above-median ER
    const isPower = i < 20 && medER > medianEROverall && data.count >= 5;
    return {
      tag,
      count: data.count,
      median_er: round6(medER),
      is_power_hashtag: isPower,
    };
  });

  const powerHashtags = topHashtags.filter((h) => h.is_power_hashtag);
  log(`  Top hashtags: ${topHashtags.length}, power hashtags: ${powerHashtags.length}`);

  // Top sounds
  const soundFreq = new Map<string, { count: number; ers: number[] }>();
  for (const v of enriched) {
    if (!v.sound_name) continue;
    const name = v.sound_name.trim();
    if (!name) continue;
    if (!soundFreq.has(name)) {
      soundFreq.set(name, { count: 0, ers: [] });
    }
    const entry = soundFreq.get(name)!;
    entry.count++;
    entry.ers.push(v.engagement_rate);
  }

  const sortedSounds = Array.from(soundFreq.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 30);

  // Compute viral overrepresentation for top 15
  // overrepresentation = (% of viral videos using this sound) / (% of all videos using this sound)
  const viralSoundFreqs = new Map<string, number>();
  for (const v of viralVideos) {
    if (v.sound_name) {
      viralSoundFreqs.set(v.sound_name.trim(), (viralSoundFreqs.get(v.sound_name.trim()) || 0) + 1);
    }
  }

  const topSounds: SoundEntry[] = sortedSounds.map(([name, data], i) => {
    const medER = i < 15 ? median(data.ers) : 0;
    // Viral overrepresentation: how much more likely is this sound in viral vs overall
    const overallPct = data.count / enriched.length;
    const viralCount = viralSoundFreqs.get(name) || 0;
    const viralPct = viralVideos.length > 0 ? viralCount / viralVideos.length : 0;
    const overrep = overallPct > 0 ? round2(viralPct / overallPct) : 0;

    return {
      name,
      count: data.count,
      median_er: round6(medER),
      viral_overrepresentation: overrep,
    };
  });

  log(`  Top sounds: ${topSounds.length}`);

  // Engagement ratio patterns
  const totalLikes = likesArr.reduce((s, v) => s + v, 0);
  const totalComments = commentsArr.reduce((s, v) => s + v, 0);
  const totalShares = sharesArr.reduce((s, v) => s + v, 0);
  const totalViews = viewsArr.reduce((s, v) => s + v, 0);

  const likePer100 = totalViews > 0 ? round2((totalLikes / totalViews) * 100) : 0;
  const commentPer100 = totalViews > 0 ? round2((totalComments / totalViews) * 100) : 0;
  const sharePer100 = totalViews > 0 ? round2((totalShares / totalViews) * 100) : 0;

  // Normalize to "per 100 likes"
  const commentsPerLike = totalLikes > 0 ? round2((totalComments / totalLikes) * 100) : 0;
  const sharesPerLike = totalLikes > 0 ? round2((totalShares / totalLikes) * 100) : 0;
  const ratioStr = `100:${commentsPerLike}:${sharesPerLike}`;
  log(`  Engagement ratio (likes:comments:shares) = ${ratioStr}`);

  // Category breakdown
  const categories: CategoryEntry[] = [];
  if (categoryCounts.size > 0) {
    const categoryVideos = new Map<string, EnrichedVideo[]>();
    for (const v of enriched) {
      if (!v.category) continue;
      if (!categoryVideos.has(v.category)) categoryVideos.set(v.category, []);
      categoryVideos.get(v.category)!.push(v);
    }

    for (const [cat, videos] of categoryVideos) {
      categories.push({
        name: cat,
        count: videos.length,
        median_er: round6(median(videos.map((v) => v.engagement_rate))),
        median_views: Math.round(median(videos.map((v) => Number(v.views)))),
      });
    }
    categories.sort((a, b) => b.count - a.count);
    log(`  Categories: ${categories.length}`);
  }

  // ─── Step 8: Write calibration-baseline.json ───────────────────
  log("Step 8: Writing calibration-baseline.json...");

  const baseline: CalibrationBaseline = {
    generated_at: new Date().toISOString(),
    dataset_stats: {
      total_fetched: totalFetched,
      duplicates_removed: duplicatesRemoved,
      outliers_removed: outliersRemoved,
      outliers_breakdown: {
        zero_views: zeroViews,
        null_views: nullViews,
        extreme_outliers: extremeOutliers,
        zero_duration: zeroDuration,
        null_duration: nullDuration,
      },
      analyzed_count: enriched.length,
    },
    virality_tiers: viralityTiers,
    engagement_percentiles: distributionStats.engagement_rate,
    duration_sweet_spot: {
      optimal_range_seconds: optimalRange,
      median_engagement_rate: bestBucket.median_er,
      duration_buckets: durationBuckets.map(({ range, count, median_er }) => ({
        range,
        count,
        median_er,
      })),
    },
    top_hashtags: topHashtags,
    top_sounds: topSounds,
    engagement_ratios: {
      likes_per_100_views: likePer100,
      comments_per_100_views: commentPer100,
      shares_per_100_views: sharePer100,
      like_comment_share_ratio: ratioStr,
    },
    key_differentiators: differentiators,
    view_percentiles: {
      p25: distributionStats.views.p25,
      p50: distributionStats.views.p50,
      p75: distributionStats.views.p75,
      p90: distributionStats.views.p90,
      p99: distributionStats.views.p99,
    },
    categories,
    distribution_stats: distributionStats,
  };

  const jsonPath = resolve(__dirname, "../src/lib/engine/calibration-baseline.json");
  writeFileSync(jsonPath, JSON.stringify(baseline, null, 2) + "\n", "utf-8");
  log(`  Written to ${jsonPath}`);

  // ─── Step 9: Write markdown summary report ─────────────────────
  log("Step 9: Writing markdown summary report...");

  const report = generateMarkdownReport(baseline, enriched, viralVideos, averageVideos);
  const reportPath = resolve(__dirname, "../.planning/phases/01-data-analysis/data-analysis-report.md");
  writeFileSync(reportPath, report, "utf-8");
  log(`  Written to ${reportPath}`);

  log("Analysis complete!");
}

// ─── Empty outputs for graceful handling of empty dataset ────────

function writeEmptyOutputs() {
  const emptyBaseline = {
    generated_at: new Date().toISOString(),
    dataset_stats: {
      total_fetched: 0,
      duplicates_removed: 0,
      outliers_removed: 0,
      outliers_breakdown: { zero_views: 0, null_views: 0, extreme_outliers: 0, zero_duration: 0, null_duration: 0 },
      analyzed_count: 0,
    },
    virality_tiers: [],
    engagement_percentiles: {},
    duration_sweet_spot: { optimal_range_seconds: [0, 0], median_engagement_rate: 0, duration_buckets: [] },
    top_hashtags: [],
    top_sounds: [],
    engagement_ratios: { likes_per_100_views: 0, comments_per_100_views: 0, shares_per_100_views: 0, like_comment_share_ratio: "0:0:0" },
    key_differentiators: [],
    view_percentiles: {},
    categories: [],
    distribution_stats: {},
  };

  const jsonPath = resolve(__dirname, "../src/lib/engine/calibration-baseline.json");
  writeFileSync(jsonPath, JSON.stringify(emptyBaseline, null, 2) + "\n", "utf-8");

  const reportPath = resolve(__dirname, "../.planning/phases/01-data-analysis/data-analysis-report.md");
  writeFileSync(reportPath, "# Data Analysis Report\n\nNo data available. The scraped_videos table is empty.\n", "utf-8");

  log("Empty outputs written.");
}

// ─── Markdown Report Generator ──────────────────────────────────

function generateMarkdownReport(
  baseline: CalibrationBaseline,
  enriched: EnrichedVideo[],
  viralVideos: EnrichedVideo[],
  averageVideos: EnrichedVideo[],
): string {
  const { dataset_stats: ds, virality_tiers, engagement_percentiles: ep, duration_sweet_spot, top_hashtags, top_sounds, engagement_ratios, key_differentiators, categories } = baseline;

  const lines: string[] = [];
  const add = (s: string) => lines.push(s);

  add("# Data Analysis Report: Scraped TikTok Videos");
  add("");
  add(`*Generated: ${baseline.generated_at}*`);
  add("");

  // 1. Executive Summary
  add("## 1. Executive Summary");
  add("");
  add(`- Analyzed **${ds.analyzed_count.toLocaleString()}** unique TikTok videos after deduplication and outlier filtering`);
  add(`- Engagement rates range from ${(ep.p10 * 100).toFixed(2)}% (p10) to ${(ep.p99 * 100).toFixed(2)}% (p99), with a median of ${(ep.p50 * 100).toFixed(2)}%`);
  add(`- Optimal video duration is **${duration_sweet_spot.optimal_range_seconds[0]}-${duration_sweet_spot.optimal_range_seconds[1]}s** (highest median engagement rate: ${(duration_sweet_spot.median_engagement_rate * 100).toFixed(2)}%)`);
  const topDiff = key_differentiators[0];
  if (topDiff) {
    add(`- ${topDiff.description}`);
  }
  add(`- ${top_hashtags.filter((h) => h.is_power_hashtag).length} "power hashtags" identified (high frequency + above-median engagement)`);
  add("");

  // 2. Data Quality
  add("## 2. Data Quality");
  add("");
  add("| Metric | Count |");
  add("|--------|-------|");
  add(`| Total rows fetched | ${ds.total_fetched.toLocaleString()} |`);
  add(`| Duplicates removed | ${ds.duplicates_removed.toLocaleString()} |`);
  add(`| Unique videos | ${(ds.total_fetched - ds.duplicates_removed).toLocaleString()} |`);
  add(`| Null views removed | ${ds.outliers_breakdown.null_views} |`);
  add(`| Zero views removed | ${ds.outliers_breakdown.zero_views} |`);
  add(`| Extreme outliers (p99.5+ views) | ${ds.outliers_breakdown.extreme_outliers} |`);
  add(`| Null duration removed | ${ds.outliers_breakdown.null_duration} |`);
  add(`| Zero duration removed | ${ds.outliers_breakdown.zero_duration} |`);
  add(`| Total outliers removed | ${ds.outliers_removed} |`);
  add(`| **Final analyzed count** | **${ds.analyzed_count.toLocaleString()}** |`);
  add("");
  add(`Deduplication rate: ${ds.total_fetched > 0 ? round2((ds.duplicates_removed / ds.total_fetched) * 100) : 0}%`);
  add("");

  // 3. Virality Tiers
  add("## 3. Virality Tiers");
  add("");
  add("| Tier | Label | Score Range | ER Min | ER Max | Videos | % |");
  add("|------|-------|-------------|--------|--------|--------|---|");
  for (const t of virality_tiers) {
    add(`| ${t.tier} | ${t.label} | ${t.score_range[0]}-${t.score_range[1]} | ${(t.engagement_rate_threshold.min * 100).toFixed(3)}% | ${(t.engagement_rate_threshold.max * 100).toFixed(3)}% | ${t.video_count} | ${t.percentage}% |`);
  }
  add("");
  add("*Thresholds derived from actual engagement rate distribution percentiles (p25, p50, p75, p90).*");
  add("");

  // 4. Key Differentiators
  add("## 4. Key Differentiators (Viral vs Average)");
  add("");
  add(`Comparison: **Viral** (top 10%, p90+ ER, ${viralVideos.length} videos) vs **Average** (p40-p60 ER, ${averageVideos.length} videos)`);
  add("");
  for (const d of key_differentiators) {
    add(`- **${d.factor}**: ${d.description}`);
  }
  add("");

  // 5. Duration Analysis
  add("## 5. Duration Analysis");
  add("");
  add(`**Sweet spot:** ${duration_sweet_spot.optimal_range_seconds[0]}-${duration_sweet_spot.optimal_range_seconds[1]}s (median ER: ${(duration_sweet_spot.median_engagement_rate * 100).toFixed(2)}%)`);
  add("");
  add("| Duration | Videos | Median ER |");
  add("|----------|--------|-----------|");
  for (const b of duration_sweet_spot.duration_buckets) {
    const marker = b.range === `${duration_sweet_spot.optimal_range_seconds[0]}-${duration_sweet_spot.optimal_range_seconds[1]}s` ? " **" : "";
    add(`| ${b.range}${marker} | ${b.count} | ${(b.median_er * 100).toFixed(3)}% |`);
  }
  add("");

  // 6. Hashtag Analysis
  add("## 6. Hashtag Analysis");
  add("");
  add("### Top 20 Hashtags");
  add("");
  add("| Rank | Hashtag | Count | Median ER | Power? |");
  add("|------|---------|-------|-----------|--------|");
  for (let i = 0; i < Math.min(20, top_hashtags.length); i++) {
    const h = top_hashtags[i]!;
    add(`| ${i + 1} | #${h.tag} | ${h.count} | ${(h.median_er * 100).toFixed(3)}% | ${h.is_power_hashtag ? "Yes" : ""} |`);
  }
  add("");
  const powerList = top_hashtags.filter((h) => h.is_power_hashtag);
  if (powerList.length > 0) {
    add(`### Power Hashtags (${powerList.length})`);
    add("");
    add("High frequency AND above-median engagement rate:");
    add("");
    for (const h of powerList) {
      add(`- **#${h.tag}** — ${h.count} videos, ${(h.median_er * 100).toFixed(2)}% median ER`);
    }
    add("");
  }

  // 7. Sound Analysis
  add("## 7. Sound Analysis");
  add("");
  add("### Top 15 Sounds");
  add("");
  add("| Rank | Sound | Count | Median ER | Viral Overrep. |");
  add("|------|-------|-------|-----------|----------------|");
  for (let i = 0; i < Math.min(15, top_sounds.length); i++) {
    const s = top_sounds[i]!;
    const overrep = s.viral_overrepresentation > 1 ? `${s.viral_overrepresentation}x` : `${s.viral_overrepresentation}x`;
    add(`| ${i + 1} | ${s.name.slice(0, 50)} | ${s.count} | ${(s.median_er * 100).toFixed(3)}% | ${overrep} |`);
  }
  add("");
  const viralSounds = top_sounds.filter((s) => s.viral_overrepresentation > 1.5);
  if (viralSounds.length > 0) {
    add(`### Viral-Overrepresented Sounds (${viralSounds.length})`);
    add("");
    add("Sounds appearing disproportionately in viral-tier videos (>1.5x overrepresentation):");
    add("");
    for (const s of viralSounds.slice(0, 10)) {
      add(`- **${s.name.slice(0, 60)}** — ${s.viral_overrepresentation}x overrepresentation, ${s.count} videos`);
    }
    add("");
  }

  // 8. Engagement Patterns
  add("## 8. Engagement Patterns");
  add("");
  add("### Per 100 Views");
  add("");
  add(`- **Likes:** ${engagement_ratios.likes_per_100_views}`);
  add(`- **Comments:** ${engagement_ratios.comments_per_100_views}`);
  add(`- **Shares:** ${engagement_ratios.shares_per_100_views}`);
  add("");
  add(`### Like:Comment:Share Ratio`);
  add("");
  add(`For every **100 likes**, there are approximately **${engagement_ratios.like_comment_share_ratio.split(":").slice(1).join(" comments and ")} shares**.`);
  add("");
  add("### Engagement Rate Distribution");
  add("");
  add("| Percentile | Engagement Rate |");
  add("|------------|-----------------|");
  for (const [key, val] of Object.entries(ep)) {
    if (key.startsWith("p")) {
      add(`| ${key.toUpperCase()} | ${(val * 100).toFixed(3)}% |`);
    }
  }
  add(`| Mean | ${(ep.mean * 100).toFixed(3)}% |`);
  add(`| Std Dev | ${(ep.stddev * 100).toFixed(3)}% |`);
  add("");

  // 9. Category Breakdown
  add("## 9. Category Breakdown");
  add("");
  if (categories.length > 0) {
    add("| Category | Videos | Median ER | Median Views |");
    add("|----------|--------|-----------|--------------|");
    for (const c of categories) {
      add(`| ${c.name} | ${c.count} | ${(c.median_er * 100).toFixed(3)}% | ${c.median_views.toLocaleString()} |`);
    }
  } else {
    add("*No category data available in the dataset.*");
  }
  add("");

  // 10. Implications for Engine
  add("## 10. Implications for Engine");
  add("");
  add("Key takeaways for downstream phases:");
  add("");
  add("- **Phase 2 (Gemini Prompts):** Use virality tier thresholds and engagement patterns to calibrate prompt scoring anchors. The engagement rate distribution provides concrete numbers for \"what good looks like\" on TikTok.");
  add("- **Phase 3 (DeepSeek CoT):** Key differentiators between viral and average content should inform the chain-of-thought reasoning — especially duration, share ratio, and hashtag usage patterns.");
  add(`- **Phase 5 (Aggregation Formula):** Duration sweet spot (${duration_sweet_spot.optimal_range_seconds[0]}-${duration_sweet_spot.optimal_range_seconds[1]}s) and engagement ratio patterns provide calibration data for the rules engine component.`);
  add("- **Phase 10 (ML Training):** The full distribution stats and per-tier breakdowns provide training labels. Use engagement rate percentile boundaries as classification thresholds.");
  add("- **Phase 12 (Calibration):** calibration-baseline.json is the ground truth for A/B testing engine accuracy against real TikTok performance data.");
  add("");

  return lines.join("\n") + "\n";
}

// ─── Run ─────────────────────────────────────────────────────────

main().catch((err) => {
  log(`FATAL ERROR: ${err instanceof Error ? err.message : String(err)}`);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
