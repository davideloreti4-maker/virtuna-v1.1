/**
 * Zod schemas and TypeScript types for AI-generated competitor intelligence.
 *
 * Four analysis types:
 * - Strategy (INTL-01): Content strategy breakdown via DeepSeek
 * - Viral (INTL-02): Viral video explanations via Gemini
 * - Hashtag Gap (INTL-03): User vs competitor hashtag analysis via Gemini
 * - Recommendations (INTL-04): Personalized action items via DeepSeek
 */

import { z } from "zod";

// --- Strategy Analysis (INTL-01) ---

export const StrategyAnalysisSchema = z.object({
  hooks: z.array(
    z.object({
      pattern: z.string(),
      frequency: z.number(),
      example: z.string(),
    })
  ),
  content_series: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      video_count: z.number(),
    })
  ),
  psychological_triggers: z.array(z.string()),
  overall_strategy: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
});

export type StrategyAnalysis = z.infer<typeof StrategyAnalysisSchema>;

// --- Viral Explanation (INTL-02) ---

export const ViralExplanationSchema = z.object({
  videos: z.array(
    z.object({
      caption: z.string(),
      views: z.number(),
      viral_multiplier: z.number(),
      explanation: z.string(),
      key_factors: z.array(z.string()),
    })
  ),
});

export type ViralExplanation = z.infer<typeof ViralExplanationSchema>;

// --- Hashtag Gap (INTL-03) ---

export const HashtagGapSchema = z.object({
  competitor_only: z.array(
    z.object({
      tag: z.string(),
      count: z.number(),
      recommendation: z.string(),
    })
  ),
  user_only: z.array(
    z.object({
      tag: z.string(),
      count: z.number(),
      assessment: z.string(),
    })
  ),
  shared: z.array(
    z.object({
      tag: z.string(),
      competitor_count: z.number(),
      user_count: z.number(),
    })
  ),
  overall_recommendation: z.string(),
});

export type HashtagGap = z.infer<typeof HashtagGapSchema>;

// --- Recommendations (INTL-04) ---

export const RecommendationsSchema = z.object({
  recommendations: z.array(
    z.object({
      category: z.enum(["format", "timing", "hooks", "content_style"]),
      title: z.string(),
      description: z.string(),
      priority: z.enum(["high", "medium", "low"]),
      action_items: z.array(z.string()),
    })
  ),
  summary: z.string(),
});

export type Recommendations = z.infer<typeof RecommendationsSchema>;

// --- Input types for prompt builders ---

export interface CompetitorContext {
  handle: string;
  followerCount: number | null;
  heartCount: number | null;
  videoCount: number | null;
  bio: string | null;
  topHashtags: { tag: string; count: number }[];
  cadence: { postsPerWeek: number; postsPerMonth: number } | null;
  engagementRate: number | null;
  averageViews: number | null;
  growthVelocity: { percentage: number; direction: string } | null;
  topVideoCaptions: { caption: string; views: number }[];
  durationBreakdown: { label: string; percentage: number }[];
}

export interface ViralVideoInput {
  caption: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  duration_seconds: number | null;
  posted_at: string | null;
  hashtags: string[] | null;
  viralMultiplier: number;
}
