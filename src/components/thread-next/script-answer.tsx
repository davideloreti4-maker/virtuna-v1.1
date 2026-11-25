"use client";

import { useState } from "react";

import { IconButton } from "@/components/ui/icon-button";
import type { ScriptCardBlock } from "@/lib/tools/blocks";
import { beatName } from "@/lib/thread-next/beat-name";
import { clockLabel, timingEnd, timingStart } from "@/lib/thread-next/beat-timing";
import { filmNotesOf } from "@/lib/thread-next/film-notes";
import { afterRows, landStyle, rowLand } from "@/lib/thread-next/landing";
import { cn } from "@/lib/utils";

import { AnswerCard, AnswerFoot, AnswerPrimary, CardHeader, PROSE, keepHyphens } from "./answer-card";
import { GaugeSlot, type GaugeState } from "./answer-gauge";
import { CheckIcon, CopyIcon, UploadIcon } from "./answer-icons";
import { WithFilmButton } from "./film-button";
import { FilmSheet } from "./film-sheet";
import { useCopyText } from "./sheet-actions";

/** The script as plain text: each beat's words, a blank line between beats, no times. */
export function scriptText(beats: readonly { content: string }[]): string {
  return beats
    .map((beat) => beat.content.trim())
    .filter((content) => content.length > 0)
    .join("\n\n");
}

/** The place of a script's last part in a landing: its button, after the last staggered beat. */
export function scriptLastLand(beatCount: number): number {
  return afterRows(beatCount);
}

/**
 * The script card (spec §4.3; drawing `.scratch/next-look/part3/answers/answers.html`, `axScript`,
 * `.tq-beat`, `.ax-b0`, `.ax-slot`): one card, the beats on a time rail.
 *
 * - Header "Script" and, when the last beat's timing has an end, the total ("0:24"), then Copy: the
 *   whole script as plain text, a blank line between beats, no times (`scriptText`). The script is
 *   what the creator takes away; without Copy the only way out was selecting it by hand (review
 *   2026-11-23). The icon is a check for a moment after, and "Copied" is announced.
 * - A beat: its start ("0:03") when its timing parses, else no time; the rail; its name (thread depth
 *   §3.1, `beatName`: the label as sent, "CTA" written "Call to action", an empty one draws nothing);
 *   its `content`. Copy takes the words only.
 * - Under the opening beat the slot "Simulate the opening" · "1 credit" (`GaugeSlot`): the text it
 *   simulates is `openingBeatSeed`, else the first beat's content (the text today's door fires and
 *   looks its seal up by). Simulated: the gauge with its number and "would stop to watch", a link to
 *   its result page once the thread and its key are known (step 2, `opener.href`).
 * - The one primary "Add your take" (upload icon, free, the arrow). Under it, only when the script
 *   has a beat with a filming cue or a shoot plan (`filmNotesOf`), the quiet "How to film it" (thread
 *   depth §3.2, `WithFilmButton`, shared with the remix card): it opens the look's sheet
 *   (`FilmSheet`), which hands the focus back to it on close.
 * - In a landing (thread feel §4.3, `[data-thread-landing] .land`): the beats come in one after another,
 *   then the button (with "How to film it"). The card itself takes its height at once.
 *
 * Geometry as drawn: rows 2 / 2 on a 28 · 3 · 1fr grid 10 apart; the time 12 / 21 in the muted ink
 * 6 down; the rail 3 wide on 13% of the ink; the text 15 / 21, 6 above and 8 under (the opening's
 * 2 under, then the 40 slot and 4). A named beat: the name 12 / 16 at 640 in the secondary ink takes
 * the 6 above and has 1 under, so it is 17 taller. "How to film it": see `WithFilmButton`. The
 * header's "Script" 14 / 640 in ink (`.tq-h b`).
 */
export function ScriptAnswer({
  block,
  opener,
  onAddTake,
}: {
  block: ScriptCardBlock;
  /** The opening's gauge; `href`, its result page once simulated and its key is known (step 2). */
  opener: { state: GaugeState; onSimulate?: () => void; href?: string | null };
  onAddTake?: () => void;
}) {
  const { beats, openingBeatSeed } = block.props;
  const last = beats[beats.length - 1];
  const end = last ? timingEnd(last.timing) : null;
  const openingText = openingBeatSeed || beats[0]?.content || "";
  const text = scriptText(beats);
  const { copied, copy } = useCopyText(text);
  // "How to film it": what its sheet holds (none: no button), whether it is open (null until the first
  // press), and the button it hands the focus back to.
  const notes = filmNotesOf(block.props);
  const [film, setFilm] = useState<boolean | null>(null);
  const [filmButton, setFilmButton] = useState<HTMLButtonElement | null>(null);
  const primary = (
    <AnswerPrimary icon={<UploadIcon size={20} aria-hidden className="shrink-0" />} label="Add your take" onClick={onAddTake} trailingArrow />
  );

  return (
    <AnswerCard>
      <CardHeader
        left={<b className="block text-reading font-[640] leading-[21px] text-foreground">Script</b>}
        right={
          <span className="flex items-center gap-1.5">
            {end !== null ? clockLabel(end) : null}
            {text.length > 0 && (
              <>
                {/* 32 on a 21 line: the negative margins keep the header's height as drawn. */}
                <IconButton surface="quiet" aria-label="Copy script" onClick={copy} className="-my-1.5 -mr-1.5 h-8 w-8">
                  {copied ? <CheckIcon aria-hidden data-part="copied-mark" /> : <CopyIcon aria-hidden />}
                </IconButton>
                <span role="status" className="sr-only">
                  {copied ? "Copied" : ""}
                </span>
              </>
            )}
          </span>
        }
      />
      <ol className="m-0 list-none p-0">
        {beats.map((beat, i) => {
          const start = timingStart(beat.timing);
          const name = beatName(beat.label);
          return (
            <li key={i} data-part="beat" className="land grid grid-cols-[28px_3px_minmax(0,1fr)] gap-x-2.5 p-0.5" style={landStyle(rowLand(i))}>
              <span data-part="time" className="pt-1.5 text-label leading-[21px] text-foreground-muted tabular-nums">
                {start !== null ? clockLabel(start) : ""}
              </span>
              <i aria-hidden className="block rounded-full bg-foreground/13" />
              <div className={cn("min-w-0", PROSE)}>
                {/* The 6 above the words moves above the name, so a named beat is 17 taller (16 + 1). */}
                {name && (
                  <p data-part="beat-name" className="pb-px pt-1.5 text-label font-[640] leading-4 text-foreground-secondary">
                    {name}
                  </p>
                )}
                <p className={cn("text-pretty text-ui leading-[21px] text-foreground", i === 0 ? "pb-0.5" : "pb-2", !name && "pt-1.5")}>
                  {keepHyphens(beat.content)}
                </p>
                {i === 0 && (
                  <GaugeSlot
                    state={opener.state}
                    label="Simulate the opening"
                    text={openingText}
                    onSimulate={opener.onSimulate}
                    href={opener.href ?? null}
                    className="mb-1"
                  />
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {/* A plain block: the footer's own top margin still sits between the beats and the button. The
          quiet "How to film it" comes in with it, as filmed. */}
      <div className="land" style={landStyle(scriptLastLand(beats.length))}>
        <AnswerFoot>
          {notes ? <WithFilmButton primary={primary} expanded={film === true} onOpen={() => setFilm(true)} buttonRef={setFilmButton} /> : primary}
        </AnswerFoot>
      </div>
      {/* Mounted from the first press on, so it can animate closed; a card never pressed carries none. */}
      {notes && film !== null && <FilmSheet notes={notes} open={film} onOpenChange={setFilm} returnFocus={filmButton} />}
    </AnswerCard>
  );
}
