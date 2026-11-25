import type { NetworkId } from "@/lib/brain/cortex-sim";
import { timecode } from "./format";
import type { Scene } from "./types";

/**
 * The Brain page in words: what each signal stands for, where it stands against its resting level,
 * and one sentence about Focus. Read off the model's own levels (`brain-track.ts`, 0 to 100) and the
 * run's scenes; nothing here is measured.
 */

/** Points within which a level counts as at rest, and the spread under which Focus stays level. */
export const LEVEL_STEP = 3;

export type RestWord = "above rest" | "at rest" | "below rest";

/** A level against its resting level: more than 3 points over, more than 3 under, else at rest. */
export function restWord(level: number, rest: number): RestWord {
  if (level - rest > LEVEL_STEP) return "above rest";
  if (rest - level > LEVEL_STEP) return "below rest";
  return "at rest";
}

/** What each of the four signals stands for, under its name. */
export const SIGNAL_MEANING: Partial<Record<NetworkId, string>> = {
  visual: "what there is to look at",
  dorsal_attention: "how closely they follow",
  limbic: "how much it moves them",
  default: "how far the mind drifts",
};

/** The small line over the rows: the moment they are read at (the clip's end at rest). */
export function momentLine(t: number): string {
  return `At ${timecode(t)} · the dashed line is at rest`;
}

export const FOCUS_LEVEL = "Focus stays level through the video.";

/**
 * One sentence from the Focus signal (`perSecond[s]`: its level at second s).
 * - Highest minus lowest under 3 points: it stays level.
 * - Else where it is highest (the first such second), then where it falls with a scene change when
 *   the largest fall from one second to the next, from the highest second on (the earliest on a
 *   tie), is 3 points or more and lands at the start of a scene that is not the first or within
 *   the second after it (the nearest such start, the earlier on a tie); otherwise where it is
 *   lowest from the highest second on: the first second within 3 points of that low. The model starts every clip at its resting level, so
 *   the whole clip's lowest is nearly always 0:00 and would say nothing; only when the highest
 *   second is the clip's last is the lowest read over the whole clip.
 * - A lowest that is under 3 points below the highest is not named: the sentence ends after where
 *   Focus is highest.
 */
export function focusSentence(perSecond: readonly number[], scenes: readonly Scene[]): string {
  if (perSecond.length === 0) return FOCUS_LEVEL;
  const high = Math.max(...perSecond);
  const low = Math.min(...perSecond);
  if (high - low < LEVEL_STEP) return FOCUS_LEVEL;
  const peak = perSecond.indexOf(high);
  const head = `Focus is highest at ${timecode(peak)}`;

  let fall = 0;
  let landsOn = -1;
  for (let s = peak; s < perSecond.length - 1; s++) {
    const drop = perSecond[s]! - perSecond[s + 1]!;
    if (drop > fall) {
      fall = drop;
      landsOn = s + 1;
    }
  }
  if (fall >= LEVEL_STEP) {
    let change: number | null = null;
    // Only a fall that lands at a scene's start or within the second after it: one that ends before
    // the cut is not that cut's. The nearest such start (scenes are in time order; a tie keeps the earlier).
    for (const scene of scenes.slice(1)) {
      const since = landsOn - scene.t0;
      if (since >= 0 && since <= 1 && (change === null || since < landsOn - change)) change = scene.t0;
    }
    if (change !== null) return `${head} and falls when the scene changes at ${timecode(change)}.`;
  }
  const from = peak === perSecond.length - 1 ? 0 : peak;
  const after = perSecond.slice(from);
  const lowAfter = Math.min(...after);
  // A level that holds from its highest second on has no lowest worth naming.
  if (high - lowAfter < LEVEL_STEP) return `${head}.`;
  // The second Focus got down to its low (within the band that counts as one level): on a line that
  // then lies flat, the exact minimum is one of many seconds where nothing happens.
  return `${head} and lowest at ${timecode(from + after.findIndex((level) => level - lowAfter < LEVEL_STEP))}.`;
}
