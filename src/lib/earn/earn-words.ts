/**
 * earn-words.ts — every word Earn shows (rulings 10, 17 and 43), built from the constants in `earn.ts`. Pure.
 *
 * The sentences take the rule as an argument (the constants by default) so a test can show that another
 * ruling changes them. The words for "every payment" (`firstPaymentOnly: false`) are not shown in step A;
 * they are the plan's earlier wording, kept so the constant can be flipped without a missing sentence.
 */
import { EARN_RULE, WHOP_WAIT_DAYS, type EarnRule } from "./earn";

export const EARN_STRINGS = {
  title: "Earn",
  yourLink: "Your link",
  copy: "Copy",
  copied: "Copied",
  share: "Share",
  saveImage: "Save image",
  youEarn: "YOU EARN",
  sharedBy: "SHARED BY",
  howItWorks: "How it works",
  /** What Share sends with the link. */
  shareText: "Simulate your videos before you post them. Try Maven:",
  loadFailed: "Couldn't load Earn. Try again.",
  tryAgain: "Try again",
  /** Announced while the page loads (not shown). */
  loading: "Loading",
  /** The QR code's accessible name. */
  qrName: "QR code of your link",
  /** The saved card's file name. */
  fileName: "maven-earn.png",
} as const;

const count = new Intl.NumberFormat("en-US");

/** "50%". */
export function ratePct(rule: EarnRule = EARN_RULE): string {
  return `${rule.ratePct}%`;
}

/** The big words at the top: "Earn 50%". */
export function headline(rule: EarnRule = EARN_RULE): string {
  return `Earn ${ratePct(rule)}`;
}

/** Under the headline: "of a creator's first month, for every creator you bring." */
export function rateLine(rule: EarnRule = EARN_RULE): string {
  return rule.firstPaymentOnly
    ? "of a creator's first month, for every creator you bring."
    : "of everything a creator pays, for every creator you bring.";
}

/**
 * Whole cents as money words, the one place that does it: "$0", "$58.80", "$1,240", "$1,240.50" (no
 * ".00", two places otherwise, thousands separated). Counted in integers, never a float sum; a part of a
 * cent is rounded; a number that is not one (NaN, Infinity) is "$0".
 */
export function moneyWord(cents: number): string {
  if (!Number.isFinite(cents)) return "$0";
  const whole = Math.round(Math.abs(cents));
  const dollars = count.format(Math.floor(whole / 100));
  const rest = whole % 100;
  const sign = cents < 0 && whole > 0 ? "-" : "";
  return `${sign}$${dollars}${rest === 0 ? "" : `.${String(rest).padStart(2, "0")}`}`;
}

/** "0 creators joined through your link", "1 creator joined through your link". */
export function joinedLine(n: number): string {
  return `${count.format(n)} ${n === 1 ? "creator" : "creators"} joined through your link`;
}

/** "14 to 30 days": how long Whop waits before it pays a share. */
const whopWait = `${WHOP_WAIT_DAYS.from} to ${WHOP_WAIT_DAYS.to} days`;

/**
 * The three lines of "How it works". Line 2 says what is credited (ruling 43): a creator who subscribes
 * while the link's cookie lives, in the browser that opened the link. With `paidByWhop` (the page knows
 * Whop can pay: ruling 17), line 3 also says when Whop pays.
 */
export function howItWorks(rule: EarnRule = EARN_RULE, opts: { paidByWhop?: boolean } = {}): [string, string, string] {
  const days = `${rule.linkDays} ${rule.linkDays === 1 ? "day" : "days"}`;
  const share = rule.firstPaymentOnly
    ? `When they start paying, you earn ${ratePct(rule)} of their first month.`
    : `When they start paying, you earn ${ratePct(rule)} of each payment they make.`;
  return [
    "Share your link or the card.",
    `A creator opens it and subscribes within ${days}, on the same device.`,
    opts.paidByWhop ? `${share} Whop pays you ${whopWait} later.` : share,
  ];
}

/** The top of the page once Whop reports a number (ruling 17): "$24.50 earned", in place of "Earn 50%". */
export function earnedLine(cents: number): string {
  return `${moneyWord(cents)} earned`;
}

/** The card `Get paid` (rulings 17, 33 and 43). */
export const GET_PAID_STRINGS = {
  title: "Get paid",
  lead: "Whop, our payment partner, pays your share to your Whop account.",
  /** Ruling 43: for a creator who can enrol and has not yet. */
  notCredited: "Sales made before you set this up are not credited.",
  setUp: "Set up payouts",
  addUsername: "Add your Whop username to get paid.",
  field: "Whop username",
  placeholder: "yourname",
  save: "Save",
  change: "Change",
  notFound: "We couldn't find that Whop username.",
  notAvailable: "Payouts aren't available yet.",
  failed: "Couldn't set up payouts. Try again.",
  /** Ruling 33: the Whop account is stored on another creator's row. */
  alreadyConnected: "That Whop account is already connected.",
} as const;

/** Enrolled: "Paid by Whop to @nia.cooks, 14 to 30 days after a creator's first payment." */
export function paidByLine(username: string, rule: EarnRule = EARN_RULE): string {
  return `Paid by Whop to @${username}, ${whopWait} after ${rule.firstPaymentOnly ? "a creator's first payment" : "each payment"}.`;
}
