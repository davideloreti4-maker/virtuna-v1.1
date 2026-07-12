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
 * Contract (mirrors the original hooks-runner inline block, byte-equivalent semantics):
 *  - Runs ONLY when the caller passes `enabled: true` AND platform === "tiktok"
 *    (the gather path is clockworks/TikTok; IG native is the documented fast-follow)
 *    AND a non-empty query resolves.
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
import { formatCorpusForPrompt } from "@/lib/grounding/prompt";
import { retrieveCachedExamples } from "@/lib/grounding/retrieve";
import type { RetrievedExample } from "@/lib/grounding/types";

/** The stage name shown on the thread loading spine while gathering (shared by all skills). */
export const GROUNDING_STAGE_NAME = "Finding proven outliers";

export interface GatherCorpusInput {
  /** Per-skill env gate, resolved by the caller (e.g. GROUNDING_HOOKS_ENABLED === "true"). */
  enabled: boolean;
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
  if (!input.enabled || input.platform !== "tiktok") return none;

  const query = input.queryCandidates.find((q) => q && q.trim().length > 0)?.trim() ?? "";
  if (!query) return none;

  const retrieve = deps.retrieve ?? retrieveCachedExamples;
  const gather = deps.gather ?? gatherAndExtract;

  input.onStage?.(GROUNDING_STAGE_NAME, "active");
  try {
    // 1. read-back: enough good cached teardowns → skip the scrape (instant + free).
    try {
      const cached = await retrieve({ query, platform: input.platform, niche: input.niche });
      if (cached.enough) {
        console.info(
          `[grounding] cache HIT for "${query}" — ${cached.examples.length} cached teardowns (≥${cached.stats.minRows}), scrape skipped`,
        );
        return { corpus: formatCorpusForPrompt(cached.examples), examples: cached.examples };
      }
      console.info(
        `[grounding] cache miss for "${query}" — ${cached.stats.good}/${cached.stats.minRows} good rows (${cached.stats.matched} matched), scraping live`,
      );
    } catch (err) {
      // Read-back is an optimization — its failure is NOT a grounding failure.
      console.warn(
        `[grounding] cache read-back failed (falling through to live scrape): ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // 2. live scrape + extract (write-through populates the cache for next time).
    const { examples } = await gather({
      query,
      platform: input.platform,
      niche: input.niche,
    });
    return { corpus: formatCorpusForPrompt(examples), examples };
  } catch (err) {
    input.warnings.push(
      `grounding failed (degraded to ungrounded): ${err instanceof Error ? err.message : String(err)}`,
    );
    return none;
  } finally {
    input.onStage?.(GROUNDING_STAGE_NAME, "done");
  }
}
