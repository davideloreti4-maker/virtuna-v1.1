/**
 * Test file for src/lib/engine/optimal-post.ts helper (D-15 — Plan 01-05).
 *
 * Covers all 4 branches of computeOptimalPostWindow:
 *  - niche=null → FALLBACK
 *  - .single() row hit → OptimalPostWindow source='niche'
 *  - .single() PGRST116 no-rows → FALLBACK
 *  - .single() other error → null (non-fatal per D-15)
 *
 * Plus a sanity assertion on FALLBACK_POST_WINDOW shape.
 */
import { describe, it, expect, vi } from "vitest";
import {
  computeOptimalPostWindow,
  FALLBACK_POST_WINDOW,
} from "@/lib/engine/optimal-post";

function mockSupabase(singleResult: {
  data: unknown;
  error: { code?: string; message?: string } | null;
}) {
  const single = vi.fn().mockResolvedValue(singleResult);
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from } as unknown as Parameters<typeof computeOptimalPostWindow>[0];
}

describe("computeOptimalPostWindow", () => {
  it("returns FALLBACK when niche is null", async () => {
    const sb = mockSupabase({ data: null, error: null });
    const r = await computeOptimalPostWindow(sb, null, null);
    expect(r).toEqual(FALLBACK_POST_WINDOW);
  });

  it("returns row mapped to OptimalPostWindow when niche matches", async () => {
    const sb = mockSupabase({
      data: {
        day_of_week: "Wed",
        hour_start: 19,
        hour_end: 21,
        sample_size: 42,
      },
      error: null,
    });
    const r = await computeOptimalPostWindow(sb, "beauty", null);
    expect(r).not.toBeNull();
    expect(r?.source).toBe("niche");
    expect(r?.day_of_week).toBe("Wed");
    expect(r?.hour_range).toEqual([19, 21]);
    expect(r?.timezone).toBe("UTC");
    expect(r?.reasoning).toContain("Wed 19:00-21:00 UTC");
    expect(r?.reasoning).toContain("n=42");
  });

  it("returns FALLBACK when PGRST116 (no rows) for unknown niche", async () => {
    const sb = mockSupabase({
      data: null,
      error: { code: "PGRST116", message: "no rows" },
    });
    const r = await computeOptimalPostWindow(sb, "unknown-niche", null);
    expect(r).toEqual(FALLBACK_POST_WINDOW);
  });

  it("returns null on Supabase error (non-fatal per D-15)", async () => {
    const sb = mockSupabase({
      data: null,
      error: { code: "42P01", message: "table missing" },
    });
    const r = await computeOptimalPostWindow(sb, "beauty", null);
    expect(r).toBeNull();
  });

  it("FALLBACK has source='fallback' and a defensible default day/hour", () => {
    expect(FALLBACK_POST_WINDOW.source).toBe("fallback");
    expect(FALLBACK_POST_WINDOW.day_of_week).toMatch(
      /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/,
    );
    expect(FALLBACK_POST_WINDOW.hour_range[0]).toBeGreaterThanOrEqual(0);
    expect(FALLBACK_POST_WINDOW.hour_range[1]).toBeLessThanOrEqual(24);
    expect(FALLBACK_POST_WINDOW.timezone).toBe("UTC");
  });
});
