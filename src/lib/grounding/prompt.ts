/**
 * grounding/prompt.ts — render RetrievedExample[] into the corpus grounding block
 * that feeds assembler.corpus (§11f).
 *
 * Productizes the spike's groundingBlock: it instructs the model to TRANSLATE the
 * proven structure into the creator's own voice — NOT reuse the source's words (the
 * over-copy fix, spike v2) — and carries each example's receipt so the honesty spine
 * holds (every claimed structure is tied to a real, above-baseline outlier).
 *
 * Pure string builder — no network, no LLM. Unit-tested.
 */

import type { RetrievedExample } from "./types";

function fmtViews(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "?";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function fmtMultiplier(m: number | null): string {
  if (m === null || !Number.isFinite(m)) return "";
  return m >= 100 ? `${Math.round(m)}×` : `${m.toFixed(1)}×`;
}

/** The single-line structural signal the model adapts (skeleton > template name > spoken hook). */
function structureLine(ex: RetrievedExample): string {
  if (ex.template?.skeleton && ex.template.skeleton.length > 0) {
    return ex.template.skeleton.join(" → ");
  }
  if (ex.template?.name) return ex.template.name;
  if (ex.spokenHook) return ex.spokenHook;
  return "(structure)";
}

/** The receipt suffix — @handle · mult× basis · views. Omits parts we don't have (honest). */
function receipt(ex: RetrievedExample): string {
  const parts: string[] = [];
  if (ex.handle) parts.push(`@${ex.handle}`);
  const mult = fmtMultiplier(ex.multiplier);
  if (mult) parts.push(`${mult}${ex.baselineLabel ? ` ${ex.baselineLabel}` : ""}`);
  parts.push(`${fmtViews(ex.views)} views`);
  return parts.join(" · ");
}

const HEADER =
  "GROUNDING — real proven outlier hooks pulled LIVE for this topic. Each went far above " +
  "its account's own baseline. ADAPT each proven STRUCTURE into THIS creator's voice and " +
  "angle — do NOT reuse the source's specific words or examples; translate the mechanism, " +
  "keep it unmistakably the creator's. Tag each hook with the sourceIndex (1-N) it adapts, or 0 if none.";

/**
 * Render the grounding block. Returns undefined for an empty list (→ assembler.corpus
 * stays undefined → byte-identical no-op). Order is preserved (retrieval already ranked).
 */
export function formatCorpusForPrompt(examples: RetrievedExample[]): string | undefined {
  if (examples.length === 0) return undefined;
  const lines = examples.map((ex, i) => {
    const archetype = ex.hookArchetype ? `[${ex.hookArchetype}] ` : "";
    const why = ex.whyItWorks ? ` Why: ${ex.whyItWorks}` : "";
    return `${i + 1}. ${archetype}${structureLine(ex)} — proven by ${receipt(ex)}.${why}`;
  });
  return `${HEADER}\n\n${lines.join("\n")}`;
}
