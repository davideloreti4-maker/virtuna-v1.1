/**
 * earn.ts — Earn's constants and its one rule (plan 2026-11-24-earn, step A; controller rulings 6, 8, 9
 * and 10). Pure: no React, no server import, so the page, the route and the words share it.
 *
 * The rate and what it applies to are constants here and nowhere else: every sentence that states them
 * is built from them (`earn-words.ts`), so a ruling changes one line. The money itself is Whop's (step B:
 * Whop tracks a referred sale and pays the referrer); nothing here counts money.
 */

/** The referrer's share, in percent (ruling 6: 50% of a referred creator's first month). */
export const EARN_RATE_PCT = 50;
/** True: the share is of the first payment only ("their first month"); false: of every payment. */
export const EARN_FIRST_PAYMENT_ONLY = true;
/** How long after opening a link a subscription still counts: the life of the link's cookie (`referral/constants.ts`). */
export const EARN_LINK_DAYS = 30;
/**
 * Ruling 8: a `referral_clicks` row counts only when the referred account was created at most this long
 * before the row's time. The server writes the row (rulings 20a and 31): at the sign-in that follows the
 * click, with that moment, so a new account's row comes minutes after the account and an older account
 * signing in again through a link gets none; and at the checkout of a buyer it attributes, with the time
 * the link was opened (`referrer-of.ts`).
 */
export const JOINED_WITHIN_HOURS = 24;

/** Whop pays an affiliate's share this many days after the payment (ruling 7; the words of ruling 17). */
export const WHOP_WAIT_DAYS = { from: 14, to: 30 } as const;

/**
 * Step B (ruling 13; the migration's checks hold the same forms). A Whop username as a creator may type it
 * and as `referral_codes.whop_username` stores it; an affiliate id as Whop answers it; a Whop user id as
 * `user_subscriptions.whop_user_id` holds it. None of the three can hold an "@", so an email address can
 * never be sent to Whop as one of them.
 */
export const WHOP_USERNAME_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
export const WHOP_AFFILIATE_ID_PATTERN = /^aff_[A-Za-z0-9]{1,64}$/;
export const WHOP_USER_ID_PATTERN = /^(?:user|usr)_[A-Za-z0-9]{1,64}$/;

/** A typed Whop username: trimmed, one leading "@" dropped, then the form checked; null when it is not one. */
export function whopUsernameOf(typed: unknown): string | null {
  if (typeof typed !== "string") return null;
  const name = typed.trim().replace(/^@/, "");
  return WHOP_USERNAME_PATTERN.test(name) ? name : null;
}

/**
 * A creator is enrolled when their `referral_codes` row holds a Whop username AND an affiliate id, each of
 * its form: an enrolment writes both at once, so a row with one of them was not written by one. The one
 * test of it, for the page (`earn-read.ts`) and for the checkout (`referrer-of.ts`).
 */
export function enrolledAs(row: { whop_username?: unknown; whop_affiliate_id?: unknown } | null | undefined): { username: string; affiliateId: string } | null {
  const username = row?.whop_username;
  const affiliateId = row?.whop_affiliate_id;
  if (typeof username !== "string" || !WHOP_USERNAME_PATTERN.test(username)) return null;
  if (typeof affiliateId !== "string" || !WHOP_AFFILIATE_ID_PATTERN.test(affiliateId)) return null;
  return { username, affiliateId };
}

/**
 * The payment partner's side of Earn (step B): whether a creator can enrol at all (the partner's settings
 * are there), whether we already know their account there (a paying customer), the username their share
 * is paid to once enrolled, and what they have earned, in whole cents (null when it could not be read).
 */
export interface EarnWhop {
  canEnrol: boolean;
  knownAccount: boolean;
  username: string | null;
  earnedCents: number | null;
}

/**
 * What `POST /api/earn/whop` can refuse (step B): Whop knows no such account; the typed text is not a Whop
 * username; no username and no Whop account known; Whop not configured here; the Whop account is another
 * creator's already (ruling 33); anything else (one enrolment running already and too many attempts in an
 * hour among it: rulings 27 and 33).
 */
export type EnrolRefusal = "not_found" | "invalid_username" | "no_account" | "not_available" | "already_connected" | "failed";

/** What `GET /api/earn` answers (ruling 9). Nothing of another person: no id, no name, no email. */
export interface EarnPage {
  /** `<app>/?ref=<CODE>`, as Settings has always built it. */
  link: string;
  code: string;
  /** The caller's own display name, for the share card; null when there is none. */
  name: string | null;
  /** Creators who joined through the link (ruling 8). */
  joined: number;
  /** Step B (Whop); null when the payment side could not be read (the page then shows no card for it). */
  whop: EarnWhop | null;
}

/** The rule's inputs, so the words can be shown to follow them (tests pass other values). */
export interface EarnRule {
  ratePct: number;
  firstPaymentOnly: boolean;
  linkDays: number;
}

export const EARN_RULE: EarnRule = {
  ratePct: EARN_RATE_PCT,
  firstPaymentOnly: EARN_FIRST_PAYMENT_ONLY,
  linkDays: EARN_LINK_DAYS,
};

const time = (iso: string | null | undefined): number => (typeof iso === "string" ? Date.parse(iso) : Number.NaN);

/**
 * Ruling 8: true when the referred account was created not more than `JOINED_WITHIN_HOURS` before the
 * row's `clicked_at`. An account the clock puts after its row counts (it cannot be older than the
 * link). A missing or unreadable time does not count.
 */
export function countsAsJoined(accountCreatedAt: string | null | undefined, clickedAt: string | null | undefined): boolean {
  const created = time(accountCreatedAt);
  const clicked = time(clickedAt);
  if (!Number.isFinite(created) || !Number.isFinite(clicked)) return false;
  return clicked - created <= JOINED_WITHIN_HOURS * 3_600_000;
}

/** One `referral_clicks` row, as the read needs it. */
export interface JoinRow {
  referredUserId: string | null;
  clickedAt: string | null;
}

/**
 * The creators who joined through the caller's link: each referred account once, never the caller's
 * own, never a row whose account is gone (its id was set to null), and only when `countsAsJoined`.
 * `createdAt` holds each referred account's creation time (an account not found is absent or null).
 */
export function joinedCount(rows: readonly JoinRow[], createdAt: ReadonlyMap<string, string | null>, self: string): number {
  const counted = new Set<string>();
  for (const row of rows) {
    const id = row.referredUserId;
    if (!id || id === self || counted.has(id)) continue;
    if (countsAsJoined(createdAt.get(id), row.clickedAt)) counted.add(id);
  }
  return counted.size;
}
