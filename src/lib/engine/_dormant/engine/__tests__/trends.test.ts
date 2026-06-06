/**
 * Unit tests for trends.ts — enrichWithTrends fuzzy matching, hashtag scoring, and trend context.
 */

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("@/lib/cache", () => ({
  createCache: () => ({
    get: vi.fn(() => null),
    set: vi.fn(),
    invalidate: vi.fn(),
  }),
}));

// Supabase mock with configurable table responses
let tableResponses: Record<string, { data: unknown; error: unknown }> = {};

const mockSupabaseChain = (tableResult: { data: unknown; error: unknown }) => {
  const chain: Record<string, unknown> = {};
  const methods = [
    "select",
    "eq",
    "is",
    "not",
    "gte",
    "gt",
    "or",
    "order",
    "limit",
    "maybeSingle",
  ];
  for (const method of methods) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (v: unknown) => void) => resolve(tableResult);
  return chain;
};

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      const response = tableResponses[table] ?? { data: [], error: null };
      return mockSupabaseChain(response);
    }),
  })),
}));

import { enrichWithTrends } from "../trends";
import { createServiceClient } from "@/lib/supabase/service";
import type { AnalysisInput } from "../types";

function makeInput(overrides?: Partial<AnalysisInput>): AnalysisInput {
  return {
    input_mode: "text" as const,
    content_text: "Check out this amazing content #viral #trending",
    content_type: "video" as const,
    mode: "score" as const,
    ...overrides,
  };
}

describe("enrichWithTrends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tableResponses = {
      trending_sounds: { data: [], error: null },
      scraped_videos: { data: [], error: null },
    };
  });

  it("returns default values when no trending data", async () => {
    const supabase = createServiceClient();
    const result = await enrichWithTrends(supabase, makeInput());

    expect(result.trend_score).toBeGreaterThanOrEqual(0);
    expect(result.matched_trends).toEqual([]);
    expect(result.trend_context).toBeDefined();
    expect(result.hashtag_relevance).toBeGreaterThanOrEqual(0);
  });

  it("matches trending sounds via fuzzy match", async () => {
    tableResponses.trending_sounds = {
      data: [
        {
          sound_name: "amazing content",
          velocity_score: 80,
          trend_phase: "rising",
        },
      ],
      error: null,
    };

    const supabase = createServiceClient();
    const result = await enrichWithTrends(
      supabase,
      makeInput({ content_text: "Check out this amazing content #viral" })
    );

    expect(result.matched_trends.length).toBeGreaterThan(0);
    expect(result.matched_trends[0]!.sound_name).toBe("amazing content");
    expect(result.trend_score).toBeGreaterThan(0);
  });

  it("applies phase multiplier for emerging sounds", async () => {
    tableResponses.trending_sounds = {
      data: [
        {
          sound_name: "amazing content",
          velocity_score: 50,
          trend_phase: "emerging",
        },
      ],
      error: null,
    };

    const supabase = createServiceClient();
    const emergingResult = await enrichWithTrends(
      supabase,
      makeInput({ content_text: "amazing content" })
    );

    tableResponses.trending_sounds = {
      data: [
        {
          sound_name: "amazing content",
          velocity_score: 50,
          trend_phase: "declining",
        },
      ],
      error: null,
    };

    const decliningResult = await enrichWithTrends(
      supabase,
      makeInput({ content_text: "amazing content" })
    );

    // Emerging should score higher than declining
    expect(emergingResult.trend_score).toBeGreaterThan(
      decliningResult.trend_score
    );
  });

  it("computes hashtag relevance from scraped videos", async () => {
    // Need enough videos so hashtags aren't saturated (threshold = count * 0.4)
    // Use 10 videos where #fitness appears in 3 (30% < 40% threshold)
    const videos = [
      { hashtags: ["#fitness", "#workout"], views: 50000 },
      { hashtags: ["#fitness", "#health"], views: 30000 },
      { hashtags: ["#fitness", "#gym"], views: 40000 },
      { hashtags: ["#cooking", "#food"], views: 20000 },
      { hashtags: ["#tech", "#gadgets"], views: 15000 },
      { hashtags: ["#travel", "#adventure"], views: 25000 },
      { hashtags: ["#music", "#dance"], views: 35000 },
      { hashtags: ["#art", "#creative"], views: 18000 },
      { hashtags: ["#pets", "#cute"], views: 22000 },
      { hashtags: ["#fashion", "#style"], views: 28000 },
    ];

    tableResponses.scraped_videos = { data: videos, error: null };

    const supabase = createServiceClient();
    const result = await enrichWithTrends(
      supabase,
      makeInput({ content_text: "My workout routine #fitness" })
    );

    expect(result.hashtag_relevance).toBeGreaterThan(0);
  });

  it("handles saturated hashtags (#fyp, #viral) with reduced weight", async () => {
    // Create enough videos that #fyp is saturated (> 40% of videos use it)
    const videos = Array.from({ length: 10 }, (_, i) => ({
      hashtags: i < 5 ? ["#fyp", "#random"] : ["#niche", "#unique"],
      views: 10000,
    }));

    tableResponses.scraped_videos = { data: videos, error: null };

    const supabase = createServiceClient();
    const result = await enrichWithTrends(
      supabase,
      makeInput({ content_text: "My content #fyp #niche" })
    );

    // Should still compute a score even with saturated hashtags
    expect(result.trend_score).toBeGreaterThanOrEqual(0);
  });

  it("generates context string for trending matches", async () => {
    tableResponses.trending_sounds = {
      data: [
        {
          sound_name: "amazing content",
          velocity_score: 80,
          trend_phase: "rising",
        },
      ],
      error: null,
    };

    const supabase = createServiceClient();
    const result = await enrichWithTrends(
      supabase,
      makeInput({ content_text: "amazing content #viral" })
    );

    expect(result.trend_context).toContain("trending sound");
    expect(result.trend_context).toContain("amazing content");
  });

  it("generates context string when no matches found", async () => {
    const supabase = createServiceClient();
    const result = await enrichWithTrends(
      supabase,
      makeInput({ content_text: "content without hashtags or sounds" })
    );

    expect(result.trend_context).toContain("No trending sound");
  });

  it("generates context with hashtags when no trending sounds match", async () => {
    const supabase = createServiceClient();
    const result = await enrichWithTrends(
      supabase,
      makeInput({ content_text: "My content #fitness #health" })
    );

    expect(result.trend_context).toContain("hashtag");
    expect(result.trend_context).toContain("#fitness");
  });

  it("handles null content_text gracefully", async () => {
    const supabase = createServiceClient();
    const result = await enrichWithTrends(supabase, {
      input_mode: "text" as const,
      content_text: undefined as unknown as string,
      content_type: "video" as const,
      mode: "score" as const,
    });

    expect(result.trend_score).toBe(0);
    expect(result.matched_trends).toEqual([]);
  });

  it("skips sounds with no sound_name", async () => {
    tableResponses.trending_sounds = {
      data: [
        { sound_name: null, velocity_score: 80, trend_phase: "rising" },
        {
          sound_name: "real sound",
          velocity_score: 60,
          trend_phase: "peak",
        },
      ],
      error: null,
    };

    const supabase = createServiceClient();
    const result = await enrichWithTrends(
      supabase,
      makeInput({ content_text: "real sound in this content" })
    );

    // Only the non-null sound should match
    expect(
      result.matched_trends.some((t) => t.sound_name === null)
    ).toBe(false);
  });

  it("normalizes trend_score to 0-100 range", async () => {
    tableResponses.trending_sounds = {
      data: [
        {
          sound_name: "super trend",
          velocity_score: 100,
          trend_phase: "emerging",
        },
        {
          sound_name: "another trend",
          velocity_score: 95,
          trend_phase: "emerging",
        },
      ],
      error: null,
    };

    const supabase = createServiceClient();
    const result = await enrichWithTrends(
      supabase,
      makeInput({
        content_text: "super trend and another trend #viral #fyp",
      })
    );

    expect(result.trend_score).toBeLessThanOrEqual(100);
    expect(result.trend_score).toBeGreaterThanOrEqual(0);
  });
});

// =====================================================
// Phase 6 D-F3 — audioFingerprintMatched gating
// =====================================================
//
// Per Phase 6 D-F3: when the audio_fingerprint stage matches a trending sound via
// pgvector, the Jaro-Winkler caption ↔ sound_name fallback in enrichWithTrends is
// SKIPPED (single source of truth — the aggregator synthesizes a matched_trends entry
// from the fingerprint result). When the fingerprint did not match, the Jaro-Winkler
// loop runs as before. The hashtag scoring loop is ORTHOGONAL to audio fingerprint
// and ALWAYS evaluates regardless of opts.audioFingerprintMatched.
describe("Phase 6 D-F3 audioFingerprintMatched gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tableResponses = {
      trending_sounds: { data: [], error: null },
      scraped_videos: { data: [], error: null },
    };
  });

  it("Test A: audioFingerprintMatched=true skips Jaro-Winkler sound loop (no sound matches even when caption contains sound_name)", async () => {
    // 5 candidate sounds, one of which would have matched the caption via Jaro-Winkler.
    tableResponses.trending_sounds = {
      data: [
        { sound_name: "amazing content", velocity_score: 80, trend_phase: "rising" },
        { sound_name: "obscure track", velocity_score: 30, trend_phase: "peak" },
        { sound_name: "another sound", velocity_score: 50, trend_phase: "emerging" },
        { sound_name: "loud beat", velocity_score: 40, trend_phase: "declining" },
        { sound_name: "soft tune", velocity_score: 60, trend_phase: "rising" },
      ],
      error: null,
    };

    const supabase = createServiceClient();
    const result = await enrichWithTrends(
      supabase,
      makeInput({ content_text: "Check out this amazing content #viral" }),
      { audioFingerprintMatched: true },
    );

    // No fuzzy sound match should populate matched_trends — fingerprint wins per D-F3.
    expect(result.matched_trends).toEqual([]);
  });

  it("Test B: audioFingerprintMatched=false runs Jaro-Winkler sound loop (caption→sound_name match populates matched_trends)", async () => {
    tableResponses.trending_sounds = {
      data: [
        { sound_name: "amazing content", velocity_score: 80, trend_phase: "rising" },
      ],
      error: null,
    };

    const supabase = createServiceClient();
    const result = await enrichWithTrends(
      supabase,
      makeInput({ content_text: "Check out this amazing content #viral" }),
      { audioFingerprintMatched: false },
    );

    // Fuzzy match should fire — exactly the v2.1 baseline behavior.
    expect(result.matched_trends.length).toBeGreaterThan(0);
    expect(result.matched_trends[0]!.sound_name).toBe("amazing content");
  });

  it("Test C: opts omitted defaults to UNGATED (back-compat — sound loop runs as before)", async () => {
    tableResponses.trending_sounds = {
      data: [
        { sound_name: "amazing content", velocity_score: 80, trend_phase: "rising" },
      ],
      error: null,
    };

    const supabase = createServiceClient();
    // No opts argument — must behave identically to pre-Phase-6 callers.
    const result = await enrichWithTrends(
      supabase,
      makeInput({ content_text: "Check out this amazing content #viral" }),
    );

    expect(result.matched_trends.length).toBeGreaterThan(0);
    expect(result.matched_trends[0]!.sound_name).toBe("amazing content");
  });

  it("Test D: hashtag loop is NEVER gated by audioFingerprintMatched (hashtags are orthogonal to audio fingerprint)", async () => {
    // No trending sounds — caption contains an unsaturated hashtag that scraped_videos
    // shows as popular. hashtag_relevance MUST still compute > 0 even when
    // audioFingerprintMatched=true (the gate is sound-loop-only, not hashtag-loop).
    const videos = [
      { hashtags: ["#fitness", "#workout"], views: 50000 },
      { hashtags: ["#fitness", "#health"], views: 30000 },
      { hashtags: ["#fitness", "#gym"], views: 40000 },
      { hashtags: ["#cooking", "#food"], views: 20000 },
      { hashtags: ["#tech", "#gadgets"], views: 15000 },
      { hashtags: ["#travel", "#adventure"], views: 25000 },
      { hashtags: ["#music", "#dance"], views: 35000 },
      { hashtags: ["#art", "#creative"], views: 18000 },
      { hashtags: ["#pets", "#cute"], views: 22000 },
      { hashtags: ["#fashion", "#style"], views: 28000 },
    ];
    tableResponses.scraped_videos = { data: videos, error: null };

    const supabase = createServiceClient();
    const result = await enrichWithTrends(
      supabase,
      makeInput({ content_text: "My workout routine #fitness" }),
      { audioFingerprintMatched: true },
    );

    // hashtag_relevance is orthogonal — must fire regardless of fingerprint gate.
    expect(result.hashtag_relevance).toBeGreaterThan(0);
  });
});
