"use client";

import * as React from "react";
import { useId, useState } from "react";
import Link from "next/link";

import { collectionHref } from "@/lib/discover-next/discover-view";
import { videosCount } from "@/lib/discover-next/discover-words";
import type { CollectionCard as CollectionCardData } from "@/lib/discover-next/hub-data";
import { cn } from "@/lib/utils";

/**
 * A collection as a card (spec 3.4; drawing frame 4): three covers (one tall at the left, two stacked
 * at the right), the collection's name as stored, and "15 videos". A link to the collection's page,
 * its shelf in the address (a slug is unique only within its shelf). Presentational.
 *
 * - Named by the collection's name and described by its count; the covers are pictures only, hidden
 *   from a screen reader.
 * - A cover that is missing, or does not load, is the neutral tile.
 */

export interface CollectionCardProps {
  collection: CollectionCardData;
}

/** One cover of the three, or the neutral tile when there is none or it did not load. */
function Cover({ src, className }: { src: string | undefined; className?: string }) {
  // The address that failed: another address tries again.
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span className={cn("relative block min-h-0 overflow-hidden bg-surface-sunken", className)}>
      {src && failed !== src ? (
        // eslint-disable-next-line @next/next/no-img-element -- a stored cover address (it can expire); next/image has nothing to optimise
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(src)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <span data-part="tile" className="absolute inset-0 bg-surface-sunken" />
      )}
    </span>
  );
}

export function CollectionCard({ collection }: CollectionCardProps): React.JSX.Element {
  const id = useId();
  const [first, second, third] = collection.covers;
  return (
    <Link
      href={collectionHref(collection)}
      prefetch={false}
      aria-label={collection.name}
      aria-describedby={`${id}-count`}
      className="flex h-full flex-col rounded-3xl bg-surface p-2 shadow-[var(--shadow-rest)] transition-[scale] duration-150 motion-safe:active:scale-[0.98]"
    >
      {/* Three covers, 2 apart: the card's own surface shows between them, as drawn. */}
      <span aria-hidden className="grid aspect-square grid-cols-[3fr_2fr] grid-rows-2 gap-0.5 overflow-hidden rounded-2xl">
        <Cover src={first} className="row-span-2" />
        <Cover src={second} />
        <Cover src={third} />
      </span>
      <span className="flex flex-col gap-0.5 px-1.5 pb-1 pt-2.5">
        <span className="line-clamp-2 break-words text-ui font-[640] leading-[1.25] text-foreground">{collection.name}</span>
        <span id={`${id}-count`} className="text-meta tabular-nums text-foreground-secondary">
          {videosCount(collection.count)}
        </span>
      </span>
    </Link>
  );
}
