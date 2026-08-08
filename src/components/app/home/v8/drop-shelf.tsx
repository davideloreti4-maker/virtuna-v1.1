"use client";

/**
 * The v8 shelf (Phase 2) — six remix-first drop cards between the greeting and the
 * composer (spec §1). Presentational: the composer owns the warm (useLazyWarm) and
 * the Remix handoff. Face = real rehosted still + real views + adapted hook + the
 * REAL pre-run meter (personasToCardFace — the drops are the ONLY pre-scored
 * surface). ZERO accent (locked); donor niche/handle and multipliers never render
 * here. The meter is THE REPORT'S DOOR (Phase 3): it hands the card's CACHED
 * personas up and never re-sims — opening a drop's report costs nothing.
 *
 * Card anatomy = mock §2 (layout contract only — its content is fabricated):
 * thumb left (9:16, view-count badge) · serif adapted hook · meter · Remix.
 * bg-surface-sunken: the ONE in-thread card fill (skill-result-card.tsx) — the
 * mock's #252524 tone was superseded in code; the CSS convention wins.
 */

import { CoverFill } from "@/components/primitives/CoverFill";
import { personasToCardFace, type LiveDropCard } from "@/lib/surfaces/live-cards";

export interface DropShelfProps {
  cards: LiveDropCard[];
  status: "warming" | "ready";
  onRemix: (card: LiveDropCard) => void;
  /** contentId of the card whose Remix seed is in flight — disables its button only. */
  remixingId?: string | null;
  /** The meter's door — opens the verdict report on this card's CACHED personas.
   *  ⚠️ Reads the cache; never re-sims (fire-on-demand law, SSOT §1). */
  onOpenReport: (card: LiveDropCard) => void;
}

export function DropShelf({ cards, status, onRemix, remixingId, onOpenReport }: DropShelfProps) {
  // Honest empty: no cards and nothing warming → no shelf, no promise (the arrival
  // stays greeting-only, exactly the Phase-1 surface).
  if (status === "ready" && cards.length === 0) return null;

  return (
    <section data-testid="drop-shelf" aria-label="Today's drops" className="w-full pb-3">
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {status === "warming"
          ? Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                data-testid="drop-skeleton"
                className="h-[132px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03]"
              />
            ))
          : cards.map((card) => (
              <DropCard
                key={card.contentId}
                card={card}
                onRemix={onRemix}
                onOpenReport={onOpenReport}
                remixing={remixingId === card.contentId}
              />
            ))}
      </div>
    </section>
  );
}

function DropCard({
  card,
  onRemix,
  onOpenReport,
  remixing,
}: {
  card: LiveDropCard;
  onRemix: (card: LiveDropCard) => void;
  onOpenReport: (card: LiveDropCard) => void;
  remixing: boolean;
}) {
  const face = personasToCardFace(card.personas);

  const thumbInner = (
    <>
      <CoverFill coverUrl={card.coverUrl} playSize={14} />
      {/* The receipt's number: the source's REAL reach (the only number besides the
          sim score a drop may print — multiplier basis is an open owner call). */}
      <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-sm bg-black/55 px-1.5 py-0.5 text-micro font-medium text-foreground-secondary">
        <span aria-hidden="true">▶</span>
        {card.views}
      </span>
    </>
  );
  const thumbClass =
    "relative block aspect-[9/16] w-[104px] shrink-0 self-stretch overflow-hidden rounded-lg border border-white/[0.06]";

  return (
    <article
      data-testid={`drop-card-${card.contentId}`}
      aria-label={`Drop: ${card.hook.slice(0, 60)}`}
      className="flex gap-3 rounded-xl border border-white/[0.06] bg-surface-sunken p-2.5"
    >
      {/* Tap the thumb → the original (spec §1: the video is the proof). The donor's
          handle stays off the face — the link IS the attribution door. */}
      {card.videoUrl ? (
        <a
          href={card.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Watch the original"
          className={thumbClass}
        >
          {thumbInner}
        </a>
      ) : (
        <span className={thumbClass}>{thumbInner}</span>
      )}

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 py-1">
        {/* The adapted hook — serif because it's content, not chrome (spec §8). */}
        <p className="font-serif text-title leading-snug text-foreground">{card.hook}</p>

        <div className="flex items-center justify-between gap-2">
          {/* The meter — the audience's REAL pre-run vote, ten cream segments (zero
              accent, locked) — and the door to the report. Tapping it READS the
              cached personas; it never fires a sim (SSOT §1). */}
          <button
            type="button"
            data-testid={`drop-meter-${card.contentId}`}
            aria-label={`${face.stop} of 10 stopped — open the report`}
            onClick={() => onOpenReport(card)}
            className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring)]"
          >
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
          </button>

          {/* The one action (spec §1). Neutral cream — primary actions never accent. */}
          <button
            type="button"
            disabled={remixing}
            aria-busy={remixing}
            onClick={() => onRemix(card)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.06] bg-surface-elevated px-3 py-1.5 text-label text-foreground transition-colors hover:border-white/[0.10] disabled:opacity-60"
          >
            Remix
          </button>
        </div>
      </div>
    </article>
  );
}
