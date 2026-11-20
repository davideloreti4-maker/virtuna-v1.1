import type { Audience } from "./types";

/**
 * How long the simulated audience watches on average, in seconds: the area under the
 * still-watching line. A scene's loss is spread evenly over that scene, because the engine does
 * not say when inside a scene a viewer leaves.
 *
 * The older helper (`watchStatsOf`) counts every leaver at the START of their scene and reads low.
 */
export function avgWatchSeconds(audience: Audience): number {
  const { points } = audience;
  let area = 0;
  for (let i = 1; i < points.length; i++) {
    const [t0, v0] = points[i - 1]!;
    const [t1, v1] = points[i]!;
    area += ((v0 + v1) / 2) * (t1 - t0);
  }
  return area / 100;
}
