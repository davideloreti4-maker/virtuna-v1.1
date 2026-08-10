/**
 * blueprint.ts — the timed structural skeleton of a source video.
 *
 * Deterministic assembly from what analyzeVideoWithOmni ALREADY returns. No model call, no
 * new spend: the perception is paid for on every remix run and was previously discarded at
 * runDecode, which collapses everything below into four prose sentences.
 *
 * D10 (owner, 2026-08-10): raw segments merge to at most MAX_BEATS. normalize-segments sets
 * MIN_CELL_WIDTH_S = 1 with NO upper bound on count, so a 30s video arrives as 20+ one-second
 * cells. Handing those to adapt un-merged produces ~180 generated strings against a 90s
 * timeout — truncated JSON, failed Zod parse, graceful adapt_failed on most real videos.
 * 8 beats is also closer to how a creator thinks about a shoot than 20 one-second cells.
 */
import type { OmniStructuralInput } from "./decode-types";

/** D10 — the cap that keeps the adapt response inside its existing 90s budget. */
export const MAX_BEATS = 8;

/** Below this factor score a beat is flagged for repair rather than replication. */
const WEAK_FACTOR_SCORE = 5;

/** Mirrors HOOK_ZONE_END_S in qwen/normalize-segments.ts — the first-3s window. */
const HOOK_ZONE_END_S = 3;

export type BeatRole = "hook" | "setup" | "turn" | "payoff" | "close";

export interface BlueprintBeat {
  index: number;
  t_start: number;
  t_end: number;
  duration_s: number;
  role: BeatRole;
  /** Verbatim source speech, joined across merged segments. null on a silent beat. */
  spoken: string | null;
  on_screen_text: string | null;
  visual_event: string;
  audio_event: string;
  /** How many raw segment boundaries this beat absorbed. */
  cuts: number;
  weakness: { factor: string; score: number; tip: string } | null;
}

export interface SourceBlueprint {
  duration_s: number;
  /** Source speech rate — the matching target for adapted lines. 0 when there is no speech. */
  words_per_second: number;
  /** false on slideshow / silent sources: the sheet goes on-screen-text-driven. */
  has_speech: boolean;
  beats: BlueprintBeat[];
}

/**
 * `OmniStructuralInput["segments"]` does not declare the verbatim-speech fields, but the real
 * `SegmentGrid` (qwen/schemas.ts) does carry `spoken_text` / `on_screen_text` and
 * `normalizeSegments` passes them straight through. Widened locally — decode-types.ts is
 * owned by another task and is not ours to edit.
 */
type Segment = NonNullable<OmniStructuralInput["segments"]>[number] & {
  spoken_text?: string | null;
  on_screen_text?: string | null;
};

function wordCount(s: string | null | undefined): number {
  if (!s) return 0;
  return s.trim().split(/\s+/u).filter(Boolean).length;
}

/**
 * Merge raw cells into at most MAX_BEATS groups of contiguous segments.
 *
 * Boundary preference: a segment that declares a `scene_boundary_reason` is a real cut and is
 * a better place to split than an arbitrary one. We keep those boundaries first, then fall back
 * to even distribution — never dropping or reordering a cell, so the timeline stays continuous.
 */
function groupSegments(segments: Segment[]): Segment[][] {
  if (segments.length <= MAX_BEATS) return segments.map((s) => [s]);

  const preferred = new Set<number>();
  segments.forEach((s, i) => {
    if (i > 0 && s.scene_boundary_reason) preferred.add(i);
  });

  // Start from the preferred cuts; if there are too many, keep the earliest MAX_BEATS-1.
  let cutPoints = [...preferred].sort((a, b) => a - b).slice(0, MAX_BEATS - 1);

  // Too few real boundaries — top up with an even spread so we still use the budget.
  if (cutPoints.length < MAX_BEATS - 1) {
    const step = segments.length / MAX_BEATS;
    for (let k = 1; k < MAX_BEATS && cutPoints.length < MAX_BEATS - 1; k++) {
      const idx = Math.round(k * step);
      if (idx > 0 && idx < segments.length && !cutPoints.includes(idx)) cutPoints.push(idx);
    }
    cutPoints = cutPoints.sort((a, b) => a - b).slice(0, MAX_BEATS - 1);
  }

  const groups: Segment[][] = [];
  let start = 0;
  for (const cut of cutPoints) {
    groups.push(segments.slice(start, cut));
    start = cut;
  }
  groups.push(segments.slice(start));
  return groups.filter((g) => g.length > 0);
}

function joinText(values: Array<string | null | undefined>): string | null {
  const parts = values.map((v) => v?.trim()).filter((v): v is string => !!v);
  return parts.length ? parts.join(" ") : null;
}

/**
 * Assign roles. Order matters and resolves a real overlap: `is_hook_zone` is mechanically
 * `t_start < 3` (normalize-segments.ts:272), NOT a model judgment, and on a short video the
 * emotion peak frequently falls inside those same 3 seconds. Hook wins.
 */
function assignRoles(beats: Omit<BlueprintBeat, "role">[], peakSeconds: number | null): BeatRole[] {
  const roles: (BeatRole | null)[] = beats.map(() => null);

  // 1. hook — the beats lying inside the first 3s.
  //
  // NOT plain `t_start < 3`. A MERGED beat can open at 2s and run to 6s, and calling four
  // seconds of body "the hook" would swallow the setup. In production this never diverges:
  // enforceHookZoneBoundary (normalize-segments.ts:119) splits any raw segment straddling the
  // 3s line, so `t_start < 3` and "wholly inside the zone" are the same set. It diverges only
  // on a merged or un-normalized beat, and there containment is the honest reading.
  // Beat 0 is always the hook when it opens in the zone, so a source whose first beat spans
  // the whole window still gets one.
  beats.forEach((b, i) => {
    const opensTheVideo = i === 0;
    const whollyInZone = b.t_end <= HOOK_ZONE_END_S;
    if (b.t_start < HOOK_ZONE_END_S && (opensTheVideo || whollyInZone)) roles[i] = "hook";
  });

  // 2. turn — the beat containing the emotion peak, unless it is already the hook
  if (peakSeconds !== null) {
    const turnIdx = beats.findIndex((b) => peakSeconds >= b.t_start && peakSeconds < b.t_end);
    if (turnIdx >= 0 && roles[turnIdx] === null) roles[turnIdx] = "turn";
  }

  // 3. close — the final beat, unless already tagged
  if (roles.length > 0 && roles[roles.length - 1] === null) roles[roles.length - 1] = "close";

  // 4. setup before the turn, payoff after it
  const turnAt = roles.indexOf("turn");
  roles.forEach((r, i) => {
    if (r !== null) return;
    roles[i] = turnAt >= 0 && i < turnAt ? "setup" : turnAt >= 0 ? "payoff" : "setup";
  });

  return roles as BeatRole[];
}

export function buildBlueprint(structural: OmniStructuralInput): SourceBlueprint {
  const segments: Segment[] = structural.segments ?? [];

  if (segments.length === 0) {
    return { duration_s: 0, words_per_second: 0, has_speech: false, beats: [] };
  }

  const groups = groupSegments([...segments].sort((a, b) => a.t_start - b.t_start));

  const partial: Omit<BlueprintBeat, "role">[] = groups.map((group, index) => {
    const first = group[0]!;
    const last = group[group.length - 1]!;
    const t_start = first.t_start;
    const t_end = last.t_end;
    return {
      index,
      t_start,
      t_end,
      duration_s: Number((t_end - t_start).toFixed(2)),
      spoken: joinText(group.map((s) => s.spoken_text)),
      on_screen_text: joinText(group.map((s) => s.on_screen_text)),
      visual_event: group.map((s) => s.visual_event).filter(Boolean).join(" → "),
      audio_event: first.audio_event ?? "",
      cuts: group.length,
      weakness: null,
    };
  });

  // Emotion peak → seconds. emotion_arc is in MILLISECONDS; segments are in seconds.
  const arc = structural.emotion_arc ?? [];
  const peak = arc.length
    ? arc.reduce((best, p) => (p.intensity_0_1 > best.intensity_0_1 ? p : best), arc[0]!)
    : null;
  const peakSeconds = peak ? peak.timestamp_ms / 1000 : null;

  const roles = assignRoles(partial, peakSeconds);

  // A weak factor is attached to the beat whose role it most plausibly describes. We do not
  // invent a mapping we cannot support: hook-named factors land on the hook beat, everything
  // else lands on the longest beat, which is where a pacing or structure problem actually lives.
  const weak = structural.factors.filter((f) => f.score < WEAK_FACTOR_SCORE);
  const beats: BlueprintBeat[] = partial.map((b, i) => ({ ...b, role: roles[i]! }));

  for (const f of weak) {
    const isHookFactor = /hook|open|first/i.test(f.name);
    const target = isHookFactor
      ? beats.find((b) => b.role === "hook")
      : [...beats].sort((a, b) => b.duration_s - a.duration_s)[0];
    if (target && target.weakness === null) {
      target.weakness = { factor: f.name, score: f.score, tip: f.improvement_tip ?? f.rationale };
    }
  }

  const totalWords = beats.reduce((n, b) => n + wordCount(b.spoken), 0);
  const duration_s = Number((beats[beats.length - 1]!.t_end - beats[0]!.t_start).toFixed(2));

  return {
    duration_s,
    words_per_second: duration_s > 0 ? Number((totalWords / duration_s).toFixed(2)) : 0,
    has_speech: totalWords > 0,
    beats,
  };
}
