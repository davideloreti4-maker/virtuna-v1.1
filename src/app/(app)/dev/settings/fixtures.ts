/**
 * /dev/settings' made-up account and plans. Every day is a fixed word ("14 Dec"), not a date read
 * against today's clock, so each state reads the same every day. Names and prices come from `PLANS`,
 * as `planViewOf` writes them. No real ids.
 */
import { getPlan, type PaidPlanId } from "@/lib/pricing";
import type { PlanView } from "@/lib/settings/plan-view";

type Plan = Extract<PlanView, { kind: "plan" }>;

export const DEV_EMAIL = "nia@example.com";

const planOf = (id: PaidPlanId) => {
  const plan = getPlan(id);
  return { kind: "plan" as const, name: plan.name, price: `${plan.price} a month` };
};

/** Creator, renewing 14 Dec, 312 of 500 credits left. */
export const PAID: Plan = { ...planOf("starter"), state: "renews", on: "14 Dec", credits: { left: 312, limit: 500, resetsOn: "14 Dec" } };
export const CANCELLED: Plan = { ...PAID, state: "cancelled" };
export const PAST_DUE: Plan = { ...PAID, state: "pastDue" };
/** The $1 trial of Creator: 30 of 50 trial credits, it becomes the plan on 29 Nov. */
export const IN_TRIAL: Plan = { ...PAID, state: "trial", on: "29 Nov", credits: { left: 30, limit: 50, resetsOn: "29 Nov" } };
export const STUDIO: Plan = { ...planOf("studio"), state: "renews", on: "2 Dec", credits: "unlimited" };
export const NO_PLAN: PlanView = { kind: "none", trialAvailable: true };
export const NO_PLAN_TRIAL_USED: PlanView = { kind: "none", trialAvailable: false };
