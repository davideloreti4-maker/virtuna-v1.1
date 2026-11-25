import type { Intent } from "./types";

/** An action's bar, as a share of its track: the whole percent, and at least a stub of 4 for a near-zero one. */
export function barLength(value: number): number {
  return Math.max(4, Math.round(value));
}

/**
 * The action viewers are most likely to take: the one intent with the longest bar. Decided on the
 * bar as it is drawn, so two bars of one length are never told apart by the tag alone. None on a tie
 * for the longest (every value near zero included) and none without intents: the page names an
 * action only when one stands out.
 */
export function mostLikely(intents: readonly Intent[] | null): Intent["id"] | null {
  if (!intents) return null;
  const top = Math.max(...intents.map((intent) => barLength(intent.value)));
  const longest = intents.filter((intent) => barLength(intent.value) === top);
  return longest.length === 1 ? longest[0]!.id : null;
}
