"use client";

import * as React from "react";
import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";

import { usePushedTitle } from "@/components/result/use-pushed-title";
import { BookmarkIcon, ExternalIcon } from "@/components/thread-next/answer-icons";
import { LoopIcon } from "@/components/thread-next/field-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { beatsView, type BeatsView } from "@/lib/discover-next/beats";
import { cardLine, cardName } from "@/lib/discover-next/card";
import { DISCOVER_PATH } from "@/lib/discover-next/discover-view";
import { DISCOVER_STRINGS } from "@/lib/discover-next/discover-words";
import { remixOffered } from "@/lib/discover-next/remix";
import type { LibraryVideo } from "@/lib/discover-next/video";
import { multipleWords, splitWhy, videoMeta, watchLabel, webAddress } from "@/lib/discover-next/video-words";
import { cn } from "@/lib/utils";

import { COVER_LOOK, SHADE_BACKGROUND, SHADE_HEIGHT } from "./cover-look";
import { UpMark } from "./discover-icons";
import { CHIP_LINK, PageNotice } from "./page-notice";
import { PushedHeader } from "./pushed-header";
import { CoverImage } from "./video-card";

/**
 * A library video's page (spec 3.3; drawing frame 3): a pushed page titled "Video", with no player.
 * Presentational: the container (`video-next.tsx`) holds Save and Remix.
 *
 *   phone                                   desktop (a 980 column, as the result page)
 *   ┌ cover ─────────────── [save] [↗] ┐    ┌ cover ──────── [save] [↗] ┐  ┌ Why it works ──────┐
 *   │ ▲ 16× their average             │    │                           │  └────────────────────┘
 *   │ the line (the page's h2)        │    │ ▲ 16× their average       │  ┌ How it's built 0:51┐
 *   │ @nia.cooks · 25M views · …      │    │ the line                  │  └────────────────────┘
 *   └─────────────────────────────────┘    └───────────────────────────┘  [ Remix this · 10 credits ]
 *   Why it works · How it's built
 *   [ Remix this · 10 credits ]  (docked)
 *
 * - The cover: the multiple and what it is measured against, the spoken line as the heading (the `<h1>`
 *   is the header's "Video"), and the meta, all on the shade over its lower part, in `COVER_LOOK`'s
 *   fixed colours (a cover is a photo in either theme). A line that is a placeholder is not drawn; the
 *   heading then names the video by its creator for a screen reader. A cover that does not load is the
 *   neutral tile.
 * - At the cover's top right, Save (pressed when saved; not a choice while the saved list is first read) and
 *   the watch link (a new tab, named by the platform), drawn only with a web address to open.
 * - Past 100, the quiet line under the cover says the number is shaky.
 * - Why it works: the first two sentences; More opens the rest in place and goes, and the focus lands
 *   on what it opened. No text: no card.
 * - How it's built: the length at the right, one bar cut at the beats in proportion, the beats numbered
 *   with their start. Beats without times: the list alone. No beats: no card.
 * - The main button, only where Remix is offered (`remixOffered`): ink, the price said before the tap,
 *   docked at the foot on a phone (the page keeps room under its last card), in the right column on a
 *   desk. While the run starts it waits (`aria-disabled`, `aria-busy`: it keeps the focus).
 * - Gone: the sentence and Back to Discover, and the original's link when a saved row of the video still
 *   holds it (the video left the library; the creator saved it to keep it). Failed: the sentence and Try
 *   again. Loading: the outline.
 */

const S = DISCOVER_STRINGS.video;

export type VideoScreenProps =
  | { state: "loading" }
  | {
      state: "gone";
      /** A saved row of the video still holds its original: its address and its link's words. */
      watch?: { href: string; label: string } | null;
    }
  | { state: "failed"; onRetry(): void }
  | {
      state: "ready";
      video: LibraryVideo;
      saved: boolean;
      /** Save is a choice: the saved list is read, or it could not be and a press asks for it again.
       *  False only while the list is on its first read. */
      saveReady: boolean;
      onSave(): void;
      /** The remix is starting: the main button waits. */
      remixWaiting: boolean;
      /** The main button: the container asks what to make. */
      onRemix(): void;
    };

/** The page's two columns from 768 (as the result page's), one column under it. */
const COLUMNS = "mx-auto flex max-w-[980px] flex-col gap-4 md:grid md:grid-cols-[minmax(0,372fr)_minmax(0,588fr)] md:items-start md:gap-5";
/** The cover's shape: taller than wide on a phone, the video's own 9:16 beside the cards on a desk. */
const COVER_SHAPE = "aspect-[4/5] rounded-3xl md:aspect-[9/16]";
/** The cards' padding and their titles. */
const CARD = "p-[18px]";
const CARD_TITLE = "text-reading font-[640] text-foreground";
/** The round buttons over the cover: 38 drawn, 44 to the touch. */
const ON_COVER =
  "tap-44 inline-flex size-[38px] shrink-0 items-center justify-center rounded-full [&_svg]:size-[18px] transition-[scale,opacity] duration-150 motion-safe:active:scale-[0.98] aria-disabled:opacity-60";
const ON_COVER_STYLE: React.CSSProperties = { background: COVER_LOOK.badge, color: COVER_LOOK.ink };


function Cover({ video, saved, saveReady, onSave }: { video: LibraryVideo; saved: boolean; saveReady: boolean; onSave(): void }) {
  const line = cardLine(video.spokenHook);
  const words = multipleWords(video);
  const meta = videoMeta(video);
  const watch = webAddress(video.videoUrl);
  return (
    <div className={cn("relative overflow-hidden bg-surface-sunken", COVER_SHAPE)}>
      <CoverImage src={video.coverUrl} />
      <span aria-hidden data-part="shade" className="absolute inset-x-0 bottom-0" style={{ height: SHADE_HEIGHT, background: SHADE_BACKGROUND }} />
      <div className="absolute inset-x-4 bottom-4 flex flex-col gap-1.5" style={{ color: COVER_LOOK.ink }}>
        {words && (
          <p className="flex items-center gap-1.5 text-meta font-[640] tabular-nums">
            <UpMark />
            {words.text}
          </p>
        )}
        {line ? (
          <h2 className="line-clamp-6 break-words text-subhead font-[700] leading-[1.25] tracking-[-0.012em]">{line}</h2>
        ) : (
          <h2 className="sr-only">{cardName(video)}</h2>
        )}
        {meta && (
          <p className="truncate text-label tabular-nums" style={{ color: COVER_LOOK.inkSoft }}>
            {meta}
          </p>
        )}
      </div>
      <div className="absolute right-3 top-3 flex gap-2">
        <button
          type="button"
          aria-label={S.save}
          aria-pressed={saved}
          aria-disabled={!saveReady || undefined}
          onClick={onSave}
          className={ON_COVER}
          style={ON_COVER_STYLE}
        >
          <BookmarkIcon aria-hidden filled={saved} />
        </button>
        {watch && (
          <a href={watch} target="_blank" rel="noopener noreferrer" className={ON_COVER} style={ON_COVER_STYLE}>
            <ExternalIcon aria-hidden />
            <span className="sr-only">
              {watchLabel(video.platform)}
              {S.newTab}
            </span>
          </a>
        )}
      </div>
    </div>
  );
}

function WhyCard({ why }: { why: { lead: string; rest: string | null } }) {
  const [open, setOpen] = useState(false);
  const restRef = useRef<HTMLSpanElement>(null);
  // More goes as it opens the rest: the focus would drop to the page with it, so it lands on the rest.
  useLayoutEffect(() => {
    if (open) restRef.current?.focus();
  }, [open]);
  return (
    <Card className={CARD}>
      <h2 className={CARD_TITLE}>{S.why}</h2>
      <p className="mt-2 text-ui leading-[1.5] text-foreground">
        {why.lead}
        {why.rest && " "}
        {why.rest && !open && (
          <button
            type="button"
            aria-expanded={false}
            onClick={() => setOpen(true)}
            className="tap-44 rounded-sm font-[640] text-foreground underline-offset-2 hover:underline"
          >
            {S.more}
          </button>
        )}
        {why.rest && open && (
          <span ref={restRef} tabIndex={-1} className="outline-none">
            {why.rest}
          </span>
        )}
      </p>
    </Card>
  );
}

function BuiltCard({ beats }: { beats: BeatsView }) {
  return (
    <Card data-part="built" className={CARD}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={CARD_TITLE}>{S.built}</h2>
        {beats.length && <span className="text-ui tabular-nums text-foreground-secondary">{beats.length}</span>}
      </div>
      {beats.bar && (
        // Each beat's share of the run, 2 apart; the shares divide what the gaps leave. The beats between
        // the ink ones take the muted ink: it reads on a white card and on a dark one, and stays lighter.
        <div aria-hidden data-part="bar" className="mt-3 flex h-2 gap-[2px]">
          {beats.bar.map((share, i) => (
            <span
              key={i}
              className={cn("h-full min-w-0 basis-0 rounded-full", i % 2 === 0 ? "bg-foreground" : "bg-foreground-muted")}
              style={{ flexGrow: share }}
            />
          ))}
        </div>
      )}
      <ol className="mt-3 flex flex-col gap-1.5">
        {beats.rows.map((row) => (
          <li key={row.n} className="flex items-baseline gap-3 text-ui">
            <span className="w-4 shrink-0 tabular-nums text-foreground-secondary">{row.n}</span>
            <span className="min-w-0 flex-1 break-words text-foreground">{row.name}</span>
            {row.at && <span className="shrink-0 tabular-nums text-foreground-secondary">{row.at}</span>}
          </li>
        ))}
      </ol>
    </Card>
  );
}

function RemixButton({ waiting, onRemix }: { waiting: boolean; onRemix(): void }) {
  return (
    // Docked on a phone: fixed at the foot on the ground colour, above the safe area. In the right
    // column from 768.
    <div className="max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-[var(--z-sticky)] max-md:bg-background max-md:px-4 max-md:pb-[max(16px,env(safe-area-inset-bottom))] max-md:pt-3">
      <Button
        type="button"
        variant="primary"
        size="lg"
        aria-haspopup="dialog"
        aria-disabled={waiting || undefined}
        aria-busy={waiting || undefined}
        onClick={(e) => {
          if (waiting) return;
          // Safari does not focus a button on a tap: focused here, so the sheet has it to hand back.
          e.currentTarget.focus();
          onRemix();
        }}
        className="w-full gap-2 next:rounded-full aria-disabled:opacity-40"
      >
        <LoopIcon aria-hidden />
        {S.remix}
      </Button>
    </div>
  );
}


function Page({ busy, children }: { busy?: boolean; children: React.ReactNode }) {
  return (
    <div data-testid="video-next" aria-busy={busy || undefined} className="flex min-h-full flex-col">
      <PushedHeader title={S.title} />
      {children}
    </div>
  );
}

export function VideoScreen(props: VideoScreenProps): React.JSX.Element {
  usePushedTitle(S.title);

  if (props.state === "loading") {
    return (
      <Page busy>
        <div className="px-4 pt-[9px] md:px-8 md:pt-8">
          <div className={COLUMNS}>
            <div data-part="outline" className={cn("bg-surface-sunken", COVER_SHAPE)} />
            <div className="flex min-w-0 flex-col gap-4">
              <Card className="h-[168px]" />
              <Card className="h-[227px]" />
            </div>
          </div>
        </div>
      </Page>
    );
  }

  if (props.state === "gone") {
    return (
      <Page>
        <PageNotice line={S.gone}>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href={DISCOVER_PATH} prefetch={false} className={CHIP_LINK}>
              {S.back}
            </Link>
            {props.watch && (
              <a href={props.watch.href} target="_blank" rel="noopener noreferrer" aria-label={`${props.watch.label}${S.newTab}`} className={CHIP_LINK}>
                <ExternalIcon aria-hidden />
                {props.watch.label}
              </a>
            )}
          </div>
        </PageNotice>
      </Page>
    );
  }

  if (props.state === "failed") {
    return (
      <Page>
        <PageNotice line={S.failed} alert>
          <Chip onClick={props.onRetry}>{S.tryAgain}</Chip>
        </PageNotice>
      </Page>
    );
  }

  const { video } = props;
  const words = multipleWords(video);
  const why = splitWhy(video.whyItWorks);
  const beats = beatsView(video.beats);
  const offered = remixOffered(video.platform, video.videoUrl);
  // A video with an original link on a platform Remix does not work on: one quiet line where the button
  // would be, so the missing button is explained. No link at all: nothing there, as before.
  const remixLimited = !offered && webAddress(video.videoUrl) !== null;

  return (
    <Page>
      <div
        className={cn(
          "px-4 pt-[9px] md:px-8 md:pb-12 md:pt-8",
          // Room under the last card for the docked button on a phone.
          offered ? "pb-[calc(env(safe-area-inset-bottom)+96px)]" : "pb-[calc(env(safe-area-inset-bottom)+40px)]",
        )}
      >
        <div className={COLUMNS}>
          <div className="min-w-0">
            <Cover video={video} saved={props.saved} saveReady={props.saveReady} onSave={props.onSave} />
            {words?.shaky && <p className="mt-2.5 px-1 text-meta text-foreground-secondary">{S.shaky}</p>}
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            {why && <WhyCard why={why} />}
            {beats && <BuiltCard beats={beats} />}
            {offered && <RemixButton waiting={props.remixWaiting} onRemix={props.onRemix} />}
            {remixLimited && (
              <p data-part="remix-limit" className="px-1 text-meta text-foreground-secondary">
                {S.remixLimit}
              </p>
            )}
          </div>
        </div>
      </div>
    </Page>
  );
}
