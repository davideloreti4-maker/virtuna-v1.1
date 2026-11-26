/**
 * Every word of the new-look Settings page (spec docs/superpowers/specs/2026-11-26-settings-design.md,
 * sections 2, 5 and 6). Plain, as drawn: no "Readings", no "Room" (the licence credit apart), no
 * "personas", no "test". Prices, credits and the trial's terms come from `PLANS` / `TRIAL`; a plan's
 * own price word and its days come with the view (`@/lib/settings/plan-view`).
 *
 * A day that is not known is left out of its sentence; nothing here prints "null".
 */
import { PLANS, TRIAL, creditsLabel, type Plan } from "@/lib/pricing";
import type { PlanState, PlanView } from "@/lib/settings/plan-view";
import type { ThemeChoice } from "@/lib/theme/theme";

const count = (n: number) => n.toLocaleString("en-US");
/** "$49 a month": the plan's price word, as the view writes it. */
const aMonth = (plan: Plan) => `${plan.price} a month`;

export const TITLE = "Settings";
export const PLAN_LABEL = "Plan";
export const ACCOUNT_LABEL = "Account";
export const CANCEL = "Cancel";
export const CLOSE = "Close";
export const TRY_AGAIN = "Try again";
/** Whop's page of the visitor's memberships: where a plan is managed, paid and cancelled. */
export const MANAGE_HREF = "https://whop.com/hub/memberships";

/* ── 2.1 Plan ─────────────────────────────────────────────────────────────── */

export const NO_PLAN = "No plan";
export const PLAN_PILL: Record<PlanState, string> = {
  renews: "Active",
  cancelled: "Cancelled",
  pastDue: "Payment failed",
  trial: "Trial",
};
export const PLAN_FAILED = "Couldn't load your plan.";
export const SEE_PLANS = "See plans";
export const MANAGE = "Manage on Whop";
export const MANAGE_LINE = "Payment, invoices, cancel";
export const UPDATE_ON_WHOP = "Update on Whop";
export const METER_LABEL = "Credits left";
export const UNLIMITED_CREDITS = "Unlimited credits";

/** A link that leaves for Whop, as a screen reader names it: "Manage on Whop, opens Whop in a new tab". */
export const opensWhop = (label: string) => `${label}, opens Whop in a new tab`;

/** The lowest price a plan starts at, for "Plans from $49 a month." */
function lowest(): Plan {
  return PLANS.reduce((low, plan) => (plan.monthlyPriceUsd < low.monthlyPriceUsd ? plan : low));
}

/** The one line under the plan's name (the table of 2.1). */
export function planLine(view: PlanView): string {
  if (view.kind === "none") {
    return view.trialAvailable
      ? `Try any plan for ${TRIAL.price}: ${TRIAL.credits} credits over ${TRIAL.days} days.`
      : `Plans from ${aMonth(lowest())}.`;
  }
  switch (view.state) {
    case "renews":
      return view.on ? `${view.price} · renews ${view.on}` : view.price;
    case "cancelled":
      return view.on ? `Ends ${view.on}. Nothing more is billed.` : "Nothing more is billed.";
    case "pastDue":
      return "Whop couldn't take the payment. Update your card there to keep your credits.";
    case "trial":
      return `${TRIAL.price} for ${TRIAL.days} days. Becomes ${view.name}, ${view.price}, ${view.on ? `on ${view.on} ` : ""}unless you cancel.`;
  }
}

/** "312 of 500 credits left", "30 of 50 trial credits left", "Unlimited credits"; null: no credits to say. */
export function creditsLine(view: PlanView): string | null {
  if (view.kind === "none" || view.credits === null) return null;
  if (view.credits === "unlimited") return UNLIMITED_CREDITS;
  const noun = view.state === "trial" ? "trial credits" : "credits";
  return `${count(Math.max(0, view.credits.left))} of ${count(view.credits.limit)} ${noun} left`;
}

/** What stands at the right of the credits: "Resets 14 Dec", "Until 14 Dec" (cancelled), "Ends 29 Nov" (trial). */
export function creditsNote(view: PlanView): string | null {
  if (view.kind === "none" || view.credits === null || view.credits === "unlimited") return null;
  if (view.state === "cancelled") return view.on ? `Until ${view.on}` : null;
  if (view.state === "trial") return view.on ? `Ends ${view.on}` : null;
  return view.credits.resetsOn ? `Resets ${view.credits.resetsOn}` : null;
}

/* ── 5 See plans ──────────────────────────────────────────────────────────── */

export const PLANS_TITLE = "Choose a plan";

/** "500 credits a month" / "Unlimited credits". */
export const planCredits = (plan: Plan): string => creditsLabel(plan);

/** "Start Creator for $1" while the trial is unused, else "Start Creator · $49 a month". */
export function startPlanLabel(plan: Plan, trialAvailable: boolean): string {
  return trialAvailable ? `Start ${plan.name} for ${TRIAL.price}` : `Start ${plan.name} · ${aMonth(plan)}`;
}

/** The line under the button: what the dollar buys and what follows, or how the plan is billed. */
export function startPlanLine(plan: Plan, trialAvailable: boolean): string {
  return trialAvailable
    ? `${TRIAL.credits} credits over ${TRIAL.days} days, then ${aMonth(plan)}. Cancel any time on Whop.`
    : "Billed monthly by Whop. Cancel any time.";
}

/* ── 2.2 Appearance ───────────────────────────────────────────────────────── */

export const APPEARANCE = "Appearance";
export const THEME_LABEL: Record<ThemeChoice, string> = {
  light: "Light",
  dark: "Dark",
  system: "Match system",
};

/* ── 2.3 Account ──────────────────────────────────────────────────────────── */

export const EMAIL = "Email";
/** "nia@example.com", or "nia@example.com · Google" for an account that signs in with Google. */
export const emailLine = (email: string, google: boolean): string => (google ? `${email} · Google` : email);

export const PASSWORD = "Password";
export const PASSWORD_LINE = "Set or change";
export const PASSWORD_SAVED = "Saved";
export const PASSWORD_OPEN_LINE = "Optional. A code by email always signs you in.";
export const NEW_PASSWORD = "New password";
export const PASSWORD_AGAIN = "Type it again";
export const PASSWORD_MIN = 8;
export const PASSWORD_HINT = `${PASSWORD_MIN} characters or more`;
export const PASSWORD_TOO_SHORT = PASSWORD_HINT;
export const PASSWORD_MISMATCH = "The two don't match";
/** Any failure but the length rule; the container says it for a save the server refused. */
export const PASSWORD_FAILED = "Couldn't save. Try again.";

export const LOG_OUT = "Log out";

/* ── 2.4 Delete account ───────────────────────────────────────────────────── */

export const DELETE_ACCOUNT = "Delete account";
export const DELETE_ROW_LINE = "Your account and everything in it";

export const BLOCKED_TITLE = "Cancel your plan first";
/** "Your Creator plan renews on 14 Dec and is billed by Whop. Deleting your account would not stop it." */
export function blockedBody(name: string | null, on: string | null): string {
  return `Your ${name ? `${name} ` : ""}plan renews ${on ? `on ${on} ` : ""}and is billed by Whop. Deleting your account would not stop it.`;
}
export const BLOCKED_NEXT = "Cancel it on Whop, then come back: a cancelled plan does not stop you deleting.";
export const CANCEL_ON_WHOP = "Cancel on Whop";

/** "Delete nia@example.com?"; with no email, "Delete your account?". */
export const deleteTitle = (email: string | null): string => (email ? `Delete ${email}?` : "Delete your account?");
export const DELETE_BODY =
  "Your chats, audiences, simulations, uploaded and saved videos and the creators you follow are deleted; your connected accounts are disconnected.";
/** "The 312 credits left are lost." */
export const creditsLost = (left: number): string => (left === 1 ? "The 1 credit left is lost." : `The ${count(left)} credits left are lost.`);
export const CANT_UNDO = "This can't be undone.";
/** What the confirm asks to be typed, case as typed. */
export const DELETE_WORD = "DELETE";
export const TYPE_DELETE = `Type ${DELETE_WORD}`;
export const DELETING = "Deleting…";
export const DELETE_WHOP_UNREACHABLE = "Couldn't check your plan with Whop. Try again in a minute.";
export const DELETE_FAILED = "Couldn't delete your account. Nothing was deleted. Try again.";

/* ── 2.5 Foot ─────────────────────────────────────────────────────────────── */

/** The licence credit for The Room's brain (CC BY 4.0 asks for it): `The brain in The Room: "Brain" by dgallichan, CC BY 4.0.` */
export const LICENCE = {
  lead: "The brain in The Room: ",
  work: { text: '"Brain"', href: "https://sketchfab.com/3d-models/brain-cadd2bde67404c43b2359a6a3281d84a" },
  by: " by ",
  author: { text: "dgallichan", href: "https://sketchfab.com/dgallichan" },
  under: ", ",
  licence: { text: "CC BY 4.0", href: "https://creativecommons.org/licenses/by/4.0/" },
  end: ".",
} as const;
