/**
 * Phase 7 Plan 03 — calibration.ts + persona-repaint.ts (TDD GREEN phase).
 *
 * Tests:
 *  1. thin-data → general fallback (no CalibratedPersona fabricated)
 *  2. scrape throw → scrape_failed (distinct from thin fallback)
 *  3. success path → personas.length === 10 + persona_weights === biasForGoalIntent(goalIntent)
 *  4. determinism: same input → byte-identical repaint output (Pitfall 2)
 *  5. thin gate is on getFollowerTier(null) AND videos < THIN_MIN_VIDEOS (both required)
 *
 * Provider injected via the optional _provider parameter — avoids module-mock constructor issues.
 */

import { describe, it, expect, vi } from "vitest";
import type { ProfileData, VideoData } from "@/lib/scraping/types";

// ─── Imports ──────────────────────────────────────────────────────────────────

import {
  calibrateFromScrape,
  deriveAudienceProfile,
  THIN_MIN_VIDEOS,
} from "../calibration";
import { repaintPersonas } from "../persona-repaint";
import { biasForGoalIntent } from "../goal-intent";

// ─── Mock provider factory ────────────────────────────────────────────────────

function makeMockProvider(
  profileFn: () => Promise<ProfileData>,
  videosFn: () => Promise<VideoData[]>,
) {
  return {
    scrapeProfile: vi.fn(profileFn),
    scrapeVideos: vi.fn(videosFn),
  };
}

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
  it("should be a positive integer", () => {
    expect(typeof THIN_MIN_VIDEOS).toBe("number");
    expect(THIN_MIN_VIDEOS).toBeGreaterThan(0);
    expect(Number.isInteger(THIN_MIN_VIDEOS)).toBe(true);
  });
});

describe("calibrateFromScrape — thin-data fallback (honesty spine D-06)", () => {
  it("returns { fallback: 'general', reason: 'thin' } when followerCount is 0 AND videos < THIN_MIN_VIDEOS", async () => {
    const provider = makeMockProvider(
      () => Promise.resolve(makeProfile(0)),
      () => Promise.resolve(makeVideos(THIN_MIN_VIDEOS - 1)),
    );

    const result = await calibrateFromScrape(
      { handle: "testcreator", type: "personal", platform: "tiktok", goalIntent: "grow", name: "My Audience" },
      provider,
    );

    expect(result).toHaveProperty("fallback", "general");
    expect(result).toHaveProperty("reason", "thin");
    // Honesty spine: NEVER fabricate CalibratedPersona on the fallback path
    expect(result).not.toHaveProperty("audience");
  });

  it("returns { fallback: 'general', reason: 'thin' } when followerCount is null AND videos is empty", async () => {
    const provider = makeMockProvider(
      () => Promise.resolve({ ...makeProfile(0), followerCount: null as unknown as number }),
      () => Promise.resolve([]),
    );

    const result = await calibrateFromScrape(
      { handle: "testcreator", type: "personal", platform: "tiktok", goalIntent: "grow", name: "My Audience" },
      provider,
    );

    expect(result).toHaveProperty("fallback", "general");
    expect(result).not.toHaveProperty("audience");
  });

  it("does NOT fall back to thin when followerCount > 0 (tier resolves) AND videos >= THIN_MIN_VIDEOS", async () => {
    const provider = makeMockProvider(
      () => Promise.resolve(makeProfile(50_000)),
      () => Promise.resolve(makeVideos(THIN_MIN_VIDEOS)),
    );

    const result = await calibrateFromScrape(
      { handle: "testcreator", type: "personal", platform: "tiktok", goalIntent: "grow", name: "My Audience" },
      provider,
    );

    // Should be success path, not fallback
    expect(result).not.toHaveProperty("fallback");
    expect(result).toHaveProperty("audience");
  });

  it("does NOT fall back to thin when followerCount > 0 even if videos < THIN_MIN_VIDEOS", async () => {
    // Both conditions must be true; having a follower count means tier !== null
    const provider = makeMockProvider(
      () => Promise.resolve(makeProfile(50_000)),
      () => Promise.resolve(makeVideos(THIN_MIN_VIDEOS - 1)), // below threshold
    );

    const result = await calibrateFromScrape(
      { handle: "testcreator", type: "personal", platform: "tiktok", goalIntent: "grow", name: "My Audience" },
      provider,
    );

    // followerCount > 0 → tier !== null → thin gate does NOT fire
    expect(result).not.toHaveProperty("fallback");
    expect(result).toHaveProperty("audience");
  });
});

describe("calibrateFromScrape — scrape_failed (distinct from thin)", () => {
  it("returns { error: 'scrape_failed' } when scrapeProfile throws", async () => {
    const provider = makeMockProvider(
      () => Promise.reject(new Error("Network timeout")),
      () => Promise.resolve(makeVideos(20)),
    );

    const result = await calibrateFromScrape(
      { handle: "testcreator", type: "personal", platform: "tiktok", goalIntent: "grow", name: "My Audience" },
      provider,
    );

    expect(result).toHaveProperty("error", "scrape_failed");
    expect(result).not.toHaveProperty("fallback");
    expect(result).not.toHaveProperty("audience");
  });

  it("returns { error: 'scrape_failed' } when scrapeVideos throws", async () => {
    const provider = makeMockProvider(
      () => Promise.resolve(makeProfile(50_000)),
      () => Promise.reject(new Error("Actor failed")),
    );

    const result = await calibrateFromScrape(
      { handle: "testcreator", type: "personal", platform: "tiktok", goalIntent: "grow", name: "My Audience" },
      provider,
    );

    expect(result).toHaveProperty("error", "scrape_failed");
    expect(result).not.toHaveProperty("fallback");
  });
});

describe("calibrateFromScrape — success path", () => {
  it("returns { audience } with exactly 10 CalibratedPersona entries", async () => {
    const provider = makeMockProvider(
      () => Promise.resolve(makeProfile(50_000)),
      () => Promise.resolve(makeVideos(THIN_MIN_VIDEOS)),
    );

    const result = await calibrateFromScrape(
      { handle: "testcreator", type: "personal", platform: "tiktok", goalIntent: "grow", name: "My Audience" },
      provider,
    );

    expect(result).toHaveProperty("audience");
    const { audience } = result as { audience: { personas: unknown[] } };
    expect(audience.personas).toHaveLength(10);
  });

  it("bakes goal-intent bias into persona_weights once (nurture intent)", async () => {
    const provider = makeMockProvider(
      () => Promise.resolve(makeProfile(50_000)),
      () => Promise.resolve(makeVideos(THIN_MIN_VIDEOS)),
    );

    const result = await calibrateFromScrape(
      { handle: "testcreator", type: "personal", platform: "tiktok", goalIntent: "nurture", name: "My Audience" },
      provider,
    );

    const { audience } = result as unknown as { audience: { persona_weights: Record<string, number> } };
    const expectedWeights = biasForGoalIntent("nurture");
    expect(audience.persona_weights).toEqual(expectedWeights);
  });

  it("bakes 'grow' goal-intent bias correctly", async () => {
    const provider = makeMockProvider(
      () => Promise.resolve(makeProfile(50_000)),
      () => Promise.resolve(makeVideos(THIN_MIN_VIDEOS)),
    );

    const result = await calibrateFromScrape(
      { handle: "testcreator", type: "personal", platform: "tiktok", goalIntent: "grow", name: "My Audience" },
      provider,
    );

    const { audience } = result as unknown as { audience: { persona_weights: Record<string, number> } };
    const expectedWeights = biasForGoalIntent("grow");
    expect(audience.persona_weights).toEqual(expectedWeights);
  });

  it("does NOT generate personas on the thin fallback path (zero fabrication)", async () => {
    const provider = makeMockProvider(
      () => Promise.resolve(makeProfile(0)),
      () => Promise.resolve([]),
    );

    const result = await calibrateFromScrape(
      { handle: "testcreator", type: "personal", platform: "tiktok", goalIntent: "grow", name: "My Audience" },
      provider,
    );

    // Expected: fallback path, no audience key
    expect(result).toHaveProperty("fallback");
    expect(result).not.toHaveProperty("audience");
  });
});

describe("calibrateFromScrape — determinism (Pitfall 2)", () => {
  it("produces byte-identical repaint for identical input (no Date.now/Math.random)", async () => {
    const profile = makeProfile(50_000);
    const videos = makeVideos(THIN_MIN_VIDEOS);

    const provider1 = makeMockProvider(
      () => Promise.resolve(profile),
      () => Promise.resolve(videos),
    );
    const result1 = await calibrateFromScrape(
      { handle: "testcreator", type: "personal", platform: "tiktok", goalIntent: "grow", name: "My Audience" },
      provider1,
    );

    const provider2 = makeMockProvider(
      () => Promise.resolve(profile),
      () => Promise.resolve(videos),
    );
    const result2 = await calibrateFromScrape(
      { handle: "testcreator", type: "personal", platform: "tiktok", goalIntent: "grow", name: "My Audience" },
      provider2,
    );

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
    const result = deriveAudienceProfile(makeProfile(50_000), makeVideos(15));
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
    const audienceProfile = deriveAudienceProfile(makeProfile(50_000), makeVideos(15));
    const weights = biasForGoalIntent("grow");

    const personas = repaintPersonas({ audienceProfile, goalIntent: "grow", weights });
    expect(personas).toHaveLength(10);
  });

  it("each persona has archetype, repaint, temperature, disposition, share", () => {
    const audienceProfile = deriveAudienceProfile(makeProfile(50_000), makeVideos(15));
    const weights = biasForGoalIntent("sell");

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
    const audienceProfile = deriveAudienceProfile(makeProfile(50_000), makeVideos(15));
    const weights = biasForGoalIntent("grow");

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
