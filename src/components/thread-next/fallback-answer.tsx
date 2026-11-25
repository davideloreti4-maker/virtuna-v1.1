"use client";

import { useId, useState } from "react";

import { firstSentence } from "@/lib/thread-next/first-sentence";
import { cn } from "@/lib/utils";

import { AnswerCard, PROSE, keepHyphens } from "./answer-card";
import { ChevronIcon } from "./field-icons";

/**
 * The fallback card (spec §4.6; drawing `.scratch/next-look/part3/answers/answers.html`, `axChat`,
 * `.card.ax-fb`): every block type the new renderer has no card of its own for, as a title and its
 * lines (`fallbackOf`). Three lines show; when there are more, "Show all" (a button that says
 * whether it is open) lists every line in place, and "Show less" folds them again. In a landing
 * (thread feel §4.3, `[data-thread-landing] .land`) the card comes in as one part, first (`--i` 0).
 *
 * Geometry as drawn: padding 16 / 18 / 4 (16 at the foot when there is no "Show all"); the title
 * 16 / 21 at 640 (drawn 15.5), each line 15 / 21 six under the last; "Show all" a 46 row 10 under
 * the lines with the hairline above it, 14 / 620, the chevron 15 in the muted ink.
 */

const SHOWN = 3;

export function FallbackAnswer({ title, lines }: { title: string; lines: string[] }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  // Folded, each line is its first sentence (stored composed answers are paragraphs); "Show all" also
  // appears when a shown line was shortened, and opens every line whole.
  const folded = lines.slice(0, SHOWN).map((line) => firstSentence(line) ?? line);
  const more = lines.length > SHOWN || folded.some((line, i) => line !== lines[i]!.trim());
  const shown = open ? lines : folded;

  return (
    <AnswerCard className={cn("land px-[18px] pt-4 md:px-[18px] md:pt-4", more ? "pb-1 md:pb-1" : "pb-4 md:pb-4")}>
      <p className={cn("text-title font-[640] leading-[21px] tracking-[-0.012em] text-foreground", PROSE)}>{title}</p>
      {shown.length > 0 && (
        <ul id={listId} className={cn("m-0 list-none p-0", PROSE)}>
          {shown.map((line, i) => (
            <li key={i} className="mt-1.5 text-pretty text-ui leading-[21px] text-foreground">
              {keepHyphens(line)}
            </li>
          ))}
        </ul>
      )}
      {more && (
        // The hairline sits on a wrapper so the button can be rounded: the focus ring follows its corners.
        <div className="mt-2.5 border-t border-border">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((o) => !o)}
            className="flex h-[45px] w-full cursor-pointer items-center justify-between rounded-xl text-reading font-[620] text-foreground"
          >
            <span>{open ? "Show less" : "Show all"}</span>
            <ChevronIcon
              size={15}
              strokeWidth={2.1}
              aria-hidden
              className={cn("shrink-0 text-foreground-muted motion-safe:transition-transform motion-safe:duration-150", open && "-rotate-90")}
            />
          </button>
        </div>
      )}
    </AnswerCard>
  );
}
