/**
 * film-notes.ts — what a script's "How to film it" sheet holds (thread depth spec §3.2), or null when
 * there is nothing to show (no beat with a `filming` cue and no `production`), and then the card has
 * no button.
 *
 * - One row for each beat with a cue, in the script's order: the beat's name (`beatName`), its span
 *   ("0 to 3 s", from `timing`; null when either end cannot be read or the end is before the start)
 *   and the cue. A beat without a cue has no row.
 * - Then the shoot plan, when the script has `production`: "Shots", "Text on screen", "Setup", and
 *   "Edit" when it is there. A row with nothing in it is left out.
 *
 * Pure: no React.
 */

import type { ScriptCardBlock } from "@/lib/tools/blocks";

import { beatName } from "./beat-name";
import { timingEnd, timingStart } from "./beat-timing";

type ScriptProps = ScriptCardBlock["props"];

export interface FilmBeat {
  /** The beat's name; null for an empty label (the row then shows no name). */
  name: string | null;
  /** "0 to 3 s"; null when the timing cannot be read. */
  span: string | null;
  cue: string;
}

export interface FilmNotes {
  beats: FilmBeat[];
  plan: { label: string; text: string }[];
}

/**
 * A beat's window in words, "0 to 3 s", or null when its start or its end cannot be read, or the end
 * comes before the start ("8 to 3 s" would read as a mistake of ours, not the model's).
 */
export function filmSpan(timing: string): string | null {
  const start = timingStart(timing);
  const end = timingEnd(timing);
  return start === null || end === null || end < start ? null : `${start} to ${end} s`;
}

export function filmNotesOf({ beats, production }: Pick<ScriptProps, "beats" | "production">): FilmNotes | null {
  const rows: FilmBeat[] = [];
  for (const beat of beats) {
    const cue = beat.filming?.trim();
    if (cue) rows.push({ name: beatName(beat.label), span: filmSpan(beat.timing), cue });
  }
  const plan = production
    ? [
        { label: "Shots", text: production.shots },
        { label: "Text on screen", text: production.onScreenText },
        { label: "Setup", text: production.setup },
        { label: "Edit", text: production.edit ?? "" },
      ]
        .map((row) => ({ label: row.label, text: row.text.trim() }))
        .filter((row) => row.text.length > 0)
    : [];
  return rows.length === 0 && plan.length === 0 ? null : { beats: rows, plan };
}
