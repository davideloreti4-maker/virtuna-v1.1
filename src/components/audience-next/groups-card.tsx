"use client";

import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { ChevronIcon } from "@/components/thread-next/field-icons";
import { Card } from "@/components/ui/card";
import { GROUPS_FIRST, type PageGroup, type Whose } from "@/lib/audience-next/audience-model";
import { AUDIENCE_STRINGS, allGroups, shareOf } from "@/lib/audience-next/audience-words";
import type { Archetype } from "@/lib/engine/wave3/persona-registry";
import { cn } from "@/lib/utils";

/**
 * Groups (spec 3.2.6): "Groups" and, at its right, whose viewers the shares are of; a row per
 * group, largest share first: a dot, the group's name, under it the read's own line in quotes when it wrote
 * one, at the right the share as a whole percent. Four rows, then "All 10", which opens the rest in place
 * and leaves, with the focus on the fifth row (the first it brought). A row opens the group's sheet (the
 * container's), so it says it opens a dialog; the group whose sheet is open is tinted.
 */

const S = AUDIENCE_STRINGS;

export interface GroupsCardProps {
  groups: readonly PageGroup[];
  whose: Whose;
  focus: Archetype | null;
  onPick(group: Archetype, from: HTMLElement): void;
}

export function GroupsCard({ groups, whose, focus, onPick }: GroupsCardProps) {
  const headingId = useId();
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const [all, setAll] = useState(false);
  const shown = all ? groups : groups.slice(0, GROUPS_FIRST);

  const openAll = () => {
    flushSync(() => setAll(true));
    listRef.current?.querySelectorAll<HTMLButtonElement>("[data-group-row]")[GROUPS_FIRST]?.focus();
  };

  return (
    <Card className="px-4 pb-2 pt-1">
      <section aria-labelledby={headingId}>
        <div className="flex items-baseline justify-between gap-3 pb-1 pt-3">
          <h2 id={headingId} className="text-title font-[650] text-foreground">
            {S.groups}
          </h2>
          <span className="text-meta text-foreground-secondary">{shareOf(whose)}</span>
        </div>
        <ul ref={listRef} id={listId} className="divide-y divide-border">
          {shown.map((g) => (
            <li key={g.group}>
              {/* -mx/px: the tint and the focus ring get 8 of room either side; the text stays where drawn. */}
              <button
                type="button"
                aria-haspopup="dialog"
                data-group-row={g.group}
                onClick={(e) => onPick(g.group, e.currentTarget)}
                className={cn(
                  "-mx-2 flex w-[calc(100%+16px)] cursor-pointer items-start gap-3 rounded-xl px-2 py-3 text-left transition-colors duration-150",
                  "[@media(hover:hover)]:hover:bg-hover",
                  focus === g.group && "bg-hover",
                )}
              >
                <span aria-hidden className="mt-[8px] size-1.5 shrink-0 rounded-full bg-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-ui font-[630] leading-5 text-foreground">{g.name}</span>
                  {g.line && <span className="mt-0.5 block break-words text-meta text-foreground-secondary">{`“${g.line}”`}</span>}
                </span>
                <span className="shrink-0 text-ui font-bold leading-5 text-foreground tabular-nums">{`${g.percent}%`}</span>
              </button>
            </li>
          ))}
        </ul>
        {!all && groups.length > GROUPS_FIRST && (
          <button
            type="button"
            data-all-groups=""
            aria-expanded={false}
            aria-controls={listId}
            onClick={openAll}
            className="mb-1 mt-1 flex h-11 w-full items-center justify-between rounded-xl bg-surface-sunken px-3 text-ui font-[600] text-foreground transition-colors duration-150 [@media(hover:hover)]:hover:bg-active"
          >
            {allGroups(groups.length)}
            <ChevronIcon size={16} aria-hidden className="text-foreground-secondary" />
          </button>
        )}
      </section>
    </Card>
  );
}
