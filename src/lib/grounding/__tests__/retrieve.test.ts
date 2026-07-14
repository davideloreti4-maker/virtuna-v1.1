import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hasReusableSignal,
  isProofGrade,
  isAdmissible,
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
    // 0.58, re-measured 2026-07-14 against the real 532-row corpus. The old 0.65 was tuned on
    // a 22-row test corpus and sat INSIDE the true-positive band (on-topic 0.58–0.68), so it
    // rejected 39×/48×/160× outliers that were dead-on topic. Off-topic tops out at 0.54.
    expect(c.minSimilarity).toBe(0.58);
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

/**
 * These four reproduce the defects the 2026-07-14 curated import shipped SILENTLY —
 * every one of them typechecked clean and left the whole suite green. A cast over raw
 * JSONB is not a type; emptiness is not absence.
 */
describe("JSONB shape guards (the silent-drift regression)", () => {
  it("REJECTS a Sandcastles-shaped idea instead of casting it into a lie", () => {
    // Pre-migration curated rows carried THEIR key names. The old code cast this straight
    // to IdeaFacet, so `example.idea.belief` read `undefined` on all 532 rows — forever,
    // without a single failure anywhere.
    const example = matchRowToExample(
      row({ idea: { seed: "s", angle: "a", common_belief: "b", contrarian_reality: "r" } }),
    );
    expect(example.idea).toBeNull(); // dropped loudly, not silently half-read
  });

  it("REJECTS a Sandcastles-shaped template instead of casting it into a lie", () => {
    const example = matchRowToExample(
      row({ template: { narrative_structure: { structure_sections: [] } } }),
    );
    expect(example.template).toBeNull();
  });

  it("carries the timed named beats through when the shape IS ours", () => {
    const example = matchRowToExample(
      row({
        template: {
          name: "A/B duel",
          slots: [],
          skeleton: ["Topic Introduction", "Word Comparison 1"],
          guidance: "Use when two familiar things differ in a way viewers can hear.",
          beats: [
            { name: "Topic Introduction", description: "State the comparison.", startSec: 0, endSec: 4 },
            { name: "Word Comparison 1", description: "Establish the rhythm.", startSec: 4, endSec: 6 },
          ],
          flavor: "rapid-fire pronunciation duel",
        },
      }),
    );
    expect(example.template?.beats).toHaveLength(2);
    expect(example.template?.beats?.[0]).toMatchObject({ name: "Topic Introduction", endSec: 4 });
    expect(example.template?.guidance).toContain("Use when");
  });

  it("separates the WARRANT (why a row is admitted) from the CLAIM (what it proves)", () => {
    // isProofGrade is the §12 LOCKED bar: views ÷ followers ≥ 3×.
    expect(isProofGrade(row({ outlier_multiplier: 0.8 }))).toBe(false); // underperformed
    expect(isProofGrade(row({ outlier_multiplier: 2.9 }))).toBe(false); // below the bar
    expect(isProofGrade(row({ outlier_multiplier: null }))).toBe(false); // unknown proves nothing
    expect(isProofGrade(row({ outlier_multiplier: 3 }))).toBe(true); // the bar itself
    expect(isProofGrade(row({ outlier_multiplier: 458 }))).toBe(true);
  });

  it("admits every CURATED row — a human picked it, and that is its warrant", () => {
    // Owner call 2026-07-14. Half the TikTok library has no score computed at all, and the
    // scored TikTok rows have an 11.3× median — so excluding the unscored ones was discarding
    // good videos for missing DATA, not for poor performance.
    expect(isAdmissible(row({ source_pool: "curated", outlier_multiplier: null }))).toBe(true);
    expect(isAdmissible(row({ source_pool: "curated", outlier_multiplier: 0.5 }))).toBe(true);
  });

  it("still holds SCRAPED rows to the metric — no human vetted those", () => {
    // A scraped row came off a niche query with nobody in the loop. The metric is the only
    // thing separating a real lesson from a random video, so the gate stays load-bearing.
    expect(isAdmissible(row({ source_pool: "scraped", outlier_multiplier: 2.9 }))).toBe(false);
    expect(isAdmissible(row({ source_pool: "scraped", outlier_multiplier: null }))).toBe(false);
    expect(isAdmissible(row({ source_pool: "scraped", outlier_multiplier: 12 }))).toBe(true);
  });

  it("drops a row whose template is PRESENT but EMPTY (the '(structure)' bug)", () => {
    // One of the 8 un-analysable curated videos produced exactly this shell. It is truthy,
    // so a presence check keeps it — and the prompt renderer, finding nothing to say,
    // emits the literal string "(structure)" as a grounding line attached to a real receipt.
    const shell = row({
      spoken_hook: null,
      hook_template: null,
      idea: null,
      template: { name: "", slots: [], skeleton: [], guidance: "", beats: [] },
    });
    expect(hasReusableSignal(shell)).toBe(false);

    // …while a row with any real signal survives.
    expect(hasReusableSignal(row({ template: null, idea: null }))).toBe(true); // has spoken_hook
  });
});
