/**
 * Tests for GET /api/channels/search (Discover Feed Phase 1.2).
 *   1 — auth-401
 *   2 — short query (<2 chars) → [] without touching the DB
 *   3 — happy: maps competitor_profiles rows to results
 *   4 — sanitization: filter-breaking chars are stripped before the .or() interpolation
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockOr, mockLimit } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockOr: vi.fn(),
  mockLimit: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({ auth: { getUser: mockGetUser } })),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({ select: vi.fn(() => ({ or: mockOr })) })),
  })),
}));

import { GET } from "../route";

function req(q: string) {
  return new Request(`http://localhost:3200/api/channels/search?q=${encodeURIComponent(q)}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  // .or(...).order(...).limit(...) → { data, error }
  mockOr.mockReturnValue({ order: vi.fn(() => ({ limit: mockLimit })) });
  mockLimit.mockResolvedValue({ data: [], error: null });
});

describe("GET /api/channels/search", () => {
  it("401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(req("zach"));
    expect(res.status).toBe(401);
  });

  it("returns [] for a query under 2 chars without querying", async () => {
    const res = await GET(req("z"));
    expect((await res.json()).results).toEqual([]);
    expect(mockOr).not.toHaveBeenCalled();
  });

  it("maps profile rows to search results", async () => {
    mockLimit.mockResolvedValue({
      data: [
        { tiktok_handle: "zachking", display_name: "Zach King", avatar_url: "a.jpg", follower_count: 100, video_count: 7 },
      ],
      error: null,
    });
    const res = await GET(req("zach"));
    const json = await res.json();
    expect(json.results).toEqual([
      { handle: "zachking", displayName: "Zach King", avatarUrl: "a.jpg", followerCount: 100, videoCount: 7 },
    ]);
  });

  it("strips filter-breaking chars before interpolating the .or() filter", async () => {
    await GET(req("zach,)(%_ "));
    // ',' '(' ')' '%' '_' all removed → only the structural or-separator comma remains
    expect(mockOr).toHaveBeenCalledWith(
      "tiktok_handle.ilike.%zach%,display_name.ilike.%zach%",
    );
  });
});
