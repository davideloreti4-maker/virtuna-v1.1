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
import { MIN_OUTLIER_MULTIPLIER } from "./outlier-gate";
import { getCorpusClient, matchSharedTeardowns, type SharedMatchRow } from "./corpus";
import { embedQueryText } from "./embedder";
import { parseIdeaFacet, parseTeardownTemplate, type FitLabel, type RetrievedExample } from "./types";

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
    // RE-CALIBRATED 2026-07-14 against the real 532-row curated corpus: 0.65 → 0.58.
    //
    // The old 0.65 was tuned on a 22-row TEST corpus, and on the real one it sat INSIDE the
    // true-positive band — silently rejecting almost everything. Measured on the live corpus:
    //   on-topic  ("personal branding for founders", "faceless content ideas") → 0.58–0.68,
    //             including @jarrydsinclair 39×, @brian_blum 48×, @peter.visuals 160×
    //   off-topic ("carbonara recipe", "leaking radiator", "puppy training")   → ≤ 0.54
    // A 0.65 floor kept ~nothing; 0.58 clears every off-topic hit observed with headroom.
    //
    // Curated rows embed a thinner subject than scraped ones (no caption/hashtags in the
    // Sandcastles record), which drags their cosine down across the board — the floor has to
    // be set against the corpus we actually have, not the one we tested on. Re-measure with
    // `npx tsx scripts/preview-grounding-slices.ts "<query>" <platform> --debug` before moving it.
    minSimilarity: envFloat("GROUNDING_CACHE_MIN_SIMILARITY", 0.58),
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

/**
 * A row is only worth grounding on if it carries something REUSABLE — a hook to adapt,
 * a structure to borrow, or an idea to reframe. The curated import includes 8 videos
 * whose source went private/deleted before Sandcastles could analyse them: they embed
 * and match like any other row, but every craft field is empty, and they would reach the
 * model as a receipt attached to nothing. A source with no lesson is not grounding.
 *
 * Checks CONTENT, not presence: one of those 8 carries a template object that is fully
 * empty ({name:"", skeleton:[], beats:[]}). A truthiness check passes it, `structureLine`
 * then finds nothing to say and emits the literal string "(structure)" into the prompt.
 * Empty is not the same as absent.
 */
/**
 * Does this row clear the §12 LOCKED outlier bar — `views ÷ followers ≥ 3×`?
 *
 * This is NOT an admission filter. It selects the row's WARRANT — the reason we are allowed
 * to show it to the model at all — because the corpus has two kinds of row and they earn
 * their place in different ways:
 *
 *  • SCRAPED rows have no human in the loop. We pulled them off a niche query, so the ONLY
 *    thing distinguishing a real lesson from a random video is the metric. The 3× gate is
 *    load-bearing there, and the orchestrator applies it at write time.
 *
 *  • CURATED rows were hand-picked by Sandcastles into teaching collections. A human decided
 *    each one demonstrates something. That curation IS the warrant — which is why they are
 *    admitted regardless of the metric (owner call, 2026-07-14). Half their TikTok library
 *    simply has no score computed; excluding those was throwing away good videos for missing
 *    data, not for poor performance (the scored TikTok rows have an 11.3× median).
 *
 * What does NOT follow is that we may call an unscored — or a 0.5× — video "proven". 20 rows
 * scored BELOW 1×: the video drew fewer views than the account has followers. It underperformed.
 * So the metric decides the CLAIM, not the admission: rows clearing this bar are cited as proven
 * outliers with their multiplier; the rest are cited honestly as curated exemplars (see
 * prompt.ts `receipt`). Every row gets in; no row gets a receipt it did not earn.
 */
export function isProofGrade(row: SharedMatchRow): boolean {
  const m = row.outlier_multiplier;
  return typeof m === "number" && Number.isFinite(m) && m >= MIN_OUTLIER_MULTIPLIER;
}

/**
 * May this row ground generation at all? Curated rows are admitted on human curation;
 * scraped rows must have earned it on the metric (belt-and-braces — the orchestrator
 * already gates them on write).
 */
export function isAdmissible(row: SharedMatchRow): boolean {
  if (row.source_pool === "curated") return true;
  return isProofGrade(row);
}

export function hasReusableSignal(row: SharedMatchRow): boolean {
  if (row.spoken_hook || row.hook_template) return true;

  const idea = parseIdeaFacet(row.idea);
  if (idea && (idea.seed || idea.angle || idea.belief || idea.reality)) return true;

  const template = parseTeardownTemplate(row.template);
  if (template && (template.name || template.skeleton.length > 0 || (template.beats?.length ?? 0) > 0)) {
    return true;
  }

  return false;
}

/**
 * A multiplier is a CLAIM ("this beat its baseline 44×"). Zero and negative are not claims,
 * they are missing measurements wearing a number's clothes — 136 of the 532 curated rows
 * carry `0`, which would render as "proven by @creator · 0.0× · 820K views": a receipt
 * asserting the video performed zero times its own baseline. Absent is honest; zero is not.
 * Coerced at the boundary so BOTH the prompt and the on-card receipt are protected.
 */
function honestMultiplier(m: number | null): number | null {
  return typeof m === "number" && Number.isFinite(m) && m > 0 ? m : null;
}

/** Map a match row onto the generation-facing example (mirrors toRetrievedExample). */
export function matchRowToExample(row: SharedMatchRow): RetrievedExample {
  return {
    teardownId: row.id,
    handle: row.creator_handle,
    videoUrl: row.video_url,
    coverUrl: row.cover_url,
    platform: row.platform,
    multiplier: honestMultiplier(row.outlier_multiplier),
    views: row.views,
    baselineLabel: row.baseline_label,
    fitLabel: DEFAULT_FIT,
    hookArchetype: row.hook_archetype,
    format: row.format,
    spokenHook: row.spoken_hook,
    hookTemplate: row.hook_template,
    template: parseTeardownTemplate(row.template),
    idea: parseIdeaFacet(row.idea),
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
      isFreshTeardown(r.proof_captured_at, config.freshDays, deps.now) &&
      isAdmissible(r) &&
      hasReusableSignal(r),
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
