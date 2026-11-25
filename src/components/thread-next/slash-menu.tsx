"use client";

import * as React from "react";
import { useId } from "react";

import type { ToolId } from "@/components/app/home/composer-controls";
import { DiscoverIcon, type ShellIcon } from "@/components/shell/icons";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { BulbIcon, DocIcon, LoopIcon, PenIcon, PersonIcon, PulseIcon } from "./field-icons";
import { MORE_SKILLS } from "./more-sheet";
import { creditsLabel } from "./thread-field";

/**
 * The "/" menu (new look, Home plan 2026-11-23): what typing "/" in the field offers. The
 * seven skills, as Home's cards and More's rows name them, each with its line and its price. No
 * heading, no group labels, no command hints. It replaces the legacy skill list under the flag;
 * flag off the legacy list stays.
 *
 * A Radix popover standing on the field's outer element (`anchorRef`): above the docked field in a
 * thread, below the field on Home (`side`). It never takes the focus, so typing goes on in the
 * field and filters the list (`query`, the text after "/"). It lives exactly as long as the text
 * starts with "/": a tap outside does not close it, and Escape and Enter are the composer's. Enter
 * takes the first listed row, which is marked (`data-enter`) and drawn as the highlighted one.
 */

export interface SlashSkill { id: ToolId; label: string; line: string; words: readonly string[] }

/** What "/" offers, in order: the four of Home's cards, then More's three. `words` are what a
 *  typed "/query" may start (the legacy commands among them, so "/test" and "/ideas" still land). */
export const SLASH_SKILLS: ReadonlyArray<SlashSkill> = [
  { id: "test", label: "Simulate", line: "See who keeps watching", words: ["simulate", "test", "video"] },
  { id: "hooks", label: "Hooks", line: "Openings for an idea", words: ["hooks"] },
  { id: "script", label: "Script", line: "A full script, timed", words: ["script"] },
  { id: "remix", label: "Remix", line: "Rebuild a proven video", words: ["remix"] },
  ...MORE_SKILLS.map((skill) => ({ ...skill, words: [skill.id === "idea" ? "ideas" : skill.id] })),
];

/** The skills a typed "/query" matches. "" matches all, in order. Otherwise the names that start
 *  with it come first, then those that only contain it: "/i" means Ideas, not the i in Simulate
 *  (Enter takes the first). */
export function slashMatches(query: string): SlashSkill[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...SLASH_SKILLS];
  const starts = (skill: SlashSkill) => skill.label.toLowerCase().startsWith(q) || skill.words.some((word) => word.startsWith(q));
  const hits = SLASH_SKILLS.filter((skill) => starts(skill) || skill.label.toLowerCase().includes(q));
  return [...hits.filter(starts), ...hits.filter((skill) => !starts(skill))];
}

const ICON_BY_SKILL: Partial<Record<ToolId, ShellIcon>> = {
  test: PulseIcon,
  hooks: PenIcon,
  script: DocIcon,
  remix: LoopIcon,
  idea: BulbIcon,
  explore: DiscoverIcon,
  account: PersonIcon,
};

export interface SlashMenuProps {
  query: string;                                  // the text after "/"
  onSelect(id: ToolId): void;
  priceOf(id: ToolId): number | null;
  anchorRef: React.RefObject<HTMLElement | null>; // the field's outer element
  side: "top" | "bottom";                         // a thread: top; Home: bottom
}

function SkillRow({
  skill,
  price,
  marked,
  onSelect,
}: {
  skill: SlashSkill;
  price: number | null;
  marked: boolean;
  onSelect(id: ToolId): void;
}) {
  // Named for the skill alone, so "tap Hooks" finds it; its line and its price are the
  // description (More's rows, final review 6).
  const id = useId();
  const Icon = ICON_BY_SKILL[skill.id] ?? BulbIcon;
  return (
    <button
      type="button"
      data-enter={marked ? "true" : undefined}
      aria-labelledby={`${id}-name`}
      aria-describedby={price != null ? `${id}-line ${id}-price` : `${id}-line`}
      // A press keeps the focus in the field's text: typing goes on there once a skill is picked.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onSelect(skill.id)}
      className={cn(
        "group/row flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors duration-150",
        marked ? "bg-surface-sunken" : "hover:bg-surface-sunken",
      )}
    >
      {/* More's icon disc. On the highlighted row (and a hovered one) it turns to the surface, so
          it stays a disc on the sunken fill instead of dissolving into it. */}
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors duration-150",
          marked ? "bg-surface" : "bg-surface-sunken group-hover/row:bg-surface",
        )}
      >
        <Icon size={18} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span id={`${id}-name`} className="block text-ui font-[560] text-foreground">{skill.label}</span>
        <span id={`${id}-line`} className="block text-meta text-foreground-secondary">{skill.line}</span>
      </span>
      {price != null && (
        <span id={`${id}-price`} className="shrink-0 text-meta text-foreground-secondary">
          {creditsLabel(price)}
        </span>
      )}
    </button>
  );
}

export function SlashMenu({ query, onSelect, priceOf, anchorRef, side }: SlashMenuProps): React.JSX.Element {
  const matches = slashMatches(query);
  const keep = (e: Event) => e.preventDefault();
  // A pick unmounts the menu. A row reached with Tab would take the focus with it, so it goes back
  // to the text (after a pointer press it never left).
  const pick = (id: ToolId) => {
    onSelect(id);
    anchorRef.current?.querySelector("textarea")?.focus();
  };
  return (
    <Popover open>
      <PopoverAnchor virtualRef={anchorRef as React.RefObject<HTMLElement>} />
      <PopoverContent
        side={side}
        align="start"
        sideOffset={10}
        collisionPadding={12}
        aria-label="Skills"
        // The field keeps the focus, on open and on close; a tap outside leaves the menu to the text.
        onOpenAutoFocus={keep}
        onCloseAutoFocus={keep}
        onInteractOutside={keep}
        className="z-[var(--z-modal)] max-h-[var(--radix-popover-content-available-height)] w-[360px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-4xl border-0 bg-surface p-2 text-foreground shadow-[var(--shadow-float)]"
      >
        {matches.length > 0 ? (
          matches.map((skill, i) => (
            <SkillRow key={skill.id} skill={skill} price={priceOf(skill.id)} marked={i === 0} onSelect={pick} />
          ))
        ) : (
          <p className="px-3 py-3 text-meta text-foreground-secondary">No skill by that name</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
