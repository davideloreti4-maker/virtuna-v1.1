import { describe, it, expect } from "vitest";
import { isDropReady, selectDailyDrops, utcDayIndex } from "../drop-select";
import type { SharedMatchRow } from "@/lib/grounding/corpus";

const DURABLE =
  "https://x.supabase.co/storage/v1/object/public/covers/corpus/tiktok/1.jpg";

let seq = 0;
function row(over: Partial<SharedMatchRow> = {}): SharedMatchRow {
  return {
    id: `row-${seq++}`,
    similarity: 0.5,
    platform: "tiktok",
    platform_video_id: "v",
    video_url: "https://t/v",
    cover_url: DURABLE,
    creator_handle: "h",
    source_pool: "curated",
    trust_weight: 1.5,
    views: 1000,
    follower_count: null,
    outlier_multiplier: 5,
    baseline_label: null,
    engagement_rate: null,
    posted_at: null,
    proof_captured_at: null,
    niche: null,
    hook_archetype: "question",
    format: null,
    visual_hook: null,
    editing_style: null,
    spoken_hook: "line",
    hook_template: "madlib [x]",
    hook_source: null,
    idea: null,
    template: null,
    why_it_works: null,
    hook_techniques: null,
    ...over,
  } as SharedMatchRow;
}

describe("isDropReady", () => {
  it("requires a durable rehosted cover, real views, a handle, and hook structure", () => {
    expect(isDropReady(row())).toBe(true);
    expect(isDropReady(row({ cover_url: "https://tiktokcdn.example/x?x-expires=1" }))).toBe(false);
    expect(isDropReady(row({ cover_url: null }))).toBe(false);
    expect(isDropReady(row({ views: 0 }))).toBe(false);
    expect(isDropReady(row({ views: null }))).toBe(false);
    expect(isDropReady(row({ creator_handle: null }))).toBe(false);
    expect(isDropReady(row({ creator_handle: "  " }))).toBe(false);
    expect(isDropReady(row({ hook_template: null, spoken_hook: null }))).toBe(false);
  });
});

describe("selectDailyDrops", () => {
  const archetypes = [
    "question",
    "authority",
    "contrarian",
    "list",
    "problem",
    "tutorial",
    "case-study",
  ];
  // 7 archetypes × 3 exemplars — enough for spread + rotation.
  const pool = archetypes.flatMap((a, i) =>
    [0, 1, 2].map((d) =>
      row({ hook_archetype: a, similarity: 0.9 - i * 0.05 - d * 0.01 }),
    ),
  );

  it("returns `count` rows spanning distinct archetypes on day 0", () => {
    const picks = selectDailyDrops(pool, 6, 0);
    expect(picks).toHaveLength(6);
    expect(new Set(picks.map((p) => p.hook_archetype)).size).toBe(6);
  });

  it("rotates: consecutive days share no rows until the sequence wraps", () => {
    const d0 = new Set(selectDailyDrops(pool, 6, 0).map((p) => p.id));
    const d1 = selectDailyDrops(pool, 6, 1);
    expect(d1).toHaveLength(6);
    expect(d1.some((p) => d0.has(p.id))).toBe(false);
  });

  it("is deterministic for a given day", () => {
    expect(selectDailyDrops(pool, 6, 3).map((p) => p.id)).toEqual(
      selectDailyDrops(pool, 6, 3).map((p) => p.id),
    );
  });

  it("returns all ready rows without duplicates when the pool is smaller than count", () => {
    const tiny = pool.slice(0, 4);
    const picks = selectDailyDrops(tiny, 6, 5);
    expect(picks).toHaveLength(4);
    expect(new Set(picks.map((p) => p.id)).size).toBe(4);
  });

  it("filters unready rows before selecting", () => {
    const mixed = [...pool.slice(0, 3), row({ cover_url: null }), row({ views: null })];
    const picks = selectDailyDrops(mixed, 6, 0);
    expect(picks).toHaveLength(3);
    expect(picks.every(isDropReady)).toBe(true);
  });

  it("returns [] on an empty/unready pool", () => {
    expect(selectDailyDrops([], 6, 0)).toEqual([]);
    expect(selectDailyDrops([row({ cover_url: null })], 6, 0)).toEqual([]);
  });
});

describe("utcDayIndex", () => {
  it("is the UTC day number", () => {
    expect(utcDayIndex(new Date("2026-08-08T23:59:00Z"))).toBe(
      utcDayIndex(new Date("2026-08-08T00:01:00Z")),
    );
    expect(utcDayIndex(new Date("2026-08-09T00:01:00Z"))).toBe(
      utcDayIndex(new Date("2026-08-08T23:59:00Z")) + 1,
    );
  });
});
