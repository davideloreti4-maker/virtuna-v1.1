/**
 * The plan card's one view (spec docs/superpowers/specs/2026-11-26-settings-design.md, 2.1 and 2.6): the
 * stored subscription (`GET /api/subscription`) plus the live Whop read (`GET /api/settings/plan-state`).
 *
 * Pure: no React, no clock (`now` is given). "No plan" is `tier === "free"` and not in a trial; the
 * `status` field is never read for it (it says "active" for an account with no row).
 */
import { readOn } from "@/lib/audience-next/audience-words";
import { PLANS } from "@/lib/pricing";
import type { NumenTier } from "@/lib/whop/config";
import type { LiveMembership } from "@/lib/whop/membership";
import { isEndedStatus } from "@/lib/whop/membership-status";

export interface SubscriptionInput {
  tier: NumenTier;
  status: string;
  isTrial: boolean;
  trialEndsAt: string | null;
  trialUsed: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  usage: { limit: number | null; remaining: number | null; renewsAt: string | null } | null;
}

/** The live Whop read; null = not asked yet. */
export type LiveInput = { membership: LiveMembership | null } | { unknown: true } | null;

export type PlanState = "renews" | "cancelled" | "pastDue" | "trial";

export type PlanCredits = { left: number; limit: number; resetsOn: string | null } | "unlimited" | null;

export type PlanView =
  | { kind: "none"; trialAvailable: boolean }
  | { kind: "plan"; name: string; price: string; state: PlanState; on: string | null; credits: PlanCredits };

/** "14 Dec"; in another year than `now`'s "14 Dec 2027"; null for no day or a bad one. */
function day(iso: string | null | undefined, now: Date): string | null {
  return readOn(iso, now)?.replace(/^read /, "") ?? null;
}

export function planViewOf(sub: SubscriptionInput, live: LiveInput, now: Date): PlanView {
  const none: PlanView = { kind: "none", trialAvailable: !sub.trialUsed };
  if (sub.tier === "free" && !sub.isTrial) return none;
  const plan = PLANS.find((p) => p.id === sub.tier);
  if (!plan) return none;

  const membership = live && "membership" in live ? live.membership : null;
  // A live ended status (canceled, expired, completed) decides, whatever tier the row still stores.
  const cancelled = membership ? isEndedStatus(membership.status) || membership.cancelAtPeriodEnd : sub.cancelAtPeriodEnd;
  // Past due but cancelled at the period's end will not bill again: cancelled, as the delete check says.
  const pastDue = !cancelled && (membership ? membership.status === "past_due" : sub.status === "past_due");

  const state: PlanState = pastDue ? "pastDue" : cancelled ? "cancelled" : sub.isTrial ? "trial" : "renews";
  const on = sub.isTrial && !cancelled ? day(sub.trialEndsAt, now) : day(membership?.renewsAt ?? sub.currentPeriodEnd, now);

  const usage = sub.usage;
  const credits: PlanCredits =
    usage === null
      ? null
      : usage.limit === null
        ? "unlimited"
        : { left: usage.remaining ?? 0, limit: usage.limit, resetsOn: day(usage.renewsAt, now) };

  return { kind: "plan", name: plan.name, price: `${plan.price} a month`, state, on, credits };
}

/** Delete may be offered: no plan, or a plan that will not bill again. */
export function canDelete(view: PlanView): boolean {
  return view.kind === "none" || view.state === "cancelled";
}
