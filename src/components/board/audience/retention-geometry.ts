/**
 * Shared coordinate geometry for the Audience retention curve.
 *
 * Extracted so both the curve renderer (RetentionChart) and the interactive
 * scrubber (RetentionPlayer) agree on the exact same mapping from a time /
 * retention value to viewBox space. Pure functions — no React, no DOM.
 *
 * The curve is drawn in a fixed viewBox stretched to the container width with
 * `preserveAspectRatio="none"`, so horizontal position maps cleanly to a 0-1
 * fraction of the duration (and therefore to a CSS `left: %` for DOM overlays).
 */
import type { HeatmapPayload } from '@/lib/engine/types';

export const VB_W = 600;
export const VB_H = 138;
export const PAD_TOP = 14; // headroom for the drop label / lock line
export const FLOOR_Y = 136;

/** Map a 0-1 retention value into the plot band (top = 1.0, floor = 0.0). Pure. */
export function yForValue(v: number): number {
  return PAD_TOP + (1 - clamp01(v)) * (FLOOR_Y - PAD_TOP);
}

/** x for a point at curve index i = segment.t_start / total mapped across VB_W. Pure. */
export function xForIndex(
  segments: HeatmapPayload['segments'],
  i: number,
  pointCount: number,
  total: number,
): number {
  const seg = segments[i];
  const t = seg ? seg.t_start : (i / Math.max(1, pointCount - 1)) * total;
  return (t / total) * VB_W;
}

/** x in viewBox space for an absolute time (seconds). Pure. */
export function xForTime(tSec: number, total: number): number {
  const safe = total > 0 ? total : 1;
  return (Math.max(0, Math.min(safe, tSec)) / safe) * VB_W;
}

/** Clamp to [0,1]. */
export function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Interpolated retention (0-1) at an absolute time, matching the drawn curve.
 *
 * Points are placed at each segment's `t_start` (falling back to an even spread
 * when segments are absent), and the value is linearly interpolated between the
 * two bracketing points. Before the first / after the last point the value is
 * held flat — mirroring how the curve path terminates at the last sample.
 */
export function retentionAt(
  normalized: number[],
  segments: ReadonlyArray<{ t_start: number }> | null | undefined,
  total: number,
  tSec: number,
): number {
  const n = normalized.length;
  if (n === 0) return 0;
  if (n === 1) return clamp01(normalized[0] ?? 0);

  const safeTotal = total > 0 ? total : 1;
  const t = Math.max(0, Math.min(safeTotal, tSec));

  const timeFor = (i: number): number => {
    const seg = segments?.[i];
    return seg ? seg.t_start : (i / (n - 1)) * safeTotal;
  };

  if (t <= timeFor(0)) return clamp01(normalized[0] ?? 0);
  if (t >= timeFor(n - 1)) return clamp01(normalized[n - 1] ?? 0);

  for (let i = 1; i < n; i++) {
    const t1 = timeFor(i);
    if (t <= t1) {
      const t0 = timeFor(i - 1);
      const span = t1 - t0 || 1;
      const f = (t - t0) / span;
      const v0 = normalized[i - 1] ?? 0;
      const v1 = normalized[i] ?? 0;
      return clamp01(v0 + f * (v1 - v0));
    }
  }
  return clamp01(normalized[n - 1] ?? 0);
}
