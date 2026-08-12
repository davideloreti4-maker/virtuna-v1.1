import { describe, it, expect } from "vitest";
import { corpusRowToAdaptInput } from "../drop-adapt-input";
import type { SharedMatchRow } from "@/lib/grounding/corpus";

const base: SharedMatchRow = {
  id: "t1",
  similarity: 0.5,
  platform: "tiktok",
  platform_video_id: "v1",
  video_url: "https://t.example/v",
  cover_url: "https://s.example/c.jpg",
  creator_handle: "someone",
  source_pool: "curated",
  trust_weight: 1.5,
  views: 100,
  follower_count: null,
  outlier_multiplier: null,
  baseline_label: null,
  engagement_rate: null,
  posted_at: null,
  proof_captured_at: null,
  niche: "fitness",
  hook_archetype: "trap-mistake",
  format: "problem-solution",
  visual_hook: null,
  editing_style: null,
  spoken_hook: "If you have X, don't do Y.",
  hook_template: "If you have [problem], don't just [fix].",
  hook_source: "caption_fallback",
  idea: {
    seed: "s",
    angle: "a",
    belief: "forcing posture works",
    reality: "it compensates",
    evidence: "e",
  },
  template: {
    name: "n",
    slots: [],
    skeleton: ["The Trap", "The Turn", "The Fix"],
    guidance: "use when the intuitive fix fails",
    beats: [{ name: "The Turn", description: "reject the intuitive fix" }],
  },
  why_it_works: "prose that must never render",
  hook_techniques: null,
};

describe("corpusRowToAdaptInput", () => {
  it("maps the madlib, skeleton, tension and beats into honest structural fields", () => {
    const input = corpusRowToAdaptInput(base, "personal finance");
    expect(input).not.toBeNull();
    expect(input!.niche).toBe("personal finance");
    expect(input!.hook_pattern).toBe("If you have [problem], don't just [fix].");
    expect(input!.structure).toContain("The Trap → The Turn → The Fix");
    expect(input!.structure).toContain("use when the intuitive fix fails");
    expect(input!.the_turn).toContain("reject the intuitive fix");
    expect(input!.emotional_beat).toContain("forcing posture works");
    expect(input!.emotional_beat).toContain("it compensates");
    expect(input!.repeatable.length).toBeGreaterThan(0);
    expect(input!.repeatable[0]).toEqual({
      label: "The Turn",
      why_repeatable: "reject the intuitive fix",
    });
    // D-01: no luck lane exists on this path at all (compile-time by AdaptInput shape).
  });

  it("falls back to the spoken hook when no madlib exists", () => {
    const input = corpusRowToAdaptInput({ ...base, hook_template: null }, "n");
    expect(input!.hook_pattern).toBe("If you have X, don't do Y.");
  });

  it("states absence honestly instead of fabricating beats", () => {
    const input = corpusRowToAdaptInput({ ...base, template: null, idea: null }, "n");
    expect(input!.structure).toMatch(/does not record/i);
    expect(input!.the_turn).toMatch(/does not isolate/i);
    expect(input!.emotional_beat).toMatch(/does not name/i);
    // madlib backstop keeps the repeatable lane non-empty
    expect(input!.repeatable.length).toBeGreaterThan(0);
    expect(input!.repeatable[0]!.label).toBe(base.hook_template);
  });

  it("survives shape-drifted jsonb (parse guards, not casts)", () => {
    const input = corpusRowToAdaptInput(
      { ...base, template: { common_belief: "sandcastles keys" }, idea: 42 },
      "n",
    );
    expect(input).not.toBeNull();
    expect(input!.structure).toMatch(/does not record/i);
    expect(input!.emotional_beat).toMatch(/does not name/i);
  });

  it("returns null when the row has no hook structure to adapt", () => {
    expect(
      corpusRowToAdaptInput({ ...base, hook_template: null, spoken_hook: null }, "n"),
    ).toBeNull();
    expect(
      corpusRowToAdaptInput({ ...base, hook_template: "  ", spoken_hook: "" }, "n"),
    ).toBeNull();
  });
});
