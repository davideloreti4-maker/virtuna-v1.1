/**
 * Tests for GET /api/channels/watchlist (Discover Feed Phase 1.2).
 *   1 — auth-401
 *   2 — empty: nothing tracked → [] (no enrichment queries)
 *   3 — enrich: tiktok handles joined with competitor_profiles + aggregate views;
 *       non-tiktok platforms filtered out
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockListTracked, mockProfilesIn, mockVideosIn } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockListTracked: vi.fn(),
  mockProfilesIn: vi.fn(),
  mockVideosIn: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({ auth: { getUser: mockGetUser } })),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        in: table === "competitor_profiles" ? mockProfilesIn : mockVideosIn,
      })),
    })),
  })),
}));
vi.mock("@/lib/tracked-accounts/tracked-accounts-repo", () => ({
  listTrackedAccounts: mockListTracked,
}));

import { GET } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  mockProfilesIn.mockResolvedValue({ data: [] });
  mockVideosIn.mockResolvedValue({ data: [] });
});

describe("GET /api/channels/watchlist", () => {
  it("401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns [] when nothing tracked (skips enrichment)", async () => {
    mockListTracked.mockResolvedValue([]);
    const res = await GET();
    expect((await res.json()).channels).toEqual([]);
    expect(mockProfilesIn).not.toHaveBeenCalled();
  });

  it("enriches tiktok handles with profile + aggregate views, drops other platforms", async () => {
    mockListTracked.mockResolvedValue([
      { id: "t1", platform: "tiktok", handle: "zachking", created_at: "2026-06-29T00:00:00Z", user_id: "u1", source_video_id: null },
      { id: "t2", platform: "instagram", handle: "iguser", created_at: "2026-06-28T00:00:00Z", user_id: "u1", source_video_id: null },
    ]);
    mockProfilesIn.mockResolvedValue({
      data: [
        { tiktok_handle: "zachking", display_name: "Zach King", avatar_url: "a.jpg", follower_count: 100, video_count: 7, last_scraped_at: "2026-06-29T01:00:00Z" },
      ],
    });
    mockVideosIn.mockResolvedValue({
      data: [
        { creator_handle: "zachking", views: 50 },
        { creator_handle: "zachking", views: 30 },
      ],
    });

    const res = await GET();
    const json = await res.json();
    expect(json.channels).toHaveLength(1); // instagram filtered out
    expect(json.channels[0]).toMatchObject({
      id: "t1",
      handle: "zachking",
      displayName: "Zach King",
      followerCount: 100,
      videoCount: 7,
      totalViews: 80,
    });
  });
});
