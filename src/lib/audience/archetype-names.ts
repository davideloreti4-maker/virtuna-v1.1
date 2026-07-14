/**
 * archetype-names.ts — what the 10 engine archetypes are CALLED in front of a user.
 *
 * ─── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 *
 * The archetype slug is the engine's BINDING KEY (F7 / #282) — `cross_niche_curiosity` is a
 * correct, load-bearing identifier and it must never change. But it is engineering vocabulary,
 * and until now the UI fell back to title-casing it, so a hook card announced itself as
 * **"FOR YOUR CROSS NICHE CURIOSITY"**. That is the machine's name for a person, shown to the
 * person's creator. Honest, and bad.
 *
 * This is the ONE place that translates. Two rules:
 *
 * 1. **THIS NEVER REACHES THE MODEL (F7).** The workspace tells users in as many words that a
 *    persona's display name stays out of the prompt. The engine binds on `archetype` and briefs
 *    the writer with `repaint`. A display name that leaked into a prompt would make the UI a liar
 *    — so this module is imported by presentation and by `select-hook-targets` (whose `label` is
 *    card-only), and by nothing that builds a prompt.
 *
 * 2. **A CREATOR-SET `label` ALWAYS WINS.** These are the fallback for the common case: a scraped
 *    audience carries repaints and shares but no `label`, because nobody has named its people yet.
 *    `persona-edit-form` can override any of them, and that override is what shows.
 *
 * ─── THE NAMES ────────────────────────────────────────────────────────────────
 *
 * Plain, concrete, and in the product's voice — they describe what the person DOES, not a
 * marketing segment. Deliberately not cute: a creator reading "your Passers-by scrolled past this"
 * should understand it instantly and never wonder what we mean.
 */

import { ARCHETYPES, type Archetype } from "@/lib/engine/wave3/persona-registry";

/**
 * Slug → the human name. Exhaustive over the 10 archetypes: `Record<Archetype, string>` means
 * adding an archetype to the engine WITHOUT naming it here is a TYPE ERROR, not a card that
 * silently regresses to shouting a slug. That is the whole point of typing it this way.
 */
export const ARCHETYPE_DISPLAY_NAME: Record<Archetype, string> = {
  high_engager: "Commenters",
  saver: "Savers",
  lurker: "Quiet Watchers",
  sharer: "Sharers",
  tough_crowd: "Tough Crowd",
  purposeful_viewer: "Purposeful Viewers",
  niche_deep_buyer: "Deep Fans",
  niche_deep_scout: "Scouts",
  loyalist: "Regulars",
  cross_niche_curiosity: "Passers-by",
};

const KNOWN = new Set<string>(ARCHETYPES);

/**
 * The user-facing name for an archetype slug.
 *
 * An UNKNOWN slug title-cases as before rather than throwing. Those rows exist: #282 found a prod
 * persona with 45% of its declared share on a slug outside the vocabulary, written before the
 * schema guarded the boundary. Such a persona cannot bind to an engine slot and is excluded from
 * hook targeting entirely — but it is still RENDERED in the audience workspace, and a display
 * helper is the wrong place to blow up over bad data someone needs to see in order to fix it.
 */
export function archetypeDisplayName(archetype: string): string {
  if (KNOWN.has(archetype)) return ARCHETYPE_DISPLAY_NAME[archetype as Archetype];
  return archetype.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
