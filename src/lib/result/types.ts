import type { HeatmapPayload } from "@/lib/engine/types";
import type { Archetype } from "@/lib/engine/wave3/persona-registry";

/**
 * The result page of the new look reads a stored simulation through these types
 * (spec: docs/superpowers/specs/2026-11-19-result-page-design.md).
 *
 * Timing, as the engine stores it: a simulated viewer's `swipe_predicted_at` is the START of the
 * scene they leave in. Nothing says when inside that scene. So the share still watching is known
 * at the END of each scene and nowhere in between.
 */

/** What the page reads from `GET /api/analysis/[id]`. Everything is optional: rows vary by age. */
export interface ResultRow {
  id: string;
  engine_version?: string | null;
  input_mode?: string | null;
  video_storage_path?: string | null;
  /** True while the run is in flight (the endpoint derives it). */
  processing?: boolean | null;
  /** When the run was started (ISO). Tells a run in flight from one whose pipeline died. */
  created_at?: string | null;
  heatmap?: HeatmapPayload | null;
  persona_behavioral_aggregate?: {
    share_pct?: number | null;
    comment_pct?: number | null;
    save_pct?: number | null;
    loop_pct?: number | null;
  } | null;
  variants?: {
    filmstrip_segments?: Array<{ idx: number; keyframe_uri?: string | null }> | null;
  } | null;
}

export interface Scene {
  index: number;
  /** Seconds. */
  t0: number;
  t1: number;
  /** A still of the scene, while its address lasts (about 30 days after the run). */
  frame: string | null;
  /** The engine's one sentence on what is on screen. Null when it has none worth showing. */
  description: string | null;
}

export interface Viewer {
  group: Archetype;
  /** The share of the audience this viewer carries, 0 to 100. The ten add up to 100. */
  weight: number;
  /** Carries a real share of the result (10% or more). Six of the ten do on most runs. */
  heavy: boolean;
  /** The scene they leave in, or null when they watch to the end. */
  leftScene: number | null;
}

/** `[seconds, percent still watching]`. */
export type CurvePoint = readonly [t: number, pct: number];

export interface Audience {
  /** The clip's length in seconds: the end of the last scene. */
  clipS: number;
  scenes: Scene[];
  viewers: Viewer[];
  /** 100% at 0:00, then one point at the end of each scene. `points[k + 1]` ends scene k. */
  points: CurvePoint[];
}

export interface Headline {
  /** Whole percent. */
  value: number;
  label: string;
}

export type VerdictKind = "opening" | "early" | "middle" | "ending" | "leak" | "holds";

export interface Verdict {
  kind: VerdictKind;
  sentence: string;
  /** The scene the sentence names. The page's one coral mark. Null when it names none. */
  scene: number | null;
}

export type GroupStatus = "watching" | "leaving" | "left" | "absent";

export interface GroupRow {
  group: Archetype;
  name: string;
  /** False when the run has no viewer of this group. */
  present: boolean;
  /** The group's share of the audience, 0 to 100. */
  weight: number;
  heavy: boolean;
  /** The part of the group's weight still watching at the playhead, 0 to 1. */
  lit: number;
  status: GroupStatus;
  /** The end of the scene its last viewer leaves in (seconds); null while any of them stays. */
  leftBy: number | null;
  /** Every viewer of the group leaves in the scene the sentence names. */
  named: boolean;
}

export interface Intent {
  id: "share" | "comment" | "rewatch" | "save";
  label: string;
  /** The engine's 0 to 100 intent index. It has no threshold for "low" or "high". */
  value: number;
}

export interface VideoModel {
  id: string;
  /** "Video · 0:29" */
  title: string;
  clipS: number;
  audience: Audience;
  headline: Headline;
  verdict: Verdict;
  /** The scene the sentence names, or null. */
  moment: Scene | null;
  avgWatchS: number;
  /** Longest first. Null when the run stored none. */
  intents: Intent[] | null;
  /** The storage path of the video, for `/api/videos/sign`. Null when there is no file to play. */
  videoPath: string | null;
}

export type ResultState =
  | { kind: "loading" }
  /** `startedAt`: when the run began (ms), for the running screen's clock; null when unknown. */
  | { kind: "running"; id: string; startedAt: number | null }
  /** Still marked as in flight long after any run ends: the pipeline died and nothing will arrive. */
  | { kind: "stalled"; id: string }
  | { kind: "no-audience"; id: string; title: string; videoPath: string | null }
  | { kind: "result"; model: VideoModel };
