/**
 * Tests for POST /api/channels/ingest (Discover Feed Phase 1.1).
 *
 *   1 — auth-401: no authenticated user
 *   2 — content-type-415: Content-Type not application/json
 *   3 — cross-origin-403: Origin mismatches the request origin
 *   4 — zod-400: missing/invalid handle
 *   5 — success-200: scrape → upsert competitor_profiles + scraped_videos with measured
 *                    signals + NORMALIZED creator_handle; status 'scraped'
 *   6 — cached: recent last_scraped_at → status 'cached', NO scrape, NO upsert
 *   7 — not-found-404: scrapeProfileBundle reports no profile data
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { VideoData } from "@/lib/scraping/types";

// ── Module mocks — MUST precede the route import (vi.mock factory hoisting) ──
const { mockGetUser, mockMaybeSingle, mockUpsert, mockScrapeBundle } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockMaybeSingle: vi.fn(),
  mockUpsert: vi.fn(),
  mockScrapeBundle: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({ auth: { getUser: mockGetUser } })),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: mockMaybeSingle })) })),
      upsert: mockUpsert,
    })),
  })),
}));

vi.mock("@/lib/scraping", () => ({
  createScrapingProvider: vi.fn(() => ({ scrapeProfileBundle: mockScrapeBundle })),
}));

import { POST } from "../route";

const ORIGIN = "http://localhost:3200";

function mkVideo(overrides: Partial<VideoData>): VideoData {
  return {
    platformVideoId: "vid1",
    videoUrl: "https://tiktok.com/@testuser/video/1",
    caption: "hello",
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    hashtags: ["fyp"],
    durationSeconds: 12,
    postedAt: new Date("2026-06-20T00:00:00Z"),
    ...overrides,
  };
}

function req(body: unknown, headers: Record<string, string> = { "content-type": "application/json" }) {
  return new Request(`${ORIGIN}/api/channels/ingest`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  mockMaybeSingle.mockResolvedValue({ data: null, error: null }); // no existing channel → scrape
  mockUpsert.mockResolvedValue({ error: null });
  mockScrapeBundle.mockResolvedValue({
    profile: {
      handle: "TestUser",
      displayName: "Test User",
      bio: "bio",
      avatarUrl: "https://cdn/a.jpg",
      verified: true,
      followerCount: 1000,
      followingCount: 10,
      heartCount: 5000,
      videoCount: 42,
    },
    videos: [
      mkVideo({ platformVideoId: "v100", views: 100, likes: 10, comments: 5, shares: 5 }),
      mkVideo({ platformVideoId: "v200", views: 200 }),
      mkVideo({ platformVideoId: "v300", views: 300 }),
    ],
    subCoverage: "3/3",
  });
});

describe("POST /api/channels/ingest", () => {
  it("401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req({ handle: "@testuser" }));
    expect(res.status).toBe(401);
    expect(mockScrapeBundle).not.toHaveBeenCalled();
  });

  it("415 when Content-Type is not application/json", async () => {
    const res = await POST(req(JSON.stringify({ handle: "@testuser" }), { "content-type": "text/plain" }));
    expect(res.status).toBe(415);
  });

  it("403 on cross-origin request", async () => {
    const res = await POST(
      req({ handle: "@testuser" }, { "content-type": "application/json", origin: "https://evil.example" }),
    );
    expect(res.status).toBe(403);
  });

  it("400 on invalid body (missing handle)", async () => {
    const res = await POST(req({ platform: "tiktok" }));
    expect(res.status).toBe(400);
    expect(mockScrapeBundle).not.toHaveBeenCalled();
  });

  it("200 scrapes + upserts profile and videos with measured signals + normalized handle", async () => {
    const res = await POST(req({ handle: "@TestUser" }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe("scraped");
    expect(json.handle).toBe("testuser"); // normalized
    expect(json.videosUpserted).toBe(3);
    expect(json.profile.displayName).toBe("Test User");

    // scraped with the normalized handle
    expect(mockScrapeBundle).toHaveBeenCalledWith("testuser");

    const calls = mockUpsert.mock.calls;
    const profileCall = calls.find((c) => !Array.isArray(c[0]))!;
    const videoCall = calls.find((c) => Array.isArray(c[0]))!;

    // competitor_profiles upsert — normalized handle, success status, conflict key
    expect(profileCall[0].tiktok_handle).toBe("testuser");
    expect(profileCall[0].scrape_status).toBe("success");
    expect(profileCall[0].last_scraped_at).toBeTruthy();
    expect(profileCall[1]).toEqual({ onConflict: "tiktok_handle" });

    // scraped_videos upsert — 3 rows, normalized creator_handle, measured columns
    const rows = videoCall[0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(3);
    expect(videoCall[1]).toEqual({ onConflict: "platform,platform_video_id", ignoreDuplicates: false });

    for (const row of rows) {
      expect(row.creator_handle).toBe("testuser");
      expect(row.baseline_label).toBe("vs own");
      expect(typeof row.outlier_multiplier).toBe("number");
      expect(typeof row.engagement_rate).toBe("number");
    }
    // baseline = median([100,200,300]) = 200 → multipliers 0.5 / 1 / 1.5
    const byId = Object.fromEntries(rows.map((r) => [r.platform_video_id, r]));
    expect(byId.v100!.outlier_multiplier).toBe(0.5);
    expect(byId.v300!.outlier_multiplier).toBe(1.5);
    expect(byId.v100!.engagement_rate).toBeCloseTo(0.2, 10);
  });

  it("returns 'cached' (no scrape, no upsert) when last_scraped_at is fresh", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        display_name: "Cached User",
        avatar_url: "https://cdn/c.jpg",
        follower_count: 50,
        video_count: 7,
        last_scraped_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1h ago < 24h
      },
      error: null,
    });
    const res = await POST(req({ handle: "@testuser" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("cached");
    expect(json.videosUpserted).toBe(0);
    expect(mockScrapeBundle).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("404 when the channel cannot be scraped (no profile data)", async () => {
    mockScrapeBundle.mockRejectedValue(new Error("No profile data returned for handle: ghost"));
    const res = await POST(req({ handle: "@ghost" }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("channel_not_found");
  });
});
