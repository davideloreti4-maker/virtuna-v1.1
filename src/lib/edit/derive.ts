/**
 * derive.ts — what follows from an EditSpec without being stored in it.
 *
 * The film's length is the main sequence (spec §3): segments play in order with no gaps, so a
 * segment's first frame is the sum of the lengths before it.
 */
import type { EditSpec } from "./spec";
import { frameMs, sourceMs, spanMs } from "./time";

/** The first frame of each main segment; one entry more than there are segments, the last being the film's length. */
export function starts(spec: EditSpec): number[] {
  const out = [0];
  let at = 0;
  for (const seg of spec.main) {
    at += seg.len;
    out.push(at);
  }
  return out;
}

/** The film's length in frames. */
export function total(spec: EditSpec): number {
  return spec.main.reduce((n, seg) => n + seg.len, 0);
}

export interface SegmentWindow {
  /** its first frame on the film */
  start: number;
  /** its start and length on the film, in milliseconds */
  atMs: number;
  lenMs: number;
  /** where in the source it starts, and how much of the source it uses (0 for an image) */
  inMs: number;
  usedMs: number;
}

/** Where the segment at `index` sits on the film and what it takes from its source (spec §3.2). */
export function windowOf(spec: EditSpec, index: number): SegmentWindow {
  const seg = spec.main[index];
  if (!seg) throw new RangeError(`the edit has no segment ${index}`);
  const start = starts(spec)[index] ?? 0;
  const image = spec.assets[seg.asset]?.kind === "image";
  return {
    start,
    atMs: frameMs(start),
    lenMs: spanMs(start, seg.len),
    inMs: image ? 0 : seg.inMs,
    usedMs: image ? 0 : sourceMs(start, seg.len, seg.speed),
  };
}

/**
 * The frame an item starts on, counted from the film's first frame. A pinned item counts from its
 * segment's first frame; null when the pin names no segment.
 */
export function frameOf(spec: EditSpec, item: { pin: string | null; at: number }): number | null {
  if (item.pin == null) return item.at;
  const index = spec.main.findIndex((seg) => seg.id === item.pin);
  if (index < 0) return null;
  return (starts(spec)[index] ?? 0) + item.at;
}
