"use client";

import type { Ref } from "react";

import type { FilmNotes } from "@/lib/thread-next/film-notes";
import { foldLead } from "@/lib/thread-next/first-sentence";
import type { RemixBeatRow, RemixFilm } from "@/lib/thread-next/remix-film";
import { cn } from "@/lib/utils";

import { PROSE, keepHyphens } from "./answer-card";
import { AnswerSheet } from "./answer-sheet";
import { MoreButton, useFold } from "./fold-more";

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
 * A remix's sheet (second part §4, `RemixFilmSheet`; drawn on the review page, `.d-sheet .shot`) is the
 * same sheet with the same rows: "Why the original worked" (folded with one "More" when long), your
 * beats, then the plan.
 *
 * Geometry as filmed: rows 10 / 11 with a hairline between them, none above the first, 4 under the
 * title; the name 13 / 18 at 640, the span 12 / 18, 8 apart on one baseline; the cue 14 / 20, 2 under.
 * A second paragraph is the same, 2 under, in the secondary ink (`.shot p + p`).
 */

const ROW = "border-t border-border px-0.5 pb-[11px] pt-2.5 first:border-t-0";

const TEXT = "mt-0.5 text-pretty text-reading leading-5";

type RowKind = "film-beat" | "film-plan" | "film-why" | "film-remix-beat";

function FilmRow({
  kind,
  name,
  span,
  text,
  sub,
  textRef,
  after,
}: {
  kind: RowKind;
  name: string | null;
  span?: string | null;
  text: string;
  /** A second paragraph under the text, in the secondary ink. */
  sub?: string | null;
  /** Given: the text takes the focus there (a fold just opened), so it is focusable from script. */
  textRef?: Ref<HTMLParagraphElement>;
  /** Under the paragraphs: a fold's "More". */
  after?: React.ReactNode;
}) {
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
      <p ref={textRef} tabIndex={textRef ? -1 : undefined} className={cn(TEXT, "text-foreground")}>
        {keepHyphens(text)}
      </p>
      {sub && <p className={cn(TEXT, "text-foreground-secondary")}>{keepHyphens(sub)}</p>}
      {after}
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

/**
 * "Why the original worked", folded as the hook's sheet folds its text (spec §4 point 1; `foldLead`,
 * the one fold rule): each of the two texts shows its lead, and one "More" under them opens both
 * whole, the focus moving to the first. Texts short enough show whole, with no "More".
 */
function WhyRow({ why }: { why: NonNullable<RemixFilm["why"]> }) {
  const { open, openFold, wholeRef } = useFold();
  const leadText = foldLead(why.text);
  const leadSub = why.sub ? foldLead(why.sub) : null;
  const folded = !open && (leadText !== null || leadSub !== null);
  return (
    <FilmRow
      kind="film-why"
      name="Why the original worked"
      text={folded ? (leadText ?? why.text) : why.text}
      sub={folded ? (leadSub ?? why.sub) : why.sub}
      textRef={open ? wholeRef : undefined}
      after={folded ? <MoreButton onOpen={openFold} className="mt-0.5 block text-reading leading-5" /> : null}
    />
  );
}

/** What is said, in curly quotes; quotes it already carries are not doubled (the remix card's headline too). */
export function quoted(text: string): string {
  return `“${text.trim().replace(/^["“]+|["”]+$/g, "")}”`;
}

/**
 * A beat row standing in while the beats are read: a row's frame with the look's ghost bars
 * (`.ghost-bar`, the answer outline's: a slow light passes over them, still under reduced motion), a
 * name bar 9 tall on its 18 line, then two lines of text, so the rows that replace it take about its
 * room.
 */
function FilmGhost() {
  return (
    <div aria-hidden="true" data-part="film-ghost" className={ROW}>
      <span className="flex h-[18px] items-center">
        <span className="ghost-bar block h-[9px] w-1/5 rounded-full" />
      </span>
      <span className="mt-0.5 flex h-5 items-center">
        <span className="ghost-bar block h-[11px] w-[88%] rounded-full" />
      </span>
      <span className="flex h-5 items-center">
        <span className="ghost-bar block h-[11px] w-3/5 rounded-full" />
      </span>
    </div>
  );
}

/**
 * A remix's "How to film it" (second part §4), in this order, a part with nothing to show leaving no
 * row: "Why the original worked" (the pattern in the ink, the turn under it in the secondary ink);
 * your version beat by beat (its name and span; what to say in quotes in the ink; the shot, what is on
 * screen and the repair as one paragraph under it in the secondary ink; a beat with no words has the
 * paragraph as its text); the plan. While the beats are read (`beats` "pending"): two ghost rows where
 * they will be, and the list is busy. Read and empty: no beat rows and no message.
 */
export function RemixFilmSheet({
  film,
  beats,
  open,
  onOpenChange,
  returnFocus,
}: {
  film: RemixFilm;
  /** "pending" while the read runs; then its rows (none when it found no beats or there was none to read). */
  beats: "pending" | readonly RemixBeatRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocus: HTMLElement | null;
}) {
  const pending = beats === "pending";
  return (
    <AnswerSheet open={open} onOpenChange={onOpenChange} title="How to film it" returnFocus={returnFocus}>
      <div className={cn("mt-1", PROSE)} aria-busy={pending ? true : undefined}>
        {film.why && <WhyRow why={film.why} />}
        {pending ? (
          <>
            <FilmGhost />
            <FilmGhost />
          </>
        ) : (
          beats.map((beat, i) => (
            <FilmRow
              key={`beat-${i}`}
              kind="film-remix-beat"
              name={beat.name}
              span={beat.span}
              text={beat.say ? quoted(beat.say) : (beat.notes ?? "")}
              sub={beat.say ? beat.notes : null}
            />
          ))
        )}
        {film.plan.map((row) => (
          <FilmRow key={row.label} kind="film-plan" name={row.label} text={row.text} />
        ))}
      </div>
    </AnswerSheet>
  );
}
