/**
 * grounding/retrieve.ts — teardown cache read-back (gather-once / walk-many).
 *
 * The extract-once payoff: embed the run's topic query → match_shared_teardowns
 * (pgvector cosine over the §13 corpus) → map the good rows straight onto
 * RetrievedExample[]. When the cache yields enough good rows the scrape pipeline
 * (orchestrator.gatherAndExtract, ~40–70s + Apify cents) is SKIPPED — instant + free.
 * gather-for-run tries this FIRST and falls through to the scrape on any miss/failure.
 *
 * "Good row" = similarity ≥ minSimilarity AND fresh. Freshness is the cheap policy:
 * a teardown's STRUCTURE never rots and its proof is frozen-at-capture by design
 * (§13 stable receipt) — the window only guards topical/trend decay, so it is wide
 * (default 90 days on proof_captured_at; rows without a timestamp pass). All knobs
 * env-tunable without redeploy semantics changes.
 *
 * Personal pool (Rung −1): matchPersonalTeardowns exists (corpus.ts) but has no
 * producer and the runners carry no user identity yet — the union lands with the
 * personal-teardown producer (explicit follow-on, §13 union-weighted-in-TS design).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getCorpusClient, matchSharedTeardowns, type SharedMatchRow } from "./corpus";
import { embedQueryText } from "./embedder";
import type { FitLabel, RetrievedExample } from "./types";

/** Pre-prune placeholder fit — same as the scrape path (real §11c label is deferred). */
const DEFAULT_FIT: FitLabel = "adjacent";

/** Read-back knobs (resolved from env per call so tests/ops can tune without reload). */
export interface RetrieveConfig {
  /** Cache-hit bar: this many good rows → the scrape is skipped. */
  minRows: number;
  /** Cosine floor — below this a row is topically unrelated, never "good". */
  minSimilarity: number;
  /** Freshness window (days) on proof_captured_at; null/absent timestamps pass. */
  freshDays: number;
  /** Rows requested from the RPC (pre-filter). */
  fetchCount: number;
  /** Examples handed to generation on a hit (mirrors the scrape path's topN yield). */
  maxExamples: number;
}

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function envFloat(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 && raw < 1 ? raw : fallback;
}

export function resolveRetrieveConfig(): RetrieveConfig {
  return {
    minRows: envInt("GROUNDING_CACHE_MIN_ROWS", 4),
    // 0.65 calibrated live against text-embedding-v3 (2026-07-12, 22-row corpus):
    // on-topic query → 0.66–0.83 (9 rows pass), adjacent-topic → one 0.72 outlier
    // then ≤0.63 (2 pass < minRows → honest miss), off-topic → ≤0.50 (0 pass).
    // 0.6 was too loose — an adjacent query false-HIT with 4 rows.
    minSimilarity: envFloat("GROUNDING_CACHE_MIN_SIMILARITY", 0.65),
    freshDays: envInt("GROUNDING_CACHE_FRESH_DAYS", 90),
    fetchCount: 12,
    maxExamples: 6,
  };
}

/** Cheap freshness: proof_captured_at within the window; missing timestamp passes. */
export function isFreshTeardown(
  proofCapturedAt: string | null,
  freshDays: number,
  now: Date = new Date(),
): boolean {
  if (!proofCapturedAt) return true;
  const captured = Date.parse(proofCapturedAt);
  if (!Number.isFinite(captured)) return true;
  return now.getTime() - captured <= freshDays * 24 * 60 * 60 * 1000;
}

/** Map a match row onto the generation-facing example (mirrors toRetrievedExample). */
export function matchRowToExample(row: SharedMatchRow): RetrievedExample {
  return {
    teardownId: row.id,
    handle: row.creator_handle,
    videoUrl: row.video_url,
    coverUrl: row.cover_url,
    platform: row.platform,
    multiplier: row.outlier_multiplier,
    views: row.views,
    baselineLabel: row.baseline_label,
    fitLabel: DEFAULT_FIT,
    hookArchetype: row.hook_archetype,
    format: row.format,
    spokenHook: row.spoken_hook,
    hookTemplate: row.hook_template,
    template: row.template,
    idea: row.idea,
    whyItWorks: row.why_it_works,
    sourcePool: row.source_pool,
    trustWeight: typeof row.trust_weight === "number" ? row.trust_weight : 1.0,
    fromPersonal: false,
  };
}

export interface RetrieveInput {
  query: string;
  platform: string;
  /** Creator niche — reserved for facet-filtered rungs; NOT a filter in topical MVP. */
  niche?: string | null;
}

export interface RetrieveResult {
  examples: RetrievedExample[];
  /** True when examples.length ≥ config.minRows — the caller may skip the scrape. */
  enough: boolean;
  stats: { matched: number; good: number; minRows: number; minSimilarity: number };
}

/**
 * Read the teardown cache for `query`. Throws on embed/RPC failure — the caller
 * (gather-for-run) degrades to the scrape path, never to a fabricated source.
 */
export async function retrieveCachedExamples(
  input: RetrieveInput,
  deps: {
    supabase?: SupabaseClient;
    embedQuery?: (text: string) => Promise<number[]>;
    config?: RetrieveConfig;
    now?: Date;
  } = {},
): Promise<RetrieveResult> {
  const config = deps.config ?? resolveRetrieveConfig();
  const supabase = deps.supabase ?? getCorpusClient();
  const embed = deps.embedQuery ?? embedQueryText;

  const embedding = await embed(input.query);
  const rows = await matchSharedTeardowns(supabase, {
    embedding,
    count: config.fetchCount,
    filterPlatform: input.platform,
  });

  const good = rows.filter(
    (r) =>
      r.similarity >= config.minSimilarity &&
      isFreshTeardown(r.proof_captured_at, config.freshDays, deps.now),
  );
  const examples = good.slice(0, config.maxExamples).map(matchRowToExample);

  return {
    examples,
    enough: examples.length >= config.minRows,
    stats: {
      matched: rows.length,
      good: good.length,
      minRows: config.minRows,
      minSimilarity: config.minSimilarity,
    },
  };
}
