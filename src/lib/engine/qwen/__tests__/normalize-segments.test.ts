/**
 * D-08 normalizer unit tests.
 *
 * Tests three normalization rules:
 *   Rule 1: Merge sub-1s segments into adjacent.
 *   Rule 2: Hook zone (0-3s) is always its own segment — never merged across the 3s boundary.
 *   Rule 3: Fallback to deterministic fixed buckets when input is malformed or has < 4 boundaries.
 *
 * Pure unit tests — no mocks, no I/O.
 */

import { describe, it, expect } from "vitest";
import {
  normalizeSegments,
  enforceHookZoneBoundary,
  mergeSubMinSegments,
  buildFixedBuckets,
  HOOK_ZONE_END_S,
  MIN_BOUNDARY_COUNT,
} from "@/lib/engine/qwen/normalize-segments";
import type { SegmentGrid } from "@/lib/engine/qwen/schemas";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function seg(t_start: number, t_end: number, extra?: Partial<SegmentGrid>): SegmentGrid {
  return {
    t_start,
    t_end,
    visual_event: `visual ${t_start}-${t_end}`,
    audio_event:  `audio ${t_start}-${t_end}`,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Rule 1: Merge sub-1s segments
// ---------------------------------------------------------------------------

describe("merges sub-1s segments into the adjacent segment", () => {
  it("merges a sub-1s cut in the middle into the next segment", () => {
    // Provide 6 segments so after merging the sub-1s cut we stay above MIN_BOUNDARY_COUNT (4).
    // seg(0,3) | seg(3,5) | seg(5, 5.4) [sub-1s] | seg(5.4,9) | seg(9,12) | seg(12,16)
    const input: SegmentGrid[] = [
      seg(0, 3),
      seg(3, 5),
      seg(5, 5.4),   // sub-1s cut
      seg(5.4, 9),
      seg(9, 12),
      seg(12, 16),
    ];
    const result = normalizeSegments(input, 16);

    // Sub-1s segment should be merged — total count reduced by 1 (6 → 5)
    expect(result.length).toBeLessThan(input.length);
    // Total span: first t_start must be 0, last t_end must be 16
    expect(result[0]!.t_start).toBe(0);
    expect(result[result.length - 1]!.t_end).toBe(16);
  });

  it("merge preserves total span — t_start of first and t_end of last unchanged", () => {
    const input: SegmentGrid[] = [seg(0, 2), seg(2, 2.3), seg(2.3, 8), seg(8, 12), seg(12, 16)];
    const result = normalizeSegments(input, 16);
    expect(result[0]!.t_start).toBe(0);
    expect(result[result.length - 1]!.t_end).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// Rule 2: Preserve hook zone (0-3s) as its own segment
// ---------------------------------------------------------------------------

describe("preserves the hook zone (0-3s) as its own segment — never merged across the 3s boundary", () => {
  it("splits a segment straddling t=3 at the 3s boundary", () => {
    // seg(2.7, 3.2) straddles the hook-zone boundary
    const input: SegmentGrid[] = [
      seg(0, 2.7),
      seg(2.7, 3.2),
      seg(3.2, 5),
      seg(5, 7),
      seg(7, 10),
    ];
    const result = enforceHookZoneBoundary(input);

    // The straddling segment must be split at 3.0
    const hookSplit = result.find(s => s.t_start === 2.7 && s.t_end === HOOK_ZONE_END_S);
    const postSplit = result.find(s => s.t_start === HOOK_ZONE_END_S && s.t_end === 3.2);
    expect(hookSplit).toBeDefined();
    expect(postSplit).toBeDefined();
  });

  it("normalizeSegments: hook zone segment starts at 0 and ends at 3 after full normalization", () => {
    // Provide enough segments to pass Rule 3 (>= 4 boundaries)
    const input: SegmentGrid[] = [
      seg(0, 2.7),
      seg(2.7, 3.2),  // straddles t=3
      seg(3.2, 6),
      seg(6, 9),
      seg(9, 12),
    ];
    const result = normalizeSegments(input, 12);

    // Must have a segment that starts at 0 and ends exactly at 3
    const hookSegment = result.find(s => s.t_start === 0 && s.t_end === HOOK_ZONE_END_S);
    expect(hookSegment).toBeDefined();
  });

  it("sub-1s segment inside hook zone is NOT merged across the 3s boundary", () => {
    const input: SegmentGrid[] = [
      seg(0, 2.7),
      seg(2.7, 3.0), // sub-1s but ends exactly at hook boundary
      seg(3.0, 6),
      seg(6, 9),
      seg(9, 12),
    ];
    const result = mergeSubMinSegments(input);

    // The sub-1s segment at 2.7-3.0 should merge into 0-2.7 (previous, same zone)
    // rather than cross the hook boundary into 3.0-6.
    // After merge, there should be NO segment that spans across the 3s boundary.
    for (const s of result) {
      if (s.t_start < HOOK_ZONE_END_S) {
        expect(s.t_end).toBeLessThanOrEqual(HOOK_ZONE_END_S);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Rule 3: Fallback to fixed buckets for malformed/insufficient input
// ---------------------------------------------------------------------------

describe("falls back to deterministic fixed buckets when input is malformed or has fewer than 4 boundaries", () => {
  it("falls back to fixed buckets when input has a NaN t_start", () => {
    const input: SegmentGrid[] = [
      { ...seg(0, 3), t_start: NaN },
      seg(3, 6),
    ];
    const result = normalizeSegments(input, 10);

    // Must be fixed buckets — at least 3 segments for a 10s video
    expect(result.length).toBeGreaterThanOrEqual(3);
    // First bucket always 0-3 for >= 8s videos
    expect(result[0]!.t_start).toBe(0);
    expect(result[0]!.t_end).toBe(HOOK_ZONE_END_S);
    expect(result[0]!.is_hook_zone).toBe(true);
  });

  it("falls back to fixed buckets when input has only 2 segments (below MIN_BOUNDARY_COUNT)", () => {
    const input: SegmentGrid[] = [seg(0, 3), seg(3, 10)];
    const result = normalizeSegments(input, 10);

    // 2 segments < MIN_BOUNDARY_COUNT (4) → fixed buckets
    expect(result.length).toBeGreaterThanOrEqual(MIN_BOUNDARY_COUNT);
  });

  it("fixed buckets for 8s+ video: first bucket is always the 0-3s hook zone", () => {
    const result = buildFixedBuckets(10);
    expect(result[0]!.t_start).toBe(0);
    expect(result[0]!.t_end).toBe(HOOK_ZONE_END_S);
    expect(result[0]!.is_hook_zone).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Bonus: short video and is_hook_zone annotation
// ---------------------------------------------------------------------------

describe("fixed-bucket fallback for videos shorter than 8s uses 1s buckets", () => {
  it("builds 1s buckets for a 5s video", () => {
    const result = buildFixedBuckets(5);
    // 5 buckets: [0-1, 1-2, 2-3, 3-4, 4-5]
    expect(result.length).toBe(5);
    result.forEach(s => {
      expect(s.t_end - s.t_start).toBeCloseTo(1, 1);
    });
  });
});

describe("always sets is_hook_zone=true for segments with t_start < 3 after normalization", () => {
  it("all segments returned by normalizeSegments with t_start < 3 have is_hook_zone=true", () => {
    const input: SegmentGrid[] = [
      seg(0, 3),
      seg(3, 6),
      seg(6, 9),
      seg(9, 12),
      seg(12, 15),
    ];
    const result = normalizeSegments(input, 15);

    for (const s of result) {
      if (s.t_start < HOOK_ZONE_END_S) {
        expect(s.is_hook_zone).toBe(true);
      } else {
        expect(s.is_hook_zone).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// CR-01: verbatim fidelity through merge + hook-zone split
// (the absorbed segment's words must not vanish on merge; a forced split must
//  not duplicate spoken_text onto both children)
// ---------------------------------------------------------------------------

describe("CR-01: verbatim survives merge and is not duplicated across a hook-zone split", () => {
  it("merge into NEXT concatenates the absorbed sub-1s segment's spoken_text (no drop)", () => {
    const input: SegmentGrid[] = [
      seg(0, 3, { spoken_text: "intro" }),
      seg(3, 5, { spoken_text: "before the cut" }),
      seg(5, 5.4, { spoken_text: "tiny cut words" }), // sub-1s → merges into next
      seg(5.4, 9, { spoken_text: "after the cut" }),
      seg(9, 12, { spoken_text: "later" }),
      seg(12, 16, { spoken_text: "end" }),
    ];
    const result = mergeSubMinSegments(input);
    // The sub-1s segment merges forward into seg(5.4,9); its words must survive.
    const merged = result.find((s) => s.t_start === 5 && s.t_end === 9);
    expect(merged).toBeDefined();
    expect(merged!.spoken_text).toBe("tiny cut words after the cut");
  });

  it("merge into PREVIOUS concatenates a trailing sub-1s segment's spoken_text (no drop)", () => {
    // Last segment is sub-1s → merges into previous; prev is earlier in time.
    const input: SegmentGrid[] = [
      seg(0, 3, { spoken_text: "a" }),
      seg(3, 6, { spoken_text: "b" }),
      seg(6, 9, { spoken_text: "c" }),
      seg(9, 11, { spoken_text: "second to last" }),
      seg(11, 11.4, { spoken_text: "trailing words" }), // sub-1s last → merge into prev
    ];
    const result = mergeSubMinSegments(input);
    const merged = result.find((s) => s.t_start === 9 && s.t_end === 11.4);
    expect(merged).toBeDefined();
    expect(merged!.spoken_text).toBe("second to last trailing words");
  });

  it("merge dedupes identical on_screen_text instead of producing 'X X'", () => {
    const input: SegmentGrid[] = [
      seg(0, 3, { on_screen_text: "caption" }),
      seg(3, 5, { on_screen_text: "CAP A" }),
      seg(5, 5.4, { on_screen_text: "CAP A" }), // sub-1s, same caption as next
      seg(5.4, 9, { on_screen_text: "CAP A" }),
      seg(9, 12, { on_screen_text: "z" }),
      seg(12, 16, { on_screen_text: "z" }),
    ];
    const result = mergeSubMinSegments(input);
    const merged = result.find((s) => s.t_start === 5 && s.t_end === 9);
    expect(merged!.on_screen_text).toBe("CAP A"); // not "CAP A CAP A"
  });

  it("hook-zone split does NOT duplicate spoken_text — continuation child is null; left child keeps it", () => {
    const input: SegmentGrid[] = [
      seg(2, 5, { spoken_text: "spans the boundary", on_screen_text: "overlay" }),
    ];
    const result = enforceHookZoneBoundary(input);
    const left = result.find((s) => s.t_start === 2 && s.t_end === HOOK_ZONE_END_S);
    const right = result.find((s) => s.t_start === HOOK_ZONE_END_S && s.t_end === 5);
    expect(left!.spoken_text).toBe("spans the boundary");
    expect(right!.spoken_text).toBeNull(); // not the same words copied twice
    // on_screen_text (a visual caption) legitimately spans the split — retained on both.
    expect(left!.on_screen_text).toBe("overlay");
    expect(right!.on_screen_text).toBe("overlay");
  });
});
