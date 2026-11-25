"use client";

import * as React from "react";
import { useId } from "react";
import Link from "next/link";

import { ArrowGlyph } from "@/components/audience-next/audience-screen";
import { Figures } from "@/components/audience-next/figures";
import { usePushedTitle } from "@/components/result/use-pushed-title";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import type { CreatorPage } from "@/lib/discover-next/creator";
import { WATCHLIST_HREF, audienceFromHref } from "@/lib/discover-next/discover-view";
import { DISCOVER_STRINGS, audienceBuilt } from "@/lib/discover-next/discover-words";
import type { PulledVideo } from "@/lib/discover-next/pull";
import { pullInput } from "@/lib/discover-next/watchlist";
import { cn } from "@/lib/utils";

import { CreatorCard } from "./creator-card";
import { CreatorMenu } from "./creator-menu";
import { CHIP_LINK, PageNotice } from "./page-notice";
import { PulledCard } from "./pulled-card";
import { PushedHeader } from "./pushed-header";
import { VideoCardOutline } from "./video-card";
import { GRID } from "./videos-panel";

/**
 * A followed creator's page (spec 3.2 to 3.5; drawing frames 2 to 4): a pushed page titled by the handle.
 * Presentational: the container (`creator-next.tsx`) reads again, chooses their audience, arms the pull,
 * holds a video's sheet and removes.
 *
 *   phone, and a body under 760               a body of 760 or more (980 at most)
 *   ‹ @jay.makes               (shell)        ‹ @jay.makes                                   (···)
 *   (J) Jay Makes            (↻) (···)        (J) Jay Makes        (↻)    Their videos   Biggest jump
 *       @jay.makes · TikTok · read 13 Jul         @jay.makes · TikTok …   [card] [card] [card]
 *   Followers · Likes · Posts · Usual views   Followers · Likes · …       [card] [card] [card]
 *   [ Build their audience            → ]     [ Build their audience → ]
 *     Then simulate your video for …            Then simulate …
 *   [ Pull their best videos · 5 credits ]    [ Pull their best videos … ]
 *   Their videos              Biggest jump
 *   [card] [card]
 *
 * - The columns split by the page's body, not the window: the creator's column holds words and buttons, so
 *   it needs about 287 or more beside the videos, which a body of 760 gives (a tablet with the rail has
 *   less). Under that the page is one column, as on a phone, the creator's blocks as wide as the grid under
 *   them.
 * - On a phone the shell's pushed header is the title and its right corner is New chat, so More sits in
 *   the creator's card beside Read again; from 768 it is the page header's own action. One More shows at
 *   each width, by CSS: each stands on its own layer, which reads the width itself. That switch follows
 *   the header, which follows the window, not the columns.
 * - The figures: those known, in one row where the column gives the room (`Figures`).
 * - The main button: with no audience of theirs, a link to the new-audience page with the handle filled
 *   in; with one, the button that simulates for it, which waits while the choice is sent
 *   (`aria-disabled`, not `disabled`: it keeps the focus). The line under it describes it.
 * - Pull only for a handle Maven can read.
 * - Their videos are the last read's, in the order given (biggest jump first). Each card is a button
 *   opening its sheet, with the views alone at its foot: every card here is theirs. None read: one
 *   sentence where the grid would be, which sends them to Read again only when it can be pressed.
 * - A creator whose read failed with nothing kept: the card and one sentence, nothing else.
 * - Gone: the sentence and the way to the Watchlist. Failed: the sentence (an alert) and Try again.
 *   Loading: the outline. These name the page "Creator": the handle is not known there.
 */

const S = DISCOVER_STRINGS.creator;

export interface CreatorActions {
  /** A read is out: Read again turns and is busy, the line says "Reading…". */
  reading: boolean;
  onReadAgain(): void;
  /** Their audience is being chosen for new chats: the main button waits. */
  simulating: boolean;
  onSimulate(): void;
  onPull(): void;
  /** A card is pressed: open its sheet (`from` is the card, to come back to). */
  onOpen(video: PulledVideo, from: HTMLElement): void;
  /** Remove, confirmed in the menu. */
  onRemove(): void;
}

export type CreatorScreenProps =
  | { state: "loading" }
  | { state: "gone" }
  | { state: "failed"; onRetry(): void }
  | ({ state: "ready"; creator: CreatorPage } & CreatorActions);

/** The two wide buttons: full width, round (the Audience page's). The sides give the longest label
 *  ("Simulate a video for their viewers") the room to stay on one line on a narrow phone; where it still
 *  wraps, its lines are centred. */
const PILL = "w-full px-4 text-center next:rounded-full";

/** Pull: a white pill, the ground the creator's card and the figures' tiles stand on, not the secondary
 *  tint. Hovered, its shadow lifts, as Home's white cards do; pressed, it shrinks as every control does (the
 *  button's own). Its ground stays white through both: these replace the variant's grey ones. */
const WHITE_PILL = "next:bg-surface next:shadow-[var(--shadow-rest)] next:hover:bg-surface next:hover:shadow-[var(--shadow-lift)] next:active:bg-surface";

/** The page's two columns, by the body's width (the body is the container they ask): one column under 760,
 *  the creator's blocks first; from 760 the creator at the left (about 287 or more) and their videos at the
 *  right, in the video page's fractions and gaps. The outline stands in the same columns. */
const COLUMNS =
  "flex flex-col gap-4 @min-[760px]:grid @min-[760px]:grid-cols-[minmax(0,372fr)_minmax(0,588fr)] @min-[760px]:items-start @min-[760px]:gap-5";

/** The creator's column: a container of its own, so the figures go four in a row by its width, not the
 *  body's. In one column it is as wide as the grid under it, so the two edges line up. */
const CREATOR_COLUMN = "@container flex min-w-0 flex-col gap-3";

/** "Their videos" and its order word, and the box the grid stands in. The outline keeps both, so its grid
 *  starts where the cards will. */
const VIDEOS_HEAD = "flex min-h-11 items-center gap-3 px-1";
const GRID_BOX = "@container mt-1.5";

/** The cards' outlines while the page loads: as many as Discover's own outline draws. */
const OUTLINE_CARDS = 10;

function Page({ title, busy, trailing, children }: { title: string; busy?: boolean; trailing?: React.ReactNode; children: React.ReactNode }) {
  usePushedTitle(title);
  return (
    <div data-testid="creator-next" aria-busy={busy || undefined} className="flex min-h-full flex-col">
      <PushedHeader title={title} trailing={trailing} />
      <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+40px)] md:px-8 md:pb-12">
        {/* The body: 980 at most, centred, and the size container the columns split by. */}
        <div className="@container mx-auto w-full max-w-[980px] pt-3 md:pt-1">{children}</div>
      </div>
    </div>
  );
}

/** The one main step, and under it the line that says what it leads to. */
function MainAction({ creator, simulating, onSimulate }: { creator: CreatorPage; simulating: boolean; onSimulate(): void }) {
  const lineId = useId();
  const { audience } = creator;
  const line = audience ? (audience.builtOn ? audienceBuilt(audience.builtOn) : null) : S.buildLine;
  return (
    <div className="flex flex-col gap-1.5">
      {audience ? (
        <Button
          type="button"
          variant="primary"
          size="lg"
          aria-busy={simulating || undefined}
          aria-disabled={simulating || undefined}
          aria-describedby={line ? lineId : undefined}
          onClick={() => {
            if (!simulating) onSimulate();
          }}
          className={cn(PILL, "aria-busy:cursor-progress aria-busy:opacity-70")}
        >
          {S.simulate}
          <ArrowGlyph />
        </Button>
      ) : (
        <Button asChild variant="primary" size="lg" className={PILL}>
          <Link href={audienceFromHref(creator.handle)} prefetch={false} aria-describedby={lineId}>
            {S.build}
            <ArrowGlyph />
          </Link>
        </Button>
      )}
      {line && (
        <p id={lineId} className="px-2 text-center text-meta text-foreground-secondary">
          {line}
        </p>
      )}
    </div>
  );
}

function Videos({
  videos,
  canReadAgain,
  onOpen,
}: {
  videos: readonly PulledVideo[];
  /** Read again may be pressed: only then does the empty sentence send them to it. */
  canReadAgain: boolean;
  onOpen(video: PulledVideo, from: HTMLElement): void;
}) {
  const headingId = useId();
  const any = videos.length > 0;
  return (
    <section data-part="videos" aria-labelledby={headingId} className="min-w-0">
      {/* One size, as the pull page writes its own heading line: the heading at its weight, the order
          word regular and quiet. */}
      <div className={VIDEOS_HEAD}>
        <h2 id={headingId} className="text-ui font-[640] text-foreground">
          {S.videos}
        </h2>
        {any && <span className="ml-auto shrink-0 text-ui text-foreground-secondary">{S.order}</span>}
      </div>
      {any ? (
        <div className={GRID_BOX}>
          <ul aria-labelledby={headingId} className={GRID}>
            {videos.map((video) => (
              <li key={video.id}>
                <PulledCard video={video} onOpen={onOpen} foot="views" />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="px-1 py-6 text-ui text-foreground-secondary">{canReadAgain ? S.noVideos : S.noVideosToday}</p>
      )}
    </section>
  );
}

/**
 * The page's outline: where the card, the four figures, the two buttons and the grid will be, at their
 * sizes, so the page does not move when it lands. The tiles in the figures' own rule (two by two where the
 * column is under 360, four in a row from there) at a tile's height: 10 + 16 (the label's line) + 2 + 24
 * (the value's line) + 11 = 63. The buttons at the wide buttons' 50. The grid under a row the heading
 * row's height, in the grid's own box.
 */
function Outline() {
  return (
    <div className={COLUMNS}>
      <div aria-hidden className={CREATOR_COLUMN}>
        <div data-part="outline" className="h-[92px] rounded-[22px] bg-surface-sunken" />
        <div className="grid grid-cols-2 gap-2 @min-[360px]:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} data-part="outline" className="h-[63px] rounded-[18px] bg-surface-sunken" />
          ))}
        </div>
        <div data-part="outline" className="h-[50px] rounded-full bg-surface-sunken" />
        <div data-part="outline" className="h-[50px] rounded-full bg-surface-sunken" />
      </div>
      <div className="min-w-0">
        <div aria-hidden className={VIDEOS_HEAD} />
        <div className={GRID_BOX}>
          <ul aria-label={DISCOVER_STRINGS.tabs.videos} aria-busy="true" className={GRID}>
            {Array.from({ length: OUTLINE_CARDS }, (_, i) => (
              <li key={i} aria-hidden>
                <VideoCardOutline />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function CreatorScreen(props: CreatorScreenProps): React.JSX.Element {
  if (props.state === "loading") {
    return (
      <Page title={S.title} busy>
        <Outline />
      </Page>
    );
  }

  if (props.state === "gone") {
    return (
      <Page title={S.title}>
        <PageNotice line={S.gone}>
          <Link href={WATCHLIST_HREF} prefetch={false} className={CHIP_LINK}>
            {S.watchlist}
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

  const { creator, reading, onReadAgain, simulating, onSimulate, onPull, onOpen, onRemove } = props;
  const { handle } = creator;
  const removable = creator.removal !== null;

  return (
    <Page title={`@${handle}`} trailing={<CreatorMenu surface="ground" handle={handle} removable={removable} onRemove={onRemove} />}>
      <div className={COLUMNS}>
        <div data-part="creator" className={CREATOR_COLUMN}>
          <CreatorCard
            creator={creator}
            reading={reading}
            onReadAgain={onReadAgain}
            more={
              // The phone's More; the header has its own from 768. With nothing to offer the menu draws
              // nothing, and its empty place takes no room beside Read again.
              <div className="flex empty:hidden md:hidden">
                <CreatorMenu surface="card" handle={handle} removable={removable} onRemove={onRemove} />
              </div>
            }
          />
          {creator.held ? (
            <p className="px-1 text-ui text-foreground-secondary">{S.heldLine}</p>
          ) : (
            <>
              {creator.figures.length > 0 && <Figures figures={creator.figures} />}
              <MainAction creator={creator} simulating={simulating} onSimulate={onSimulate} />
              {pullInput(handle) !== null && (
                <Button type="button" variant="secondary" size="lg" onClick={onPull} className={cn(PILL, WHITE_PILL)}>
                  {S.pull}
                </Button>
              )}
            </>
          )}
        </div>
        {!creator.held && <Videos videos={creator.videos} canReadAgain={creator.canReadAgain} onOpen={onOpen} />}
      </div>
    </Page>
  );
}
