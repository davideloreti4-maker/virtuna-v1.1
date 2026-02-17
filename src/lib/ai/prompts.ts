/**
 * Prompt builders for AI-powered competitor intelligence.
 *
 * Each function takes pre-aggregated data and returns a prompt string.
 * All prompts instruct the model to respond ONLY with valid JSON.
 */

import type { CompetitorContext, ViralVideoInput } from "./types";

// --- INTL-01: Strategy Analysis (DeepSeek) ---

export function buildStrategyPrompt(ctx: CompetitorContext): string {
  const hashtagList = ctx.topHashtags
    .slice(0, 10)
    .map((h) => `#${h.tag} (${h.count}x)`)
    .join(", ");

  const topVideos = ctx.topVideoCaptions
    .slice(0, 5)
    .map(
      (v) =>
        `- "${v.caption.slice(0, 200)}" (${v.views.toLocaleString()} views)`
    )
    .join("\n");

  const durationInfo = ctx.durationBreakdown
    .map((d) => `${d.label}: ${d.percentage}%`)
    .join(", ");

  return `You are a TikTok content strategy analyst. Analyze the following creator's content strategy and provide structured insights.

CREATOR DATA:
- Handle: @${ctx.handle}
- Followers: ${ctx.followerCount?.toLocaleString() ?? "unknown"}
- Total likes: ${ctx.heartCount?.toLocaleString() ?? "unknown"}
- Total videos: ${ctx.videoCount ?? "unknown"}
- Bio: ${ctx.bio ?? "none"}
- Engagement rate: ${ctx.engagementRate !== null ? `${ctx.engagementRate}%` : "unknown"}
- Average views: ${ctx.averageViews?.toLocaleString() ?? "unknown"}
- Posting cadence: ${ctx.cadence ? `${ctx.cadence.postsPerWeek}/week (${ctx.cadence.postsPerMonth}/month)` : "unknown"}
- Growth velocity: ${ctx.growthVelocity ? `${ctx.growthVelocity.percentage}% ${ctx.growthVelocity.direction}` : "unknown"}
- Top hashtags: ${hashtagList || "none"}
- Video duration breakdown: ${durationInfo || "unknown"}

TOP PERFORMING VIDEOS:
${topVideos || "No video data available"}

Respond ONLY with valid JSON matching this exact structure (no markdown, no explanation):
{
  "hooks": [{"pattern": "string describing hook pattern", "frequency": number_of_occurrences, "example": "example from their content"}],
  "content_series": [{"name": "series name", "description": "what this series covers", "video_count": estimated_count}],
  "psychological_triggers": ["trigger1", "trigger2", ...],
  "overall_strategy": "2-3 paragraph analysis of their overall content strategy",
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2", "weakness3"]
}

Provide 3-5 hooks, 2-4 content series, 3-5 psychological triggers, 3-5 strengths, and 3-5 weaknesses.`;
}

// --- INTL-02: Viral Detection (Gemini) ---

export function buildViralPrompt(
  competitorHandle: string,
  averageViews: number,
  viralVideos: ViralVideoInput[]
): string {
  const videoDetails = viralVideos
    .slice(0, 5)
    .map((v, i) => {
      const hashtags = v.hashtags?.join(", ") || "none";
      return `Video ${i + 1}:
- Caption: "${(v.caption ?? "").slice(0, 200)}"
- Views: ${v.views?.toLocaleString() ?? 0} (${v.viralMultiplier.toFixed(1)}x average)
- Likes: ${v.likes?.toLocaleString() ?? 0}, Comments: ${v.comments?.toLocaleString() ?? 0}, Shares: ${v.shares?.toLocaleString() ?? 0}
- Duration: ${v.duration_seconds ? `${v.duration_seconds}s` : "unknown"}
- Posted: ${v.posted_at ?? "unknown"}
- Hashtags: ${hashtags}`;
    })
    .join("\n\n");

  return `You are a TikTok viral content analyst. Explain why each of the following videos from @${competitorHandle} went viral.

BASELINE: This creator averages ${averageViews.toLocaleString()} views per video. The videos below significantly exceeded this baseline.

VIRAL VIDEOS:
${videoDetails}

For each video, explain why it went viral relative to the creator's baseline. Consider: hook effectiveness, topic relevance, emotional triggers, timing, format, hashtag strategy, and share-worthiness.

Respond ONLY with valid JSON matching this exact structure (no markdown, no explanation):
{
  "videos": [
    {
      "caption": "the video caption",
      "views": view_count_number,
      "viral_multiplier": multiplier_number,
      "explanation": "2-3 sentence explanation of why this went viral",
      "key_factors": ["factor1", "factor2", "factor3"]
    }
  ]
}`;
}

// --- INTL-03: Hashtag Gap Analysis (Gemini) ---

export function buildHashtagGapPrompt(
  competitorHandle: string,
  competitorOnly: { tag: string; count: number }[],
  userOnly: { tag: string; count: number }[],
  shared: { tag: string; competitorCount: number; userCount: number }[]
): string {
  const compOnlyList = competitorOnly
    .slice(0, 10)
    .map((h) => `#${h.tag} (${h.count}x)`)
    .join(", ");

  const userOnlyList = userOnly
    .slice(0, 10)
    .map((h) => `#${h.tag} (${h.count}x)`)
    .join(", ");

  const sharedList = shared
    .slice(0, 10)
    .map(
      (h) =>
        `#${h.tag} (competitor: ${h.competitorCount}x, you: ${h.userCount}x)`
    )
    .join(", ");

  return `You are a TikTok hashtag strategist. Analyze the hashtag gap between a user and their competitor @${competitorHandle}.

COMPETITOR-ONLY HASHTAGS (used by competitor but not by user):
${compOnlyList || "none"}

USER-ONLY HASHTAGS (used by user but not by competitor):
${userOnlyList || "none"}

SHARED HASHTAGS (used by both):
${sharedList || "none"}

For each competitor-only hashtag, provide a recommendation on whether the user should adopt it.
For each user-only hashtag, assess whether it's a strength or should be reconsidered.
For shared hashtags, note relative usage differences.

Respond ONLY with valid JSON matching this exact structure (no markdown, no explanation):
{
  "competitor_only": [{"tag": "hashtag", "count": usage_count, "recommendation": "actionable recommendation"}],
  "user_only": [{"tag": "hashtag", "count": usage_count, "assessment": "strength or concern assessment"}],
  "shared": [{"tag": "hashtag", "competitor_count": count, "user_count": count}],
  "overall_recommendation": "1-2 paragraph summary of hashtag strategy recommendations"
}`;
}

// --- INTL-04: Recommendations (DeepSeek) ---

export function buildRecommendationsPrompt(
  ctx: CompetitorContext,
  strategyHighlights?: string,
  viralPatterns?: string
): string {
  const hashtagList = ctx.topHashtags
    .slice(0, 10)
    .map((h) => `#${h.tag} (${h.count}x)`)
    .join(", ");

  const durationInfo = ctx.durationBreakdown
    .map((d) => `${d.label}: ${d.percentage}%`)
    .join(", ");

  let context = `COMPETITOR DATA (@${ctx.handle}):
- Followers: ${ctx.followerCount?.toLocaleString() ?? "unknown"}
- Engagement rate: ${ctx.engagementRate !== null ? `${ctx.engagementRate}%` : "unknown"}
- Average views: ${ctx.averageViews?.toLocaleString() ?? "unknown"}
- Posting cadence: ${ctx.cadence ? `${ctx.cadence.postsPerWeek}/week` : "unknown"}
- Top hashtags: ${hashtagList || "none"}
- Video duration breakdown: ${durationInfo || "unknown"}
- Growth velocity: ${ctx.growthVelocity ? `${ctx.growthVelocity.percentage}% ${ctx.growthVelocity.direction}` : "unknown"}`;

  if (strategyHighlights) {
    context += `\n\nSTRATEGY INSIGHTS:\n${strategyHighlights}`;
  }

  if (viralPatterns) {
    context += `\n\nVIRAL PATTERNS:\n${viralPatterns}`;
  }

  return `You are a TikTok growth coach. Based on the competitor analysis below, generate personalized content recommendations for a creator looking to compete with this account.

${context}

Generate recommendations across 4 categories: format (video structure/length), timing (when to post), hooks (opening techniques), and content_style (topics/themes to try).

Each recommendation should be actionable with specific steps the user can take.

Respond ONLY with valid JSON matching this exact structure (no markdown, no explanation):
{
  "recommendations": [
    {
      "category": "format" | "timing" | "hooks" | "content_style",
      "title": "short recommendation title",
      "description": "detailed description of the recommendation",
      "priority": "high" | "medium" | "low",
      "action_items": ["specific step 1", "specific step 2"]
    }
  ],
  "summary": "1-2 paragraph summary of the key recommendations and expected impact"
}

Provide 6-10 recommendations total, at least 1 per category. Prioritize based on potential impact.`;
}
