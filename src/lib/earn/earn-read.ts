/**
 * earn-read.ts — what `GET /api/earn` answers (plan 2026-11-24-earn, steps A and B; rulings 8, 9, 13, 16,
 * 20, 34 and 36). SERVER ONLY.
 *
 * - The code: made on first view for ANY account (`ensureReferralCode`; nothing reads the plan; the server
 *   writes it, through the service client, for the caller's id), and the link built as Settings has always
 *   built it (`referralLink`).
 * - The name for the share card: the caller's own, by the You page's chain (`GET /api/profile`):
 *   `user_settings.display_name`, else `creator_profiles.display_name`, else the sign-in's
 *   `user_metadata.full_name`; trimmed, null when there is none.
 * - `joined` (rulings 8 and 20): the caller's `referral_clicks` rows whose referred account was created at
 *   most 24 hours before the row. Bounded: only the newest `JOINED_CHECKED_ROWS` rows are checked (one
 *   select with an explicit limit, through the session client, which reads the caller's own rows); older
 *   rows count as they are (one count). The accounts' creation times live in
 *   `auth.users`, which no public table mirrors, so they are read with the auth admin API
 *   (`auth.admin.getUserById`) through the service client: one call per referred account, sent together
 *   in batches of `ADMIN_BATCH`. A lookup that fails means that row is not counted, never an error for the
 *   page. A count checked in full is kept five minutes per creator (`earn-cache.ts`).
 * - `whop` (rulings 13, 16 and 34): whether enrolling is possible here (Whop's settings), whether the caller
 *   is a paying customer (a stored Whop user id), the username they enrolled with, and what Whop says they
 *   earned: read from Whop only for an enrolled creator, at most once in five minutes per creator, waiting
 *   at most `EARNED_READ_MS`. The answer must be the account the creator enrolled as (its username equals
 *   the stored one), else the number is unreadable. An unreadable number is null, and that it was unreadable
 *   is remembered for a minute, so Whop is not asked again on every request. When the caller's own rows
 *   cannot be read, `whop` is null and the page still answers.
 *
 * Nothing of another person leaves this module: the answer holds a count, never an id, a name, an email or
 * a time.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureReferralCode, referralLink } from "@/lib/referral/ensure-code";
import type { Database } from "@/types/database.types";

import { WHOP_USER_ID_PATTERN, enrolledAs, joinedCount, type EarnPage, type EarnWhop, type JoinRow } from "./earn";
import { earnedCache, earnedKey, earnedUnreadable, joinedCache } from "./earn-cache";
import { WhopError, getAffiliate, type Http, type WhopSettings } from "./whop-affiliates";

/** Account lookups sent together. */
export const ADMIN_BATCH = 20;
/** Ruling 20: the rows checked against the accounts' creation times, newest first. */
export const JOINED_CHECKED_ROWS = 200;
/** Ruling 34: the longest the page waits for what Whop says a creator earned. */
export const EARNED_READ_MS = 3_000;

export interface EarnCaller {
  id: string;
  user_metadata?: Record<string, unknown> | null;
}

/** How the read reaches Whop: `fetch` and the settings of the moment (`whopSettings()`; null: not configured). */
export interface EarnPayments {
  http: Http;
  settings: WhopSettings | null;
}

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

async function nameOf(db: SupabaseClient<Database>, caller: EarnCaller): Promise<string | null> {
  const [settings, profile] = await Promise.all([
    db.from("user_settings").select("display_name").eq("user_id", caller.id).maybeSingle(),
    db.from("creator_profiles").select("display_name").eq("user_id", caller.id).maybeSingle(),
  ]);
  if (settings.error) throw new Error(`user_settings: ${settings.error.message}`);
  if (profile.error) throw new Error(`creator_profiles: ${profile.error.message}`);
  return text(settings.data?.display_name) ?? text(profile.data?.display_name) ?? text(caller.user_metadata?.full_name);
}

/**
 * Each account's creation time, by id; an account that no longer exists is left out. `complete` is false
 * when a lookup failed for another reason (that account is left out too).
 */
async function createdAtOf(admin: SupabaseClient<Database>, ids: readonly string[]): Promise<{ found: Map<string, string | null>; complete: boolean }> {
  const found = new Map<string, string | null>();
  let complete = true;
  for (let start = 0; start < ids.length; start += ADMIN_BATCH) {
    const batch = ids.slice(start, start + ADMIN_BATCH);
    const answers = await Promise.all(batch.map((id) => admin.auth.admin.getUserById(id).catch(() => null)));
    answers.forEach((answer, i) => {
      if (!answer || (answer.error && answer.error.status !== 404)) {
        complete = false;
        return;
      }
      if (answer.error) return;
      found.set(batch[i]!, answer.data.user?.created_at ?? null);
    });
  }
  return { found, complete };
}

async function joinedThrough(db: SupabaseClient<Database>, admin: SupabaseClient<Database>, self: string): Promise<number> {
  const kept = joinedCache.get(self);
  if (kept !== null) return kept;

  const { data, error } = await db
    .from("referral_clicks")
    .select("referred_user_id, clicked_at")
    .eq("referrer_user_id", self)
    .neq("referred_user_id", self)
    .order("clicked_at", { ascending: false, nullsFirst: false })
    .limit(JOINED_CHECKED_ROWS);
  if (error) throw new Error(`referral_clicks: ${error.message}`);
  const rows: JoinRow[] = (data ?? []).map((r) => ({ referredUserId: r.referred_user_id, clickedAt: r.clicked_at }));

  // Older rows than the ones checked count as they are (`neq`: never a deleted account, never the caller).
  let older = 0;
  if (rows.length >= JOINED_CHECKED_ROWS) {
    const all = await db
      .from("referral_clicks")
      .select("id", { count: "exact", head: true })
      .eq("referrer_user_id", self)
      .neq("referred_user_id", self);
    if (all.error) throw new Error(`referral_clicks: ${all.error.message}`);
    older = Math.max(0, (all.count ?? 0) - rows.length);
  }

  const ids = [...new Set(rows.map((r) => r.referredUserId).filter((id): id is string => Boolean(id) && id !== self))];
  if (ids.length === 0) {
    joinedCache.set(self, older);
    return older;
  }
  const { found, complete } = await createdAtOf(admin, ids);
  const joined = joinedCount(rows, found, self) + older;
  if (complete) joinedCache.set(self, joined);
  return joined;
}

/**
 * What Whop says the creator earned, in whole cents; kept five minutes when read. Null when unreadable (no
 * answer in time, a refusal, no number, or an answer for another account than the one enrolled), and then
 * not asked for again for a minute. A failure is logged by its kind only.
 */
async function earnedOf(payments: { http: Http; settings: WhopSettings }, userId: string, enrolled: { username: string; affiliateId: string }): Promise<number | null> {
  const key = earnedKey(userId, enrolled.affiliateId);
  const kept = earnedCache.get(key);
  if (kept !== null) return kept;
  if (earnedUnreadable.get(key)) return null;
  try {
    const settings = { ...payments.settings, timeoutMs: Math.min(payments.settings.timeoutMs ?? EARNED_READ_MS, EARNED_READ_MS) };
    const affiliate = await getAffiliate(payments.http, settings, enrolled.affiliateId);
    const sameAccount = affiliate.username === enrolled.username;
    if (sameAccount && affiliate.earnedCents !== null) {
      earnedCache.set(key, affiliate.earnedCents);
      return affiliate.earnedCents;
    }
    console.error("[earn] whop earned read failed:", sameAccount ? "no number" : "another account");
  } catch (err) {
    console.error("[earn] whop earned read failed:", err instanceof WhopError ? err.message : "unexpected");
  }
  earnedUnreadable.set(key, true);
  return null;
}

async function whopOf(db: SupabaseClient<Database>, userId: string, payments: EarnPayments): Promise<EarnWhop | null> {
  const [subscription, code] = await Promise.all([
    db.from("user_subscriptions").select("whop_user_id").eq("user_id", userId).maybeSingle(),
    db.from("referral_codes").select("whop_username, whop_affiliate_id").eq("user_id", userId).maybeSingle(),
  ]);
  const failed = subscription.error ?? code.error;
  if (failed) {
    console.error("[earn] payment side read failed:", failed.message);
    return null;
  }
  const whopUserId = subscription.data?.whop_user_id;
  const enrolled = enrolledAs(code.data);
  const { settings } = payments;
  return {
    canEnrol: settings !== null,
    knownAccount: typeof whopUserId === "string" && WHOP_USER_ID_PATTERN.test(whopUserId),
    username: enrolled ? enrolled.username : null,
    earnedCents: enrolled && settings ? await earnedOf({ http: payments.http, settings }, userId, enrolled) : null,
  };
}

/**
 * The caller's Earn page. `db` is the caller's session client (their own rows), `admin` the service client
 * (only for the account lookups and to write a first code for the caller), `payments` how Whop is reached. Throws on a database error of the link,
 * the name or the rows; the route logs its text and answers 500.
 */
export async function readEarnPage(
  db: SupabaseClient<Database>,
  admin: SupabaseClient<Database>,
  caller: EarnCaller,
  payments: EarnPayments,
): Promise<EarnPage> {
  const code = await ensureReferralCode(db, caller.id, () => admin);
  if (!code) throw new Error("referral code: none could be made");
  const [name, joined, whop] = await Promise.all([nameOf(db, caller), joinedThrough(db, admin, caller.id), whopOf(db, caller.id, payments)]);
  return { link: referralLink(code), code, name, joined, whop };
}
