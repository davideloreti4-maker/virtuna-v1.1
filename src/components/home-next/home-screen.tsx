"use client";

import * as React from "react";
import { useId, useRef } from "react";
import Link from "next/link";

import type { ShellIcon } from "@/components/shell/icons";
import { DocIcon, LoopIcon, PenIcon, PulseIcon } from "@/components/thread-next/field-icons";
import { creditsLabel } from "@/components/thread-next/thread-field";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Home (spec 2026-11-23 §3; drawings `ax-p1.png`, `ax-p2.png`, `ax-d1.png`): what /home shows when
 * no chat is open. Presentational: the composer draws the field and hands it in, and the container
 * (`home-next.tsx`) reads the greeting's name, the chats and the sidebar's state.
 *
 *   phone                            desktop (beside the sidebar)
 *   avatar ··········· 30 credits    (no top row: the sidebar has both)
 *   Good morning, Nia.               Good morning, Nia.   (centred, a fifth down)
 *   the field                        the field, 720 wide
 *   the four skills, two by two      the four skills in one row (two by two under 760)
 *   More skills                      More skills (the More sheet: Ideas, Explore, Your account)
 *   Recent ············· Library     Recent only while the sidebar is the rail, as wide as the field
 *
 * Departures from the drawing (spec §6): a recent chat is its title and a time, no picture and no
 * second line; no Recent in the page on desktop while the sidebar lists the same chats.
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

export interface HomeRecentRow { id: string; title: string; when: string | null }

export interface HomeScreenProps {
  greeting: string | null;                   // null: not known yet (the profile is loading); the line holds its place
  avatar: string | null; initials: string;
  credits: number | null;                    // null: unlimited or not loaded, no pill
  field: React.ReactNode;                    // the field block
  picked: boolean;                           // a skill is picked: the cards are not shown
  onPickSkill(id: HomeSkillId): void;
  recent: HomeRecentRow[];
  onOpenThread(id: string): void;
  recentOnDesktop: boolean;                  // false while the sidebar lists the same chats
  onMore(): void;                            // "More skills": the More sheet (Ideas, Explore, Your account)
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

function RecentRow({ row, onOpen }: { row: HomeRecentRow; onOpen(id: string): void }) {
  // Named for the chat's title; when it was last written to is the description.
  const uid = useId();
  return (
    <li>
      <button
        type="button"
        aria-labelledby={`${uid}-title`}
        aria-describedby={row.when ? `${uid}-when` : undefined}
        onClick={() => onOpen(row.id)}
        className="flex min-h-[52px] w-full items-center gap-3 text-left"
      >
        <span id={`${uid}-title`} className="min-w-0 flex-1 truncate text-ui font-[560] text-foreground">
          {row.title}
        </span>
        {row.when && (
          <span id={`${uid}-when`} className="shrink-0 text-meta text-foreground-secondary">
            {row.when}
          </span>
        )}
      </button>
    </li>
  );
}

export function HomeScreen({
  greeting,
  avatar,
  initials,
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
          <Link href="/settings" aria-label="Account" className="tap-44 rounded-full">
            <Avatar src={avatar ?? undefined} alt="" fallback={initials} size="sm" className="h-9 w-9" />
          </Link>
          {credits !== null && (
            // The tag part, as the sidebar's balance is drawn; centred on the avatar ((36 - 24) / 2).
            <Badge data-part="credits" className="mb-1.5 tabular-nums">
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

        <div className="mx-auto mt-3 w-full max-w-[720px] md:mt-7">{field}</div>

        {!picked && (
          <>
            <ul className="mt-3 grid grid-cols-2 gap-2 @min-[760px]:mt-[18px] @min-[760px]:grid-cols-4 @min-[760px]:gap-4">
              {HOME_SKILLS.map((skill) => (
                <li key={skill.id} className="flex">
                  <SkillCard id={skill.id} label={skill.label} line={skill.line} onPick={pickSkill} />
                </li>
              ))}
            </ul>
            {/* Ideas, Explore and Your account: on Home otherwise only behind "/", which nobody
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
