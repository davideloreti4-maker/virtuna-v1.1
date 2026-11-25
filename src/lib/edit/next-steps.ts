/**
 * next-steps.ts — the steps offered under the answer of a change (spec 2026-11-24-editor-screens-design.md §5.3; plan
 * 2026-11-25-editor-screens-b, Task 8): what a creator most often asks next after that kind of change. The turn's operations are
 * not stored ("What the code forced", 3), so the change is told by code from the edit before it and the edit it made, never by
 * the model: a zoom, a look, a cut, bigger captions. At most two steps, from the first kinds that apply in that order. A step is
 * offered only where it did what it says in two runs of three on the real model (Task 10).
 *
 * A zoom is told shot by shot: a shot of the edit made whose largest zoom is `MORE` or more over that of the shot it comes from,
 * the same shot of the edit before, or else the one of the same take whose stretch holds its first moment (a piece split off).
 * Footage the edit before did not show (another file, a stretch it had cut) comes from nothing, and is no zoom. The zoom step is
 * offered only after a push, which is where it was tried.
 *
 * Pure. The steps' requests point ("here"), so the moment they carry (`at`) is the one they are about.
 */
import { isPush } from "./agent/context";
import { filmFrames, layout } from "./derive";
import { AdjustSchema, type Edit, type Look, type Shot, type ShotLook } from "./doc";

export type StepKind = "zoom" | "look" | "cut" | "captions";

export interface NextStep {
  kind: StepKind;
  label: string;
  /** Asked of the agent; null: Undo. */
  request: string | null;
  /** The film frame it is about; null for none. */
  at: number | null;
}

/** How much more a shot must zoom for its zoom to be a change of its own: under that it is a nudge. */
const MORE = 0.05;
/** What two numbers stored may differ by and still be one: 1.15 − 1.1 is 0.04999… */
const SAME = 1e-9;
/** The most steps under one answer. */
const MOST = 2;

const ADJUSTS = Object.keys(AdjustSchema.shape) as (keyof Look["adjust"])[];

/** The largest zoom a shot shows: where it is, or where its move ends when that is tighter. */
function largestZoom(shot: Shot): number {
  return Math.max(shot.framing.from.zoom, shot.framing.move?.to.zoom ?? 0);
}

/** The shot of `before` that `shot` comes from: the same one, or else the one of the same file whose stretch holds its first moment. */
function cameFrom(before: Edit, shot: Shot): Shot | undefined {
  return (
    before.shots.find((each) => each.id === shot.id && each.asset === shot.asset) ??
    before.shots.find((each) => each.asset === shot.asset && each.startMs <= shot.startMs && shot.startMs < each.endMs)
  );
}

function sameLook(a: Look | ShotLook | null, b: Look | ShotLook | null): boolean {
  if (a === null || b === null) return a === b;
  return a.preset === b.preset && ADJUSTS.every((key) => a.adjust[key] === b.adjust[key]);
}

/**
 * The first film frame of the first shot of `after` that zooms in on what it came from, when every shot that does is a push (a
 * zoom here, `isPush`); null when none does, or when one is still. A push is made again lower by code ("Zoom less", 3 of 3 in
 * Task 10); a still zoom has no move for less (`tighter` only searches tighter), so after one, or after "Add zooms" on several
 * shots, no zoom step is offered: Undo is on the answer (final review, I1).
 */
function zoomedAt(before: Edit, after: Edit): number | null {
  const zoomed = after.shots.flatMap((shot, i) => {
    const was = cameFrom(before, shot);
    return was !== undefined && largestZoom(shot) - largestZoom(was) >= MORE - SAME ? [{ shot, i }] : [];
  });
  const [first] = zoomed;
  if (!first || !zoomed.every(({ shot }) => isPush(shot.framing))) return null;
  return layout(after).shots[first.i]?.at ?? null;
}

function lookChanged(before: Edit, after: Edit): boolean {
  if (!sameLook(before.look, after.look)) return true;
  return after.shots.some((shot) => {
    const was = before.shots.find((each) => each.id === shot.id);
    return was !== undefined && !sameLook(was.look, shot.look);
  });
}

/** At most two steps after a change, from the edit before it and the edit it made (§5.3): the kinds in this order, the first that apply. */
export function nextSteps(before: Edit, after: Edit): NextStep[] {
  const steps: NextStep[] = [];
  const zoom = zoomedAt(before, after);
  // Tried 2026-11-25 on a zoom here (Task 10): "Zoom less" 3 of 3. "Hold it longer" ("Hold this zoom longer here.") 0 of 3 on a
  // zoom to the film's end and 0 of 3 on one to the next cut: the model remade the same push, slower or as it was, and no
  // zoom ran past its piece. Removed.
  if (zoom !== null) steps.push({ kind: "zoom", label: "Zoom less", request: "Zoom in less here.", at: zoom });
  if (lookChanged(before, after)) steps.push({ kind: "look", label: "Another look", request: "Try a different colour look.", at: null });
  if (filmFrames(after) < filmFrames(before)) steps.push({ kind: "cut", label: "Put it back", request: null, at: null });
  if (after.captions.size > before.captions.size) steps.push({ kind: "captions", label: "Smaller captions", request: "Make the captions a little smaller.", at: null });
  return steps.slice(0, MOST);
}
