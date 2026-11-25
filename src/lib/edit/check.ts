/**
 * check.ts — what makes an edit refusable. The schema says what an edit may look like; this says
 * whether it holds together: every id names one thing, every file named is there and of the right
 * kind, nothing asks for more of a file than the file has, every shot is long enough to see and
 * has room for the cuts around it.
 *
 * It refuses only what cannot be drawn. A mark at a moment its footage does not show, or an item
 * past the film's end, simply does not show, and a trim may bring it back. How a film looks (a
 * caption on the face, two titles at once, a cut outside a pause) is the review's work, not this.
 */
import type { Asset, Edit, Item, Mark } from "./doc";
import { assetOf, layout, lengthOf, overlapOf } from "./derive";
import { PARTS } from "./parts";
import { MAX_FRAMES, MIN_FRAMES, msOf } from "./time";

/** One thing wrong, and where. */
export interface Problem {
  /** Its place in the document, like "shots.1.marks.0.lenMs", or in a list of operations, like "ops.2". */
  path: string;
  /**
   * The id of the shot, mark, item or file it is about; null when it is about none. An id stays
   * the same through a list of operations; a place does not.
   */
  id: string | null;
  message: string;
}

type Say = (path: string, id: string | null, message: string) => void;

const KIND = { video: "a clip", image: "a picture", audio: "a sound" } as const;

/** Everything that makes this edit refusable; empty when it holds together. */
export function checkEdit(edit: Edit): Problem[] {
  const problems: Problem[] = [];
  const say: Say = (path, id, message) => problems.push({ path, id, message });
  checkIds(edit, say);
  checkShots(edit, say);
  edit.shots.forEach((shot, i) => shot.marks.forEach((mark, j) => checkFile(edit, `shots.${i}.marks.${j}`, mark, mark.lenMs, "lenMs", say)));
  edit.items.forEach((item, i) => checkFile(edit, `items.${i}`, item, item.frames === null ? null : Math.round(msOf(item.frames, 1)), "frames", say));
  const cover = edit.cover;
  if (cover && !edit.shots.some((shot) => shot.id === cover.shot)) say("cover.shot", cover.shot, `the cover is on shot "${cover.shot}", and there is no such shot`);
  return problems;
}

/** An id names one thing in the whole edit: a file, a shot, a mark or an item. */
function checkIds(edit: Edit, say: Say): void {
  const seen = new Map<string, string>();
  const meet = (path: string, id: string) => {
    const first = seen.get(id);
    if (first === undefined) seen.set(id, path);
    else say(`${path}.id`, id, `"${id}" is already the id of ${first}; an id names one thing`);
  };
  edit.assets.forEach((asset, i) => meet(`assets.${i}`, asset.id));
  edit.shots.forEach((shot, i) => {
    meet(`shots.${i}`, shot.id);
    shot.marks.forEach((mark, j) => meet(`shots.${i}.marks.${j}`, mark.id));
  });
  edit.items.forEach((item, i) => meet(`items.${i}`, item.id));
}

/**
 * Each shot shows a clip or a picture, stays inside its file and fills enough frames to be seen;
 * no cut is longer than the footage on either side of it, measured as the whole run; the film is
 * no longer than allowed. A run fading in and out at once can be drawn, so it is not refused.
 */
function checkShots(edit: Edit, say: Say): void {
  const lay = layout(edit);
  edit.shots.forEach((shot, i) => {
    const at = `shots.${i}`;
    const what = `shot "${shot.id}"`;
    const asset = assetOf(edit, shot.asset);
    const ms = asset ? lengthOf(asset) : null;
    const frames = lay.shots[i]?.frames ?? 0;
    if (!asset) say(`${at}.asset`, shot.id, `${what} shows "${shot.asset}", and there is no such file in the edit`);
    else if (asset.kind === "audio") say(`${at}.asset`, shot.id, `${what} shows "${asset.id}", which is a sound; a shot shows a clip or a picture`);
    else if (ms !== null && shot.endMs > ms) say(`${at}.endMs`, shot.id, `${what} shows ${shot.startMs} to ${shot.endMs} ms of "${asset.id}", which is ${ms} ms long`);
    if (frames < MIN_FRAMES) say(at, shot.id, `${what} fills ${frames} frames; the shortest shot is ${MIN_FRAMES}`);
  });

  lay.runs.forEach((run, r) => {
    const [before, first, last] = [edit.shots[run.first - 1], edit.shots[run.first], edit.shots[run.last]];
    if (!first || !last) return;
    const one = run.first === run.last;
    const fills = `${one ? `shot "${first.id}"` : `the footage from "${first.id}" to "${last.id}"`} fills ${run.frames} frames`;
    const [into, outOf] = [before ? overlapOf(before.out) : 0, r < lay.runs.length - 1 ? overlapOf(last.out) : 0];
    if (before && into > run.frames) say(`shots.${run.first}`, first.id, `${fills}, and the ${before.out.kind} of ${into} frames out of "${before.id}" that leads into it is longer`);
    if (outOf > run.frames) say(`shots.${run.last}`, last.id, `${fills}, and ${one ? "its own" : "the"} ${last.out.kind} of ${outOf} frames${one ? "" : ` out of "${last.id}"`} is longer`);
  });

  if (lay.frames > MAX_FRAMES) say("shots", null, `the film is ${lay.frames} frames long; the longest allowed is ${MAX_FRAMES}`);
}

/**
 * A part that plays a file names one that is in the edit and of a kind it plays. A clip or a
 * sound is long enough for where the part starts in it and for the length the part asks for:
 * `playsMs`, or null when the part simply lasts until its file ends.
 */
function checkFile(edit: Edit, path: string, thing: Mark | Item, playsMs: number | null, lengthKey: "lenMs" | "frames", say: Say): void {
  if (!("asset" in thing)) return;
  const what = `${thing.part} "${thing.id}"`;
  const plays: readonly Asset["kind"][] = PARTS[thing.part].plays;
  const asset = assetOf(edit, thing.asset);
  if (!asset) return say(`${path}.asset`, thing.id, `${what} plays "${thing.asset}", and there is no such file in the edit`);
  if (!plays.includes(asset.kind)) {
    return say(`${path}.asset`, thing.id, `${what} plays "${asset.id}", which is ${KIND[asset.kind]}; a ${thing.part} plays ${plays.map((kind) => KIND[kind]).join(" or ")}`);
  }
  const ms = lengthOf(asset);
  const from = thing.props.startMs;
  if (ms === null) return;
  if (from >= ms) say(`${path}.props.startMs`, thing.id, `${what} starts ${from} ms into "${asset.id}", which is ${ms} ms long`);
  else if (playsMs !== null && from + playsMs > ms) say(`${path}.${lengthKey}`, thing.id, `${what} plays ${from} to ${from + playsMs} ms of "${asset.id}", which is ${ms} ms long`);
}
