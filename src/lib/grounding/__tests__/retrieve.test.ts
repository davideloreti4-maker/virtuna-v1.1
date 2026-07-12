import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isFreshTeardown,
  matchRowToExample,
  retrieveCachedExamples,
  resolveRetrieveConfig,
  type RetrieveConfig,
} from "../retrieve";
import type { SharedMatchRow } from "../corpus";

const NOW = new Date("2026-07-12T00:00:00Z");

function row(overrides: Partial<SharedMatchRow> = {}): SharedMatchRow {
  return {
    id: "td-1",
    similarity: 0.8,
    platform: "tiktok",
    platform_video_id: "v1",
    video_url: "https://tiktok.com/@maker/video/1",
    cover_url: "https://cdn/c1.jpg",
    creator_handle: "maker",
    source_pool: "scraped",
    trust_weight: 0.6,
    views: 2_000_000,
    follower_count: 14_000,
    outlier_multiplier: 145,
    baseline_label: "vs followers",
    engagement_rate: 0.06,
    posted_at: "2026-07-01T00:00:00Z",
    proof_captured_at: "2026-07-10T00:00:00Z",
    niche: "food",
    hook_archetype: "contrarian",
    format: "listicle",
    spoken_hook: "Stop buying protein bars.",
    hook_template: "Stop buying [product category].",
    hook_source: "caption_fallback",
    idea: { seed: "s", angle: "a", belief: "b", reality: "r", evidence: "e" },
    template: { name: "Myth-swap", slots: [], skeleton: ["myth", "swap"], guidance: "g" },
    why_it_works: "pattern interrupt",
    ...overrides,
  };
}

const config: RetrieveConfig = {
  minRows: 2,
  minSimilarity: 0.6,
  freshDays: 90,
  fetchCount: 12,
  maxExamples: 3,
};

function fakeSupabase(rows: SharedMatchRow[]) {
  const rpc = vi.fn(async () => ({ data: rows, error: null }));
  return { supabase: { rpc } as unknown as SupabaseClient, rpc };
}

describe("isFreshTeardown", () => {
  it("passes missing/malformed timestamps (structure never rots)", () => {
    expect(isFreshTeardown(null, 90, NOW)).toBe(true);
    expect(isFreshTeardown("not-a-date", 90, NOW)).toBe(true);
  });
  it("passes within the window, fails beyond it", () => {
    expect(isFreshTeardown("2026-07-01T00:00:00Z", 90, NOW)).toBe(true);
    expect(isFreshTeardown("2026-01-01T00:00:00Z", 90, NOW)).toBe(false);
  });
});

describe("matchRowToExample", () => {
  it("maps the receipt + structure fields, including the first-class hook_template", () => {
    const ex = matchRowToExample(row());
    expect(ex.teardownId).toBe("td-1");
    expect(ex.handle).toBe("maker");
    expect(ex.hookTemplate).toBe("Stop buying [product category].");
    expect(ex.multiplier).toBe(145);
    expect(ex.baselineLabel).toBe("vs followers");
    expect(ex.template?.skeleton).toEqual(["myth", "swap"]);
    expect(ex.sourcePool).toBe("scraped");
    expect(ex.trustWeight).toBe(0.6);
    expect(ex.fromPersonal).toBe(false);
    expect(ex.fitLabel).toBe("adjacent");
  });
});

describe("resolveRetrieveConfig", () => {
  it("uses documented defaults when env is unset", () => {
    const c = resolveRetrieveConfig();
    expect(c.minRows).toBe(4);
    expect(c.minSimilarity).toBe(0.65);
    expect(c.freshDays).toBe(90);
  });
});

describe("retrieveCachedExamples", () => {
  it("filters below-threshold + stale rows, caps at maxExamples, reports enough", async () => {
    const rows = [
      row({ id: "a", similarity: 0.9 }),
      row({ id: "b", similarity: 0.75 }),
      row({ id: "c", similarity: 0.7 }),
      row({ id: "d", similarity: 0.65 }),
      row({ id: "stale", similarity: 0.9, proof_captured_at: "2026-01-01T00:00:00Z" }),
      row({ id: "far", similarity: 0.3 }),
    ];
    const { supabase, rpc } = fakeSupabase(rows);
    const embedQuery = vi.fn(async () => new Array(768).fill(0.1));

    const result = await retrieveCachedExamples(
      { query: "high protein breakfast", platform: "tiktok" },
      { supabase, embedQuery, config, now: NOW },
    );

    expect(embedQuery).toHaveBeenCalledWith("high protein breakfast");
    expect(rpc).toHaveBeenCalledWith(
      "match_shared_teardowns",
      expect.objectContaining({ filter_platform: "tiktok", match_count: 12 }),
    );
    // stale + far dropped → a,b,c,d good; capped at maxExamples 3
    expect(result.stats).toMatchObject({ matched: 6, good: 4 });
    expect(result.examples.map((e) => e.teardownId)).toEqual(["a", "b", "c"]);
    expect(result.enough).toBe(true);
  });

  it("reports enough:false when good rows are under the bar", async () => {
    const { supabase } = fakeSupabase([row({ id: "a", similarity: 0.9 })]);
    const result = await retrieveCachedExamples(
      { query: "q", platform: "tiktok" },
      { supabase, embedQuery: async () => [0.1], config, now: NOW },
    );
    expect(result.enough).toBe(false);
    expect(result.examples).toHaveLength(1);
  });

  it("propagates embed/RPC failures (caller falls through to the scrape)", async () => {
    const { supabase } = fakeSupabase([]);
    await expect(
      retrieveCachedExamples(
        { query: "q", platform: "tiktok" },
        {
          supabase,
          embedQuery: async () => {
            throw new Error("dashscope down");
          },
          config,
        },
      ),
    ).rejects.toThrow("dashscope down");
  });
});
