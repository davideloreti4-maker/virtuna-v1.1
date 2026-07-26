/**
 * grounding/corpus.ts — the §13 teardown corpus DB access layer.
 *
 * Persistence + retrieval over public.outlier_teardowns (SHARED) and
 * public.personal_teardowns (PRIVATE). Mirrors the shipped two-pool idiom
 * (engine/retrieval/pgvector-client.ts): functions take a plain `SupabaseClient`
 * (untyped generic) so the not-yet-generated table + RPC names typecheck before
 * the migration applies and `database.types.ts` is regenerated. RPC failures throw;
 * the caller wraps in try/catch + graceful degradation (Phase-8 D-rule).
 *
 * The write path is the "extract once / cache forever" cache: upserts dedup on
 * (platform, platform_video_id) for shared / (user_id, platform, platform_video_id)
 * for personal. `findCachedTeardownIds` lets the retrieval pipeline skip re-extracting
 * a video we already tore down.
 *
 * Embedding note: the platform is Qwen/DashScope-only. The producer is
 * grounding/embedder.ts (DashScope `text-embedding-v3`, dims 768, via the existing
 * qwen client) — NOT gemini (the legacy gemini-named engine embedders are dead).
 * The orchestrator embeds at cache-write; retrieve.ts feeds the RPC wrappers below
 * with a query vector (the read-back path).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { rehostCover } from "@/lib/scraping/rehost-cover";
import type {
  SourcePool,
  HookSource,
  TeardownStatus,
  IdeaFacet,
  TeardownTemplate,
} from "./types";

/** Service client, typed as the plain (untyped) client so new-table writes typecheck pre-regen. */
export function getCorpusClient(): SupabaseClient {
  return createServiceClient() as unknown as SupabaseClient;
}

/** pgvector wants a bracketed literal for column writes; number[] for RPC args. */
function toVectorLiteral(embedding: number[] | null | undefined): string | null {
  return embedding && embedding.length > 0 ? JSON.stringify(embedding) : null;
}

// ─── Write path (extract once / cache forever) ───────────────────────────────

/** Fields needed to persist a SHARED teardown. Missing fields → NULL columns. */
export interface OutlierTeardownInsert {
  platform: string;
  platformVideoId: string;
  videoUrl?: string | null;
  coverUrl?: string | null;
  creatorHandle?: string | null;
  sourcePool: SourcePool;
  sourceId?: string | null;
  trustWeight?: number;
  // frozen proof
  views?: number | null;
  followerCount?: number | null;
  outlierMultiplier?: number | null;
  baselineLabel?: string | null;
  engagementRate?: number | null;
  postedAt?: string | null;
  proofCapturedAt?: string | null;
  // facets
  niche?: string | null;
  subniche?: string | null;
  hookArchetype?: string | null;
  format?: string | null;
  visualHook?: string | null;
  editingStyle?: string | null;
  signatureSeries?: string | null;
  // teardown
  spokenHook?: string | null;
  /** First-class column (read-back maps it onto the card receipt). */
  hookTemplate?: string | null;
  hookSource?: HookSource | null;
  idea?: IdeaFacet | null;
  template?: TeardownTemplate | null;
  whyItWorks?: string | null;
  teardown?: Record<string, unknown> | null;
  /** Source caption/hashtags — stored so the row can re-embed itself (§13 formula). */
  caption?: string | null;
  hashtags?: string[] | null;
  // meta
  embedding?: number[] | null;
  extractionTier?: string | null;
  extractionVersion?: string | null;
  model?: string | null;
  status?: TeardownStatus;
}

function serializeOutlier(input: OutlierTeardownInsert): Record<string, unknown> {
  return {
    platform: input.platform,
    platform_video_id: input.platformVideoId,
    video_url: input.videoUrl ?? null,
    cover_url: input.coverUrl ?? null,
    creator_handle: input.creatorHandle ?? null,
    source_pool: input.sourcePool,
    source_id: input.sourceId ?? null,
    trust_weight: input.trustWeight ?? 1.0,
    views: input.views ?? null,
    follower_count: input.followerCount ?? null,
    outlier_multiplier: input.outlierMultiplier ?? null,
    baseline_label: input.baselineLabel ?? null,
    engagement_rate: input.engagementRate ?? null,
    posted_at: input.postedAt ?? null,
    proof_captured_at: input.proofCapturedAt ?? null,
    niche: input.niche ?? null,
    subniche: input.subniche ?? null,
    hook_archetype: input.hookArchetype ?? null,
    format: input.format ?? null,
    visual_hook: input.visualHook ?? null,
    editing_style: input.editingStyle ?? null,
    signature_series: input.signatureSeries ?? null,
    spoken_hook: input.spokenHook ?? null,
    hook_template: input.hookTemplate ?? null,
    hook_source: input.hookSource ?? null,
    idea: input.idea ?? null,
    template: input.template ?? null,
    why_it_works: input.whyItWorks ?? null,
    teardown: input.teardown ?? null,
    caption: input.caption ?? null,
    hashtags: input.hashtags ?? null,
    embedding: toVectorLiteral(input.embedding),
    extraction_tier: input.extractionTier ?? null,
    extraction_version: input.extractionVersion ?? null,
    model: input.model ?? null,
    status: input.status ?? "extracted",
  };
}

/**
 * Every corpus receipt's cover is an EPHEMERAL signed CDN URL (TikTok `x-expires`, Instagram `oe=`)
 * that 403s once it lapses. The corpus is "extract once / cache forever", so a raw URL stored here
 * is dead on every later read — which is why ProofReceipts on skill cards rendered their placeholder
 * tile instead of a thumbnail (2026-07-24). Rehost at WRITE time, while the signature is still
 * valid, exactly as the Discover ingest paths already do. Failure degrades to the ephemeral URL
 * (no worse than before); the key is stable so a re-extraction overwrites the same object.
 */
async function durableCover(
  supabase: SupabaseClient,
  input: { platform: string; platformVideoId: string; coverUrl?: string | null },
): Promise<string | null> {
  if (!input.coverUrl) return null;
  const key = `corpus/${input.platform}/${input.platformVideoId}`;
  const rehosted = await rehostCover(supabase, input.coverUrl, key);
  return rehosted ?? input.coverUrl;
}

/**
 * Upsert a SHARED teardown (dedup on platform + platform_video_id). Returns the row id.
 * `onConflict` merges — a later, deeper extraction (e.g. a `watched` pass) overwrites
 * the cheaper cached row for the same video.
 */
export async function upsertOutlierTeardown(
  supabase: SupabaseClient,
  input: OutlierTeardownInsert,
): Promise<string> {
  const coverUrl = await durableCover(supabase, input);
  const { data, error } = await supabase
    .from("outlier_teardowns")
    .upsert(serializeOutlier({ ...input, coverUrl }), {
      onConflict: "platform,platform_video_id",
    })
    .select("id")
    .single();
  if (error) throw new Error(`upsertOutlierTeardown failed: ${error.message}`);
  return (data as { id: string }).id;
}

/** Fields needed to persist a PRIVATE teardown (Rung −1). */
export interface PersonalTeardownInsert
  extends Omit<OutlierTeardownInsert, "sourcePool" | "sourceId" | "trustWeight"> {
  userId: string;
  sourceAccountId?: string | null;
  plannedPostId?: string | null;
  outcomeId?: string | null;
  predictedBand?: string | null;
  actualOutcome?: Record<string, unknown> | null;
}

function serializePersonal(input: PersonalTeardownInsert): Record<string, unknown> {
  return {
    user_id: input.userId,
    platform: input.platform,
    platform_video_id: input.platformVideoId,
    video_url: input.videoUrl ?? null,
    cover_url: input.coverUrl ?? null,
    creator_handle: input.creatorHandle ?? null,
    source_account_id: input.sourceAccountId ?? null,
    planned_post_id: input.plannedPostId ?? null,
    outcome_id: input.outcomeId ?? null,
    views: input.views ?? null,
    follower_count: input.followerCount ?? null,
    outlier_multiplier: input.outlierMultiplier ?? null,
    baseline_label: input.baselineLabel ?? null,
    engagement_rate: input.engagementRate ?? null,
    posted_at: input.postedAt ?? null,
    proof_captured_at: input.proofCapturedAt ?? null,
    niche: input.niche ?? null,
    subniche: input.subniche ?? null,
    hook_archetype: input.hookArchetype ?? null,
    format: input.format ?? null,
    visual_hook: input.visualHook ?? null,
    editing_style: input.editingStyle ?? null,
    signature_series: input.signatureSeries ?? null,
    spoken_hook: input.spokenHook ?? null,
    hook_template: input.hookTemplate ?? null,
    hook_source: input.hookSource ?? null,
    idea: input.idea ?? null,
    template: input.template ?? null,
    why_it_works: input.whyItWorks ?? null,
    teardown: input.teardown ?? null,
    caption: input.caption ?? null,
    hashtags: input.hashtags ?? null,
    predicted_band: input.predictedBand ?? null,
    actual_outcome: input.actualOutcome ?? null,
    embedding: toVectorLiteral(input.embedding),
    extraction_tier: input.extractionTier ?? null,
    extraction_version: input.extractionVersion ?? null,
    model: input.model ?? null,
    status: input.status ?? "extracted",
  };
}

/** Upsert a PRIVATE teardown (dedup on user_id + platform + platform_video_id). Returns row id. */
export async function upsertPersonalTeardown(
  supabase: SupabaseClient,
  input: PersonalTeardownInsert,
): Promise<string> {
  const coverUrl = await durableCover(supabase, input);
  const { data, error } = await supabase
    .from("personal_teardowns")
    .upsert(serializePersonal({ ...input, coverUrl }), {
      onConflict: "user_id,platform,platform_video_id",
    })
    .select("id")
    .single();
  if (error) throw new Error(`upsertPersonalTeardown failed: ${error.message}`);
  return (data as { id: string }).id;
}

/**
 * Which of these videos are ALREADY torn down (SHARED cache)? Lets the pipeline
 * skip re-extraction (extract-once). Returns the set of platform_video_ids present.
 */
export async function findCachedVideoIds(
  supabase: SupabaseClient,
  platform: string,
  platformVideoIds: string[],
): Promise<Set<string>> {
  if (platformVideoIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("outlier_teardowns")
    .select("platform_video_id")
    .eq("platform", platform)
    .in("platform_video_id", platformVideoIds);
  if (error) throw new Error(`findCachedVideoIds failed: ${error.message}`);
  return new Set((data ?? []).map((r) => (r as { platform_video_id: string }).platform_video_id));
}

// ─── Read path — RPC wrappers (vector retrieval; fed by retrieve.ts) ──────────

/** A row from either match RPC (snake_case, per the migration RETURNS TABLE). */
export interface SharedMatchRow {
  id: string;
  similarity: number;
  platform: string;
  platform_video_id: string;
  video_url: string | null;
  cover_url: string | null;
  creator_handle: string | null;
  source_pool: SourcePool;
  trust_weight: number;
  views: number | null;
  follower_count: number | null;
  outlier_multiplier: number | null;
  baseline_label: string | null;
  engagement_rate: number | null;
  posted_at: string | null;
  proof_captured_at: string | null;
  niche: string | null;
  hook_archetype: string | null;
  format: string | null;
  /** Visual SETTING (in_world_vlog / studio_set / greenscreen / …) — NOT a first-frame device. Expose as visualSetting. */
  visual_hook: string | null;
  editing_style: string | null;
  spoken_hook: string | null;
  hook_template: string | null;
  hook_source: HookSource | null;
  /**
   * RAW JSONB — deliberately `unknown`, NOT IdeaFacet/TeardownTemplate. Typing these as
   * the domain shape is a cast the compiler cannot verify, and it silently lied for the
   * whole curated corpus (Sandcastles key names vs ours). Run them through
   * parseIdeaFacet / parseTeardownTemplate at the boundary instead.
   */
  idea: unknown;
  template: unknown;
  why_it_works: string | null;
  /**
   * The Sandcastles first-frame TECHNIQUE names this row is filed under ('Camera Whip',
   * '3P Crash Zoom'), aggregated because a row may carry two. `null` when the row belongs to no
   * visual_hooks collection — which is most of them (154 of 524 are tagged), so treat absence as
   * "not catalogued", never as "has no visual hook".
   *
   * Display names, not slugs: this is what a card would print. The slug is the filter key.
   */
  hook_techniques: string[] | null;
}

export interface PersonalMatchRow
  extends Omit<SharedMatchRow, "source_pool" | "trust_weight"> {
  predicted_band: string | null;
  actual_outcome: Record<string, unknown> | null;
}

export interface SharedMatchOptions {
  embedding: number[];
  count: number;
  /** Hard topical gate: the niche to require (or null to not constrain). */
  filterNiche?: string | null;
  /** Rung-2 structural retrieval: exclude the user's own niche (archetype ∩ niche≠user). */
  excludeNiche?: string | null;
  filterPlatform?: string | null;
  filterArchetype?: string | null;
  filterSourcePool?: SourcePool | null;
  filterFormat?: string | null;
  /** Filters the visual_hook column (the visual SETTING taxonomy). */
  filterVisual?: string | null;
  filterEditing?: string | null;
  /**
   * Filters the Sandcastles first-frame TECHNIQUE (`teardown_collections`,
   * category=visual_hooks) — 'camera-whip', '3p-crash-zoom', 'match-cut', …
   *
   * 🔴 A DIFFERENT AXIS from `filterVisual`, despite the shared word. `filterVisual` is the
   * SETTING the video is staged in (greenscreen / studio_set / faceless); this is the DEVICE the
   * first frame uses. Sandcastles ships both and we only ever promoted the setting, so
   * "show me a good visual hook" had nothing to land on until 2026-07-20.
   */
  filterHookTechnique?: string | null;
  /** Filters the technique FAMILY — 'subject-motion', 'pattern-interrupt-visual-switching', … */
  filterHookFamily?: string | null;
}

export async function matchSharedTeardowns(
  supabase: SupabaseClient,
  opts: SharedMatchOptions,
): Promise<SharedMatchRow[]> {
  const { data, error } = await supabase.rpc("match_shared_teardowns", {
    query_embedding: opts.embedding,
    match_count: opts.count,
    filter_niche: opts.filterNiche ?? null,
    exclude_niche: opts.excludeNiche ?? null,
    filter_platform: opts.filterPlatform ?? null,
    filter_archetype: opts.filterArchetype ?? null,
    filter_source_pool: opts.filterSourcePool ?? null,
    filter_format: opts.filterFormat ?? null,
    filter_visual: opts.filterVisual ?? null,
    filter_editing: opts.filterEditing ?? null,
    filter_hook_technique: opts.filterHookTechnique ?? null,
    filter_hook_family: opts.filterHookFamily ?? null,
  });
  if (error) throw new Error(`match_shared_teardowns RPC failed: ${error.message}`);
  return (data ?? []) as SharedMatchRow[];
}

export interface PersonalMatchOptions {
  embedding: number[];
  userId: string;
  count: number;
  filterNiche?: string | null;
  filterPlatform?: string | null;
  filterArchetype?: string | null;
  filterFormat?: string | null;
  /** Filters the visual_hook column (the visual SETTING taxonomy). */
  filterVisual?: string | null;
  filterEditing?: string | null;
}

export async function matchPersonalTeardowns(
  supabase: SupabaseClient,
  opts: PersonalMatchOptions,
): Promise<PersonalMatchRow[]> {
  const { data, error } = await supabase.rpc("match_personal_teardowns", {
    query_embedding: opts.embedding,
    match_user_id: opts.userId,
    match_count: opts.count,
    filter_niche: opts.filterNiche ?? null,
    filter_platform: opts.filterPlatform ?? null,
    filter_archetype: opts.filterArchetype ?? null,
    filter_format: opts.filterFormat ?? null,
    filter_visual: opts.filterVisual ?? null,
    filter_editing: opts.filterEditing ?? null,
  });
  if (error) throw new Error(`match_personal_teardowns RPC failed: ${error.message}`);
  return (data ?? []) as PersonalMatchRow[];
}
