/**
 * Unit tests for retrieval/pgvector-client.ts —
 *  - RPC param shape (5 named params: query_embedding, match_count, filter_niche,
 *    filter_platform, filter_follower_tier)
 *  - Throw on RPC error with descriptive message
 *  - Pass-through of nullable platform + followerTier (D-04 Tier 2/3 relaxation)
 *  - Default empty array when data is null
 *
 * Defensive mocks of @sentry/nextjs + @/lib/logger (modules don't currently use them
 * but mocking insulates against future additions).
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
  addBreadcrumb: vi.fn(),
}));

import {
  matchTrainingCorpus,
  matchScrapedVideos,
} from "@/lib/engine/retrieval/pgvector-client";
import type { MatchOptions } from "@/lib/engine/retrieval/pgvector-client";

interface MockRpc {
  rpc: ReturnType<typeof vi.fn>;
}

function makeMockSupabase(opts: {
  rpc_data?: unknown;
  rpc_error?: { message: string } | null;
}): MockRpc {
  const rpc = vi.fn(async () => ({
    data: opts.rpc_data ?? [],
    error: opts.rpc_error ?? null,
  }));
  return { rpc };
}

const baseOpts: MatchOptions = {
  embedding: [0.1, 0.2, 0.3],
  count: 5,
  niche: "beauty",
  platform: "tiktok",
  followerTier: "nano",
};

describe("matchTrainingCorpus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls match_corpus_videos with all 5 named params", async () => {
    const supabase = makeMockSupabase({ rpc_data: [] });
    await matchTrainingCorpus(supabase as never, baseOpts);
    expect(supabase.rpc).toHaveBeenCalledWith("match_corpus_videos", {
      query_embedding: [0.1, 0.2, 0.3],
      match_count: 5,
      filter_niche: "beauty",
      filter_platform: "tiktok",
      filter_follower_tier: "nano",
    });
  });

  it("returns rows when rpc succeeds", async () => {
    const mockRows = [{ source_id: "abc", similarity: 0.9 }];
    const supabase = makeMockSupabase({ rpc_data: mockRows });
    const result = await matchTrainingCorpus(supabase as never, baseOpts);
    expect(result).toEqual(mockRows);
  });

  it("returns [] when data is null (defensive)", async () => {
    const supabase = makeMockSupabase({ rpc_data: null });
    const result = await matchTrainingCorpus(supabase as never, baseOpts);
    expect(result).toEqual([]);
  });

  it("throws with descriptive message on rpc error", async () => {
    const supabase = makeMockSupabase({ rpc_error: { message: "boom" } });
    await expect(
      matchTrainingCorpus(supabase as never, baseOpts),
    ).rejects.toThrow(/match_corpus_videos RPC failed: boom/);
  });

  it("passes nullable platform + followerTier as NULL (D-04 Tier 2/3)", async () => {
    const supabase = makeMockSupabase({});
    await matchTrainingCorpus(supabase as never, {
      ...baseOpts,
      platform: null,
      followerTier: null,
    });
    expect(supabase.rpc).toHaveBeenCalledWith(
      "match_corpus_videos",
      expect.objectContaining({
        filter_platform: null,
        filter_follower_tier: null,
      }),
    );
  });

  it("passes opts.embedding as query_embedding and opts.count as match_count", async () => {
    const supabase = makeMockSupabase({});
    await matchTrainingCorpus(supabase as never, {
      ...baseOpts,
      embedding: [0.5, 0.6],
      count: 10,
    });
    expect(supabase.rpc).toHaveBeenCalledWith(
      "match_corpus_videos",
      expect.objectContaining({
        query_embedding: [0.5, 0.6],
        match_count: 10,
      }),
    );
  });
});

describe("matchScrapedVideos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls match_scraped_videos with all 5 named params", async () => {
    const supabase = makeMockSupabase({});
    await matchScrapedVideos(supabase as never, {
      ...baseOpts,
      niche: "tech-gadgets",
    });
    expect(supabase.rpc).toHaveBeenCalledWith(
      "match_scraped_videos",
      expect.objectContaining({
        query_embedding: baseOpts.embedding,
        match_count: 5,
        filter_niche: "tech-gadgets",
        filter_platform: "tiktok",
        filter_follower_tier: "nano",
      }),
    );
  });

  it("throws with descriptive message on rpc error", async () => {
    const supabase = makeMockSupabase({ rpc_error: { message: "rpc-broke" } });
    await expect(
      matchScrapedVideos(supabase as never, baseOpts),
    ).rejects.toThrow(/match_scraped_videos RPC failed: rpc-broke/);
  });

  it("returns [] when data is null", async () => {
    const supabase = makeMockSupabase({ rpc_data: null });
    const result = await matchScrapedVideos(supabase as never, baseOpts);
    expect(result).toEqual([]);
  });

  it("passes null platform + null followerTier through to RPC", async () => {
    const supabase = makeMockSupabase({});
    await matchScrapedVideos(supabase as never, {
      ...baseOpts,
      platform: null,
      followerTier: null,
    });
    expect(supabase.rpc).toHaveBeenCalledWith(
      "match_scraped_videos",
      expect.objectContaining({
        filter_platform: null,
        filter_follower_tier: null,
      }),
    );
  });
});
