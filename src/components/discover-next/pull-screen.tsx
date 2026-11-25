"use client";

import * as React from "react";
import { useEffect, useId, useRef } from "react";

import { usePushedTitle } from "@/components/result/use-pushed-title";
import { Chip } from "@/components/ui/chip";
import { cardName } from "@/lib/discover-next/card";
import { DISCOVER_STRINGS, pullNone, pullRunning, videosRead } from "@/lib/discover-next/discover-words";
import type { PullState, PullTarget, PulledVideo } from "@/lib/discover-next/pull";
import { cn } from "@/lib/utils";

import { PullOffer } from "./pull-offer";
import { PushedHeader } from "./pushed-header";
import { CARD_BOX, VideoCardFace, VideoCardOutline, cardDescribedBy } from "./video-card";
import { useWide } from "./use-wide";
import { GRID } from "./videos-panel";

/**
 * The pull page (spec 3.6; drawing frames 6 and 7): a pushed page titled by the input ("@jay.makes",
 * "meal prep"). Presentational: the container (`pull-next.tsx`) starts the pull, follows, and holds the
 * pulled video's sheet.
 *
 *   phone                                    desktop (a 980 column)
 *   ‹ @jay.makes            (shell)          ‹ @jay.makes                              [Follow]
 *   30 videos read  Biggest jump [Follow]    30 videos read                      Biggest jump
 *   [card] [card]                            [card] [card] [card] [card] [card]
 *
 * - Not started (arrived by the address, or a wall answered): the offer row; only its Pull starts.
 * - Running: the sentence (a status) and twelve card outlines; no count, no percent.
 * - Done: "30 videos read", the order ("Biggest jump": the server's own ranking is kept), and the cards.
 *   A pulled video has no page: its card is a button, with the library card's own face, that opens its
 *   sheet. None: one sentence.
 * - Refused: the sentence (an alert); Try again only where trying again can help ("Couldn't read").
 * - A link that is not TikTok: its sentence alone, nothing offered.
 * - Follow, for a creator, is the quiet button in every state (Pull is the screen's one ink button). On a
 *   desk it sits at the right of the page's header. On a phone the shell's header holds the title and New
 *   chat, so it sits at the right of the first line under it that it can share (the offer's title, the
 *   running sentence, the count line); beside a sentence standing alone it keeps a row of its own. One
 *   Follow at each width (the width is read from `matchMedia`'s store). While it runs it waits; once done
 *   it reads "Following", pressed, and does nothing more.
 * - When a state takes the place of the one that held the focus (the Pull pressed, the read done), the
 *   focus goes to the new state's first line, or back to Pull when the offer returns; never when the
 *   focus is somewhere on the page already (a dialog the app raised keeps it).
 */

const S = DISCOVER_STRINGS.pull;

/** How many card outlines stand in for the cards while a pull runs. */
const OUTLINES = 12;

export type FollowState = "idle" | "running" | "done";

export interface PullScreenProps {
  target: PullTarget;
  state: PullState;
  /** The offer's Pull, and Try again. */
  onPull(): void;
  /** Follow, for a creator; null: none (words, a link). */
  follow: FollowState | null;
  onFollow(): void;
  /** A pulled card is pressed: open its sheet (`from` is the card, to come back to). */
  onOpen(video: PulledVideo, from: HTMLElement): void;
}


/** A first line the focus can be handed to, without a ring drawn around a sentence. */
const LEAD = "outline-none";

function FollowButton({ state, onFollow }: { state: FollowState; onFollow(): void }) {
  const done = state === "done";
  const running = state === "running";
  return (
    <Chip
      aria-pressed={done}
      aria-disabled={done || running || undefined}
      aria-busy={running || undefined}
      onClick={() => {
        if (state === "idle") onFollow();
      }}
      className={cn(done && "bg-surface-sunken text-foreground-secondary shadow-none", running && "opacity-60")}
    >
      {done ? S.following : S.follow}
    </Chip>
  );
}

/** A pulled video as a card: the library card's face, as a button (it has no page; a press opens its sheet). */
function PulledCard({ video, onOpen }: { video: PulledVideo; onOpen(video: PulledVideo, from: HTMLElement): void }) {
  const id = useId();
  return (
    <button
      type="button"
      aria-label={cardName(video)}
      aria-describedby={cardDescribedBy(id, video)}
      aria-haspopup="dialog"
      onClick={(e) => {
        // Safari does not focus a button on a tap: focused here, so the sheet has it to hand back.
        e.currentTarget.focus();
        onOpen(video, e.currentTarget);
      }}
      className={cn(CARD_BOX, "w-full text-left")}
    >
      <VideoCardFace video={video} id={id} />
    </button>
  );
}

interface BodyProps {
  target: PullTarget;
  state: PullState;
  onPull(): void;
  onOpen(video: PulledVideo, from: HTMLElement): void;
  /** Follow, on a phone: at the right of the first line it can share. */
  aside: React.ReactNode;
  lead: React.RefObject<HTMLParagraphElement | null>;
  action: React.RefObject<HTMLButtonElement | null>;
}

/** Follow on a row of its own, above a sentence that stands alone. */
function AsideRow({ aside }: { aside: React.ReactNode }) {
  if (!aside) return null;
  return (
    <div data-part="first-line" className="flex min-h-11 items-center justify-end">
      {aside}
    </div>
  );
}

function Body({ target, state, onPull, onOpen, aside, lead, action }: BodyProps) {
  if (target.kind === "not-tiktok") return <PullOffer target={target} />;

  if (state.kind === "idle") return <PullOffer target={target} onPull={onPull} actionRef={action} aside={aside} />;

  if (state.kind === "running") {
    return (
      <>
        <div data-part="first-line" className="flex items-start gap-3">
          <p ref={lead} role="status" tabIndex={-1} className={cn("min-w-0 flex-1 break-words px-1 text-ui text-foreground-secondary", LEAD)}>
            {pullRunning(target)}
          </p>
          {aside}
        </div>
        <div className="@container mt-3">
          <ul aria-label={DISCOVER_STRINGS.tabs.videos} aria-busy="true" className={GRID}>
            {Array.from({ length: OUTLINES }, (_, i) => (
              <li key={i} aria-hidden>
                <VideoCardOutline />
              </li>
            ))}
          </ul>
        </div>
      </>
    );
  }

  if (state.kind === "failed") {
    return (
      <>
        <AsideRow aside={aside} />
        <div role="alert" className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <p ref={lead} tabIndex={-1} className={cn("max-w-full break-words text-ui text-foreground-secondary", LEAD)}>
            {state.failure.sentence}
          </p>
          {state.failure.kind === "read" && <Chip onClick={onPull}>{S.tryAgain}</Chip>}
        </div>
      </>
    );
  }

  if (state.videos.length === 0) {
    return (
      <>
        <AsideRow aside={aside} />
        <p ref={lead} role="status" tabIndex={-1} className={cn("break-words px-6 py-16 text-center text-ui text-foreground-secondary", LEAD)}>
          {pullNone(target)}
        </p>
      </>
    );
  }

  return (
    <>
      <div data-part="first-line" className="flex min-h-11 items-center gap-3 px-1">
        <p ref={lead} tabIndex={-1} data-part="count" className={cn("min-w-0 break-words text-ui font-[640] text-foreground tabular-nums", LEAD)}>
          {videosRead(state.videos.length)}
        </p>
        <span data-part="order-word" className="ml-auto shrink-0 text-ui text-foreground-secondary">
          {S.order}
        </span>
        {aside}
      </div>
      <div className="@container mt-1.5">
        <ul aria-label={DISCOVER_STRINGS.tabs.videos} className={GRID}>
          {state.videos.map((video) => (
            <li key={video.id}>
              <PulledCard video={video} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export function PullScreen({ target, state, onPull, follow, onFollow, onOpen }: PullScreenProps): React.JSX.Element {
  usePushedTitle(target.shown);
  const wide = useWide();
  const followButton = follow ? <FollowButton state={follow} onFollow={onFollow} /> : null;

  // The state's first line, and Pull: where the focus goes when what held it has gone.
  const lead = useRef<HTMLParagraphElement | null>(null);
  const action = useRef<HTMLButtonElement | null>(null);
  const kind = target.kind === "not-tiktok" ? "said" : state.kind;
  const seen = useRef(kind);
  useEffect(() => {
    if (seen.current === kind) return;
    seen.current = kind;
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    (kind === "idle" ? action.current : lead.current)?.focus();
  }, [kind]);

  return (
    <div data-testid="pull-next" className="flex min-h-full flex-col">
      <PushedHeader title={target.shown} trailing={wide ? followButton : undefined} />
      <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+40px)] md:px-8 md:pb-12">
        <div className="mx-auto flex w-full max-w-[980px] flex-col pt-3 md:pt-1">
          <Body target={target} state={state} onPull={onPull} onOpen={onOpen} aside={wide ? null : followButton} lead={lead} action={action} />
        </div>
      </div>
    </div>
  );
}

/** The route's loading file: the page's frame and the offer row's outline, busy; nothing sent. */
export function PullScreenLoading(): React.JSX.Element {
  return (
    <div data-testid="pull-next" aria-busy="true" className="flex min-h-full flex-col">
      <div aria-hidden className="hidden h-[68px] md:block" />
      <div className="px-4 pt-3 md:px-8 md:pt-1">
        <div className="mx-auto w-full max-w-[980px]">
          <div data-part="outline" className="h-[76px] rounded-3xl bg-surface-sunken" />
        </div>
      </div>
    </div>
  );
}
