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
import { createLogger } from "@/lib/logger";
import type { OmniStructuralInput } from "./decode-types";

const log = createLogger({ module: "engine.remix.blueprint" });

/** D10 — the cap that keeps the adapt response inside its existing 90s budget. */
export const MAX_BEATS = 8;

/**
 * The stamp `buildFixedBuckets` puts on every cell it emits — and the discriminator for a
 * blueprint assembled from a grid that describes no video at all. See `from_fixed_buckets`.
 *
 * A PREFIX, not an equality: the fallback emits three distinct literals across its two branches
 * (`fixed_bucket_hook_zone` + `fixed_bucket` for >= 8s, `fixed_bucket_short` throughout for < 8s,
 * normalize-segments.ts:227,240,256). Matching one of them would leave the short-video branch —
 * a whole class of fabricated sheet — unflagged.
 */
const FIXED_BUCKET_REASON_PREFIX = "fixed_bucket";

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
 * "Rewatch Potential" is deliberately ABSENT. It is a whole-video property with no single home,
 * and mapping it to `close` made it race Share Trigger — which genuinely IS about the ending —
 * for the same beat. The emission order handed close to Rewatch and pushed Share Trigger onto
 * the longest-free fallback, where it reported a share problem against a mid-video setup beat.
 * Unmapped, it takes the fallback itself and every other factor lands on the role it asked for.
 *
 * Lower-cased keys because omniOutputToStructuralInput (decode.ts:238) casts `factors` through
 * `as unknown` without re-validating, so casing is not actually guaranteed at this boundary.
 */
const FACTOR_TARGET_ROLE: Record<string, BeatRole> = {
  "scroll-stop power": "hook",
  "completion pull": "setup",
  "emotional charge": "turn",
  "share trigger": "close",
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
  /**
   * How long `spoken` actually took to say, when that is NOT this beat's duration. null means
   * the beat's own length is the answer.
   *
   * Non-null is the hook beat's normal condition, not an edge case: `enforceHookZoneBoundary`
   * cuts any cell straddling 3s and CR-01 keeps the whole quote on the left child, so a 0-8s
   * talking cell leaves eight seconds of words on a three-second beat. Handing that to a writer
   * as "3 seconds" produced 23-word hook lines at 7.7 w/s — unsayable (spec §11).
   */
  spoken_span_s: number | null;
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
  /**
   * True when this sheet was assembled from the DETERMINISTIC FALLBACK GRID, not from perception.
   *
   * `normalizeSegments` (qwen/normalize-segments.ts:37) can never return empty. On undefined or
   * empty input, on malformed timestamps, or when normalization leaves fewer than
   * MIN_BOUNDARY_COUNT cells, it returns `buildFixedBuckets(duration)` — a complete grid of
   * evenly-spaced cells whose every `visual_event` and `audio_event` is the string
   * `"segment 12s"`, with no `spoken_text` and no `on_screen_text` anywhere.
   *
   * `buildBlueprint` consumes that happily, and the result is the dangerous shape: a full set of
   * beats with real-looking times and roles, every one of them reading "they show: segment 12s",
   * `has_speech: false`, persisted, carried on the card, and RED NOWHERE. A live verification run
   * would pass on entirely synthetic data with nothing to distinguish it from a real read.
   *
   * Worse, the duration itself is invented in the commonest case: `assembleOmniOutput`
   * (qwen/omni-analysis.ts:255-260) derives `videoDurationSeconds` from the highest raw `t_end`
   * and falls back to a hard-coded 30 when there are no raw segments — which is exactly the
   * branch that then fabricates the grid. So a "30s" fabricated blueprint may describe a video
   * of any length.
   *
   * This flag is the only thing that says so. Consumers must treat a true here as "we hold no
   * timed perception of this video" — the same epistemic position as `emptyBlueprint()`, which
   * reports false because it fabricates nothing.
   */
  from_fixed_buckets: boolean;
}

/**
 * The blueprint of a source we hold no timed perception for.
 *
 * Three callers need one: `/api/remix/adapt` (decodes from a stored `DecodeResult` — no video),
 * the drops pipe (corpus teardowns — no video), and `buildBlueprint` itself on a segment-less
 * source. An empty `beats` is what makes `buildAdaptUserContent` fall through to the
 * concept-only path, so this is the back-compat shape, not a null object.
 *
 * A FACTORY, not a shared const: `beats` is a mutable array, and one exported instance handed
 * to three AdaptInputs would let any of them corrupt the others.
 */
export function emptyBlueprint(): SourceBlueprint {
  // `from_fixed_buckets: false` is a claim, not a default. An empty blueprint fabricates NOTHING
  // — it says "no timed perception", and its zero beats make that self-evident downstream. The
  // fabricated grid says the opposite with a full set of beats, which is why only it is flagged.
  return { duration_s: 0, words_per_second: 0, has_speech: false, beats: [], from_fixed_buckets: false };
}

/**
 * `OmniStructuralInput["segments"]` does not declare the verbatim-speech fields, but the real
 * `SegmentGrid` (qwen/schemas.ts:127-128) does carry `spoken_text` / `on_screen_text` and
 * `normalizeSegments` passes them straight through. They survive because decode.ts:256 assigns
 * the wider producer object into the narrower declared type, which TypeScript permits.
 *
 * Widened locally, and DELIBERATELY still local as of Task 3 — the earlier note here claimed
 * decode-types.ts was "owned by another task and not ours to edit", which is no longer true.
 * The reason is now a different one: widening the canonical type would NOT buy the safety it
 * looks like it buys. `SegmentGrid` declares both fields `.nullable().optional()`, so the
 * canonical copy would be optional too, and a producer that stopped emitting `spoken_text`
 * would still compile clean, still pass every test (the tests supply their own segments), and
 * silently flip the sheet to on-screen-text-driven via `has_speech: false`.
 *
 * What actually catches that is the Task 7 live assertion on a real talking-head video. The
 * real type fix is to declare `segments` AS `SegmentGrid[]` so producer changes propagate —
 * a refactor of the shared omni path, deferred to the whole-branch review, not to this lane.
 */
type Segment = NonNullable<OmniStructuralInput["segments"]>[number] & {
  spoken_text?: string | null;
  on_screen_text?: string | null;
  spoken_span_s?: number;
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
  if (exact) return after;
  // No boundary lands on 3s. Cut at the one before, so the opening beat is SHORTER than the
  // hook zone rather than longer. When that would be index 0 the first cell is itself wider
  // than the zone and no cut can fix it — isolate that cell anyway (cut at 1). Returning -1
  // here used to drop the hook cut entirely and let the even spread merge MORE cells into
  // beat 0: on a 5s-cell grid that produced a 0-20s beat labelled "hook".
  return after - 1 > 0 ? after - 1 : 1;
}

/** The cell index whose start time sits closest to `t`, restricted to the open range (lo, hi). */
function indexNearestTime(segments: Segment[], t: number, lo: number, hi: number): number | null {
  let best: number | null = null;
  let bestDist = Infinity;
  for (let i = lo + 1; i < hi; i++) {
    const d = Math.abs(segments[i]!.t_start - t);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/**
 * Pick the cut for a spread target, snapping to a real scene boundary only when one lies within
 * `radiusSeconds` OF THE TARGET TIME. Returns null when nothing in range is still free.
 *
 * The cap is what makes this "prefer a real cut" rather than "chase the nearest cut anywhere".
 * Uncapped, a cluster of boundaries drags every spread target into it and reproduces exactly the
 * collapse this function was written to fix: 40 cells with boundaries only from cell 30 on — an
 * ordinary talking-head-then-montage shape — put 70% of the video in one beat while the beats
 * inside the cluster were 1.5s each.
 *
 * Half a step is DERIVED, not tuned: it is the unique radius at which a cut cannot cross the
 * midpoint between two adjacent targets, i.e. cannot enter a neighbour's territory. Anything
 * larger lets cuts leapfrog and re-cluster, which is the defect above. It bounds a beat at ~2x
 * its even share — two adjacent cuts can each move half a step in opposite directions — or ~2.3x
 * when a collision makes this return null and drops a cut, merging two slots.
 *
 * The comparison is in SECONDS, matching the domain the targets are spread in. It used to be in
 * cell-index units, which silently broke the derivation once targets became time-derived: cells
 * have no maximum width, so evenly-spaced times map to UNEVENLY spaced indices, and an
 * index-space radius can exceed the actual index gap between adjacent targets. On the 6x20s +
 * 18x1s shape the gap was ~1 index against a radius of 1.64 — a cut could leapfrog its neighbour.
 */
function nearestCut(
  segments: Segment[],
  targetTime: number,
  targetIdx: number,
  preferred: number[],
  lo: number,
  hi: number,
  taken: Set<number>,
  radiusSeconds: number,
): number | null {
  const free = (i: number) => i > lo && i < hi && !taken.has(i);
  let best: number | null = null;
  let bestDist = Infinity;
  for (const p of preferred) {
    if (!free(p)) continue;
    const d = Math.abs(segments[p]!.t_start - targetTime);
    if (d <= radiusSeconds && d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  if (best !== null) return best;
  return free(targetIdx) ? targetIdx : null;
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

  // Spread the body cuts by ELAPSED TIME, not by cell index. Cells have a minimum width
  // (MIN_CELL_WIDTH_S) but NO maximum, so index-spreading gives a 20s cell and a 1s cell equal
  // weight: a static talking head that cuts to a fast montage (6x20s then 18x1s) put 60s of 138s
  // — 43% — into one beat while the montage got six beats. Time-spreading is what makes a beat's
  // share of the budget match its share of the video.
  const bodyStartTime = segments[bodyStart]!.t_start;
  const timeSpan = segments[segments.length - 1]!.t_end - bodyStartTime;
  const timeStep = timeSpan / (wanted + 1);
  const snapRadius = timeStep / 2; // seconds — same domain as the targets
  for (let k = 1; k <= wanted; k++) {
    const targetTime = bodyStartTime + k * timeStep;
    const targetIdx = indexNearestTime(segments, targetTime, bodyStart, segments.length);
    if (targetIdx === null) continue;
    const cut = nearestCut(
      segments, targetTime, targetIdx, preferred, bodyStart, segments.length, cuts, snapRadius,
    );
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

/**
 * Did this grid come out of `buildFixedBuckets`, i.e. is the perception fabricated?
 *
 * EVERY cell, not some. `buildFixedBuckets` stamps its prefix on all of them and is the sole
 * producer of that prefix, so "all" is exactly the condition and "some" would be a slander on a
 * real grid the moment a model wrote the token itself.
 *
 * Sound in the other direction too — a genuine grid cannot reach here all-`fixed_bucket`:
 *  - `scene_boundary_reason` is `.optional()` on SegmentSchema and the omni prompt asks for it as
 *    free prose ("<why this is a scene boundary, optional>"), so real cells carry either nothing
 *    or a sentence.
 *  - `enforceHookZoneBoundary` stamps `hook_zone_split` / `hook_zone_split_continuation`, and
 *    `mergeSubMinSegments` only ever preserves what was already there.
 *  - There is exactly ONE `normalizeSegments` call site (`assembleOmniOutput`, omni-analysis.ts:260),
 *    downstream of the modality-split merge, so a grid is wholly fabricated or wholly real —
 *    it can never be a mix of fabricated and perceived chunks.
 */
function isFixedBucketGrid(segments: Segment[]): boolean {
  // UNREACHABLE from buildBlueprint today — it returns emptyBlueprint() on an empty grid long
  // before this runs. Kept anyway, and this is not the lane's usual "no unreachable fallbacks"
  // case: `[].every()` is vacuously TRUE, so without the guard a future caller handing over an
  // empty grid gets `from_fixed_buckets: true` — a fabrication warning about nothing at all.
  if (segments.length === 0) return false;
  return segments.every(
    (s) => s.scene_boundary_reason?.startsWith(FIXED_BUCKET_REASON_PREFIX) === true,
  );
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
    // Fall back to the first free beat AT OR AFTER the midpoint, not the first free beat
    // overall — that was always beat 1, which left a turn at 3-11s of a 60s video with five
    // payoffs after it and not one setup beat. A turn is a mid-video pivot by definition.
    if (turnIdx === -1) {
      const mid = Math.floor(beats.length / 2);
      turnIdx = roles.findIndex((r, i) => r === null && i >= mid);
      if (turnIdx === -1) turnIdx = roles.findIndex((r) => r === null);
    }
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
  // Prefer the PERCEIVED cells over the normalized grid.
  //
  // They differ in exactly one case: normalizeSegments' Rule 3 count gate fired, discarding a
  // real read of fewer than MIN_BOUNDARY_COUNT cells and substituting fabricated fixed buckets.
  // The gate serves the filmstrip, which needs a cell floor and does not read cell contents.
  // A shoot sheet is the opposite consumer — it merges to MAX_BEATS regardless of how many cells
  // it started from, so cell count is irrelevant here and content is everything. Three real
  // beats carrying transcribed speech beat ten saying "segment 12s".
  //
  // Non-empty is the condition, not presence: an empty array is not perception, and taking it
  // would suppress the from_fixed_buckets warning on a genuinely fabricated sheet.
  const perceived = structural.perceived_segments ?? [];
  const segments: Segment[] = perceived.length > 0 ? perceived : (structural.segments ?? []);

  if (segments.length === 0) {
    return emptyBlueprint();
  }

  const groups = groupSegments([...segments].sort((a, b) => a.t_start - b.t_start));

  const partial: Omit<BlueprintBeat, "role">[] = groups.map((group, index) => {
    const first = group[0]!;
    const last = group[group.length - 1]!;
    const t_start = first.t_start;
    const t_end = last.t_end;
    const duration_s = Number((t_end - t_start).toFixed(2));
    // Only the cells that actually SPEAK contribute to the span — a silent cell merged into a
    // talking one adds beat length, not talking time.
    const span = Number(
      group
        .filter((s) => !!s.spoken_text)
        .reduce((n, s) => n + (s.spoken_span_s ?? s.t_end - s.t_start), 0)
        .toFixed(2),
    );
    return {
      index,
      t_start,
      t_end,
      duration_s,
      // null when the beat's own duration already tells the truth — the ordinary case, and the
      // shape every consumer written before this field can keep assuming.
      spoken_span_s: span > 0 && span !== duration_s ? span : null,
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
  // still free. The old regex here matched none of the five names the schema can emit, and the
  // old test used the name "pacing", which the model cannot emit — which is what let the dead
  // branch survive review.
  //
  // TWO passes, and the order is load-bearing: a single pass let an earlier factor's *fallback*
  // claim take a beat that a later factor had an exact-role claim on. In the schema's own
  // emission order that is the common case, not a corner — Emotional Charge is emitted LAST, so
  // Share Trigger's fallback took the turn beat and displaced the one near-tautological mapping
  // (the turn IS the emotion-peak beat).
  const weak = structural.factors.filter((f) => f.score < WEAK_FACTOR_SCORE);
  const attach = (b: BlueprintBeat, f: (typeof weak)[number]) => {
    b.weakness = { factor: f.name, score: f.score, tip: f.improvement_tip ?? f.rationale };
  };

  const unplaced: typeof weak = [];
  for (const f of weak) {
    const wantedRole = FACTOR_TARGET_ROLE[f.name.trim().toLowerCase()];
    const target = wantedRole
      ? beats.find((b) => b.role === wantedRole && b.weakness === null)
      : undefined;
    if (target) attach(target, f);
    else unplaced.push(f);
  }

  // Pass 2 — everything that could not have the role it wanted goes to the longest free beat.
  // A factor is never dropped: `factors` is exactly 5 and several legitimately compete.
  const byDuration = [...beats].sort((a, b) => b.duration_s - a.duration_s);
  for (const f of unplaced) {
    const target = byDuration.find((b) => b.weakness === null);
    if (target) attach(target, f);
  }

  const totalWords = beats.reduce((n, b) => n + wordCount(b.spoken), 0);
  const duration_s = Number((beats[beats.length - 1]!.t_end - beats[0]!.t_start).toFixed(2));

  // Rate the words against SPEAKING time, not wall-clock. Dividing by the video's length folds
  // every silent beat into the denominator and reports a delivery nobody used: a 12-word line
  // spoken over 8 seconds of a 20-second video is 1.5 w/s, not 0.6. The adapt prompt calls this
  // "the source's speech rate" and writes lines against it, so the distinction is load-bearing.
  const speakingSeconds = beats.reduce(
    (n, b) => (b.spoken ? n + (b.spoken_span_s ?? b.duration_s) : n),
    0,
  );

  const from_fixed_buckets = isFixedBucketGrid(segments);
  if (from_fixed_buckets) {
    // Warn HERE, at assembly, not at the fallback. normalizeSegments already logs the fallback,
    // but that line is one of thousands in an analyze run and says nothing about a shoot sheet.
    // This one names the artefact that reached the creator: a sheet of N beats over D seconds
    // with no source speech in it, which is what makes a synthetic Task 7 run visible.
    log.warn("blueprint assembled from FABRICATED fixed-bucket segments — not real perception", {
      duration_s,
      beats: beats.length,
      cells: segments.length,
      has_speech: totalWords > 0,
    });
  }

  return {
    duration_s,
    words_per_second: speakingSeconds > 0 ? Number((totalWords / speakingSeconds).toFixed(2)) : 0,
    has_speech: totalWords > 0,
    beats,
    from_fixed_buckets,
  };
}
