/**
 * discover-cache.ts — Phase 08, Plan 02, Task 3 (D-16 / Open Q2 / Open Q3).
 *
 * In-memory Discover cache + per-user daily cap.
 *
 * Open Q2 DECISION: in-memory is acceptable for v1 (single-instance). There is NO
 * Supabase table, NO migration — the conditional schema-push requirement does NOT
 * apply to this phase. (A serverless multi-instance deploy would not share this Map;
 * that is an accepted v1 trade — the cache is a re-scrape saver, not a correctness gate.)
 *
 * Cache key = `${normalizedInput}|${mode}|${YYYY-MM-DD}` (Pitfall 6): mode is part of the
 * key so a string valid as BOTH a handle and a niche cannot collide across modes, and the
 * day component naturally expires entries (a new day = a fresh pull).
 *
 * The cache stores already-ranked tiles (the route caches the response payload), so a
 * second identical pull within the same day returns instantly without re-scraping.
 */

/** A cached ranked tile is whatever shape the route stores (structurally opaque here). */
export type DiscoverTile = object;

interface CacheEntry<T> {
  day: string; // YYYY-MM-DD — entries from a prior day are treated as a miss
  tiles: T[];
}

/** Per-user daily pull cap (Open Q3). A low-double-digit keeps Apify spend bounded. */
export const DISCOVER_DAILY_CAP = 20;

// Module-level state (single-instance, in-memory — Open Q2). Not exported.
const cacheStore = new Map<string, CacheEntry<DiscoverTile>>();
const userPullCounts = new Map<string, { day: string; count: number }>();

/** UTC day stamp (YYYY-MM-DD). Injectable clock for deterministic tests. */
export function dayStamp(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** Build the mode-aware cache key (Pitfall 6). */
export function discoverCacheKey(
  normalizedInput: string,
  mode: "profile" | "niche",
  now: number = Date.now(),
): string {
  return `${normalizedInput}|${mode}|${dayStamp(now)}`;
}

/**
 * Return cached ranked tiles for (normalizedInput, mode, today), or null on a miss.
 * An entry whose stored day != today is a miss (and is evicted).
 */
export function getCachedDiscover<T extends DiscoverTile = DiscoverTile>(
  normalizedInput: string,
  mode: "profile" | "niche",
  now: number = Date.now(),
): T[] | null {
  const key = discoverCacheKey(normalizedInput, mode, now);
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (entry.day !== dayStamp(now)) {
    cacheStore.delete(key);
    return null;
  }
  return entry.tiles as T[];
}

/** Store ranked tiles for (normalizedInput, mode, today). */
export function setCachedDiscover<T extends DiscoverTile = DiscoverTile>(
  normalizedInput: string,
  mode: "profile" | "niche",
  tiles: T[],
  now: number = Date.now(),
): void {
  const key = discoverCacheKey(normalizedInput, mode, now);
  cacheStore.set(key, { day: dayStamp(now), tiles: tiles as DiscoverTile[] });
}

export interface CapResult {
  /** true when the user is UNDER the daily cap and may pull. */
  allowed: boolean;
  /** pulls used today (after a would-be increment is NOT applied — read-only check). */
  used: number;
  /** the configured cap (DISCOVER_DAILY_CAP). */
  limit: number;
}

/**
 * Read-only check of whether `userId` is under the daily cap. Does NOT increment.
 * Call recordUserPull() AFTER a successful (cache-miss) scrape to consume a pull.
 */
export function checkUserCap(userId: string, now: number = Date.now()): CapResult {
  const today = dayStamp(now);
  const rec = userPullCounts.get(userId);
  const used = rec && rec.day === today ? rec.count : 0;
  return { allowed: used < DISCOVER_DAILY_CAP, used, limit: DISCOVER_DAILY_CAP };
}

/** Consume one pull for `userId` (call only on a real cache-miss scrape). */
export function recordUserPull(userId: string, now: number = Date.now()): void {
  const today = dayStamp(now);
  const rec = userPullCounts.get(userId);
  if (rec && rec.day === today) {
    rec.count += 1;
  } else {
    userPullCounts.set(userId, { day: today, count: 1 });
  }
}

/** Test-only reset of all in-memory state. */
export function __resetDiscoverCacheForTest(): void {
  cacheStore.clear();
  userPullCounts.clear();
}
