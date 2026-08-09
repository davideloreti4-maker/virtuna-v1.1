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
 * Card anatomy = mock §1/§2 (layout contract only — its content is fabricated):
 * a COMPACT row — full-bleed thumb column left (92px, cropped, view badge) · serif
 * adapted hook · meta foot (meter dots + count · Remix pill). The card's height is
 * the HOOK's height (min 118px), never the still's — the 2026-08-09 refinement:
 * rendering the whole 9:16 tile inflated every card into a slab whose hook floated
 * in a void, so nothing led. bg-charcoal-thread (#252524): the thread-card tone —
 * these are CONTENT cards, distinct from the darker chrome composer below them.
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
                className="h-[118px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]"
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
      <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-[5px] bg-black/55 px-1.5 py-0.5 font-mono text-micro font-medium text-foreground-secondary">
        <span aria-hidden="true">▶</span>
        {card.views}
      </span>
    </>
  );
  // Full-bleed thumb COLUMN (mock §1 `.thumb`): the card's own radius crops it — no
  // inner rounding, no inner border. The still is a crop, never a layout driver.
  const thumbClass = "relative block w-[92px] shrink-0 self-stretch overflow-hidden";

  return (
    <article
      data-testid={`drop-card-${card.contentId}`}
      aria-label={`Drop: ${card.hook.slice(0, 60)}`}
      className="flex min-h-[118px] overflow-hidden rounded-2xl border border-white/[0.06] bg-charcoal-thread transition-colors hover:border-white/[0.10]"
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

      <div className="flex min-w-0 flex-1 flex-col px-3.5 py-3">
        {/* The adapted hook — serif because it's content, not chrome (spec §8). It owns
            the card: everything under it is chrome and stays quiet. */}
        <p className="font-serif text-title leading-[1.34] tracking-[-0.005em] text-foreground">
          {card.hook}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-2.5">
          {/* The meter — the audience's REAL pre-run vote, ten cream dots (zero
              accent, locked) — and the door to the report. Tapping it READS the
              cached personas; it never fires a sim (SSOT §1). */}
          <button
            type="button"
            data-testid={`drop-meter-${card.contentId}`}
            aria-label={`${face.stop} of 10 stopped — open the report`}
            onClick={() => onOpenReport(card)}
            className="-ml-1 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring)]"
          >
            <span className="inline-flex items-center gap-[3px]" aria-hidden="true">
              {Array.from({ length: 10 }, (_, i) => (
                <i
                  key={i}
                  className={`h-[5px] w-[5px] rounded-full ${
                    i < face.stop ? "bg-foreground" : "bg-surface-elevated"
                  }`}
                />
              ))}
            </span>
            <b className="font-mono text-caption font-medium text-foreground">
              {face.stop}
              <span className="font-normal text-foreground-muted">/10</span>
            </b>
          </button>

          {/* The one action (spec §1) — a quiet pill; neutral cream text, never accent. */}
          <button
            type="button"
            disabled={remixing}
            aria-busy={remixing}
            onClick={() => onRemix(card)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.06] bg-surface-elevated px-3 py-1 text-label font-medium text-foreground transition-colors hover:border-white/[0.10] disabled:opacity-60"
          >
            Remix
          </button>
        </div>
      </div>
    </article>
  );
}
