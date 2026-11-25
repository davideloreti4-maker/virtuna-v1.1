"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import type { CollectionPage } from "@/lib/discover-next/collections";

import { CollectionScreen } from "./collection-screen";

/**
 * One collection's page with its data (spec 3.4): the route reads the library on the server, finds
 * the collection by its slug and shelf, and hands in only that collection. Nothing here sends a
 * request; a read that failed is read again with `router.refresh()`.
 */
export interface CollectionNextProps {
  /** The collection, or null when the library holds none of that slug on that shelf (or could not be read: `failed`). */
  collection: CollectionPage | null;
  failed?: boolean;
}

export function CollectionNext({ collection, failed = false }: CollectionNextProps): React.JSX.Element {
  const router = useRouter();
  if (collection === null) {
    return failed ? <CollectionScreen state="failed" onRetry={() => router.refresh()} /> : <CollectionScreen state="gone" />;
  }
  return <CollectionScreen state="ready" collection={collection} />;
}

/** The route's loading file under the new look: the page's own outline, nothing sent. */
export function CollectionNextLoading(): React.JSX.Element {
  return <CollectionScreen state="loading" />;
}
