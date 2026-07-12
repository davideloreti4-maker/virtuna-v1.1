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

import type { RetrievedExample } from "@/lib/grounding/types";
import type { HookProof } from "@/lib/tools/blocks";

export function buildProofFromSource(
  sourceIndex: number,
  examples: RetrievedExample[],
): HookProof | null {
  if (!Number.isInteger(sourceIndex) || sourceIndex < 1 || sourceIndex > examples.length) {
    return null;
  }
  const ex = examples[sourceIndex - 1];
  if (!ex || !ex.handle) return null; // no handle → nothing honest to attribute
  return {
    handle: ex.handle,
    videoUrl: ex.videoUrl,
    coverUrl: ex.coverUrl,
    hookTemplate: ex.hookTemplate,
    archetype: ex.hookArchetype,
    multiplier: ex.multiplier,
    views: ex.views,
    baselineLabel: ex.baselineLabel,
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
