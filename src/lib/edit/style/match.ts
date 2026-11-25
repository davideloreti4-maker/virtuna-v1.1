/**
 * match.ts — how far an edit is from a style (spec §12.5). `profileOf` reads the style's fields back from the edit; `matchOf`
 * compares them with a target field by field, as matched, near or not, and gives the target's `notMatched` (what the kit cannot
 * draw) with them. Pure.
 */
import type { Analyses } from "../analysis";
import { framingAt, layout, placed, type Layout } from "../derive";
import type { Edit, Shot } from "../doc";
import { PUNCH } from "../recipes/punch";
import { PAUSE_MS, analysisFor } from "../recipes/tighten";
import { FPS } from "../time";
import { clamp, medianOf } from "./measures";
import { DEFAULT_STYLE, type StyleProfile } from "./profile";

export type Profile = Omit<StyleProfile, "source" | "notMatched">;

export interface Match {
  field: string;
  target: string;
  actual: string;
  verdict: "matched" | "near" | "not";
}

/**
 * How far off a field may be:
 * - `near`: within §7's gates (spec §12.5): the pace 15 %, a caption's place 0.05 of the stage, a title's timing 0.5 s (15
 *   frames). Rates and sizes are held as the pace is, a title's place as a caption's; a punch-in's zoom to 0.05, a quarter
 *   of the kit's range of 1.05 to 1.3; the words a page to one more or fewer.
 * - `same`: within what measuring and the kit's own rounding leave: 5 %, a hundredth of the stage, 3 frames (0.1 s), a zoom
 *   to its two places (0.02), the words a page exactly.
 * A rate is matched within half a count over the film too, and near within one: a film has whole cuts and punch-ins. The quiet
 * share (X104) is matched within 10 % of the target or 0.01, whichever is more, and near within 20 % or 0.02.
 */
export const TOLERANCE = {
  near: { share: 0.15, place: 0.05, titleFrames: 15, zoom: 0.05, words: 1, quiet: { share: 0.2, least: 0.02 } },
  same: { share: 0.05, place: 0.01, titleFrames: 3, zoom: 0.02, words: 0, quiet: { share: 0.1, least: 0.01 } },
} as const;

/** A title that starts in the film's first five seconds is its opening title, as the reference's sheet reads one. */
const OPENING_FRAMES = 5 * FPS;
/** Silence on the film no further apart than a frame is one pause: shots start on whole frames. */
const FRAME_MS = 1000 / FPS;
/** The shortest pause the worker measures (`worker/media/pauses.py`). */
const MIN_PAUSE_MS = 120;
const EPSILON = 1e-9;

/* ── profileOf ────────────────────────────────────────────────────────────────────────────────── */

/**
 * The style an edit has, in the profile's terms:
 * - `pace.pauseMs`: the median pause between phrases on the film: each stretch of a take's measured pauses its shots show,
 *   joined across a cut, as long as it is heard; not the film's head or tail; at least 120 ms, as the worker measures. Clamped
 *   to `tighten`'s range; with none, the default style's. `pace.quiet` (X104): those pauses' total over the film's spoken span.
 * - `pace.cutsPerMin`: where the picture changes, a minute: each run after the first (a cut or a transition), each shot framed
 *   otherwise than the one before it in its run, and each cutaway coming in or going out inside the film.
 * - `title`: the opening title (the first that starts in the first five seconds), as long as it shows; null for none.
 * - `punchIns`: each shot that starts at least 1.05 tighter than the one before it ends (the least the kit punches in by), a
 *   minute, and their median ratio; null for none.
 * - `captions` and `look` as set.
 */
export function profileOf(edit: Edit, analyses: Analyses): Profile {
  const lay = layout(edit);
  const minutes = lay.frames / FPS / 60;
  const { on, look, font, size, y, maxWords, highlight } = edit.captions;
  const { pauseMs, quiet } = pauseOf(lay, analyses);
  return {
    pace: { pauseMs, cutsPerMin: clamp(round2(changesOf(edit, lay) / minutes), 0, 60), quiet },
    captions: { on, look, font, size, y, maxWords, highlight },
    title: titleOf(edit, lay),
    punchIns: punchInsOf(edit, minutes),
    look: { preset: edit.look.preset },
  };
}

/** The film's pause (as `pace.pauseMs`) and its quiet share (X104): the inner pauses' total over the spoken span, from the head
 * pause's end to the tail pause's start (0 and the film's end where it has none), 3 places; null with no pause heard. */
function pauseOf(lay: Layout, analyses: Analyses): { pauseMs: number; quiet: number | null } {
  const quiet: { from: number; to: number; ms: number }[] = [];
  for (const run of lay.runs) {
    const startMs = (run.at * 1000) / FPS;
    for (const pause of analysisFor(analyses, run.asset)?.pauses ?? []) {
      const [from, to] = [Math.max(pause.startMs, run.fromMs), Math.min(pause.endMs, run.toMs)];
      if (to > from) quiet.push({ from: startMs + (from - run.fromMs) / run.speed, to: startMs + (to - run.fromMs) / run.speed, ms: (to - from) / run.speed });
    }
  }
  quiet.sort((a, b) => a.from - b.from);
  const joined: typeof quiet = [];
  for (const each of quiet) {
    const last = joined.at(-1);
    if (last && each.from - last.to <= FRAME_MS) [last.to, last.ms] = [Math.max(last.to, each.to), last.ms + each.ms];
    else joined.push({ ...each });
  }
  const endMs = (lay.frames * 1000) / FPS;
  const inner = joined.filter((pause) => pause.from > FRAME_MS && pause.to < endMs - FRAME_MS && pause.ms >= MIN_PAUSE_MS);
  const median = medianOf(inner.map((pause) => pause.ms));
  const head = joined.find((pause) => pause.from <= FRAME_MS);
  const tail = [...joined].reverse().find((pause) => pause.to >= endMs - FRAME_MS && pause !== head);
  const [from, to] = [head ? head.to : 0, tail ? tail.from : endMs];
  return {
    pauseMs: median === null ? DEFAULT_STYLE.pace.pauseMs : Math.round(clamp(median, PAUSE_MS.min, PAUSE_MS.max)),
    quiet: joined.length === 0 || to <= from ? null : Math.round((inner.reduce((sum, pause) => sum + pause.ms, 0) / (to - from)) * 1000) / 1000,
  };
}

/** The same framing: where it starts and where its move goes, if it moves (a split moving shot runs on in its move). */
const sameFraming = (a: Shot, b: Shot): boolean =>
  JSON.stringify([a.framing.from, a.framing.move?.to, a.framing.move?.ease]) === JSON.stringify([b.framing.from, b.framing.move?.to, b.framing.move?.ease]);

function changesOf(edit: Edit, lay: Layout): number {
  const reframed = edit.shots.filter((shot, i) => {
    const before = edit.shots[i - 1];
    return before !== undefined && lay.shots[i]?.run === lay.shots[i - 1]?.run && !sameFraming(before, shot);
  }).length;
  const cutaways = placed(edit)
    .filter((each) => each.thing.part === "cutaway")
    .reduce((sum, each) => sum + Number(each.at > 0) + Number(each.at + each.frames < lay.frames), 0);
  return lay.runs.length - 1 + reframed + cutaways;
}

function titleOf(edit: Edit, lay: Layout): Profile["title"] {
  const opening = placed(edit)
    .flatMap((each) => (each.thing.part === "title" && each.at < OPENING_FRAMES ? [{ at: each.at, frames: each.frames, props: each.thing.props }] : []))
    .sort((a, b) => a.at - b.at)[0];
  if (!opening) return null;
  const { y, look, size } = opening.props;
  // One that shows to the film's end stays (Task 9c), as an item of `frames: null` does.
  const stays = opening.at + opening.frames >= lay.frames;
  return { on: true, y, frames: clamp(opening.frames, 15, 600), look, size, ...(stays ? { stays: true } : {}) };
}

function punchInsOf(edit: Edit, minutes: number): Profile["punchIns"] {
  const ratios = edit.shots.flatMap((shot, i) => {
    const before = edit.shots[i - 1];
    if (!before) return [];
    const ratio = framingAt(shot, shot.startMs).zoom / framingAt(before, before.endMs).zoom;
    return ratio >= PUNCH.zoom.min - EPSILON ? [ratio] : [];
  });
  const zoom = medianOf(ratios);
  return zoom === null ? null : { perMin: round2(ratios.length / minutes), zoom: round2(clamp(zoom, PUNCH.zoom.min, PUNCH.zoom.max)) };
}

/* ── matchOf ──────────────────────────────────────────────────────────────────────────────────── */

type Verdict = Match["verdict"];
const within = (off: number, same: number, near: number): Verdict => (off <= same + EPSILON ? "matched" : off <= near + EPSILON ? "near" : "not");
/** A number held as a share of the target's own, and, for a rate, as counts over the film. */
const byShare = (target: number, actual: number, counts = 0): Verdict =>
  within(Math.abs(actual - target), Math.max(TOLERANCE.same.share * target, counts / 2), Math.max(TOLERANCE.near.share * target, counts));
const exactly = (target: unknown, actual: unknown): Verdict => (target === actual ? "matched" : "not");

const seconds = (frames: number): string => `${(frames / FPS).toFixed(1)} s`;
const titled = (title: Profile["title"]): title is NonNullable<Profile["title"]> => title !== null && title.on;

/**
 * The edit against the target style, field by field (in the profile's order), and the target's `notMatched`. The pace is its
 * quiet share when the target has one (X104), else its pause. The cuts a minute are not compared (Task 14b, the controller's
 * ruling): a single take cannot meet a reference's cuts between scenes, and the field read "not" on five references of five;
 * the profile keeps the number (`profileOf`). A field the target says nothing of is left out: the captions' settings when its
 * captions are off, a title's or the punch-ins' settings when either side has none (their presence is compared).
 */
export function matchOf(target: StyleProfile, edit: Edit, analyses: Analyses): { fields: Match[]; notMatched: string[] } {
  const actual = profileOf(edit, analyses);
  const minutes = layout(edit).frames / FPS / 60;
  const fields: Match[] = [];
  const add = (field: string, want: string, got: string, verdict: Verdict) => fields.push({ field, target: want, actual: got, verdict });

  const quiet = target.pace.quiet;
  if (quiet === undefined || quiet === null) add("pace.pauseMs", `${target.pace.pauseMs} ms`, `${actual.pace.pauseMs} ms`, byShare(target.pace.pauseMs, actual.pace.pauseMs));
  else {
    const got = actual.pace.quiet ?? null;
    const [same, near] = [TOLERANCE.same.quiet, TOLERANCE.near.quiet];
    add("pace.quiet", String(quiet), got === null ? "none" : String(got), got === null ? "not" : within(Math.abs(got - quiet), Math.max(same.share * quiet, same.least), Math.max(near.share * quiet, near.least)));
  }

  const [want, got] = [target.captions, actual.captions];
  add("captions.on", want.on ? "on" : "off", got.on ? "on" : "off", exactly(want.on, got.on));
  if (want.on && got.on) {
    add("captions.look", want.look, got.look, exactly(want.look, got.look));
    add("captions.font", want.font, got.font, exactly(want.font, got.font));
    add("captions.size", `${want.size} px`, `${got.size} px`, byShare(want.size, got.size));
    add("captions.y", String(want.y), String(got.y), within(Math.abs(want.y - got.y), TOLERANCE.same.place, TOLERANCE.near.place));
    add("captions.maxWords", String(want.maxWords), String(got.maxWords), within(Math.abs(want.maxWords - got.maxWords), TOLERANCE.same.words, TOLERANCE.near.words));
    const [lit, shown] = [want.highlight?.toLowerCase() ?? null, got.highlight?.toLowerCase() ?? null];
    add("captions.highlight", lit ?? "none", shown ?? "none", lit === shown ? "matched" : lit && shown ? "near" : "not");
  }

  const [hook, has] = [target.title, actual.title];
  const titleOn = (title: Profile["title"]) => (titled(title) ? `${seconds(title.frames)} at ${title.y}` : "none");
  add("title", titleOn(hook), titleOn(has), titled(hook) === titled(has) ? "matched" : "not");
  if (titled(hook) && titled(has)) {
    add("title.y", String(hook.y), String(has.y), within(Math.abs(hook.y - has.y), TOLERANCE.same.place, TOLERANCE.near.place));
    // Whether it stays to the end, when the style says (Task 9c); a title that stays lasts the film's length, not the reference's.
    const end = (stays: boolean | undefined) => (stays ? "to the end" : "not to the end");
    if (hook.stays !== undefined) add("title.stays", end(hook.stays), end(has.stays), hook.stays === Boolean(has.stays) ? "matched" : "not");
    if (!hook.stays) add("title.frames", seconds(hook.frames), seconds(has.frames), within(Math.abs(hook.frames - has.frames), TOLERANCE.same.titleFrames, TOLERANCE.near.titleFrames));
    // Bold and outline are neighbours (white letters with a dark edge either way; the reading cannot tell them apart reliably:
    // film 1's bold title read an edge at 0.596 against 0.58 on fresh frames, fix round 2 of 9c): near; a label against either, not.
    const neighbours = new Set([hook.look, has.look]).size === 2 && [hook.look, has.look].every((look) => look === "bold" || look === "outline");
    add("title.look", hook.look, has.look, neighbours ? "near" : exactly(hook.look, has.look));
    add("title.size", `${hook.size} px`, `${has.size} px`, byShare(hook.size, has.size));
  }

  const [punch, punched] = [target.punchIns, actual.punchIns];
  const punchOf = (each: Profile["punchIns"]) => (each ? `${each.perMin} a minute at ${each.zoom}` : "none");
  add("punchIns", punchOf(punch), punchOf(punched), (punch === null) === (punched === null) ? "matched" : "not");
  if (punch && punched) {
    add("punchIns.perMin", `${punch.perMin} a minute`, `${punched.perMin} a minute`, byShare(punch.perMin, punched.perMin, 1 / minutes));
    add("punchIns.zoom", String(punch.zoom), String(punched.zoom), within(Math.abs(punch.zoom - punched.zoom), TOLERANCE.same.zoom, TOLERANCE.near.zoom));
  }

  add("look.preset", target.look.preset, actual.look.preset, exactly(target.look.preset, actual.look.preset));
  return { fields, notMatched: [...target.notMatched] };
}

const round2 = (value: number): number => Math.round(value * 100) / 100;
