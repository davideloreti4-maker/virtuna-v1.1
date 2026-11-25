"use client";

import type { FilmNotes } from "@/lib/thread-next/film-notes";
import { cn } from "@/lib/utils";

import { PROSE, keepHyphens } from "./answer-card";
import { AnswerSheet } from "./answer-sheet";

/**
 * "How to film it" (thread depth spec §3.2; the step 2 film, `.scratch/next-look/part11/thread-ux/proto/index.html`,
 * `.sheet`, `.shot`): the script's filming notes in the look's own sheet (`AnswerSheet`: from the
 * bottom on a phone, a dialog from 768), opened from the script card's quiet button.
 *
 * - One row for each beat with a cue: its name, its span in the muted ink ("0 to 3 s"; none when the
 *   timing cannot be read), then the cue. A beat without a cue has no row (`filmNotesOf`).
 * - Then the plan's rows, the same kind: "Shots", "Text on screen", "Setup", and "Edit" when there.
 * - No button of its own: nothing in it costs anything. Closing hands the focus back to the card's
 *   button (`returnFocus`).
 *
 * Geometry as filmed: rows 10 / 11 with a hairline between them, none above the first, 4 under the
 * title; the name 13 / 18 at 640, the span 12 / 18, 8 apart on one baseline; the cue 14 / 20, 2 under.
 */

const ROW = "border-t border-border px-0.5 pb-[11px] pt-2.5 first:border-t-0";

function FilmRow({ kind, name, span, text }: { kind: "film-beat" | "film-plan"; name: string | null; span?: string | null; text: string }) {
  return (
    <section data-sheet={kind} className={ROW}>
      {(name || span) && (
        <div className="flex items-baseline gap-2">
          {name && <h3 className="text-meta font-[640] leading-[18px] text-foreground">{name}</h3>}
          {span && (
            <span data-part="film-span" className="text-label leading-[18px] text-foreground-muted tabular-nums">
              {span}
            </span>
          )}
        </div>
      )}
      <p className="mt-0.5 text-pretty text-reading leading-5 text-foreground">{keepHyphens(text)}</p>
    </section>
  );
}

export function FilmSheet({
  notes,
  open,
  onOpenChange,
  returnFocus,
}: {
  notes: FilmNotes;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The card's "How to film it": the sheet is not opened by a Radix trigger, so it hands focus back itself. */
  returnFocus: HTMLElement | null;
}) {
  return (
    <AnswerSheet open={open} onOpenChange={onOpenChange} title="How to film it" returnFocus={returnFocus}>
      {/* The beats' rows, then the plan's. */}
      <div className={cn("mt-1", PROSE)}>
        {notes.beats.map((beat, i) => (
          <FilmRow key={`beat-${i}`} kind="film-beat" name={beat.name} span={beat.span} text={beat.cue} />
        ))}
        {notes.plan.map((row) => (
          <FilmRow key={row.label} kind="film-plan" name={row.label} text={row.text} />
        ))}
      </div>
    </AnswerSheet>
  );
}
