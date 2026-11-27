/**
 * earn-words.ts — every word Earn shows (rulings 10, 17 and 43), built from the constants in `earn.ts`. Pure.
 *
 * The sentences take the rule as an argument (the constants by default) so a test can show that another
 * ruling changes them. The words for "every payment" (`firstPaymentOnly: false`) are not shown in step A;
 * they are the plan's earlier wording, kept so the constant can be flipped without a missing sentence.
 */
import { EARN_RULE, WHOP_WAIT_DAYS, type EarnRule } from "./earn";

export const EARN_STRINGS = {
  /** The phone's pushed header, and the sidebar's name. */
  title: "Earn",
  /** The page's own heading. */
  pageTitle: "Your Earnings",
  /** The left card's title. */
  cardTitle: "Get paid for every creator you bring",
  earningsLabel: "Earnings",
  emptyTitle: "No earnings yet",
  emptyHint: "Share your link or the card.",
  statEarned: "Earned",
  statJoined: "Creators joined",
  statPaidBy: "Paid by",
  notSetUp: "Payouts not set up",
  /** Footer: what Whop does not credit. */
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

/** The quiet line under the card's title: "50% of each referred creator's first month." */
export function rateSubtitle(rule: EarnRule = EARN_RULE): string {
  return rule.firstPaymentOnly
    ? `${ratePct(rule)} of each referred creator's first month.`
    : `${ratePct(rule)} of everything each referred creator pays.`;
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

/** The figure Home's "Money made" row counts toward (owner 2026-11-26: "0/65k"): $65,000, in cents. */
export const MONEY_GOAL_CENTS = 6_500_000;

/**
 * Round money in short words, for a goal: "$65k", "$1.5k", "$2M", "$800". Whole dollars; one decimal
 * at most, dropped when it is zero. For an amount earned use `moneyWord`, which never rounds.
 */
export function shortMoneyWord(cents: number): string {
  const dollars = Math.round((Number.isFinite(cents) ? cents : 0) / 100);
  const short = (n: number, unit: string) => `$${Number(n.toFixed(1))}${unit}`;
  if (dollars >= 1_000_000) return short(dollars / 1_000_000, "M");
  if (dollars >= 1_000) return short(dollars / 1_000, "k");
  return `$${dollars}`;
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

/** "$24.50 earned". The page no longer headlines it (it shows the amount over the goal); kept for its test. */
export function earnedLine(cents: number): string {
  return `${moneyWord(cents)} earned`;
}

/**
 * The amount at the top of the page, by Home's "Money made" rule: the number Whop reported; "$0" when the
 * creator is not enrolled or the payment side is unknown; null for an enrolled creator whose number could
 * not be read (no amount is shown then, never a made-up zero).
 */
export function earnedAmount(whop: { username: string | null; earnedCents: number | null } | null): string | null {
  const cents = typeof whop?.earnedCents === "number" ? whop.earnedCents : null;
  if (Boolean(whop?.username) && cents === null) return null;
  return moneyWord(cents ?? 0);
}

/** The muted tail of the amount line: " / $65k goal", or "$65k goal" when there is no amount. */
export function goalWord(): string {
  return `${shortMoneyWord(MONEY_GOAL_CENTS)} goal`;
}

/** Footer: when Whop pays: "Whop pays your share 14 to 30 days after a creator's first payment." */
export function whopTimingLine(rule: EarnRule = EARN_RULE): string {
  return `Whop pays your share ${whopWait} after ${rule.firstPaymentOnly ? "a creator's first payment" : "each payment"}.`;
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
