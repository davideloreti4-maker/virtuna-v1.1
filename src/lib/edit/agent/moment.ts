/**
 * moment.ts — the moment a request is about (E15). The creator paused the video on a film frame and wrote "zoom in here" or
 * "cut this part": code turns that frame into the things a creator can point at there (the word being said, its sentence,
 * the caption page on screen, the shot, the least stretch that cuts cleanly around it, what is showing), writes them as the
 * one `moment:` block the model reads above `request:`, holds a start or an end an answer set near the moment onto it
 * (`snapToMoment`), puts a thing added with the moment on it rather than on the film's first frame (`offTheStart`, S15, S16), makes
 * a zoom start on it (`zoomHere`: a split there and a push, so no cut lands in speech), and measures an answer against them for
 * the proof.
 *
 * One resolver, three readers: what the model is told, what code holds and what counts as landed are worked out here, from
 * the same `Moment`, so they cannot disagree. The model is given numbers to copy, never arithmetic to do: where it had to
 * find a moment and write a number itself, it was right about three times in four.
 *
 * Pure: the same moment for the same edit, and nothing it is given is changed. A frame is a film frame of the edit named
 * beside it; a take's moment is milliseconds of that take. A word is named by its index in the take; only the block writes
 * its text, as the context's `words` section does.
 */
import type { Analyses } from "../analysis";
import { assetOf, filmFrames, frameOf, framingAt, layout, momentAt, placed, runWords, type Layout, type Run } from "../derive";
import type { Adjust, Asset, Edit, Item, Mark, Shot, Word } from "../doc";
import { applyOps, type Op } from "../ops";
import { FPS, MIN_FRAMES, MIN_MARK_MS, frameAt, msOf } from "../time";
import { pagesFor } from "../../../edit/film/pages";
import { CUT_NEAR_MS, ZOOM, analysisOf, cleanCuts, isPush, pieceId, saidOf, toldOf, toldSentence, unquoted, zoomFor, type GaveWay } from "./context";

// `isPush` lives beside the zoom's search, which reads it (`context.ts`; this file imports that one, so it may not be imported
// back); it is named here with the zoom that makes the framing it tells.
export { isPush };

/** A start or an end within this many frames of the moment is the moment (`CUT_NEAR_MS`, one second). */
export const NEAR = frameAt(CUT_NEAR_MS, 1);
/** What counts as on the moment, in frames, for the snap's window and the proof's measure. */
export const ON = 3;
/** A word that ended this long ago or less is "just said" while nothing is being said. */
export const JUST_SAID_MS = 200;

/** In a take where no word ends a sentence, a silence this long between two words ends one: as a caption page breaks (`pages.ts`, 12 frames). */
const SILENCE_MS = 400;
/** A sentence's end at a word's end: the test `afterWord` (`context.ts`) uses. */
const SENTENCE_END = /[.!?]["”’']?$/;

/** The word a moment names: its index in the take, its stretch of the take, its film frames [from, to) in the run under the frame, and how it is there. */
export interface WordHere {
  index: number;
  startMs: number;
  endMs: number;
  from: number;
  to: number;
  how: "saying" | "just said" | "next" | "last";
}
/** Words `first` to `last` of the take, by index, on film frames [from, to). */
export interface Stretch {
  first: number;
  last: number;
  from: number;
  to: number;
}
/** A mark or an item placed on the frame, on film frames [from, to). `shot` is the shot a mark rides on; null for an item. */
export interface Showing {
  id: string;
  part: string;
  kind: "mark" | "item";
  shot: string | null;
  from: number;
  to: number;
}
export interface Moment {
  /** The paused film frame (`at`). */
  frame: number;
  /** The film's length in frames. */
  frames: number;
  /** The shot under the frame (`momentAt`: in a transition, the one coming in), its file, and the moment of that file there. */
  shot: string;
  take: string;
  ms: number;
  /** The word the moment names; null where the take says nothing (a picture). */
  word: WordHere | null;
  /** Where something new "here" starts: the word's first frame while it is being said, else the paused frame. */
  start: number;
  /** The take's moment on `start`, and the shot whose stretch of the take holds it: what a mark there is given. */
  startMs: number;
  startShot: string;
  /** The sentence of `word`; null when `word` is. */
  sentence: Stretch | null;
  /** The caption page on screen; null with the captions off or none on screen. */
  page: Stretch | null;
  /** The least that cuts cleanly around the frame: between the clean cuts either side of it, in film frames and in the film ms `time.cut` takes. */
  part: { from: number; to: number; fromMs: number; toMs: number; words: { first: number; last: number } | null; sentences: number };
  /** Every mark and item placed on the frame, in `placed` order. */
  showing: Showing[];
}

/* ── the moment ───────────────────────────────────────────────────────────────────────────────── */

/** The words of a file of the edit: a clip's, none for a picture, a sound or a file that is not there. */
function wordsOf(edit: Edit, id: string): Word[] {
  const asset = assetOf(edit, id);
  return asset?.kind === "video" ? (asset.words ?? []) : [];
}

/** The film frames [from, to) a stretch of a run's file is said on, held inside the run and one frame at least, as `runWords` holds a word. */
function framesOf(run: Run, startMs: number, endMs: number): { from: number; to: number } {
  const from = Math.min(run.frames - 1, Math.max(0, frameAt(startMs - run.fromMs, run.speed)));
  return { from: run.at + from, to: run.at + Math.min(run.frames, Math.max(from + 1, frameAt(endMs - run.fromMs, run.speed))) };
}

/**
 * The word under a moment `ms` of a run, among the take's words in that run (hidden ones count: they are said): the one being
 * said; else the last that ended at most `JUST_SAID_MS` before; else the next whose start lies inside the run; else the run's
 * last that ended before. Null where the run holds no word.
 */
function wordHere(words: readonly Word[], run: Run, ms: number): WordHere | null {
  const inRun = words.flatMap((word, index) => (word.endMs > run.fromMs && word.startMs < run.toMs ? [{ word, index }] : []));
  const named = (how: WordHere["how"], found: { word: Word; index: number } | undefined): WordHere | null =>
    found ? { index: found.index, startMs: found.word.startMs, endMs: found.word.endMs, ...framesOf(run, found.word.startMs, found.word.endMs), how } : null;
  const saying = inRun.find(({ word }) => word.startMs <= ms && ms < word.endMs);
  if (saying) return named("saying", saying);
  const ended = inRun.findLast(({ word }) => word.endMs <= ms);
  if (ended && ms - ended.word.endMs <= JUST_SAID_MS) return named("just said", ended);
  const next = inRun.find(({ word }) => word.startMs > ms && word.startMs < run.toMs);
  return named(next ? "next" : "last", next ?? ended);
}

/**
 * Each word's sentence, numbered from 0 in the take's order: a new one after each word whose text ends a sentence; in a take
 * where none does, after each silence of `SILENCE_MS` or more.
 */
function sentenceIds(words: readonly Word[]): number[] {
  const marked = words.some((word) => SENTENCE_END.test(word.text));
  let id = 0;
  return words.map((word, i) => {
    const before = words[i - 1];
    if (before && (marked ? SENTENCE_END.test(before.text) : word.startMs - before.endMs >= SILENCE_MS)) id++;
    return id;
  });
}

/** The sentence of word `index`, its frames held inside the run under the frame. */
function sentenceOf(words: readonly Word[], ids: readonly number[], index: number, run: Run): Stretch | null {
  const [first, last] = [ids.indexOf(ids[index] ?? -1), ids.lastIndexOf(ids[index] ?? -1)];
  const [a, b] = [words[first], words[last]];
  return a && b ? { first, last, ...framesOf(run, a.startMs, b.endMs) } : null;
}

/**
 * The caption page on screen on a frame of a run: the page of `pagesFor` whose frames hold it. `runWords` drops the hidden
 * words and the index; the indexes of the words it keeps are kept here by the same rule, so a page's words are named by order.
 */
function pageOn(edit: Edit, run: Run, frame: number): Stretch | null {
  if (!edit.captions.on) return null;
  const kept = wordsOf(edit, run.asset).flatMap((word, index) => {
    const middle = (word.startMs + word.endMs) / 2;
    return word.hidden || middle < run.fromMs || middle >= run.toMs ? [] : [index];
  });
  let before = 0;
  for (const page of pagesFor(edit.captions, runWords(edit, run), run.frames)) {
    const [first, last] = [kept[before], kept[before + page.words.length - 1]];
    if (first !== undefined && last !== undefined && page.from <= frame - run.at && frame - run.at < page.to) return { first, last, from: run.at + page.from, to: run.at + page.to };
    before += page.words.length;
  }
  return null;
}

/**
 * The least that cuts cleanly around a frame: from the clean cut at or before its film time to the next after it
 * (`cleanCuts`); its words, those of the take whose middle lies there on the film (by the arithmetic `cleanCuts` places a
 * cut@ with), and how many sentences they touch.
 */
function partAround(edit: Edit, analyses: Analyses, lay: Layout, take: string, ids: readonly number[], frame: number): Moment["part"] {
  const cuts = cleanCuts(edit, analyses);
  const film = msOf(frame, 1);
  const [fromMs, toMs] = [cuts.filter((cut) => cut.film <= film).at(-1)?.film ?? 0, cuts.find((cut) => cut.film > film)?.film ?? msOf(lay.frames, 1)];
  const words = wordsOf(edit, take);
  const said = new Set<number>();
  edit.shots.forEach((shot, i) => {
    if (shot.asset !== take) return;
    const startOf = msOf(lay.shots[i]?.at ?? 0, 1);
    words.forEach((word, index) => {
      const middle = (word.startMs + word.endMs) / 2;
      const at = startOf + (middle - shot.startMs) / shot.speed;
      if (middle >= shot.startMs && middle < shot.endMs && at >= fromMs && at < toMs) said.add(index);
    });
  });
  const indexes = [...said].sort((a, b) => a - b);
  const [first, last] = [indexes[0], indexes.at(-1)];
  return {
    from: frameAt(fromMs, 1), to: frameAt(toMs, 1), fromMs: Math.round(fromMs), toMs: Math.round(toMs),
    words: first !== undefined && last !== undefined ? { first, last } : null,
    sentences: new Set(indexes.map((index) => ids[index])).size,
  };
}

/** The shot of a run whose stretch of the take holds `ms`: the last of its shots that has started by then. */
function shotHolding(edit: Edit, run: Run, ms: number): string {
  let id = edit.shots[run.first]?.id ?? "";
  for (let i = run.first; i <= run.last; i++) {
    const shot = edit.shots[i];
    if (shot && shot.startMs <= ms) id = shot.id;
  }
  return id;
}

/** The paused frame resolved into named things; null when `at` is no frame of the film. */
export function momentFor(edit: Edit, analyses: Analyses, at: number): Moment | null {
  const here = Number.isInteger(at) ? momentAt(edit, at) : null;
  if (!here) return null;
  const lay = layout(edit);
  const index = edit.shots.findIndex((shot) => shot.id === here.shot);
  const [shot, run] = [edit.shots[index], lay.runs[lay.shots[index]?.run ?? -1]];
  if (!shot || !run) return null;
  const words = wordsOf(edit, shot.asset);
  const ids = sentenceIds(words);
  const word = wordHere(words, run, here.ms);
  const saying = word !== null && word.how === "saying";
  // While a word is being said, its first frame is as right as the paused frame: something new starts with the word.
  const startMs = saying ? Math.max(word.startMs, run.fromMs) : here.ms;
  return {
    frame: at, frames: lay.frames, shot: shot.id, take: shot.asset, ms: here.ms, word,
    start: saying ? word.from : at, startMs, startShot: shotHolding(edit, run, startMs),
    sentence: word ? sentenceOf(words, ids, word.index, run) : null,
    page: pageOn(edit, run, at),
    part: partAround(edit, analyses, lay, shot.asset, ids, at),
    showing: placed(edit).flatMap((place) => (place.at <= at && at < place.at + place.frames ? [{ id: place.thing.id, part: place.thing.part, kind: place.shot === null ? "item" : "mark", shot: place.shot, from: place.at, to: place.at + place.frames } satisfies Showing] : [])),
  };
}

/**
 * The moment found again in `edit` by its take moment, the file and its ms (S11): a moment is the take's, and its film frame is
 * only where a film shows it. The frame that shows `moment.take` at `moment.ms` (on the moment's own shot first, while the edit
 * has it), resolved as `momentFor` resolves a paused frame. Null where the edit does not show that moment as itself: cut out,
 * or under another shot coming in. On the edit the moment was taken on, it is that moment.
 */
export function momentAgain(edit: Edit, analyses: Analyses, moment: Moment): Moment | null {
  const shots = [...edit.shots].sort((a, b) => Number(b.id === moment.shot) - Number(a.id === moment.shot));
  for (const shot of shots) {
    const frame = shot.asset === moment.take ? frameOf(edit, shot.id, moment.ms) : null;
    const again = frame === null ? null : momentFor(edit, analyses, frame);
    // Within a frame of the take: the frame's own moment is rounded to it.
    if (again && again.take === moment.take && Math.abs(again.ms - moment.ms) < msOf(1, shot.speed)) return again;
  }
  return null;
}

/* ── what the model reads ─────────────────────────────────────────────────────────────────────── */

/**
 * The block's first line, in plain words (S13 a): the creator paused on this moment, so a thing with a place that names no other
 * place goes here, and a change to the whole film stays one. Paused at 0:05, a title asked for "here" came back at the film's
 * start, its words holding "here". In the block, so that the system prompt stays byte for byte.
 */
const PAUSED_HERE = "The creator paused the video here, and the request is about this moment: a title, call-out, cutaway or sound added, a zoom or a cut that names no other place goes here; a change to the whole film (how the captions look, the film's look, its length, its pace) stays a change to the whole film.";
/** The block's reading guide, after its first numbers. */
const GUIDE = 'In the request, "here", "now" and "this" are this frame; "this word", "this sentence", "this part" and what is "showing" are the lines below. say tells it as "here" or by what is said there, never as a frame or a time.';

/** The request points at the paused frame: "here", "now", or "this" not followed by a word for the whole film. Quoted text does not count. English only. */
const POINTING = /\b(?:here|now)\b|\bthis\b(?!\s+(?:whole\s+)?(?:video|clip|film|edit)\b)/i;
export const pointsAt = (request: string): boolean => POINTING.test(unquoted(request));

/** The word line: what is said on the frame, by index, text and stretch of the take, as the `words` section writes a word. */
function wordLine(word: WordHere | null, words: readonly Word[]): string {
  if (!word) return "word: none; nothing is said here.";
  const said = `w${word.index} ${words[word.index]?.text ?? ""} [${word.startMs},${word.endMs})`;
  switch (word.how) {
    case "saying":
      return `word ${said} film=[${word.from},${word.to})f, being said.`;
    case "just said":
      return `word ${said} film=[${word.from},${word.to})f, just said; none is being said.`;
    case "next":
      return `word: none is being said; the next is ${said}, from frame ${word.from}.`;
    case "last":
      return `word: none is being said; the last before it is ${said}.`;
  }
}

/**
 * One thing showing, and, when `ends` (`endsAsked`), the number that ends it on the frame: `frames` for an item counted from the
 * film's start, `lenMs` (film time) for a mark, each at least what the door takes. An item counted back from the film's end gets
 * none. Offered to a request that asks for no ending, the model ended the first cut's title on the moment, unasked (S17 (4), I3).
 */
function showingLine(thing: Showing, frame: number, edit: Edit, offered: boolean): string {
  const shown = frame - thing.from;
  const ends = !offered ? null : thing.kind === "mark"
    ? `"lenMs":${Math.max(MIN_MARK_MS, Math.round(msOf(shown, 1)))}`
    : edit.items.find((item) => item.id === thing.id)?.anchor === "start" ? `"frames":${Math.max(MIN_FRAMES, shown)}` : null;
  return `${thing.kind} ${thing.id} ${thing.part} film=[${thing.from},${thing.to})f${ends ? `, to end it on this frame ${ends}` : ""}`;
}

/**
 * The zoom's line: what `shot.zoom` on the shot under the moment does here (`zoomHere`, as far as `ZOOM.most`), or why it
 * cannot, in `zoomFor`'s words. It says where the zoom starts, whether the code splits the shot for it and pushes in or punches
 * in, and up to which frame:
 *
 *   zoom: shot.zoom on s1 starts on this frame; the code splits the shot here and pushes in until frame 66, the next cut; up to 1.3
 */
function zoomLine(moment: Moment, edit: Edit, analyses: Analyses): string {
  const made = zoomHere(edit, analyses, moment, ZOOM.most, false, []);
  if ("none" in made) return `zoom: none here: ${made.none}`;
  const set = made.ops.at(-1);
  const id = set?.op === "shot.set" ? set.id : moment.shot;
  const push = set?.op === "shot.set" && set.framing?.move != null;
  // A piece ends at the sentence's end when the code split it there; the start's split, if any, is of the shot under the moment.
  const until = made.ops.some((op) => op.op === "shot.split" && op.id === id) ? "the end of the sentence" : made.last + 1 >= moment.frames ? "the film's end" : "the next cut";
  const starts = Math.abs(made.first - moment.frame) <= ON ? "starts on this frame" : `starts at frame ${made.first}, where the shot starts`;
  return `zoom: shot.zoom on ${moment.shot} ${starts}; the code ${id !== moment.shot ? "splits the shot here and " : ""}${push ? "pushes in" : "punches in"} until frame ${made.last + 1}, ${until}; up to ${made.to}`;
}

/**
 * The lines under "moment:", without the heading: what the moment is for, in plain words, then the moment in the units each
 * operation takes, and what each anchor is. `ends`: the numbers that end what is showing are offered (`endsAsked`).
 */
export function momentBlock(moment: Moment, edit: Edit, analyses: Analyses, ends: boolean): string {
  const { word, sentence, page, part, showing } = moment;
  const span = (stretch: { first: number; last: number }): string => `w${stretch.first}-w${stretch.last}`;
  const film = (stretch: { from: number; to: number }): string => `film=[${stretch.from},${stretch.to})f`;
  return [
    PAUSED_HERE,
    `paused frame=${moment.frame} of film ${moment.frames}f: shot ${moment.shot} at ${moment.ms} ms of take ${moment.take}. ${GUIDE}`,
    `${wordLine(word, wordsOf(edit, moment.take))} New here as a mark: "shot":"${moment.startShot}","atMs":${moment.startMs}; as an item: "anchor":"start","at":${moment.start}.`,
    sentence ? `sentence ${span(sentence)} ${film(sentence)}` : "sentence: none",
    page ? `page ${span(page)} ${film(page)}` : "page: no captions on screen",
    `part ${film(part)}${part.words ? ` ${span(part.words)}:` : ", no words:"} the least that cuts cleanly around this frame${part.sentences > 1 ? `; it holds ${part.sentences} sentences` : ""}; for time.cut "fromMs":${part.fromMs},"toMs":${part.toMs}`,
    zoomLine(moment, edit, analyses),
    showing.length > 0 ? `showing: ${showing.map((thing) => showingLine(thing, moment.frame, edit, ends)).join("; ")}` : "showing: nothing but the footage and the captions",
  ].join("\n");
}

/* ── what code holds ──────────────────────────────────────────────────────────────────────────── */

/** The parts a request makes appear on a moment. */
const APPEARS: ReadonlySet<string> = new Set(["title", "callout", "cutaway", "sound"]);

/** True when the answer set the thing's own length: an item's `frames`, a mark's `lenMs` (a cut that only shortens what shows sets neither). */
const lengthSet = (was: Mark | Item, is: Mark | Item): boolean =>
  "anchor" in was && "anchor" in is ? was.frames !== is.frames : !("anchor" in was) && !("anchor" in is) && was.lenMs !== is.lenMs;

/**
 * H1 and H2: a start or an end the answer set within NEAR frames of the moment, put on it. Ops for the door; none when nothing is near.
 *
 * `was` is the edit the answer's ops are applied to, `edit` the one they made, `moment` the moment the request points at, of the
 * edit as handed in or any edit of the same take. The block gives the model the numbers to copy; an answer that still lands
 * near the moment but not on it is held on it in code, and one further off is left, where the creator named another place.
 * The moment is the take's (S11): it is found again in `was` and in `edit` (`momentAgain`), so an answer that also cut before
 * it is held against the frames of the film it made, and one that cut the moment out holds nothing. Below, start, frame,
 * startMs and startShot are the moment's in `edit`.
 * - Starts (H1): each title, call-out, cutaway or sound the answer made appear (placed in `edit`, its id not placed in `was`)
 *   whose first frame lies outside [start − ON, frame + ON] and within NEAR of [start, frame] starts on `start`: a mark on
 *   `startShot` at `startMs`; a mark on another shot taken off it and put on `startShot`, with its id (a mark cannot change
 *   shots); an item from `start`, counted from the film's start.
 * - Ends (H2): each thing placed on the moment's frame in `was` whose own length the answer set, which still starts by the
 *   frame and now ends more than ON and at most NEAR from it, ends on it: an item counted from the film's start by its
 *   `frames`, a mark by its `lenMs` (film time), each at least what the door takes (S9, as the block writes them). Only with
 *   `ends`: the loop holds an end only for a request that points (S17 (2)), a start for any about the moment.
 * `says` is empty: the model's sentence already says "here".
 */
export function snapToMoment(was: Edit, edit: Edit, moment: Moment, analyses: Analyses, ends = true): { ops: Op[]; says: string[] } {
  const [then, here] = [momentAgain(was, analyses, moment), momentAgain(edit, analyses, moment)];
  if (!here) return { ops: [], says: [] };
  const [before, after] = [placed(was), placed(edit)];
  const had = new Set(before.map((place) => place.thing.id));
  const ops: Op[] = [];
  for (const { thing, shot, at } of after) {
    // How far its first frame lies outside [start, frame]; 0 or less inside it.
    const off = at < here.start ? here.start - at : at - here.frame;
    if (!APPEARS.has(thing.part) || had.has(thing.id) || off <= ON || off > NEAR) continue;
    if ("anchor" in thing) ops.push({ op: "item.set", id: thing.id, anchor: "start", at: here.start });
    else if (shot === here.startShot) ops.push({ op: "mark.set", id: thing.id, atMs: here.startMs });
    else ops.push({ op: "mark.remove", id: thing.id }, { op: "mark.add", shot: here.startShot, mark: { ...thing, atMs: here.startMs } });
  }
  // What showed on the moment in `was`: nothing when `was` did not show the moment, or when no end is to be held.
  const showing = then && ends ? before.filter((place) => place.at <= then.frame && then.frame < place.at + place.frames) : [];
  for (const old of showing) {
    const is = after.find((place) => place.thing.id === old.thing.id);
    if (!is || is.at > here.frame || is.frames === old.frames || !lengthSet(old.thing, is.thing)) continue;
    const off = Math.abs(is.at + is.frames - here.frame);
    if (off <= ON || off > NEAR) continue;
    const shown = here.frame - is.at;
    if (!("anchor" in is.thing)) ops.push({ op: "mark.set", id: is.thing.id, lenMs: Math.max(MIN_MARK_MS, Math.round(msOf(shown, 1))) });
    else if (is.thing.anchor === "start") ops.push({ op: "item.set", id: is.thing.id, frames: Math.max(MIN_FRAMES, shown) });
  }
  return { ops, says: [] };
}

/* ── a thing added with a moment (S15, S16) ───────────────────────────────────────────────────── */

/** Words that name a place of the film other than the paused moment: its start (S15, S16), its end, or the whole film (S17). */
const PLACE_WORDS = /\b(?:start|beginning|begin|opening|intro|hook|first|opener|top|end|ending|outro|last|final|finish|whole|entire|all|every|everywhere|throughout|each|always)\b/i;
/** A time in the film: "0:07", "7s", "1.5s", "7 sec", "7 seconds", "second 7". */
/** A time as a place in the film (I2): a clock's ("0:07"), or one after at, from, to or until ("at 7s", "from second 7"). A length ("for 3 seconds") is none. */
const TIME = /\b\d+:\d{2}\b|\b(?:at|from|to|until)\s+(?:second\s+\d+\b|\d+(?:\.\d+)?\s?(?:s|secs?|seconds?)\b)/i;
/** Where the text a request asks to have written begins: its first colon that is no clock's, or a word that brings the text in. */
const WRITTEN = /(?<!\d):|:(?!\d)|\b(?:says|saying|reads|reading|called|titled)\b/i;

/**
 * A request without the text it asks to have written, which says nothing of where (I2: "Add a title: Top 3 tips" is a title with
 * those words, not a title at the top): its quoted text, what follows its first colon that is not a clock's, and what follows
 * says, saying, reads, reading, called or titled. "Add a hook title at the start: New drop" keeps "at the start".
 */
function placeWords(request: string): string {
  const words = unquoted(request);
  const at = words.search(WRITTEN);
  return at < 0 ? words : words.slice(0, at);
}

/**
 * The request names another place than the moment (S17 (1)), the one test every code move here asks: the start, the end, the
 * whole film, or a time as a place. Whole words, any case, in the request without the text it asks to have written
 * (`placeWords`). A request with a moment that names none is about the moment, "here" or not: the tag is the pointer.
 */
export function namesAnotherPlace(request: string): boolean {
  const words = placeWords(request);
  return PLACE_WORDS.test(words) || TIME.test(words);
}

/** Words that ask for something to end (I3). */
const ENDING = /\b(?:end|ends|ending|stop|stops|until|hide|remove|off)\b/i;
/**
 * The block offers the numbers that end what is showing on the moment (I3): only to a request that points and names an ending,
 * outside the text it asks to have written. Offered to any request that points, the model ended the first cut's title on the
 * moment unasked in 2 of 6 runs of the page's own "here" requests ("Zoom in less here.", "Keep only one title here."), as it had
 * in 4 of 6 controls with no pointing word (S17 (4)).
 */
export const endsAsked = (request: string): boolean => pointsAt(request) && ENDING.test(placeWords(request));

/** A part's plain name, as the code's line writes it. */
const PART_NAME: Record<string, string> = { title: "the title", callout: "the call-out", cutaway: "the clip", sound: "the sound" };

/** The fewest film frames the door takes for an item, and a mark's least length in film frames. */
const LEAST = { item: MIN_FRAMES, mark: frameAt(MIN_MARK_MS, 1) } as const;

/** A film frame as the moment's tag writes it ("0:05"): whole seconds, as `momentLabel` (the page) does. */
function clockOf(frame: number): string {
  const seconds = Math.floor(frame / FPS);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * S15: a thing added with a moment does not fall back to the film's start. The tag is the pointer (S13): paused at 0:05, "Add
 * a title: New drop" came back twice as a title on the film's first frames, the second time with the block's first line saying
 * it goes here. So, on the answer's ops after the moves and before the door: each title, call-out, cutaway or sound the answer
 * ADDS (a mark or an item; not one the edit had) with a length of its own (S16: an item with no `frames` runs to the film's end,
 * as a bed of music or an overlay over everything does, and is left), whose start the model left on the film's first frame (an
 * item from the start at frame 0, a mark at the first moment of the film's first shot), starts on the moment instead, unless the
 * request names another place (`namesAnotherPlace`, S17: the start, the end, the whole film, a time) or the moment is there already. The moment is the take's (S11): found again in the film
 * the answer makes, and there written as the hold writes a start (an item counted from the start on `start`; a mark on
 * `startShot` at `startMs`, moved there with its id when it rode another shot). Its length is the model's, cut at the film's
 * end and never under what the door takes; a moment closer to the end than that least puts the start that much before the end
 * (S16), so nothing is left past it. Placed anywhere else, a thing is left where the model put it. Nothing moves when the door
 * would refuse the answer (it says why) or the answer cut the moment out.
 *
 * Returns the ops with the moves after them, and the ids of what was moved: the creator then reads the code's sentence of the
 * answer (`startedSay`), not the model's, which may say "at the start".
 */
export function offTheStart(edit: Edit, ops: readonly unknown[], moment: Moment, analyses: Analyses, request: string, library: readonly Asset[]): { ops: unknown[]; moved: string[] } {
  const unmoved = { ops: [...ops], moved: [] };
  if (namesAnotherPlace(request)) return unmoved;
  const tried = applyOps(edit, ops, library);
  if (!tried.ok) return unmoved;
  const here = momentAgain(tried.edit, analyses, moment);
  // On the moment already when the creator paused at the film's start.
  if (!here || here.start - ON <= 0) return unmoved;
  const had = new Set(thingsOf(edit).map((thing) => thing.id));
  const film = filmFrames(tried.edit);
  const moves: Op[] = [];
  const moved: string[] = [];
  for (const { thing, shot, at } of placed(tried.edit)) {
    if (at !== 0 || !APPEARS.has(thing.part) || had.has(thing.id)) continue;
    if ("anchor" in thing) {
      if (thing.anchor !== "start" || thing.frames === null) continue;
      const start = Math.max(0, Math.min(here.start, film - LEAST.item));
      const frames = Math.max(MIN_FRAMES, Math.min(thing.frames, film - start));
      moves.push({ op: "item.set", id: thing.id, at: start, ...(frames !== thing.frames ? { frames } : {}) });
    } else {
      const start = Math.max(0, Math.min(here.start, film - LEAST.mark));
      // On the moment's start, the take's moment the hold gives a mark; nearer the end, the one the film shows on that frame.
      const on = start === here.start ? { shot: here.startShot, ms: here.startMs } : momentAt(tried.edit, start);
      if (!on) continue;
      const lenMs = Math.max(MIN_MARK_MS, Math.min(thing.lenMs, Math.round(msOf(film - start, 1))));
      const length = lenMs !== thing.lenMs ? { lenMs } : {};
      if (shot === on.shot) moves.push({ op: "mark.set", id: thing.id, atMs: on.ms, ...length });
      else moves.push({ op: "mark.remove", id: thing.id }, { op: "mark.add", shot: on.shot, mark: { ...thing, atMs: on.ms, ...length } });
    }
    moved.push(thing.id);
  }
  return moved.length === 0 ? unmoved : { ops: [...ops, ...moves], moved };
}

/**
 * The code's sentence for an answer in which `offTheStart` moved things (S15, S16): where each starts in the film the answer
 * made, read back from it ("The title is on at 0:01"; things that start on one second in one clause), then what `saidOf` tells
 * of the rest of the answer, the moved things left out, as one answer: "The title is on at 0:01; the captions are bigger."
 * `was` is the edit the answer was made on, `edit` the one it made, `gave` as for `saidOf`.
 */
export function startedSay(was: Edit, edit: Edit, moved: readonly string[], gave: readonly GaveWay[] = []): string {
  const ids = new Set(moved);
  const at = new Map<string, string[]>();
  for (const place of placed(edit)) {
    if (!ids.has(place.thing.id)) continue;
    const clock = clockOf(place.at);
    at.set(clock, [...(at.get(clock) ?? []), PART_NAME[place.thing.part] ?? "it"]);
  }
  if (at.size === 0) return saidOf(was, edit, gave);
  const lines = [...at].map(([clock, names]) => `${names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`} ${names.length === 1 ? "is" : "are"} on at ${clock}`);
  const rest: Edit = { ...edit, items: edit.items.filter((item) => !ids.has(item.id)), shots: edit.shots.map((shot) => ({ ...shot, marks: shot.marks.filter((mark) => !ids.has(mark.id)) })) };
  return toldSentence([...lines, ...toldOf(was, rest, gave)]);
}

/* ── the zoom here ────────────────────────────────────────────────────────────────────────────── */

/** How long the push into a zoom "here" takes, then it holds. In film time. */
export const PUSH_MS = 400;
/** The least film time a sentence's end leaves on each side of its split: after the push's own 400 ms, and after the split. */
const HOLD_MS = 100;

/**
 * The film frames [at, end) on which a shot is the one shown (`momentAt`): from its place's first frame up to the next shot's,
 * since in a transition the shot coming in owns the frames both show (S9).
 */
function ownFrames(lay: Layout, index: number): { at: number; end: number } {
  const [place, next] = [lay.shots[index], lay.shots[index + 1]];
  if (!place) return { at: 0, end: 0 };
  return { at: place.at, end: Math.max(place.at, Math.min(place.at + place.frames, next?.at ?? Infinity)) };
}

/** The zoom a framing gets to: its move's end, else its own. */
const targetOf = (framing: Shot["framing"]): number => framing.move?.to.zoom ?? framing.from.zoom;

/** Where a zoom here ends, as the code's part of the say tells it. */
type ZoomEnd = "sentence" | "cut" | "film";
const SAYS_END: Record<ZoomEnd, string> = { sentence: "the end of the sentence", cut: "the next cut", film: "the end" };

/**
 * "Zoom in here" (slice B, Task 3): the zoom starts on the moment, not at the cut of the shot it is in, up to seconds early. A
 * still punch-in on a moment in speech is a cut in speech, which the review refuses; so the shot is split on the moment (a split
 * that removes nothing: the pieces run on, and so does the sound) and the piece after it PUSHES in from the footage's own framing
 * there (`PUSH_MS`, then it holds), so nothing jumps and no cut is made. In order:
 * - The shot under the moment moves already: refused, unless it is a push made here before, which is made again from where it
 *   started (to more, or to less), with no split.
 * - The start: a clean cut within ON frames of the moment (`cleanCuts`) is where it starts: the shot's own start, no split; a
 *   pause's cut@ inside the shot, split there. Else the shot is split on the moment, unless that leaves ON frames or fewer on
 *   either side of it (the shot's end is the last frame it is shown on, S9), and then the shot is the piece.
 * - The end: at the first pause of the take whose cut@ is at or after the end of the moment's sentence (or of its word, with no
 *   sentence), when the push and HOLD_MS fit before it and HOLD_MS after it, split there; else the piece runs to its shot's end.
 * - The framing: from a clean cut, a still punch-in first (or the slow zoom); else, or when that has none, the push, over 400 ms
 *   (`slow`: over the whole piece). None: the reason, in `zoomFor`'s words, and no op at all (the splits are not made).
 * `first` and `last` are the piece's first and last film frames, `to` the zoom it gets to, `says` the code's part of the say.
 * `here` is a moment of `edit`.
 */
export function zoomHere(edit: Edit, analyses: Analyses, here: Moment, zoom: number, slow: boolean, library: readonly Asset[]): { ops: Op[]; says: string; first: number; last: number; to: number } | { none: string } {
  const index = edit.shots.findIndex((shot) => shot.id === here.shot);
  const shot = edit.shots[index];
  if (!shot) return { none: `there is no shot "${here.shot}"` };
  if (shot.framing.move !== null && !isPush(shot.framing)) return { none: `shot "${shot.id}" moves already: set its framing plain first, or leave it` };
  /**
   * The push's part: the piece's film time over the push's, or all of it when slow. Never under 1: a piece shorter than the push
   * (the moment 4 to 11 frames before its shot's end) is pushed over all of it, so it gets to the zoom it is said to, and it is
   * still a push to make again (`isPush`), not a move stopped part way up its ease.
   */
  const partOf = (piece: Shot): number => (slow ? 1 : Math.max(1, (piece.endMs - piece.startMs) / piece.speed / PUSH_MS));
  const own = ownFrames(layout(edit), index);
  if (isPush(shot.framing)) {
    const again = zoomFor(edit, analyses, shot.id, zoom, slow, { from: shot.framing.from, part: partOf(shot) });
    if ("none" in again) return again;
    return { ops: [{ op: "shot.set", id: shot.id, framing: again.framing }], says: "from where it started", first: own.at, last: own.end - 1, to: targetOf(again.framing) };
  }

  const ops: Op[] = [];
  let on = edit;
  /** Splits shot `id` of `on` at `atMs`; the new piece's id. */
  const split = (id: string, atMs: number, tag: string): string | { none: string } => {
    const op: Op = { op: "shot.split", id, atMs, newId: pieceId(on, id, tag) };
    const parted = applyOps(on, [op], library);
    if (!parted.ok) return { none: parted.problems.map((problem) => problem.message).join("; ") };
    ops.push(op);
    on = parted.edit;
    return op.newId;
  };

  const near = cleanCuts(edit, analyses).reduce<{ cut: ReturnType<typeof cleanCuts>[number]; off: number } | null>((best, cut) => {
    const off = Math.abs(frameAt(cut.film, 1) - here.frame);
    return best === null || off < best.off ? { cut, off } : best;
  }, null);
  const clean = near && near.off <= ON ? near.cut : null;
  let piece = shot.id;
  // The piece starts on a clean cut unless the shot is split on the moment itself: the shot's own start is one.
  let onClean = true;
  if (clean && clean.index === index && clean.ms > shot.startMs && clean.ms < shot.endMs) {
    const made = split(shot.id, clean.ms, "z");
    if (typeof made !== "string") return made;
    piece = made;
  } else if (here.frame - own.at > ON && own.end - here.frame > ON) {
    // A clean cut at the shot's own start is within ON of the moment, so the shot is never split here then: it is the piece.
    const made = split(shot.id, here.ms, "z");
    if (typeof made !== "string") return made;
    [piece, onClean] = [made, false];
  }

  const words = wordsOf(edit, shot.asset);
  const said = here.sentence ? words[here.sentence.last] : here.word ? words[here.word.index] : undefined;
  const pause = said ? (analysisOf(analyses, shot.asset)?.pauses ?? []).filter((each) => each.cutMs >= said.endMs).sort((a, b) => a.cutMs - b.cutMs)[0] : undefined;
  const started = on.shots.find((each) => each.id === piece);
  if (!started) return { none: `there is no shot "${piece}"` };
  let ends: ZoomEnd = index === edit.shots.length - 1 ? "film" : "cut";
  if (pause && (pause.cutMs - started.startMs) / started.speed >= PUSH_MS + HOLD_MS && (started.endMs - pause.cutMs) / started.speed >= HOLD_MS) {
    const made = split(piece, pause.cutMs, "b");
    if (typeof made !== "string") return made;
    ends = "sentence";
  }

  const at = on.shots.findIndex((each) => each.id === piece);
  const zoomed = on.shots[at];
  if (!zoomed) return { none: `there is no shot "${piece}"` };
  const still = onClean ? zoomFor(on, analyses, piece, zoom, slow) : null;
  const found = still && "framing" in still ? still : zoomFor(on, analyses, piece, zoom, slow, { from: framingAt(zoomed, zoomed.startMs), part: partOf(zoomed) });
  // The splits are not made, so the reason names the creator's shot, not the piece it would have been.
  if ("none" in found) return { none: found.none.replaceAll(`shot "${piece}"`, `shot "${shot.id}"`) };
  const frames = ownFrames(layout(on), at);
  const from = Math.abs(frames.at - here.frame) > ON ? "from the start of this shot" : "from here";
  return { ops: [...ops, { op: "shot.set", id: piece, framing: found.framing }], says: `${from} to ${SAYS_END[ends]}`, first: frames.at, last: frames.end - 1, to: targetOf(found.framing) };
}

/* ── the proof's measures ─────────────────────────────────────────────────────────────────────── */

export type Landing = "zoom" | "cut" | "starts" | "word" | "ends";
export type Whole = "pauses" | "look" | "title-out" | "faster";
/** A framing this much tighter, or looser, is seen to differ. */
const SEEN = 0.01;
/** How much tighter a zoom here is half a second on: enough to see. */
const TIGHTER = 0.05;
/** Half a second of film, in frames: where a push has reached its zoom. */
const HALF_SECOND = FPS / 2;
/** The speed r19 asks for, "1.25 times faster", and how near a shot must be to it. */
const FASTER = { speed: 1.25, within: 0.01 };

/** Every mark and item of an edit. */
const thingsOf = (edit: Edit): (Mark | Item)[] => [...edit.shots.flatMap((shot) => shot.marks), ...edit.items];

/** The words a film shows, by take, by index: those whose middle a run shows, hidden or not. */
function shownWords(edit: Edit): Map<string, Set<number>> {
  const shown = new Map<string, Set<number>>();
  for (const run of layout(edit).runs) {
    const indexes = shown.get(run.asset) ?? new Set<number>();
    wordsOf(edit, run.asset).forEach((word, index) => {
      const middle = (word.startMs + word.endMs) / 2;
      if (middle >= run.fromMs && middle < run.toMs) indexes.add(index);
    });
    shown.set(run.asset, indexes);
  }
  return shown;
}

/** The zoom of the framing on a film frame: of the shot `momentAt` gives there, at its moment; null past the film's end. */
function zoomAt(edit: Edit, frame: number): number | null {
  const here = momentAt(edit, frame);
  const shot = here ? edit.shots.find((each) => each.id === here.shot) : undefined;
  return here && shot ? framingAt(shot, here.ms).zoom : null;
}

/** True when an answer did what a request pointing at the moment asked, judged in code (the proof's verdict; a miss is a miss). `moment` is of `before`. */
export function landed(kind: Landing, moment: Moment, before: Edit, after: Edit): boolean {
  switch (kind) {
    case "starts": {
      // Exactly one new title, call-out, cutaway or sound, starting from the moment's start, less ON, to its frame, plus ON.
      const had = new Set(thingsOf(before).map((thing) => thing.id));
      const added = thingsOf(after).filter((thing) => APPEARS.has(thing.part) && !had.has(thing.id));
      const [one] = added;
      const first = one && added.length === 1 ? placed(after).find((place) => place.thing.id === one.id)?.at : undefined;
      return first !== undefined && moment.start - ON <= first && first <= moment.frame + ON;
    }
    case "ends": {
      // The one title or call-out showing on the frame now ends on it, its start as it was, and nothing else is longer or shorter.
      const [then, now] = [placed(before), placed(after)];
      const on = then.filter((place) => (place.thing.part === "title" || place.thing.part === "callout") && place.at <= moment.frame && moment.frame < place.at + place.frames);
      const [was] = on;
      const is = was && on.length === 1 ? now.find((place) => place.thing.id === was.thing.id) : undefined;
      if (!was || !is || is.at !== was.at || Math.abs(is.at + is.frames - moment.frame) > ON) return false;
      return then.every((place) => place.thing.id === was.thing.id || now.find((other) => other.thing.id === place.thing.id)?.frames === place.frames);
    }
    case "word": {
      // The take's words whose stress changed are the word under the frame, and no other.
      if (!moment.word) return false;
      const [was, is] = [wordsOf(before, moment.take), wordsOf(after, moment.take)];
      const changed = Array.from({ length: Math.max(was.length, is.length) }, (_, i) => i).filter((i) => (was[i]?.stress === true) !== (is[i]?.stress === true));
      return changed.length === 1 && changed[0] === moment.word.index;
    }
    case "cut": {
      // Shorter; the word under the frame no longer shown; every word no longer shown of its sentence.
      const { word, sentence } = moment;
      if (!word || !sentence || filmFrames(after) >= filmFrames(before)) return false;
      const [then, now] = [shownWords(before), shownWords(after)];
      if (now.get(moment.take)?.has(word.index)) return false;
      const ofSentence = (take: string, index: number): boolean => take === moment.take && index >= sentence.first && index <= sentence.last;
      return [...then].every(([take, indexes]) => [...indexes].every((index) => now.get(take)?.has(index) === true || ofSentence(take, index)));
    }
    case "zoom": {
      // The frames the shot under the moment is the one shown on in `before` (in a transition, the shot coming in).
      const frames = Math.max(filmFrames(before), filmFrames(after));
      const own = Array.from({ length: filmFrames(before) }, (_, f) => f).filter((f) => momentAt(before, f)?.shot === moment.shot);
      const [first, end] = [own[0], own.at(-1)];
      if (first === undefined || end === undefined) return false;
      let tighter: number | null = null;
      for (let f = 0; f < frames; f++) {
        const [was, is] = [zoomAt(before, f), zoomAt(after, f)];
        if (tighter === null && was !== null && is !== null && is > was + SEEN) tighter = f;
        const differs = was === null || is === null ? was !== is : Math.abs(is - was) > SEEN;
        if (differs && (f < first || f > end)) return false;
      }
      if (tighter === null || Math.abs(tighter - moment.frame) > ON) return false;
      const probe = Math.min(moment.frame + HALF_SECOND, end);
      const [was, is] = [zoomAt(before, probe), zoomAt(after, probe)];
      return was !== null && is !== null && is >= was + TIGHTER;
    }
  }
}

/** How many ms of a pause of a take an edit's shots show. */
function pauseShown(edit: Edit, take: string, pause: { startMs: number; endMs: number }): number {
  return edit.shots.reduce((sum, shot) => (shot.asset === take ? sum + Math.max(0, Math.min(shot.endMs, pause.endMs) - Math.max(shot.startMs, pause.startMs)) : sum), 0);
}

type LookLike = { preset: string | null; adjust: Adjust };
const sameLook = (a: LookLike | null, b: LookLike | null): boolean =>
  a === null || b === null ? a === b : a.preset === b.preset && (Object.keys(a.adjust) as (keyof Adjust)[]).every((key) => a.adjust[key] === b.adjust[key]);

/**
 * True when an answer to a request about the whole video, sent with a moment, stayed whole (the proof's control runs):
 * "pauses", at least two of the takes' measured pauses show fewer ms; "look", the film's look changed and every shot's own is
 * as it was (a shot new by id, as the shot of `before` whose stretch holds its start); "title-out", no title is placed;
 * "faster", every shot plays at 1.25.
 */
export function stayedWhole(kind: Whole, before: Edit, after: Edit, analyses: Analyses): boolean {
  switch (kind) {
    case "pauses": {
      const takes = before.assets.filter((asset) => asset.kind === "video").map((asset) => asset.id);
      const fewer = takes.flatMap((take) => (analysisOf(analyses, take)?.pauses ?? []).filter((pause) => pauseShown(after, take, pause) < pauseShown(before, take, pause)));
      return fewer.length >= 2;
    }
    case "look":
      return !sameLook(after.look, before.look) && after.shots.every((shot) => {
        const was = before.shots.find((each) => each.id === shot.id) ?? before.shots.find((each) => each.asset === shot.asset && each.startMs <= shot.startMs && shot.startMs < each.endMs);
        return sameLook(shot.look, was ? was.look : null);
      });
    case "title-out":
      return !placed(after).some((place) => place.thing.part === "title");
    case "faster":
      return after.shots.every((shot) => Math.abs(shot.speed - FASTER.speed) <= FASTER.within);
  }
}

export type Put = "start" | "end";
/** The fewest frames an end card shows for to count as one: 0.8 s, what the proof takes as readable (an end card of 3 frames came back twice). */
export const READABLE_END = 24;

/**
 * True when an answer to a request that names another place than the moment, sent with one, put what it added there (the
 * proof's controls of S13 b and S15: "a hook title at the start", "an end card"): at least one title, call-out, cutaway or sound
 * is new, and every new one is placed: "start", from within ON frames of the film's first; "end", showing on the film's last
 * frame (within ON) for READABLE_END frames or more, and starting more than ON frames after the moment's, so that one run from
 * the moment to the end is no end card. `moment` is of `before`.
 */
export function stayedPut(kind: Put, moment: Moment, before: Edit, after: Edit): boolean {
  const had = new Set(thingsOf(before).map((thing) => thing.id));
  const added = thingsOf(after).filter((thing) => APPEARS.has(thing.part) && !had.has(thing.id));
  const places = placed(after);
  const film = filmFrames(after);
  return added.length > 0 && added.every((thing) => {
    const place = places.find((each) => each.thing.id === thing.id);
    if (!place) return false;
    return kind === "start" ? place.at <= ON : place.at + place.frames >= film - ON && place.frames >= READABLE_END && place.at > moment.frame + ON;
  });
}
