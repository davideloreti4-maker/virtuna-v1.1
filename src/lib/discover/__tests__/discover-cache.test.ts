/**
 * discover-cache.test.ts — Phase 08, Plan 02, Task 3 (D-16 / Pitfall 6 / Open Q3).
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  getCachedDiscover,
  setCachedDiscover,
  checkUserCap,
  recordUserPull,
  discoverCacheKey,
  dayStamp,
  DISCOVER_DAILY_CAP,
  __resetDiscoverCacheForTest,
} from "../discover-cache";

const NOW = new Date("2026-06-19T12:00:00.000Z").getTime();
const NEXT_DAY = new Date("2026-06-20T12:00:00.000Z").getTime();

beforeEach(() => __resetDiscoverCacheForTest());

describe("discoverCacheKey (Pitfall 6)", () => {
  it("includes normalizedInput, mode, and a YYYY-MM-DD day component", () => {
    const key = discoverCacheKey("creator", "profile", NOW);
    expect(key).toContain("creator");
    expect(key).toContain("profile");
    expect(key).toContain(dayStamp(NOW));
    expect(dayStamp(NOW)).toBe("2026-06-19");
  });

  it("the SAME string in profile vs niche mode does not collide", () => {
    expect(discoverCacheKey("cooking", "profile", NOW)).not.toBe(
      discoverCacheKey("cooking", "niche", NOW),
    );
  });
});

describe("get/setCachedDiscover", () => {
  it("a second identical pull within the same day is a cache HIT (no re-scrape)", () => {
    expect(getCachedDiscover("creator", "profile", NOW)).toBeNull();
    setCachedDiscover("creator", "profile", [{ id: "a" }], NOW);
    expect(getCachedDiscover("creator", "profile", NOW)).toEqual([{ id: "a" }]);
  });

  it("an entry from a prior day is a MISS (day component expires it)", () => {
    setCachedDiscover("creator", "profile", [{ id: "a" }], NOW);
    expect(getCachedDiscover("creator", "profile", NEXT_DAY)).toBeNull();
  });

  it("mode-scoped: a niche entry does not satisfy a profile lookup", () => {
    setCachedDiscover("cooking", "niche", [{ id: "n" }], NOW);
    expect(getCachedDiscover("cooking", "profile", NOW)).toBeNull();
  });
});

describe("checkUserCap / recordUserPull (Open Q3)", () => {
  it("allows pulls under the cap and reports usage", () => {
    const c0 = checkUserCap("user-1", NOW);
    expect(c0.allowed).toBe(true);
    expect(c0.used).toBe(0);
    expect(c0.limit).toBe(DISCOVER_DAILY_CAP);
  });

  it("blocks once the daily cap is consumed (friendly cap, not a throw)", () => {
    for (let i = 0; i < DISCOVER_DAILY_CAP; i++) recordUserPull("user-1", NOW);
    const c = checkUserCap("user-1", NOW);
    expect(c.allowed).toBe(false);
    expect(c.used).toBe(DISCOVER_DAILY_CAP);
  });

  it("resets the count on a new day", () => {
    for (let i = 0; i < DISCOVER_DAILY_CAP; i++) recordUserPull("user-1", NOW);
    expect(checkUserCap("user-1", NOW).allowed).toBe(false);
    expect(checkUserCap("user-1", NEXT_DAY).allowed).toBe(true);
    expect(checkUserCap("user-1", NEXT_DAY).used).toBe(0);
  });

  it("caps are per-user (one user hitting the cap does not block another)", () => {
    for (let i = 0; i < DISCOVER_DAILY_CAP; i++) recordUserPull("user-1", NOW);
    expect(checkUserCap("user-1", NOW).allowed).toBe(false);
    expect(checkUserCap("user-2", NOW).allowed).toBe(true);
  });
});
