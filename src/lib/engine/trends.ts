import { createServiceClient } from "@/lib/supabase/service";
import { createCache } from "@/lib/cache";
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
  const contentLower = input.content_text.toLowerCase();

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

  if (trendingSounds) {
    for (const sound of trendingSounds) {
      if (!sound.sound_name) continue;
      const soundLower = sound.sound_name.toLowerCase();

      // Check if content references this trending sound
      if (contentLower.includes(soundLower)) {
        matched_trends.push({
          sound_name: sound.sound_name,
          velocity_score: Number(sound.velocity_score) || 0,
          trend_phase: sound.trend_phase,
        });

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

  // Extract hashtags from content and check against recent scraped videos
  const hashtags = input.content_text.match(/#\w+/g) ?? [];
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
      const hashtagSet = new Set(hashtags.map((h) => h.toLowerCase()));
      let hashtagOverlap = 0;

      for (const video of recentVideos) {
        const videoHashtags = (video.hashtags ?? []).map((h: string) =>
          h.toLowerCase()
        );
        const overlap = videoHashtags.filter((h: string) => hashtagSet.has(h));
        if (overlap.length > 0) hashtagOverlap++;
      }

      // Hashtag overlap contributes to trend score
      if (hashtagOverlap > 0) {
        trendScore += Math.min(30, hashtagOverlap * 3);
      }
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
  };
}
