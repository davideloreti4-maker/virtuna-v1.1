"use client";

import * as React from "react";
import { useId, useState } from "react";
import Link from "next/link";

import { badgeOf, cardMetaParts, cardName, lineOf, shownViews } from "@/lib/discover-next/card";
import { viewsWords } from "@/lib/discover-next/discover-words";
import type { CardVideo } from "@/lib/discover-next/hub-data";

import { COVER_LOOK, SHADE_BACKGROUND, SHADE_HEIGHT } from "./cover-look";
import { UpMark } from "./discover-icons";

/**
 * A proven video as a card (spec 3.2; drawing frame 1): the cover, 2 by 3, with at its top left the
 * multiple ("▲ 27×", "100×+" past 100) and at its foot the spoken line in two lines and
 * "@handle · 39.8M". A link to the video's page. Presentational.
 *
 * - Named by its line, else "Video by @handle", else "Video"; the badge and the meta are its
 *   description, so a screen reader hears the line first. The ▲ is drawn and hidden.
 * - A spoken line that is empty, a placeholder or holds a fill-in slot is not shown; a pulled video's
 *   caption is shown as written (`lineOf`).
 * - A cover that does not load, or none, is the neutral tile; the shade stays, so the words read.
 * - On a narrow card a long handle is cut, never the count beside it.
 * - On a creator's page every card is theirs: the foot says the views alone ("106K views"), no handle.
 * - The face (`VideoCardFace`) is the one a pulled video's card draws too (a button there: it has no
 *   page), so the two cannot drift.
 */

export interface VideoCardProps {
  video: CardVideo;
  href: string;
  /** Called as the link opens here (before the navigation): the hub keeps its return point. Not for
   *  a click that opens it elsewhere (a new tab or window). */
  onOpen?(video: CardVideo): void;
}

/** The card's box: 2 by 3, rounded, sunken under a cover still to load; pressed, a touch smaller. */
export const CARD_BOX =
  "relative block aspect-[2/3] overflow-hidden rounded-2xl bg-surface-sunken transition-[scale] duration-150 motion-safe:active:scale-[0.98]";

/**
 * A video's cover filling its box, or the neutral tile when there is none or it did not load (the box's
 * words stay readable on either). One for the cards, the video's page and a pulled video's sheet. `lazy`
 * for the cards of a grid; a page's own cover loads at once.
 */
export function CoverImage({ src, lazy = false }: { src: string | null; lazy?: boolean }): React.JSX.Element {
  // The address that failed: a new address (a re-render with another video) tries again.
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return <span data-part="tile" aria-hidden className="absolute inset-0 bg-surface-sunken" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a cover address (stored, or the platform's own; it can expire): next/image has nothing to optimise
    <img
      src={src}
      alt=""
      loading={lazy ? "lazy" : undefined}
      decoding="async"
      onError={() => setFailed(src)}
      className="absolute inset-0 size-full object-cover"
    />
  );
}

/**
 * What a card says at its foot: "@handle · 39.8M" (Discover's grids), or "106K views" alone (a creator's
 * page, whose cards are all theirs).
 */
export type CardFoot = "byline" | "views";

/** The ids of the parts that describe a card (its badge and its meta), for `aria-describedby`. */
export function cardDescribedBy(id: string, video: CardVideo, foot: CardFoot = "byline"): string | undefined {
  const { handle, views } = cardMetaParts(video);
  const meta = foot === "views" ? shownViews(video.views) !== null : Boolean(handle || views);
  return [badgeOf(video) ? `${id}-badge` : null, meta ? `${id}-meta` : null].filter(Boolean).join(" ") || undefined;
}

/**
 * What a card draws over its box: the cover (or the neutral tile), the shade, the multiple's badge, the
 * line and the meta. The byline is drawn in two parts: the handle gives way on a narrow card, and the count
 * beside it keeps its width. The views alone are one part, the count with its word.
 */
export function VideoCardFace({ video, id, foot = "byline" }: { video: CardVideo; id: string; foot?: CardFoot }): React.JSX.Element {
  const line = lineOf(video);
  const badge = badgeOf(video);
  const { handle, views } = cardMetaParts(video);
  const count = shownViews(video.views);
  return (
    <>
      <CoverImage src={video.coverUrl} lazy />
      <span aria-hidden className="absolute inset-x-0 bottom-0" style={{ height: SHADE_HEIGHT, background: SHADE_BACKGROUND }} />
      {badge && (
        <span
          id={`${id}-badge`}
          data-part="badge"
          className="absolute left-2 top-2 flex h-[26px] items-center gap-1 rounded-full pl-2 pr-2.5 text-meta font-[640] tabular-nums"
          style={{ background: COVER_LOOK.badge, color: COVER_LOOK.ink }}
        >
          <UpMark />
          {badge}
        </span>
      )}
      <span className="absolute inset-x-[11px] bottom-2.5 flex flex-col gap-[3px]" style={{ color: COVER_LOOK.ink }}>
        {line && <span className="line-clamp-2 text-reading font-[640] leading-[1.22]">{line}</span>}
        {foot === "views"
          ? count !== null && (
              <span className="flex min-w-0 text-label tabular-nums" style={{ color: COVER_LOOK.inkSoft }}>
                <span id={`${id}-meta`} data-part="views" className="shrink-0 whitespace-pre">
                  {viewsWords(count)}
                </span>
              </span>
            )
          : (handle || views) && (
              <span id={`${id}-meta`} className="flex min-w-0 text-label tabular-nums" style={{ color: COVER_LOOK.inkSoft }}>
                {handle && (
                  <span data-part="handle" className="min-w-0 truncate">
                    {handle}
                  </span>
                )}
                {views && (
                  <span data-part="views" className="shrink-0 whitespace-pre">
                    {handle ? ` · ${views}` : views}
                  </span>
                )}
              </span>
            )}
      </span>
    </>
  );
}

export function VideoCard({ video, href, onOpen }: VideoCardProps): React.JSX.Element {
  const id = useId();
  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={cardName(video)}
      aria-describedby={cardDescribedBy(id, video)}
      onClick={(e) => {
        // Cmd, Ctrl, Shift, Alt or a button other than the first: the browser opens the video elsewhere
        // and this page stays, so it leaves nothing to come back to.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        onOpen?.(video);
      }}
      className={CARD_BOX}
    >
      <VideoCardFace video={video} id={id} />
    </Link>
  );
}

/** A card's outline while the screen loads: the same box, sunken, nothing in it. */
export function VideoCardOutline(): React.JSX.Element {
  return <span data-part="outline" className="block aspect-[2/3] rounded-2xl bg-surface-sunken" />;
}
