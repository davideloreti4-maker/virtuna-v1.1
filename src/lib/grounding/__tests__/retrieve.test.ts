import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hasReusableSignal,
  hasKnownBaseline,
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
    visual_hook: "studio_set",
    editing_style: "office-room-yap",
    hook_techniques: null,
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
  rank: "topical",
  filterPlatform: true,
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
    expect(c.minSimilarity).toBe(0.5);
    expect(c.freshDays).toBe(90);
    expect(c.rank).toBe("topical");
  });

  /**
   * The per-skill AXIS, not just the per-skill slice. hooks ranks on structure across the whole
   * corpus; ideas keeps the topical floor because belief↔reality is genuinely subject-bound.
   * Measured 2026-07-14: on the shared topical path, 8 of 10 real creator asks retrieved ZERO
   * hook rows, while the floor deleted a personal-branding video from a personal-branding query
   * (0.576 < 0.58) and admitted a carbonara recipe (0.673).
   */
  it("gives hooks a structural policy: no floor, no platform gate, whole-corpus pool", () => {
    const c = resolveRetrieveConfig("hooks");
    expect(c.rank).toBe("structural");
    expect(c.minSimilarity).toBe(0); // topic orders, it does not gate
    expect(c.filterPlatform).toBe(false); // a madlib transfers across platforms too
    expect(c.fetchCount).toBeGreaterThan(532); // must see the whole corpus to spread across it
  });

  /**
   * ideas + script keep the topical AXIS (belief↔reality and the timed beats are subject-bound —
   * that is the real difference from hooks), but no longer the platform GATE. Measured 2026-07-17:
   * the gate is what drops an on-topic ask under its own floor ("personal branding for founders"
   * 0.629 across the corpus → 0.576 across the 177 TikTok rows), and it hid 355 of 532 rows from
   * every TikTok creator. Every skill now reads the whole corpus; only the ranking axis differs.
   */
  it("keeps ideas + script on the topical axis, but reads across platforms", () => {
    for (const skill of ["ideas", "script"] as const) {
      const c = resolveRetrieveConfig(skill);
      expect(c.rank).toBe("topical");
      expect(c.minSimilarity).toBe(0.5);
      expect(c.filterPlatform).toBe(false);
      expect(c.fetchCount).toBe(12);
    }
  });

  /**
   * The floor is a QUALITY lever, not a cost one (the scrape is explicit-only now). It must stay
   * clear of ~0.45 — the corpus's own MEDIAN similarity — because a floor at the median accepts a
   * random row: "cold plunge benefits" scores 12 "good" rows there while its best row anywhere is
   * 0.490, i.e. the corpus holds nothing on the subject. Grounding belief↔reality on that is the
   * blind transplant the first A/B measured losing. If someone lowers this to buy a hit rate, this
   * test is the argument they have to answer.
   */
  it("keeps the ideas/script floor above the corpus median (0.45 = accept-anything)", () => {
    for (const skill of ["ideas", "script"] as const) {
      expect(resolveRetrieveConfig(skill).minSimilarity).toBeGreaterThan(0.45);
    }
  });

  it("gates no skill on platform — the corpus is read whole regardless of target", () => {
    for (const skill of ["hooks", "ideas", "script"] as const) {
      expect(resolveRetrieveConfig(skill).filterPlatform).toBe(false);
    }
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

describe("retrieveCachedExamples — structural (hooks)", () => {
  /** Corpus shape that broke the topical path: a dominant class that is also the most similar. */
  function corpus(): SharedMatchRow[] {
    return [
      ...Array.from({ length: 8 }, (_, i) =>
        row({
          id: `pe-${i}`,
          hook_archetype: "personal-experience",
          similarity: 0.9 - i * 0.01,
          source_pool: "curated",
        }),
      ),
      row({ id: "auth", hook_archetype: "authority", similarity: 0.2, source_pool: "curated" }),
      row({ id: "quest", hook_archetype: "question", similarity: 0.15, source_pool: "curated" }),
      row({ id: "contra", hook_archetype: "contrarian", similarity: 0.1, source_pool: "curated" }),
    ];
  }

  const structural: RetrieveConfig = {
    minRows: 4,
    minSimilarity: 0,
    freshDays: 90,
    fetchCount: 2000,
    maxExamples: 4,
    rank: "structural",
    filterPlatform: false,
  };

  it("reads ACROSS platforms — a madlib is a madlib (the gate hid 333 IG rows from TikTok)", async () => {
    const { supabase, rpc } = fakeSupabase(corpus());
    await retrieveCachedExamples(
      { query: "personal branding for founders", platform: "tiktok", skill: "hooks" },
      { supabase, embedQuery: async () => new Array(768).fill(0.1), config: structural, now: NOW },
    );

    expect(rpc).toHaveBeenCalledWith(
      "match_shared_teardowns",
      expect.objectContaining({ filter_platform: null, match_count: 2000 }),
    );
  });

  it("returns a SPREAD of archetypes, not the topically-nearest majority class", async () => {
    const { supabase } = fakeSupabase(corpus());

    const result = await retrieveCachedExamples(
      { query: "personal branding for founders", platform: "tiktok", skill: "hooks" },
      { supabase, embedQuery: async () => new Array(768).fill(0.1), config: structural, now: NOW },
    );

    // Topical would have returned pe-0..pe-3 — four rehearsals of one shape.
    expect(result.examples).toHaveLength(4);
    expect(result.stats.archetypes).toBe(4);
    expect(result.stats.rank).toBe("structural");
    expect(result.enough).toBe(true);
  });

  it("grounds a query the topical floor would have starved (0.576 < 0.58 → zero rows)", async () => {
    // Every row below the retired floor. Topical returns nothing; structural returns six shapes.
    const belowFloor = corpus().map((r, i) =>
      row({ ...r, similarity: 0.3, hook_archetype: ["a", "b", "c", "d", "e"][i % 5] }),
    );
    const { supabase } = fakeSupabase(belowFloor);

    const result = await retrieveCachedExamples(
      { query: "personal branding for founders", platform: "tiktok", skill: "hooks" },
      { supabase, embedQuery: async () => new Array(768).fill(0.1), config: structural, now: NOW },
    );

    expect(result.examples.length).toBe(4);
    expect(result.enough).toBe(true);
  });
});

/**
 * THE MIS-NAMED BASELINE (2026-07-14).
 *
 * The curated import stamped every Sandcastles row `baseline_label = 'vs followers'` — but 0 of the
 * 532 rows carry a follower_count, and the raw record has no follower field at all. Its one metric,
 * `outlier_score`, is measured against the creator's PAST VIDEO VIEWS (owner-confirmed). The card
 * therefore printed "proven by @colinandsamir · 1226.3× vs followers · 60M views" for an account
 * with well over a million followers, where a follower ratio would be nearer 60×.
 *
 * The number was always real. Only its NAME was invented — and read correctly ("1226× the views
 * that creator's videos usually get") it is a STRONGER claim than the one we faked.
 *
 * The basis is therefore carried PER ROW, and a row that cannot name its basis cannot make a claim.
 */
describe("proof requires a NAMED basis, and the corpus has two of them", () => {
  it("curated rows are proven against their own past views — the real Sandcastles basis", () => {
    const curated = row({
      source_pool: "curated",
      outlier_multiplier: 1226.3,
      follower_count: null, // Sandcastles never recorded one — and does not need to
      baseline_label: "vs their usual views",
    });
    expect(hasKnownBaseline(curated)).toBe(true);
    expect(isProofGrade(curated)).toBe(true);
    expect(matchRowToExample(curated).baselineLabel).toBe("vs their usual views");
  });

  it("scraped rows keep the follower basis WE computed — the two pools stay distinct", () => {
    const scraped = row({
      source_pool: "scraped",
      outlier_multiplier: 44,
      follower_count: 14_000,
      baseline_label: "vs followers",
    });
    expect(isProofGrade(scraped)).toBe(true);
    expect(matchRowToExample(scraped).baselineLabel).toBe("vs followers");
  });

  it("a multiplier with NO named basis is not proof, however large", () => {
    // The failure mode that shipped: a number with nothing behind it, reading as the most
    // impressive thing in the block precisely because it is the biggest.
    const baseless = row({
      source_pool: "curated",
      outlier_multiplier: 20154.7,
      follower_count: null,
      baseline_label: null,
    });
    expect(hasKnownBaseline(baseless)).toBe(false);
    expect(isProofGrade(baseless)).toBe(false);
    expect(matchRowToExample(baseless).baselineLabel).toBeNull();

    // …but it is still ADMITTED and still teaches — the human curation is the warrant.
    expect(isAdmissible(baseless)).toBe(true);
  });

  it("a scraped row cannot sneak in on a big number with no basis", () => {
    expect(
      isAdmissible(row({ source_pool: "scraped", outlier_multiplier: 9999, baseline_label: null })),
    ).toBe(false);
  });
});
