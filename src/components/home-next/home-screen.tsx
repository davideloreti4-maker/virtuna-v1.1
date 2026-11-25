"use client";

import * as React from "react";
import { useId, useRef } from "react";
import Link from "next/link";

import {
  ChatGauge,
  ChatTile,
  POSTED_LINE_HOME,
  PostedPhoneLine,
  type ChatRowData,
  type ChatTileData,
  type RowPosted,
} from "@/components/library-next/chat-row";
import { EARN } from "@/components/shell/nav-config";
import type { ShellIcon } from "@/components/shell/icons";
import { ChevronIcon, DocIcon, LoopIcon, PenIcon, PulseIcon } from "@/components/thread-next/field-icons";
import { creditsLabel } from "@/components/thread-next/thread-field";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Home (spec 2026-11-23 §3; drawings `ax-p1.png`, `ax-p2.png`, `ax-d1.png`): what /home shows when
 * no chat is open. Presentational: the composer draws the field and hands it in, and the container
 * (`home-next.tsx`) reads the greeting's name, the chats and the sidebar's state.
 *
 *   phone                            desktop (beside the sidebar)
 *   opener ··········· 30 credits    (no top row: the sidebar has both)
 *   Good morning, Nia.               Good morning, Nia.   (centred, a fifth down)
 *   Money made $0 ····· Earn 50% ›   Money made, as wide as the field (Earn, step C)
 *   the field                        the field, 720 wide
 *   the four skills, two by two      the four skills in one row (two by two under 760)
 *   More skills                      More skills (the More sheet: Ideas, Explore, Read my account)
 *   Recent ············· Library     Recent only while the sidebar is the rail, as wide as the field
 *
 * A recent chat is drawn as Library draws it: its tile, its title, its line
 * ("3 hooks · simulated 2h ago"; a posted chat's line as Library's phone draws it, "Posted 4d ago ·
 * 31K views" with the mark "1.8× your usual" on its own line in its tone's colour) and, with a number,
 * its gauge (a link to the result). Until
 * Library's summary is in (or when it failed), the same row with the plain chat mark and when it was
 * last written to as its line, so nothing moves when the summary lands.
 * Departure from the drawing (spec §6): no Recent in the page on desktop while the sidebar lists the
 * same chats.
 *
 * "Money made" (Earn plan 2026-11-24, step C; rulings 18 and 24): one row between the greeting and the
 * field, a link to Earn. See `HomeMoney`: with nothing passed Home is as it was before the row; while
 * it is loading its space is held (empty, silent), so nothing moves when it lands.
 */

export type HomeSkillId = "test" | "hooks" | "script" | "remix";

/** The four skills, in the drawn order. "Simulate" is the video test (`test`). */
export const HOME_SKILLS: ReadonlyArray<{ id: HomeSkillId; label: string; line: string }> = [
  { id: "test", label: "Simulate", line: "See who keeps watching" },
  { id: "hooks", label: "Hooks", line: "Openings for an idea" },
  { id: "script", label: "Script", line: "A full script, timed" },
  { id: "remix", label: "Remix", line: "Rebuild a proven video" },
];

const ICON_BY_SKILL: Record<HomeSkillId, ShellIcon> = {
  test: PulseIcon,
  hooks: PenIcon,
  script: DocIcon,
  remix: LoopIcon,
};

/** How long after a card pick Recent takes no click: the cards go on the pick and Recent slides up
 *  into their place, so the second tap of a double tap would land on a chat (as `SETTLE_MS` in
 *  `thread-next/answer-sheet.tsx`). */
export const PICK_SETTLE_MS = 320;

/** The clock that window is read from. Time is an outside thing: the window's test drives it by hand. */
export const pickClock = { now: (): number => performance.now() };

export interface HomeRecentRow {
  id: string;
  title: string;
  /** When it was last written to ("2h ago"): the line under the title until the summary is in; null for none. */
  when: string | null;
  /** Library's summary of the chat, once it is in: the row's tile, its line under the title, and its
   *  gauge (only with a number); a posted chat's mark (after posting). Without it, the plain chat mark
   *  and `when`. */
  summary?: { tile: ChatTileData; line: string; gauge: NonNullable<ChatRowData["gauge"]> | null; posted?: RowPosted | null };
}

/** The row's label (ruling 18). */
export const MONEY_MADE = "Money made";

/**
 * What feeds the "Money made" row (ruling 24b). Not passed, or null: no row and no space, Home as it was
 * before the row.
 * - `loading`: not known yet; the row's space is kept, empty and silent.
 * - `shown`: the row. `amount` in money words ("$0"), or null when it could not be read (an enrolled
 *   creator is not told "$0" for that: the row then says the label and the rate only); `hint` is the
 *   rate at the right ("Earn 50%").
 */
export type HomeMoney = { state: "loading" } | { state: "shown"; amount: string | null; hint: string };

/** Under 360 wide the rate stays beside an amount of at most this many characters ("$240"); a longer
 *  one ("$24.50") takes its room (ruling 24a). From 360 the rate is always drawn. */
const MONEY_RATE_FITS_CHARS = 4;

export interface HomeScreenProps {
  greeting: string | null;                   // null: not known yet (the profile is loading); the line holds its place
  /** "Money made" (see `HomeMoney`): not passed or null, no row and no space. */
  money?: HomeMoney | null;
  /** The phone's way into the drawer (the creator's picture), first in the top row. Not given: none. */
  opener?: React.ReactNode;
  credits: number | null;                    // null: unlimited or not loaded, no pill
  field: React.ReactNode;                    // the field block
  picked: boolean;                           // a skill is picked: the cards are not shown
  onPickSkill(id: HomeSkillId): void;
  recent: HomeRecentRow[];
  onOpenThread(id: string): void;
  recentOnDesktop: boolean;                  // false while the sidebar lists the same chats
  onMore(): void;                            // "More skills": the More sheet (Ideas, Explore, Read my account)
}

function SkillCard({ id, label, line, onPick }: { id: HomeSkillId; label: string; line: string; onPick(id: HomeSkillId): void }) {
  // Named for the skill alone, so "tap Hooks" finds it; its line is the description.
  const uid = useId();
  const Icon = ICON_BY_SKILL[id];
  return (
    <button
      type="button"
      aria-labelledby={`${uid}-name`}
      aria-describedby={`${uid}-line`}
      onClick={() => onPick(id)}
      // As drawn: the tile radius (20) and padding 12 / 14 / 13, 16 / 18 in the row of four.
      className="flex w-full flex-col items-start rounded-2xl bg-surface px-3.5 pb-[13px] pt-3 text-left shadow-[var(--shadow-rest)] transition-shadow duration-150 hover:shadow-[var(--shadow-lift)] @min-[760px]:px-[18px] @min-[760px]:py-4"
    >
      <span className="flex size-[34px] items-center justify-center rounded-full bg-surface-sunken text-foreground">
        <Icon size={17} aria-hidden />
      </span>
      <span id={`${uid}-name`} className="mt-2 text-title font-[640] text-foreground">
        {label}
      </span>
      <span id={`${uid}-line`} className="text-meta text-foreground-secondary">
        {line}
      </span>
    </button>
  );
}

/** The tile of a row whose summary is not in yet: the plain chat mark. */
const PLAIN_TILE: ChatTileData = { lead: "chat", frame: null, still: null };

function RecentRow({ row, onOpen }: { row: HomeRecentRow; onOpen(id: string): void }) {
  // Named for the chat's title; its line (or when it was last written to) is the description.
  const uid = useId();
  // One shape with or without Library's summary: when the summary lands, only the
  // tile's picture, the line and the gauge change; the row keeps its place and its height.
  const tile = row.summary?.tile ?? PLAIN_TILE;
  const line = row.summary ? row.summary.line : row.when;
  const gauge = row.summary?.gauge ?? null;
  const posted = row.summary?.posted ?? null;
  return (
    // As a Library row: the button's ::after covers the row, so a tap anywhere but the gauge opens
    // the chat; the gauge is outside the button (a link in a button is not allowed).
    <li data-chat={row.id} className="relative flex items-center gap-3">
      <button
        type="button"
        aria-labelledby={`${uid}-title`}
        aria-describedby={line ? `${uid}-line` : undefined}
        onClick={() => onOpen(row.id)}
        className="flex min-h-[72px] min-w-0 flex-1 items-center gap-3 py-2 text-left after:absolute after:inset-0"
      >
        {/* 42 × 56 at every width: Home's rows are not Library's table. */}
        <ChatTile {...tile} table={false} />
        <span className="min-w-0 flex-1">
          <span id={`${uid}-title`} className="block truncate text-ui font-[560] text-foreground">
            {row.title}
          </span>
          {posted ? (
            // A posted chat: Library's phone line at every width (Home has no column): the numbers one
            // unbroken piece, the mark on its own line (ruling 30).
            <span id={`${uid}-line`} className={POSTED_LINE_HOME}>
              <PostedPhoneLine line={posted.phone} />
            </span>
          ) : (
            line && (
              <span id={`${uid}-line`} className="mt-px block truncate text-meta text-foreground-secondary tabular-nums">
                {line}
              </span>
            )
          )}
        </span>
      </button>
      {gauge && (
        // Above the row's ::after; every tap but the gauge link's goes through to the row.
        <span data-part="gauge" className="pointer-events-none relative z-[1] flex shrink-0">
          <ChatGauge gauge={gauge} title={row.title} size={40} />
        </span>
      )}
    </li>
  );
}

/**
 * "Money made": one link to Earn, 48 tall, one line (ruling 18). The label, the amount in Home's
 * emphasis, then at the right the rate and a chevron. Drawn as Home's cards (the surface, the skill
 * card's radius, the resting shadow), in ink: nothing coral, nothing green.
 * The rate is drawn at every width when it fits (ruling 24a): under 360 wide (Home's own width, the
 * container) it gives way only to an amount longer than `MONEY_RATE_FITS_CHARS`. The link's name
 * always holds it. With no amount (it could not be read, ruling 24c) the row is the label and the rate.
 */
function MoneyRow({ amount, hint }: { amount: string | null; hint: string }) {
  const rateGivesWay = amount !== null && amount.length > MONEY_RATE_FITS_CHARS;
  return (
    <Link
      href={EARN.href}
      aria-label={amount === null ? `${MONEY_MADE}. ${hint}` : `${MONEY_MADE}: ${amount}. ${hint}`}
      className="flex h-12 w-full items-center gap-2 rounded-2xl bg-surface px-4 shadow-[var(--shadow-rest)] transition-shadow duration-150 hover:shadow-[var(--shadow-lift)] md:px-5"
    >
      <span className="min-w-0 truncate text-ui text-foreground-secondary">{MONEY_MADE}</span>
      {amount !== null && (
        <span className="shrink-0 whitespace-nowrap text-ui font-[640] tabular-nums text-foreground">{amount}</span>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-1 pl-2">
        <span className={cn("whitespace-nowrap text-meta font-[560] text-foreground-secondary", rateGivesWay && "@max-[360px]:hidden")}>
          {hint}
        </span>
        <ChevronIcon size={18} aria-hidden className="shrink-0 text-foreground-muted" />
      </span>
    </Link>
  );
}

export function HomeScreen({
  greeting,
  money,
  opener,
  credits,
  field,
  picked,
  onPickSkill,
  recent,
  onOpenThread,
  recentOnDesktop,
  onMore,
}: HomeScreenProps): React.JSX.Element {
  const recentId = useId();
  // When a card was last picked (see PICK_SETTLE_MS): a click on Recent inside the window is the
  // second tap of a double tap on the card, not a choice, and is dropped.
  const pickedAt = useRef(Number.NEGATIVE_INFINITY);
  const pickSkill = (id: HomeSkillId) => {
    pickedAt.current = pickClock.now();
    onPickSkill(id);
  };
  const dropEarlyClick = (event: React.MouseEvent) => {
    if (pickClock.now() - pickedAt.current >= PICK_SETTLE_MS) return;
    event.preventDefault();
    event.stopPropagation();
  };
  return (
    <div
      data-testid="home-next"
      className="@container flex w-full flex-1 flex-col max-md:-mt-[var(--mobile-nav-band)] md:pt-[clamp(72px,24vh,240px)]"
    >
      <div className="mx-auto flex w-full max-w-[1012px] flex-col px-4 pb-6 md:pb-12">
        {/* Phone only: in the band the shell keeps free above the page (10 + 36). */}
        <div className="flex h-[var(--mobile-nav-band)] items-end justify-between px-1 md:hidden">
          {/* The picture opens the drawer, which carries You, Earn and Settings as the sidebar does. */}
          {opener && (
            <div data-part="opener" className="flex shrink-0 md:hidden">
              {opener}
            </div>
          )}
          {credits !== null && (
            // The tag part, as the sidebar's balance is drawn; centred on the picture ((36 - 24) / 2).
            // At the right with or without an opener beside it.
            <Badge data-part="credits" className="mb-1.5 ml-auto tabular-nums">
              {creditsLabel(credits)}
            </Badge>
          )}
        </div>

        {/* The global h1 tracking is unlayered and beats a utility: set inline. */}
        <h1
          className="mt-4 px-1 text-3xl font-bold leading-[35px] text-foreground md:mt-0 md:text-center md:text-4xl md:leading-10"
          style={{ letterSpacing: "-0.035em" }}
          aria-busy={greeting === null || undefined}
        >
          {greeting ?? "\u00A0"}
        </h1>

        {/* Nothing passed: nothing here (the place stays this child's, so the field is never remounted). */}
        {money && (
          // The same element held and shown: while it is loading, an empty row as tall as the row.
          <div
            data-part="money"
            aria-hidden={money.state === "loading" || undefined}
            className="mx-auto mt-3 w-full max-w-[720px] md:mt-7"
          >
            {money.state === "shown" ? <MoneyRow amount={money.amount} hint={money.hint} /> : <div className="h-12" />}
          </div>
        )}

        {/* Under the row (held or shown), the field sits closer to it (16 from md up) than to the
            greeting; with no row it is where it always was (28). */}
        <div className={cn("mx-auto mt-3 w-full max-w-[720px]", money ? "md:mt-4" : "md:mt-7")}>{field}</div>

        {!picked && (
          <>
            <ul className="mt-3 grid grid-cols-2 gap-2 @min-[760px]:mt-[18px] @min-[760px]:grid-cols-4 @min-[760px]:gap-4">
              {HOME_SKILLS.map((skill) => (
                <li key={skill.id} className="flex">
                  <SkillCard id={skill.id} label={skill.label} line={skill.line} onPick={pickSkill} />
                </li>
              ))}
            </ul>
            {/* Ideas, Explore and Read my account: on Home otherwise only behind "/", which nobody
                types on a phone. The thread's More sheet. `py-1` keeps the 44 px halo of
                `.tap-44` off the cards above (8 px away). */}
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={onMore}
              className="tap-44 mt-2 self-center py-1 text-ui text-foreground-secondary hover:text-foreground"
            >
              More skills
            </button>
          </>
        )}

        {recent.length > 0 && (
          // From md up as wide as the field, so a title and its time are not a page apart.
          <section
            aria-labelledby={recentId}
            onClickCapture={dropEarlyClick}
            className={cn("mt-4 md:mx-auto md:mt-[26px] md:w-full md:max-w-[720px]", !recentOnDesktop && "md:hidden")}
          >
            <div className="flex h-9 items-center justify-between px-1 md:h-7">
              <h2 id={recentId} className="text-ui font-[640] text-foreground" style={{ letterSpacing: "normal" }}>
                Recent
              </h2>
              <Link href="/library" className="tap-44 text-meta font-[560] text-foreground-secondary hover:text-foreground">
                Library
              </Link>
            </div>
            <ul className="mt-1 divide-y divide-border rounded-3xl bg-surface px-4 shadow-[var(--shadow-rest)] md:mt-0">
              {recent.map((row) => (
                <RecentRow key={row.id} row={row} onOpen={onOpenThread} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
