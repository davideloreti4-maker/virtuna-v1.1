import { describe, expect, it } from "vitest";
import {
  buildApifyJobs,
  listNicheHashtags,
  NICHES,
  type Niche,
} from "../apify-jobs";

const TIKTOK_TAG_PREFIX = "https://www.tiktok.com/tag/";

describe("buildApifyJobs", () => {
  it("returns the three named scrape configs for a niche", () => {
    const jobs = buildApifyJobs("beauty", true);
    expect(Object.keys(jobs).sort()).toEqual(
      ["average", "trending", "under"].sort()
    );
  });

  it("uses apidojo actor ID for every config", () => {
    const jobs = buildApifyJobs("beauty", true);
    for (const cfg of Object.values(jobs)) {
      expect(cfg.actorId).toBe("apidojo/tiktok-scraper");
    }
  });

  it("every config has startUrls as an array of TikTok tag URLs", () => {
    const jobs = buildApifyJobs("beauty", true);
    for (const cfg of Object.values(jobs)) {
      const urls = cfg.input["startUrls"] as string[];
      expect(Array.isArray(urls)).toBe(true);
      expect(urls.length).toBeGreaterThan(0);
      for (const url of urls) {
        expect(url).toMatch(/^https:\/\/www\.tiktok\.com\/tag\//);
      }
    }
  });

  it("every config has a positive integer maxItems", () => {
    const jobs = buildApifyJobs("fitness", true);
    for (const cfg of Object.values(jobs)) {
      const maxItems = cfg.input["maxItems"];
      expect(typeof maxItems).toBe("number");
      expect(maxItems as number).toBeGreaterThan(0);
      expect(Number.isInteger(maxItems as number)).toBe(true);
    }
  });

  it("every config has location='US'", () => {
    const jobs = buildApifyJobs("edu", false);
    for (const cfg of Object.values(jobs)) {
      expect(cfg.input["location"]).toBe("US");
    }
  });

  it("every config has expectedItems > 0", () => {
    const jobs = buildApifyJobs("comedy", true);
    for (const cfg of Object.values(jobs)) {
      expect(cfg.expectedItems).toBeGreaterThan(0);
    }
  });

  it("no config has clockworks-only fields (hashtags, resultsPerPage, newestPostDate, oldestPostDate, excludePinnedPosts)", () => {
    const jobs = buildApifyJobs("lifestyle", false);
    for (const cfg of Object.values(jobs)) {
      expect(cfg.input).not.toHaveProperty("hashtags");
      expect(cfg.input).not.toHaveProperty("resultsPerPage");
      expect(cfg.input).not.toHaveProperty("newestPostDate");
      expect(cfg.input).not.toHaveProperty("oldestPostDate");
      expect(cfg.input).not.toHaveProperty("excludePinnedPosts");
    }
  });

  it("trending uses TRENDING_FEED_HASHTAGS (includes 'fyp' URL)", () => {
    const jobs = buildApifyJobs("beauty", true);
    const trendingUrls = jobs.trending.input["startUrls"] as string[];
    const hasFyp = trendingUrls.some((u) => u.endsWith("/fyp"));
    expect(hasFyp).toBe(true);
  });

  it("average and under use NICHE_HASHTAGS (same hashtag set per niche)", () => {
    const jobs = buildApifyJobs("fitness", true);
    const avgUrls = jobs.average.input["startUrls"] as string[];
    const underUrls = jobs.under.input["startUrls"] as string[];
    expect(avgUrls).toEqual(underUrls);
    // Fitness niche-specific hashtags should include "fitness" URL
    const hasFitness = avgUrls.some((u) => u.endsWith("/fitness"));
    expect(hasFitness).toBe(true);
    // fitness niche has 4 hashtags so it's fine if fyp isn't in niche set at all
    // (comedy is the only niche with fyp in NICHE_HASHTAGS)
    expect(avgUrls.length).toBeGreaterThan(0);
  });

  it("startUrls length matches the hashtag list length per niche", () => {
    // Trending: TRENDING_FEED_HASHTAGS has 2 per niche
    // Average/under: NICHE_HASHTAGS has 4 per niche
    const beautyJobs = buildApifyJobs("beauty", true);
    expect((beautyJobs.trending.input["startUrls"] as string[]).length).toBe(2);
    expect((beautyJobs.average.input["startUrls"] as string[]).length).toBe(4);
    expect((beautyJobs.under.input["startUrls"] as string[]).length).toBe(4);

    const fitnessJobs = buildApifyJobs("fitness", true);
    expect((fitnessJobs.trending.input["startUrls"] as string[]).length).toBe(2);
    expect((fitnessJobs.average.input["startUrls"] as string[]).length).toBe(4);
  });

  it("each startUrl is well-formed (https://www.tiktok.com/tag/<hashtag>)", () => {
    for (const niche of NICHES) {
      const jobs = buildApifyJobs(niche, true);
      for (const cfg of Object.values(jobs)) {
        for (const url of cfg.input["startUrls"] as string[]) {
          expect(url).toMatch(/^https:\/\/www\.tiktok\.com\/tag\/[a-zA-Z0-9]+$/);
        }
      }
    }
  });

  it("full mode (isPilot=false) produces larger maxItems than pilot", () => {
    const pilot = buildApifyJobs("beauty", true);
    const full = buildApifyJobs("beauty", false);
    for (const kind of ["trending", "average", "under"] as const) {
      const pilotMax = pilot[kind].input["maxItems"] as number;
      const fullMax = full[kind].input["maxItems"] as number;
      expect(fullMax).toBeGreaterThan(pilotMax);
    }
  });

  it("full mode maxItems are trending=800, average=1200, under=3000", () => {
    const full = buildApifyJobs("beauty", false);
    expect(full.trending.input["maxItems"]).toBe(800);
    expect(full.average.input["maxItems"]).toBe(1200);
    expect(full.under.input["maxItems"]).toBe(3000);
  });

  it("pilot mode maxItems are trending=80, average=120, under=300", () => {
    const pilot = buildApifyJobs("fitness", true);
    expect(pilot.trending.input["maxItems"]).toBe(80);
    expect(pilot.average.input["maxItems"]).toBe(120);
    expect(pilot.under.input["maxItems"]).toBe(300);
  });

  it("all 5 niches produce non-empty startUrls for trending and average", () => {
    const niches: Niche[] = ["beauty", "fitness", "edu", "comedy", "lifestyle"];
    for (const n of niches) {
      const jobs = buildApifyJobs(n, true);
      expect((jobs.trending.input["startUrls"] as string[]).length).toBeGreaterThan(0);
      expect((jobs.average.input["startUrls"] as string[]).length).toBeGreaterThan(0);
      expect((jobs.under.input["startUrls"] as string[]).length).toBeGreaterThan(0);
    }
  });

  it("NICHES const matches the locked 5-niche set (D-03)", () => {
    expect([...NICHES].sort()).toEqual(
      ["beauty", "comedy", "edu", "fitness", "lifestyle"].sort()
    );
  });

  it("startUrls use TIKTOK_TAG_PREFIX for all hashtags", () => {
    for (const niche of NICHES) {
      const jobs = buildApifyJobs(niche, false);
      for (const cfg of Object.values(jobs)) {
        for (const url of cfg.input["startUrls"] as string[]) {
          expect(url.startsWith(TIKTOK_TAG_PREFIX)).toBe(true);
        }
      }
    }
  });
});

describe("listNicheHashtags", () => {
  it("returns a defensive copy (mutating result doesn't change internal state)", () => {
    const first = listNicheHashtags("beauty");
    first.push("malicious");
    const second = listNicheHashtags("beauty");
    expect(second).not.toContain("malicious");
  });

  it("returns non-empty arrays for every niche", () => {
    const niches: Niche[] = ["beauty", "fitness", "edu", "comedy", "lifestyle"];
    for (const n of niches) {
      const tags = listNicheHashtags(n);
      expect(tags.length).toBeGreaterThan(0);
    }
  });
});
