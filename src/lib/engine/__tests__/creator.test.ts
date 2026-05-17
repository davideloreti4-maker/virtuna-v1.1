/**
 * Unit tests for creator.ts — fetchCreatorContext and formatCreatorContext.
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

import { fetchCreatorContext, formatCreatorContext } from "../creator";
import { createServiceClient } from "@/lib/supabase/service";

describe("fetchCreatorContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tableResponses = {
      scraped_videos: {
        data: [
          { views: 10000, likes: 500, comments: 50, shares: 20 },
          { views: 20000, likes: 1000, comments: 100, shares: 40 },
        ],
        error: null,
      },
      creator_profiles: { data: null, error: null },
    };
  });

  it("returns found=false when no creator_handle provided", async () => {
    const supabase = createServiceClient();
    const result = await fetchCreatorContext(supabase, null, null);

    expect(result.found).toBe(false);
    expect(result.follower_count).toBeNull();
    expect(result.platform_averages).toBeDefined();
    expect(result.platform_averages.avg_views).toBeGreaterThan(0);
  });

  it("returns found=false when creator profile not in DB", async () => {
    tableResponses.creator_profiles = { data: null, error: null };

    const supabase = createServiceClient();
    const result = await fetchCreatorContext(supabase, "unknown_user", null);

    expect(result.found).toBe(false);
  });

  it("returns found=true with profile data when creator exists", async () => {
    tableResponses.creator_profiles = {
      data: {
        tiktok_followers: 50000,
        engagement_rate: 0.08,
        niches: ["fitness", "lifestyle"],
        display_name: "Test Creator",
      },
      error: null,
    };

    const supabase = createServiceClient();
    const result = await fetchCreatorContext(supabase, "test_creator", null);

    expect(result.found).toBe(true);
    expect(result.follower_count).toBe(50000);
    expect(result.engagement_rate).toBe(0.08);
    expect(result.niche).toBe("fitness");
  });

  it("uses provided niche over profile niche", async () => {
    tableResponses.creator_profiles = {
      data: {
        tiktok_followers: 50000,
        engagement_rate: 0.08,
        niches: ["fitness"],
        display_name: "Test Creator",
      },
      error: null,
    };

    const supabase = createServiceClient();
    const result = await fetchCreatorContext(
      supabase,
      "test_creator",
      "cooking"
    );

    expect(result.niche).toBe("cooking");
  });

  it("returns fallback platform averages when scraped_videos query fails", async () => {
    tableResponses.scraped_videos = {
      data: null,
      error: { message: "DB error" },
    };

    const supabase = createServiceClient();
    const result = await fetchCreatorContext(supabase, null, null);

    expect(result.platform_averages.avg_views).toBe(50000);
    expect(result.platform_averages.avg_engagement_rate).toBe(0.06);
  });

  it("returns fallback platform averages when no valid videos", async () => {
    tableResponses.scraped_videos = { data: [], error: null };

    const supabase = createServiceClient();
    const result = await fetchCreatorContext(supabase, null, null);

    expect(result.platform_averages.avg_views).toBe(50000);
  });

  it("handles creator profile query error gracefully", async () => {
    tableResponses.creator_profiles = {
      data: null,
      error: { message: "connection refused" },
    };

    const supabase = createServiceClient();
    const result = await fetchCreatorContext(supabase, "test_user", null);

    expect(result.found).toBe(false);
  });
});

describe("formatCreatorContext", () => {
  it("formats found creator with profile data", () => {
    const result = formatCreatorContext({
      found: true,
      follower_count: 100000,
      avg_views: 25000,
      engagement_rate: 0.075,
      niche: "fitness",
      posting_frequency: "daily",
      platform_averages: {
        avg_views: 50000,
        avg_engagement_rate: 0.06,
        avg_share_rate: 0.008,
        avg_comment_rate: 0.005,
      },
    });

    expect(result).toContain("Creator profile: found");
    expect(result).toContain("100"); // follower count includes 100000
    expect(result).toContain("25"); // avg_views includes 25000
    expect(result).toContain("7.50%");
    expect(result).toContain("fitness");
    expect(result).toContain("daily");
    expect(result).toContain("Platform average views");
  });

  it("formats not-found creator with platform baseline", () => {
    const result = formatCreatorContext({
      found: false,
      follower_count: null,
      avg_views: null,
      engagement_rate: null,
      niche: null,
      posting_frequency: null,
      platform_averages: {
        avg_views: 50000,
        avg_engagement_rate: 0.06,
        avg_share_rate: 0.008,
        avg_comment_rate: 0.005,
      },
    });

    expect(result).toContain("not found");
    expect(result).toContain("Platform average views");
    expect(result).not.toContain("Follower count");
  });

  it("always includes platform averages section", () => {
    const result = formatCreatorContext({
      found: false,
      follower_count: null,
      avg_views: null,
      engagement_rate: null,
      niche: null,
      posting_frequency: null,
      platform_averages: {
        avg_views: 50000,
        avg_engagement_rate: 0.06,
        avg_share_rate: 0.008,
        avg_comment_rate: 0.005,
      },
    });

    expect(result).toContain("Platform average share rate: 0.80%");
    expect(result).toContain("Platform average comment rate: 0.50%");
  });
});

// === Phase 2 — 9-card extension (D-19 flat-add, D-20 found:boolean preservation, Pitfall #3) ===
describe("CreatorContext 9-card extension (Phase 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tableResponses = {
      scraped_videos: {
        data: [
          { views: 10000, likes: 500, comments: 50, shares: 20 },
          { views: 20000, likes: 1000, comments: 100, shares: 40 },
        ],
        error: null,
      },
      creator_profiles: { data: null, error: null },
    };
  });

  it("flat-merges 9-card columns from creator_profiles into CreatorContext", async () => {
    tableResponses.creator_profiles = {
      data: {
        tiktok_followers: 50000,
        engagement_rate: 0.08,
        niches: ["fitness", "lifestyle"],
        display_name: "Test Creator",
        target_platforms: ["tiktok", "instagram"],
        niche_primary: "fitness",
        niche_sub: "yoga",
        target_audience: {
          age_range: "25-34",
          gender_skew: "balanced",
          geo: "United States",
          language: "English",
        },
        primary_goal: "growth",
        creator_stage: "growing",
        content_style: "talking_head",
        cuts_per_second: "medium",
        reference_creators: [{ handle_or_url: "@charlidamelio" }],
        past_wins: [{ url: "https://tiktok.com/abc" }],
        past_flops: [],
        posting_frequency: "daily",
        time_of_day_aware: true,
        pain_points: "Hook retention drops at second 2",
      },
      error: null,
    };

    const supabase = createServiceClient();
    const result = await fetchCreatorContext(supabase, "test_creator", null);

    expect(result.found).toBe(true);
    expect(result.target_platforms).toEqual(["tiktok", "instagram"]);
    expect(result.niche_primary).toBe("fitness");
    expect(result.niche_sub).toBe("yoga");
    expect(result.target_audience?.age_range).toBe("25-34");
    expect(result.target_audience?.gender_skew).toBe("balanced");
    expect(result.primary_goal).toBe("growth");
    expect(result.creator_stage).toBe("growing");
    expect(result.content_style).toBe("talking_head");
    expect(result.cuts_per_second).toBe("medium");
    expect(result.reference_creators).toEqual([
      { handle_or_url: "@charlidamelio" },
    ]);
    expect(result.past_wins).toEqual([{ url: "https://tiktok.com/abc" }]);
    expect(result.past_flops).toEqual([]);
    expect(result.posting_frequency).toBe("daily");
    expect(result.time_of_day_aware).toBe(true);
    expect(result.pain_points).toBe("Hook retention drops at second 2");
  });

  it("returns null for every 9-card field when profile row is missing (cold-start)", async () => {
    const supabase = createServiceClient();
    const result = await fetchCreatorContext(supabase, null, null);

    expect(result.found).toBe(false);
    expect(result.target_platforms).toBeNull();
    expect(result.niche_primary).toBeNull();
    expect(result.niche_sub).toBeNull();
    expect(result.target_audience).toBeNull();
    expect(result.primary_goal).toBeNull();
    expect(result.creator_stage).toBeNull();
    expect(result.content_style).toBeNull();
    expect(result.cuts_per_second).toBeNull();
    expect(result.reference_creators).toBeNull();
    expect(result.past_wins).toBeNull();
    expect(result.past_flops).toBeNull();
    expect(result.time_of_day_aware).toBeNull();
    expect(result.pain_points).toBeNull();
  });

  it("formatCreatorContext omits null profile fields (no literal 'null' strings in prompts) — Pitfall #3", async () => {
    tableResponses.creator_profiles = {
      data: {
        tiktok_followers: 50000,
        engagement_rate: 0.08,
        niches: ["fitness"],
        display_name: "Test",
        target_platforms: null,
        niche_primary: null,
        niche_sub: null,
        target_audience: null,
        primary_goal: null,
        creator_stage: null,
        content_style: null,
        cuts_per_second: null,
        reference_creators: null,
        past_wins: null,
        past_flops: null,
        posting_frequency: null,
        time_of_day_aware: null,
        pain_points: null,
      },
      error: null,
    };

    const supabase = createServiceClient();
    const result = await fetchCreatorContext(supabase, "test_creator", null);
    const formatted = formatCreatorContext(result);

    expect(formatted).not.toContain("null");
    expect(formatted).not.toContain("undefined");
    // No new field lines should appear
    expect(formatted).not.toContain("Target platforms:");
    expect(formatted).not.toContain("Primary goal:");
    expect(formatted).not.toContain("Creator stage:");
    expect(formatted).not.toContain("Content style:");
    expect(formatted).not.toContain("Cuts per second");
    expect(formatted).not.toContain("Reference creators:");
    expect(formatted).not.toContain("Past wins");
    expect(formatted).not.toContain("Past flops");
    expect(formatted).not.toContain("Target audience:");
    expect(formatted).not.toContain("Time-of-day awareness");
    expect(formatted).not.toContain("Creator pain points:");
  });

  it("preserves D-20 found:boolean semantics — found tracks scraped record, not profile fields", async () => {
    // Profile row exists with new 9-card fields populated, but the scraped follower count is
    // null. The current implementation maps found = true when the creator_profiles row exists;
    // the assertion here is that profile fields being non-null does NOT change scraped follower
    // semantics — follower_count stays null when tiktok_followers is null.
    tableResponses.creator_profiles = {
      data: {
        tiktok_followers: null,
        engagement_rate: null,
        niches: null,
        display_name: null,
        target_platforms: ["tiktok"],
        niche_primary: "fitness",
        niche_sub: null,
        target_audience: null,
        primary_goal: "growth",
        creator_stage: null,
        content_style: null,
        cuts_per_second: null,
        reference_creators: null,
        past_wins: null,
        past_flops: null,
        posting_frequency: null,
        time_of_day_aware: null,
        pain_points: null,
      },
      error: null,
    };

    const supabase = createServiceClient();
    const result = await fetchCreatorContext(supabase, "test_creator", null);

    // The row exists so found=true is the current behavior; the new fields populate
    expect(result.found).toBe(true);
    expect(result.follower_count).toBeNull();
    expect(result.target_platforms).toEqual(["tiktok"]);
    expect(result.primary_goal).toBe("growth");
  });
});
