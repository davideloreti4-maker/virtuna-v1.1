"use client";

import * as React from "react";
import { useEffect, useId, useRef } from "react";

import { Chip } from "@/components/ui/chip";
import { videoHref } from "@/lib/discover-next/discover-view";
import { DISCOVER_STRINGS } from "@/lib/discover-next/discover-words";
import type { CardVideo } from "@/lib/discover-next/hub-data";

import { VideoCard, VideoCardOutline } from "./video-card";

/**
 * The Videos chip (spec 3.2; drawing frame 1, the desktop's left half): the line, the grid, Show more.
 * Presentational: the container (`discover-next.tsx`) works out the grid, the line and the empty
 * sentence from the address and the field, and keeps how many cards are shown.
 *
 * - The line: "372 proven videos", or with a filter on its names ("Comedy · TikTok · 40 videos") and
 *   Clear. On a phone the order's word at its right (on a desk the order is a menu beside Filter).
 * - The grid sizes itself by its own width, not the window's (the sidebar takes a varying share): two
 *   columns, three from 560, four from 740, five from 920 (five at full width beside the sidebar).
 * - Nothing matches the search: one sentence and Clear in place of the grid.
 * - The library could not be read: the sentence and Try again, nothing else.
 * - `offer`: a row above the grid (the pull offer, when the search asks for what the library lacks).
 */

export interface VideosPanelProps {
  state: "ready" | "failed";
  /** The whole grid, in its order. */
  videos: readonly CardVideo[];
  /** How many of them are shown. */
  shown: number;
  onMore(): void;
  /** "372 proven videos", "Comedy · 85 videos"; null leaves the line out. */
  countLine: string | null;
  /** A filter is on: the line carries Clear. */
  filtered: boolean;
  onClearFilter(): void;
  /** The order in words, at the line's right on a phone. */
  orderWord: string;
  /** No card to show: the sentence said in place of the grid, with Clear (the search). Null: none. */
  empty: string | null;
  onClearSearch(): void;
  onRetry(): void;
  /** A card opens. */
  onOpen(video: CardVideo): void;
  /** Above the grid. */
  offer?: React.ReactNode;
}

/** The grid's columns, by its own width. */
export const GRID = "grid grid-cols-2 gap-2.5 @min-[560px]:grid-cols-3 @min-[740px]:grid-cols-4 @min-[920px]:grid-cols-5 md:gap-3";

/** Ten outlines while the screen loads (two rows at full width). */
const OUTLINES = 10;

/** A sentence in place of the grid, and at most one control (described by the sentence: it can be
 *  told from another control of the same name). A status, or for the failure an alert. A long word (a
 *  handle) breaks inside the column rather than run off a phone. */
function Notice({ line, alert, control }: { line: string; alert?: boolean; control: (describedBy: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div role={alert ? "alert" : "status"} className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <p id={id} className="max-w-full break-words text-ui text-foreground-secondary">
        {line}
      </p>
      {control(id)}
    </div>
  );
}

/** The grid's outline while the screen loads: busy, no count. */
export function VideosOutline(): React.JSX.Element {
  return (
    <div className="@container mt-4">
      <ul aria-label={DISCOVER_STRINGS.tabs.videos} aria-busy="true" className={GRID}>
        {Array.from({ length: OUTLINES }, (_, i) => (
          <li key={i} aria-hidden>
            <VideoCardOutline />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VideosPanel({
  state,
  videos,
  shown,
  onMore,
  countLine,
  filtered,
  onClearFilter,
  orderWord,
  empty,
  onClearSearch,
  onRetry,
  onOpen,
  offer,
}: VideosPanelProps): React.JSX.Element {
  const lineId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const visible = videos.slice(0, shown);
  const hasMore = videos.length > shown;

  // "Show more" goes once the last cards are in, and the focus it held would drop to the page: it
  // moves to the first card that tap brought. Forgotten once the cards fall back to where the tap
  // found them (another view starts again at one page), so a later change never moves the focus.
  const firstNew = useRef<number | null>(null);
  const more = () => {
    firstNew.current = visible.length;
    onMore();
  };
  useEffect(() => {
    const index = firstNew.current;
    if (index === null) return;
    if (visible.length <= index) {
      firstNew.current = null;
      return;
    }
    if (hasMore) return;
    firstNew.current = null;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    listRef.current?.querySelectorAll<HTMLAnchorElement>(":scope > li > a")[index]?.focus();
  }, [hasMore, visible.length]);

  if (state === "failed") {
    return (
      <Notice
        line={DISCOVER_STRINGS.videos.failed}
        alert
        control={(describedBy) => (
          <Chip aria-describedby={describedBy} onClick={onRetry}>
            {DISCOVER_STRINGS.videos.tryAgain}
          </Chip>
        )}
      />
    );
  }

  return (
    <div className="flex flex-col">
      {offer}
      {countLine !== null && (
        // The line wraps rather than cut its count: at 320, with the longest filter names, Clear and the
        // order word beside it, the number is the part a cut would lose. The row keeps its first line level.
        <div className="flex min-h-11 items-start gap-3 px-1 pt-3 md:pt-3.5">
          <p id={lineId} data-part="count" className="min-w-0 break-words text-ui font-[640] text-foreground tabular-nums">
            {countLine}
          </p>
          {filtered && (
            <button
              type="button"
              aria-describedby={lineId}
              onClick={onClearFilter}
              className="tap-44 -ml-1 shrink-0 rounded-full px-2 text-ui font-[560] text-foreground-secondary underline-offset-2 transition-colors duration-150 hover:text-foreground hover:underline"
            >
              {DISCOVER_STRINGS.videos.clear}
            </button>
          )}
          <span data-part="order-word" className="ml-auto shrink-0 text-ui text-foreground-secondary md:hidden">
            {orderWord}
          </span>
        </div>
      )}
      {empty !== null ? (
        <Notice
          line={empty}
          control={(describedBy) => (
            <Chip aria-describedby={describedBy} onClick={onClearSearch}>
              {DISCOVER_STRINGS.videos.clear}
            </Chip>
          )}
        />
      ) : (
        visible.length > 0 && (
          <div className="@container mt-1.5">
            <ul ref={listRef} aria-label={DISCOVER_STRINGS.tabs.videos} className={GRID}>
              {visible.map((video) => (
                <li key={video.id}>
                  <VideoCard video={video} href={videoHref(video.id)} onOpen={onOpen} />
                </li>
              ))}
            </ul>
          </div>
        )
      )}
      {empty === null && hasMore && (
        <Chip onClick={more} className="mt-5 self-center">
          {DISCOVER_STRINGS.videos.showMore}
        </Chip>
      )}
    </div>
  );
}
