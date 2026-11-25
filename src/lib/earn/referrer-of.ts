/**
 * referrer-of.ts — whose Whop username a buyer's checkout carries as `affiliate_code` (plan
 * 2026-11-24-earn, step B; rulings 29, 30, 31, 35 and 38). SERVER ONLY. It runs with any look: a sale is a
 * sale whatever the app shows.
 *
 * Decided at the checkout request, from what the server itself knows. Every one of these must hold:
 *   1. Whop is configured here (ruling 38): without it nobody can be enrolled, and nothing is read.
 *   2. The request's cookie `virtuna_referral` holds a code of the generator's form (`isReferralCode`).
 *   3. The buyer's account was created after the link was opened (ruling 30): at or after the time in the
 *      cookie `virtuna_referral_at`, with `OPENING_TOLERANCE_MS` for two clocks. A time that cannot be a
 *      real opening (absent: a link opened before the cookie existed; not an ISO time; in the future; older
 *      than the cookie can live) counts as none, and then the account must be at most 24 hours old.
 *   4. The buyer has no subscription history at all (ruling 35): the row the route's trial check reads, read
 *      once by the route and passed in. A row that could not be read says nothing: no code.
 *   5. The code's owner, read with the service client because the code belongs to another account, is
 *      not the buyer and is enrolled: a stored Whop username and affiliate id of their forms.
 *
 * `referral_clicks` is never read here: that table is only the count of creators who joined. The cookies
 * name a code and a time, nothing more; everything that decides is read by the server.
 *
 * `checkoutReferrer` wraps the rule so that it never throws and never waits longer than
 * `REFERRER_LOOKUP_MS`: any failure means nobody, and the checkout goes out exactly as it did before this
 * part. `recordAttributed` writes the attributed buyer's `referral_clicks` row afterwards (ruling 31).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { hasUsedTrial } from "@/lib/billing/trial-eligibility";
import { isReferralCode } from "@/lib/referral/code-generator";
import { REFERRAL_COOKIE_MAX_AGE, REFERRAL_COOKIE_NAME } from "@/lib/referral/constants";
import { REFERRAL_AT_COOKIE_NAME, cookieOf } from "@/lib/referral/cookies";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/types/database.types";

import { countsAsJoined, enrolledAs } from "./earn";
import { REFERRAL_ROW_MS, writeReferralRow } from "./referral-row";
import { LATE, within } from "./time-limit";

/** The longest the checkout waits for the lookup. */
export const REFERRER_LOOKUP_MS = 1_000;
/** Ruling 30: how far the account's creation may lie before the link's opening (two clocks). */
export const OPENING_TOLERANCE_MS = 10 * 60_000;

export interface Buyer {
  id: string;
  /** `auth.users.created_at`, as the session's user carries it. */
  created_at?: string | null;
}

/** The buyer's `user_subscriptions` row as the route read it (`select("*")`), with the read's error. */
export interface SubscriptionRead {
  data: Record<string, unknown> | null;
  error: unknown;
}

export interface ReferrerInput {
  /** Whop's settings are there (`whopSettings() !== null`). */
  configured: boolean;
  /** From the session. */
  buyer: Buyer;
  /** The request's `Cookie` header. */
  cookies: string | null | undefined;
  /** The route's one read of the buyer's subscription row (the trial check's; never a second one). */
  subscription: () => PromiseLike<SubscriptionRead>;
  makeAdmin?: () => SupabaseClient<Database>;
  /** The clock, in milliseconds. */
  now?: number;
}

export interface Referrer {
  /** The owner's stored Whop username: the checkout's `affiliate_code`. */
  affiliateCode: string;
  /** For the referral row: the code, its owner, and when the link was opened (now, when that is not known). */
  code: string;
  referrerId: string;
  clickedAt: string;
}

/** The time `Date.prototype.toISOString` writes, which is what the middleware puts in the cookie. */
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * When the link was opened, if the cookie's text can be a real opening: an ISO time, not in the future and
 * not older than the cookie's own life (each with the tolerance). Null otherwise.
 */
function openingOf(text: string | undefined, now: number): number | null {
  if (!text || !ISO_TIME.test(text)) return null;
  const opened = Date.parse(text);
  if (!Number.isFinite(opened)) return null;
  const oldest = now - REFERRAL_COOKIE_MAX_AGE * 1000 - OPENING_TOLERANCE_MS;
  return opened >= oldest && opened <= now + OPENING_TOLERANCE_MS ? opened : null;
}

/**
 * Ruling 35: true when the account has ever had a membership or used a trial. Told from the row alone, and
 * widely: any Whop id, any mark of a trial, a plan other than free, a status other than the row's default.
 */
export function hasSubscriptionHistory(row: Record<string, unknown> | null | undefined): boolean {
  if (!row) return false;
  if (hasUsedTrial(row) || row.is_trial || row.trial_ends_at) return true;
  if (row.whop_membership_id || row.whop_user_id || row.whop_product_id) return true;
  if (typeof row.virtuna_tier === "string" && row.virtuna_tier !== "free") return true;
  return typeof row.status === "string" && row.status !== "active";
}

/** Who referred the buyer of this checkout, or null. Throws on a read that failed. */
export async function referrerOf(input: ReferrerInput): Promise<Referrer | null> {
  if (!input.configured) return null;
  const code = cookieOf(input.cookies, REFERRAL_COOKIE_NAME);
  if (!isReferralCode(code)) return null;

  const { buyer } = input;
  const now = input.now ?? Date.now();
  const created = typeof buyer.created_at === "string" ? Date.parse(buyer.created_at) : Number.NaN;
  if (!Number.isFinite(created)) return null;
  const opened = openingOf(cookieOf(input.cookies, REFERRAL_AT_COOKIE_NAME), now);
  const nowIso = new Date(now).toISOString();
  const afterOpening = opened === null ? countsAsJoined(buyer.created_at, nowIso) : created >= opened - OPENING_TOLERANCE_MS;
  if (!afterOpening) return null;

  // Two reads at once: the route's own of the buyer's subscription row, and the code's owner.
  const admin = (input.makeAdmin ?? createServiceClient)();
  const [subscription, owner] = await Promise.all([
    input.subscription(),
    admin.from("referral_codes").select("user_id, whop_username, whop_affiliate_id").eq("code", code).maybeSingle(),
  ]);
  if (subscription.error) throw new Error("user_subscriptions: read refused");
  if (owner.error) throw new Error("referral_codes: read refused");
  if (hasSubscriptionHistory(subscription.data)) return null;
  if (!owner.data || owner.data.user_id === buyer.id) return null;
  const enrolled = enrolledAs(owner.data);
  if (!enrolled) return null;
  return {
    affiliateCode: enrolled.username,
    code,
    referrerId: owner.data.user_id,
    clickedAt: opened === null ? nowIso : new Date(opened).toISOString(),
  };
}

/**
 * For the checkout: the referrer, or null on any failure or after `ms`. Never throws. A failure is logged
 * by its kind only ("error" or "timeout"): never an id, a code, a username or the database's words.
 */
export async function checkoutReferrer(input: ReferrerInput, ms: number = REFERRER_LOOKUP_MS): Promise<Referrer | null> {
  try {
    const answer = await within(ms, () => referrerOf(input));
    if (answer !== LATE) return answer;
    console.error("[checkout] referrer lookup failed:", "timeout");
    return null;
  } catch {
    console.error("[checkout] referrer lookup failed:", "error");
    return null;
  }
}

/**
 * After a checkout was created with the referrer's code: the buyer's `referral_clicks` row (ruling 31),
 * through the service client, once per buyer and code (a second one is quiet). Never throws and gives up
 * after `ms`: the checkout's answer does not depend on it.
 */
export async function recordAttributed(
  referrer: Referrer,
  buyerId: string,
  makeAdmin: () => SupabaseClient<Database> = createServiceClient,
  ms: number = REFERRAL_ROW_MS,
): Promise<void> {
  try {
    const done = await within(ms, () =>
      writeReferralRow(makeAdmin(), { code: referrer.code, referrerId: referrer.referrerId, referredId: buyerId, clickedAt: referrer.clickedAt }),
    );
    if (done === LATE) console.error("[checkout] referral row not written:", "timeout");
  } catch {
    console.error("[checkout] referral row not written:", "error");
  }
}
