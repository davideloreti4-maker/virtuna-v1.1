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
