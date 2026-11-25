"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { usePushedTitle } from "@/components/result/use-pushed-title";
import { Chip } from "@/components/ui/chip";
import type { CollectionPage } from "@/lib/discover-next/collections";
import { DEFAULT_DISCOVER_VIEW, discoverHref, videoHref } from "@/lib/discover-next/discover-view";
import { DISCOVER_STRINGS, videosCount } from "@/lib/discover-next/discover-words";
import { PAGE_SIZE } from "@/lib/discover-next/grid";
import type { CardVideo } from "@/lib/discover-next/hub-data";

import { CHIP_LINK, PageNotice } from "./page-notice";
import { PushedHeader } from "./pushed-header";
import { VideoCard } from "./video-card";
import { GRID, VideosOutline } from "./videos-panel";

/**
 * One collection's page (spec 3.4): a pushed page titled by the collection's name as stored, its count,
 * and the hub's own video cards, 24 then Show more. Presentational: the container
 * (`collection-next.tsx`) hands in the collection the server found.
 *
 *   phone                                   desktop (a 980 column)
 *   ‹ Ranking/Rating/Tier List  (shell)     ‹ Ranking/Rating/Tier List
 *   15 videos                               15 videos
 *   [card] [card]                           [card] [card] [card] [card] [card]
 *
 * - On a phone the shell's pushed header is the title (`usePushedTitle`); from 768 the page's own
 *   header (`PushedHeader`), so one `<h1>` shows at each width.
 * - A collection holds videos whose multiple is not proof: their cards carry no badge (`badgeOf`).
 * - Show more goes once the last cards are in, and the focus it held moves to the first card it brought.
 * - Gone: the sentence and Back to Discover (to the Collections chip). Failed: the sentence and Try
 *   again. Loading: the outline. These name the page "Collection": the collection's own name is not
 *   known there.
 */

const S = DISCOVER_STRINGS.collections;

export type CollectionScreenProps =
  | { state: "loading" }
  | { state: "gone" }
  | { state: "failed"; onRetry(): void }
  | { state: "ready"; collection: CollectionPage };

/** Back to Discover from a collection that is gone: to the shelves. */
const COLLECTIONS_HREF = discoverHref({ ...DEFAULT_DISCOVER_VIEW, tab: "collections" });


function Page({ title, busy, children }: { title: string; busy?: boolean; children: React.ReactNode }) {
  usePushedTitle(title);
  return (
    <div data-testid="collection-next" aria-busy={busy || undefined} className="flex min-h-full flex-col">
      <PushedHeader title={title} />
      <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+40px)] md:px-8 md:pb-12">
        <div className="mx-auto flex w-full max-w-[980px] flex-col">{children}</div>
      </div>
    </div>
  );
}


/** The cards, 24 at a time. Keyed by the collection: another one starts again at 24. */
function Cards({ videos }: { videos: readonly CardVideo[] }) {
  const [shown, setShown] = useState(PAGE_SIZE);
  const listRef = useRef<HTMLUListElement>(null);
  const visible = videos.slice(0, shown);
  const hasMore = videos.length > shown;

  // Show more goes with the last cards, and the focus it held would drop to the page: it moves to the
  // first card that tap brought (only when it did drop).
  const firstNew = useRef<number | null>(null);
  const more = () => {
    firstNew.current = visible.length;
    setShown((n) => n + PAGE_SIZE);
  };
  useEffect(() => {
    const index = firstNew.current;
    if (index === null || hasMore) return;
    firstNew.current = null;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    listRef.current?.querySelectorAll<HTMLAnchorElement>(":scope > li > a")[index]?.focus();
  }, [hasMore, visible.length]);

  return (
    <>
      <div className="@container mt-1.5">
        <ul ref={listRef} aria-label={DISCOVER_STRINGS.tabs.videos} className={GRID}>
          {visible.map((video) => (
            <li key={video.id}>
              <VideoCard video={video} href={videoHref(video.id)} />
            </li>
          ))}
        </ul>
      </div>
      {hasMore && (
        <Chip onClick={more} className="mt-5 self-center">
          {DISCOVER_STRINGS.videos.showMore}
        </Chip>
      )}
    </>
  );
}

export function CollectionScreen(props: CollectionScreenProps): React.JSX.Element {
  if (props.state === "loading") {
    return (
      <Page title={S.title} busy>
        <VideosOutline />
      </Page>
    );
  }

  if (props.state === "gone") {
    return (
      <Page title={S.title}>
        <PageNotice line={S.gone}>
          <Link href={COLLECTIONS_HREF} prefetch={false} className={CHIP_LINK}>
            {S.back}
          </Link>
        </PageNotice>
      </Page>
    );
  }

  if (props.state === "failed") {
    return (
      <Page title={S.title}>
        <PageNotice line={S.failed} alert>
          <Chip onClick={props.onRetry}>{S.tryAgain}</Chip>
        </PageNotice>
      </Page>
    );
  }

  const { collection } = props;
  return (
    <Page title={collection.name}>
      <div className="flex min-h-11 items-center px-1">
        <p data-part="count" className="text-ui font-[640] tabular-nums text-foreground">
          {videosCount(collection.videos.length)}
        </p>
      </div>
      <Cards key={`${collection.category}/${collection.slug}`} videos={collection.videos} />
    </Page>
  );
}
