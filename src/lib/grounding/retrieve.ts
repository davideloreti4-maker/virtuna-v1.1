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
import { selectStructuralExamples } from "./rank";
import type { GroundingSkill } from "./prompt";
import { parseIdeaFacet, parseTeardownTemplate, type FitLabel, type RetrievedExample } from "./types";

/** Pre-prune placeholder fit — same as the scrape path (real §11c label is deferred). */
const DEFAULT_FIT: FitLabel = "adjacent";

/**
 * How a skill finds its rows.
 *
 *  • "topical"     — cosine over the subject embedding, gated by a similarity floor. Correct when
 *                    the lesson is BOUND to the subject. That is `ideas`: belief↔reality is a claim
 *                    about what a specific audience believes ("they thought you needed 10k followers
 *                    → actually 800 engaged ones"), and it is worthless to a creator in another
 *                    niche. Here the floor earns its keep.
 *
 *  • "structural"  — archetype-spread over the whole corpus, topic demoted to a tiebreaker (see
 *                    rank.ts). Correct when the lesson is the SHAPE and the subject is a worked
 *                    example. That is `hooks`: a madlib is a hook with the topic already lifted out.
 *
 * The two were the same path until 2026-07-14, and hooks paid for it — 8 of 10 real creator asks
 * retrieved nothing at all, while 515 usable madlibs sat unreachable behind a topical floor they
 * were never meant to clear.
 */
export type RankStrategy = "topical" | "structural";

/** Read-back knobs (resolved from env per call so tests/ops can tune without reload). */
export interface RetrieveConfig {
  /** Cache-hit bar: this many good rows → the scrape is skipped. */
  minRows: number;
  /** Cosine floor — below this a row is topically unrelated, never "good". Ignored when structural. */
  minSimilarity: number;
  /** Freshness window (days) on proof_captured_at; null/absent timestamps pass. */
  freshDays: number;
  /** Rows requested from the RPC (pre-filter). */
  fetchCount: number;
  /** Examples handed to generation on a hit (mirrors the scrape path's topN yield). */
  maxExamples: number;
  /** How the fetched rows are ranked down to `maxExamples`. */
  rank: RankStrategy;
  /**
   * Hard-gate the RPC on the run's platform?
   *
   * TOPICAL skills do (a platform's subjects are its own). STRUCTURAL does NOT: a madlib is a
   * madlib, and the same argument that carries a hook across niches carries it across platforms.
   * The gate was costing hooks two-thirds of the corpus before cosine even ran — a TikTok creator
   * could not see any of the 333 Instagram rows, of which 208 are proof-grade.
   */
  filterPlatform: boolean;
}

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function envFloat(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 && raw < 1 ? raw : fallback;
}

/**
 * Structural retrieval ranks the WHOLE corpus (532 rows today), so it must fetch the whole corpus
 * — a cosine-ordered top-N pool would smuggle the topical bias back in through the pool boundary,
 * which is the bug we are fixing. Sized with headroom; revisit if the corpus outgrows a few
 * thousand rows, at which point the round-robin belongs in SQL.
 */
const STRUCTURAL_POOL = 2000;

/**
 * Per-skill retrieval policy. `skill` is optional: callers that do not name one (and the scrape
 * path's own tests) keep the historical topical behaviour exactly.
 */
export function resolveRetrieveConfig(skill?: GroundingSkill): RetrieveConfig {
  const base = {
    minRows: envInt("GROUNDING_CACHE_MIN_ROWS", 4),
    freshDays: envInt("GROUNDING_CACHE_FRESH_DAYS", 90),
    maxExamples: 6,
  };

  // Escape hatch: GROUNDING_HOOKS_RANK=topical reverts hooks to the old path without a deploy.
  const hooksRank: RankStrategy =
    process.env.GROUNDING_HOOKS_RANK === "topical" ? "topical" : "structural";

  if (skill === "hooks" && hooksRank === "structural") {
    return {
      ...base,
      // No floor. Every curated row is a human-picked teaching example whose structure is sound
      // regardless of its subject, and the floor's only measured effect on hooks was to delete
      // them: it dropped a personal-branding video from a personal-branding query (0.576 < 0.58)
      // while admitting a carbonara recipe (0.673). Topic still ORDERS the results — it just no
      // longer decides whether the creator gets grounding at all.
      minSimilarity: 0,
      fetchCount: envInt("GROUNDING_HOOKS_POOL", STRUCTURAL_POOL),
      rank: "structural",
      filterPlatform: false,
    };
  }

  return {
    ...base,
    // TOPICAL FLOOR — ideas + script only.
    //
    // ⚠️ 0.58 is MIS-CALIBRATED and known to be so. It was measured on the corpus UNFILTERED,
    // but every runner passes filterPlatform, and the platform-filtered distribution sits lower:
    // "personal branding for founders" peaks at 0.629 across all 532 rows but only 0.576 across
    // the 177 TikTok ones — under its own floor. The comment this replaces also claimed off-topic
    // asks land ≤0.54; "carbonara recipe" measures 0.673. The floor does not separate relevant
    // from irrelevant, it detects whether the corpus happens to hold your subject.
    //
    // It is left at 0.58 deliberately: hooks no longer depends on it, and re-tuning it for ideas
    // needs its own measurement (belief↔reality is genuinely subject-bound, so the fix there is a
    // better-calibrated floor, NOT this structural path). Re-measure PER PLATFORM before moving it:
    //   npx tsx scripts/probe-hook-transfer.ts
    minSimilarity: envFloat("GROUNDING_CACHE_MIN_SIMILARITY", 0.58),
    fetchCount: 12,
    rank: "topical",
    filterPlatform: true,
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
/**
 * Is this row's multiplier measured against a REAL, RECORDED baseline?
 *
 * 🔴 It is not, for the entire curated corpus. Measured 2026-07-14: **0 of 532 rows carry a
 * follower_count**, yet 396 of them stored `baseline_label = 'vs followers'` — and 56 of those
 * claim over 100×, topping out at 20,154×. The raw Sandcastles record has exactly one metric,
 * `outlier_score`, and no follower data anywhere in it. The import mapped that score onto
 * `outlier_multiplier` and stamped a baseline nobody had.
 *
 * The consequence was user-facing and false: the card receipt printed
 * "proven by @colinandsamir · 1226.3× vs followers · 60M views" for an account with well over a
 * million followers (the true ratio is nearer 60×), and the prompt told the model these rows had
 * "cleared a real outlier bar — ≥3× its follower count".
 *
 * This is the WARRANT/CLAIM rule at its sharpest. The WARRANT is real — a human hand-picked the
 * row, which is why it is admitted (see isAdmissible). The CLAIM — "N× vs followers" — was
 * invented. The score itself is kept (it is genuine source data and still ranks the corpus); what
 * is dropped is the assertion about what it is measured AGAINST, because we do not know.
 *
 * Scraped rows are unaffected: the orchestrator computes their multiplier from a follower count it
 * actually captured, so for them "vs followers" is a claim we can stand behind.
 */
export function hasFollowerBaseline(row: SharedMatchRow): boolean {
  const f = row.follower_count;
  return typeof f === "number" && Number.isFinite(f) && f > 0;
}

/**
 * May this row be CALLED PROVEN — "cleared ≥3× its follower count"?
 *
 * Only when both halves of that sentence are true: a real recorded follower baseline AND a
 * multiplier that clears the bar against it. A big number measured against nothing is not proof;
 * it is a number. Rows failing this are still admitted and still teach — they are cited as curated
 * exemplars, with their score shown but no baseline asserted.
 */
export function isProofGrade(row: SharedMatchRow): boolean {
  if (!hasFollowerBaseline(row)) return false;
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
    // A baseline we never recorded is not a baseline. The curated import stored 'vs followers' on
    // 396 rows that carry no follower_count at all — so the label is dropped unless the row can
    // actually back it. The SCORE survives (honestMultiplier above); only the false claim about
    // what it was measured against is removed. See hasFollowerBaseline.
    baselineLabel: hasFollowerBaseline(row) ? row.baseline_label : null,
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
  /**
   * Which skill is retrieving — selects the RANKING AXIS, not just the rendered slice.
   *
   * This is the load-bearing argument. Until 2026-07-14 the three skills shared one retrieval
   * (same query, same floor, same rows) and differed only in how the winning rows were RENDERED
   * into the prompt. But hooks and ideas want opposite things from the corpus: hooks wants a
   * spread of SHAPES regardless of subject, ideas wants a subject match. Slicing the render while
   * sharing the selection meant hooks was served rows chosen on a criterion it does not use.
   *
   * Optional so pre-existing callers/tests keep the historical topical behaviour.
   */
  skill?: GroundingSkill;
  /** Creator niche — reserved for facet-filtered rungs; NOT a filter in topical MVP. */
  niche?: string | null;
}

export interface RetrieveResult {
  examples: RetrievedExample[];
  /** True when examples.length ≥ config.minRows — the caller may skip the scrape. */
  enough: boolean;
  stats: {
    matched: number;
    good: number;
    minRows: number;
    minSimilarity: number;
    rank: RankStrategy;
    /** Distinct hook archetypes across the returned examples (structural's whole point). */
    archetypes: number;
  };
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
  const config = deps.config ?? resolveRetrieveConfig(input.skill);
  const supabase = deps.supabase ?? getCorpusClient();
  const embed = deps.embedQuery ?? embedQueryText;

  const embedding = await embed(input.query);
  const rows = await matchSharedTeardowns(supabase, {
    embedding,
    count: config.fetchCount,
    // Structural retrieval reads across platforms on purpose — see RetrieveConfig.filterPlatform.
    filterPlatform: config.filterPlatform ? input.platform : null,
  });

  // Admissibility is NOT ranking: these three drop rows that must never reach the model at all
  // (unproven scrapes, stale proof, rows whose craft fields are empty). The similarity floor sits
  // here too, but at 0 for structural it is a no-op rather than a special case.
  const good = rows.filter(
    (r) =>
      r.similarity >= config.minSimilarity &&
      isFreshTeardown(r.proof_captured_at, config.freshDays, deps.now) &&
      isAdmissible(r) &&
      hasReusableSignal(r),
  );

  const picked =
    config.rank === "structural"
      ? selectStructuralExamples(good, config.maxExamples)
      : good.slice(0, config.maxExamples);

  const examples = picked.map(matchRowToExample);

  return {
    examples,
    enough: examples.length >= config.minRows,
    stats: {
      matched: rows.length,
      good: good.length,
      minRows: config.minRows,
      minSimilarity: config.minSimilarity,
      rank: config.rank,
      archetypes: new Set(examples.map((e) => e.hookArchetype ?? "(unclassified)")).size,
    },
  };
}
