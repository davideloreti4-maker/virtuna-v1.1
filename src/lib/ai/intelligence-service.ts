/**
 * Intelligence service orchestrator.
 *
 * Coordinates AI analysis with database caching.
 * Uses service client for writes (bypasses RLS), user client for reads.
 *
 * Staleness logic: cache is stale if generated_at < last_scraped_at OR > 7 days old.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";
import { createServiceClient } from "@/lib/supabase/service";
import { computeHashtagFrequency } from "@/lib/competitors-utils";
import { analyzeStrategy, generateRecommendations } from "./deepseek";
import { explainViralVideos, analyzeHashtagGap } from "./gemini";
import type {
  StrategyAnalysis,
  ViralExplanation,
  HashtagGap,
  Recommendations,
  CompetitorContext,
  ViralVideoInput,
} from "./types";

// --- Cache helpers ---

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isStale(generatedAt: string, lastScrapedAt: string | null): boolean {
  const generatedTime = new Date(generatedAt).getTime();
  const now = Date.now();

  // Stale if older than 7 days
  if (now - generatedTime > CACHE_TTL_MS) return true;

  // Stale if new scrape data arrived after generation
  if (lastScrapedAt) {
    const scrapedTime = new Date(lastScrapedAt).getTime();
    if (generatedTime < scrapedTime) return true;
  }

  return false;
}

async function checkCache(
  supabase: SupabaseClient<Database>,
  competitorId: string,
  analysisType: string,
  userId?: string
) {
  let query = supabase
    .from("competitor_intelligence")
    .select("*")
    .eq("competitor_id", competitorId)
    .eq("analysis_type", analysisType)
    .order("generated_at", { ascending: false })
    .limit(1);

  if (userId) {
    query = query.eq("user_id", userId);
  } else {
    query = query.is("user_id", null);
  }

  const { data } = await query.maybeSingle();
  return data;
}

async function upsertCache(
  competitorId: string,
  analysisType: string,
  insights: unknown,
  modelUsed: string,
  promptTokens: number,
  completionTokens: number,
  userId?: string
) {
  const service = createServiceClient();

  // Delete existing then insert (avoids COALESCE in onConflict which Supabase JS doesn't support)
  let deleteQuery = service
    .from("competitor_intelligence")
    .delete()
    .eq("competitor_id", competitorId)
    .eq("analysis_type", analysisType);

  if (userId) {
    deleteQuery = deleteQuery.eq("user_id", userId);
  } else {
    deleteQuery = deleteQuery.is("user_id", null);
  }

  await deleteQuery;

  await service.from("competitor_intelligence").insert({
    competitor_id: competitorId,
    analysis_type: analysisType,
    insights: insights as unknown as Json,
    model_used: modelUsed,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    generated_at: new Date().toISOString(),
    user_id: userId ?? null,
  });
}

// --- Public API ---

export async function getStrategyAnalysis(
  supabase: SupabaseClient<Database>,
  competitorId: string,
  ctx: CompetitorContext,
  lastScrapedAt: string | null
): Promise<StrategyAnalysis> {
  const cached = await checkCache(supabase, competitorId, "strategy");

  if (cached && !isStale(cached.generated_at, lastScrapedAt)) {
    return cached.insights as unknown as StrategyAnalysis;
  }

  const { analysis, usage } = await analyzeStrategy(ctx);

  await upsertCache(
    competitorId,
    "strategy",
    analysis,
    "deepseek-chat",
    usage.prompt_tokens,
    usage.completion_tokens
  );

  return analysis;
}

export async function getViralDetection(
  supabase: SupabaseClient<Database>,
  competitorId: string,
  handle: string,
  viralVideos: ViralVideoInput[],
  averageViews: number,
  lastScrapedAt: string | null
): Promise<ViralExplanation> {
  // No viral videos -- return empty result (no AI call needed)
  if (viralVideos.length === 0) {
    return { videos: [] };
  }

  const cached = await checkCache(supabase, competitorId, "viral");

  if (cached && !isStale(cached.generated_at, lastScrapedAt)) {
    return cached.insights as unknown as ViralExplanation;
  }

  const { analysis, usage } = await explainViralVideos(
    handle,
    averageViews,
    viralVideos.slice(0, 5)
  );

  await upsertCache(
    competitorId,
    "viral",
    analysis,
    "gemini-2.5-flash-lite",
    usage.prompt_tokens,
    usage.completion_tokens
  );

  return analysis;
}

export async function getHashtagGap(
  supabase: SupabaseClient<Database>,
  competitorId: string,
  handle: string,
  userId: string,
  competitorVideos: { hashtags: string[] | null }[],
  userVideos: { hashtags: string[] | null }[],
  lastScrapedAt: string | null
): Promise<HashtagGap> {
  const cached = await checkCache(supabase, competitorId, "hashtag_gap", userId);

  if (cached && !isStale(cached.generated_at, lastScrapedAt)) {
    return cached.insights as unknown as HashtagGap;
  }

  // Pure computation: compute hashtag frequencies and find gaps
  const competitorHashtags = computeHashtagFrequency(competitorVideos);
  const userHashtags = computeHashtagFrequency(userVideos);

  const userTagSet = new Set(userHashtags.map((h) => h.tag));
  const compTagSet = new Set(competitorHashtags.map((h) => h.tag));

  const competitorOnly = competitorHashtags
    .filter((h) => !userTagSet.has(h.tag))
    .slice(0, 10);
  const userOnly = userHashtags
    .filter((h) => !compTagSet.has(h.tag))
    .slice(0, 10);
  const shared = competitorHashtags
    .filter((h) => userTagSet.has(h.tag))
    .slice(0, 10)
    .map((h) => ({
      tag: h.tag,
      competitorCount: h.count,
      userCount: userHashtags.find((u) => u.tag === h.tag)?.count ?? 0,
    }));

  const { analysis, usage } = await analyzeHashtagGap(
    handle,
    competitorOnly,
    userOnly,
    shared
  );

  await upsertCache(
    competitorId,
    "hashtag_gap",
    analysis,
    "gemini-2.5-flash-lite",
    usage.prompt_tokens,
    usage.completion_tokens,
    userId
  );

  return analysis;
}

export async function getRecommendations(
  supabase: SupabaseClient<Database>,
  competitorId: string,
  ctx: CompetitorContext,
  lastScrapedAt: string | null,
  strategyHighlights?: string,
  viralPatterns?: string
): Promise<Recommendations> {
  const cached = await checkCache(supabase, competitorId, "recommendations");

  if (cached && !isStale(cached.generated_at, lastScrapedAt)) {
    return cached.insights as unknown as Recommendations;
  }

  const { analysis, usage } = await generateRecommendations(
    ctx,
    strategyHighlights,
    viralPatterns
  );

  await upsertCache(
    competitorId,
    "recommendations",
    analysis,
    "deepseek-chat",
    usage.prompt_tokens,
    usage.completion_tokens
  );

  return analysis;
}

/**
 * Retrieve all cached intelligence for a competitor.
 * Returns a map of analysis_type -> insights for the detail page server component.
 */
export async function getAllIntelligence(
  supabase: SupabaseClient<Database>,
  competitorId: string
): Promise<{
  strategy?: StrategyAnalysis;
  viral?: ViralExplanation;
  hashtag_gap?: HashtagGap;
  recommendations?: Recommendations;
}> {
  const { data } = await supabase
    .from("competitor_intelligence")
    .select("analysis_type, insights")
    .eq("competitor_id", competitorId);

  if (!data || data.length === 0) return {};

  const result: Record<string, unknown> = {};
  for (const row of data) {
    result[row.analysis_type] = row.insights;
  }

  return result as {
    strategy?: StrategyAnalysis;
    viral?: ViralExplanation;
    hashtag_gap?: HashtagGap;
    recommendations?: Recommendations;
  };
}
