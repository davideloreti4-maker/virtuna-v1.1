/**
 * punch.ts — punch-ins: a stretch of a take framed tighter, as talking-head creators cut (X100).
 * Pure, and checked by `review` itself.
 *
 * The rules, as built (the brief, with ruling B2 of part 3's Task 4, Task 10b's E and Task 10's fix round 2). It runs on an
 * edit already cut in pauses (after `tighten`).
 * - The film is split into `n = round(perMin × its minutes)` equal slots. A slot that already holds a tight shot (zoom above 1)
 *   starting inside it is filled (fix round 1: so a second run adds nothing). Each other slot takes one punch-in starting
 *   inside it.
 * - Where a punch-in may start, in this order: at a cut (a plain cut between two shots of one take whose both sides lie in a
 *   measured pause, into a shot framed as it comes: zoom 1, no pan and no move; a creator's pan is theirs, fix round 2, O2),
 *   one before a stressed word first, then the nearest the slot's middle; then at a measured pause's `cutMs` inside a shot
 *   framed as it comes, splitting it there and removing nothing (a cut in a pause, X54), one whose pause ends within 600 ms
 *   before a stressed word first (nearest the middle first), then the longest. So a rate the cuts cannot give is reached.
 * - Only on the speaker (fix round 2): the face sample standing for the stretch's start has a face, and so do at least half
 *   the samples over the stretch. A shot with no face is never punched.
 * - In and out (fix rounds 2 and 3): the punched stretch ends at its shot's end when that is 2 to 5 s of film on (an existing
 *   cut, or the film's end); else at the longest pause of its shot that starts 2 to 5 s on, split there so the piece after it
 *   is framed as before; else at the first pause starting, or the first cut, up to 8 s on; with none, no punch-in there. A way
 *   out at a pause that would leave under a second of wide picture before the next cut runs on to that cut (fix round 5); and
 *   the way in has the way out's rule (the final fix wave): a punch-in at a pause starts a second of film or more after the
 *   cut before it (its shot's start: a creator's cut, a cut of tighten's, or the way out of a punched stretch before it), else
 *   it is not made there; one at a cut starts at the cut itself. So a punched stretch always ends, holds 2 s at least, and runs
 *   to the film's end only when that is within 5 s, and there is a second of wide picture on each side of it or none. A tight shot never
 *   follows or comes before another tight one (punched here, or already zoomed or moving), and punch-ins start at least 2 s of
 *   film apart.
 * - The punched stretch gets `shot.set { framing: { from: { zoom, x, y }, move: null } }`. The zoom is held to review's
 *   `soft-zoom` limit for its take (`zoomLimit`, floored to two places, as review says it), and so the face's box, after the
 *   zoom, is at most 0.62 of the stage's height (floored to two places); a stretch where these leave it under 1.08 gets none
 *   (fix round 3). A zoom asked under 1.08 is raised to it, the least a viewer sees (fix round 4). `x` and `y` are the least
 *   pan that keeps the face box of the sample standing for the stretch's start (`faceOnStage`) inside the middle 60 % of the
 *   stage (0.2 to 0.8 of each side); where it cannot fit, the face is centred as far as a pan reaches.
 * - A punch-in is kept only when `review` then finds no new error: no new error finding, and no new frame of an on-face or
 *   under-buttons error (`textErrorFrames`), each read without the shot it names (a split renames the piece after it, and
 *   an error the edit already had is not a new one, fix round 3). A bigger face can bring the mouth or the eyes into the
 *   captions, so before it is dropped (fix round 2) it is framed to hold the face's line nearest the captions where it was
 *   at zoom 1 (the mouth's bottom with captions under the face, the face's top with captions over it; the picture grows away
 *   from them), at its zoom, then at each step of 0.05 smaller down to 1.08. The first framing with no new error is kept.
 *   Else it is dropped, counted, and the slot's next candidate is tried.
 */
import type { Analyses, FaceSample, Pause } from "../analysis";
import { assetOf, frameOf, layout } from "../derive";
import { IdSchema, STAGE, type Captions, type Edit, type Frame, type Shot } from "../doc";
import { applyOps, type Op } from "../ops";
import { review, textErrorFrames, zoomLimit } from "../review";
import { faceOnStage } from "../stage";
import { FPS, MIN_FRAMES, msOf } from "../time";
import { analysisFor, inPause } from "./tighten";

export const PUNCH = { perMin: { min: 0, max: 30 }, zoom: { min: 1.05, max: 1.3 } } as const;
/** The middle of the stage a punched face is kept in: 0.2 to 0.8 of each side. */
const MIDDLE = { from: 0.2, to: 0.8 } as const;
/** The tallest a punched face may be, as a share of the stage's height; and the least zoom worth a punch-in. */
const FACE_MOST = 0.62;
const LEAST_ZOOM = 1.08;
/** How far apart punch-ins start, in film frames (2 s). */
const APART = 2 * FPS;
/** How long a punched stretch holds, in ms of film: at least 2 s; out at a cut or a pause within 5 s, else the first within 8 s. */
const HOLD = { least: 2000, most: 5000, last: 8000 } as const;
/** The least wide picture, in ms of film, a punched stretch leaves between its way out and the next cut, and between the cut before it and its way in. */
const WIDE_MS = 1000;
/** The step the zoom is made smaller by when the face's line is held. */
const ZOOM_STEP = 0.05;
/** The least share of a stretch's face samples that must find a face for it to be punched. */
const FACE_SHARE = 0.5;
/** How near before a stressed word a pause must end for a punch-in there to land on the word. */
const BEFORE_STRESS_MS = 600;

/** What `punchIns` did: its operations, and how many punch-ins it dropped for a new error. */
export interface Punched {
  ops: Op[];
  dropped: number;
}

/** The operations that punch in about `perMin` a minute: `shot.set { framing }`, and the `shot.split`s that make room for them. */
export function punchIns(edit: Edit, analyses: Analyses, opts: { perMin: number; zoom: number }): Op[] {
  return punched(edit, analyses, opts).ops;
}

/** `punchIns`, with the count of those dropped because review found a new error after them. */
export function punched(edit: Edit, analyses: Analyses, opts: { perMin: number; zoom: number }): Punched {
  const { perMin, zoom } = opts;
  if (!(perMin >= PUNCH.perMin.min && perMin <= PUNCH.perMin.max)) throw new RangeError(`perMin is ${perMin}; it is ${PUNCH.perMin.min} to ${PUNCH.perMin.max}`);
  if (!(zoom >= PUNCH.zoom.min && zoom <= PUNCH.zoom.max)) throw new RangeError(`zoom is ${zoom}; it is ${PUNCH.zoom.min} to ${PUNCH.zoom.max}`);
  const done: Punched = { ops: [], dropped: 0 };
  const frames = layout(edit).frames;
  const slots = Math.round((perMin * frames) / (60 * FPS));
  if (slots === 0) return done;

  let current = edit;
  let judged = judge(current, analyses);
  for (let k = 0; k < slots; k++) {
    const [start, end, middle] = [(k * frames) / slots, ((k + 1) * frames) / slots, ((k + 0.5) * frames) / slots];
    const starts = tightStarts(current);
    if (starts.some((at) => at >= start && at < end)) continue; // filled
    const inSlot = candidatesOf(current, analyses, Math.max(zoom, LEAST_ZOOM))
      .filter((candidate) => candidate.at >= start && candidate.at < end && starts.every((at) => Math.abs(at - candidate.at) >= APART))
      .sort((a, b) => a.rank - b.rank || b.longMs - a.longMs || Math.abs(a.at - middle) - Math.abs(b.at - middle) || a.at - b.at);
    let taken = false;
    for (const candidate of inSlot) {
      let tried = false;
      for (const from of candidate.frames) {
        const ops: Op[] = [...candidate.splits, { op: "shot.set", id: candidate.punched, framing: { from, move: null } }];
        const made = applyOps(current, ops);
        if (!made.ok || !alternates(made.edit, candidate.punched)) continue;
        tried = true;
        const after = judge(made.edit, analyses);
        if (adds(judged, after)) continue;
        [current, judged] = [made.edit, after];
        done.ops.push(...ops);
        taken = true;
        break;
      }
      if (taken) break;
      if (tried) done.dropped++;
    }
  }
  return done;
}

/** Framed as it comes: zoom 1, no pan, no move. */
const isPlain = (shot: Shot): boolean => {
  const { from, move } = shot.framing;
  return from.zoom === 1 && from.x === 0 && from.y === 0 && move === null;
};
/** Framed tighter than the take: zoomed, or moving. */
const isTight = (shot: Shot): boolean => shot.framing.from.zoom > 1 || shot.framing.move !== null;

/** The film frames where tight shots start. */
function tightStarts(edit: Edit): number[] {
  const lay = layout(edit);
  return edit.shots.flatMap((shot, i) => (isTight(shot) ? [lay.shots[i]?.at ?? 0] : []));
}

/** Whether the punched shot `id` has no tight shot before or after it. */
function alternates(edit: Edit, id: string): boolean {
  const i = edit.shots.findIndex((shot) => shot.id === id);
  const [before, after] = [edit.shots[i - 1], edit.shots[i + 1]];
  return i >= 0 && !(before && isTight(before)) && !(after && isTight(after));
}

/**
 * Where a punch-in may start: its film frame; its order (-1 a cut before a stressed word, 0 another cut, 1 a pause before a
 * stressed word, 2 another pause); the splits that make its stretch; and the framings to try, in order.
 */
interface Candidate {
  at: number;
  rank: number;
  /** A pause's length, for rank 2 (the longest first); 0 else. */
  longMs: number;
  splits: Op[];
  /** The id of the shot framed tighter. */
  punched: string;
  frames: Frame[];
}

/** Every place a punch-in may start, with the operations that make it. */
function candidatesOf(edit: Edit, analyses: Analyses, zoom: number): Candidate[] {
  const lay = layout(edit);
  const used = new Set([...edit.assets.map((asset) => asset.id), ...edit.shots.flatMap((shot) => [shot.id, ...shot.marks.map((mark) => mark.id)]), ...edit.items.map((item) => item.id)]);
  return edit.shots.flatMap((shot, i): Candidate[] => {
    const asset = assetOf(edit, shot.asset);
    const found = analysisFor(analyses, shot.asset);
    if (!isPlain(shot) || asset?.kind !== "video" || !asset.words?.length || !found) return [];
    const words = asset.words;
    const least = Math.ceil(msOf(MIN_FRAMES, shot.speed) - 1e-9);
    /** The pauses inside the shot a split may go at: their `cutMs` in the pause and three frames' worth from each end. */
    const inside = found.pauses.filter((pause) => pause.startMs <= pause.cutMs && pause.cutMs < pause.endMs && pause.cutMs - shot.startMs >= least && shot.endMs - pause.cutMs >= least);
    /**
     * Where a stretch from `fromMs` goes back out: undefined at its shot's end (2 to 5 s on: a cut or the film's end; or a cut up
     * to 8 s on); a pause, the longest starting 2 to 5 s on, else the first starting up to 8 s on; null when there is none, or it
     * would hold under 2 s.
     */
    const outAfter = (fromMs: number): { cutMs: number } | undefined | null => {
      const [lo, hi, last] = [fromMs + HOLD.least * shot.speed, fromMs + HOLD.most * shot.speed, fromMs + HOLD.last * shot.speed];
      if (shot.endMs >= lo && shot.endMs <= hi) return undefined;
      // Going out at a pause that leaves under a second of wide picture before the next cut runs on to that cut (fix round 5).
      const cuts = edit.shots[i + 1] !== undefined;
      const outAt = (pause: Pause) => (cuts && (shot.endMs - pause.cutMs) / shot.speed < WIDE_MS ? undefined : pause);
      const pause = inside.filter((each) => each.startMs >= lo && each.startMs <= hi).sort((a, b) => b.endMs - b.startMs - (a.endMs - a.startMs) || a.startMs - b.startMs)[0];
      if (pause) return outAt(pause);
      const later = inside.filter((each) => each.startMs > hi && each.startMs <= last).sort((a, b) => a.startMs - b.startMs)[0];
      const cut = cuts && shot.endMs > hi && shot.endMs <= last;
      if (later && !(cut && shot.endMs < later.startMs)) return outAt(later);
      return cut ? undefined : null;
    };
    /** The framings to try for a stretch from `fromMs` to `toMs`; none when it is not on the speaker or no zoom is left. */
    const framesFor = (fromMs: number, toMs: number): Frame[] => {
      const sample = found.faces.filter((each) => each.ms <= fromMs).at(-1) ?? found.faces[0];
      const over = found.faces.filter((each) => each.ms >= fromMs && each.ms < toMs);
      if (!sample?.face || over.filter((each) => each.face).length < FACE_SHARE * over.length) return [];
      return framings(sample, asset, held(sample, asset, zoom), edit.captions);
    };
    const fresh = () => freshId(shot.id, used);
    const out: Candidate[] = [];

    // At the cut into this shot.
    const before = edit.shots[i - 1];
    const side = (ms: number) => inPause(found.pauses, ms) || ms === 0 || ms === asset.ms;
    const back = before && before.asset === shot.asset && before.out.kind === "cut" && side(before.endMs) && side(shot.startMs) ? outAfter(shot.startMs) : null;
    if (back !== null) {
      const frames = framesFor(shot.startMs, back?.cutMs ?? shot.endMs);
      const first = words.find((word) => (word.startMs + word.endMs) / 2 >= shot.startMs);
      const stressed = first?.stress === true && (first.startMs + first.endMs) / 2 < shot.endMs;
      const splits: Op[] = back ? [{ op: "shot.split", id: shot.id, atMs: back.cutMs, newId: fresh() }] : [];
      if (frames.length > 0) out.push({ at: lay.shots[i]?.at ?? 0, rank: stressed ? -1 : 0, longMs: 0, splits, punched: shot.id, frames });
    }

    // At a pause inside it: split there, removing nothing.
    for (const pause of inside) {
      const at = frameOf(edit, shot.id, pause.cutMs);
      const back = outAfter(pause.cutMs);
      if (at === null || at === 0 || back === null) continue;
      if ((pause.cutMs - shot.startMs) / shot.speed < WIDE_MS) continue; // under a second of wide picture after the cut before it

      const frames = framesFor(pause.cutMs, back?.cutMs ?? shot.endMs);
      if (frames.length === 0) continue;
      const piece = fresh();
      const splits: Op[] = [
        { op: "shot.split", id: shot.id, atMs: pause.cutMs, newId: piece },
        ...(back ? [{ op: "shot.split" as const, id: piece, atMs: back.cutMs, newId: fresh() }] : []),
      ];
      const stressed = words.some((word) => word.stress === true && word.startMs >= pause.endMs && word.startMs - pause.endMs <= BEFORE_STRESS_MS);
      out.push({ at, rank: stressed ? 1 : 2, longMs: stressed ? 0 : pause.endMs - pause.startMs, splits, punched: piece, frames });
    }
    return out;
  });
}

/**
 * The zoom a punch-in may take on this take and face: the one asked, held to review's soft-zoom limit and so the face is at
 * most `FACE_MOST` of the stage's height, each floored to two places; null when that leaves it under `LEAST_ZOOM`.
 */
function held(sample: FaceSample | undefined, asset: { w: number; h: number }, zoom: number): number | null {
  const floor2 = (value: number) => Math.floor(value * 100 + 1e-9) / 100;
  const face = sample?.face ? faceOnStage(sample, asset, { zoom: 1, x: 0, y: 0 }).face : null;
  const most = face ? floor2((FACE_MOST * STAGE.h) / face.h) : Infinity;
  const tighter = Math.min(zoom, floor2(zoomLimit(asset)), most);
  return tighter < LEAST_ZOOM - 1e-9 ? null : tighter;
}

/**
 * The framings to try at a zoom (fix round 2): today's (`framed`); then, with the captions on, the face's line nearest them held
 * where it was at zoom 1 (`heldLine`), at the zoom and at each step of `ZOOM_STEP` smaller down to `LEAST_ZOOM`. None with no
 * zoom left. Each once.
 */
function framings(sample: FaceSample, asset: { w: number; h: number }, zoom: number | null, captions: Captions): Frame[] {
  if (zoom === null) return [];
  const out = [framed(sample, asset, zoom)];
  if (captions.on) {
    for (let z = zoom; z >= LEAST_ZOOM - 1e-9; z = Math.round((z - ZOOM_STEP) * 100) / 100) out.push(heldLine(sample, asset, z, captions.y));
  }
  return out.filter((frame, i) => out.findIndex((other) => JSON.stringify(other) === JSON.stringify(frame)) === i);
}

/**
 * The framing at `zoom` that keeps the face's line nearest the captions where it is at zoom 1: the mouth's bottom (the face's,
 * with no mouth) when the captions' line is under the face's middle, else the face's top; across, as `framed` pans. A pan
 * moves that line linearly, so the pan is solved, and held to -1 to 1.
 */
function heldLine(sample: FaceSample, asset: { w: number; h: number }, zoom: number, captionsY: number): Frame {
  const still = faceOnStage(sample, asset, { zoom: 1, x: 0, y: 0 });
  const face = still.face!;
  const under = captionsY * STAGE.h > face.y + face.h / 2;
  const line = (seen: typeof still): number => {
    const box = under ? (seen.mouth ?? seen.face!) : seen.face!;
    return under ? box.y + box.h : box.y;
  };
  const x = framed(sample, asset, zoom).x;
  const [want, at0, at1] = [line(still), line(faceOnStage(sample, asset, { zoom, x, y: 0 })), line(faceOnStage(sample, asset, { zoom, x, y: 1 }))];
  const y = at1 === at0 ? 0 : Math.min(1, Math.max(-1, (want - at0) / (at1 - at0)));
  return { zoom, x, y };
}

/**
 * The framing at `zoom` with the least pan that keeps the sample's face inside the middle of the
 * stage; where it cannot fit, the pan that centres it as far as a pan reaches. A pan moves the face
 * along each side linearly (`faceOnStage`), so each side is solved on its own.
 */
function framed(sample: FaceSample, asset: { w: number; h: number }, zoom: number): Frame {
  if (!sample.face) return { zoom, x: 0, y: 0 };
  const at = (x: number, y: number) => faceOnStage(sample, asset, { zoom, x, y }).face!;
  const [still, panned] = [at(0, 0), at(1, 1)];
  const pan = (from: number, size: number, moved: number, stage: number): number => {
    const step = from - moved; // how far a pan of 1 moves the face's near edge, towards the start
    const [lo, hi] = [MIDDLE.from * stage, MIDDLE.to * stage];
    // A pan p puts the face at from − p·step: inside when its near edge is at or after lo and its far edge at or before hi.
    const [least, most] = [Math.max(-1, (from + size - hi) / step), Math.min(1, (from - lo) / step)];
    if (least <= most) return Math.min(most, Math.max(least, 0)); // it fits: the pan nearest 0
    return Math.min(1, Math.max(-1, (from + size / 2 - stage / 2) / step));
  };
  return { zoom, x: pan(still.x, still.w, panned.x, STAGE.w), y: pan(still.y, still.h, panned.y, STAGE.h) };
}

/** `<base>-p<n>` for the first n not in use, the base cut short where the id would pass 40 characters. Marked as used. */
function freshId(base: string, used: Set<string>): string {
  for (let n = 1; ; n++) {
    const suffix = `-p${n}`;
    const id = `${base.slice(0, 40 - suffix.length)}${suffix}`;
    if (!used.has(id) && IdSchema.safeParse(id).success) {
      used.add(id);
      return id;
    }
  }
}

/** What review says of an edit that a punch-in may not add to: each error finding, and each frame of a text's error. */
function judge(edit: Edit, analyses: Analyses): Set<string> {
  const findings = review(edit, analyses)
    .filter((finding) => finding.severity === "error")
    .map((finding) => JSON.stringify([finding.code, finding.where.frame, finding.where.mark ?? null, finding.where.item ?? null, finding.says]));
  const frames = [...textErrorFrames(edit, analyses)].flatMap(([key, set]) => [...set].map((frame) => `${key} on frame ${frame}`));
  return new Set([...findings, ...frames]);
}

/** Whether `after` has an error or an error frame `before` did not. */
const adds = (before: Set<string>, after: Set<string>): boolean => [...after].some((each) => !before.has(each));

