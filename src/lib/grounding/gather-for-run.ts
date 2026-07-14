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
 *  - Read-back FIRST (gather-once/walk-many): the teardown cache is consulted before
 *    any scrape; enough good cached rows → the scrape is skipped entirely. A cache
 *    miss OR read-back failure falls through to the live scrape (which write-through
 *    populates the cache). Only when the scrape path ALSO fails does the run degrade
 *    to ungrounded — corpus stays undefined, examples stay [], a warning is pushed.
 *    Never fabricate a source, never block generation.
 */

import { gatherAndExtract } from "@/lib/grounding/orchestrator";
import { buildCorpusBlock, type GroundingSkill } from "@/lib/grounding/prompt";
import { retrieveCachedExamples } from "@/lib/grounding/retrieve";
import type { RetrievedExample } from "@/lib/grounding/types";

/** The stage name shown on the thread loading spine while gathering (shared by all skills). */
export const GROUNDING_STAGE_NAME = "Finding proven outliers";

export interface GatherCorpusInput {
  /** Per-skill env gate, resolved by the caller (e.g. GROUNDING_HOOKS_ENABLED === "true"). */
  enabled: boolean;
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
  /** Runner warning sink — degrade reasons land here (surfaced via the SSE warning event). */
  warnings: string[];
}

/** Platforms whose teardowns live in the corpus and can be retrieved. */
const READABLE_PLATFORMS = new Set(["tiktok", "instagram", "youtube"]);

/** The live scrape+extract path is Apify/clockworks — TikTok only. IG native is the fast-follow. */
const SCRAPABLE_PLATFORMS = new Set(["tiktok"]);

export interface GatherCorpusResult {
  /** Formatted grounding block for AssemblerInput.corpus — undefined on skip/degrade. */
  corpus: string | undefined;
  /** The retrieved examples backing `corpus` — [] on skip/degrade (no receipt without a source). */
  examples: RetrievedExample[];
}

/** Injectable pipeline fns (tests swap these; prod uses the real modules). */
export interface GatherCorpusDeps {
  retrieve?: typeof retrieveCachedExamples;
  gather?: typeof gatherAndExtract;
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
  const none: GatherCorpusResult = { corpus: undefined, examples: [] };
  if (!input.enabled || !READABLE_PLATFORMS.has(input.platform)) return none;

  const query = input.queryCandidates.find((q) => q && q.trim().length > 0)?.trim() ?? "";
  if (!query) return none;

  const retrieve = deps.retrieve ?? retrieveCachedExamples;
  const gather = deps.gather ?? gatherAndExtract;

  input.onStage?.(GROUNDING_STAGE_NAME, "active");
  try {
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
        const { corpus, used } = buildCorpusBlock(cached.examples, input.skill);
        return { corpus, examples: used };
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
    //    Only where we can actually scrape. `minRows` decides whether the scrape is WORTH
    //    skipping — it is not a quality bar, and on a platform we cannot scrape there is no
    //    scrape to skip. Throwing away 2 real proven outliers to run ungrounded, because a
    //    threshold designed to save an Apify call said "only 2", would be self-defeating:
    //    two proven sources beat none. Use what we found; degrade to raw only when we found
    //    nothing at all (and say so).
    if (!SCRAPABLE_PLATFORMS.has(input.platform)) {
      if (partial.length > 0) {
        console.info(
          `[grounding] ${input.platform} is not scrapable — grounding on the ${partial.length} cached teardowns we do have`,
        );
        const { corpus, used } = buildCorpusBlock(partial, input.skill);
        return { corpus, examples: used };
      }
      console.info(
        `[grounding] no cached teardowns for "${query}" on ${input.platform} and no scraper for it — degrading to ungrounded`,
      );
      return none;
    }

    const { examples } = await gather({
      query,
      platform: input.platform,
      niche: input.niche,
    });
    const { corpus, used } = buildCorpusBlock(examples, input.skill);
    return { corpus, examples: used };
  } catch (err) {
    input.warnings.push(
      `grounding failed (degraded to ungrounded): ${err instanceof Error ? err.message : String(err)}`,
    );
    return none;
  } finally {
    input.onStage?.(GROUNDING_STAGE_NAME, "done");
  }
}
