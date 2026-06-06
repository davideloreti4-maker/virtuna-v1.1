import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { trainModel, stratifiedSplit } from "@/lib/engine/ml";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "cron/retrain-ml" });

export const maxDuration = 120; // Training with dynamic data may take up to ~60s

// =====================================================
// Types
// =====================================================

interface ScrapedVideo {
  views: number | null;
  likes: number | null;
  shares: number | null;
  comments: number | null;
  duration_seconds: number | null;
  hashtags: string[] | null;
  sound_name: string | null;
  description: string | null;
  created_at: string | null;
}

// =====================================================
// Helpers (cron-internal, not exported)
// =====================================================

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Convert a scraped video row into a 15-element feature vector.
 * Feature order matches training-data.json featureNames exactly.
 *
 * saveRate uses likes * 0.15 proxy since scraped_videos has no saves column.
 */
function videoToFeatures(video: ScrapedVideo): number[] {
  const views = video.views ?? 1; // avoid div by zero
  const likes = video.likes ?? 0;
  const shares = video.shares ?? 0;
  const comments = video.comments ?? 0;
  const estimatedSaves = likes * 0.15; // industry proxy — no saves column

  const shareRate = clamp01(shares / views);
  const commentRate = clamp01(comments / views);
  const likeRate = clamp01(likes / views);
  const saveRate = clamp01(estimatedSaves / views);
  const shareToLikeRatio = likes > 0 ? clamp01(shares / likes) : 0;
  const commentToLikeRatio = likes > 0 ? clamp01(comments / likes) : 0;
  const durationSeconds = clamp01((video.duration_seconds ?? 30) / 180);
  const hashtagCount = clamp01(
    (Array.isArray(video.hashtags) ? video.hashtags.length : 0) / 30
  );
  const hasTrendingSound = video.sound_name ? 1 : 0;
  const captionLength = clamp01((video.description?.length ?? 0) / 2000);
  const hasFollowerData = 0;
  const followerTier = 0.5;
  const viewsPerFollower = 0;

  // Temporal features
  const createdDate = new Date(video.created_at ?? Date.now());
  const weekdayPosted = createdDate.getUTCDay() / 6;
  const hourPosted = createdDate.getUTCHours() / 23;

  return [
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
  ];
}

/**
 * Assign tier labels (1-5) using percentile-based quintiles.
 * p20/p40/p60/p80 boundaries partition view counts into 5 groups.
 */
function assignTiers(views: number[]): number[] {
  const sorted = [...views].sort((a, b) => a - b);
  const n = sorted.length;

  const percentile = (p: number): number => {
    const idx = Math.floor((p / 100) * (n - 1));
    return sorted[idx] ?? 0;
  };

  const p20 = percentile(20);
  const p40 = percentile(40);
  const p60 = percentile(60);
  const p80 = percentile(80);

  return views.map((v) => {
    if (v <= p20) return 1;
    if (v <= p40) return 2;
    if (v <= p60) return 3;
    if (v <= p80) return 4;
    return 5;
  });
}

// =====================================================
// Route Handler
// =====================================================

/**
 * GET /api/cron/retrain-ml
 *
 * Weekly cron — triggers ML model retraining using scraped video data.
 * Queries scraped_videos from Supabase, generates features dynamically,
 * assigns tiers via percentile quintiles, uses stratified splitting,
 * and gates model persistence on >60% test accuracy.
 *
 * Falls back to training-data.json when fewer than 500 scraped videos.
 */
export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const supabase = createServiceClient();

    // Query scraped_videos for training data
    const { data: videos, error: queryError } = await supabase
      .from("scraped_videos")
      .select(
        "views, likes, shares, comments, duration_seconds, hashtags, sound_name, description, created_at"
      )
      .not("views", "is", null)
      .not("likes", "is", null)
      .gt("views", 0)
      .order("created_at", { ascending: false })
      .limit(10000);

    if (queryError) {
      log.error("Failed to query scraped_videos", { error: queryError.message });
    }

    // Fallback: insufficient scraped data -> use static training-data.json
    if (!videos || videos.length < 500) {
      log.info("Falling back to training-data.json", { videoCount: videos?.length ?? 0 });
      const result = await trainModel(); // Uses default file path
      return NextResponse.json({
        status: "completed",
        source: "fallback",
        trainAccuracy: Math.round(result.trainAccuracy * 1000) / 1000,
        testAccuracy: Math.round(result.testAccuracy * 1000) / 1000,
        confusionMatrix: result.confusionMatrix,
        videoCount: videos?.length ?? 0,
        trainedAt: new Date().toISOString(),
      });
    }

    // Generate features and labels from scraped data
    const features = videos.map((v) =>
      videoToFeatures(v as unknown as ScrapedVideo)
    );
    const viewCounts = videos.map((v) => (v.views as number) ?? 0);
    const labels = assignTiers(viewCounts);

    // Log tier distribution for diagnostics
    const tierCounts = [0, 0, 0, 0, 0];
    for (const label of labels) {
      const idx = label - 1;
      if (idx >= 0 && idx < tierCounts.length) {
        tierCounts[idx] = (tierCounts[idx] ?? 0) + 1;
      }
    }
    log.info("Tier distribution", {
      T1: tierCounts[0],
      T2: tierCounts[1],
      T3: tierCounts[2],
      T4: tierCounts[3],
      T5: tierCounts[4],
    });

    // Stratified split for proportional train/test partitioning
    let seed = 42;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 0xffffffff;
    };
    const split = stratifiedSplit(features, labels, 0.2, rng);

    // Feature names must match training-data.json order
    const featureNames = [
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

    // Train model with structured data (no file I/O)
    log.info("Training started", {
      videoCount: videos.length,
      trainSize: split.train.features.length,
      testSize: split.test.features.length,
    });
    const result = await trainModel({
      trainSet: split.train,
      testSet: split.test,
      featureNames,
    });

    log.info("Training complete", {
      trainAccuracy: result.trainAccuracy,
      testAccuracy: result.testAccuracy,
    });

    // Accuracy gate: remove uploaded weights if below 60%
    if (result.testAccuracy < 0.6) {
      log.warn("Test accuracy below 60% gate, removing uploaded weights", {
        testAccuracy: result.testAccuracy,
      });
      await supabase.storage
        .from("ml-weights")
        .remove(["model/ml-weights.json"]);
      return NextResponse.json({
        status: "skipped",
        reason: `Test accuracy ${(result.testAccuracy * 100).toFixed(1)}% below 60% gate`,
        testAccuracy: Math.round(result.testAccuracy * 1000) / 1000,
        trainAccuracy: Math.round(result.trainAccuracy * 1000) / 1000,
        confusionMatrix: result.confusionMatrix,
        videoCount: videos.length,
        tierDistribution: tierCounts,
      });
    }

    // Success response
    return NextResponse.json({
      status: "completed",
      source: "scraped_videos",
      trainAccuracy: Math.round(result.trainAccuracy * 1000) / 1000,
      testAccuracy: Math.round(result.testAccuracy * 1000) / 1000,
      confusionMatrix: result.confusionMatrix,
      videoCount: videos.length,
      tierDistribution: tierCounts,
      trainedAt: new Date().toISOString(),
    });
  } catch (error) {
    log.error("Training failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        status: "failed",
        error: `Training failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}
