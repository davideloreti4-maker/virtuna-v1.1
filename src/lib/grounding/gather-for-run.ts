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
 *  - ANY failure degrades to ungrounded — corpus stays undefined, examples stay [],
 *    a warning is pushed. Never fabricate a source, never block generation.
 */

import { gatherAndExtract } from "@/lib/grounding/orchestrator";
import { formatCorpusForPrompt } from "@/lib/grounding/prompt";
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

/**
 * Gather live outlier teardowns for a skill run (gated, degrade-safe).
 * Returns `{ corpus: undefined, examples: [] }` on any skip or failure — the caller's
 * generation path is byte-identical to ungrounded in that case.
 */
export async function gatherCorpusForRun(input: GatherCorpusInput): Promise<GatherCorpusResult> {
  const none: GatherCorpusResult = { corpus: undefined, examples: [] };
  if (!input.enabled || input.platform !== "tiktok") return none;

  const query = input.queryCandidates.find((q) => q && q.trim().length > 0)?.trim() ?? "";
  if (!query) return none;

  input.onStage?.(GROUNDING_STAGE_NAME, "active");
  try {
    const { examples } = await gatherAndExtract({
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
