/** types.ts — what every part of the kit is given. */
import type { Item, Mark, PartId } from "../../../lib/edit";

/** A part's own settings, as its schema in `src/lib/edit/parts.ts` types them. */
export type SettingsOf<P extends PartId> = Extract<Mark | Item, { part: P }>["props"];

export interface PartProps<P extends PartId> {
  settings: SettingsOf<P>;
  /** Its first film frame. */
  at: number;
  /** How many frames it shows, counted from that frame. */
  frames: number;
  /** True when it shows up to the film's last frame: it then holds to the end and does not go out. */
  toEnd: boolean;
  /** How many frames of its own run are already gone on its first shown frame. A part counts its own time from there, so one that is already running does not come in again. */
  skip: number;
  /** The address of the file it plays; null when it plays none. */
  src: string | null;
  /** What kind of file that is; null when it plays none. */
  kind: "video" | "image" | "audio" | null;
  /** Where in that file it is on its first shown frame, in milliseconds; null when it plays none. */
  fileMs: number | null;
}

/**
 * The nearest even whole number. The kit sets its type in whole pixels: a size, a line height, a
 * place. Chrome and Safari round a part of a pixel differently, which moved the third line of a
 * title two pixels from where the renderer put it; and a box of even height and width is centred
 * on whole pixels, not between two.
 */
export const even = (value: number): number => 2 * Math.round(value / 2);

/** Holds a value between two others. */
export const hold = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));
