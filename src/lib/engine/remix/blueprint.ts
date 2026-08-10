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

/**
 * Which beat a weak factor is really about.
 *
 * Keyed by the CLOSED enum in HookFactorSchema (qwen/schemas.ts:63-74) — "Scroll-Stop Power",
 * "Completion Pull", "Rewatch Potential", "Share Trigger", "Emotional Charge". Nothing else can
 * reach here. The previous `/hook|open|first/i` test matched none of the five, so it was dead:
 * a 2/10 Scroll-Stop Power — which IS the hook factor — landed on a body beat while the hook
 * beat reported no weakness at all.
 *
 * Lower-cased keys because omniOutputToStructuralInput (decode.ts:238) casts `factors` through
 * `as unknown` without re-validating, so casing is not actually guaranteed at this boundary.
 */
const FACTOR_TARGET_ROLE: Record<string, BeatRole> = {
  "scroll-stop power": "hook",
  "completion pull": "setup",
  "emotional charge": "turn",
  "share trigger": "close",
  "rewatch potential": "close",
};

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
 * The index that closes the opening beat at the 3s line, or -1 when no such cut exists.
 *
 * Owner ruling (2026-08-10): the 3s boundary is MANDATORY. normalizeSegments already guarantees
 * it at cell level via enforceHookZoneBoundary (normalize-segments.ts:119), but the merge used to
 * throw it away — on a 60s video the opening beat came out ~7.5s long and was still labelled
 * "hook". For a product built on the first three seconds that is a misstatement, and Task 6
 * renders it.
 *
 * We cut at the boundary landing exactly on 3s. When a grid has no such boundary (never true of
 * normalized input, but cheap to survive) we take the boundary BEFORE it, so the opening beat is
 * never longer than the hook zone it claims to be.
 */
function hookCutIndex(segments: Segment[]): number {
  const after = segments.findIndex((s) => s.t_start >= HOOK_ZONE_END_S);
  if (after <= 0) return -1;
  const exact = segments[after]!.t_start === HOOK_ZONE_END_S;
  const idx = exact ? after : after - 1;
  return idx > 0 ? idx : -1;
}

/**
 * Pick the cut nearest `target`, snapping to a real scene boundary when one is available.
 * Returns null when nothing in range is still free.
 */
function nearestCut(
  target: number,
  preferred: number[],
  lo: number,
  hi: number,
  taken: Set<number>,
): number | null {
  const free = (i: number) => i > lo && i < hi && !taken.has(i);
  let best: number | null = null;
  let bestDist = Infinity;
  for (const p of preferred) {
    if (!free(p)) continue;
    const d = Math.abs(p - target);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  if (best !== null) return best;
  return free(target) ? target : null;
}

/**
 * Merge raw cells into at most MAX_BEATS groups of contiguous segments.
 *
 * The budget is spent as: one beat for the hook (cut fixed at 3s) + the rest spread evenly across
 * the body, each spread target snapped to the nearest real `scene_boundary_reason` when one is in
 * reach. Cells are never dropped or reordered, so the timeline stays continuous.
 *
 * This used to keep the EARLIEST MAX_BEATS-1 preferred boundaries, which degenerates badly:
 * buildFixedBuckets (normalize-segments.ts:227,240,256) stamps `scene_boundary_reason` on EVERY
 * cell it emits, and it is the deterministic fallback whenever raw segments are absent or
 * malformed. On a 60s fallback grid (30 cells) the first 7 cuts were consumed by the first 7
 * cells and beat 7 swallowed 15-60s — 75% of the video in one beat. Snapping an even spread to
 * real boundaries keeps the "prefer a real cut" intent without letting a dense run of boundaries
 * at the start eat the whole budget.
 */
function groupSegments(segments: Segment[]): Segment[][] {
  if (segments.length <= MAX_BEATS) return segments.map((s) => [s]);

  const preferred: number[] = [];
  segments.forEach((s, i) => {
    if (i > 0 && s.scene_boundary_reason) preferred.push(i);
  });

  const cuts = new Set<number>();

  // The hook beat takes one of the MAX_BEATS; the body gets the remainder.
  const hookCut = hookCutIndex(segments);
  if (hookCut > 0) cuts.add(hookCut);
  const bodyStart = hookCut > 0 ? hookCut : 0;

  const wanted = MAX_BEATS - cuts.size - 1;
  const span = segments.length - bodyStart;
  for (let k = 1; k <= wanted; k++) {
    const target = bodyStart + Math.round((k * span) / (wanted + 1));
    const cut = nearestCut(target, preferred, bodyStart, segments.length, cuts);
    if (cut !== null) cuts.add(cut);
  }

  const cutPoints = [...cuts].sort((a, b) => a - b);

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
function assignRoles(beats: Omit<BlueprintBeat, "role">[], peaksDesc: number[]): BeatRole[] {
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

  // 2. close — the FINAL beat, claimed before the turn.
  //
  // Order matters: the turn is a heuristic, the close is structural. Assigning the turn first
  // let a climax-at-the-end video (a normal shape) consume the last beat and ship a shoot sheet
  // with no closing beat at all.
  if (roles.length > 0 && roles[roles.length - 1] === null) roles[roles.length - 1] = "close";

  // 3. turn — the strongest emotion peak whose beat is still free.
  //
  // A peak landing on the hook or the close is common on short videos (the docstring above says
  // as much), and abandoning the turn there used to leave turnAt = -1, which made step 4 label
  // every remaining beat "setup" — no turn AND no payoff. Walk the peaks strongest-first, then
  // fall back to the first free beat. Only when the source HAS emotion data: inventing a turn on
  // a video with no arc at all would be fabrication, not a fallback.
  if (peaksDesc.length > 0) {
    let turnIdx = -1;
    for (const p of peaksDesc) {
      const i = beats.findIndex((b) => p >= b.t_start && p < b.t_end);
      if (i >= 0 && roles[i] === null) {
        turnIdx = i;
        break;
      }
    }
    if (turnIdx === -1) turnIdx = roles.findIndex((r) => r === null);
    if (turnIdx >= 0) roles[turnIdx] = "turn";
  }

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

  // Emotion peaks → seconds, strongest first. emotion_arc is in MILLISECONDS; segments are in
  // seconds. Strongest-first because the turn falls back down the list (see assignRoles).
  const arc = structural.emotion_arc ?? [];
  const peaksDesc = [...arc]
    .sort((a, b) => b.intensity_0_1 - a.intensity_0_1)
    .map((p) => p.timestamp_ms / 1000);

  const roles = assignRoles(partial, peaksDesc);

  const beats: BlueprintBeat[] = partial.map((b, i) => ({ ...b, role: roles[i]! }));

  // Attach each weak factor to the beat its name actually describes, then to the longest beat
  // still free. Both halves were broken: the old test used the name "pacing", which the model
  // cannot emit, and that is what let the dead branch survive.
  const weak = structural.factors.filter((f) => f.score < WEAK_FACTOR_SCORE);
  for (const f of weak) {
    const wantedRole = FACTOR_TARGET_ROLE[f.name.trim().toLowerCase()];
    const candidates = [
      ...(wantedRole ? beats.filter((b) => b.role === wantedRole) : []),
      // Fallback: the longest beat still free. A factor is never dropped — `factors` is exactly
      // 5 and several legitimately compete for the same role.
      ...[...beats].sort((a, b) => b.duration_s - a.duration_s),
    ];
    const target = candidates.find((b) => b.weakness === null);
    if (target) {
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
