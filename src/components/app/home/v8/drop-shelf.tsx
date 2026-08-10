"use client";

/**
 * The v8 shelf — six remix-first drop cards between the greeting and the composer
 * (spec §1). Presentational: the composer owns the warm (useLazyWarm) and the Remix
 * handoff. Face = real rehosted still (tap → the original post) + real views + the
 * outlier RECEIPT ("N× their usual views" — owner ruling 2026-08-10, basis settled)
 * + the adapted serif hook. Drops arrive UNSCORED: no meter, no report door, no
 * personas — the sim is a completely separate surface (same ruling; the old
 * pre-scored-drops law and the card-meter-as-door pattern are both dead).
 * ZERO accent (locked); the donor's niche and handle never render here — the
 * thumb's link is the attribution door.
 *
 * Card anatomy: a COMPACT row — full-bleed thumb column left (96px, cropped, view
 * badge, hover "Watch" reveal) · serif adapted hook · quiet foot (receipt · Remix).
 * The card's height is the HOOK's height (min 122px), never the still's.
 * bg-charcoal-thread (#252524): CONTENT cards, distinct from the darker chrome
 * composer below them.
 */

import { CoverFill } from "@/components/primitives/CoverFill";
import type { LiveDropCard } from "@/lib/surfaces/live-cards";

/** "3.4×" under 10, "17×" from 10 up — the corpus range is 3×–50×. */
function fmtMult(m: number): string {
  return m >= 10 ? `${Math.round(m)}×` : `${m.toFixed(1)}×`;
}

export interface DropShelfProps {
  cards: LiveDropCard[];
  status: "warming" | "ready";
  onRemix: (card: LiveDropCard) => void;
  /** contentId of the card whose Remix seed is in flight — disables its button only. */
  remixingId?: string | null;
}

export function DropShelf({ cards, status, onRemix, remixingId }: DropShelfProps) {
  // Honest empty: no cards and nothing warming → no shelf, no promise (the arrival
  // stays greeting-only, exactly the Phase-1 surface).
  if (status === "ready" && cards.length === 0) return null;

  return (
    <section data-testid="drop-shelf" aria-label="Today's drops" className="w-full pb-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {status === "warming"
          ? Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                data-testid="drop-skeleton"
                className="h-[122px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]"
              />
            ))
          : cards.map((card) => (
              <DropCard
                key={card.contentId}
                card={card}
                onRemix={onRemix}
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
  remixing,
}: {
  card: LiveDropCard;
  onRemix: (card: LiveDropCard) => void;
  remixing: boolean;
}) {
  const thumbInner = (
    <>
      <CoverFill coverUrl={card.coverUrl} playSize={14} />
      {/* Real reach, on the still where it belongs. */}
      <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-[5px] bg-black/55 px-1.5 py-0.5 font-mono text-micro font-medium text-foreground-secondary">
        <span aria-hidden="true">▶</span>
        {card.views}
      </span>
      {/* The watch affordance, made explicit (owner 2026-08-10: nobody realized the
          still was tappable). Hover/focus reveal — matte scrim, no glow. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        <span className="rounded-full bg-black/60 px-2.5 py-1 font-mono text-micro font-medium uppercase tracking-[0.08em] text-foreground">
          Watch ↗
        </span>
      </span>
    </>
  );
  // Full-bleed thumb COLUMN: the card's own radius crops it — no inner rounding, no
  // inner border. The still is a crop, never a layout driver.
  const thumbClass =
    "group relative block w-[96px] shrink-0 self-stretch overflow-hidden focus-visible:outline-none";

  return (
    <article
      data-testid={`drop-card-${card.contentId}`}
      aria-label={`Drop: ${card.hook.slice(0, 60)}`}
      className="flex min-h-[122px] overflow-hidden rounded-2xl border border-white/[0.06] bg-charcoal-thread transition-colors hover:border-white/[0.10]"
    >
      {/* Tap the thumb → the original (the video is the proof). The donor's handle
          stays off the face — the link IS the attribution door. */}
      {card.videoUrl ? (
        <a
          href={card.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Watch the original video"
          className={thumbClass}
        >
          {thumbInner}
        </a>
      ) : (
        <span className={thumbClass}>{thumbInner}</span>
      )}

      <div className="flex min-w-0 flex-1 flex-col px-4 py-3">
        {/* The adapted hook — serif because it's content, not chrome (spec §8). It owns
            the card: everything under it is chrome and stays quiet. */}
        <p className="font-serif text-title leading-[1.34] tracking-[-0.005em] text-foreground">
          {card.hook}
        </p>

        <div className="mt-auto flex items-center justify-between gap-3 pt-2.5">
          {/* The receipt (owner ruling 2026-08-10): the source's real outlier factor,
              honest basis. Guarded — cards cached before the field existed carry none. */}
          {typeof card.multiplier === "number" ? (
            <span
              data-testid={`drop-mult-${card.contentId}`}
              className="inline-flex items-baseline gap-1 whitespace-nowrap text-caption"
            >
              <b className="font-mono font-medium text-foreground">↗ {fmtMult(card.multiplier)}</b>
              <span className="text-foreground-muted">their usual views</span>
            </span>
          ) : (
            <span aria-hidden="true" />
          )}

          {/* The one action (spec §1) — a quiet pill; neutral cream text, never accent. */}
          <button
            type="button"
            disabled={remixing}
            aria-busy={remixing}
            onClick={() => onRemix(card)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.08] bg-surface-elevated px-3.5 py-1.5 text-label font-medium text-foreground transition-colors hover:border-white/[0.14] hover:bg-white/[0.08] disabled:opacity-60"
          >
            {remixing ? "Remixing…" : "Remix"}
          </button>
        </div>
      </div>
    </article>
  );
}
