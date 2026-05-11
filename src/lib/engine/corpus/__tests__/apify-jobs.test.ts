import { describe, expect, it } from "vitest";
import {
  buildApifyJobs,
  listNicheHashtags,
  NICHES,
  type Niche,
} from "../apify-jobs";

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseISODate(s: string): Date {
  // Treat as UTC midnight to avoid TZ skew
  return new Date(`${s}T00:00:00.000Z`);
}

describe("buildApifyJobs", () => {
  it("returns the three named scrape configs for a niche", () => {
    const jobs = buildApifyJobs("beauty", true);
    expect(Object.keys(jobs).sort()).toEqual(
      ["average", "trending", "under"].sort()
    );
  });

  it("uses clockworks actor and expectedItems > 0 for every config", () => {
    const jobs = buildApifyJobs("beauty", true);
    for (const cfg of Object.values(jobs)) {
      expect(cfg.actorId).toBe("clockworks/tiktok-scraper");
      expect(cfg.expectedItems).toBeGreaterThan(0);
      expect(cfg.input).toBeTypeOf("object");
      expect(cfg.input["excludePinnedPosts"]).toBe(true);
    }
  });

  it("sets newestPostDate to YYYY-MM-DD format", () => {
    const jobs = buildApifyJobs("fitness", false);
    for (const cfg of Object.values(jobs)) {
      const newest = cfg.input["newestPostDate"];
      expect(typeof newest).toBe("string");
      expect(newest as string).toMatch(DATE_RE);
    }
  });

  it("newestPostDate is approximately 7 days before today (Pitfall 1 / D-04)", () => {
    const jobs = buildApifyJobs("beauty", true);
    const expectedMs = Date.now() - 7 * DAY_MS;
    for (const cfg of Object.values(jobs)) {
      const got = parseISODate(cfg.input["newestPostDate"] as string).getTime();
      // ± 2 days tolerance for TZ/DST boundary safety in CI
      expect(Math.abs(got - expectedMs)).toBeLessThanOrEqual(2 * DAY_MS);
    }
  });

  it("oldestPostDate is older than newestPostDate", () => {
    const jobs = buildApifyJobs("comedy", true);
    for (const cfg of Object.values(jobs)) {
      const oldest = parseISODate(cfg.input["oldestPostDate"] as string).getTime();
      const newest = parseISODate(cfg.input["newestPostDate"] as string).getTime();
      expect(oldest).toBeLessThan(newest);
    }
  });

  it("oldestPostDate is approximately 90 days before today", () => {
    const jobs = buildApifyJobs("edu", false);
    const expectedMs = Date.now() - 90 * DAY_MS;
    for (const cfg of Object.values(jobs)) {
      const got = parseISODate(cfg.input["oldestPostDate"] as string).getTime();
      expect(Math.abs(got - expectedMs)).toBeLessThanOrEqual(2 * DAY_MS);
    }
  });

  it("trending uses high-traffic hashtags including 'fyp'", () => {
    const jobs = buildApifyJobs("beauty", true);
    const trendingTags = jobs.trending.input["hashtags"] as string[];
    expect(Array.isArray(trendingTags)).toBe(true);
    expect(trendingTags.length).toBeGreaterThan(0);
    expect(trendingTags).toContain("fyp");
  });

  it("average and under use niche-specific hashtags", () => {
    const jobs = buildApifyJobs("fitness", true);
    const avgTags = jobs.average.input["hashtags"] as string[];
    const underTags = jobs.under.input["hashtags"] as string[];
    expect(avgTags).toEqual(underTags);
    expect(avgTags).toContain("fitness");
    // Fitness niche-specific tag set should not be the trending FYP set
    expect(avgTags).not.toContain("fyp");
  });

  it("full (isPilot=false) produces exactly 5x larger resultsPerPage than pilot", () => {
    const pilot = buildApifyJobs("beauty", true);
    const full = buildApifyJobs("beauty", false);
    for (const kind of ["trending", "average", "under"] as const) {
      const pilotRpp = pilot[kind].input["resultsPerPage"] as number;
      const fullRpp = full[kind].input["resultsPerPage"] as number;
      expect(fullRpp).toBe(pilotRpp * 5);
    }
  });

  it("all 5 niches produce non-empty hashtag lists for trending and average", () => {
    const niches: Niche[] = ["beauty", "fitness", "edu", "comedy", "lifestyle"];
    for (const n of niches) {
      const jobs = buildApifyJobs(n, true);
      expect((jobs.trending.input["hashtags"] as string[]).length).toBeGreaterThan(
        0
      );
      expect((jobs.average.input["hashtags"] as string[]).length).toBeGreaterThan(
        0
      );
      expect((jobs.under.input["hashtags"] as string[]).length).toBeGreaterThan(0);
    }
  });

  it("NICHES const matches the locked 5-niche set (D-03)", () => {
    expect([...NICHES].sort()).toEqual(
      ["beauty", "comedy", "edu", "fitness", "lifestyle"].sort()
    );
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
