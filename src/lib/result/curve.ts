import { getPersonaWeight, normalizeOverSurvivors } from "@/lib/engine/wave3/weighted-aggregator-client";
import { ARCHETYPES, type Archetype } from "@/lib/engine/wave3/persona-registry";
import type { Audience, CurvePoint, ResultRow, Scene, Viewer } from "./types";

/** A viewer who carries 10% or more of the audience. One of them is about 15 points. */
export const HEAVY_PCT = 10;

const KNOWN_GROUPS = new Set<string>(ARCHETYPES);

/** The engine writes one sentence per scene. Prompt text and stubs are not one. */
function descriptionOf(label: string | undefined): string | null {
  const text = label?.trim() ?? "";
  if (text.length < 8 || /^instruction\b/i.test(text)) return null;
  return text;
}

/**
 * The run's simulated audience: its scenes, its viewers by weight, and the still-watching line.
 *
 * Null when the run has no audience the page can show:
 *  - no stored heatmap, no scenes, no viewers or no weights;
 *  - no viewer carries a leaving time at all (a row from before the field existed);
 *  - a viewer without a known group. That is also how the heatmap the endpoint MAKES UP for a
 *    row without one is told from a stored one (`synthHeatmap` in api/analysis/[id]: ten 3-second
 *    scenes, viewers without a group). Its curve was never simulated and must not be drawn.
 *
 * The share after each scene is the same arithmetic as `retentionCurveOf` (ambient-v2-drill), with
 * the aggregator's own weights; a test holds the two together.
 */
export function audienceOf(row: ResultRow | null | undefined): Audience | null {
  const heatmap = row?.heatmap;
  const segments = heatmap?.segments ?? [];
  const people = heatmap?.personas ?? [];
  if (!heatmap || segments.length === 0 || people.length === 0 || !heatmap.weights) return null;
  if (!people.some((p) => "swipe_predicted_at" in p)) return null;
  if (!people.every((p) => typeof p.archetype === "string" && KNOWN_GROUPS.has(p.archetype))) return null;

  const weights = normalizeOverSurvivors(people, heatmap.weights);
  const raw = people.map((p) => getPersonaWeight(p.slot_type, weights));
  const total = raw.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return null;

  const frames = row?.variants?.filmstrip_segments ?? [];
  const scenes: Scene[] = segments.map((s, index) => ({
    index,
    t0: s.t_start,
    t1: s.t_end,
    frame: frames.find((f) => f.idx === s.idx)?.keyframe_uri ?? s.keyframe_uri ?? null,
    description: descriptionOf(s.label),
  }));

  const viewers: Viewer[] = people.map((p, i) => {
    const weight = (raw[i]! / total) * 100;
    const at = p.swipe_predicted_at;
    // Gone from the first scene that starts at or after the stored second: the engine's own rule.
    const first = at == null ? -1 : segments.findIndex((s) => s.t_start >= at);
    return {
      group: p.archetype as Archetype,
      weight,
      heavy: weight >= HEAVY_PCT,
      leftScene: first < 0 ? null : first,
    };
  });

  const points: CurvePoint[] = [
    [0, 100],
    ...scenes.map(
      (scene) =>
        [
          scene.t1,
          viewers.reduce((sum, v) => sum + (v.leftScene == null || v.leftScene > scene.index ? v.weight : 0), 0),
        ] as const,
    ),
  ];

  return { clipS: scenes[scenes.length - 1]!.t1, scenes, viewers, points };
}

/**
 * The line's value at a time. Between two points it is a straight line: inside a scene nobody
 * knows when a viewer leaves, so its loss is drawn as a slope across it.
 */
export function watchingAt(points: readonly CurvePoint[], t: number): number {
  const first = points[0]!;
  if (t <= first[0]) return first[1];
  for (let i = 1; i < points.length; i++) {
    const [t1, v1] = points[i]!;
    if (t <= t1) {
      const [t0, v0] = points[i - 1]!;
      return t1 === t0 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return points[points.length - 1]![1];
}

/** The scene under a time. A border belongs to the scene that starts there; the end to the last. */
export function sceneIndexAt(scenes: readonly Scene[], t: number): number {
  const i = scenes.findIndex((s) => t < s.t1);
  return i < 0 ? scenes.length - 1 : i;
}

/**
 * What the readout shows while the playhead moves: a STORED value, the share at the end of the
 * scene under it ("71% · 0:03"), never a value read off the slope.
 */
export function sceneEndShareAt(audience: Audience, t: number): { pct: number; at: number } {
  const scene = audience.scenes[sceneIndexAt(audience.scenes, t)]!;
  return { pct: Math.round(audience.points[scene.index + 1]![1]), at: scene.t1 };
}
