"use client";

import * as React from "react";
import { useId } from "react";

import { CoverFill } from "@/components/primitives/CoverFill";

/**
 * Remix carousel (owner 2026-11-26: "a remix video carousel above the composer on home as it used to
 * be on the old home"). The old Home's shelf (`app/home/v8/drop-shelf.tsx`) in the new look: the same
 * daily drops (proven videos, each with its hook adapted to the creator's niche), as one row that
 * scrolls sideways above the field.
 *
 * Presentational: the composer owns the warm (`useLazyWarm` over `/api/surfaces/drops`) and the
 * Remix handoff (it seeds a chat from the cached card, no model call, and opens it).
 *
 *   Proven videos, rebuilt for your niche
 *   [still · ▶ 1.2M] [still] [still] …       a 4:5 still, its views on it; a tap opens the original
 *    the adapted hook, two lines
 *    4.2× usual ·········· Remix              one foot line, so the row stays short over the field
 *
 * While the drops warm: four ghost cards in the same place, so nothing moves when they land. Warmed
 * and empty (or failed): nothing, and no space.
 */

/** One drop as the carousel draws it: what `LiveDropCard` carries that a card shows. */
export interface RemixDrop {
  contentId: string;
  hook: string;
  coverUrl: string;
  /** The original post; null: the still is not a link. */
  videoUrl: string | null;
  /** Its views in words ("1.2M"). */
  views: string;
  /** The source's outlier factor against its own usual views; absent on rows cached before it existed. */
  multiplier?: number;
}

/** Generic over the drop, so the caller gets its own card back from Remix (the composer's
 *  `LiveDropCard`) with no lookup. */
export interface RemixCarouselProps<T extends RemixDrop> {
  drops: T[];
  status: "warming" | "ready";
  onRemix(drop: T): void;
  /** The drop whose Remix is in flight: only its button waits. */
  remixingId?: string | null;
}

/** "3.4×" under 10, "17×" from 10 up (the corpus range is 3× to 50×), as the old shelf says it. */
export function multiplierWord(m: number): string {
  return m >= 10 ? `${Math.round(m)}×` : `${m.toFixed(1)}×`;
}

const CARD = "flex w-[128px] shrink-0 snap-start flex-col md:w-[152px]";
const STILL = "relative block aspect-[4/5] w-full overflow-hidden rounded-lg bg-surface-sunken";

export function RemixCarousel<T extends RemixDrop>({ drops, status, onRemix, remixingId = null }: RemixCarouselProps<T>): React.JSX.Element | null {
  const labelId = useId();
  if (status === "ready" && drops.length === 0) return null;
  const warming = status === "warming";

  return (
    <section data-part="remix-carousel" aria-labelledby={labelId} aria-busy={warming || undefined}>
      <h2 id={labelId} className="px-1 pb-2 text-meta font-[560] text-foreground-secondary">
        Proven videos, rebuilt for your niche
      </h2>
      {/* Edge to edge on a phone (the page's 16 taken back), so a card cut at the edge says "more
          this way"; inside the 720 column from md up. The 4 above and below keep the focus ring. */}
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 py-1 [scrollbar-width:none] md:mx-0 md:scroll-px-0 md:px-0">
        {warming
          ? Array.from({ length: 4 }, (_, i) => (
              <li key={i} data-part="remix-ghost" aria-hidden className={CARD}>
                <span className={`${STILL} motion-safe:animate-pulse`} />
                <span className="mt-2 h-3.5 w-11/12 rounded-sm bg-surface-sunken" />
                <span className="mt-1.5 h-3.5 w-3/5 rounded-sm bg-surface-sunken" />
                <span className="mt-2 h-7 w-full rounded-md bg-surface-sunken" />
              </li>
            ))
          : drops.map((drop) => (
              <li key={drop.contentId} className={CARD}>
                <DropCard drop={drop} onRemix={onRemix} remixing={remixingId === drop.contentId} />
              </li>
            ))}
      </ul>
    </section>
  );
}

function DropCard<T extends RemixDrop>({ drop, onRemix, remixing }: { drop: T; onRemix(drop: T): void; remixing: boolean }) {
  const still = (
    <>
      <CoverFill coverUrl={drop.coverUrl} playSize={16} />
      {/* Its real reach, on the still. The scrim under a light figure, as the field's video tile. */}
      <span className="absolute bottom-1.5 left-1.5 rounded-sm bg-scrim px-1.5 py-0.5 text-label font-[560] leading-4 tabular-nums text-action-foreground dark:text-foreground">
        <span aria-hidden>▶ </span>
        {drop.views}
      </span>
    </>
  );
  return (
    <>
      {drop.videoUrl ? (
        <a
          href={drop.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Watch the original: ${drop.views} views`}
          className={`${STILL} tap-44 transition-shadow duration-150 hover:shadow-[var(--shadow-lift)]`}
        >
          {still}
        </a>
      ) : (
        <span className={STILL}>{still}</span>
      )}
      {/* Two lines, always exactly as tall as two (2 × 18), so the cards' feet line up and no third
          line shows through. */}
      <p className="mt-2 line-clamp-2 h-9 px-0.5 text-meta font-[560] text-foreground">{drop.hook}</p>
      {/* One foot line: the receipt at the left (none on a row cached before it existed), Remix at
          the right. */}
      <div className="mt-1.5 flex items-center gap-1 pl-0.5">
        {typeof drop.multiplier === "number" && (
          <p data-part="remix-multiplier" className="min-w-0 truncate text-label text-foreground-secondary">
            <span className="font-[640] text-foreground">{multiplierWord(drop.multiplier)}</span> usual
          </p>
        )}
        <button
          type="button"
          aria-label={`Remix: ${drop.hook}`}
          aria-busy={remixing || undefined}
          disabled={remixing}
          onClick={() => onRemix(drop)}
          className="tap-44 ml-auto h-7 shrink-0 rounded-md bg-surface-sunken px-2.5 text-label font-[560] text-foreground transition-colors duration-150 hover:bg-active disabled:opacity-60"
        >
          {remixing ? "Opening…" : "Remix"}
        </button>
      </div>
    </>
  );
}
