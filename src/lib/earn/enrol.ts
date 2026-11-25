/**
 * enrol.ts — a creator enrols as an affiliate at Whop (plan 2026-11-24-earn, step B; rulings 13, 14, 26,
 * 27, 33 and 42). SERVER ONLY. It is the creator's own act, from the card `Get paid` on Earn:
 *
 * - A paying customer (their `user_subscriptions.whop_user_id` is known) is enrolled by that Whop user id.
 *   Anyone else types a Whop username: its form is checked before any call (a leading "@" dropped). An
 *   email address is never sent: neither form can hold an "@".
 * - One enrolment at a time per creator AND per Whop account (rulings 27 and 42), and at most
 *   `ENROL_ATTEMPTS_PER_HOUR` attempts per creator per hour (ruling 33): held and counted here, in this
 *   server instance's memory, for the requests that would reach Whop. The Whop account is the identifier
 *   the request names: the typed username in lower case, or the stored Whop user id. Across instances the
 *   bound is the route's own budget in the shared limiter (`earn-whop`, `src/lib/http/rate-limit.ts`).
 * - `POST /affiliates` creates the affiliate or answers the existing one.
 * - One Whop account, one creator (ruling 33): when the username or the affiliate id Whop answered is
 *   already stored on another creator's row, the enrolment is refused and nothing more is done. Checked
 *   here by two reads; a write the database refuses as a duplicate (23505) is answered the same way.
 * - Then the commission (rulings 14 and 26): the affiliate's overrides are listed once, and every plan the
 *   app sells that has none gets one standard override (`EARN_RATE_PCT` percent of the first payment).
 *   Enrolled means EVERY configured plan has its commission: if one could not be set, nothing is stored and
 *   the enrolment failed; a second try finds the affiliate and the commissions that are there and sets
 *   only what is missing.
 * - Only then the username Whop answers (not the typed text) and the affiliate id are stored on the
 *   caller's `referral_codes` row, through the service client, filtered by the caller's id from the
 *   session. A second enrolment (Change) overwrites both columns.
 *
 * A database error throws (the route answers 500); everything Whop answers is an outcome. A failure is
 * logged by its kind only (no id, no username, no key).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { WHOP_PRODUCT_IDS, WHOP_TRIAL_PLAN_IDS } from "@/lib/whop/config";
import type { Database } from "@/types/database.types";

import { WHOP_USER_ID_PATTERN, whopUsernameOf } from "./earn";
import { earnedCache, earnedKey, earnedUnreadable } from "./earn-cache";
import { WhopError, createAffiliate, createOverride, listOverrides, type Http, type WhopAffiliate, type WhopSettings } from "./whop-affiliates";

export interface CommissionOutcome {
  /** Plans given the override now. */
  set: number;
  /** Plans that already had one (left alone). */
  kept: number;
  /** Plans that could not be set (or not checked). */
  failed: number;
}

export type EnrolOutcome =
  | { kind: "enrolled"; username: string; affiliateId: string; commission: CommissionOutcome }
  | { kind: "not_available" }
  | { kind: "invalid_username" }
  | { kind: "no_account" }
  | { kind: "not_found" }
  /** The Whop account is another creator's already (ruling 33). */
  | { kind: "already_connected" }
  /** Another enrolment of this creator, or with this Whop account, is running here (rulings 27 and 42). */
  | { kind: "busy" }
  /** This creator's attempts of the last hour are used up (ruling 33). */
  | { kind: "too_many"; retryAfterSeconds: number }
  | { kind: "failed" };

export interface EnrolDeps {
  /** The service client: the server writes the two columns with it. */
  admin: SupabaseClient<Database>;
  http: Http;
  /** Null: Whop is not configured here. */
  settings: WhopSettings | null;
  /** The plan ids the commission is set on (`commissionPlanIds()`); an unset one is skipped. */
  planIds: readonly (string | null | undefined)[];
}

/** The plans the app sells: the three plans and their three trial plans, as configured. */
export function commissionPlanIds(): (string | undefined)[] {
  return [...Object.values(WHOP_PRODUCT_IDS), ...Object.values(WHOP_TRIAL_PLAN_IDS)];
}

const kindOf = (err: unknown): string => (err instanceof WhopError ? err.message : "unexpected");

/** Ruling 33: the enrolment attempts a creator may make in an hour, on one server instance. */
export const ENROL_ATTEMPTS_PER_HOUR = 3;
const HOUR_MS = 3_600_000;
/** Creators with an enrolment running on this server instance (ruling 27). */
const running = new Set<string>();
/**
 * Whop accounts with an enrolment running on this server instance (ruling 42), each by the identifier its
 * request names, in lower case. A set of its own: a username can have the form of a creator's id.
 */
const runningAccounts = new Set<string>();
/** When each creator's attempts of the last hour were made. */
const attempts = new Map<string, number[]>();
/** Past this many creators, the ones whose hour is over are dropped from the memory. */
const ATTEMPTS_KEPT = 2_000;

/**
 * Lets the creator's enrolment with this Whop account start (holds both, and counts the attempt), or says
 * why not. Busy holds nothing and is not counted.
 */
function admit(userId: string, account: string, now: number): Extract<EnrolOutcome, { kind: "busy" | "too_many" }> | null {
  if (running.has(userId) || runningAccounts.has(account)) return { kind: "busy" };
  const recent = (attempts.get(userId) ?? []).filter((at) => now - at < HOUR_MS);
  if (recent.length >= ENROL_ATTEMPTS_PER_HOUR) {
    attempts.set(userId, recent);
    return { kind: "too_many", retryAfterSeconds: Math.max(1, Math.ceil((recent[0]! + HOUR_MS - now) / 1000)) };
  }
  if (attempts.size >= ATTEMPTS_KEPT) {
    for (const [id, times] of attempts) if (times.every((at) => now - at >= HOUR_MS)) attempts.delete(id);
  }
  attempts.set(userId, [...recent, now]);
  running.add(userId);
  runningAccounts.add(account);
  return null;
}

/** Tests only: a fresh start. */
export function clearEnrolGate(): void {
  running.clear();
  runningAccounts.clear();
  attempts.clear();
}

/** The Whop user id a paying customer has, or null. */
async function storedWhopUserId(admin: SupabaseClient<Database>, userId: string): Promise<string | null> {
  const { data, error } = await admin.from("user_subscriptions").select("whop_user_id").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`user_subscriptions: ${error.message}`);
  const id = data?.whop_user_id;
  return typeof id === "string" && WHOP_USER_ID_PATTERN.test(id) ? id : null;
}

/** Ruling 33: true when another creator's row already holds this Whop account (its username or its affiliate id). */
async function connectedElsewhere(admin: SupabaseClient<Database>, userId: string, affiliate: { id: string; username: string }): Promise<boolean> {
  const [byUsername, byAffiliate] = await Promise.all([
    admin.from("referral_codes").select("user_id").eq("whop_username", affiliate.username).neq("user_id", userId).limit(1),
    admin.from("referral_codes").select("user_id").eq("whop_affiliate_id", affiliate.id).neq("user_id", userId).limit(1),
  ]);
  const failed = byUsername.error ?? byAffiliate.error;
  if (failed) throw new Error(`referral_codes: ${failed.message}`);
  return (byUsername.data?.length ?? 0) > 0 || (byAffiliate.data?.length ?? 0) > 0;
}

/**
 * Enrols the caller (`userId`, from the session). `typed` is the field's text; undefined means "by the
 * Whop account we know" (the button `Set up payouts`).
 */
export async function enrolAtWhop(deps: EnrolDeps, userId: string, typed: string | undefined): Promise<EnrolOutcome> {
  const { admin, settings } = deps;
  if (!settings) return { kind: "not_available" };

  let identifier: string | null;
  if (typed !== undefined) {
    identifier = whopUsernameOf(typed);
    if (!identifier) return { kind: "invalid_username" };
  } else {
    identifier = await storedWhopUserId(admin, userId);
    if (!identifier) return { kind: "no_account" };
  }

  // From here the request would reach Whop: one at a time per creator and per Whop account, and so many
  // an hour.
  const account = identifier.toLowerCase();
  const refused = admit(userId, account, Date.now());
  if (refused) return refused;
  try {
    return await enrolAs(deps, settings, userId, identifier);
  } finally {
    running.delete(userId);
    runningAccounts.delete(account);
  }
}

async function enrolAs(deps: EnrolDeps, settings: WhopSettings, userId: string, identifier: string): Promise<EnrolOutcome> {
  const { admin, http } = deps;
  let affiliate: WhopAffiliate;
  try {
    affiliate = await createAffiliate(http, settings, identifier);
  } catch (err) {
    if (err instanceof WhopError && err.kind === "not_found") return { kind: "not_found" };
    console.error("[earn] whop enrol failed:", kindOf(err));
    return { kind: "failed" };
  }
  // The username is what a referred checkout carries (`affiliate_code`): without one, nothing can be paid.
  const { username } = affiliate;
  if (!username) {
    console.error("[earn] whop enrol failed:", "no username");
    return { kind: "failed" };
  }

  if (await connectedElsewhere(admin, userId, { id: affiliate.id, username })) return { kind: "already_connected" };

  // Ruling 26: every configured plan, or nothing is stored.
  const commission = await setCommission(http, settings, affiliate.id, deps.planIds);
  if (commission.failed > 0) return { kind: "failed" };

  const { data, error } = await admin
    .from("referral_codes")
    .update({ whop_username: username, whop_affiliate_id: affiliate.id })
    .eq("user_id", userId)
    .select("user_id");
  // A duplicate the database refuses: another creator's row took this account in the same moment.
  if (error?.code === "23505") return { kind: "already_connected" };
  if (error) throw new Error(`referral_codes: ${error.message}`);
  if (!data || data.length === 0) throw new Error("referral_codes: no row for the caller");

  const key = earnedKey(userId, affiliate.id);
  earnedUnreadable.invalidate(key);
  if (affiliate.earnedCents !== null) earnedCache.set(key, affiliate.earnedCents);
  return { kind: "enrolled", username, affiliateId: affiliate.id, commission };
}

/**
 * Ruling 14: one standard override per plan that has none. Never throws: a refused call is counted and
 * logged by its kind. When the list cannot be read nothing is set (a plan could get two overrides).
 */
export async function setCommission(
  http: Http,
  settings: WhopSettings,
  affiliateId: string,
  planIds: readonly (string | null | undefined)[],
): Promise<CommissionOutcome> {
  const plans = [...new Set(planIds.filter((id): id is string => typeof id === "string" && id.trim() !== ""))];
  if (plans.length === 0) return { set: 0, kept: 0, failed: 0 };

  let existing: Set<string | null>;
  try {
    existing = new Set((await listOverrides(http, settings, affiliateId)).map((o) => o.planId));
  } catch (err) {
    console.error("[earn] whop commission failed:", kindOf(err));
    return { set: 0, kept: 0, failed: plans.length };
  }

  const missing = plans.filter((id) => !existing.has(id));
  const results = await Promise.allSettled(missing.map((id) => createOverride(http, settings, affiliateId, id)));
  let failed = 0;
  for (const r of results) {
    if (r.status === "fulfilled") continue;
    failed += 1;
    console.error("[earn] whop commission failed:", kindOf(r.reason));
  }
  return { set: missing.length - failed, kept: plans.length - missing.length, failed };
}
