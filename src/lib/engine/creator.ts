import { createServiceClient } from "@/lib/supabase/service";
import { createCache } from "@/lib/cache";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "creator" });

// =====================================================
// Creator Context — Stage 5 of prediction pipeline
// =====================================================

export interface CreatorContext {
  // === Existing (D-20 preserved) ===
  found: boolean;
  follower_count: number | null;
  avg_views: number | null;
  engagement_rate: number | null;
  niche: string | null;
  posting_frequency: string | null;
  platform_averages: {
    avg_views: number;
    avg_engagement_rate: number;
    avg_share_rate: number;
    avg_comment_rate: number;
  };

  // === Phase 2: 9-card profile fields (D-19 flat add — all nullable for graceful degradation) ===
  target_platforms: string[] | null; // Card 0
  niche_primary: string | null; // Card 1
  niche_sub: string | null; // Card 1
  target_audience: {
    // Card 2 JSONB
    age_range: string | null;
    gender_skew: "female" | "balanced" | "male" | null;
    geo: string | null;
    language: string | null;
  } | null;
  primary_goal: string | null; // Card 3 (reuses existing column)
  creator_stage: string | null; // Card 3
  content_style: string | null; // Card 4
  cuts_per_second: string | null; // Card 4
  reference_creators: Array<{ handle_or_url: string }> | null; // Card 5
  past_wins: Array<{ url: string }> | null; // Card 6
  past_flops: Array<{ url: string }> | null; // Card 6
  time_of_day_aware: boolean | null; // Card 7
  pain_points: string | null; // Card 8
}

// Platform averages cache with 24h TTL — averages change slowly
const platformAveragesCache = createCache<CreatorContext["platform_averages"]>(24 * 60 * 60 * 1000);

/**
 * Compute platform-wide averages from scraped_videos table.
 * Cached after first call — platform averages don't change per-request.
 *
 * Fetches a sample of scraped_videos with views > 0 and computes:
 * - AVG(views)
 * - AVG((likes + comments*2 + shares*3) / views) as engagement rate
 * - AVG(shares / views) as share rate
 * - AVG(comments / views) as comment rate
 */
async function getPlatformAverages(
  supabase: ReturnType<typeof createServiceClient>
): Promise<CreatorContext["platform_averages"]> {
  const CACHE_KEY = "platform_averages";
  const cached = platformAveragesCache.get(CACHE_KEY);
  if (cached) return cached;

  const FALLBACK: CreatorContext["platform_averages"] = {
    avg_views: 50000,
    avg_engagement_rate: 0.06,
    avg_share_rate: 0.008,
    avg_comment_rate: 0.005,
  };

  const { data: videos, error } = await supabase
    .from("scraped_videos")
    .select("views, likes, comments, shares")
    .gt("views", 0)
    .limit(5000);

  if (error || !videos || videos.length === 0) {
    log.debug("Platform averages fallback", { reason: error ? "db_error" : "no_data" });
    platformAveragesCache.set(CACHE_KEY, FALLBACK);
    return FALLBACK;
  }

  let totalViews = 0;
  let totalEngagement = 0;
  let totalShareRate = 0;
  let totalCommentRate = 0;
  let validCount = 0;

  for (const v of videos) {
    const views = Number(v.views) || 0;
    const likes = Number(v.likes) || 0;
    const comments = Number(v.comments) || 0;
    const shares = Number(v.shares) || 0;

    if (views <= 0) continue;

    validCount++;
    totalViews += views;
    totalEngagement += (likes + comments * 2 + shares * 3) / views;
    totalShareRate += shares / views;
    totalCommentRate += comments / views;
  }

  if (validCount === 0) {
    platformAveragesCache.set(CACHE_KEY, FALLBACK);
    return FALLBACK;
  }

  const result: CreatorContext["platform_averages"] = {
    avg_views: Math.round(totalViews / validCount),
    avg_engagement_rate: Number((totalEngagement / validCount).toFixed(4)),
    avg_share_rate: Number((totalShareRate / validCount).toFixed(4)),
    avg_comment_rate: Number((totalCommentRate / validCount).toFixed(4)),
  };

  platformAveragesCache.set(CACHE_KEY, result);
  return result;
}

/**
 * Fetch creator context for pipeline reasoning.
 *
 * - Queries `creator_profiles` by `tiktok_handle` if `creator_handle` is provided
 * - Always computes platform-wide averages from `scraped_videos` (cached)
 * - Returns `found: true` with profile data if creator exists, `found: false` with just platform averages
 *
 * Creator data is CONTEXT ONLY — feeds into AI prompts for reasoning,
 * does NOT directly modify the aggregated score.
 */
export async function fetchCreatorContext(
  supabase: ReturnType<typeof createServiceClient>,
  creator_handle: string | null,
  niche: string | null
): Promise<CreatorContext> {
  // Always fetch platform averages (cached after first call)
  const platform_averages = await getPlatformAverages(supabase);

  // If no creator handle, return cold-start context
  if (!creator_handle) {
    log.debug("No creator handle provided, using cold-start context");
    return {
      found: false,
      follower_count: null,
      avg_views: null,
      engagement_rate: null,
      niche,
      posting_frequency: null,
      platform_averages,
      target_platforms: null,
      niche_primary: null,
      niche_sub: null,
      target_audience: null,
      primary_goal: null,
      creator_stage: null,
      content_style: null,
      cuts_per_second: null,
      reference_creators: null,
      past_wins: null,
      past_flops: null,
      time_of_day_aware: null,
      pain_points: null,
    };
  }

  // Look up creator profile by tiktok_handle
  const { data: profile, error } = await supabase
    .from("creator_profiles")
    .select(
      `tiktok_followers, engagement_rate, niches, display_name,
       target_platforms, niche_primary, niche_sub, target_audience,
       primary_goal, creator_stage, content_style, cuts_per_second,
       reference_creators, past_wins, past_flops,
       posting_frequency, time_of_day_aware, pain_points`
    )
    .eq("tiktok_handle", creator_handle)
    .maybeSingle();

  if (error || !profile) {
    return {
      found: false,
      follower_count: null,
      avg_views: null,
      engagement_rate: null,
      niche,
      posting_frequency: null,
      platform_averages,
      target_platforms: null,
      niche_primary: null,
      niche_sub: null,
      target_audience: null,
      primary_goal: null,
      creator_stage: null,
      content_style: null,
      cuts_per_second: null,
      reference_creators: null,
      past_wins: null,
      past_flops: null,
      time_of_day_aware: null,
      pain_points: null,
    };
  }

  // Derive niche from profile if not provided
  const resolvedNiche =
    niche ?? (profile.niches && profile.niches.length > 0 ? profile.niches[0] : null);

  log.info("Creator context resolved", {
    found: !!profile,
    creator_handle: creator_handle ?? "none",
  });

  return {
    found: true,
    follower_count: profile.tiktok_followers,
    avg_views: null, // Could be computed from scraped_videos by author in the future
    engagement_rate: profile.engagement_rate,
    niche: resolvedNiche ?? null,
    posting_frequency: profile.posting_frequency ?? null, // now from DB (Phase 2 column)
    platform_averages,
    target_platforms: profile.target_platforms ?? null,
    niche_primary: profile.niche_primary ?? null,
    niche_sub: profile.niche_sub ?? null,
    target_audience:
      (profile.target_audience as CreatorContext["target_audience"]) ?? null,
    primary_goal: profile.primary_goal ?? null,
    creator_stage: profile.creator_stage ?? null,
    content_style: profile.content_style ?? null,
    cuts_per_second: profile.cuts_per_second ?? null,
    reference_creators:
      (profile.reference_creators as CreatorContext["reference_creators"]) ??
      null,
    past_wins: (profile.past_wins as CreatorContext["past_wins"]) ?? null,
    past_flops: (profile.past_flops as CreatorContext["past_flops"]) ?? null,
    time_of_day_aware: profile.time_of_day_aware ?? null,
    pain_points: profile.pain_points ?? null,
  };
}

/**
 * Format creator context as a string for DeepSeek prompt injection.
 *
 * When found: includes follower count, engagement rate, niche
 * When not found: includes platform-wide averages as "typical creator baseline"
 */
export function formatCreatorContext(ctx: CreatorContext): string {
  const lines: string[] = ["## Creator Context"];

  if (ctx.found) {
    lines.push(`Creator profile: found`);
    if (ctx.follower_count !== null) {
      lines.push(`Follower count: ${ctx.follower_count.toLocaleString()}`);
    }
    if (ctx.avg_views !== null) {
      lines.push(`Average views: ${ctx.avg_views.toLocaleString()}`);
    }
    if (ctx.engagement_rate !== null) {
      lines.push(`Engagement rate: ${(ctx.engagement_rate * 100).toFixed(2)}%`);
    }
    if (ctx.niche) {
      lines.push(`Niche: ${ctx.niche}`);
    }
    if (ctx.posting_frequency) {
      lines.push(`Posting frequency: ${ctx.posting_frequency}`);
    }
  } else {
    lines.push(`Creator profile: not found (using platform baseline)`);
  }

  // Always include platform averages
  const pa = ctx.platform_averages;
  lines.push(`Platform average views: ${pa.avg_views.toLocaleString()}`);
  lines.push(
    `Platform average engagement: ${(pa.avg_engagement_rate * 100).toFixed(2)}%`
  );
  lines.push(
    `Platform average share rate: ${(pa.avg_share_rate * 100).toFixed(2)}%`
  );
  lines.push(
    `Platform average comment rate: ${(pa.avg_comment_rate * 100).toFixed(2)}%`
  );

  // Phase 2 — 9-card profile fields (each guarded; null fields are silently omitted per Pitfall #3)
  if (ctx.target_platforms && ctx.target_platforms.length > 0) {
    lines.push(`Target platforms: ${ctx.target_platforms.join(", ")}`);
  }
  if (ctx.niche_primary) {
    const sub = ctx.niche_sub ? ` > ${ctx.niche_sub}` : "";
    lines.push(`Niche: ${ctx.niche_primary}${sub}`);
  }
  if (ctx.target_audience) {
    const ta = ctx.target_audience;
    const parts: string[] = [];
    if (ta.age_range) parts.push(`age ${ta.age_range}`);
    if (ta.gender_skew) parts.push(`${ta.gender_skew}-skewed`);
    if (ta.geo) parts.push(ta.geo);
    if (ta.language) parts.push(ta.language);
    if (parts.length > 0) lines.push(`Target audience: ${parts.join(", ")}`);
  }
  if (ctx.primary_goal) lines.push(`Primary goal: ${ctx.primary_goal}`);
  if (ctx.creator_stage) lines.push(`Creator stage: ${ctx.creator_stage}`);
  if (ctx.content_style) lines.push(`Content style: ${ctx.content_style}`);
  if (ctx.cuts_per_second) {
    lines.push(`Cuts per second preference: ${ctx.cuts_per_second}`);
  }
  if (ctx.reference_creators && ctx.reference_creators.length > 0) {
    lines.push(
      `Reference creators: ${ctx.reference_creators
        .map((r) => r.handle_or_url)
        .filter(Boolean)
        .join(", ")}`
    );
  }
  if (ctx.past_wins && ctx.past_wins.length > 0) {
    lines.push(
      `Past wins (creator self-reported): ${ctx.past_wins.length} video(s)`
    );
  }
  if (ctx.past_flops && ctx.past_flops.length > 0) {
    lines.push(
      `Past flops (creator self-reported): ${ctx.past_flops.length} video(s)`
    );
  }
  if (ctx.time_of_day_aware !== null) {
    lines.push(
      `Time-of-day awareness: ${ctx.time_of_day_aware ? "yes" : "no"}`
    );
  }
  if (ctx.pain_points) {
    lines.push(`Creator pain points: ${ctx.pain_points}`);
  }

  return lines.join("\n");
}
