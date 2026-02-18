/**
 * Unit tests for rules.ts — regex pattern matching and scoreContentAgainstRules.
 *
 * matchesPattern is private, so we test it indirectly through scoreContentAgainstRules
 * by building Rule objects with specific patterns.
 */
import { vi } from "vitest";

// Mock external dependencies before importing rules.ts
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

let mockRulesResult: { data: unknown; error: unknown } = {
  data: [],
  error: null,
};

const mockRulesChain = () => {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "is", "not", "gte", "gt", "or", "order", "limit"];
  for (const method of methods) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (v: unknown) => void) => resolve(mockRulesResult);
  return chain;
};

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => mockRulesChain()),
  })),
}));

vi.mock("@/lib/cache", () => ({
  createCache: () => ({
    get: vi.fn(() => null),
    set: vi.fn(),
    invalidate: vi.fn(),
  }),
}));

vi.mock("openai", () => ({
  default: vi.fn(),
}));

import { scoreContentAgainstRules, loadActiveRules } from "../rules";
import { createServiceClient } from "@/lib/supabase/service";

// Rule interface matching rules.ts internal type
interface Rule {
  id: string;
  name: string;
  description: string | null;
  category: string;
  pattern: string | null;
  score_modifier: number | null;
  platform: string | null;
  evaluation_prompt: string | null;
  evaluation_tier: "regex" | "semantic";
  weight: number;
  max_score: number;
}

function makeRule(name: string, pattern: string, overrides?: Partial<Rule>): Rule {
  return {
    id: `rule-${name}`,
    name,
    description: null,
    category: "content",
    pattern,
    score_modifier: 10,
    platform: null,
    evaluation_prompt: null,
    evaluation_tier: "regex" as const,
    weight: 1,
    max_score: 10,
    ...overrides,
  };
}

// Helper: run scoreContentAgainstRules with a single rule and return whether it matched
async function patternMatches(
  pattern: string,
  content: string
): Promise<boolean> {
  const rule = makeRule(pattern, pattern);
  const result = await scoreContentAgainstRules(content, [rule]);
  return result.matched_rules.length > 0;
}

describe("regex pattern matching via scoreContentAgainstRules", () => {
  // 1. question_hook
  it("question_hook: matches content starting with a question", async () => {
    expect(await patternMatches("question_hook", "What if you tried this?")).toBe(true);
  });
  it("question_hook: does not match non-question content", async () => {
    expect(await patternMatches("question_hook", "This is great.")).toBe(false);
  });

  // 2. curiosity_gap
  it("curiosity_gap: matches content with curiosity keywords", async () => {
    expect(await patternMatches("curiosity_gap", "The secret to success")).toBe(true);
  });
  it("curiosity_gap: does not match neutral content", async () => {
    expect(await patternMatches("curiosity_gap", "I went to the store")).toBe(false);
  });

  // 3. negative_bias
  it("negative_bias: matches content with negative keywords", async () => {
    expect(await patternMatches("negative_bias", "Stop making this mistake")).toBe(true);
  });
  it("negative_bias: does not match positive content", async () => {
    expect(await patternMatches("negative_bias", "I love cooking")).toBe(false);
  });

  // 4. bold_claim
  it("bold_claim: matches content with absolute claims", async () => {
    expect(await patternMatches("bold_claim", "Everyone needs this")).toBe(true);
  });
  it("bold_claim: does not match hedged content", async () => {
    expect(await patternMatches("bold_claim", "Some people might like this")).toBe(false);
  });

  // 5. story_hook
  it("story_hook: matches content with story indicators", async () => {
    expect(await patternMatches("story_hook", "I remember when I first tried")).toBe(true);
  });
  it("story_hook: does not match non-story content", async () => {
    expect(await patternMatches("story_hook", "Product review 2026")).toBe(false);
  });

  // 6. loop_structure — always returns false
  it("loop_structure: always returns false (needs video analysis)", async () => {
    expect(await patternMatches("loop_structure", "This loops perfectly")).toBe(false);
    expect(await patternMatches("loop_structure", "Random content here")).toBe(false);
  });

  // 7. payoff_delay
  it("payoff_delay: matches content with delayed payoff phrases", async () => {
    expect(await patternMatches("payoff_delay", "Wait for it...")).toBe(true);
  });
  it("payoff_delay: does not match immediate content", async () => {
    expect(await patternMatches("payoff_delay", "Here is the result")).toBe(false);
  });

  // 8. pattern_interrupt
  it("pattern_interrupt: matches content with interruption phrases", async () => {
    expect(await patternMatches("pattern_interrupt", "But wait, there's more")).toBe(true);
  });
  it("pattern_interrupt: does not match normal content", async () => {
    expect(await patternMatches("pattern_interrupt", "Cooking recipe step 1")).toBe(false);
  });

  // 9. info_density
  it("info_density: matches content with >50 words", async () => {
    const longContent = Array(55).fill("word").join(" ");
    expect(await patternMatches("info_density", longContent)).toBe(true);
  });
  it("info_density: does not match short content", async () => {
    expect(await patternMatches("info_density", "Short text")).toBe(false);
  });

  // 10. emotional_arc — always returns false
  it("emotional_arc: always returns false (needs full content analysis)", async () => {
    expect(await patternMatches("emotional_arc", "I was sad then happy")).toBe(false);
    expect(await patternMatches("emotional_arc", "Just a normal day")).toBe(false);
  });

  // 11. short_duration
  it("short_duration: matches content shorter than 300 chars", async () => {
    expect(await patternMatches("short_duration", "Quick tip about cooking")).toBe(true);
  });
  it("short_duration: does not match long content (>300 chars)", async () => {
    const longContent = "A".repeat(301);
    expect(await patternMatches("short_duration", longContent)).toBe(false);
  });

  // 12. caption_hook
  it("caption_hook: matches content with short punchy opening sentence", async () => {
    expect(await patternMatches("caption_hook", "This changed everything.")).toBe(true);
  });
  it("caption_hook: does not match content with very long first sentence", async () => {
    // >80 chars before first punctuation
    const longOpener = "A".repeat(85) + ". Then something else.";
    expect(await patternMatches("caption_hook", longOpener)).toBe(false);
  });

  // 13. cta_clarity
  it("cta_clarity: matches content with CTA keywords", async () => {
    expect(await patternMatches("cta_clarity", "Follow me for more tips")).toBe(true);
  });
  it("cta_clarity: does not match content without CTA", async () => {
    expect(await patternMatches("cta_clarity", "The weather is nice today")).toBe(false);
  });

  // 14. authenticity
  it("authenticity: matches content with first-person language", async () => {
    expect(await patternMatches("authenticity", "I personally tried this")).toBe(true);
  });
  it("authenticity: does not match impersonal content", async () => {
    expect(await patternMatches("authenticity", "Studies show that results vary")).toBe(false);
  });
});

describe("scoreContentAgainstRules — scoring", () => {
  it("returns rule_score in 0-100 range", async () => {
    const rules = [
      makeRule("question_hook", "question_hook"),
      makeRule("cta_clarity", "cta_clarity"),
      makeRule("authenticity", "authenticity"),
    ];
    const result = await scoreContentAgainstRules(
      "What do you think? Follow me for more, I tried this myself.",
      rules
    );
    expect(result.rule_score).toBeGreaterThanOrEqual(0);
    expect(result.rule_score).toBeLessThanOrEqual(100);
  });

  it("returns 50 for empty rules array", async () => {
    const result = await scoreContentAgainstRules("Some content here", []);
    expect(result.rule_score).toBe(50);
  });

  it("matched_rules contains matched rule details with correct shape", async () => {
    const rule = makeRule("cta_clarity", "cta_clarity");
    const result = await scoreContentAgainstRules("Follow me for more tips", [rule]);

    expect(result.matched_rules).toHaveLength(1);
    expect(result.matched_rules[0]).toEqual(
      expect.objectContaining({
        rule_id: "rule-cta_clarity",
        rule_name: "cta_clarity",
        tier: "regex",
      })
    );
    expect(result.matched_rules[0].score).toBeGreaterThan(0);
    expect(result.matched_rules[0].max_score).toBe(10);
  });

  it("unmatched rules produce empty matched_rules", async () => {
    const rule = makeRule("question_hook", "question_hook");
    const result = await scoreContentAgainstRules("No question here.", [rule]);
    expect(result.matched_rules).toHaveLength(0);
  });

  it("handles regex rule without pattern (scores 0)", async () => {
    const rule = makeRule("no_pattern", "", {
      pattern: null,
    });
    const result = await scoreContentAgainstRules("Any content here", [rule]);
    expect(result.matched_rules).toHaveLength(0);
  });

  it("handles regex rule without score_modifier", async () => {
    const rule = makeRule("cta_clarity", "cta_clarity", {
      score_modifier: null,
    });
    const result = await scoreContentAgainstRules("Follow me", [rule]);
    // Pattern matches but score_modifier is null -> no match recorded
    expect(result.matched_rules).toHaveLength(0);
  });

  it("handles unknown regex pattern (returns false)", async () => {
    const rule = makeRule("unknown_pattern", "totally_unknown");
    const result = await scoreContentAgainstRules("Any content here", [rule]);
    expect(result.matched_rules).toHaveLength(0);
  });

  it("normalizes score to max_score cap", async () => {
    const rule = makeRule("cta_clarity", "cta_clarity", {
      score_modifier: 100, // Very high modifier
      max_score: 10,
    });
    const result = await scoreContentAgainstRules("Follow me", [rule]);
    if (result.matched_rules.length > 0) {
      expect(result.matched_rules[0]!.score).toBeLessThanOrEqual(10);
    }
  });

  it("trending_sound always returns false for regex tier", async () => {
    expect(await patternMatches("trending_sound", "trending sound in my video")).toBe(false);
  });

  it("trending_audio always returns false for regex tier", async () => {
    expect(await patternMatches("trending_audio", "popular audio track")).toBe(false);
  });

  it("text_overlay always returns true for regex tier", async () => {
    expect(await patternMatches("text_overlay", "anything")).toBe(true);
  });

  it("handles semantic tier rules (without API, defaults to empty)", async () => {
    const semanticRule = makeRule("niche_authority", "", {
      evaluation_tier: "semantic" as const,
      evaluation_prompt: "Evaluate niche authority",
      pattern: null,
    });
    const result = await scoreContentAgainstRules("Content about cooking", [semanticRule]);
    // Without a real API response, semantic rules don't contribute matches
    expect(result.rule_score).toBeGreaterThanOrEqual(0);
    expect(result.rule_score).toBeLessThanOrEqual(100);
  });

  it("handles semantic tier rules without evaluation_prompt", async () => {
    const semanticRule = makeRule("no_prompt_rule", "", {
      evaluation_tier: "semantic" as const,
      evaluation_prompt: null,
      pattern: null,
    });
    const result = await scoreContentAgainstRules("Content", [semanticRule]);
    expect(result.matched_rules).toHaveLength(0);
  });
});

// =====================================================
// loadActiveRules
// =====================================================

describe("loadActiveRules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRulesResult = { data: [], error: null };
  });

  it("returns empty array when no rules exist", async () => {
    mockRulesResult = { data: [], error: null };
    const supabase = createServiceClient();
    const rules = await loadActiveRules(supabase);
    expect(rules).toEqual([]);
  });

  it("returns rules from database", async () => {
    mockRulesResult = {
      data: [
        {
          id: "r1",
          name: "test_rule",
          description: null,
          category: "content",
          pattern: "question_hook",
          score_modifier: 10,
          platform: null,
          evaluation_prompt: null,
          evaluation_tier: "regex",
          weight: 1,
          max_score: 10,
        },
      ],
      error: null,
    };
    const supabase = createServiceClient();
    const rules = await loadActiveRules(supabase);
    expect(rules).toHaveLength(1);
  });

  it("returns empty array on query error", async () => {
    mockRulesResult = { data: null, error: { message: "DB error" } };
    const supabase = createServiceClient();
    const rules = await loadActiveRules(supabase);
    expect(rules).toEqual([]);
  });
});
