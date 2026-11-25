import type { NetworkId } from "@/lib/brain/cortex-sim";
import { timecode } from "./format";

/**
 * The Brain page in words: what each signal stands for and where it stands against its resting
 * level. Read off the model's own levels (`brain-track.ts`, 0 to 100); nothing here is measured.
 */

/** Points within which a level counts as at rest. */
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
