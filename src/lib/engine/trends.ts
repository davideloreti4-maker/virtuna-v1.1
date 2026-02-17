import { createServiceClient } from "@/lib/supabase/service";
import { createCache } from "@/lib/cache";
import { bestFuzzyMatch } from "./fuzzy";
import type { AnalysisInput, TrendEnrichment } from "./types";

// Cached trending data types (INFRA-02)
interface TrendingSound {
  sound_name: string;
  velocity_score: number;
  trend_phase: string | null;
}

interface ScrapedVideo {
  hashtags: string[];
  views: number;
}

// Trending sounds cached for 5 minutes — change frequently
const soundsCache = createCache<TrendingSound[]>(5 * 60 * 1000);

// Scraped videos cached for 15 minutes — moderate update frequency
const videosCache = createCache<ScrapedVideo[]>(15 * 60 * 1000);

/**
 * Enrich content analysis with trending data (ENGINE-05)
 * Cross-references content against trending_sounds and scraped_videos
 */
export async function enrichWithTrends(
  supabase: ReturnType<typeof createServiceClient>,
  input: AnalysisInput
): Promise<TrendEnrichment> {
  const contentLower = (input.content_text ?? "").toLowerCase();

  // Fetch active trending sounds (INFRA-02: cached for 5 minutes)
  let trendingSounds = soundsCache.get("trending_sounds");
  if (!trendingSounds) {
    const { data } = await supabase
      .from("trending_sounds")
      .select("sound_name, velocity_score, trend_phase")
      .order("velocity_score", { ascending: false })
      .limit(50);
    trendingSounds = (data ?? []) as TrendingSound[];
    soundsCache.set("trending_sounds", trendingSounds);
  }

  const matched_trends: TrendEnrichment["matched_trends"] = [];
  let trendScore = 0;
  let bestMatchScore: number | null = null; // Track best fuzzy match score for FeatureVector

  if (trendingSounds) {
    for (const sound of trendingSounds) {
      if (!sound.sound_name) continue;

      // Fuzzy match: Jaro-Winkler similarity >= 0.7 threshold (SIG-01)
      const fuzzyResult = bestFuzzyMatch(sound.sound_name, contentLower, 0.7);

      if (fuzzyResult.matched) {
        matched_trends.push({
          sound_name: sound.sound_name,
          velocity_score: Number(sound.velocity_score) || 0,
          trend_phase: sound.trend_phase,
        });

        // Track the highest similarity score across all matched sounds
        if (bestMatchScore === null || fuzzyResult.score > bestMatchScore) {
          bestMatchScore = fuzzyResult.score;
        }

        // Weight by velocity and trend phase
        const phaseMultiplier =
          sound.trend_phase === "emerging" ? 1.5
          : sound.trend_phase === "rising" ? 1.2
          : sound.trend_phase === "peak" ? 1.0
          : 0.5;

        trendScore += (Number(sound.velocity_score) || 0) * phaseMultiplier;
      }
    }
  }

  // Semantic hashtag scoring with popularity weighting and saturation detection (SIG-03)
  const hashtags = (input.content_text ?? "").match(/#\w+/g) ?? [];
  let hashtag_relevance = 0;

  if (hashtags.length > 0) {
    // INFRA-02: cached for 15 minutes
    let recentVideos = videosCache.get("recent_videos");
    if (!recentVideos) {
      const { data } = await supabase
        .from("scraped_videos")
        .select("hashtags, views")
        .order("created_at", { ascending: false })
        .limit(200);
      recentVideos = (data ?? []) as ScrapedVideo[];
      videosCache.set("recent_videos", recentVideos);
    }

    if (recentVideos.length > 0) {
      // 1. Build hashtag frequency map from scraped videos
      const hashtagStats = new Map<string, { count: number; totalViews: number }>();
      for (const video of recentVideos) {
        const videoHashtags = (video.hashtags ?? []).map((h: string) => h.toLowerCase());
        for (const tag of videoHashtags) {
          const existing = hashtagStats.get(tag);
          if (existing) {
            existing.count++;
            existing.totalViews += video.views ?? 0;
          } else {
            hashtagStats.set(tag, { count: 1, totalViews: video.views ?? 0 });
          }
        }
      }

      // 2. Saturation detection
      const SATURATED_BLOCKLIST = new Set([
        "#fyp", "#foryou", "#foryoupage", "#viral", "#trending", "#xyzbca",
      ]);
      const saturationThreshold = recentVideos.length * 0.4;

      const isSaturated = (tag: string): boolean =>
        SATURATED_BLOCKLIST.has(tag) ||
        (hashtagStats.get(tag)?.count ?? 0) > saturationThreshold;

      // 3. Popularity-weighted scoring
      const userHashtags = Array.from(new Set(hashtags.map((h) => h.toLowerCase())));
      let totalRelevance = 0;

      for (const tag of userHashtags) {
        const tagData = hashtagStats.get(tag);
        if (!tagData) continue; // Tag not found in scraped videos

        if (isSaturated(tag)) {
          // Saturated tags still contribute to trend_score at 10% weight
          const popularity = Math.log10(Math.max(tagData.totalViews, 1));
          const frequencyWeight = tagData.count / recentVideos.length;
          trendScore += Math.round(popularity * frequencyWeight * 0.1 * 3);
        } else {
          // Non-saturated: full popularity-weighted relevance
          const popularity = Math.log10(Math.max(tagData.totalViews, 1));
          const frequencyWeight = tagData.count / recentVideos.length;
          const relevance = popularity * frequencyWeight;
          totalRelevance += relevance;
        }
      }

      // 4. Normalize to 0-1 (calibrated: 3 highly-relevant hashtags ≈ 1.0)
      const maxExpectedRelevance = 3;
      hashtag_relevance = Math.min(1, totalRelevance / maxExpectedRelevance);

      // 5. Hashtag relevance contributes to trend_score (max 30, quality-weighted)
      trendScore += Math.round(hashtag_relevance * 30);
    }
  }

  // Normalize to 0-100
  const normalizedScore = Math.min(100, Math.max(0, Math.round(trendScore)));

  // Build context string for DeepSeek prompt
  const trendContext =
    matched_trends.length > 0
      ? `Content references ${matched_trends.length} trending sound(s): ${matched_trends.map((t) => `${t.sound_name} (${t.trend_phase}, velocity: ${t.velocity_score})`).join("; ")}. ${hashtags.length > 0 ? `Uses ${hashtags.length} hashtag(s): ${hashtags.join(", ")}.` : ""}`
      : hashtags.length > 0
        ? `Content uses ${hashtags.length} hashtag(s): ${hashtags.join(", ")}. No trending sound references detected.`
        : "No trending sound or hashtag references detected in content.";

  return {
    trend_score: normalizedScore,
    matched_trends,
    trend_context: trendContext,
    hashtag_relevance,
  };
}
