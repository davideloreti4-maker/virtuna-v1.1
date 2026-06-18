/**
 * Phase 7 Plan 03 — calibration.ts + persona-repaint.ts (TDD RED phase).
 *
 * Tests:
 *  1. thin-data → general fallback (no CalibratedPersona fabricated)
 *  2. scrape throw → scrape_failed (distinct from thin fallback)
 *  3. success path → personas.length === 10 + persona_weights === biasForGoalIntent(goalIntent)
 *  4. determinism: same input → byte-identical repaint output (Pitfall 2)
 *  5. thin gate is on getFollowerTier(null) AND videos < THIN_MIN_VIDEOS (both required)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock ApifyScrapingProvider ───────────────────────────────────────────────

// Mock before importing calibration (which imports ApifyScrapingProvider internally)
const mockScrapeProfile = vi.fn();
const mockScrapeVideos = vi.fn();

vi.mock("@/lib/scraping/apify-provider", () => ({
  ApifyScrapingProvider: vi.fn().mockImplementation(() => ({
    scrapeProfile: mockScrapeProfile,
    scrapeVideos: mockScrapeVideos,
  })),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import {
  calibrateFromScrape,
  deriveAudienceProfile,
  THIN_MIN_VIDEOS,
} from "../calibration";
import { repaintPersonas } from "../persona-repaint";
import { biasForGoalIntent } from "../goal-intent";
import type { ProfileData, VideoData } from "@/lib/scraping/types";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeProfile(followerCount: number): ProfileData {
  return {
    handle: "testcreator",
    displayName: "Test Creator",
    bio: "Making content daily",
    avatarUrl: "https://example.com/avatar.jpg",
    verified: false,
    followerCount,
    followingCount: 500,
    heartCount: 100_000,
    videoCount: 50,
  };
}

function makeVideos(count: number): VideoData[] {
  return Array.from({ length: count }, (_, i) => ({
    platformVideoId: `vid_${i}`,
    videoUrl: `https://tiktok.com/@testcreator/video/${i}`,
    caption: `Video caption ${i} #content #creator`,
    views: 1000 + i * 100,
    likes: 100 + i * 10,
    comments: 10 + i,
    shares: 5 + i,
    saves: 3 + i,
    hashtags: ["content", "creator"],
    durationSeconds: 30,
    postedAt: new Date("2026-06-01"),
  }));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("THIN_MIN_VIDEOS", () => {
  it("should be a positive integer (default: 10)", () => {
    expect(typeof THIN_MIN_VIDEOS).toBe("number");
    expect(THIN_MIN_VIDEOS).toBeGreaterThan(0);
    expect(Number.isInteger(THIN_MIN_VIDEOS)).toBe(true);
  });
});

describe("calibrateFromScrape — thin-data fallback (honesty spine D-06)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { fallback: 'general', reason: 'thin' } when followerCount is 0 AND videos < THIN_MIN_VIDEOS", async () => {
    mockScrapeProfile.mockResolvedValue(makeProfile(0)); // followerCount 0 → getFollowerTier returns null
    mockScrapeVideos.mockResolvedValue(makeVideos(THIN_MIN_VIDEOS - 1)); // below threshold

    const result = await calibrateFromScrape({
      handle: "testcreator",
      type: "personal",
      platform: "tiktok",
      goalIntent: "grow",
      name: "My Audience",
    });

    expect(result).toHaveProperty("fallback", "general");
    expect(result).toHaveProperty("reason", "thin");
    // Honesty spine: NEVER fabricate CalibratedPersona on the fallback path
    expect(result).not.toHaveProperty("audience");
  });

  it("returns { fallback: 'general', reason: 'thin' } when followerCount is null AND videos < THIN_MIN_VIDEOS", async () => {
    mockScrapeProfile.mockResolvedValue({ ...makeProfile(0), followerCount: null as unknown as number });
    mockScrapeVideos.mockResolvedValue([]);

    const result = await calibrateFromScrape({
      handle: "testcreator",
      type: "personal",
      platform: "tiktok",
      goalIntent: "grow",
      name: "My Audience",
    });

    expect(result).toHaveProperty("fallback", "general");
    expect(result).not.toHaveProperty("audience");
  });

  it("does NOT fall back to thin when followerCount > 0 (tier resolves)", async () => {
    mockScrapeProfile.mockResolvedValue(makeProfile(50_000)); // micro tier → not null
    mockScrapeVideos.mockResolvedValue(makeVideos(THIN_MIN_VIDEOS)); // at threshold

    const result = await calibrateFromScrape({
      handle: "testcreator",
      type: "personal",
      platform: "tiktok",
      goalIntent: "grow",
      name: "My Audience",
    });

    // Should be success path, not fallback
    expect(result).not.toHaveProperty("fallback");
    expect(result).toHaveProperty("audience");
  });
});

describe("calibrateFromScrape — scrape_failed (distinct from thin)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { error: 'scrape_failed' } when scrapeProfile throws", async () => {
    mockScrapeProfile.mockRejectedValue(new Error("Network timeout"));
    mockScrapeVideos.mockResolvedValue(makeVideos(20));

    const result = await calibrateFromScrape({
      handle: "testcreator",
      type: "personal",
      platform: "tiktok",
      goalIntent: "grow",
      name: "My Audience",
    });

    expect(result).toHaveProperty("error", "scrape_failed");
    expect(result).not.toHaveProperty("fallback");
    expect(result).not.toHaveProperty("audience");
  });

  it("returns { error: 'scrape_failed' } when scrapeVideos throws", async () => {
    mockScrapeProfile.mockResolvedValue(makeProfile(50_000));
    mockScrapeVideos.mockRejectedValue(new Error("Actor failed"));

    const result = await calibrateFromScrape({
      handle: "testcreator",
      type: "personal",
      platform: "tiktok",
      goalIntent: "grow",
      name: "My Audience",
    });

    expect(result).toHaveProperty("error", "scrape_failed");
    expect(result).not.toHaveProperty("fallback");
  });
});

describe("calibrateFromScrape — success path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { audience } with exactly 10 CalibratedPersona entries", async () => {
    mockScrapeProfile.mockResolvedValue(makeProfile(50_000));
    mockScrapeVideos.mockResolvedValue(makeVideos(THIN_MIN_VIDEOS));

    const result = await calibrateFromScrape({
      handle: "testcreator",
      type: "personal",
      platform: "tiktok",
      goalIntent: "grow",
      name: "My Audience",
    });

    expect(result).toHaveProperty("audience");
    const { audience } = result as { audience: { personas: unknown[] } };
    expect(audience.personas).toHaveLength(10);
  });

  it("bakes goal-intent bias into persona_weights once (Pitfall 2: no per-run nondeterminism)", async () => {
    mockScrapeProfile.mockResolvedValue(makeProfile(50_000));
    mockScrapeVideos.mockResolvedValue(makeVideos(THIN_MIN_VIDEOS));

    const result = await calibrateFromScrape({
      handle: "testcreator",
      type: "personal",
      platform: "tiktok",
      goalIntent: "nurture",
      name: "My Audience",
    });

    const { audience } = result as { audience: { persona_weights: Record<string, number> } };
    const expectedWeights = biasForGoalIntent("nurture");
    expect(audience.persona_weights).toEqual(expectedWeights);
  });

  it("bakes 'grow' goal-intent bias correctly", async () => {
    mockScrapeProfile.mockResolvedValue(makeProfile(50_000));
    mockScrapeVideos.mockResolvedValue(makeVideos(THIN_MIN_VIDEOS));

    const result = await calibrateFromScrape({
      handle: "testcreator",
      type: "personal",
      platform: "tiktok",
      goalIntent: "grow",
      name: "My Audience",
    });

    const { audience } = result as { audience: { persona_weights: Record<string, number> } };
    const expectedWeights = biasForGoalIntent("grow");
    expect(audience.persona_weights).toEqual(expectedWeights);
  });

  it("does NOT generate personas on the thin fallback path (zero fabrication)", async () => {
    mockScrapeProfile.mockResolvedValue(makeProfile(0));
    mockScrapeVideos.mockResolvedValue([]);

    const result = await calibrateFromScrape({
      handle: "testcreator",
      type: "personal",
      platform: "tiktok",
      goalIntent: "grow",
      name: "My Audience",
    });

    // The fallback path must NOT return an audience with personas
    if ("audience" in result && result.audience) {
      // If we somehow got an audience, it must have 0 personas
      expect((result.audience as { personas: unknown[] }).personas).toHaveLength(0);
    } else {
      // Expected: fallback path, no audience key
      expect(result).toHaveProperty("fallback");
    }
  });
});

describe("calibrateFromScrape — determinism (Pitfall 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("produces byte-identical repaint for identical input (no Date.now/Math.random)", async () => {
    const profile = makeProfile(50_000);
    const videos = makeVideos(THIN_MIN_VIDEOS);

    mockScrapeProfile.mockResolvedValue(profile);
    mockScrapeVideos.mockResolvedValue(videos);

    const result1 = await calibrateFromScrape({
      handle: "testcreator",
      type: "personal",
      platform: "tiktok",
      goalIntent: "grow",
      name: "My Audience",
    });

    // Reset mocks but return identical data
    vi.clearAllMocks();
    mockScrapeProfile.mockResolvedValue(profile);
    mockScrapeVideos.mockResolvedValue(videos);

    const result2 = await calibrateFromScrape({
      handle: "testcreator",
      type: "personal",
      platform: "tiktok",
      goalIntent: "grow",
      name: "My Audience",
    });

    // Both must succeed
    expect(result1).toHaveProperty("audience");
    expect(result2).toHaveProperty("audience");

    const aud1 = (result1 as { audience: { personas: { repaint: string }[] } }).audience;
    const aud2 = (result2 as { audience: { personas: { repaint: string }[] } }).audience;

    // Every persona repaint string must be identical
    for (let i = 0; i < aud1.personas.length; i++) {
      expect(aud1.personas[i]!.repaint).toBe(aud2.personas[i]!.repaint);
    }
  });
});

describe("deriveAudienceProfile", () => {
  it("returns temperature_mix with cold/warm/hot keys summing to 1.0", () => {
    const profile = makeProfile(50_000);
    const videos = makeVideos(15);

    const result = deriveAudienceProfile(profile, videos);

    expect(result).toHaveProperty("temperature_mix");
    const { cold, warm, hot } = result.temperature_mix;
    expect(cold + warm + hot).toBeCloseTo(1.0, 5);
  });

  it("returns top_dispositions as an array of at most 3 items", () => {
    const result = deriveAudienceProfile(makeProfile(10_000), makeVideos(10));
    expect(Array.isArray(result.top_dispositions)).toBe(true);
    expect(result.top_dispositions.length).toBeLessThanOrEqual(3);
  });

  it("returns follower_tier = null when followerCount is 0", () => {
    const result = deriveAudienceProfile(makeProfile(0), makeVideos(10));
    expect(result.follower_tier).toBeNull();
  });

  it("returns a valid follower_tier string for a real follower count", () => {
    const result = deriveAudienceProfile(makeProfile(50_000), makeVideos(10));
    expect(result.follower_tier).toBe("micro");
  });
});

describe("repaintPersonas", () => {
  it("returns exactly 10 CalibratedPersona entries", () => {
    const profile = makeProfile(50_000);
    const videos = makeVideos(15);
    const weights = biasForGoalIntent("grow");
    const audienceProfile = deriveAudienceProfile(profile, videos);

    const personas = repaintPersonas({ audienceProfile, goalIntent: "grow", weights });
    expect(personas).toHaveLength(10);
  });

  it("each persona has archetype, repaint, temperature, disposition, share", () => {
    const profile = makeProfile(50_000);
    const videos = makeVideos(15);
    const weights = biasForGoalIntent("sell");
    const audienceProfile = deriveAudienceProfile(profile, videos);

    const personas = repaintPersonas({ audienceProfile, goalIntent: "sell", weights });
    for (const p of personas) {
      expect(p).toHaveProperty("archetype");
      expect(p).toHaveProperty("repaint");
      expect(typeof p.repaint).toBe("string");
      expect(p.repaint.length).toBeGreaterThan(0);
      expect(p).toHaveProperty("temperature");
      expect(p).toHaveProperty("disposition");
      expect(p).toHaveProperty("share");
      expect(typeof p.share).toBe("number");
    }
  });

  it("persona shares sum to approximately 1.0", () => {
    const profile = makeProfile(50_000);
    const videos = makeVideos(15);
    const weights = biasForGoalIntent("grow");
    const audienceProfile = deriveAudienceProfile(profile, videos);

    const personas = repaintPersonas({ audienceProfile, goalIntent: "grow", weights });
    const totalShare = personas.reduce((sum, p) => sum + p.share, 0);
    expect(totalShare).toBeCloseTo(1.0, 2);
  });

  it("is deterministic: same input → byte-identical output", () => {
    const audienceProfile = deriveAudienceProfile(makeProfile(50_000), makeVideos(15));
    const weights = biasForGoalIntent("authority");

    const result1 = repaintPersonas({ audienceProfile, goalIntent: "authority", weights });
    const result2 = repaintPersonas({ audienceProfile, goalIntent: "authority", weights });

    for (let i = 0; i < result1.length; i++) {
      expect(result1[i]!.repaint).toBe(result2[i]!.repaint);
    }
  });
});
