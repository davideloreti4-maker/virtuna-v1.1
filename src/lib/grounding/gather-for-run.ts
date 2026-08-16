/**
 * gather-for-run.ts — the ONE shared runner-side grounding step (§11f fan-out).
 *
 * Every grounded skill runner (hooks/ideas/script) performs the same pre-generation
 * gather: pull LIVE outlier teardowns for the run's topic → format them into the
 * additive `corpus` prompt block → retain the RetrievedExample[] so the BUILD step
 * can map each output's `sourceIndex` back to the real outlier it adapted (the
 * on-card receipt). This module centralizes that step so the three runners cannot
 * drift on degrade semantics.
 *
 * Contract:
 *  - READ-BACK runs for any supported platform; the SCRAPE only runs on TikTok.
 *    These were conflated until 2026-07-14, and the cost was severe: the whole step
 *    short-circuited unless platform === "tiktok", because the SCRAPE path is
 *    clockworks/TikTok-only. But the read-back is just pgvector over a cached corpus —
 *    it has no TikTok dependency at all. The curated corpus is 333 Instagram rows (208 of
 *    them proof-grade) to TikTok's 177, so the platform gate left an Instagram creator with
 *    ZERO grounding, permanently, and made the majority of the corpus unreachable by anyone.
 *    Now: read the cache on any platform; fall through to the scrape only where we can scrape.
 *  - Emits the "Finding proven outliers" stage at the REAL boundary (honesty spine).
 *    The stage is honest on BOTH paths — cache read-back finds proven outliers too,
 *    just instantly.
 *  - Read-back FIRST **on an unauthorized run** (gather-once/walk-many): the teardown cache is
 *    consulted before any scrape; enough good cached rows → the scrape is skipped entirely.
 *  - LIVE FIRST **on an authorized one** (owner call 2026-08-15). `allowScrape` REORDERS the step;
 *    it does not merely unlock its tail. Until this ruling the read-back returned early on a hit,
 *    so `allowScrape` was consulted only after a MISS — and the 532-row corpus almost never misses
 *    (95.5% of real asks clear gate 1; "restoring vintage fountain pens", picked to be obscure,
 *    hit). Two consequences, both measured: `LIVE_SCRAPE_DEFAULT` could be ON and never once reach
 *    Apify, and a SECOND tap of "Find new outliers" was answered by the write-through the FIRST tap
 *    had just populated. An authorization that is unreachable on 19 of every 20 asks is not a
 *    feature flag, it is a decoration.
 *    The cache is not deleted from that path — it becomes the SAFETY NET. An empty or failed scrape
 *    falls through to the read-back, so a broken upstream (clockworks returns SUCCEEDED + 0 items;
 *    see §2 of the 2026-08-14 handoff) cannot leave an authorized run WORSE off than a free one.
 *  - The SCRAPE IS EXPLICIT-ONLY (`allowScrape`, default false — owner call 2026-07-17).
 *    A cache miss on a default run degrades to ungrounded; it does NOT reach for Apify.
 *    Spending the owner's money is a decision the user makes, not a consequence of the
 *    corpus being thin on their subject. `allowScrape: true` (a deliberate "find me new
 *    outliers" action) restores the live scrape, whose write-through populates the cache
 *    so the NEXT run on that subject is free — the gather-once/walk-many loop, driven by
 *    intent instead of by accident.
 *  - Degrade is always honest and never blocking: corpus stays undefined, examples stay [],
 *    a warning is pushed. Never fabricate a source, never block generation.
 *  - It reports back whether a scrape WOULD have helped (`scrapeAvailable`): true only when the
 *    run degraded (or grounded on a partial) purely because `allowScrape` was false on a scrapable
 *    platform. That is the capability signal behind the "Find new outliers" button — the SERVER
 *    knows a scrape is worth offering (grounding on, platform scrapable, cache thin), so the glass
 *    never has to guess. False on a full cache hit (grounded, no need), on a non-scrapable platform
 *    (nothing to reach for), when grounding is off, and while a scrape is already running.
 */

import { gatherAndExtract } from "@/lib/grounding/orchestrator";
import { buildCorpusBlock, type GroundingSkill } from "@/lib/grounding/prompt";
import { adaptCorpusBlock, type AdaptProfile } from "@/lib/grounding/adapt";
import { fetchBeatTranscripts, getCorpusClient } from "@/lib/grounding/corpus";
import { retrieveCachedExamples, resolveRetrieveConfig } from "@/lib/grounding/retrieve";
import { distillSearchQuery } from "@/lib/grounding/distill-query";
import { assessWarrant, type Warrant, type WarrantAxis } from "@/lib/grounding/warrant";
import type { RetrievedExample } from "@/lib/grounding/types";
import { buildVideoEvidence, evidenceMetric, type RunEvidence } from "@/lib/tools/evidence";
import { formatCount } from "@/lib/account-metrics/account-metrics";
import { MIN_OUTLIER_MULTIPLIER } from "@/lib/grounding/outlier-gate";

/** The stage name shown on the thread loading spine while gathering (shared by all skills). */
export const GROUNDING_STAGE_NAME = "Finding proven outliers";

export interface GatherCorpusInput {
  /** Per-skill env gate, resolved by the caller (e.g. GROUNDING_HOOKS_ENABLED === "true"). */
  enabled: boolean;
  /**
   * May this run pay for a LIVE SCRAPE on a cache miss? Default false — the scrape is an
   * explicit, user-authorized action, never an automatic consequence of a thin corpus.
   *
   * The read-back is free; the scrape is ~25s of Apify. Measured 2026-07-17 against the real
   * 532-row corpus: at the 0.58 floor only 3 of 12 realistic asks cleared it, so an automatic
   * fallback billed the owner on 75% of ideas/script runs — silently, with no affordance and
   * no way to decline. That is the wrong default for a spend. A miss now degrades to ungrounded
   * (free, instant, honest); the user gets the outliers we already own, and asks for new ones
   * when they want them.
   */
  allowScrape?: boolean;
  /**
   * Which skill is grounding. One teardown holds several lessons; this selects the SLICE the
   * model is shown (hooks → the madlib · ideas → belief↔reality · script → the timed beats).
   */
  skill: GroundingSkill;
  /** Target platform — the gather path is TikTok-only in MVP. */
  platform: string;
  /** Topic to ground on, in priority order — first non-empty wins (ask → anchor → niche). */
  queryCandidates: Array<string | null | undefined>;
  /** Creator niche passed to the orchestrator (audience-prune context). */
  niche: string | null;
  /** Runner stage callback — forwarded at the real gather boundaries. */
  onStage?: (name: string, status: "active" | "done") => void;
  /**
   * Runner EVIDENCE callback — fired once, with the proven videos the model is actually shown.
   *
   * This is the payoff of grounding, made visible during the wait instead of only afterwards on a
   * card receipt. The rows exist ~40s before the first hook does (retrieval precedes generation),
   * and the creator spent that whole stretch looking at a shimmer while the engine held their
   * evidence in memory. Fires only when rows survive `used` — never on a degrade, so it cannot
   * imply grounding that did not happen.
   */
  onEvidence?: (evidence: RunEvidence) => void;
  /** Runner warning sink — degrade reasons land here (surfaced via the SSE warning event). */
  warnings: string[];
  /**
   * Route the retrieved corpus through the grounding-as-REMIX adapt stage (decode→adapt briefer,
   * adapt.ts) instead of the raw per-skill slice? Default-off; supported for hooks, ideas, and
   * script (Phase 2). Resolved by the caller (GROUNDING_<SKILL>_ADAPT === "true"). Requires
   * `adaptProfile`; absent → skipped.
   */
  adapt?: boolean;
  /** Creator context the adapt stage re-voices the proven structures toward. */
  adaptProfile?: AdaptProfile;
}

/** Platforms whose teardowns live in the corpus and can be retrieved. */
const READABLE_PLATFORMS = new Set(["tiktok", "instagram", "youtube"]);

/**
 * The generate-by-remix skills the adapt briefer supports (decision doc §4d, consumption mode 1).
 * GroundingSkill is exactly these three today, but the set is explicit so a future non-remix skill
 * routed through this seam would NOT silently get the dosage briefer meant for structure transfer.
 */
const ADAPT_SKILLS = new Set<GroundingSkill>(["hooks", "ideas", "script"]);

/** The live scrape+extract path is Apify/clockworks — TikTok only. IG native is the fast-follow. */
const SCRAPABLE_PLATFORMS = new Set(["tiktok"]);

export interface GatherCorpusResult {
  /** Formatted grounding block for AssemblerInput.corpus — undefined on skip/degrade. */
  corpus: string | undefined;
  /** The retrieved examples backing `corpus` — [] on skip/degrade (no receipt without a source). */
  examples: RetrievedExample[];
  /**
   * Would a live scrape have found outliers this run couldn't? True ONLY when the run degraded (or
   * grounded on a thin partial) purely because `allowScrape` was false on a scrapable platform —
   * i.e. we could have scraped, the user just didn't authorize the spend. This is the capability
   * signal behind the "Find new outliers" affordance: the server already knows a scrape is worth
   * offering, so the glass never guesses. False on a full cache hit, a non-scrapable platform,
   * grounding-off, or while a scrape is already running (allowScrape true → nothing to offer).
   */
  scrapeAvailable: boolean;
  /**
   * May this run be presented as grounded, and on what basis? The SHARED contract (warrant.ts), not
   * a local `examples.length > 0` inference.
   *
   * The old inference was sound but only by coincidence: the per-skill retrieval floor happens to sit
   * AT the warrant floor, so every row that reached the runner had already cleared it. Asking the
   * question explicitly means the runners stay honest if either floor ever moves — and it is the
   * only place that can distinguish a topical batch from a structural or a freshly-scraped one.
   */
  warrant: Warrant;
  /** Convenience mirror of `warrant !== "none"` — what the card's `grounded` flag is set from. */
  grounded: boolean;
  /**
   * Did the adapt BRIEF ship as `corpus` (true), or the raw per-skill slice (false — including
   * every adapt fallback)? The runners' citation-honesty guard keys off this: the madlib-
   * instantiation check (output-guards.ts templateInstantiated) verifies the slice contract —
   * "instructed to instantiate what it was shown" — and demonstrably strips honest brief-path
   * citations (measured 23/28 on the 07-15 A/B output), because under the brief the model never
   * saw the madlib. The lexical guard therefore binds ONLY when `adapted` is false.
   */
  adapted: boolean;
}

/** Injectable pipeline fns (tests swap these; prod uses the real modules). */
export interface GatherCorpusDeps {
  retrieve?: typeof retrieveCachedExamples;
  gather?: typeof gatherAndExtract;
  adapt?: typeof adaptCorpusBlock;
  /** Query distiller (Task: grounded-attribution). Long chat asks → search-shaped queries. */
  distill?: typeof distillSearchQuery;
  /** C3: per-beat transcript read for the script briefer (id → per-section sentences). */
  transcripts?: (ids: string[]) => Promise<Map<string, string[][]>>;
}

/**
 * C3 deep anatomy (script adapt only): attach what each source actually SAID per timed beat to
 * COPIES of the examples, positionally (the curated import built `template.beats` from these
 * same sections 1:1). Only the BRIEFER's decode view renders the field — the raw slice and the
 * writer never see source words (the measured verbatim-transplant drift). Degrade-safe: any
 * fetch failure or shape mismatch returns the examples unchanged, and the brief ships without.
 */
async function enrichWithTranscripts(
  examples: RetrievedExample[],
  fetchTranscripts: GatherCorpusDeps["transcripts"],
): Promise<RetrievedExample[]> {
  const fetch =
    fetchTranscripts ?? ((ids: string[]) => fetchBeatTranscripts(getCorpusClient(), ids));
  try {
    const map = await fetch(examples.map((ex) => ex.teardownId));
    if (map.size === 0) return examples;
    return examples.map((ex) => {
      const sections = map.get(ex.teardownId);
      const beats = ex.template?.beats;
      if (!sections?.length || !beats?.length) return ex;
      return {
        ...ex,
        template: {
          ...ex.template!,
          beats: beats.map((b, i) =>
            sections[i] && sections[i]!.length > 0 ? { ...b, transcript: sections[i]! } : b,
          ),
        },
      };
    });
  } catch (err) {
    console.warn(
      `[grounding] beat-transcript fetch failed (brief ships without): ${err instanceof Error ? err.message : String(err)}`,
    );
    return examples;
  }
}

/**
 * The rail's headline states what these rows are evidence OF — the same distinction
 * corpus-references-block.tsx draws for the chat agent's cited sources, for the same reason: a
 * STRUCTURAL batch is proven shape borrowed from other subjects, and a creator who reads it as
 * "3 videos about my topic" has been misled by the wait rather than by the cards.
 *
 * ⚠️ EVERY VERB HERE MUST DESCRIBE RETRIEVAL, NEVER THE OUTPUT (F-4, fixed 2026-08-13). This fires
 * the moment the rows come back — before a single card exists — so any word claiming what the cards
 * DID is a promise made before the outcome is knowable. "Borrowing shape from N proven videos" was
 * exactly that, and measured it was wrong most of the time: only ~4% of hook cards end up carrying
 * a receipt, because the model claims a madlib it did not instantiate and `templateInstantiated`
 * correctly strips the false citation (81% strip rate over 58 real pairs). The rows ARE real and
 * the model IS shown them — so "Reading" is true at that instant and "Borrowing" is not.
 *
 * 🔑 The fix is the copy, NOT the guard. Stripping an uninstantiated citation is correct: the model
 * is told to "INSTANTIATE the madlib" and to cite 0 when it doesn't (prompt.ts), so a false
 * sourceIndex is a false claim. See docs/HANDOFF-2026-08-13-audit-rewalk.md §0.
 */
function evidenceHeadline(warrant: Warrant, count: number): string {
  const videos = count === 1 ? "video" : "videos";
  if (warrant === "structural") return `Reading shape from ${count} proven ${videos}`;
  if (warrant === "provenance") return `Found ${count} proven ${videos}`;
  // TOPICAL — the weakest of the three warrants, and until 2026-08-15 it carried the strongest
  // wording ("Drafting against N proven videos"). Two separate defects in one string:
  //
  //  1. "proven" is not earned here. Structural rows are human-curated teaching examples and
  //     provenance rows cleared a search-by-subject + above-baseline outlier gate; a topical row
  //     earns its place by COSINE ALONE, at a 0.5 floor sitting ~0.05 above the corpus's own
  //     median (retrieve.ts). Measured 2026-08-15 across 346 queries
  //     (scripts/probe-warrant-floor.ts) that floor admits `asdfghjkl qwerty zxcvbn` (0.521),
  //     `the` (0.522) and `yes` (0.547). The chat surface already said so — it renders
  //     "N real videos on this" for topical and reserves "proven" for structural
  //     (corpus-references-block.tsx:87). One warrant described at two strengths is the bug.
  //  2. "Drafting against" is an OUTPUT verb on a callback that fires before any card exists —
  //     the same F-4 defect fixed for the structural branch on 2026-08-13 ("Borrowing" →
  //     "Reading"). The rarer path got fixed; the ~95% path kept the bug.
  //
  // ⚠️ Raising the floor was measured and REJECTED as the alternative (owner ruling 2026-08-15):
  // `ok` (0.553) outscores the corpus's OWN labels `education-science` (0.541) and `other`
  // (0.540), so no floor separates contentless input from the corpus's own vocabulary. Fix the
  // claim, not the threshold.
  return `Reading ${count} real ${videos} matched to this subject`;
}

/**
 * Fire the evidence callback with the rows the model was shown. Degrade-safe by construction:
 * `buildVideoEvidence` returns null when no row carries a handle or a cover, and a throw here
 * (a callback that dies mid-run) must never take the generation down with it — grounding is an
 * enhancement, and so is showing it.
 */
function emitEvidence(
  onEvidence: ((evidence: RunEvidence) => void) | undefined,
  warrant: Warrant,
  used: RetrievedExample[],
): void {
  if (!onEvidence || used.length === 0) return;
  try {
    const evidence = buildVideoEvidence(
      (count) => evidenceHeadline(warrant, count),
      used.map((ex) => ({
        handle: ex.handle,
        image: ex.coverUrl,
        href: ex.videoUrl,
        // The same gate the on-card receipt applies (build-proof.ts provenMultiplier): a
        // multiplier is a CLAIM, so it ships only when it cleared MIN_OUTLIER_MULTIPLIER. The
        // corpus admits hand-curated rows scoring below 1× — "0.5× vs followers" is a boast that
        // refutes itself. Under the bar we fall back to raw views and make no performance claim.
        metric: evidenceMetric({
          multiplier:
            typeof ex.multiplier === "number" &&
            Number.isFinite(ex.multiplier) &&
            ex.multiplier >= MIN_OUTLIER_MULTIPLIER
              ? ex.multiplier
              : null,
          views: ex.views,
          baselineLabel: ex.baselineLabel,
          formatCount,
        }),
      })),
    );
    if (evidence) onEvidence(evidence);
  } catch (err) {
    console.warn(
      `[grounding] evidence emit failed (ignored): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Gather outlier teardowns for a skill run (gated, degrade-safe): teardown-cache
 * read-back first, live scrape on miss. Returns `{ corpus: undefined, examples: [] }`
 * on any skip or full failure — the caller's generation path is byte-identical to
 * ungrounded in that case.
 */
export async function gatherCorpusForRun(
  input: GatherCorpusInput,
  deps: GatherCorpusDeps = {},
): Promise<GatherCorpusResult> {
  const none: GatherCorpusResult = {
    corpus: undefined,
    examples: [],
    scrapeAvailable: false,
    warrant: "none",
    grounded: false,
    adapted: false,
  };
  if (!input.enabled || !READABLE_PLATFORMS.has(input.platform)) return none;

  const rawQuery = input.queryCandidates.find((q) => q && q.trim().length > 0)?.trim() ?? "";
  if (!rawQuery) return none;
  const distill = deps.distill ?? distillSearchQuery;
  // Retrieval + scrape run on the distilled query (search-shaped); the adapt briefer keeps the
  // RAW ask — fit is judged against what the creator actually said, not the compressed subject.
  const query = await distill(rawQuery);
  if (query !== rawQuery) {
    console.info(`[grounding] distilled query "${query}" from ${rawQuery.length}-char ask`);
  }

  const retrieve = deps.retrieve ?? retrieveCachedExamples;
  const gather = deps.gather ?? gatherAndExtract;
  const adapt = deps.adapt ?? adaptCorpusBlock;

  /**
   * Turn the retrieved exemplars into the `{ corpus, examples }` result the runner consumes.
   * ONE place so all three retrieval paths (cache hit · non-scrapable partial · live scrape) route
   * identically: the grounding-as-remix adapt briefer when it is enabled (an adapt-supported skill +
   * a profile), otherwise the raw per-skill slice. `used` (not the input list) is returned as
   * `examples` so the runner's sourceIndex→receipt mapping stays positional and exact on BOTH paths.
   */
  /**
   * The warrant AXIS is the retrieval's own ranking strategy, read from the same config the
   * retrieval used — not hardcoded per skill. `GROUNDING_HOOKS_RANK=topical` flips hooks back to
   * topical ranking without a deploy, and a warrant that ignored that would describe a retrieval
   * that didn't happen.
   */
  const cacheAxis: WarrantAxis =
    resolveRetrieveConfig(input.skill).rank === "structural" ? "structural" : "topical";

  const finalize = async (
    examples: RetrievedExample[],
    scrapeAvailable = false,
    /**
     * How THESE rows were obtained. Defaults to the cache axis; the scrape branch overrides it,
     * because a freshly extracted row carries no cosine and must not be judged by one.
     */
    axis: WarrantAxis = cacheAxis,
  ): Promise<GatherCorpusResult> => {
    // Assessed on the rows the model is actually SHOWN (`used`), never on the wider input list —
    // a row we retrieved and then dropped cannot warrant anything the model could not read.
    const settle = (
      corpus: string | undefined,
      used: RetrievedExample[],
      adapted: boolean,
    ): GatherCorpusResult => {
      const { warrant, grounded } = assessWarrant(axis, used);
      // The loading rail gets the SAME rows the model got, described by the SAME warrant the cards
      // will be stamped with — so the wait can never advertise evidence the output then disclaims.
      if (grounded) emitEvidence(input.onEvidence, warrant, used);
      return { corpus, examples: used, scrapeAvailable, warrant, grounded, adapted };
    };
    if (input.adapt && ADAPT_SKILLS.has(input.skill) && input.adaptProfile && examples.length > 0) {
      // C3 deep anatomy (script only): the briefer's decode view additionally gets what each
      // source SAID per timed beat. Enrichment copies — the original examples stay untouched.
      const briefed =
        input.skill === "script"
          ? await enrichWithTranscripts(examples, deps.transcripts)
          : examples;
      // `adapted` comes from the adapt stage itself, NOT from this branch having run: the briefer
      // falls back internally (LLM failure, kept-0 sweep) and its fallback IS the raw slice — a
      // corpus the citation guard must still verify under the slice contract.
      const { corpus, used, adapted } = await adapt({
        skill: input.skill,
        ask: rawQuery,
        niche: input.niche,
        platform: input.platform,
        profile: input.adaptProfile,
        examples: briefed,
      });
      return settle(corpus, used, adapted);
    }
    const { corpus, used } = buildCorpusBlock(examples, input.skill);
    return settle(corpus, used, false);
  };

  /**
   * Does this run reach for Apify BEFORE the cache? Authorization reorders the step; it does not
   * merely unlock its tail. See the LIVE-FIRST note in the file header for why.
   */
  const liveFirst = input.allowScrape === true && SCRAPABLE_PLATFORMS.has(input.platform);

  input.onStage?.(GROUNDING_STAGE_NAME, "active");
  try {
    /**
     * 0. LIVE FIRST, when the spend is authorized. A hit here is what the user asked and paid for,
     *    so the cache does not get to answer over it. Only an empty or failed scrape falls through
     *    to the read-back below, which is why this branch returns rather than assigning.
     */
    let liveFailure: Error | null = null;
    if (liveFirst) {
      try {
        const { examples } = await gather({
          query,
          platform: input.platform,
          niche: input.niche,
          onEvidence: input.onEvidence,
        });
        if (examples.length > 0) {
          console.info(`[grounding] live scrape for "${query}" — ${examples.length} fresh rows`);
          // PROVENANCE, not the cache axis: these rows were just extracted, so they carry no
          // similarity (orchestrator.ts sets it null by design). Judging them topically would mark
          // the run the user paid Apify for as ungrounded — their warrant is the search-by-subject
          // + outlier proof gate.
          return finalize(examples, false, "provenance");
        }
        console.info(
          `[grounding] live scrape for "${query}" returned no usable rows — falling back to the cache`,
        );
      } catch (err) {
        // Held, not thrown: the cache may still rescue this run, and only if it cannot does the
        // user need to hear that a scrape failed. Rethrown at the tail so the outer catch keeps
        // being the ONE place a warning is pushed.
        liveFailure = err instanceof Error ? err : new Error(String(err));
        console.warn(`[grounding] live scrape failed (falling back to the cache): ${liveFailure.message}`);
      }
    }

    // 1. read-back: enough good cached teardowns → skip the scrape (instant + free).
    let partial: RetrievedExample[] = [];
    try {
      // `skill` selects the RANKING AXIS, not just the rendered slice — hooks ranks on structure
      // (archetype spread, topic demoted to a tiebreaker), ideas/script rank on topical cosine.
      // Forwarding it is load-bearing: without it every skill silently retrieves topically, which
      // is the defect this argument exists to fix.
      const cached = await retrieve({
        query,
        platform: input.platform,
        skill: input.skill,
        niche: input.niche,
      });
      if (cached.enough) {
        console.info(
          `[grounding] cache HIT for "${query}" (${input.skill}/${cached.stats.rank}) — ` +
            `${cached.examples.length} teardowns across ${cached.stats.archetypes} archetypes ` +
            `(≥${cached.stats.minRows}), scrape skipped`,
        );
        // `used` (not the input list) — the model can only cite what it was actually shown,
        // and the runner resolves sourceIndex positionally against this array.
        return finalize(cached.examples);
      }
      partial = cached.examples;
      console.info(
        `[grounding] cache miss for "${query}" — ${cached.stats.good}/${cached.stats.minRows} good rows (${cached.stats.matched} matched)`,
      );
    } catch (err) {
      // Read-back is an optimization — its failure is NOT a grounding failure.
      console.warn(
        `[grounding] cache read-back failed (falling through to live scrape): ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // 2. live scrape + extract (write-through populates the cache for next time).
    //    Only where we can actually scrape, and only when the USER asked to pay for it.
    //    `minRows` decides whether the scrape is WORTH skipping — it is not a quality bar, and
    //    where there is no scrape to reach for there is no scrape to skip. Throwing away 2 real
    //    proven outliers to run ungrounded, because a threshold designed to save an Apify call
    //    said "only 2", would be self-defeating: two proven sources beat none. Use what we found;
    //    degrade to raw only when we found nothing at all (and say so).
    if (!liveFirst) {
      // Name the REAL reason: "not scrapable" and "not authorized to spend" are different
      // facts, and a log that conflates them sends the next reader to the wrong platform gate.
      const why = !input.allowScrape
        ? "scrape not requested (explicit-only)"
        : `${input.platform} is not scrapable`;
      // A scrape would only help if we DIDN'T scrape purely because it wasn't requested — and the
      // platform can actually be scraped. "Not scrapable" is a dead end, not an offer; conflating
      // the two would dangle a button that could never do anything. This is the "Find new outliers"
      // capability signal, computed at the one place that knows both facts.
      const scrapeAvailable = !input.allowScrape && SCRAPABLE_PLATFORMS.has(input.platform);
      if (partial.length > 0) {
        console.info(
          `[grounding] ${why} — grounding on the ${partial.length} cached teardowns we do have`,
        );
        return finalize(partial, scrapeAvailable);
      }
      console.info(
        `[grounding] no cached teardowns for "${query}" on ${input.platform} and ${why} — degrading to ungrounded`,
      );
      return { ...none, scrapeAvailable };
    }

    /**
     * 3. Live ran FIRST and came back with nothing, so the cache is all this run has. `partial` is
     *    the read-back's own leftovers — fewer rows than `minRows`, but two proven sources beat
     *    none, and a broken upstream must not cost the user grounding the free path would have had.
     *
     *    `scrapeAvailable` is false on every branch here: the scrape it would offer is the one that
     *    just ran. Dangling the button would re-run the same failure on the user's tap.
     */
    if (partial.length > 0) {
      console.info(
        `[grounding] live scrape found nothing — grounding on the ${partial.length} cached teardowns we do have`,
      );
      return finalize(partial, false);
    }
    // Nothing anywhere. A FAILED scrape is a fact the user should hear (it is why the run is
    // ungrounded); an EMPTY one is the same outcome the free path would have produced, silently.
    if (liveFailure) throw liveFailure;
    console.info(`[grounding] live scrape and cache both empty for "${query}" — degrading to ungrounded`);
    return none;
  } catch (err) {
    input.warnings.push(
      `grounding failed (degraded to ungrounded): ${err instanceof Error ? err.message : String(err)}`,
    );
    return none;
  } finally {
    input.onStage?.(GROUNDING_STAGE_NAME, "done");
  }
}
