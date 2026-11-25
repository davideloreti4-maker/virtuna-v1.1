"use client";

import { CollectionScreen } from "@/components/discover-next/collection-screen";

import { DEV_COLLECTION } from "./collection-fixtures";

/**
 * A collection's page for /dev/discover (`page.tsx`): the real screen over a made-up collection
 * (`collection-fixtures.ts`). Nothing here sends anything; a card's link leads to a video page that
 * the made-up library does not hold.
 *
 * - collection: 26 videos, 24 shown, then Show more; two cards carry no badge (not proven)
 * - collection-gone: not in the library
 */

export type DevCollectionState = "collection" | "collection-gone";

export function DevCollection({ state }: { state: DevCollectionState }) {
  if (state === "collection-gone") return <CollectionScreen state="gone" />;
  return <CollectionScreen state="ready" collection={DEV_COLLECTION} />;
}
