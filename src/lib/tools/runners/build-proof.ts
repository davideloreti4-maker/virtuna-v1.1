/**
 * build-proof.ts — sourceIndex → RetrievedExample → on-card receipt (§11f, shared).
 *
 * Maps a model-emitted sourceIndex (1-based; 0 = "no specific source") back to the grounding
 * example it attributed, and freezes it into the card's receipt. Shared by every grounded
 * skill runner (hooks/ideas/script) so the attribution honesty rules cannot drift:
 * returns null when the output cited no source, cited out of range, or the matched example
 * lacks a handle — no receipt without a real, nameable, above-baseline source (honesty spine).
 * This is the visible payoff link: grounding shaped the words, this shows WHICH proven video
 * it drew from.
 */

import { MIN_OUTLIER_MULTIPLIER } from "@/lib/grounding/outlier-gate";
import type { RetrievedExample } from "@/lib/grounding/types";
import type { HookProof } from "@/lib/tools/blocks";

/**
 * The card may state a multiplier only when that multiplier is a CLAIM the source supports.
 *
 * The corpus admits hand-curated exemplars alongside measured outliers (owner call,
 * 2026-07-14). Curated rows may carry no score at all, or a score BELOW 1× — meaning the video
 * drew fewer views than the account has followers. Passing that straight through would print
 * "0.5× vs followers" inside a card whose entire job is to be the receipt, and the creator would
 * read a boast that refutes itself. Below the outlier bar we show the source and its views and
 * make no performance claim — the example still teaches, it just isn't evidence of reach.
 */
function provenMultiplier(m: number | null): number | null {
  return typeof m === "number" && Number.isFinite(m) && m >= MIN_OUTLIER_MULTIPLIER ? m : null;
}

export function buildProofFromSource(
  sourceIndex: number,
  examples: RetrievedExample[],
): HookProof | null {
  if (!Number.isInteger(sourceIndex) || sourceIndex < 1 || sourceIndex > examples.length) {
    return null;
  }
  const ex = examples[sourceIndex - 1];
  if (!ex || !ex.handle) return null; // no handle → nothing honest to attribute

  const multiplier = provenMultiplier(ex.multiplier);
  return {
    handle: ex.handle,
    videoUrl: ex.videoUrl,
    coverUrl: ex.coverUrl,
    hookTemplate: ex.hookTemplate,
    archetype: ex.hookArchetype,
    multiplier,
    views: ex.views,
    // A basis with no number to qualify is noise ("vs followers" alone says nothing) — and worse,
    // it implies a measurement the card is not showing. Drop it with the number it belonged to.
    baselineLabel: multiplier === null ? null : ex.baselineLabel,
    fitLabel: ex.fitLabel,
  };
}

/**
 * Coerce a model-emitted sourceIndex field to a clean non-negative integer; anything
 * missing/malformed → 0 (no source) so an ungrounded or sloppy response never fabricates
 * an attribution. Shared by the structured-output coercers of all grounded runners.
 */
export function coerceSourceIndex(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : 0;
}
