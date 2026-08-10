"use client";

/**
 * LaneReveal — "Three ways you could show up" (spec §4.3, mock §9 right frame).
 *
 * The reveal IS the shelf, grouped by lane. Card anatomy matches v8/drop-shelf.tsx —
 * the compact row: full-bleed thumb column + real view count + adapted hook + the
 * outlier receipt in the foot — with one difference: the WHOLE CARD is the pick. Tapping
 * it is simultaneously "I like this one" and "this is who I am", so there is no separate
 * action to compete with it (hence no Remix button where the shelf has one).
 *
 * ── 2026-08-12: the pre-score meter is GONE (owner ruling) ────────────────────────────
 * The foot used to carry a ten-dot meter fed by a Flash sim against GENERAL_AUDIENCE — a
 * day-zero creator has no calibrated audience, that is the premise of this whole flow. So
 * the first number the product ever showed a creator LOOKED personal and wasn't, on the
 * exact screen that teaches what your numbers mean. The receipt replaces it: "N× their
 * usual views" is a fact about the VIDEO, true without an audience, and it is the number
 * the shipped shelf card already carries. The sim went with it (see lane-drops.ts).
 *
 * That pass also brought this card back in line with three rulings the shelf card took on
 * 2026-08-11 and this one never got: cards are radius 12 (`rounded-lg`), the hook sets in
 * Inter on the `title` role (serif is voice-moments only — a display face on stacked
 * chrome rows is what read as "AI-made"), and mono is dense meta, not a card's numbers.
 *
 * Locked: zero accent · donor niche and donor handle never render · type from the roles.
 */

import { CoverFill } from "@/components/primitives/CoverFill";
import type { LaneShelf } from "@/lib/surfaces/lane-drops";

/** Spelled counts read as voice; a digit here would read as chrome. */
const COUNT_WORD: Record<number, string> = { 1: "One", 2: "Two", 3: "Three" };

/** "3.4×" under 10, "17×" from 10 up — same print as the shelf card's receipt. */
function fmtMult(m: number): string {
  return m >= 10 ? `${Math.round(m)}×` : `${m.toFixed(1)}×`;
}

export function LaneReveal({
  shelves,
  onPick,
}: {
  shelves: LaneShelf[];
  onPick: (shelf: LaneShelf) => void;
}) {
  // Honest empty: no lanes, no promise of any. The caller owns the error copy.
  if (shelves.length === 0) return null;

  return (
    <section data-testid="lane-reveal" className="w-full">
      <h2 className="font-serif text-subhead leading-snug text-foreground">
        {COUNT_WORD[shelves.length] ?? "Some"} ways you could show up.
      </h2>
      {/* NOT "pre-tested" any more. That word was earned by the Flash pre-score; with the
          meter gone it would claim a test that never ran — the exact dishonesty the ruling
          removed. What IS true is the source: every card is a real proven video, adapted. */}
      <p className="mt-1 font-mono text-micro uppercase tracking-[0.12em] text-foreground-muted">
        proven videos · pick the one that sounds like you
      </p>

      <div className="mt-5 flex flex-col gap-5">
        {shelves.map((shelf) => (
          <div key={shelf.lane.name}>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-body font-semibold text-foreground">{shelf.lane.name}</span>
              <span className="text-label text-foreground-muted">{shelf.lane.who}</span>
            </div>
            {shelf.cards.map((card) => (
              <button
                key={card.contentId}
                type="button"
                data-testid={`lane-card-${card.contentId}`}
                aria-label={`Pick ${shelf.lane.name} — ${card.hook}`}
                onClick={() => onPick(shelf)}
                className="flex min-h-[96px] w-full overflow-hidden rounded-lg border border-white/[0.06] bg-charcoal-thread text-left transition-colors hover:border-white/[0.10] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring)]"
              >
                {/* Full-bleed thumb column (drop-shelf anatomy): the card's radius crops it;
                    the still is a crop, never the card's layout driver. */}
                <span className="relative block w-[72px] shrink-0 self-stretch overflow-hidden">
                  <CoverFill coverUrl={card.coverUrl} playSize={12} />
                  {/* The source's REAL reach, on the still where it belongs. */}
                  <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-[4px] bg-black/60 px-1.5 py-0.5 text-micro font-medium text-foreground-secondary">
                    <span aria-hidden="true">▶</span>
                    {card.views}
                  </span>
                </span>

                <span className="flex min-w-0 flex-1 flex-col px-3 py-2.5">
                  {/* The adapted hook, on the `title` role — it owns the card. */}
                  <span className="text-title font-medium text-foreground">{card.hook}</span>
                  {/* The receipt: the source's real outlier factor, honest basis. Guarded —
                      `isDropReady` makes it present in practice, but the field is optional
                      on the shared card type, and a missing number is never invented. */}
                  {typeof card.multiplier === "number" ? (
                    <span
                      data-testid={`lane-mult-${card.contentId}`}
                      className="mt-auto inline-flex items-baseline gap-1 whitespace-nowrap pt-2 text-caption"
                    >
                      <b className="font-medium text-foreground-secondary">
                        {fmtMult(card.multiplier)}
                      </b>
                      <span className="text-foreground-muted">their usual views</span>
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
