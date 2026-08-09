"use client";

/**
 * LaneReveal — "Three ways you could show up" (spec §4.3, mock §9 right frame).
 *
 * The reveal IS the shelf, grouped by lane. Card anatomy matches v8/drop-shelf.tsx —
 * thumb + real view count + serif adapted hook + the REAL ten-segment meter — with one
 * difference: the WHOLE CARD is the pick. Tapping it is simultaneously "I like this one"
 * and "this is who I am", so there is no separate action to compete with it.
 *
 * Locked: zero accent · donor niche and donor handle never render · no multiplier number ·
 * view count + sim score are the only numbers · type from the roles.
 */

import { CoverFill } from "@/components/primitives/CoverFill";
import { personasToCardFace } from "@/lib/surfaces/live-cards";
import type { LaneShelf } from "@/lib/surfaces/lane-drops";

/** Spelled counts read as voice; a digit here would read as chrome. */
const COUNT_WORD: Record<number, string> = { 1: "One", 2: "Two", 3: "Three" };

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
      <p className="mt-1 font-mono text-micro uppercase tracking-[0.12em] text-foreground-muted">
        pre-tested · pick the one that sounds like you
      </p>

      <div className="mt-5 flex flex-col gap-5">
        {shelves.map((shelf) => (
          <div key={shelf.lane.name}>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-body font-semibold text-foreground">{shelf.lane.name}</span>
              <span className="text-label text-foreground-muted">{shelf.lane.who}</span>
            </div>
            {shelf.cards.map((card) => {
              const face = personasToCardFace(card.personas);
              return (
                <button
                  key={card.contentId}
                  type="button"
                  data-testid={`lane-card-${card.contentId}`}
                  aria-label={`${shelf.lane.name}: ${card.hook} — ${face.stop} of 10 stopped`}
                  onClick={() => onPick(shelf)}
                  className="flex w-full gap-3 rounded-xl border border-white/[0.06] bg-surface-sunken p-2.5 text-left transition-colors hover:border-white/[0.10] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring)]"
                >
                  <span className="relative block aspect-[9/16] w-[62px] shrink-0 self-stretch overflow-hidden rounded-lg border border-white/[0.06]">
                    <CoverFill coverUrl={card.coverUrl} playSize={12} />
                    {/* The receipt's number: the source's REAL reach. No multiplier — locked. */}
                    <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-sm bg-black/55 px-1.5 py-0.5 text-micro font-medium text-foreground-secondary">
                      <span aria-hidden="true">▶</span>
                      {card.views}
                    </span>
                  </span>

                  <span className="flex min-w-0 flex-1 flex-col justify-between gap-2 py-1">
                    {/* The adapted hook — serif because it is content, not chrome. */}
                    <span className="font-serif text-body leading-snug text-foreground">
                      {card.hook}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-[3px]" aria-hidden="true">
                        {Array.from({ length: 10 }, (_, i) => (
                          <i
                            key={i}
                            className={`h-[3px] w-2 rounded-full ${
                              i < face.stop ? "bg-foreground-secondary" : "bg-white/[0.08]"
                            }`}
                          />
                        ))}
                      </span>
                      <b className="text-label font-semibold text-foreground-secondary">
                        {face.stop}
                        <span className="font-normal text-foreground-muted">/10</span>
                      </b>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
