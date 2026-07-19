/**
 * The 402 — "you're out of credits" — as a thing the client can actually reason about.
 *
 * Every paid route answers a spent allowance with `402 Payment Required` and this body. The
 * client used to throw away everything but the slug (`throw new Error(err.error)`), so the one
 * moment in the whole product where we have to say something precise and generous — "your $1
 * trial's 50 credits are spent, your Creator allowance starts on the 16th" — came out as the
 * word `credit_quota_exceeded` in an error line. This carries the payload instead.
 *
 * Client-safe: a type and a type-guard, no server imports, no `process.env`.
 */

import type { NumenTier } from "@/lib/whop/config";

/** The machine-readable slug in the 402 body — the one string worth matching on. */
export const CREDIT_QUOTA_EXCEEDED = "credit_quota_exceeded";

/**
 * The pre-credits slug. Nothing outside this repo ever consumed it (enforcement has never
 * been on), but stray client bundles from a mid-deploy session may still send/match it —
 * the type-guard accepts both for one release.
 */
export const LEGACY_READING_QUOTA_EXCEEDED = "reading_quota_exceeded";

export interface CreditQuotaExceeded {
  /** Human copy, written server-side where the tier and window are known. Show THIS. */
  message: string;
  tier: NumenTier;
  /** Credits spent in the window that applies. */
  used: number;
  /** The allowance that was hit. Null only for a fair-use refusal (unlimited tier). */
  limit: number | null;
  /** True = they spent the 50-credit $1-trial pool, NOT their plan's allowance. */
  inTrial: boolean;
  /** Which wall: the period allowance, or the fair-use daily ceiling behind "unlimited". */
  reason: "allowance" | "fair_use";
  /** What the refused action would have cost, in credits. */
  cost: number;
}

/** Is this 402 body the quota wall (and not some other payment error)? */
export function isCreditQuotaExceeded(body: unknown): body is CreditQuotaExceeded {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  const slugMatches =
    b.error === CREDIT_QUOTA_EXCEEDED || b.error === LEGACY_READING_QUOTA_EXCEEDED;
  return slugMatches && typeof b.message === "string";
}
