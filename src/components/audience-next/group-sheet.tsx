"use client";

import { useCallback, useState } from "react";

import { AnswerSheet } from "@/components/thread-next/answer-sheet";
import type { PageGroup, Whose } from "@/lib/audience-next/audience-model";
import { AUDIENCE_STRINGS, groupCount, seenIn } from "@/lib/audience-next/audience-words";
import type { Archetype } from "@/lib/engine/wave3/persona-registry";

/**
 * One group of the audience (spec 3.3; the drawing's third phone frame), on the thread's details sheet
 * (`AnswerSheet`: a bottom sheet on a phone, the centred 560 dialog from 768, as the hook details):
 *
 *   Savers                                    the sheet's heading (the focus lands here on open)
 *   114 of 1,000 viewers
 *   “Saving this so I can read the details…”  the read's own line, as a quote
 *   How they judge a video / the text
 *   Seen in your numbers / the text           "their numbers" for another creator
 *
 * A part with no text is left out. Nothing here can be edited. Opened from a row or a wedge, not from a
 * trigger: the sheet hands the focus back to `returnFocus` itself.
 *
 * `useGroupSheet` is the state behind it, for the page's container (and the dev preview): which group is
 * looked at (the ring dims the rest, its row is tinted), and which group the sheet shows, kept while the
 * sheet leaves so its content does not empty during the exit.
 */

const S = AUDIENCE_STRINGS;

export interface GroupSheetProps {
  /** The group shown; null: nothing is drawn (no group was opened yet). */
  group: PageGroup | null;
  whose: Whose;
  open: boolean;
  onOpenChange(open: boolean): void;
  /** Where the focus goes when the sheet closes: the row that opened it, or null. */
  returnFocus: HTMLElement | null;
}

function Part({ name, label, text }: { name: string; label: string; text: string }) {
  return (
    <section data-group-part={name} className="px-0.5 pt-3.5">
      <h3 className="text-meta text-foreground-secondary">{label}</h3>
      <p className="mt-1 text-pretty break-words text-ui leading-[21px] text-foreground">{text}</p>
    </section>
  );
}

export function GroupSheet({ group, whose, open, onOpenChange, returnFocus }: GroupSheetProps) {
  if (!group) return null;
  return (
    <AnswerSheet open={open} onOpenChange={onOpenChange} title={group.name} returnFocus={returnFocus}>
      <p data-group-part="count" className="mt-0.5 px-0.5 text-ui text-foreground-secondary tabular-nums">
        {groupCount(group.count)}
      </p>
      {group.line && (
        <p data-group-part="line" className="mt-3.5 px-0.5 text-pretty break-words text-[17px] font-[560] leading-[23px] tracking-[-0.01em] text-foreground">
          {`“${group.line}”`}
        </p>
      )}
      {group.judge && <Part name="judge" label={S.judge} text={group.judge} />}
      {group.seen && <Part name="seen" label={seenIn(whose)} text={group.seen} />}
    </AnswerSheet>
  );
}

/** The selector of a group's row on the page (`GroupsCard`'s buttons carry `data-group-row`). */
const rowOf = (group: Archetype) => document.querySelector<HTMLElement>(`[data-group-row="${group}"]`);
/** "All 10", the way to a row not on screen yet (`GroupsCard` marks it). */
const allRows = () => document.querySelector<HTMLElement>("[data-all-groups]");

export interface GroupSheetState {
  /** The group looked at while its sheet is open: the ring dims the other nine. Null at rest. */
  focus: Archetype | null;
  /** A row (`from`, its button) or a wedge (`from` null): that group's sheet. */
  onPickGroup(group: Archetype, from: HTMLElement | null): void;
  /** GroupSheet's props but `whose`. */
  sheet: Omit<GroupSheetProps, "whose">;
}

/**
 * The sheet's state. Picking a group looks at it and opens its sheet; closing lights the whole ring again
 * at once, while the sheet keeps its group through the exit. The focus goes back to the row that opened
 * it; from a wedge, to that group's row when the row is on screen (the first four, or all ten once
 * opened), else to "All 10", the way to it.
 */
export function useGroupSheet(groups: readonly PageGroup[], initial: Archetype | null = null): GroupSheetState {
  const [focus, setFocus] = useState<Archetype | null>(initial);
  const [kept, setKept] = useState<Archetype | null>(initial);
  const [returnFocus, setReturnFocus] = useState<HTMLElement | null>(null);

  const onPickGroup = useCallback((group: Archetype, from: HTMLElement | null) => {
    setFocus(group);
    setKept(group);
    // From a wedge whose row is not on screen: "All 10", the way to it, rather than the top of the page.
    setReturnFocus(from ?? rowOf(group) ?? allRows());
  }, []);
  const onOpenChange = useCallback((open: boolean) => {
    if (!open) setFocus(null);
  }, []);

  const group = kept ? (groups.find((g) => g.group === kept) ?? null) : null;
  return { focus, onPickGroup, sheet: { group, open: focus !== null && group !== null, onOpenChange, returnFocus } };
}
