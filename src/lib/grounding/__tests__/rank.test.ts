/**
 * rank.test.ts — the structural ranker (hooks).
 *
 * These fixtures encode the SHAPE of the real corpus, because the real corpus is what broke the
 * topical path: 14 archetypes with a dominant `personal-experience` class (164 of 532), and a
 * topical cosine that correlates with nothing a hook creator needs. A ranker tested on a uniform
 * fixture would pass while doing nothing — the majority-class skew is the whole point.
 */

import { describe, it, expect } from "vitest";
import { selectStructuralExamples, hasHookStructure } from "../rank";
import type { SharedMatchRow } from "../corpus";

function row(overrides: Partial<SharedMatchRow> = {}): SharedMatchRow {
  return {
    id: "td-1",
    similarity: 0.4,
    platform: "tiktok",
    platform_video_id: "v1",
    video_url: null,
    cover_url: null,
    creator_handle: "maker",
    source_pool: "curated",
    trust_weight: 1.5,
    views: 100_000,
    follower_count: 1_000,
    outlier_multiplier: null,
    baseline_label: "vs followers",
    engagement_rate: null,
    posted_at: null,
    proof_captured_at: null,
    niche: null,
    hook_archetype: "personal-experience",
    format: null,
    visual_hook: null,
    editing_style: null,
    hook_techniques: null,
    spoken_hook: "I built and sold my company.",
    hook_template: "I [achieved result] for [value].",
    hook_source: null,
    idea: null,
    template: null,
    why_it_works: "specificity",
    ...overrides,
  };
}

describe("hasHookStructure", () => {
  it("requires a madlib or a spoken line — an idea alone teaches no hook", () => {
    expect(hasHookStructure(row())).toBe(true);
    expect(hasHookStructure(row({ hook_template: null }))).toBe(true); // spoken survives
    expect(hasHookStructure(row({ spoken_hook: null }))).toBe(true); // madlib survives
    expect(hasHookStructure(row({ hook_template: null, spoken_hook: null }))).toBe(false);
    // Empty is not the same as absent — whitespace is not a hook.
    expect(hasHookStructure(row({ hook_template: "  ", spoken_hook: "" }))).toBe(false);
  });
});

describe("selectStructuralExamples", () => {
  it("spans distinct archetypes instead of returning the majority class N times", () => {
    // The corpus shape that beat the old ranker: one huge class, several small ones. Cosine ranked
    // these purely by similarity and returned six `personal-experience` rows — six copies of one
    // lesson. Note the majority rows here are ALSO the most topically similar, so a ranker that
    // still leans on similarity fails this test.
    const rows = [
      ...Array.from({ length: 6 }, (_, i) =>
        row({ id: `pe-${i}`, hook_archetype: "personal-experience", similarity: 0.9 - i * 0.01 }),
      ),
      row({ id: "auth", hook_archetype: "authority", similarity: 0.5 }),
      row({ id: "quest", hook_archetype: "question", similarity: 0.45 }),
      row({ id: "contra", hook_archetype: "contrarian", similarity: 0.4 }),
    ];

    const picked = selectStructuralExamples(rows, 4);

    expect(picked).toHaveLength(4);
    const archetypes = picked.map((r) => r.hook_archetype);
    expect(new Set(archetypes).size).toBe(4);
    expect(archetypes).toContain("authority");
    expect(archetypes).toContain("question");
    expect(archetypes).toContain("contrarian");
  });

  it("prefers a PROVEN exemplar of a shape over a merely topical one", () => {
    const rows = [
      row({ id: "near-unproven", hook_archetype: "authority", similarity: 0.95, outlier_multiplier: null }),
      row({ id: "far-proven", hook_archetype: "authority", similarity: 0.30, outlier_multiplier: 44 }),
    ];

    // Same archetype → the tiebreak order decides, and proof outranks topic.
    expect(selectStructuralExamples(rows, 1).map((r) => r.id)).toEqual(["far-proven"]);
  });

  it("uses topic only as a tiebreaker WITHIN an archetype — never as a gate", () => {
    const rows = [
      row({ id: "auth-far", hook_archetype: "authority", similarity: 0.10 }),
      row({ id: "auth-near", hook_archetype: "authority", similarity: 0.55 }),
    ];

    // Both are far below the retired 0.58 floor. Both survive; topic only orders them.
    const picked = selectStructuralExamples(rows, 2);
    expect(picked.map((r) => r.id)).toEqual(["auth-near", "auth-far"]);
  });

  it("wraps and deepens rather than returning short when archetypes run out", () => {
    const rows = [
      row({ id: "a1", hook_archetype: "authority", similarity: 0.9 }),
      row({ id: "a2", hook_archetype: "authority", similarity: 0.8 }),
      row({ id: "q1", hook_archetype: "question", similarity: 0.7 }),
    ];

    // 2 archetypes, 3 slots → one full round-robin, then a second pass for the deeper bench.
    expect(selectStructuralExamples(rows, 3).map((r) => r.id)).toEqual(["a1", "q1", "a2"]);
  });

  it("drops rows with no hook structure, and returns [] when none has any", () => {
    const rows = [
      row({ id: "hookless", hook_template: null, spoken_hook: null }),
      row({ id: "real", hook_archetype: "question" }),
    ];
    expect(selectStructuralExamples(rows, 6).map((r) => r.id)).toEqual(["real"]);
    expect(selectStructuralExamples([row({ hook_template: null, spoken_hook: null })], 6)).toEqual([]);
  });

  it("groups the unclassified rows rather than dropping them (8 of 532 have no archetype)", () => {
    const rows = [
      row({ id: "none-1", hook_archetype: null }),
      row({ id: "auth", hook_archetype: "authority" }),
    ];
    const picked = selectStructuralExamples(rows, 2);
    expect(picked.map((r) => r.id).sort()).toEqual(["auth", "none-1"]);
  });
});
