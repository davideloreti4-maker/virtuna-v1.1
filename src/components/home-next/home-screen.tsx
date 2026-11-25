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
import { ChevronIcon, DocIcon, LoopIcon, MoreIcon, PenIcon, PulseIcon, ScissorsIcon } from "@/components/thread-next/field-icons";
import { creditsLabel } from "@/components/thread-next/thread-field";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Home (spec 2026-11-23 §3, redrawn by 2026-11-25 §2, "the chats first, one field"): what /home shows
 * when no chat is open. Presentational: the composer draws the field and hands it in, and the
 * container (`home-next.tsx`) reads the greeting's name, the chats and the money, and says which of
 * three things go under the field.
 *
 *   phone                            desktop (beside the sidebar, open or the rail)
 *   opener ··········· 30 credits    (no top row: the sidebar has both)
 *   Good morning, Nia.               Good morning, Nia.   (centred, a fifth down)
 *   For @handle ⌄                    For @handle ⌄        (centred)
 *   the field                        the field, 720 wide
 *   under the field, one of three (`under`):
 *     pending  nothing (the chat list has not answered: no cards flash for a creator with chats)
 *     recent   Recent ··· Library, up to five chats, as wide as the field
 *     cards    the four skills, two by two / four in a row, as wide as the field, all one height
 *   Money made $58.80 ·· Earn 50% ›  last, only above zero
 *
 * For an account the editor is open to (`editOpen`; plan 2026-11-24-editor-screens-a, drawing `editor-v2-row-A.png` screen 1)
 * the cards are six, two by two on a phone and three by two from 760: Simulate, Edit, Hooks, Script, Remix and More, which
 * completes the grid and opens the field's More sheet (`onMore`). They follow the cards' rules: only with no chats, as
 * wide as the field, all one height, staying on a pick. Every other account has the four, and More is in the field.
 *
 * A recent chat is drawn as Library draws it: its tile, its title, its line
 * ("3 hooks · simulated 2h ago"; a posted chat's line as Library's phone draws it, "Posted 4d ago ·
 * 31K views" with the mark "1.8× your usual" on its own line in its tone's colour) and, with a number,
 * its gauge (a link to the result). Until
 * Library's summary is in (or when it failed), the same row with the plain chat mark and when it was
 * last written to as its line, so nothing moves when the summary lands.
 *
 * The audience line (spec 2026-11-25 §2.3): who the next run is for, under the greeting, a button that
 * opens the composer's audience sheet. From 768 that sheet is a popover centred under the line
 * (`audienceRef`), and its close hands the focus back to the line. The field is the
 * thread's own (spec §2.4), handed in by the composer.
 *
 * A card's tap picks its skill in the field and the cards stay: nothing on the page moves on a pick,
 * so no tap can land on something that slid into a card's place. More (Ideas, Explore, Read my
 * account) is the field's own.
 *
 * "Money made" (Earn plan 2026-11-24, step C; rulings 18 and 24; spec 2026-11-25 §2.6): one row at the
 * end of the page, a link to Earn, only when something was earned. See `HomeMoney`.
 */

export type HomeSkillId = "test" | "edit" | "hooks" | "script" | "remix";

/** The skills, in the drawn order. "Simulate" is the video test (`test`); Edit only for an account the editor is open to. */
export const HOME_SKILLS: ReadonlyArray<{ id: HomeSkillId; label: string; line: string }> = [
  { id: "test", label: "Simulate", line: "See who keeps watching" },
  { id: "edit", label: "Edit", line: "A raw take to a finished video" },
  { id: "hooks", label: "Hooks", line: "Openings for an idea" },
  { id: "script", label: "Script", line: "A full script, timed" },
  { id: "remix", label: "Remix", line: "Rebuild a proven video" },
];

const ICON_BY_SKILL: Record<HomeSkillId, ShellIcon> = {
  test: PulseIcon,
  edit: ScissorsIcon,
  hooks: PenIcon,
  script: DocIcon,
  remix: LoopIcon,
};

/** What goes under the field (spec 2026-11-25 §2.5): nothing while the chat list has not answered,
 *  Recent for a creator with chats, the four cards for one with none. */
export type HomeUnder = "pending" | "recent" | "cards";

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
 * What feeds the "Money made" row (spec 2026-11-25 §2.6): given only when the amount earned is above
 * zero (`moneyOf` decides, from the cents). `amount` in money words ("$58.80"); `hint` is the rate at
 * the right ("Earn 50%"). Not passed, or null (nothing earned, no amount, loading, refused): no row and
 * no space.
 */
export interface HomeMoney {
  amount: string;
  hint: string;
}

/**
 * The audience line's values, from the composer (spec 2026-11-25 §2.3).
 * - `name`: the audience's name ("@creator_one"), shown as "For @creator_one".
 * - `general`: it is the General audience (the composer knows it by its id, not by its word): the line
 *   reads "For a general audience", and its name is not shown.
 * - `open`, `onOpen`: the audience sheet's state and what opens it.
 */
export interface HomeAudience {
  name: string;
  general: boolean;
  open: boolean;
  onOpen(): void;
}

/** Under 360 wide the rate stays beside an amount of at most this many characters ("$240"); a longer
 *  one ("$24.50") takes its room (ruling 24a). From 360 the rate is always drawn. */
const MONEY_RATE_FITS_CHARS = 4;

export interface HomeScreenProps {
  greeting: string | null;                   // null: not known yet (the profile is loading); the line holds its place
  audience: HomeAudience;                    // the line under the greeting
  /** The composer's ref, set to the audience line: the sheet's popover stands on it from 768. */
  audienceRef?: React.Ref<HTMLButtonElement>;
  /** "Money made", last (see `HomeMoney`): not passed or null, no row and no space. */
  money?: HomeMoney | null;
  /** The phone's way into the drawer (the creator's picture), first in the top row. Not given: none. */
  opener?: React.ReactNode;
  credits: number | null;                    // null: unlimited or not loaded, no pill
  field: React.ReactNode;                    // the field block
  under: HomeUnder;                          // what goes under the field
  onPickSkill(id: HomeSkillId): void;        // a card's tap: the skill is picked in the field, the cards stay
  recent: HomeRecentRow[];                   // Recent's rows (drawn while `under` is "recent")
  onOpenThread(id: string): void;
  editOpen?: boolean;                        // the editor is open to this account: six cards, More the sixth (E3)
  onMore?(): void;                           // the six cards' More card: the field's More sheet
}

function SkillCard({ label, line, icon: Icon, onPick, popup = false }: { label: string; line: string; icon: ShellIcon; onPick(): void; popup?: boolean }) {
  // Named for the skill alone, so "tap Hooks" finds it; its line is the description. `popup`: the card opens a sheet (More).
  const uid = useId();
  return (
    <button
      type="button"
      aria-labelledby={`${uid}-name`}
      aria-describedby={`${uid}-line`}
      aria-haspopup={popup ? "dialog" : undefined}
      onClick={onPick}
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

/**
 * "For @handle ⌄" (spec 2026-11-25 §2.3): 15 / 22 in the secondary ink, the name at 560 in the ink, the
 * chevron 14 after a gap of 5. Its name for a screen reader is its words and what it does ("For
 * @handle, change audience"), so the name holds what is on screen. A long name gives way at the
 * edge of the page. No focus style of its own: the app's ring, as the cards and Library have.
 */
function AudienceLine({ audience, lineRef }: { audience: HomeAudience; lineRef?: React.Ref<HTMLButtonElement> }) {
  // From 768 the sheet is a popover under this line, and a press outside it (this line included)
  // closes it on pointerdown: the click that follows must not open it again. As the field's More.
  const wasOpen = useRef(false);
  const who = audience.general ? "a general audience" : audience.name;
  return (
    <button
      ref={lineRef}
      type="button"
      aria-label={`For ${who}, change audience`}
      aria-haspopup="dialog"
      aria-expanded={audience.open}
      onPointerDown={() => {
        wasOpen.current = audience.open;
      }}
      onClick={(e) => {
        // A keyboard press (detail 0) never carries a stale flag.
        const onlyClosed = e.detail > 0 && wasOpen.current;
        wasOpen.current = false;
        if (!onlyClosed) audience.onOpen();
      }}
      className="tap-44 mt-[5px] inline-flex max-w-full items-center gap-[5px] self-start px-1 text-ui leading-[22px] text-foreground-secondary hover:text-foreground md:mt-2 md:self-center"
    >
      <span className="min-w-0 truncate">
        For{" "}
        <span className="font-[560] text-foreground">{who}</span>
      </span>
      <ChevronIcon size={14} strokeWidth={2.2} aria-hidden className="shrink-0 rotate-90" />
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
 * always holds it.
 */
function MoneyRow({ amount, hint }: HomeMoney) {
  const rateGivesWay = amount.length > MONEY_RATE_FITS_CHARS;
  return (
    <Link
      href={EARN.href}
      aria-label={`${MONEY_MADE}: ${amount}. ${hint}`}
      className="flex h-12 w-full items-center gap-2 rounded-2xl bg-surface px-4 shadow-[var(--shadow-rest)] transition-shadow duration-150 hover:shadow-[var(--shadow-lift)] md:px-5"
    >
      <span className="min-w-0 truncate text-ui text-foreground-secondary">{MONEY_MADE}</span>
      <span className="shrink-0 whitespace-nowrap text-ui font-[640] tabular-nums text-foreground">{amount}</span>
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
  audience,
  audienceRef,
  money,
  opener,
  credits,
  field,
  under,
  onPickSkill,
  recent,
  onOpenThread,
  editOpen = false,
  onMore,
}: HomeScreenProps): React.JSX.Element {
  const recentId = useId();
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

        <AudienceLine audience={audience} lineRef={audienceRef} />

        {/* 14 under the audience line on a phone, 22 from md up (spec 2026-11-25 §2.4). Its place is
            always the fourth part of the column, so it is never remounted. */}
        <div className="mx-auto mt-3.5 w-full max-w-[720px] md:mt-[22px]">{field}</div>

        {under === "cards" && (
          // As wide as the field. `auto-rows-fr`: every row as tall as the tallest, so a caption
          // that wraps makes all the cards that tall (each cell stretches, each card fills it).
          // Six for an account the editor is open to (E3): Simulate, Edit, Hooks, Script, Remix, and More
          // as the sixth card, three by two from 760; else the four (no closed door, E11).
          <ul
            aria-label="Skills"
            className={cn(
              "mx-auto mt-3 grid w-full max-w-[720px] auto-rows-fr grid-cols-2 gap-2 @min-[760px]:mt-[18px] @min-[760px]:gap-4",
              editOpen ? "@min-[760px]:grid-cols-3" : "@min-[760px]:grid-cols-4",
            )}
          >
            {HOME_SKILLS.filter((skill) => skill.id !== "edit" || editOpen).map((skill) => (
              <li key={skill.id} className="flex">
                <SkillCard label={skill.label} line={skill.line} icon={ICON_BY_SKILL[skill.id]} onPick={() => onPickSkill(skill.id)} />
              </li>
            ))}
            {editOpen && (
              <li className="flex">
                <SkillCard label="More" line="Ideas, Explore, your account" icon={MoreIcon} popup onPick={() => onMore?.()} />
              </li>
            )}
          </ul>
        )}

        {under === "recent" && (
          // From md up as wide as the field, so a title and its time are not a page apart.
          <section aria-labelledby={recentId} className="mt-4 md:mx-auto md:mt-[26px] md:w-full md:max-w-[720px]">
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

        {money && (
          // Last, 12 above it, as wide as the field.
          <div data-part="money" className="mx-auto mt-3 w-full max-w-[720px]">
            <MoneyRow amount={money.amount} hint={money.hint} />
          </div>
        )}
      </div>
    </div>
  );
}
