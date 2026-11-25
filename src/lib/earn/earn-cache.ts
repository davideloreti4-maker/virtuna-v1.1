/**
 * earn-cache.ts — what Earn keeps in the server's memory per creator (rulings 16, 20 and 34): for five
 * minutes the checked count of creators who joined and what Whop says a creator has earned; for one minute
 * the fact that the earned number could not be read. SERVER ONLY. The server's cache helper
 * (`src/lib/cache.ts`): per instance, gone on a cold start, which only means one more read. Only a number
 * that was read in full is kept as a number; a failed read is never kept as one, only as "unreadable", and
 * only briefly, so that a Whop that does not answer is not asked again on every request.
 */
import { createCache } from "@/lib/cache";

export const EARN_CACHE_MS = 5 * 60_000;
/** Ruling 34: how long an earned number that could not be read is not asked for again. */
export const EARNED_UNREADABLE_MS = 60_000;

/** The creator's joined count, by their id. */
export const joinedCache = createCache<number>(EARN_CACHE_MS);
/** What the creator earned, in whole cents, by their id and their affiliate's (a new affiliate is a new key). */
export const earnedCache = createCache<number>(EARN_CACHE_MS);
/** The same keys, for an earned number that could not be read just now. */
export const earnedUnreadable = createCache<true>(EARNED_UNREADABLE_MS);

export const earnedKey = (userId: string, affiliateId: string): string => `${userId}:${affiliateId}`;

/** Tests only: a fresh start. */
export function clearEarnCaches(): void {
  joinedCache.clear();
  earnedCache.clear();
  earnedUnreadable.clear();
}
