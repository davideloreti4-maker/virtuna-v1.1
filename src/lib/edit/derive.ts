/**
 * derive.ts — what follows from an edit without being stored: which shots run on from one
 * another, how many frames each fills and where it starts, how long the film is, where every mark
 * and item shows, the words said, how a moment is framed, the cover's frame.
 *
 * The kit draws from these and the checks judge by them, so the two cannot disagree.
 *
 * A run is a stretch of footage that plays on unbroken, however many shots it is cut into. Frames
 * are counted on the run's clock: a moment falls on the frame nearest to it, counted from the
 * run's start. So cutting a shot in two moves nothing, and no stored number is ever rounded.
 */
import type { Asset, Captions, Cut, Edit, Frame, Item, Look, Mark, Move, Shot } from "./doc";
import { PARTS } from "./parts";
import { FPS, frameAt, msOf } from "./time";

/** The file of that id, or undefined. */
export function assetOf(edit: Edit, id: string): Asset | undefined {
  return edit.assets.find((asset) => asset.id === id);
}

/** A clip's or a sound's length in milliseconds; null for a picture, which has none. */
export function lengthOf(asset: Asset): number | null {
  return asset.kind === "image" ? null : asset.ms;
}

/** How many frames two shots share at a cut: none at a plain cut. */
export function overlapOf(cut: Cut): number {
  return cut.kind === "cut" ? 0 : cut.frames;
}

/** True when `next` goes on exactly where `shot` stops: the same file at the same speed, after a plain cut. */
export function runsOn(shot: Shot, next: Shot): boolean {
  return shot.out.kind === "cut" && next.asset === shot.asset && next.speed === shot.speed && next.startMs === shot.endMs;
}

/** A stretch of footage that plays on unbroken: one shot, or several that run on from one another. */
export interface Run {
  /** Its first and its last shot, by their place in the edit. */
  first: number;
  last: number;
  /** Its first film frame. */
  at: number;
  /** Its length in frames. */
  frames: number;
  /** The file it shows and the speed it plays at. */
  asset: string;
  speed: number;
  /** The stretch of the file it shows: from `fromMs` up to `toMs`. */
  fromMs: number;
  toMs: number;
}

/** Where everything is on the film: its length, each shot's first frame and frames, and the runs. */
export interface Layout {
  /** The film's length in frames. */
  frames: number;
  /** For each shot, in the edit's order: its first film frame, its frames, and which run it is in. */
  shots: { at: number; frames: number; run: number }[];
  runs: Run[];
}

/**
 * Lays the shots out on the film. A run fills the frames nearest to its length; inside it, each
 * shot starts on the frame nearest to its start. A transition starts the next run early by its
 * length. The last shot hands over to nothing, so its cut takes nothing off.
 */
export function layout(edit: Edit): Layout {
  const runs: Run[] = [];
  const shots: Layout["shots"] = [];
  edit.shots.forEach((shot, i) => {
    const before = edit.shots[i - 1];
    let run = runs[runs.length - 1];
    if (!run || !before || !runsOn(before, shot)) {
      const at = run && before ? run.at + run.frames - overlapOf(before.out) : 0;
      run = { first: i, last: i, at, frames: 0, asset: shot.asset, speed: shot.speed, fromMs: shot.startMs, toMs: shot.endMs };
      runs.push(run);
    }
    const from = frameAt(shot.startMs - run.fromMs, run.speed);
    const to = frameAt(shot.endMs - run.fromMs, run.speed);
    run.last = i;
    run.toMs = shot.endMs;
    run.frames = to;
    shots.push({ at: run.at + from, frames: to - from, run: runs.length - 1 });
  });
  const last = runs[runs.length - 1];
  return { frames: last ? last.at + last.frames : 0, shots, runs };
}

/**
 * The shot of a run that a film frame belongs to, by its place in the edit: the last one that has
 * started by that frame. The run's first shot before the run starts, its last after it ends.
 */
export function shotOn(lay: Layout, run: Run, frame: number): number {
  let index = run.first;
  for (let i = run.first + 1; i <= run.last; i++) {
    if ((lay.shots[i]?.at ?? Infinity) <= frame) index = i;
  }
  return index;
}

/** The frames run `r` shares with the run after it in a transition: none at a plain cut, and none for the last run, which hands over to nothing. */
export function sharedAfter(edit: Edit, lay: Layout, r: number): number {
  const out = edit.shots[lay.runs[r]?.last ?? -1]?.out;
  return out && r < lay.runs.length - 1 ? overlapOf(out) : 0;
}

/**
 * The film frames a run's captions show on: from the run's first frame up to where a transition
 * out of it begins, and one frame at least. So two runs' words are never on screen at once. The kit
 * draws them there and the review judges them there.
 */
export function captionFrames(edit: Edit, lay: Layout, r: number): { at: number; frames: number } {
  const run = lay.runs[r];
  return run ? { at: run.at, frames: Math.max(1, run.frames - sharedAfter(edit, lay, r)) } : { at: 0, frames: 0 };
}

/** The film's length in frames. */
export function filmFrames(edit: Edit): number {
  return layout(edit).frames;
}

/** A mark or an item that shows, with its place on the film. */
export interface Placed {
  /** Where it is in the document, like "shots.1.marks.0" or "items.2". */
  path: string;
  /** The mark or the item itself. */
  thing: Mark | Item;
  /** The shot a mark rides on; null for an item. */
  shot: string | null;
  /** The first film frame it shows on. */
  at: number;
  /** How many frames it shows. */
  frames: number;
  /**
   * How many frames of its own run are already gone when it first shows. 0, unless its moment is
   * before what its footage shows: then it is already running when the footage starts.
   */
  skip: number;
  /** Where in the file it plays it is on its first frame, in milliseconds; null when it plays none. */
  fileMs: number | null;
}

/**
 * Every mark and item that shows, with its place on the film.
 *
 * A mark shows from the frame of its moment for its length of film, whichever piece of its run
 * holds it. If its moment is before what the run shows, it is already running when the run
 * starts; if it is after, the mark does not show. A part that spills runs on over the cuts that
 * follow; any other ends when its run does. An item shows from its frame, counted from the
 * film's start or back from its end, for its frames. Nothing shows past the film's end, and a
 * part never plays a clip or a sound past the end of its file.
 *
 * The list is in the document's order, and that order means nothing: what is drawn over what is
 * the kit's rule, by kind of part and by when a thing starts, never by which shot holds a mark.
 */
export function placed(edit: Edit): Placed[] {
  const lay = layout(edit);
  const all: Placed[] = [];
  for (const run of lay.runs) {
    const runEnd = run.at + run.frames;
    for (let i = run.first; i <= run.last; i++) {
      const shot = edit.shots[i];
      if (!shot) continue;
      shot.marks.forEach((mark, j) => {
        if (mark.atMs >= run.toMs) return;
        const from = Math.max(mark.atMs, run.fromMs);
        const skip = frameAt(from - mark.atMs, run.speed);
        const at = Math.min(runEnd - 1, run.at + frameAt(from - run.fromMs, run.speed));
        const end = PARTS[mark.part].spills ? lay.frames : Math.min(runEnd, lay.frames);
        const frames = Math.min(Math.max(1, frameAt(mark.lenMs, 1)), fileFrames(edit, mark)) - skip;
        if (frames > 0 && end > at) all.push({ path: `shots.${i}.marks.${j}`, thing: mark, shot: shot.id, at, frames: Math.min(frames, end - at), skip, fileMs: fileMsOf(mark, skip) });
      });
    }
  }
  edit.items.forEach((item, i) => {
    const at = item.anchor === "start" ? item.at : Math.max(0, lay.frames - item.at);
    const frames = Math.min(item.frames ?? lay.frames, lay.frames - at, fileFrames(edit, item));
    if (frames > 0) all.push({ path: `items.${i}`, thing: item, shot: null, at, frames, skip: 0, fileMs: fileMsOf(item, 0) });
  });
  return all;
}

/**
 * How many frames the clip or sound a part plays can fill from where the part starts in it: every
 * frame that starts inside the file. No limit for a part that plays no file, or plays a picture.
 */
function fileFrames(edit: Edit, thing: Mark | Item): number {
  if (!("asset" in thing)) return Infinity;
  const asset = assetOf(edit, thing.asset);
  const ms = asset ? lengthOf(asset) : null;
  return ms === null ? Infinity : Math.ceil(((ms - thing.props.startMs) * FPS) / 1000);
}

/** Where in its file a part is after `skip` frames of playing; null for a part that plays none. */
function fileMsOf(thing: Mark | Item, skip: number): number | null {
  return "asset" in thing ? thing.props.startMs + Math.round(msOf(skip, 1)) : null;
}

/** A word as it is said on the film: the frames it is said on, counted from its run's first frame, up to but not including `to`. */
export interface SaidWord {
  text: string;
  from: number;
  to: number;
  /** True when the captions are to stress it. */
  stress: boolean;
}

/**
 * The words said in a run, for its captions. A word counts when its middle falls inside what the
 * run shows; a hidden word is left out. Its frames are held inside the run, and it has at least
 * one. It starts on the frame a mark at the same moment starts on.
 */
export function runWords(edit: Edit, run: Run): SaidWord[] {
  const asset = assetOf(edit, run.asset);
  const words = asset?.kind === "video" ? (asset.words ?? []) : [];
  const frame = (ms: number) => frameAt(ms - run.fromMs, run.speed);
  const said: SaidWord[] = [];
  for (const word of words) {
    const middle = (word.startMs + word.endMs) / 2;
    if (word.hidden || middle < run.fromMs || middle >= run.toMs) continue;
    const from = Math.min(run.frames - 1, Math.max(0, frame(word.startMs)));
    said.push({ text: word.text, from, to: Math.min(run.frames, Math.max(from + 1, frame(word.endMs))), stress: word.stress === true });
  }
  return said;
}

/** An ease's value at `t`, both from 0 to 1. Before 0 it is 0 and after 1 it is 1. */
export function easeAt(ease: Move["ease"], t: number): number {
  const x = Math.min(1, Math.max(0, t));
  switch (ease) {
    case "linear":
      return x;
    case "in":
      return x ** 3;
    case "out":
      return 1 - (1 - x) ** 3;
    case "in-out":
      return x < 0.5 ? 4 * x ** 3 : 1 - (2 - 2 * x) ** 3 / 2;
  }
}

/**
 * How a shot frames a moment of its file. A shot that moves shows its part of the move, at an
 * even pace from its first moment to its last; where the part reaches before the move's start or
 * past its end, the framing holds.
 */
export function framingAt(shot: Pick<Shot, "framing" | "startMs" | "endMs">, ms: number): Frame {
  const { from, move } = shot.framing;
  if (!move) return from;
  const along = (ms - shot.startMs) / (shot.endMs - shot.startMs);
  const t = easeAt(move.ease, move.part[0] + (move.part[1] - move.part[0]) * along);
  const mix = (a: number, b: number) => a * (1 - t) + b * t;
  return { zoom: mix(from.zoom, move.to.zoom), x: mix(from.x, move.to.x), y: mix(from.y, move.to.y) };
}

/** The moment of its file a run shows on a film frame, in milliseconds, unrounded. */
export function momentOf(run: Run, frame: number): number {
  return run.fromMs + msOf(frame - run.at, run.speed);
}

/**
 * The film frame on which a moment of a shot's file shows; null when the shot is not there or its
 * run does not show that moment. Any piece of a run may be named for a moment the run shows.
 */
export function frameOf(edit: Edit, shotId: string, ms: number): number | null {
  const lay = layout(edit);
  const run = lay.runs[lay.shots[edit.shots.findIndex((shot) => shot.id === shotId)]?.run ?? -1];
  if (!run || ms < run.fromMs || ms >= run.toMs) return null;
  return Math.min(run.at + run.frames - 1, run.at + frameAt(ms - run.fromMs, run.speed));
}

/**
 * The shot on a film frame and the moment of its file shown there, to the millisecond; null past
 * the film's end. Where two shots share a frame in a transition, it is the one coming in. A
 * piece of a run starts on the frame nearest its start, so the moment on its first frame may be
 * a few milliseconds before the piece's own stretch; it is always inside the run's.
 */
export function momentAt(edit: Edit, frame: number): { shot: string; ms: number } | null {
  const lay = layout(edit);
  for (let i = edit.shots.length - 1; i >= 0; i--) {
    const [shot, place] = [edit.shots[i], lay.shots[i]];
    const run = place ? lay.runs[place.run] : undefined;
    if (!shot || !place || !run || frame < place.at || frame >= place.at + place.frames) continue;
    return { shot: shot.id, ms: Math.round(momentOf(run, frame)) };
  }
  return null;
}

/** The film frame of the cover; null when the edit names none, or names a shot that is gone or a moment that does not show. */
export function coverFrame(edit: Edit): number | null {
  return edit.cover ? frameOf(edit, edit.cover.shot, edit.cover.atMs) : null;
}

/** The typefaces an edit uses: the captions' and every text part's, each once. */
export function fontsOf(edit: Edit): Captions["font"][] {
  const things: (Mark | Item)[] = [...edit.shots.flatMap((shot) => shot.marks), ...edit.items];
  const fonts = things.flatMap((thing) => ("font" in thing.props ? [thing.props.font] : []));
  return [...new Set([edit.captions.font, ...fonts])];
}

/** The look a shot is drawn with: its own preset or the film's, and its adjustments added to the film's, each held between -1 and 1. */
export function lookOf(edit: Edit, shot: Pick<Shot, "look">): Look {
  if (!shot.look) return edit.look;
  const own = shot.look.adjust;
  const adjust = { ...edit.look.adjust };
  for (const key of Object.keys(adjust) as (keyof typeof adjust)[]) adjust[key] = Math.min(1, Math.max(-1, adjust[key] + own[key]));
  return { preset: shot.look.preset ?? edit.look.preset, adjust };
}
