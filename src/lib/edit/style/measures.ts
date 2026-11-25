/**
 * measures.ts — what a reference's analysis alone says of its style (spec §12.2, step 2): its pace, its cuts a minute, its
 * punch-ins and whether its picture is black and white, from the worker's pauses, cuts, faces and picture (X97, X102). Pure:
 * the same analysis gives the same measures. Its text is read from the worker's measures too (`text.ts`); Qwen judges only
 * the rest (`read.ts`).
 */
import type { Pause, PictureSample, TakeAnalysis } from "../analysis";
import type { LOOK_IDS } from "../doc";
import { PUNCH } from "../recipes/punch";
import { PAUSE_MS } from "../recipes/tighten";
import { DEFAULT_STYLE } from "./profile";

export type LookId = (typeof LOOK_IDS)[number];

export interface Measures {
  /** The pause between phrases, whole ms, 120 to 400 (`tighten`'s range). */
  pauseMs: number;
  cutsPerMin: number;
  /** The inner pauses' total over the spoken span, 3 places (X104); null with no pause at all. */
  quiet: number | null;
  /** Null with no face to measure, or with none found. */
  punchIns: { perMin: number; zoom: number } | null;
  /** "mono" for a picture with next to no colour; null for any other, whose grade Qwen judges (`read.ts`). */
  look: "mono" | null;
  /** The reference's length. */
  ms: number;
}

/**
 * How near its end the last pause must reach to be the take's tail (the sound's end, which the worker measures to). The
 * sound and the picture of a file end a few ms apart (the owner's take: the picture 12,700 ms, its tail pause to 12,714).
 */
const TAIL_SLACK_MS = 100;

/**
 * A punch-in: at a cut, the face's height in the first sample with a face at or after `settleMs` past it, inside the shot that
 * follows (before the next cut) and at most `inMs` into it, against the last sample with a face before `settleMs` ahead of it
 * and at most `backMs` back; at least `ratio` (the brief). The kit punches in from 1.05 to 1.3 (`PUNCH.zoom`). `backMs` and
 * `inMs` (Task 9b, rounds 2 and 3): every punch-in of ground-truth films 2 and 5 comes right after the take's laptop shot,
 * where no face is found, and its punched shot opens on the laptop too, the face coming 0.7 to 0.8 s in. `most` and `scene`
 * (Task 9c): a punch-in stays in its scene, so the picture's means just before the cut and just after it are alike (`scene`)
 * and the face grows by at most `most`; Task 11's reference 5, B-roll of other people, read 3.9 a minute without them.
 */
export const PUNCH_IN = { ratio: 1.12, settleMs: 100, backMs: 8000, inMs: 2000, most: 1.5, scene: { luma: 0.06, sat: 0.03, warmth: 0.03 } } as const;

/**
 * A picture whose mean saturation over the film is under this is black and white: `look` "mono" (X102). The kit's six looks,
 * measured on 2026-11-22: the owner's 12.7 s take rendered whole in each look on this Mac, captions off
 * (`scripts/edit-film.ts`), and each render's copies and picture made with the worker's own code (`worker/media/transcode.py`,
 * `picture.py`), as the worker makes them. The raw take reads 0.486 / 0.071 / 0.069 there, as on Modal (Task 8). "Spread" is
 * the standard deviation of the samples' luma over the film.
 *
 *   look      mean luma   luma spread   mean sat   mean warmth
 *   natural   0.479       0.0273        0.0680      0.0656
 *   vivid     0.479       0.0295        0.0979      0.0938
 *   warm      0.476       0.0270        0.0836      0.0813
 *   cool      0.479       0.0285        0.0615      0.0587
 *   mono      0.478       0.0296        0.0051     -0.0040
 *   soft      0.476       0.0231        0.0565      0.0547
 *
 * Mono reads 0.005, the least of the other five 0.057. The cut-off was 0.03 until Task 9c, when a dim colour video (Task 11's
 * reference 1, mean 0.024 over 149 samples) read mono: real black and white sits at or near 0, so it is 0.012. The other looks are
 * not read from these numbers: natural, warm and cool lie 0.008 to 0.015 apart in warmth on this one take, less than two rooms
 * differ, so one take's absolute values cannot tell a grade on another video. Qwen judges the grade by eye (`judgeSheet`).
 */
export const MONO_SAT = 0.012;

/** What the analysis says of the reference's pace, cuts, punch-ins and look. Throws for an analysis made before part 3 (no cuts or picture). */
export function measuresOf(analysis: TakeAnalysis, ms: number): Measures {
  const { cuts, picture } = analysis;
  if (!cuts || !picture) throw new Error("the analysis has no cuts or picture: it was made before part 3, so analyse it again");
  const minutes = ms / 60_000;
  return {
    pauseMs: pauseOf(analysis, ms, cuts), cutsPerMin: round2(cuts.length / minutes), quiet: quietOf(analysis.pauses, ms),
    punchIns: punchInsOf(analysis, cuts, minutes), look: monoOf(picture), ms,
  };
}

/** The pauses with speech on both sides: not the head (from 0), nor the tail (to the end, `TAIL_SLACK_MS`). */
function innerOf(pauses: readonly Pause[], ms: number): Pause[] {
  return pauses.filter((pause, i) => pause.startMs > 0 && !(i === pauses.length - 1 && pause.endMs >= ms - TAIL_SLACK_MS));
}

/**
 * What a reference's measured quiet share is multiplied by (Task 9b, round 3): a finished, levelled film's sound reads
 * tighter than the raw take it was cut from, so its pauses measure fewer and shorter than the edit's own. The median, over
 * the six ground-truth films, of the film's own quiet share (`profileOf`, from the take's pauses through the edit) over the
 * one measured on the rendered film: 1.164, 1.442, 1.622, 1.507, 1.867, 0.868 (films 1 to 6), median 1.474. Fitted on the
 * same six films its gate is read on; the edit's own side (`profileOf`) is not corrected.
 */
export const QUIET_READ = 1.47;

/**
 * The quiet share (X104): the inner pauses' total over the spoken span, from the head pause's end (or 0) to the tail pause's
 * start (or the end), times `QUIET_READ`, held to the profile's 0.6, to 3 places; null with no pause at all (no speech was
 * found, or none paused). A sum over the span is steadier than a median of a few lengths: on ground-truth film 2, whose edit
 * keeps its pauses at 300 ms, the pauses measured on the film read 136 to 320 ms, median 182. It is still coarse: the six
 * films read 9 % to 68 % off their own after the correction.
 */
function quietOf(pauses: readonly Pause[], ms: number): number | null {
  if (pauses.length === 0) return null;
  const inner = innerOf(pauses, ms);
  const from = pauses[0]!.startMs === 0 ? pauses[0]!.endMs : 0;
  const last = pauses.at(-1)!;
  const to = last.endMs >= ms - TAIL_SLACK_MS && last !== pauses[0] ? last.startMs : ms;
  return to > from ? round3(Math.min(QUIET_MOST, (inner.reduce((sum, pause) => sum + pause.endMs - pause.startMs, 0) / (to - from)) * QUIET_READ)) : null;
}

/** The profile's most quiet share (`StyleProfileSchema`, `pace.quiet`). */
const QUIET_MOST = 0.6;

/** The caps `pauseFor` tries: `tighten`'s range in steps of 10 ms. */
const CAP_STEP = 10;

/**
 * The pause length, 120 to 400 in steps of 10, at which cutting every inner pause down to it brings the quiet share nearest
 * `quiet` (X104). Ties go to the longer. After the cut at c the share is Σ min(p, c) ÷ (span − Σ max(p − c, 0)), over the
 * pauses `p` inside `span` (a head or a tail outside it is not cut). A take already tighter than the target gets 400; one
 * that cannot get as tight, 120. Pure: the first cut calls it with a reference's `quiet` and the take's own pauses and
 * spoken span.
 */
export function pauseFor(pauses: readonly { startMs: number; endMs: number }[], span: { fromMs: number; toMs: number }, quiet: number): number {
  const lengths = pauses.filter((pause) => pause.startMs >= span.fromMs && pause.endMs <= span.toMs).map((pause) => pause.endMs - pause.startMs);
  const spanMs = span.toMs - span.fromMs;
  let [best, nearest] = [PAUSE_MS.max, Number.POSITIVE_INFINITY];
  for (let cap = PAUSE_MS.max; cap >= PAUSE_MS.min; cap -= CAP_STEP) {
    const kept = lengths.reduce((sum, length) => sum + Math.min(length, cap), 0);
    const cut = lengths.reduce((sum, length) => sum + Math.max(length - cap, 0), 0);
    const off = Math.abs(kept / (spanMs - cut) - quiet);
    if (off < nearest - 1e-12) [best, nearest] = [cap, off];
  }
  return best;
}

/**
 * The median pause between phrases: the pauses with speech on both sides (not the head, from 0, nor the tail, to the end).
 * With no words heard (`language` null: every reference, X103, which is never heard), only those between two stretches
 * of speech that hold no cut, so a pause an edit made is not taken for the speaker's; if none is, all of them. Clamped to
 * `tighten`'s range; with none at all, the default style's.
 */
function pauseOf(analysis: TakeAnalysis, ms: number, cuts: readonly number[]): number {
  const { pauses } = analysis;
  const inner = innerOf(pauses, ms);
  const holdsCut = (from: number, to: number) => cuts.some((cut) => cut > from && cut < to);
  const clean = inner.filter((pause) => {
    const i = pauses.indexOf(pause);
    return !holdsCut(pauses[i - 1]?.endMs ?? 0, pause.startMs) && !holdsCut(pause.endMs, pauses[i + 1]?.startMs ?? ms);
  });
  const chosen = analysis.language === null && clean.length > 0 ? clean : inner;
  const median = medianOf(chosen.map((pause) => pause.endMs - pause.startMs));
  return median === null ? DEFAULT_STYLE.pace.pauseMs : Math.round(clamp(median, PAUSE_MS.min, PAUSE_MS.max));
}

/** The punch-ins at the cuts (`PUNCH_IN`), a minute, and their median ratio held to the kit's zoom; null with no face, or none found. */
function punchInsOf(analysis: TakeAnalysis, cuts: readonly number[], minutes: number): Measures["punchIns"] {
  const { faces } = analysis;
  if (!faces.some((sample) => sample.face)) return null;
  const ratios = cuts.flatMap((cut, i) => {
    const next = cuts[i + 1] ?? Number.POSITIVE_INFINITY;
    const after = faces.find((sample) => sample.face && sample.ms >= cut + PUNCH_IN.settleMs && sample.ms <= cut + PUNCH_IN.inMs && sample.ms < next)?.face;
    const before = faces.filter((sample) => sample.face && sample.ms < cut - PUNCH_IN.settleMs && sample.ms >= cut - PUNCH_IN.backMs).at(-1)?.face;
    if (!after || !before || !sameScene(analysis.picture ?? [], cut)) return [];
    const ratio = after.h / before.h;
    return ratio >= PUNCH_IN.ratio && ratio <= PUNCH_IN.most ? [ratio] : [];
  });
  const zoom = medianOf(ratios);
  return zoom === null ? null : { perMin: round2(ratios.length / minutes), zoom: round2(clamp(zoom, PUNCH.zoom.min, PUNCH.zoom.max)) };
}

/** Whether the picture just before `cut` (its last sample before it) and just after (its first `settleMs` past it) are alike. */
function sameScene(picture: readonly PictureSample[], cut: number): boolean {
  const before = picture.filter((sample) => sample.ms < cut).at(-1);
  const after = picture.find((sample) => sample.ms >= cut + PUNCH_IN.settleMs);
  if (!before || !after) return true; // nothing to tell them apart by
  const { luma, sat, warmth } = PUNCH_IN.scene;
  return Math.abs(after.luma - before.luma) <= luma && Math.abs(after.sat - before.sat) <= sat && Math.abs(after.warmth - before.warmth) <= warmth;
}

/** "mono" when the picture's mean saturation is under `MONO_SAT`; null otherwise, and for a picture with no sample. */
function monoOf(picture: readonly PictureSample[]): Measures["look"] {
  if (picture.length === 0) return null;
  return picture.reduce((sum, sample) => sum + sample.sat, 0) / picture.length < MONO_SAT ? "mono" : null;
}

/** The middle value, or the mean of the two middle ones; null for none. */
export function medianOf(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[half]! : (sorted[half - 1]! + sorted[half]!) / 2;
}

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const round2 = (value: number): number => Math.round(value * 100) / 100;
const round3 = (value: number): number => Math.round(value * 1000) / 1000;
