/**
 * flat-card-reactions — derive the Lens's flat Shape-B reactions from a text CARD's
 * aggregate signal (idea/hook/script/remix card-blocks), honestly.
 *
 * The four text card-blocks do NOT carry a per-persona `{archetype, verdict, quote}[]`
 * array (only the PersonasBlock / MultiAudienceReadBlock do). What a card DOES carry is
 * real engine output: a `fraction` (e.g. "6/10 stop") and ONE verbatim lead `scrollQuote`
 * (the representative reaction the SIM surfaced). We expand that into flat reactions for the
 * Lens WITHOUT fabricating per-persona quotes:
 *
 *  - The fraction's real N-of-T stop count drives T flat personas (N stop, T−N scroll) — these
 *    are the actual counts, not invented.
 *  - The single lead `scrollQuote` is attached to the FIRST stop persona (its real verbatim);
 *    every other persona carries an EMPTY quote (we never invent words the SIM never returned —
 *    the drill-down simply shows no quote for them, honest about the thin signal).
 *  - archetype labels are positional placeholders ("Viewer 1…T") since a card carries no
 *    per-persona archetype; the cluster lens still groups them (all fyp slot) and the
 *    cascade/Population still reveal the real stop/scroll mix.
 *
 * Pure, no React. Returns [] when the fraction can't be parsed (the Lens then omits itself).
 */

import type { FlatPersonaReaction } from '@/components/board/audience/audience-derive';

/** Parse "6/10 stop" → { stop: 6, total: 10 }. Returns null on any unexpected shape. */
function parseFraction(fraction: string): { stop: number; total: number } | null {
  const m = fraction.match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return null;
  const stop = Number(m[1]);
  const total = Number(m[2]);
  if (!Number.isFinite(stop) || !Number.isFinite(total) || total <= 0 || stop > total) {
    return null;
  }
  return { stop, total };
}

/**
 * Build flat reactions for a card from its real `fraction` + lead `scrollQuote`.
 * `archetypeHint` (e.g. the hook card's audienceArchetype) labels the lead persona when present.
 */
export function cardScrollQuoteReactions(
  fraction: string,
  scrollQuote: string,
  archetypeHint?: string,
): FlatPersonaReaction[] {
  const parsed = parseFraction(fraction);
  if (!parsed) return [];
  const { stop, total } = parsed;

  const out: FlatPersonaReaction[] = [];
  for (let i = 0; i < total; i++) {
    const verdict: 'stop' | 'scroll' = i < stop ? 'stop' : 'scroll';
    // Attach the one real verbatim to the first stop persona (or the first persona when no
    // stops); everyone else carries an empty quote — never an invented one.
    const isLead = i === 0;
    out.push({
      archetype: isLead && archetypeHint ? archetypeHint : `viewer_${i + 1}`,
      verdict,
      quote: isLead ? scrollQuote : '',
    });
  }
  return out;
}
