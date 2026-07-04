/**
 * readToCardReaction — the contract `Read` → `CardReaction` producer (Seam 1, the "Glance" tier).
 *
 * The third + final data-seam producer (docs/SURFACE-SEAM-SPEC.md §1 row 1). Where Seam 2
 * (`predictionResultToRead`) builds the full Read a card opens into, THIS derives the card FACE —
 * the inline verdict a feed tile / saved card / calendar slot shows at a glance — so the surfaces
 * render a real `CardReaction{cardId,tone,stop,lead}` instead of `mock-room.ts`'s hand-authored ones.
 *
 * Pure + deterministic, type-only imports — the card face and the Room it opens share ONE source,
 * so "7/10 would watch" on the tile matches the Room's header when it opens. A surface holding only
 * a `PredictionResult` composes the two producers: readToCardReaction(predictionResultToRead(data, id)).
 *
 * Honesty spine: `lead` is a REAL reaction verbatim (never fabricated) — '' when the card's reactions
 * carried no words. `tone` is the glance verdict, banded off the same threshold the Room uses.
 */

import type { CardReaction, Read, Reaction, Tone } from './types';

/**
 * The card-face verdict tone from the /10 `stop` headline — the SAME bands AmbientRoom's `meterTone`
 * uses (≥0.6 loved / ≤0.4 bounced), ported to the 0–10 scale so the glance dot agrees with the Room's
 * compare-row bars when the card opens.
 */
function toneFromStop(stop: number): Tone {
  if (stop >= 6) return 'loved';
  if (stop <= 4) return 'bounced';
  return 'neutral';
}

/**
 * One lead verbatim in a Person's voice. Prefer a voice whose verdict AGREES with the card tone (so
 * the dot + the quote read as one thing), else the first real verbatim, else '' — a card whose
 * reactions carried no words shows no fabricated lead (honesty spine).
 */
function pickLead(reactions: Reaction[], tone: Tone): string {
  const agree = reactions.find((r) => r.tone === tone && r.verdict.trim().length > 0);
  if (agree) return agree.verdict;
  const any = reactions.find((r) => r.verdict.trim().length > 0);
  return any?.verdict ?? '';
}

/**
 * Derive the glance-tier `CardReaction` (the card face) from a full `Read`. Total (never throws):
 * a Read with no reactions yields an empty `lead`, and `tone` always resolves from `stop`.
 */
export function readToCardReaction(read: Read): CardReaction {
  const tone = toneFromStop(read.stop);
  return {
    cardId: read.contentId,
    tone,
    stop: read.stop,
    lead: pickLead(read.reactions, tone),
  };
}
