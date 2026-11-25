/**
 * original.ts — the take as it was shot (spec 2026-11-24-editor-screens-design.md E16; plan 2026-11-25-editor-screens-b, Task 5).
 * Trust in a cut comes from seeing what it was made from: the page plays, on its one Player, the take with nothing on it, at the
 * moment the film was on, and comes back to the film at the moment the take is on. Pure: what follows from an edit (`derive.ts`).
 */
import { MIN_FRAMES, assetOf, frameAt, layout, momentAt, newEdit, type Edit } from "@/lib/edit";

/**
 * The take with nothing on it (E16): `newEdit` of the take the edit's first shot shows (its first three minutes, as a new edit
 * is), captions off. Null when that is no video, or one too short to be a shot.
 */
export function plainEdit(edit: Edit): Edit | null {
  const first = edit.shots[0];
  const take = first ? assetOf(edit, first.asset) : undefined;
  if (take?.kind !== "video" || frameAt(take.ms, 1) < MIN_FRAMES) return null;
  const plain = newEdit(take);
  return { ...plain, captions: { ...plain.captions, on: false } };
}

/** The take's moment a film frame shows: the file of the shot on it and the moment of that file; null past the film's end. */
export function takeMomentAt(edit: Edit, frame: number): { asset: string; ms: number } | null {
  const moment = momentAt(edit, frame);
  const shot = moment ? edit.shots.find((each) => each.id === moment.shot) : undefined;
  return moment && shot ? { asset: shot.asset, ms: moment.ms } : null;
}

/** The frame of the plain edit that shows a moment of the take, held inside it. */
export function plainFrameAt(plain: Edit, ms: number): number {
  const lay = layout(plain);
  const run = lay.runs[0];
  if (!run) return 0;
  return Math.min(Math.max(0, run.at + frameAt(ms - run.fromMs, run.speed)), Math.max(0, lay.frames - 1));
}

/**
 * The film frame that shows a moment of the take: the first that shows it (exact); when the film shows it nowhere (cut out),
 * the first frame of the shot that starts soonest after it; past every shot, the film's last frame.
 */
export function filmFrameAt(edit: Edit, asset: string, ms: number): { frame: number; exact: boolean } {
  const lay = layout(edit);
  // Shown: on the frame nearest it in each run of that file that shows it (as `frameOf`), the first of them.
  let shown: number | null = null;
  for (const run of lay.runs) {
    if (run.asset !== asset || ms < run.fromMs || ms >= run.toMs) continue;
    const frame = Math.min(run.at + run.frames - 1, run.at + frameAt(ms - run.fromMs, run.speed));
    if (shown === null || frame < shown) shown = frame;
  }
  if (shown !== null) return { frame: shown, exact: true };
  // Cut out: the shot of that file whose stretch starts soonest after the moment, the first on the film of two such.
  let next: { startMs: number; at: number } | null = null;
  for (const [i, shot] of edit.shots.entries()) {
    const place = lay.shots[i];
    if (!place || shot.asset !== asset || shot.startMs <= ms) continue;
    if (next === null || shot.startMs < next.startMs || (shot.startMs === next.startMs && place.at < next.at)) next = { startMs: shot.startMs, at: place.at };
  }
  return { frame: next?.at ?? Math.max(0, lay.frames - 1), exact: false };
}
