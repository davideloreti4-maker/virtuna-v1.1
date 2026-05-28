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

/**
 * Normalize a raw model-emitted segments array per D-07 + D-08.
 *
 * @param raw                 - segments[] from OmniAnalysisZodSchema (may be undefined/empty)
 * @param videoDurationSeconds - total video length in seconds (used for fixed-bucket fallback)
 * @returns                   - normalized, indexed, non-empty SegmentGrid[]
 */
export function normalizeSegments(
  raw: SegmentGrid[] | undefined,
  videoDurationSeconds: number,
): SegmentGrid[] {
  // Guard: undefined / empty → immediate fallback
  if (!raw || raw.length === 0) {
    log.warn("normalizeSegments: empty/undefined input — falling back to fixed buckets", {
      videoDurationSeconds,
    });
    return buildFixedBuckets(videoDurationSeconds);
  }

  // Guard: malformed timestamps
  if (hasMalformedTimestamps(raw)) {
    log.warn("normalizeSegments: malformed timestamps detected — falling back to fixed buckets", {
      videoDurationSeconds,
      firstSegment: raw[0],
    });
    return buildFixedBuckets(videoDurationSeconds);
  }

  // Step 1: Enforce hook-zone boundary (split any segment that straddles t=3)
  let segments = enforceHookZoneBoundary(raw);

  // Step 2: Merge sub-1s segments (Rule 1; respects Rule 2 — no merge across 3s boundary)
  segments = mergeSubMinSegments(segments);

  // Step 3: Fallback check — if count < MIN_BOUNDARY_COUNT after normalization
  if (segments.length < MIN_BOUNDARY_COUNT) {
    log.warn("normalizeSegments: post-normalization count below minimum — falling back to fixed buckets", {
      count: segments.length,
      videoDurationSeconds,
    });
    return buildFixedBuckets(videoDurationSeconds);
  }

  // Step 4: Set is_hook_zone + idx on every segment
  return annotateSegments(segments);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

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
      });
      result.push({
        ...seg,
        t_start: HOOK_ZONE_END_S,
        scene_boundary_reason: "hook_zone_split_continuation",
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
            // Merge seg into nextSeg
            next.push({ ...nextSeg, t_start: seg.t_start });
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
            next[next.length - 1] = { ...prevSeg, t_end: seg.t_end };
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
