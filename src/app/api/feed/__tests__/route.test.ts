/**
 * Tests for GET /api/feed (Discover Feed Phase 2.1).
 *   1 — auth-401
 *   2 — invalid query (bad sort) → 400
 *   3 — watched + nothing tracked → { watchedEmpty } short-circuit (no query)
 *   4 — watched + tracked → queryFeed runs with the user's handles; returns its page
 *   5 — trending → queryFeed runs with null handles
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockListTracked, mockQueryFeed } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockListTracked: vi.fn(),
  mockQueryFeed: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({ auth: { getUser: mockGetUser } })),
}));
vi.mock("@/lib/tracked-accounts/tracked-accounts-repo", () => ({
  listTrackedAccounts: mockListTracked,
}));
// keep the real decodeCursor + constants; only stub the query executor
vi.mock("@/lib/feed/feed-query", async (orig) => ({
  ...(await orig<typeof import("@/lib/feed/feed-query")>()),
  queryFeed: mockQueryFeed,
}));

import { GET } from "../route";

function req(qs: string) {
  return new Request(`http://localhost:3200/api/feed?${qs}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  mockQueryFeed.mockResolvedValue({ tiles: [{ platformVideoId: "v1" }], total: 1, nextCursor: null });
});

describe("GET /api/feed", () => {
  it("401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(req("tab=watched"));
    expect(res.status).toBe(401);
  });

  it("400 on an invalid sort", async () => {
    const res = await GET(req("tab=watched&sort=bogus"));
    expect(res.status).toBe(400);
    expect(mockQueryFeed).not.toHaveBeenCalled();
  });

  it("short-circuits the watched tab when nothing is tracked", async () => {
    mockListTracked.mockResolvedValue([]);
    const res = await GET(req("tab=watched"));
    const json = await res.json();
    expect(json).toMatchObject({ watchedEmpty: true, tiles: [], total: 0 });
    expect(mockQueryFeed).not.toHaveBeenCalled();
  });

  it("runs the watched query with the user's tracked tiktok handles", async () => {
    mockListTracked.mockResolvedValue([
      { id: "t1", platform: "tiktok", handle: "zachking", created_at: "x", user_id: "u1", source_video_id: null },
      { id: "t2", platform: "youtube", handle: "ytuser", created_at: "x", user_id: "u1", source_video_id: null },
    ]);
    const res = await GET(req("tab=watched&sort=outlier"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ total: 1, nextCursor: null });

    const [, params, handles] = mockQueryFeed.mock.calls[0]!;
    expect(handles).toEqual(["zachking"]); // youtube filtered out
    expect(params).toMatchObject({ tab: "watched", sort: "outlier" });
  });

  it("runs the trending query with null handles (whole corpus)", async () => {
    const res = await GET(req("tab=trending&sort=views"));
    expect(res.status).toBe(200);
    expect(mockListTracked).not.toHaveBeenCalled();
    const [, params, handles] = mockQueryFeed.mock.calls[0]!;
    expect(handles).toBeNull();
    expect(params).toMatchObject({ tab: "trending", sort: "views" });
  });
});
