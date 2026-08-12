/**
 * The one-band rule (B1): Discover and the composed card must not disagree about where the
 * printable band ends. Before this, `corpus-reads.ts` declared its own `EXTREME_MULTIPLIER = 100`
 * and DROPPED out-of-band rows from the feed, while `composed-card-receipt.ts` CLAMPED to the
 * shared `MAX_PRINTABLE_MULTIPLIER`. Same number, two literals, two opposite behaviours.
 *
 * ⚠️ Clamping the DISPLAY does not make a thin baseline trustworthy. `extreme` and `proven` stay
 * keyed off the RAW multiplier — the flag is about the baseline, not about what prints.
 */
import { describe, it, expect } from "vitest";
import {
  EXTREME_MULTIPLIER,
  isFeedEligible,
  toCorpusVideo,
  type CorpusVideo,
} from "@/lib/discover/corpus-reads";
import { MAX_PRINTABLE_MULTIPLIER } from "@/lib/grounding/outlier-gate";

/**
 * A real-shaped `outlier_teardowns` row.
 *
 * `outlier_multiplier` is a NUMBER here on purpose: the column is a Postgres `numeric`, which a SQL
 * console renders quoted, but through supabase-js it arrives as a JS number. Measured against the
 * live corpus by `scripts/probe-receipt-wire-shape.ts` — the fixture matches the wire, not the
 * console. (`corpus-reads.ts` additionally tolerates the string form via `num()`; covered below.)
 */
function teardownRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "row-1",
    video_url: "https://tiktok.com/@corporate.bro/video/1",
    cover_url: "https://cdn/cover.jpg",
    creator_handle: "corporate.bro",
    spoken_hook: "The thing nobody tells you about quitting",
    hook_template: "The [thing] nobody tells you about [topic]",
    hook_archetype: "secret-reveal-breakdown",
    niche: "career",
    views: 1_400_000,
    platform: "tiktok",
    engagement_rate: "0.024",
    posted_at: "2026-06-01T00:00:00Z",
    outlier_multiplier: 5.7,
    baseline_label: "vs their usual views",
    ...overrides,
  };
}

describe("the band rule is stated once", () => {
  it("discover's threshold IS the grounding constant, not a second literal", () => {
    expect(EXTREME_MULTIPLIER).toBe(MAX_PRINTABLE_MULTIPLIER);
  });
});

describe("toCorpusVideo — clamp, do not drop", () => {
  it("clamps a 20,154x row to the top of the band instead of printing it", () => {
    const v = toCorpusVideo(teardownRow({ outlier_multiplier: 20154 }));
    expect(v.multiplier).toBe(MAX_PRINTABLE_MULTIPLIER);
  });

  it("still flags the clamped row as extreme — the honesty flag is keyed off the RAW value", () => {
    const v = toCorpusVideo(teardownRow({ outlier_multiplier: 20154 }));
    expect(v.extreme).toBe(true);
  });

  it("leaves an in-band multiplier exactly as measured", () => {
    const v = toCorpusVideo(teardownRow({ outlier_multiplier: 5.7 }));
    expect(v.multiplier).toBe(5.7);
    expect(v.extreme).toBe(false);
  });

  it("still normalizes a numeric arriving as a string (num(), kept defensively)", () => {
    const v = toCorpusVideo(teardownRow({ outlier_multiplier: "20154" }));
    expect(v.multiplier).toBe(MAX_PRINTABLE_MULTIPLIER);
    expect(v.extreme).toBe(true);
  });

  it("makes no claim at all when the baseline is unnamed", () => {
    const v = toCorpusVideo(teardownRow({ baseline_label: null, outlier_multiplier: 20154 }));
    expect(v.multiplier).toBeNull();
    expect(v.proven).toBe(false);
    expect(v.extreme).toBe(false);
  });

  it("agrees with the composed card's receipt on the same row", async () => {
    // The whole point of B1: one row, two surfaces, one printed number.
    const { materializeReceipts } = await import("@/lib/tools/composed-card-receipt");
    const raw = teardownRow({ outlier_multiplier: 20154 });
    const supabase = {
      from: () => ({ select: () => ({ in: async () => ({ data: [raw], error: null }) }) }),
    } as never;

    const receipt = (await materializeReceipts(["row-1"], { supabase })).get("row-1");
    expect(receipt?.multiplier).toBe(toCorpusVideo(raw).multiplier);
  });
});

describe("isFeedEligible — the extreme row reaches the feed", () => {
  const video = (over: Partial<CorpusVideo>): CorpusVideo =>
    ({ ...toCorpusVideo(teardownRow()), ...over }) as CorpusVideo;

  it("admits a proven row whose raw multiplier was out of band", () => {
    expect(isFeedEligible(video({ proven: true, extreme: true }))).toBe(true);
  });

  it("admits an ordinary proven row", () => {
    expect(isFeedEligible(video({ proven: true, extreme: false }))).toBe(true);
  });

  it("still refuses a row that was never proof-grade", () => {
    expect(isFeedEligible(video({ proven: false, extreme: false }))).toBe(false);
  });
});
