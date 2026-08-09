/**
 * drop-adapt-input.ts — corpus teardown → AdaptInput (the drops pipe's adapt bridge).
 *
 * The corpus rows are pre-torn (madlib, skeleton, timed beats, belief↔reality tension),
 * NOT pre-decoded into the remix engine's 4-beat DecodeResult — so the drops pipe maps
 * the anatomy it honestly has onto AdaptInput's structural fields and states absence
 * plainly where a field has no source (mirrors decode's D-02 honest-absent rule).
 * Prompt inputs only: none of these strings ever render on a card.
 * Luck-free by construction: AdaptInput has no luck lane (D-01 stays compile-time).
 */
import type { SharedMatchRow } from "@/lib/grounding/corpus";
import { parseIdeaFacet, parseTeardownTemplate } from "@/lib/grounding/types";
import { hasHookStructure } from "@/lib/grounding/rank";
import type { AdaptInput, RepeatableItem } from "@/lib/engine/remix/decode-types";

/** Honest absent line (D-02 mirror) — never an empty string, never invented content. */
const absent = (what: string) => `The source teardown does not ${what}.`;

export function corpusRowToAdaptInput(row: SharedMatchRow, niche: string): AdaptInput | null {
  if (!hasHookStructure(row)) return null;
  const template = parseTeardownTemplate(row.template);
  const idea = parseIdeaFacet(row.idea);

  // hasHookStructure guarantees one of the two is non-blank.
  const hookPattern = row.hook_template?.trim() || row.spoken_hook?.trim() || "";

  const skeleton = template?.skeleton?.length ? template.skeleton.join(" → ") : null;
  const structure = skeleton
    ? template?.guidance?.trim()
      ? `${skeleton}. When this structure works: ${template.guidance.trim()}`
      : skeleton
    : absent("record the beat order");

  const turnBeat = template?.beats?.find((b) => /turn|twist|reveal|payoff|reject/i.test(b.name));
  const theTurn = turnBeat
    ? `${turnBeat.name}: ${turnBeat.description}`
    : absent("isolate a single turn moment");

  const emotionalBeat =
    idea?.belief && idea?.reality
      ? `Tension: the audience believes "${idea.belief}" — the reality is "${idea.reality}".`
      : absent("name the emotional arc");

  const repeatable: RepeatableItem[] = (template?.beats ?? [])
    .slice(0, 5)
    .map((b) => ({ label: b.name, why_repeatable: b.description }));
  if (repeatable.length === 0) {
    // Backstop: the madlib itself is the one structural move every admissible row carries.
    repeatable.push({
      label: hookPattern,
      why_repeatable: "the hook's reusable fill-in-the-blank skeleton",
    });
  }

  return {
    hook_pattern: hookPattern,
    structure,
    the_turn: theTurn,
    emotional_beat: emotionalBeat,
    repeatable,
    niche,
  };
}
