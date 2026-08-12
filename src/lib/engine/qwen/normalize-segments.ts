/**
 * D-07 + D-08: Server-side segment normalizer for Wave 0 hybrid segment grid.
 *
 * Applies three normalization rules before segments reach any downstream consumer
 * (Pass 2, filmstrip queue, HeatmapPayload assembly):
 *
 *   Rule 1: Merge any segment with width < 1s into adjacent (prefer next; if last → previous).
 *   Rule 2: Hook zone (0 <= t < 3) is ALWAYS its own segment — never merged across the 3s boundary.
 *   Rule 3: If post-normalization segment count < 4 OR timestamps malformed → fall back to
 *            deterministic fixed buckets (2s for >= 8s videos; 1s for < 8s videos).
 *
 * Entry point: normalizeSegments(raw, videoDurationSeconds)
 * Always returns a non-empty SegmentGrid[] with is_hook_zone + idx set on every segment.
 */

import { createLogger } from "@/lib/logger";
import type { SegmentGrid } from "./schemas";

const log = createLogger({ module: "engine.qwen.normalize-segments" });

export const HOOK_ZONE_END_S       = 3;
export const MIN_CELL_WIDTH_S      = 1;
export const MIN_BOUNDARY_COUNT    = 4;
export const SHORT_VIDEO_THRESHOLD_S = 8;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface NormalizedSegments {
  /**
   * The grid EVERY existing consumer gets — Pass 2, the filmstrip queue, HeatmapPayload.
   * Rule 3 applies: fabricated fixed buckets whenever the perceived read is unusable OR
   * simply too short. Non-empty always.
   */
  segments: SegmentGrid[];
  /**
   * The cells actually perceived: Rules 1 + 2 applied, Rule 3's COUNT gate not.
   *
   * Rule 3 is destructive by design — it does not pad a 3-cell read up to four, it discards
   * it and returns `buildFixedBuckets` instead. That is right for the filmstrip, which breaks
   * below a cell floor and does not care what is in the cells. It is wrong for a consumer that
   * needs CONTENT and merges the grid down anyway (buildBlueprint, capped at 8 beats): there,
   * a short real read is strictly better than a long fabricated one.
   *
   * null when no honest alternative exists — empty input (nothing was perceived) or malformed
   * timestamps (the read is broken, and its times cannot be trusted to place anything on a
   * timeline). In both of those cases `segments` is fabricated and that is all there is.
   */
  perceived: SegmentGrid[] | null;
}

/**
 * Normalize a raw model-emitted segments array per D-07 + D-08, keeping BOTH results.
 *
 * @param raw                 - segments[] from OmniAnalysisZodSchema (may be undefined/empty)
 * @param videoDurationSeconds - total video length in seconds (used for fixed-bucket fallback)
 */
export function normalizeSegmentsDetailed(
  raw: SegmentGrid[] | undefined,
  videoDurationSeconds: number,
): NormalizedSegments {
  // Guard: undefined / empty → immediate fallback
  if (!raw || raw.length === 0) {
    log.warn("normalizeSegments: empty/undefined input — falling back to fixed buckets", {
      videoDurationSeconds,
    });
    return { segments: buildFixedBuckets(videoDurationSeconds), perceived: null };
  }

  // Guard: malformed timestamps
  if (hasMalformedTimestamps(raw)) {
    log.warn("normalizeSegments: malformed timestamps detected — falling back to fixed buckets", {
      videoDurationSeconds,
      firstSegment: raw[0],
    });
    return { segments: buildFixedBuckets(videoDurationSeconds), perceived: null };
  }

  // Step 1: Enforce hook-zone boundary (split any segment that straddles t=3)
  let segments = enforceHookZoneBoundary(raw);

  // Step 2: Merge sub-1s segments (Rule 1; respects Rule 2 — no merge across 3s boundary)
  segments = mergeSubMinSegments(segments);

  // Step 4 (hoisted): set is_hook_zone + idx. Done BEFORE the Rule 3 branch so the perceived
  // grid a fallback carries away is annotated identically to one that passes the gate — a
  // consumer reading `perceived` must not be able to tell which branch produced it.
  const perceived = annotateSegments(segments);

  // Step 3: Fallback check — if count < MIN_BOUNDARY_COUNT after normalization.
  //
  // The perceived cells ride along. `cellsWithSpeech` is the diagnostic that distinguishes the
  // two reasons a shoot sheet comes out speechless: the model returned no per-segment verbatim,
  // or it did and this gate threw it away. Without it both look identical downstream.
  if (perceived.length < MIN_BOUNDARY_COUNT) {
    log.warn("normalizeSegments: post-normalization count below minimum — falling back to fixed buckets", {
      count: perceived.length,
      videoDurationSeconds,
      cellsWithSpeech: perceived.filter((s) => !!s.spoken_text).length,
    });
    return { segments: buildFixedBuckets(videoDurationSeconds), perceived };
  }

  return { segments: perceived, perceived };
}

/**
 * Normalize a raw model-emitted segments array per D-07 + D-08.
 *
 * @returns normalized, indexed, non-empty SegmentGrid[]
 */
export function normalizeSegments(
  raw: SegmentGrid[] | undefined,
  videoDurationSeconds: number,
): SegmentGrid[] {
  return normalizeSegmentsDetailed(raw, videoDurationSeconds).segments;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * CR-01: Join two verbatim strings in time order without dropping or duplicating speech.
 * Used when a sub-1s segment is absorbed into an adjacent one (merge): the absorbed
 * segment's words must survive, not vanish. `earlier` is the segment that comes first
 * in time so concatenation preserves spoken order.
 *   - both nullish        → null
 *   - one present         → that one
 *   - both present, equal  → one copy (never "X X")
 *   - both present, differ → "earlier later"
 */
export function joinVerbatim(
  earlier: string | null | undefined,
  later: string | null | undefined,
): string | null {
  const a = earlier ?? null;
  const b = later ?? null;
  if (a === null) return b;
  if (b === null) return a;
  if (a === b) return a;
  return `${a} ${b}`;
}

/**
 * The window this cell's speech actually occupies. Falls back to the cell's own duration, which
 * is correct until a split or a merge moves the speech off the cell that produced it.
 */
function spanOf(seg: SegmentGrid): number {
  return seg.spoken_span_s ?? seg.t_end - seg.t_start;
}

/** Returns true if the segment array has any NaN, negative, or non-monotonic timestamps. */
function hasMalformedTimestamps(segments: SegmentGrid[]): boolean {
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]!;
    if (!isFinite(s.t_start) || !isFinite(s.t_end)) return true;
    if (s.t_start < 0 || s.t_end < 0) return true;
    if (s.t_end <= s.t_start) return true;                          // zero-width or inverted
    if (i > 0 && s.t_start < (segments[i - 1]!.t_end - 0.001)) return true; // non-monotonic
  }
  return false;
}

/**
 * enforceHookZoneBoundary: if any segment straddles t=3, split it at 3.0.
 * Rule 2 invariant: hook zone boundary is inviolable.
 */
export function enforceHookZoneBoundary(segments: SegmentGrid[]): SegmentGrid[] {
  const result: SegmentGrid[] = [];
  for (const seg of segments) {
    if (seg.t_start < HOOK_ZONE_END_S && seg.t_end > HOOK_ZONE_END_S) {
      // Split: left half (hook zone), right half (post-hook)
      result.push({
        ...seg,
        t_end: HOOK_ZONE_END_S,
        scene_boundary_reason: "hook_zone_split",
        // CR-01 keeps the WHOLE quote on this child (the continuation is nulled below), so this
        // cell now holds speech that ran past its own end. Record the real window: without it a
        // 0-8s quote is rated against a 0-3s cell, and the shoot sheet asks the creator to say
        // eight seconds of words in three (measured — spec §11).
        ...(seg.spoken_text ? { spoken_span_s: spanOf(seg) } : {}),
      });
      result.push({
        ...seg,
        t_start: HOOK_ZONE_END_S,
        scene_boundary_reason: "hook_zone_split_continuation",
        // CR-01: a forced hook-zone split cannot attribute spoken words to a time-half,
        // so do NOT copy spoken_text onto both children (that fabricates a "said twice"
        // signal). Keep it on the left (primary) child; null it here. on_screen_text is
        // retained via the spread — a visual caption legitimately spans the boundary.
        spoken_text: null,
      });
    } else {
      result.push(seg);
    }
  }
  return result;
}

/**
 * mergeSubMinSegments: merge any segment with width < MIN_CELL_WIDTH_S into adjacent.
 * Prefers merging into the NEXT segment. If last segment, merges into previous.
 * NEVER merges across the 3s hook-zone boundary (Rule 2).
 */
export function mergeSubMinSegments(segments: SegmentGrid[]): SegmentGrid[] {
  // Iterative pass — repeat until no sub-min segments remain (handles cascades)
  let work = [...segments];
  let changed = true;
  while (changed) {
    changed = false;
    const next: SegmentGrid[] = [];
    let i = 0;
    while (i < work.length) {
      const seg = work[i]!;
      const width = seg.t_end - seg.t_start;
      if (width < MIN_CELL_WIDTH_S && work.length > 1) {
        // Try merge into next if no hook-zone boundary crossing
        if (i + 1 < work.length) {
          const nextSeg = work[i + 1]!;
          const crossesBoundary =
            seg.t_start < HOOK_ZONE_END_S && nextSeg.t_end > HOOK_ZONE_END_S ||
            (seg.t_start < HOOK_ZONE_END_S) !== (nextSeg.t_start < HOOK_ZONE_END_S);
          if (!crossesBoundary) {
            // Merge seg into nextSeg. CR-01: concatenate verbatim (seg is earlier in
            // time) so the absorbed segment's speech/on-screen text is not dropped.
            const joined = joinVerbatim(seg.spoken_text, nextSeg.spoken_text);
            next.push({
              ...nextSeg,
              t_start: seg.t_start,
              spoken_text: joined,
              on_screen_text: joinVerbatim(seg.on_screen_text, nextSeg.on_screen_text),
              // Only the cells that CONTRIBUTED speech count toward its span — a silent cell
              // absorbed into a talking one adds duration, not talking time.
              ...(joined
                ? { spoken_span_s: (seg.spoken_text ? spanOf(seg) : 0) + (nextSeg.spoken_text ? spanOf(nextSeg) : 0) }
                : {}),
            });
            i += 2;
            changed = true;
            continue;
          }
        }
        // Fall back: merge into previous if possible and no boundary crossing
        if (next.length > 0) {
          const prevSeg = next[next.length - 1]!;
          const crossesBoundary =
            (prevSeg.t_start < HOOK_ZONE_END_S) !== (seg.t_start < HOOK_ZONE_END_S);
          if (!crossesBoundary) {
            // Merge seg into prevSeg. CR-01: prevSeg is earlier in time, so concatenate
            // prev→seg to keep the absorbed segment's verbatim instead of dropping it.
            const joinedPrev = joinVerbatim(prevSeg.spoken_text, seg.spoken_text);
            next[next.length - 1] = {
              ...prevSeg,
              t_end: seg.t_end,
              spoken_text: joinedPrev,
              on_screen_text: joinVerbatim(prevSeg.on_screen_text, seg.on_screen_text),
              ...(joinedPrev
                ? { spoken_span_s: (prevSeg.spoken_text ? spanOf(prevSeg) : 0) + (seg.spoken_text ? spanOf(seg) : 0) }
                : {}),
            };
            i++;
            changed = true;
            continue;
          }
        }
      }
      next.push(seg);
      i++;
    }
    work = next;
  }
  return work;
}

/**
 * buildFixedBuckets: deterministic fallback per D-07.
 * - duration >= 8s: 2s buckets; first bucket is always 0-3s hook zone.
 * - duration < 8s: 1s buckets.
 */
export function buildFixedBuckets(durationSeconds: number): SegmentGrid[] {
  const duration = Math.max(durationSeconds, 1); // defensive floor
  const segments: SegmentGrid[] = [];

  if (duration >= SHORT_VIDEO_THRESHOLD_S) {
    // First bucket: hook zone 0-3s
    segments.push({
      t_start: 0,
      t_end:   HOOK_ZONE_END_S,
      visual_event: "hook zone",
      audio_event:  "hook zone",
      scene_boundary_reason: "fixed_bucket_hook_zone",
      is_hook_zone: true,
      idx: 0,
    });
    // Remaining 2s buckets
    let t = HOOK_ZONE_END_S;
    while (t < duration) {
      const end = Math.min(t + 2, duration);
      segments.push({
        t_start: t,
        t_end:   end,
        visual_event: `segment ${Math.round(t)}s`,
        audio_event:  `segment ${Math.round(t)}s`,
        scene_boundary_reason: "fixed_bucket",
        is_hook_zone: false,
        idx: segments.length,
      });
      t = end;
    }
  } else {
    // Short video: 1s buckets
    let t = 0;
    while (t < duration) {
      const end = Math.min(t + 1, duration);
      segments.push({
        t_start: t,
        t_end:   end,
        visual_event: `segment ${Math.round(t)}s`,
        audio_event:  `segment ${Math.round(t)}s`,
        scene_boundary_reason: "fixed_bucket_short",
        is_hook_zone: t < HOOK_ZONE_END_S,
        idx: segments.length,
      });
      t = end;
    }
  }

  return segments;
}

/** Set is_hook_zone and idx on every segment (final annotation pass). */
function annotateSegments(segments: SegmentGrid[]): SegmentGrid[] {
  return segments.map((seg, idx) => ({
    ...seg,
    idx,
    is_hook_zone: seg.t_start < HOOK_ZONE_END_S,
  }));
}
