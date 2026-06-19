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
 *  - The single lead `scrollQuote` is attached to the FIRST STOP persona (its real verbatim),
 *    or — when no persona stopped — to persona 0. Since personas are emitted stops-first, the
 *    lead is index 0 in both cases. Every other persona carries an EMPTY quote (we never invent
 *    words the SIM never returned — the drill-down simply shows no quote for them, honest about
 *    the thin signal).
 *  - `archetype` is a positional placeholder ("viewer_1…T") UNLESS the caller supplies a real
 *    `persona-registry` enum for the lead persona. It MUST NEVER be a human-facing display
 *    label (e.g. the hook card's "Stops the skeptic" tag): the persona-chat route validates
 *    `personaGrounding.archetype` against the `ARCHETYPES` registry enum and silently rejects
 *    any non-enum value — degrading the in-voice "Ask them why →" answer to generic open chat
 *    and 400-ing sub-thread rehydration (CR-01). When only placeholders exist the Lens gates
 *    the "Ask them why →" affordance off (no enum to ground on) rather than promising an
 *    in-voice answer it cannot deliver. The cluster lens still groups these nodes (all fyp
 *    slot) and the cascade/Population still reveal the real stop/scroll mix.
 *
 * Pure, no React. Returns [] when the fraction can't be parsed (the Lens then omits itself).
 */

import type { FlatPersonaReaction } from '@/components/board/audience/audience-derive';
import { ARCHETYPES, type Archetype } from '@/lib/engine/wave3/persona-registry';

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
 *
 * `leadArchetype` is an OPTIONAL registry archetype ENUM (e.g. "tough_crowd") for the lead
 * persona — it grounds the "Ask them why →" persona chat. It is attached to the lead persona
 * ONLY when it is a genuine `ARCHETYPES` enum value; a human-facing display label (such as the
 * hook card's "Stops the skeptic" tag) is NOT an enum and is rejected here, so it can never
 * leak into `personaGrounding.archetype` and silently break the chat route (CR-01). When no
 * valid enum is supplied, every persona stays a positional `viewer_N` placeholder and the Lens
 * gates the chat affordance off.
 */
export function cardScrollQuoteReactions(
  fraction: string,
  scrollQuote: string,
  leadArchetype?: string,
): FlatPersonaReaction[] {
  const parsed = parseFraction(fraction);
  if (!parsed) return [];
  const { stop, total } = parsed;

  // Only a genuine registry enum may ground the lead persona — never a display label.
  const groundable =
    typeof leadArchetype === 'string' && ARCHETYPES.includes(leadArchetype as Archetype)
      ? (leadArchetype as Archetype)
      : null;

  // WR-07: anchor the one real verbatim to the FIRST STOP persona when any persona stopped,
  // else to persona 0 (all-scroll). Personas are emitted stops-first (`i < stop` ⇒ stop), so
  // the first stop persona is index 0 — which is ALSO the all-scroll fallback. We name the
  // index explicitly so the code and the "first stop persona" honesty framing stay in lockstep
  // rather than relying on `i === 0` reading as the lead by coincidence of ordering. (If the
  // emit order ever stops being stops-first, recompute this as `out.findIndex(stop)`.) No
  // fabrication: only the real lead quote moves; every other persona stays quote-empty.
  const leadIndex = 0;

  const out: FlatPersonaReaction[] = [];
  for (let i = 0; i < total; i++) {
    const verdict: 'stop' | 'scroll' = i < stop ? 'stop' : 'scroll';
    // The lead persona carries the single real verbatim; everyone else carries an empty
    // quote — never an invented one. The lead also carries the groundable registry enum.
    const isLead = i === leadIndex;
    out.push({
      archetype: isLead && groundable ? groundable : `viewer_${i + 1}`,
      verdict,
      quote: isLead ? scrollQuote : '',
    });
  }
  return out;
}
