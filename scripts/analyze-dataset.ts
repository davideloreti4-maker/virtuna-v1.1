import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { resolve } from "path";
import type { Database } from "../src/types/database.types";

// Load .env.local (Next.js convention)
config({ path: resolve(__dirname, "../.env.local") });

// ─── Types ──────────────────────────────────────────────────────────
type ScrapedVideo = Database["public"]["Tables"]["scraped_videos"]["Row"];

interface EnrichedVideo extends ScrapedVideo {
  // Algorithm-aligned metrics
  weighted_engagement_score: number; // (likes×1 + comments×2 + shares×3) / views
  share_rate: number; // shares/views — highest-value measurable signal
  comment_rate: number; // comments/views — conversation signal
  like_rate: number; // likes/views — lowest-value signal
  share_to_like_ratio: number; // shares/likes — distribution vs passive consumption
  comment_to_like_ratio: number; // comments/likes — conversation depth
  // Save rate (bookmarks) — high-intent signal
  save_rate: number; // bookmarks/views — saves = high intent, similar weight to shares
  // View velocity — proxy for early traction
  views_per_day: number | null; // views / days_since_upload
  days_since_upload: number | null;
  // Creator size signals
  followers: number | null;
  views_per_follower: number | null; // >1 = breakout beyond follower base
  creator_size_tier: string | null; // nano/micro/mid/macro/mega
  // Legacy simple ER (kept for backwards compat)
  simple_engagement_rate: number; // (likes+comments+shares)/views
}

// ─── Utility Functions ──────────────────────────────────────────────

const log = (msg: string) => console.log(`[analyze] ${msg}`);

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

function median(arr: number[]): number {
  return percentile(sortedNumbers(arr), 50);
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const sqDiffs = arr.map((v) => (v - m) ** 2);
  return Math.sqrt(sqDiffs.reduce((sum, v) => sum + v, 0) / (arr.length - 1));
}

function computePercentiles(arr: number[]) {
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

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pct(n: number): string {
  return (n * 100).toFixed(3) + "%";
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
    log("WARNING: No data found. Producing empty outputs.");
    writeEmptyOutputs();
    process.exit(0);
  }

  // Deduplicate by platform_video_id — keep latest
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
  log(`  Duplicates removed: ${duplicatesRemoved}, unique: ${uniqueVideos.length}`);

  // ─── Step 2: Outlier Filtering ─────────────────────────────────
  log("Step 2: Filtering outliers...");

  let nullViews = 0, zeroViews = 0, extremeOutliers = 0, zeroDuration = 0, nullDuration = 0;

  const viewsValid = uniqueVideos.filter((v) => {
    if (v.views === null || v.views === undefined) { nullViews++; return false; }
    if (v.views === 0) { zeroViews++; return false; }
    return true;
  });

  const viewValues = viewsValid.map((v) => Number(v.views));
  const sortedViews = sortedNumbers(viewValues);
  const p995Views = percentile(sortedViews, 99.5);
  log(`  View p99.5 threshold: ${p995Views.toLocaleString()}`);

  const filtered = viewsValid.filter((v) => {
    if (Number(v.views) > p995Views) { extremeOutliers++; return false; }
    if (v.duration_seconds === null || v.duration_seconds === undefined) { nullDuration++; return false; }
    if (v.duration_seconds === 0) { zeroDuration++; return false; }
    return true;
  });

  const outliersRemoved = nullViews + zeroViews + extremeOutliers + zeroDuration + nullDuration;
  log(`  Outliers removed: ${outliersRemoved} (null views: ${nullViews}, zero views: ${zeroViews}, extreme: ${extremeOutliers}, null dur: ${nullDuration}, zero dur: ${zeroDuration})`);
  log(`  Analyzed count: ${filtered.length}`);

  if (filtered.length === 0) {
    log("WARNING: All videos filtered. Producing empty outputs.");
    writeEmptyOutputs();
    process.exit(0);
  }

  // ─── Step 3: Compute Algorithm-Aligned Metrics ─────────────────
  log("Step 3: Computing algorithm-aligned engagement metrics...");
  log("  Using TikTok 2025 point system: likes×1, comments×2, shares×3");

  const now = new Date();

  function getCreatorSizeTier(followers: number): string {
    if (followers < 10_000) return "nano";
    if (followers < 100_000) return "micro";
    if (followers < 500_000) return "mid";
    if (followers < 1_000_000) return "macro";
    return "mega";
  }

  const enriched: EnrichedVideo[] = filtered.map((v) => {
    const views = Number(v.views) || 1;
    const likes = Number(v.likes) || 0;
    const comments = Number(v.comments) || 0;
    const shares = Number(v.shares) || 0;
    const meta = v.metadata as Record<string, unknown> | null;
    const bookmarks = Number(meta?.bookmarks) || 0;
    const followers = meta?.followers != null ? Number(meta.followers) : null;
    const uploadedAt = meta?.uploaded_at ? new Date(String(meta.uploaded_at)) : null;
    const daysSinceUpload = uploadedAt ? Math.max(1, (now.getTime() - uploadedAt.getTime()) / (1000 * 60 * 60 * 24)) : null;

    return {
      ...v,
      // Primary: algorithm-weighted score
      weighted_engagement_score: (likes * 1 + comments * 2 + shares * 3) / views,
      // Individual signal rates (ordered by algo importance)
      share_rate: shares / views,
      comment_rate: comments / views,
      like_rate: likes / views,
      // Depth ratios — these reveal content quality independent of reach
      share_to_like_ratio: likes > 0 ? shares / likes : 0,
      comment_to_like_ratio: likes > 0 ? comments / likes : 0,
      // Save rate (bookmarks)
      save_rate: bookmarks / views,
      // View velocity
      views_per_day: daysSinceUpload != null ? views / daysSinceUpload : null,
      days_since_upload: daysSinceUpload,
      // Creator size
      followers,
      views_per_follower: followers != null && followers > 0 ? views / followers : null,
      creator_size_tier: followers != null ? getCreatorSizeTier(followers) : null,
      // Legacy
      simple_engagement_rate: (likes + comments + shares) / views,
    };
  });

  log(`  Enriched ${enriched.length} videos`);

  // ─── Step 4: Primary KPI Analysis ──────────────────────────────
  log("Step 4: Analyzing primary KPIs...");

  const wesValues = enriched.map((v) => v.weighted_engagement_score);
  const shareRateValues = enriched.map((v) => v.share_rate);
  const commentRateValues = enriched.map((v) => v.comment_rate);
  const likeRateValues = enriched.map((v) => v.like_rate);
  const stlValues = enriched.map((v) => v.share_to_like_ratio);
  const ctlValues = enriched.map((v) => v.comment_to_like_ratio);
  const saveRateValues = enriched.map((v) => v.save_rate);
  const simpleERValues = enriched.map((v) => v.simple_engagement_rate);
  const viewsArr = enriched.map((v) => Number(v.views));
  const durationsArr = enriched.map((v) => Number(v.duration_seconds));

  const primaryKPIs = {
    weighted_engagement_score: {
      formula: "(likes×1 + comments×2 + shares×3) / views",
      why: "Mirrors TikTok's 2025 algo point system. Shares (3x) and comments (2x) weighted above likes (1x). Does NOT include completion/rewatches (not available from scraped data).",
      percentiles: computePercentiles(wesValues),
    },
    share_rate: {
      formula: "shares / views",
      why: "Highest-value measurable signal. Shares are weighted 3x likes in TikTok's algo. A share rate of 2-5% indicates strong viral potential (industry benchmark 2025).",
      percentiles: computePercentiles(shareRateValues),
      viral_threshold: round6(percentile(sortedNumbers(shareRateValues), 90)),
      industry_benchmark: "2-5% = strong viral potential",
    },
    comment_rate: {
      formula: "comments / views",
      why: "Conversation signal, weighted 2x likes. Comment quality matters more than quantity in 2025 algo, but we can only measure quantity from scraped data.",
      percentiles: computePercentiles(commentRateValues),
    },
    like_rate: {
      formula: "likes / views",
      why: "Lowest algo signal (1x weight). 'Participation trophy' per TikTok's own point system. Still useful as baseline engagement indicator.",
      percentiles: computePercentiles(likeRateValues),
    },
    share_to_like_ratio: {
      formula: "shares / likes",
      why: "Measures active distribution vs passive consumption. High ratio = content people feel compelled to spread, not just tap 'like'. Strong virality amplifier.",
      percentiles: computePercentiles(stlValues),
      viral_indicator: round6(percentile(sortedNumbers(stlValues), 90)),
    },
    comment_to_like_ratio: {
      formula: "comments / likes",
      why: "Measures conversation depth. High ratio = content that provokes discussion, not just passive approval.",
      percentiles: computePercentiles(ctlValues),
    },
    save_rate: {
      formula: "bookmarks / views",
      why: "Saves/bookmarks = high-intent signal. User deliberately saves for later — similar behavioral weight to shares. Indicates lasting value, not just momentary engagement.",
      percentiles: computePercentiles(saveRateValues),
      viral_threshold: round6(percentile(sortedNumbers(saveRateValues), 90)),
    },
  };

  log(`  Weighted engagement score — p50: ${pct(primaryKPIs.weighted_engagement_score.percentiles.p50)}, p90: ${pct(primaryKPIs.weighted_engagement_score.percentiles.p90)}`);
  log(`  Share rate — p50: ${pct(primaryKPIs.share_rate.percentiles.p50)}, p90 (viral threshold): ${pct(primaryKPIs.share_rate.viral_threshold)}`);
  log(`  Share-to-like ratio — p50: ${primaryKPIs.share_to_like_ratio.percentiles.p50.toFixed(4)}, p90: ${primaryKPIs.share_to_like_ratio.viral_indicator.toFixed(4)}`);

  // ─── Step 5: Virality Tiers (based on weighted score) ──────────
  log("Step 5: Deriving virality tiers from WEIGHTED engagement score...");

  const sortedWES = sortedNumbers(wesValues);
  const wesP25 = percentile(sortedWES, 25);
  const wesP50 = percentile(sortedWES, 50);
  const wesP75 = percentile(sortedWES, 75);
  const wesP90 = percentile(sortedWES, 90);
  const wesMin = sortedWES[0]!;
  const wesMax = sortedWES[sortedWES.length - 1]!;

  const tierBoundaries = [
    { min: wesMin, max: wesP25 },
    { min: wesP25, max: wesP50 },
    { min: wesP50, max: wesP75 },
    { min: wesP75, max: wesP90 },
    { min: wesP90, max: wesMax },
  ];

  const tierLabels = ["Unlikely to perform", "Below average", "Average", "Strong potential", "Viral potential"];
  const tierScoreRanges: [number, number][] = [[0, 25], [25, 45], [45, 65], [65, 80], [80, 100]];

  const viralityTiers = tierBoundaries.map((bounds, i) => {
    const count = enriched.filter((v) => {
      if (i === 0) return v.weighted_engagement_score < bounds.max;
      if (i === tierBoundaries.length - 1) return v.weighted_engagement_score >= bounds.min;
      return v.weighted_engagement_score >= bounds.min && v.weighted_engagement_score < bounds.max;
    }).length;

    // Also compute the median share_rate and comment_rate for this tier
    const tierVideos = enriched.filter((v) => {
      if (i === 0) return v.weighted_engagement_score < bounds.max;
      if (i === tierBoundaries.length - 1) return v.weighted_engagement_score >= bounds.min;
      return v.weighted_engagement_score >= bounds.min && v.weighted_engagement_score < bounds.max;
    });

    return {
      tier: i + 1,
      label: tierLabels[i]!,
      score_range: tierScoreRanges[i]!,
      weighted_score_threshold: { min: round6(bounds.min), max: round6(bounds.max) },
      median_share_rate: round6(median(tierVideos.map((v) => v.share_rate))),
      median_comment_rate: round6(median(tierVideos.map((v) => v.comment_rate))),
      median_like_rate: round6(median(tierVideos.map((v) => v.like_rate))),
      median_save_rate: round6(median(tierVideos.map((v) => v.save_rate))),
      video_count: count,
      percentage: round2((count / enriched.length) * 100),
    };
  });

  for (const t of viralityTiers) {
    log(`  Tier ${t.tier} (${t.label}): ${t.video_count} videos (${t.percentage}%), WES ${pct(t.weighted_score_threshold.min)}-${pct(t.weighted_score_threshold.max)}, share rate ${pct(t.median_share_rate)}`);
  }

  // ─── Step 6: Viral vs Average — Algorithm-Aligned Differentiators ─
  log("Step 6: Computing algorithm-aligned differentiators (viral vs average)...");

  const viralVideos = enriched.filter((v) => v.weighted_engagement_score >= wesP90);
  const averageVideos = enriched.filter((v) => {
    const wesP40 = percentile(sortedWES, 40);
    const wesP60 = percentile(sortedWES, 60);
    return v.weighted_engagement_score >= wesP40 && v.weighted_engagement_score <= wesP60;
  });

  log(`  Viral-tier (WES p90+): ${viralVideos.length} videos`);
  log(`  Average-tier (WES p40-p60): ${averageVideos.length} videos`);

  // Compute differentiators — ordered by algorithm importance
  function diff(factor: string, viralArr: number[], avgArr: number[], unit: string, description: (vAvg: number, aAvg: number, pct: number) => string) {
    const vAvg = mean(viralArr);
    const aAvg = mean(avgArr);
    const diffPct = aAvg > 0 ? ((vAvg - aAvg) / aAvg) * 100 : 0;
    return {
      factor,
      algo_weight: factor === "share_rate" ? "HIGH (3x)" : factor === "save_rate" ? "HIGH (intent)" : factor === "comment_rate" ? "MEDIUM (2x)" : factor === "like_rate" ? "LOW (1x)" : "CONTEXT",
      viral_avg: round6(vAvg),
      average_avg: round6(aAvg),
      difference_pct: round2(diffPct),
      unit,
      description: description(vAvg, aAvg, diffPct),
    };
  }

  const differentiators = [
    // Highest algo weight first
    diff("share_rate", viralVideos.map((v) => v.share_rate), averageVideos.map((v) => v.share_rate), "ratio",
      (v, a, p) => `Viral videos have ${Math.abs(round2(p))}% higher share rate (${pct(v)} vs ${pct(a)}). Shares are weighted 3x in TikTok's algo — this is the strongest signal we can measure.`),
    diff("save_rate", viralVideos.map((v) => v.save_rate), averageVideos.map((v) => v.save_rate), "ratio",
      (v, a, p) => `Viral videos have ${Math.abs(round2(p))}% higher save rate (${pct(v)} vs ${pct(a)}). Saves = high intent — user bookmarks for later. Similar behavioral weight to shares.`),
    diff("share_to_like_ratio", viralVideos.map((v) => v.share_to_like_ratio), averageVideos.map((v) => v.share_to_like_ratio), "ratio",
      (v, a, p) => `Viral videos have ${Math.abs(round2(p))}% higher share-to-like ratio (${round2(v)} vs ${round2(a)}). People don't just like viral content — they actively distribute it.`),
    diff("comment_rate", viralVideos.map((v) => v.comment_rate), averageVideos.map((v) => v.comment_rate), "ratio",
      (v, a, p) => `Viral videos have ${Math.abs(round2(p))}% higher comment rate (${pct(v)} vs ${pct(a)}). Comments weighted 2x in algo.`),
    diff("comment_to_like_ratio", viralVideos.map((v) => v.comment_to_like_ratio), averageVideos.map((v) => v.comment_to_like_ratio), "ratio",
      (v, a, p) => `Viral videos have ${Math.abs(round2(p))}% higher comment-to-like ratio (${round2(v)} vs ${round2(a)}). Deeper conversation signals.`),
    diff("weighted_engagement_score", viralVideos.map((v) => v.weighted_engagement_score), averageVideos.map((v) => v.weighted_engagement_score), "score",
      (v, a, p) => `Viral videos have ${Math.abs(round2(p))}% higher weighted engagement score (${pct(v)} vs ${pct(a)}).`),
    diff("like_rate", viralVideos.map((v) => v.like_rate), averageVideos.map((v) => v.like_rate), "ratio",
      (v, a, p) => `Viral videos have ${Math.abs(round2(p))}% higher like rate (${pct(v)} vs ${pct(a)}). Lowest algo signal but still present.`),
    // Context signals
    diff("duration_seconds", viralVideos.map((v) => Number(v.duration_seconds)), averageVideos.map((v) => Number(v.duration_seconds)), "seconds",
      (v, a, p) => `Viral videos are ${Math.abs(round2(p))}% ${p < 0 ? "shorter" : "longer"} (${round2(v)}s vs ${round2(a)}s). Shorter = higher likely completion rate.`),
    diff("caption_length", viralVideos.map((v) => (v.description ?? "").length), averageVideos.map((v) => (v.description ?? "").length), "chars",
      (v, a, p) => `Viral video captions are ${Math.abs(round2(p))}% ${p < 0 ? "shorter" : "longer"} (${round2(v)} vs ${round2(a)} chars).`),
  ];

  for (const d of differentiators.slice(0, 5)) {
    log(`  ${d.factor}: ${d.description.slice(0, 100)}...`);
  }

  // ─── Step 7: Duration-Engagement Correlation ───────────────────
  log("Step 7: Analyzing duration-engagement correlation...");

  // Duration buckets with ALL metrics, not just simple ER
  const durationBucketMap = new Map<string, { min: number; max: number; wes: number[]; share_rates: number[]; comment_rates: number[] }>();
  for (const v of enriched) {
    const dur = Number(v.duration_seconds);
    let bucketMin: number, bucketMax: number;
    if (dur >= 60) { bucketMin = 60; bucketMax = Infinity; }
    else { bucketMin = Math.floor(dur / 5) * 5; bucketMax = bucketMin + 5; }
    const label = bucketMax === Infinity ? "60s+" : `${bucketMin}-${bucketMax}s`;
    if (!durationBucketMap.has(label)) {
      durationBucketMap.set(label, { min: bucketMin, max: bucketMax, wes: [], share_rates: [], comment_rates: [] });
    }
    const bucket = durationBucketMap.get(label)!;
    bucket.wes.push(v.weighted_engagement_score);
    bucket.share_rates.push(v.share_rate);
    bucket.comment_rates.push(v.comment_rate);
  }

  const durationBuckets = Array.from(durationBucketMap.entries())
    .map(([range, data]) => ({
      range,
      min: data.min,
      max: data.max === Infinity ? 999 : data.max,
      count: data.wes.length,
      median_weighted_score: round6(median(data.wes)),
      median_share_rate: round6(median(data.share_rates)),
      median_comment_rate: round6(median(data.comment_rates)),
    }))
    .sort((a, b) => a.min - b.min);

  // Best bucket by weighted score (min 10 videos)
  const significantBuckets = durationBuckets.filter((b) => b.count >= 10);
  const bestByWES = significantBuckets.length > 0
    ? significantBuckets.reduce((best, b) => b.median_weighted_score > best.median_weighted_score ? b : best)
    : durationBuckets[0]!;
  const bestByShareRate = significantBuckets.length > 0
    ? significantBuckets.reduce((best, b) => b.median_share_rate > best.median_share_rate ? b : best)
    : durationBuckets[0]!;

  const optimalRange: [number, number] = [bestByWES.min, bestByWES.max === 999 ? 60 : bestByWES.max];
  log(`  Duration sweet spot (by WES): ${optimalRange[0]}-${optimalRange[1]}s (median WES: ${pct(bestByWES.median_weighted_score)})`);
  log(`  Best share rate bucket: ${bestByShareRate.range} (median share rate: ${pct(bestByShareRate.median_share_rate)})`);

  // Correlation: compute Pearson correlation between duration and weighted score
  const durWESPairs = enriched.map((v) => ({ dur: Number(v.duration_seconds), wes: v.weighted_engagement_score }));
  const durMean = mean(durWESPairs.map((p) => p.dur));
  const wesMean = mean(durWESPairs.map((p) => p.wes));
  let numerator = 0, denomDur = 0, denomWES = 0;
  for (const p of durWESPairs) {
    const dDur = p.dur - durMean;
    const dWES = p.wes - wesMean;
    numerator += dDur * dWES;
    denomDur += dDur * dDur;
    denomWES += dWES * dWES;
  }
  const pearsonR = denomDur > 0 && denomWES > 0 ? numerator / Math.sqrt(denomDur * denomWES) : 0;
  log(`  Duration-WES Pearson correlation: ${round6(pearsonR)} (${Math.abs(pearsonR) < 0.1 ? "weak" : Math.abs(pearsonR) < 0.3 ? "moderate" : "strong"})`);

  // ─── Step 8: Creator Size Analysis ────────────────────────────
  log("Step 8: Analyzing creator size impact...");

  const withFollowers = enriched.filter((v) => v.followers != null && v.followers > 0);
  log(`  Videos with follower data: ${withFollowers.length}/${enriched.length}`);

  // Creator size tiers
  const sizeTiers = ["nano", "micro", "mid", "macro", "mega"];
  const sizeTierLabels: Record<string, string> = {
    nano: "<10K followers",
    micro: "10K-100K followers",
    mid: "100K-500K followers",
    macro: "500K-1M followers",
    mega: "1M+ followers",
  };

  const creatorSizeAnalysis = sizeTiers.map((tier) => {
    const tierVids = withFollowers.filter((v) => v.creator_size_tier === tier);
    if (tierVids.length === 0) return { tier, label: sizeTierLabels[tier]!, count: 0, median_wes: 0, median_share_rate: 0, median_save_rate: 0, median_views_per_follower: 0, median_followers: 0 };
    return {
      tier,
      label: sizeTierLabels[tier]!,
      count: tierVids.length,
      median_wes: round6(median(tierVids.map((v) => v.weighted_engagement_score))),
      median_share_rate: round6(median(tierVids.map((v) => v.share_rate))),
      median_save_rate: round6(median(tierVids.map((v) => v.save_rate))),
      median_views_per_follower: round2(median(tierVids.filter((v) => v.views_per_follower != null).map((v) => v.views_per_follower!))),
      median_followers: Math.round(median(tierVids.map((v) => v.followers!))),
    };
  });

  for (const t of creatorSizeAnalysis) {
    if (t.count > 0) log(`  ${t.tier} (${t.label}): ${t.count} videos, WES ${pct(t.median_wes)}, share rate ${pct(t.median_share_rate)}, views/follower ${t.median_views_per_follower}x`);
  }

  // Views-per-follower (virality multiplier) — the breakout signal
  const vpfValues = withFollowers.filter((v) => v.views_per_follower != null).map((v) => v.views_per_follower!);
  const vpfPercentiles = vpfValues.length > 0 ? computePercentiles(vpfValues) : null;
  if (vpfPercentiles) {
    log(`  Views/follower — p50: ${vpfPercentiles.p50.toFixed(2)}x, p90: ${vpfPercentiles.p90.toFixed(2)}x`);
  }

  // Size-normalized WES: actual_WES / expected_WES_for_tier
  // Expected = median WES for that creator size tier
  const expectedWESByTier: Record<string, number> = {};
  for (const t of creatorSizeAnalysis) {
    if (t.count > 0) expectedWESByTier[t.tier] = t.median_wes;
  }

  const sizeNormalizedScores = withFollowers
    .filter((v) => v.creator_size_tier && expectedWESByTier[v.creator_size_tier] && expectedWESByTier[v.creator_size_tier]! > 0)
    .map((v) => v.weighted_engagement_score / expectedWESByTier[v.creator_size_tier!]!);
  const sizeNormPercentiles = sizeNormalizedScores.length > 0 ? computePercentiles(sizeNormalizedScores) : null;
  if (sizeNormPercentiles) {
    log(`  Size-normalized WES — p50: ${sizeNormPercentiles.p50.toFixed(2)}x, p90: ${sizeNormPercentiles.p90.toFixed(2)}x (1.0 = expected for size)`);
  }

  // ─── Step 9: View Velocity Analysis ──────────────────────────
  log("Step 9: Analyzing view velocity (traction speed)...");

  const withVelocity = enriched.filter((v) => v.views_per_day != null);
  log(`  Videos with velocity data: ${withVelocity.length}/${enriched.length}`);

  const velocityValues = withVelocity.map((v) => v.views_per_day!);
  const velocityPercentiles = velocityValues.length > 0 ? computePercentiles(velocityValues) : null;

  if (velocityPercentiles) {
    log(`  Views/day — p50: ${Math.round(velocityPercentiles.p50).toLocaleString()}, p90: ${Math.round(velocityPercentiles.p90).toLocaleString()}, p99: ${Math.round(velocityPercentiles.p99).toLocaleString()}`);
  }

  // Velocity by virality tier
  const velocityByTier = viralityTiers.map((t) => {
    const tierVids = withVelocity.filter((v) => {
      const wes = v.weighted_engagement_score;
      if (t.tier === 1) return wes < wesP25;
      if (t.tier === 5) return wes >= wesP90;
      const bounds = tierBoundaries[t.tier - 1]!;
      return wes >= bounds.min && wes < bounds.max;
    });
    return {
      tier: t.tier,
      label: t.label,
      count: tierVids.length,
      median_views_per_day: tierVids.length > 0 ? Math.round(median(tierVids.map((v) => v.views_per_day!))) : 0,
    };
  });

  for (const t of velocityByTier) {
    log(`  Tier ${t.tier} velocity: ${t.median_views_per_day.toLocaleString()} views/day (${t.count} videos)`);
  }

  // Velocity-WES correlation
  const velWESPairs = withVelocity.map((v) => ({ vel: v.views_per_day!, wes: v.weighted_engagement_score }));
  const velMean = mean(velWESPairs.map((p) => p.vel));
  const velWESMean = mean(velWESPairs.map((p) => p.wes));
  let velNum = 0, velDenVel = 0, velDenWES = 0;
  for (const p of velWESPairs) {
    const dV = p.vel - velMean;
    const dW = p.wes - velWESMean;
    velNum += dV * dW;
    velDenVel += dV * dV;
    velDenWES += dW * dW;
  }
  const velocityCorrelation = velDenVel > 0 && velDenWES > 0 ? velNum / Math.sqrt(velDenVel * velDenWES) : 0;
  log(`  Velocity-WES correlation: ${round6(velocityCorrelation)} (${Math.abs(velocityCorrelation) < 0.1 ? "weak" : Math.abs(velocityCorrelation) < 0.3 ? "moderate" : "strong"})`);

  // ─── Step 10: Context Signals (hashtags, sounds — demoted) ──────
  log("Step 10: Mining context signals (hashtags, sounds — secondary)...");

  // Hashtags — track weighted score, not just simple ER
  const hashtagFreq = new Map<string, { count: number; wes: number[] }>();
  for (const v of enriched) {
    for (const tag of v.hashtags ?? []) {
      if (!tag) continue;
      const normalized = tag.toLowerCase().replace(/^#/, "");
      if (!normalized) continue;
      if (!hashtagFreq.has(normalized)) hashtagFreq.set(normalized, { count: 0, wes: [] });
      const entry = hashtagFreq.get(normalized)!;
      entry.count++;
      entry.wes.push(v.weighted_engagement_score);
    }
  }

  const medianWES = median(wesValues);
  const topHashtags = Array.from(hashtagFreq.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 30)
    .map(([tag, data], i) => {
      const medWES = i < 20 ? median(data.wes) : 0;
      return {
        tag,
        count: data.count,
        median_weighted_score: round6(medWES),
        is_power_hashtag: i < 20 && medWES > medianWES && data.count >= 5,
      };
    });

  log(`  Hashtags: ${topHashtags.length}, power: ${topHashtags.filter((h) => h.is_power_hashtag).length}`);

  // Sounds
  const soundFreq = new Map<string, { count: number; wes: number[] }>();
  for (const v of enriched) {
    if (!v.sound_name?.trim()) continue;
    const name = v.sound_name.trim();
    if (!soundFreq.has(name)) soundFreq.set(name, { count: 0, wes: [] });
    const entry = soundFreq.get(name)!;
    entry.count++;
    entry.wes.push(v.weighted_engagement_score);
  }

  const viralSoundFreqs = new Map<string, number>();
  for (const v of viralVideos) {
    if (v.sound_name?.trim()) {
      const name = v.sound_name.trim();
      viralSoundFreqs.set(name, (viralSoundFreqs.get(name) || 0) + 1);
    }
  }

  const topSounds = Array.from(soundFreq.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
    .map(([name, data], i) => {
      const medWES = i < 15 ? median(data.wes) : 0;
      const overallPct = data.count / enriched.length;
      const viralCount = viralSoundFreqs.get(name) || 0;
      const viralPct = viralVideos.length > 0 ? viralCount / viralVideos.length : 0;
      return {
        name,
        count: data.count,
        median_weighted_score: round6(medWES),
        viral_overrepresentation: overallPct > 0 ? round2(viralPct / overallPct) : 0,
      };
    });

  log(`  Sounds: ${topSounds.length}`);

  // ─── Step 11: Write calibration-baseline.json ───────────────────
  log("Step 11: Writing algorithm-aligned calibration-baseline.json...");

  const totalLikes = enriched.reduce((s, v) => s + (Number(v.likes) || 0), 0);
  const totalComments = enriched.reduce((s, v) => s + (Number(v.comments) || 0), 0);
  const totalShares = enriched.reduce((s, v) => s + (Number(v.shares) || 0), 0);
  const totalViews = enriched.reduce((s, v) => s + Number(v.views), 0);

  const baseline = {
    generated_at: new Date().toISOString(),
    methodology: "Algorithm-aligned analysis using TikTok's 2025-2026 engagement point system. Primary metrics weighted by algo importance: shares (3x) > comments (2x) > likes (1x). Completion rate and rewatches (4x, 5x) cannot be measured from scraped data.",
    algorithm_signal_weights: {
      rewatches: { points: 5, measurable: false, note: "Requires analytics access" },
      full_watch_completion: { points: 4, measurable: false, note: "Requires analytics access. 70% completion = viral threshold (2025)" },
      shares: { points: 3, measurable: true, note: "Highest measurable signal. 2-5% share rate = strong viral potential" },
      comments: { points: 2, measurable: true, note: "Quality > quantity in 2025 algo, but we measure quantity" },
      likes: { points: 1, measurable: true, note: "Lowest signal — 'participation trophy'" },
    },
    dataset_stats: {
      total_fetched: totalFetched,
      duplicates_removed: duplicatesRemoved,
      outliers_removed: outliersRemoved,
      outliers_breakdown: { zero_views: zeroViews, null_views: nullViews, extreme_outliers: extremeOutliers, zero_duration: zeroDuration, null_duration: nullDuration },
      analyzed_count: enriched.length,
    },
    primary_kpis: primaryKPIs,
    virality_tiers: viralityTiers,
    viral_vs_average: {
      viral_count: viralVideos.length,
      average_count: averageVideos.length,
      viral_definition: "Weighted engagement score >= p90",
      average_definition: "Weighted engagement score p40-p60",
      differentiators,
    },
    duration_analysis: {
      sweet_spot_by_weighted_score: {
        optimal_range_seconds: optimalRange,
        median_weighted_score: bestByWES.median_weighted_score,
      },
      sweet_spot_by_share_rate: {
        range: bestByShareRate.range,
        median_share_rate: bestByShareRate.median_share_rate,
      },
      duration_weighted_score_correlation: {
        pearson_r: round6(pearsonR),
        strength: Math.abs(pearsonR) < 0.1 ? "weak" : Math.abs(pearsonR) < 0.3 ? "moderate" : "strong",
        note: "Negative = shorter videos tend to have higher engagement",
      },
      buckets: durationBuckets,
    },
    creator_size_analysis: {
      note: "TikTok's algo is content-first, not creator-first. But creator size affects expected engagement: small accounts get higher ER naturally. Size-normalizing helps compare apples-to-apples.",
      videos_with_follower_data: withFollowers.length,
      size_tiers: creatorSizeAnalysis,
      views_per_follower: {
        note: "Virality multiplier: views / followers. >1 = content reached beyond the creator's audience. This is the 'breakout' signal.",
        percentiles: vpfPercentiles,
      },
      size_normalized_wes: {
        note: "actual_WES / expected_WES_for_creator_size. A score of 2.0 means this video's engagement is 2x what's expected for its creator's follower tier.",
        percentiles: sizeNormPercentiles,
      },
      expected_wes_by_tier: expectedWESByTier,
    },
    view_velocity: {
      note: "Views per day since upload. Early traction is the #1 distribution signal — videos that gain 1000+ views with 75% completion in the first hour get major algo boost. We compute views/day as a proxy (per-hour data not available from scraping).",
      videos_with_velocity_data: withVelocity.length,
      percentiles: velocityPercentiles,
      by_virality_tier: velocityByTier,
      velocity_wes_correlation: {
        pearson_r: round6(velocityCorrelation),
        strength: Math.abs(velocityCorrelation) < 0.1 ? "weak" : Math.abs(velocityCorrelation) < 0.3 ? "moderate" : "strong",
        note: "Positive = faster-growing videos tend to have higher engagement scores",
      },
    },
    aggregate_ratios: {
      likes_per_100_views: totalViews > 0 ? round2((totalLikes / totalViews) * 100) : 0,
      comments_per_100_views: totalViews > 0 ? round2((totalComments / totalViews) * 100) : 0,
      shares_per_100_views: totalViews > 0 ? round2((totalShares / totalViews) * 100) : 0,
      comments_per_100_likes: totalLikes > 0 ? round2((totalComments / totalLikes) * 100) : 0,
      shares_per_100_likes: totalLikes > 0 ? round2((totalShares / totalLikes) * 100) : 0,
    },
    context_signals: {
      note: "Hashtags and sounds are content context signals for TikTok's recommendation system, NOT primary ranking factors. They help TikTok categorize content but don't directly boost ranking like engagement does.",
      top_hashtags: topHashtags,
      top_sounds: topSounds,
    },
    simple_engagement: {
      note: "Legacy simple (likes+comments+shares)/views. Less accurate than weighted score — treats all signals equally. Kept for backwards compatibility.",
      percentiles: computePercentiles(simpleERValues),
    },
    distribution_stats: {
      views: computePercentiles(viewsArr),
      duration_seconds: computePercentiles(durationsArr),
    },
  };

  const jsonPath = resolve(__dirname, "../src/lib/engine/calibration-baseline.json");
  writeFileSync(jsonPath, JSON.stringify(baseline, null, 2) + "\n", "utf-8");
  log(`  Written to ${jsonPath}`);

  // ─── Step 12: Write markdown summary report ────────────────────
  log("Step 12: Writing markdown summary report...");

  const report = generateMarkdownReport(baseline, enriched, viralVideos, averageVideos);
  const reportPath = resolve(__dirname, "../.planning/phases/01-data-analysis/data-analysis-report.md");
  writeFileSync(reportPath, report, "utf-8");
  log(`  Written to ${reportPath}`);

  log("Analysis complete!");
}

// ─── Empty outputs ──────────────────────────────────────────────────

function writeEmptyOutputs() {
  const jsonPath = resolve(__dirname, "../src/lib/engine/calibration-baseline.json");
  writeFileSync(jsonPath, JSON.stringify({ generated_at: new Date().toISOString(), dataset_stats: { analyzed_count: 0 } }, null, 2) + "\n", "utf-8");
  const reportPath = resolve(__dirname, "../.planning/phases/01-data-analysis/data-analysis-report.md");
  writeFileSync(reportPath, "# Data Analysis Report\n\nNo data available.\n", "utf-8");
}

// ─── Markdown Report Generator ──────────────────────────────────────

function generateMarkdownReport(
  baseline: ReturnType<typeof JSON.parse>,
  enriched: EnrichedVideo[],
  viralVideos: EnrichedVideo[],
  averageVideos: EnrichedVideo[],
): string {
  const lines: string[] = [];
  const add = (s: string) => lines.push(s);
  const ds = baseline.dataset_stats;
  const kpis = baseline.primary_kpis;

  add("# Data Analysis Report: Algorithm-Aligned TikTok Video Analysis");
  add("");
  add(`*Generated: ${baseline.generated_at}*`);
  add(`*Methodology: ${baseline.methodology}*`);
  add("");

  // 1. Executive Summary
  add("## 1. Executive Summary");
  add("");
  add(`- Analyzed **${ds.analyzed_count.toLocaleString()}** TikTok videos using algorithm-aligned weighted engagement scoring`);
  add(`- **TikTok 2025 algo weights**: rewatches (5x) > completion (4x) > shares (3x) > comments (2x) > likes (1x)`);
  add(`- **We measure**: shares (3x), comments (2x), likes (1x). Completion/rewatches require analytics access.`);
  add(`- **Share rate is the #1 measurable virality signal**: p50 = ${pct(kpis.share_rate.percentiles.p50)}, viral threshold (p90) = ${pct(kpis.share_rate.viral_threshold)}`);
  const topDiff = baseline.viral_vs_average.differentiators[0];
  if (topDiff) add(`- ${topDiff.description}`);
  add("");

  // 2. Algorithm Signal Hierarchy
  add("## 2. TikTok Algorithm Signal Hierarchy (2025-2026)");
  add("");
  add("| Signal | Algo Points | Measurable? | Our Metric |");
  add("|--------|-------------|-------------|------------|");
  add("| Rewatches | 5 | No | — |");
  add("| Full watch (completion) | 4 | No | Duration as proxy |");
  add("| Shares | 3 | **Yes** | `share_rate` |");
  add("| Comments | 2 | **Yes** | `comment_rate` |");
  add("| Likes | 1 | **Yes** | `like_rate` |");
  add("");
  add("**Weighted engagement score formula**: `(likes×1 + comments×2 + shares×3) / views`");
  add("");
  add("Sources: [Sprout Social](https://sproutsocial.com/insights/tiktok-algorithm/), [Buffer](https://buffer.com/resources/tiktok-algorithm/), [Fanpage Karma](https://www.fanpagekarma.com/insights/the-2025-tiktok-algorithm-what-you-need-to-know/)");
  add("");

  // 3. Data Quality
  add("## 3. Data Quality");
  add("");
  add("| Metric | Count |");
  add("|--------|-------|");
  add(`| Total rows fetched | ${ds.total_fetched.toLocaleString()} |`);
  add(`| Duplicates removed | ${ds.duplicates_removed.toLocaleString()} |`);
  add(`| Outliers removed | ${ds.outliers_removed} |`);
  add(`| **Final analyzed** | **${ds.analyzed_count.toLocaleString()}** |`);
  add("");

  // 4. Primary KPIs
  add("## 4. Primary KPIs — Percentile Distribution");
  add("");
  for (const [name, kpi] of Object.entries(kpis) as [string, any][]) {
    add(`### ${name}`);
    add(`*${kpi.why}*`);
    add("");
    add("| p10 | p25 | p50 | p75 | p90 | p95 | p99 |");
    add("|-----|-----|-----|-----|-----|-----|-----|");
    const p = kpi.percentiles;
    if (name.includes("ratio") && !name.includes("rate")) {
      add(`| ${p.p10.toFixed(4)} | ${p.p25.toFixed(4)} | ${p.p50.toFixed(4)} | ${p.p75.toFixed(4)} | ${p.p90.toFixed(4)} | ${p.p95.toFixed(4)} | ${p.p99.toFixed(4)} |`);
    } else {
      add(`| ${pct(p.p10)} | ${pct(p.p25)} | ${pct(p.p50)} | ${pct(p.p75)} | ${pct(p.p90)} | ${pct(p.p95)} | ${pct(p.p99)} |`);
    }
    add("");
  }

  // 5. Virality Tiers
  add("## 5. Virality Tiers (Weighted Engagement Score)");
  add("");
  add("| Tier | Label | Score Range | WES Threshold | Median Share Rate | Median Comment Rate | Videos | % |");
  add("|------|-------|-------------|---------------|-------------------|---------------------|--------|---|");
  for (const t of baseline.virality_tiers) {
    add(`| ${t.tier} | ${t.label} | ${t.score_range[0]}-${t.score_range[1]} | ${pct(t.weighted_score_threshold.min)}-${pct(t.weighted_score_threshold.max)} | ${pct(t.median_share_rate)} | ${pct(t.median_comment_rate)} | ${t.video_count} | ${t.percentage}% |`);
  }
  add("");
  add("*Tiers based on weighted engagement score distribution, NOT simple engagement rate.*");
  add("");

  // 6. Key Differentiators
  add("## 6. Key Differentiators — Viral vs Average (Ordered by Algo Weight)");
  add("");
  add(`**Viral**: WES p90+ (${viralVideos.length} videos) | **Average**: WES p40-p60 (${averageVideos.length} videos)`);
  add("");
  for (const d of baseline.viral_vs_average.differentiators) {
    const badge = d.algo_weight === "HIGH (3x)" ? "🔴" : d.algo_weight === "MEDIUM (2x)" ? "🟡" : d.algo_weight === "LOW (1x)" ? "🟢" : "⚪";
    add(`- ${badge} **${d.factor}** [${d.algo_weight}]: ${d.description}`);
  }
  add("");

  // 7. Duration Analysis
  add("## 7. Duration-Engagement Analysis");
  add("");
  const da = baseline.duration_analysis;
  add(`**Sweet spot (by weighted score)**: ${da.sweet_spot_by_weighted_score.optimal_range_seconds[0]}-${da.sweet_spot_by_weighted_score.optimal_range_seconds[1]}s`);
  add(`**Best share rate bucket**: ${da.sweet_spot_by_share_rate.range}`);
  add(`**Duration-engagement correlation**: r=${da.duration_weighted_score_correlation.pearson_r.toFixed(4)} (${da.duration_weighted_score_correlation.strength})`);
  add("");
  add("| Duration | Videos | Median WES | Median Share Rate | Median Comment Rate |");
  add("|----------|--------|------------|-------------------|---------------------|");
  for (const b of da.buckets) {
    add(`| ${b.range} | ${b.count} | ${pct(b.median_weighted_score)} | ${pct(b.median_share_rate)} | ${pct(b.median_comment_rate)} |`);
  }
  add("");

  // 8. Creator Size Analysis
  add("## 8. Creator Size Impact");
  add("");
  if (baseline.creator_size_analysis.videos_with_follower_data > 0) {
    add(`*${baseline.creator_size_analysis.videos_with_follower_data} videos with follower data (${Math.round(baseline.creator_size_analysis.videos_with_follower_data / ds.analyzed_count * 100)}%)*`);
    add("");
    add("| Size Tier | Followers | Videos | Median WES | Median Share Rate | Median Save Rate | Views/Follower |");
    add("|-----------|-----------|--------|------------|-------------------|------------------|----------------|");
    for (const t of baseline.creator_size_analysis.size_tiers) {
      if (t.count > 0) {
        add(`| ${t.tier} | ${t.label} | ${t.count} | ${pct(t.median_wes)} | ${pct(t.median_share_rate)} | ${pct(t.median_save_rate)} | ${t.median_views_per_follower}x |`);
      }
    }
    add("");
    if (baseline.creator_size_analysis.views_per_follower.percentiles) {
      const vpf = baseline.creator_size_analysis.views_per_follower.percentiles;
      add(`**Virality multiplier (views/followers)**: p50 = ${vpf.p50.toFixed(2)}x, p90 = ${vpf.p90.toFixed(2)}x — videos above 1x reached beyond the creator's audience.`);
      add("");
    }
    if (baseline.creator_size_analysis.size_normalized_wes.percentiles) {
      const snw = baseline.creator_size_analysis.size_normalized_wes.percentiles;
      add(`**Size-normalized WES**: p50 = ${snw.p50.toFixed(2)}x expected, p90 = ${snw.p90.toFixed(2)}x expected — adjusts for the natural engagement advantage of smaller accounts.`);
      add("");
    }
  } else {
    add("*No follower data available.*");
    add("");
  }

  // 9. View Velocity
  add("## 9. View Velocity (Traction Speed)");
  add("");
  if (baseline.view_velocity.videos_with_velocity_data > 0) {
    add(`*${baseline.view_velocity.videos_with_velocity_data} videos with upload date data*`);
    add("");
    if (baseline.view_velocity.percentiles) {
      const vp = baseline.view_velocity.percentiles;
      add(`**Views/day**: p50 = ${Math.round(vp.p50).toLocaleString()}, p90 = ${Math.round(vp.p90).toLocaleString()}, p99 = ${Math.round(vp.p99).toLocaleString()}`);
      add("");
    }
    add("| Virality Tier | Median Views/Day | Videos |");
    add("|--------------|------------------|--------|");
    for (const t of baseline.view_velocity.by_virality_tier) {
      add(`| ${t.tier}. ${t.label} | ${t.median_views_per_day.toLocaleString()} | ${t.count} |`);
    }
    add("");
    const vc = baseline.view_velocity.velocity_wes_correlation;
    add(`**Velocity-engagement correlation**: r=${vc.pearson_r.toFixed(4)} (${vc.strength}). ${vc.pearson_r > 0 ? "Faster-growing videos tend to have higher engagement." : "Weak or no relationship between velocity and engagement."}`);
    add("");
  } else {
    add("*No upload date data available.*");
    add("");
  }

  // 10. Aggregate Ratios
  add("## 10. Aggregate Engagement Ratios");
  add("");
  const ar = baseline.aggregate_ratios;
  add(`- Per 100 views: **${ar.likes_per_100_views}** likes, **${ar.comments_per_100_views}** comments, **${ar.shares_per_100_views}** shares`);
  add(`- Per 100 likes: **${ar.comments_per_100_likes}** comments, **${ar.shares_per_100_likes}** shares`);
  add("");

  // 11. Context Signals
  add("## 11. Context Signals (Secondary — Not Primary Algo Ranking Factors)");
  add("");
  add("*Hashtags and sounds help TikTok categorize content but don't directly boost ranking. Engagement signals dominate.*");
  add("");
  add("### Top Hashtags");
  add("| Hashtag | Count | Median WES | Power? |");
  add("|---------|-------|------------|--------|");
  for (const h of baseline.context_signals.top_hashtags.slice(0, 15)) {
    add(`| #${h.tag} | ${h.count} | ${pct(h.median_weighted_score)} | ${h.is_power_hashtag ? "Yes" : ""} |`);
  }
  add("");
  add("### Top Sounds");
  add("| Sound | Count | Median WES | Viral Overrep. |");
  add("|-------|-------|------------|----------------|");
  for (const s of baseline.context_signals.top_sounds.slice(0, 10)) {
    add(`| ${s.name.slice(0, 40)} | ${s.count} | ${pct(s.median_weighted_score)} | ${s.viral_overrepresentation}x |`);
  }
  add("");

  // 12. Implications for Engine
  add("## 12. Implications for Prediction Engine v2");
  add("");
  add("- **Scoring formula must weight by algo importance**: Use `(likes×1 + comments×2 + shares×3) / views` as base. When completion rate becomes available (video upload), weight it 4x.");
  add(`- **Share rate is the virality gateway**: Videos above ${pct(kpis.share_rate.viral_threshold)} share rate (p90) are in the viral tier. This should be the primary signal Gemini and DeepSeek evaluate.`);
  add("- **Save rate is a high-intent confirmation signal**: Bookmarks indicate lasting value — a user deliberately choosing to revisit. Use alongside share rate for composite virality scoring.");
  add("- **Share-to-like ratio reveals content quality**: A video with high likes but low shares is passively consumed, not virally distributed. Flag this in the analysis.");
  add("- **Creator size normalization is critical**: Small accounts naturally get higher ER. When scoring a user's draft, normalize against their tier's expected WES to give fair predictions.");
  add("- **View velocity as confidence multiplier**: Fast-growing views/day correlates with viral content. Use as a post-publish signal to adjust predictions in real-time.");
  add("- **Views/follower ratio detects breakout content**: Content reaching 10x+ the follower base is genuinely viral, regardless of absolute numbers.");
  add(`- **Duration sweet spot**: ${da.sweet_spot_by_weighted_score.optimal_range_seconds[0]}-${da.sweet_spot_by_weighted_score.optimal_range_seconds[1]}s for highest weighted engagement. Use as a calibration signal, not a rule.`);
  add("- **Demote hashtag/sound analysis**: These are content context signals, not ranking factors. Do NOT weight them highly in the prediction formula.");
  add("");

  return lines.join("\n") + "\n";
}

// ─── Run ─────────────────────────────────────────────────────────────

main().catch((err) => {
  log(`FATAL ERROR: ${err instanceof Error ? err.message : String(err)}`);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
