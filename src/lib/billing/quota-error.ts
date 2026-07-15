/**
 * The 402 — "you're out of Readings" — as a thing the client can actually reason about.
 *
 * POST /api/analyze answers a spent allowance with `402 Payment Required` and this body. The
 * client used to throw away everything but the slug (`throw new Error(err.error)`), so the one
 * moment in the whole product where we have to say something precise and generous — "your $1
 * trial's 5 Readings are spent, your Creator allowance starts on the 16th" — came out as the
 * word `reading_quota_exceeded` in an error line. This carries the payload instead.
 *
 * Client-safe: a type and a type-guard, no server imports, no `process.env`.
 */

import type { NumenTier } from "@/lib/whop/config";

/** The machine-readable slug in the 402 body — the one string worth matching on. */
export const READING_QUOTA_EXCEEDED = "reading_quota_exceeded";

export interface ReadingQuotaExceeded {
  /** Human copy, written server-side where the tier and window are known. Show THIS. */
  message: string;
  tier: NumenTier;
  used: number;
  /** The allowance that was hit. Never null here — unlimited cannot be exceeded. */
  limit: number | null;
  /** True = they spent the 5-Reading $1-trial pool, NOT their plan's allowance. */
  inTrial: boolean;
}

/** Is this 402 body the quota wall (and not some other payment error)? */
export function isReadingQuotaExceeded(body: unknown): body is ReadingQuotaExceeded {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return b.error === READING_QUOTA_EXCEEDED && typeof b.message === "string";
}
