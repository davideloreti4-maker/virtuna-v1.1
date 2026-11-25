/**
 * "How it's built" (spec 3.3): a video's stored beats, numbered,
 * and, when every beat is timed, its length and one bar cut at the beats in proportion. Beats stored
 * without times are listed without the bar and the length. Pure.
 */

/** A stored beat as the read hands it (the shape of `video.ts`'s `BeatInput`). */
interface Beat {
  name: string;
  startSec?: number | null;
  endSec?: number | null;
}

export interface BeatRow {
  /** From 1. */
  n: number;
  name: string;
  /** Its start, "0:12"; null when the beats are not timed. */
  at: string | null;
}

export interface BeatsView {
  /** The video's length by its last beat, "0:51"; null when not timed. */
  length: string | null;
  /** One share per beat, adding up to 1; null when not timed. */
  bar: number[] | null;
  rows: BeatRow[];
}

/** Whole seconds as m:ss: "0:00", "0:51", "1:05", "12:03". A negative or broken number is 0:00. */
export function clockWord(sec: number): string {
  const whole = Number.isFinite(sec) && sec > 0 ? Math.floor(sec) : 0;
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const isTime = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

interface Timed {
  name: string;
  start: number;
}

/**
 * The beats as timed, or null: every beat has a start (a finite number, 0 or more), the starts never
 * go down, and the last beat has an end past its own start.
 */
function timedOf(beats: readonly { name: string; startSec?: number | null }[], lastEnd: number | null | undefined): { beats: Timed[]; end: number } | null {
  const timed: Timed[] = [];
  for (const beat of beats) {
    if (!isTime(beat.startSec)) return null;
    const previous = timed[timed.length - 1];
    if (previous && beat.startSec < previous.start) return null;
    timed.push({ name: beat.name, start: beat.startSec });
  }
  const last = timed[timed.length - 1];
  if (!last || !isTime(lastEnd) || lastEnd <= last.start) return null;
  return { beats: timed, end: lastEnd };
}

/** The beats as the page draws them; null when no beat has a name (the card is not drawn). */
export function beatsView(beats: readonly Beat[]): BeatsView | null {
  const named = beats
    .map((beat) => ({ ...beat, name: typeof beat.name === "string" ? beat.name.replace(/\s+/g, " ").trim() : "" }))
    .filter((beat) => beat.name !== "");
  if (named.length === 0) return null;

  const timed = timedOf(named, named[named.length - 1]!.endSec);
  if (!timed) {
    return { length: null, bar: null, rows: named.map((beat, i) => ({ n: i + 1, name: beat.name, at: null })) };
  }

  const first = timed.beats[0]!.start;
  const span = timed.end - first;
  const bar = timed.beats.map((beat, i) => ((timed.beats[i + 1]?.start ?? timed.end) - beat.start) / span);
  return {
    length: clockWord(timed.end),
    bar,
    rows: timed.beats.map((beat, i) => ({ n: i + 1, name: beat.name, at: clockWord(beat.start) })),
  };
}
