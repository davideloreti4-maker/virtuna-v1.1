"use client";

import * as React from "react";
import { useId } from "react";
import { PushPin } from "@phosphor-icons/react";

import type { ShellIcon } from "@/components/shell/icons";
import { SmallGauge } from "@/components/thread-next/answer-gauge";
import { VideoIcon } from "@/components/thread-next/answer-icons";
import { BulbIcon, DocIcon, LoopIcon, PenIcon } from "@/components/thread-next/field-icons";
import { StoredStill, VideoThumb } from "@/components/thread-next/video-answer";
import type { PieceKind } from "@/lib/library/chat-summary";
import type { PostedUsual } from "@/lib/posted/posted";
import { cn } from "@/lib/utils";

import { ChatIcon } from "./library-icons";

export { fallbackTitle, rowLine } from "./row-line";

/**
 * One chat in Library (spec 2026-11-23 §3.1, §3.2; reference v11 Library A, `lbRow`, and the
 * desktop table, `Dk.lib`):
 *
 *   phone   [tile] Title, two lines at most        (46 gauge)
 *                  3 hooks · simulated 2h ago
 *   desk    [tile] | Title / its line | Stage | gauge | After posting   (`TABLE_GRID`)
 *
 * - ONE button, named by the title and described by the line (and "Pinned," first for a pinned
 *   chat), opens the chat. Its `::after` covers the whole row, so a tap anywhere but the gauge and
 *   the More control opens it (the thread's pack rows do the same).
 * - The tile, 42 × 56 (44 × 58 in the table): a video's picture (its stored frame, else the stored
 *   video's own first frame, through the thread's `VideoThumb`), else the mark of what the chat
 *   holds. Most chats have no picture, so the marks are the list's rhythm: one size, one ink.
 * - The gauge, only for a chat with a number: the piece simulated last, ink. With its result page it
 *   is a link ("Open the result: <title>", described by what the number measures); without one, a
 *   picture of the number, and a tap on it opens the row.
 * - The stage word ("Draft", "Simulated", "Posted") is the table's column; the phone has the line.
 * - After posting (plan 2026-11-24-after-posting, ruling 30): a posted chat's line by width. On a phone
 *   "Posted 4d ago · 31K views", the numbers one unbroken piece, and the mark "1.8× your usual" on its
 *   own line under it, in its tone's colour (green above, coral below, the line's own ink around), with
 *   no separator before it (`PostedPhoneLine`, Home's too). From 768 the column "After posting" has the
 *   numbers and the mark, so the line is what the row said before with "posted" for "simulated"
 *   ("3 hooks · posted 4d ago"). Each fact is heard once: the line on a phone, the line and the column
 *   on a desk. Nothing else in the row changes colour, and the gauge stays what Maven said.
 * - `menu`: the row's More control (`RowMenu`, handed in by the container); never inside the button,
 *   and above its `::after`, so a tap on it never opens the row.
 */

/** The mark under a posted row's phone line: "1.8× your usual", in its tone (after posting). */
export interface RowMark {
  text: string;
  tone: PostedUsual["tone"];
}

/** A posted chat's line as a phone draws it, in parts (ruling 30): "Posted 4d ago" · "31K views" (the
 *  numbers, one unbroken piece) or the state's words, and the mark on its own line. */
export interface PhoneLine {
  lead: string;
  rest: string;
  /** `rest` is the numbers: never broken across lines. */
  numbers: boolean;
  /** "1.8× your usual" in its tone; null until the numbers are final with a usual. */
  mark: RowMark | null;
}

/** A posted chat's part of its row (plan 2026-11-24-after-posting). */
export interface RowPosted {
  /** The phone's line (Home's at every width). From 768 the row's `line` says what is inside and when
   *  it was posted, and the column has the numbers. */
  phone: PhoneLine;
  /** The desktop column "After posting": "31K views" over "1.8× your usual" (`tone`: the usual's, only
   *  when the under line is the usual), "so far", or nothing; "Reading"; "Not read". */
  cell: { top: string; under: string | null; tone: PostedUsual["tone"] | null };
}

export interface ChatRowData {
  id: string;
  title: string;
  pinned: boolean;
  /** "3 hooks · simulated 2h ago" (`rowLine`); a posted chat's "3 hooks · posted 4d ago", the table's
   *  line from 768 (the phone's is `posted.phone`). */
  line: string;
  lead: PieceKind;
  stageWord: "Draft" | "Simulated" | "Posted" | null;
  /** A stored frame of the chat's video. */
  frame: string | null;
  /** The stored path of the chat's own video: its first frame, when there is no `frame`. */
  still: string | null;
  /** describes: "66% would stop to watch" | "38% watch to the end". What Maven said, posted or not. */
  gauge: { number: number; describes: string; href: string | null } | null;
  /** After posting; null or absent for a chat with no posted piece. */
  posted?: RowPosted | null;
}

/**
 * The table's columns from 768: tile, title and line, Stage, the gauge, After posting (and More, when
 * given). Picked by the width of Library's card (its `@container`), not the window's: with the sidebar
 * open at 768 the card is 440 inside, at 1440 it is 932. Under 720 inside, tight columns (the stage
 * word "Simulated" and the head's labels just fit) and the 12 gap of the row's own button; from 720,
 * roomier ones. The title takes what is left: 74 at 768 with the sidebar open, 266 with the rail, 330 at
 * 1024 open, 402 with the rail, 446 at 1440.
 */
const TABLE_TIGHT = "md:@max-[720px]:gap-x-3";
const TABLE_ROOMY = "md:@min-[720px]:gap-x-3.5";
export const TABLE_GRID = cn(
  "md:@max-[720px]:grid-cols-[44px_minmax(0,1fr)_72px_60px_92px]",
  "md:@min-[720px]:grid-cols-[56px_minmax(0,1fr)_104px_84px_128px]",
  TABLE_TIGHT,
  TABLE_ROOMY,
);
export const TABLE_GRID_MENU = cn(
  "md:@max-[720px]:grid-cols-[44px_minmax(0,1fr)_72px_60px_92px_38px]",
  "md:@min-[720px]:grid-cols-[56px_minmax(0,1fr)_104px_84px_128px_44px]",
  TABLE_TIGHT,
  TABLE_ROOMY,
);

/** The tile's box: 42 × 56, the drawing's hairline. */
const TILE = "h-14 w-[42px] shrink-0 rounded-lg bg-surface-sunken shadow-[0_0_0_1px_var(--color-border)]";
/** In Library's table from 768: 44 × 58. */
const TILE_TABLE = "md:h-[58px] md:w-11";

const MARK: Record<PieceKind, ShellIcon> = {
  video: VideoIcon,
  script: DocIcon,
  remix: LoopIcon,
  hooks: PenIcon,
  ideas: BulbIcon,
  text: DocIcon,
  chat: ChatIcon,
};

/**
 * The mark of a kind in its tile: Home's skill glyphs (Hooks, Script, Remix), the bulb, the video, a
 * bubble. `table` (the default): it grows to the table's 44 × 58 from 768; without, 42 × 56 at every
 * width (Home's Recent).
 */
export function MarkTile({ kind, table = true }: { kind: PieceKind; table?: boolean }) {
  const Icon = MARK[kind];
  return (
    <span
      aria-hidden
      data-part="mark"
      data-kind={kind}
      className={cn("flex items-center justify-center text-foreground-secondary", TILE, table && TILE_TABLE)}
    >
      <Icon size={18} />
    </span>
  );
}

/** What a chat's tile draws: the kind it is marked with, and a video's picture. */
export type ChatTileData = Pick<ChatRowData, "lead" | "frame" | "still">;

/**
 * A chat's tile, Library's rows and Home's Recent alike: a video's picture (its stored frame, else
 * the stored video's own first frame), else the mark of what the chat holds. `table` as `MarkTile`.
 */
export function ChatTile({ lead, frame, still, table = true }: ChatTileData & { table?: boolean }) {
  if (lead !== "video") return <MarkTile kind={lead} table={table} />;
  return (
    <VideoThumb
      src={frame}
      still={still ? <StoredStill path={still} /> : undefined}
      // The thread's tile, at the row's size; its video mark drawn as the other marks are.
      className={cn(
        TILE,
        table && TILE_TABLE,
        "aspect-auto [&_[data-part=video-mark]]:size-[18px] [&_[data-part=video-mark]]:text-foreground-secondary",
      )}
    />
  );
}

/**
 * A chat's gauge, Library's rows and Home's Recent alike: the number of the piece simulated last,
 * ink. With its result page a link ("Open the result: <title>", described by what the number
 * measures); without one, a picture of the number. `size`: 46 in Library, 40 on Home.
 */
export function ChatGauge({ gauge, title, size }: { gauge: NonNullable<ChatRowData["gauge"]>; title: string; size?: number }) {
  return <SmallGauge state={{ kind: "done", value: gauge.number }} size={size} label={title} href={gauge.href} words={gauge.describes} />;
}

/** The usual's colour: green and coral say only "against your usual"; around it, no colour of its own. */
const TONE: Record<RowMark["tone"], string | undefined> = {
  above: "text-above",
  below: "text-below-text",
  around: undefined,
};

/** The quiet line: one line, cut, from 360 up; on a narrower phone it may wrap onto a second line, so
 *  the "when" at its end is not the part cut off. */
const LINE = "mt-px block truncate text-meta text-foreground-secondary tabular-nums max-[360px]:whitespace-normal max-[360px]:line-clamp-2";
/** A posted chat's line: its phone form wraps (two or three lines, as drawn); from 768 one line, cut. */
const POSTED_LINE = "mt-px block text-meta text-foreground-secondary tabular-nums md:truncate";
/** Home's posted line: the phone form at every width. */
export const POSTED_LINE_HOME = "mt-px block text-meta text-foreground-secondary tabular-nums";

/** The sidebar's pin (filled), ahead of a line: a title cut at two lines cannot take it along. */
function LinePin() {
  return <PushPin data-part="pin" size={12} weight="fill" aria-hidden className="mr-1.5 inline-block align-baseline text-foreground-secondary" />;
}

/**
 * One unbroken piece of a phone's posted line, led by its own "·" in a 14 wide box. The pieces stand 14
 * to the left inside a box that cuts off what is outside it, so a piece that starts a line (the first, or
 * one that wrapped) has its "·" cut off: no "·" is ever left at the end of a line or at its start.
 * `said`: a reader hears " · " before it.
 */
function Piece({ said = false, children }: { said?: boolean; children: React.ReactNode }) {
  return (
    <span data-part="piece" className="whitespace-nowrap">
      <span aria-hidden className="inline-block w-3.5 text-center">
        ·
      </span>
      {said && <span className="sr-only"> · </span>}
      {children}
    </span>
  );
}

/**
 * A posted chat's line as a phone draws it (Library under 768; Home's Recent at every width), ruling 30:
 * "Posted 4d ago · 31K views" with the numbers one unbroken piece, then the mark "1.8× your usual" on its
 * own line, in its tone's colour, with no separator before it. Reading and not read are plain words
 * ("Posted · reading the post"), wrapping as words. A reader hears "Posted 4d ago · 31K views 1.8× your
 * usual".
 */
export function PostedPhoneLine({ line, pinned = false, className }: { line: PhoneLine; pinned?: boolean; className?: string }) {
  return (
    <span data-part="phone-line" className={cn("block", className)}>
      {line.numbers ? (
        <span className="block overflow-hidden">
          <span className="-ml-3.5 block">
            <Piece>
              {pinned && <LinePin />}
              {line.lead}
            </Piece>
            {/* Where the line may break: between the two pieces, nowhere inside them. */}
            <span aria-hidden>{"\u200b"}</span>
            <Piece said>{line.rest}</Piece>
          </span>
        </span>
      ) : (
        <span className="block">
          {pinned && <LinePin />}
          {line.lead} · {line.rest}
        </span>
      )}
      {line.mark && (
        <>
          {/* A reader's space before the mark; nothing drawn. */}{" "}
          <span data-part="usual" className={cn("block whitespace-nowrap", TONE[line.mark.tone])}>
            {line.mark.text}
          </span>
        </>
      )}
    </span>
  );
}

/** The table's column "After posting": the views, and under them the usual (in its tone), "so far" or
 *  nothing. Empty for a chat with no posted piece, so More keeps its column. A reader hears the numbers
 *  here, once: from 768 the row's line no longer says them. */
function AfterCell({ posted }: { posted: RowPosted | null | undefined }) {
  return (
    <span data-part="after" className="pointer-events-none hidden min-w-0 md:block">
      {posted && (
        <>
          <span className="block text-ui text-foreground tabular-nums">{posted.cell.top}</span>
          {posted.cell.under && (
            <span className={cn("block text-meta text-foreground-secondary tabular-nums", posted.cell.tone && TONE[posted.cell.tone])}>
              {posted.cell.under}
            </span>
          )}
        </>
      )}
    </span>
  );
}

export function ChatRow({ chat, onOpen, menu }: { chat: ChatRowData; onOpen(id: string): void; menu?: React.ReactNode }) {
  const uid = useId();
  const described = chat.pinned ? `${uid}-pin ${uid}-line` : `${uid}-line`;
  const { posted } = chat;
  return (
    // `group/row`: the More control (RowMenu) shows on a desk while the row is hovered or focused.
    <li className={cn("group/row relative flex items-center gap-3 md:grid", menu ? TABLE_GRID_MENU : TABLE_GRID)}>
      <button
        type="button"
        aria-labelledby={`${uid}-title`}
        aria-describedby={described}
        onClick={() => onOpen(chat.id)}
        className="flex min-h-[72px] min-w-0 flex-1 items-center gap-3 rounded-xl py-2 text-left after:absolute after:inset-0 md:col-span-3 md:grid md:min-h-[76px] md:grid-cols-subgrid md:py-[9px]"
      >
        <ChatTile lead={chat.lead} frame={chat.frame} still={chat.still} />
        <span className="min-w-0 flex-1">
          <span id={`${uid}-title`} className="line-clamp-2 text-ui font-[600] tracking-[-0.012em] text-foreground">
            {chat.title}
          </span>
          {chat.pinned && (
            <span id={`${uid}-pin`} className="sr-only">
              Pinned,
            </span>
          )}
          {posted ? (
            // Ruling 30: the phone's form under 768, the table's from 768 (the column has the numbers).
            <span id={`${uid}-line`} className={POSTED_LINE}>
              <PostedPhoneLine line={posted.phone} pinned={chat.pinned} className="md:hidden" />
              <span data-part="desk-line" className="max-md:hidden">
                {chat.pinned && <LinePin />}
                {chat.line}
              </span>
            </span>
          ) : (
            <span id={`${uid}-line`} className={LINE}>
              {chat.pinned && <LinePin />}
              {chat.line}
            </span>
          )}
        </span>
        <span data-part="stage" className="hidden text-ui text-foreground md:block">
          {chat.stageWord}
        </span>
      </button>
      {/* Above the row's ::after; every tap but the gauge link's goes through to the row. */}
      <span data-part="gauge" className={cn("pointer-events-none relative z-[1] flex shrink-0", !chat.gauge && "max-md:hidden")}>
        {chat.gauge && <ChatGauge gauge={chat.gauge} title={chat.title} />}
      </span>
      <AfterCell posted={chat.posted} />
      {/* On the phone pulled 12 into the card's right padding (16), the row's 12 gap to the gauge
          kept: the title keeps that room. */}
      {menu && <span className="relative z-[1] flex shrink-0 max-md:-mr-3">{menu}</span>}
    </li>
  );
}
