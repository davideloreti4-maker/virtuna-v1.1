"use client";

import * as React from "react";
import { useEffect, useId, useRef, useState } from "react";

import { Chip } from "@/components/ui/chip";
import type { CollectionCategory } from "@/lib/discover/corpus-reads";
import { SHELF_PREVIEW, type Shelf } from "@/lib/discover-next/collections";
import { DISCOVER_STRINGS, seeAll } from "@/lib/discover-next/discover-words";

import { CollectionCard } from "./collection-card";

/**
 * The Collections chip (spec 3.4; drawing frame 4): Maven's collections on their four shelves.
 * Presentational: the container (`discover-next.tsx`) puts the collections on their shelves and
 * narrows them by the search (`shelvesOf`).
 *
 * - A shelf: its name, and "See all 22" when it holds more than four; See all opens the shelf in place
 *   and goes, and the focus it held moves to the first card it brought. A grid of cards sized by its
 *   own width: two columns, four from 740.
 * - A search no name holds: one sentence in place of the shelves (the field's own cross clears it).
 * - The library could not be read: the sentence and Try again, nothing else.
 */

export interface CollectionsPanelProps {
  state: "ready" | "failed";
  /** The shelves to draw, in order, already narrowed by the search. */
  shelves: readonly Shelf[];
  /** A search is on: with no shelf left, the sentence says nothing matched. */
  searching: boolean;
  onRetry(): void;
}

/** A shelf's columns, by its own width. */
const SHELF_GRID = "grid grid-cols-2 gap-2.5 @min-[740px]:grid-cols-4 md:gap-3";

export function CollectionsPanel({ state, shelves, searching, onRetry }: CollectionsPanelProps): React.JSX.Element | null {
  const base = useId();
  const [open, setOpen] = useState<ReadonlySet<CollectionCategory>>(() => new Set());
  const lists = useRef(new Map<CollectionCategory, HTMLUListElement>());

  // See all goes as it opens its shelf, and the focus it held would drop to the page: from the keyboard
  // it moves to the first card the shelf brought (only when it did drop). A pointer tap leaves the focus
  // alone: Safari does not focus a tapped button, and a moved focus would ring a card nobody chose.
  const opened = useRef<CollectionCategory | null>(null);
  const openShelf = (category: CollectionCategory, fromKeyboard: boolean) => {
    opened.current = fromKeyboard ? category : null;
    setOpen((now) => new Set(now).add(category));
  };
  useEffect(() => {
    const category = opened.current;
    if (category === null) return;
    opened.current = null;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    lists.current.get(category)?.querySelectorAll<HTMLAnchorElement>(":scope > li > a")[SHELF_PREVIEW]?.focus();
  }, [open]);

  if (state === "failed") {
    return (
      <div role="alert" className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <p id={`${base}-failed`} className="text-ui text-foreground-secondary">
          {DISCOVER_STRINGS.videos.failed}
        </p>
        <Chip aria-describedby={`${base}-failed`} onClick={onRetry}>
          {DISCOVER_STRINGS.videos.tryAgain}
        </Chip>
      </div>
    );
  }

  if (shelves.length === 0) {
    if (!searching) return null;
    return (
      <div role="status" className="px-6 py-16 text-center">
        <p className="text-ui text-foreground-secondary">{DISCOVER_STRINGS.collections.noMatch}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      {shelves.map((shelf) => {
        const headingId = `${base}-${shelf.category}`;
        const whole = open.has(shelf.category) || shelf.cards.length <= SHELF_PREVIEW;
        const cards = whole ? shelf.cards : shelf.cards.slice(0, SHELF_PREVIEW);
        return (
          <div key={shelf.category} className="flex flex-col">
            <div className="flex min-h-11 items-center gap-3 px-1">
              <h2 id={headingId} className="min-w-0 text-ui font-[640] text-foreground">
                {shelf.name}
              </h2>
              {!whole && (
                <button
                  type="button"
                  aria-describedby={headingId}
                  // Enter or Space click a button with `detail` 0; a pointer's click counts its clicks.
                  onClick={(e) => openShelf(shelf.category, e.detail === 0)}
                  className="tap-44 -mr-1 ml-auto shrink-0 rounded-full px-2 text-ui font-[560] tabular-nums text-foreground-secondary transition-colors duration-150 hover:text-foreground"
                >
                  {seeAll(shelf.cards.length)}
                </button>
              )}
            </div>
            <div className="@container mt-1">
              <ul
                ref={(el) => {
                  if (el) lists.current.set(shelf.category, el);
                  else lists.current.delete(shelf.category);
                }}
                aria-labelledby={headingId}
                className={SHELF_GRID}
              >
                {cards.map((collection) => (
                  <li key={`${collection.category}/${collection.slug}`}>
                    <CollectionCard collection={collection} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}
    </div>
  );
}
