/**
 * The plan card's one view (spec 2026-11-26-settings, 2.1 and 2.6): every row of the 2.1 table, from
 * the stored subscription and the live Whop read. Pure: no stand-ins.
 */
import { describe, expect, it } from "vitest";
import { canDelete, planViewOf, type LiveInput, type PlanView, type SubscriptionInput } from "../plan-view";
import type { LiveMembership } from "@/lib/whop/membership";

const NOW = new Date("2026-11-26T12:00:00.000Z");

function sub(over: Partial<SubscriptionInput> = {}): SubscriptionInput {
  return {
    tier: "starter",
    status: "active",
    isTrial: false,
    trialEndsAt: null,
    trialUsed: true,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: "2026-12-14T10:00:00.000Z",
    usage: { limit: 500, remaining: 312, renewsAt: "2026-12-14T10:00:00.000Z" },
    ...over,
  };
}

function live(over: Partial<LiveMembership> = {}): LiveInput {
  return { membership: { status: "active", cancelAtPeriodEnd: false, renewsAt: "2026-12-14T10:00:00.000Z", ...over } };
}

describe("planViewOf", () => {
  it("paid, renewing: Creator, $49 a month, renews on the period's end, credits with their reset", () => {
    expect(planViewOf(sub(), live(), NOW)).toEqual<PlanView>({
      kind: "plan",
      name: "Creator",
      price: "$49 a month",
      state: "renews",
      on: "14 Dec",
      credits: { left: 312, limit: 500, resetsOn: "14 Dec" },
    });
  });

  it("the live renewal day wins over the stored one", () => {
    const view = planViewOf(sub({ currentPeriodEnd: "2026-12-01T00:00:00.000Z" }), live({ renewsAt: "2026-12-14T10:00:00.000Z" }), NOW);
    expect(view.kind === "plan" && view.on).toBe("14 Dec");
  });

  it("the live renewal day missing: the stored one", () => {
    const view = planViewOf(sub({ currentPeriodEnd: "2026-12-02T00:00:00.000Z" }), live({ renewsAt: null }), NOW);
    expect(view.kind === "plan" && view.on).toBe("2 Dec");
  });

  it("cancelled, still running, from the live read (the stored flag says it renews)", () => {
    const view = planViewOf(sub({ cancelAtPeriodEnd: false }), live({ cancelAtPeriodEnd: true }), NOW);
    expect(view).toMatchObject({ kind: "plan", name: "Creator", state: "cancelled", on: "14 Dec" });
  });

  it("the live read says it renews: not cancelled, though the stored flag says so", () => {
    const view = planViewOf(sub({ cancelAtPeriodEnd: true }), live({ cancelAtPeriodEnd: false }), NOW);
    expect(view).toMatchObject({ state: "renews" });
  });

  it("cancelled, still running, from the stored flag when Whop was not asked yet", () => {
    expect(planViewOf(sub({ cancelAtPeriodEnd: true }), null, NOW)).toMatchObject({ state: "cancelled", on: "14 Dec" });
  });

  it("cancelled from the stored flag when Whop has no membership", () => {
    expect(planViewOf(sub({ cancelAtPeriodEnd: true }), { membership: null }, NOW)).toMatchObject({ state: "cancelled" });
  });

  it("past due from the live read", () => {
    expect(planViewOf(sub({ status: "active" }), live({ status: "past_due" }), NOW)).toMatchObject({ state: "pastDue" });
  });

  it("past due from the stored status", () => {
    expect(planViewOf(sub({ status: "past_due" }), null, NOW)).toMatchObject({ state: "pastDue" });
  });

  it("past due outranks cancelled", () => {
    expect(planViewOf(sub(), live({ status: "past_due", cancelAtPeriodEnd: true }), NOW)).toMatchObject({ state: "pastDue" });
  });

  it("in the $1 trial: trial, on the trial's end, the trial's credits", () => {
    const view = planViewOf(
      sub({
        isTrial: true,
        trialEndsAt: "2026-11-29T08:00:00.000Z",
        trialUsed: true,
        usage: { limit: 50, remaining: 30, renewsAt: "2026-11-29T08:00:00.000Z" },
      }),
      live({ status: "trialing", renewsAt: "2026-11-29T08:00:00.000Z" }),
      NOW,
    );
    expect(view).toEqual<PlanView>({
      kind: "plan",
      name: "Creator",
      price: "$49 a month",
      state: "trial",
      on: "29 Nov",
      credits: { left: 30, limit: 50, resetsOn: "29 Nov" },
    });
  });

  it("a trial cancelled: cancelled, on the period's end", () => {
    const view = planViewOf(
      sub({ isTrial: true, trialEndsAt: "2026-11-29T08:00:00.000Z", currentPeriodEnd: "2026-11-29T08:00:00.000Z" }),
      live({ status: "trialing", cancelAtPeriodEnd: true, renewsAt: "2026-11-30T08:00:00.000Z" }),
      NOW,
    );
    expect(view).toMatchObject({ state: "cancelled", on: "30 Nov" });
  });

  it("a trial on tier free (should not happen): no plan to name, so none", () => {
    expect(planViewOf(sub({ tier: "free", isTrial: true }), null, NOW)).toEqual<PlanView>({ kind: "none", trialAvailable: false });
  });

  it("Studio: unlimited credits, $499 a month", () => {
    const view = planViewOf(
      sub({ tier: "studio", currentPeriodEnd: "2026-12-02T00:00:00.000Z", usage: { limit: null, remaining: null, renewsAt: null } }),
      live({ renewsAt: "2026-12-02T00:00:00.000Z" }),
      NOW,
    );
    expect(view).toEqual<PlanView>({ kind: "plan", name: "Studio", price: "$499 a month", state: "renews", on: "2 Dec", credits: "unlimited" });
  });

  it("Pro: its name and price", () => {
    expect(planViewOf(sub({ tier: "pro" }), null, NOW)).toMatchObject({ name: "Pro", price: "$99 a month" });
  });

  it("no usage read: no credits", () => {
    expect(planViewOf(sub({ usage: null }), null, NOW)).toMatchObject({ credits: null });
  });

  it("usage with no remaining count: 0 left", () => {
    expect(planViewOf(sub({ usage: { limit: 500, remaining: null, renewsAt: null } }), null, NOW)).toMatchObject({
      credits: { left: 0, limit: 500, resetsOn: null },
    });
  });

  it("no plan, trial unused", () => {
    expect(planViewOf(sub({ tier: "free", trialUsed: false, usage: null }), null, NOW)).toEqual<PlanView>({ kind: "none", trialAvailable: true });
  });

  it("no plan, trial used", () => {
    expect(planViewOf(sub({ tier: "free", trialUsed: true }), null, NOW)).toEqual<PlanView>({ kind: "none", trialAvailable: false });
  });

  it("no plan never reads the status (an account with no row says active)", () => {
    expect(planViewOf(sub({ tier: "free", status: "active", trialUsed: false }), live(), NOW)).toEqual<PlanView>({
      kind: "none",
      trialAvailable: true,
    });
    expect(planViewOf(sub({ tier: "free", status: "past_due", trialUsed: false }), null, NOW)).toMatchObject({ kind: "none" });
  });

  it("Whop could not be asked: the stored values", () => {
    const unknown: LiveInput = { unknown: true };
    expect(planViewOf(sub(), unknown, NOW)).toMatchObject({ state: "renews", on: "14 Dec" });
    expect(planViewOf(sub({ cancelAtPeriodEnd: true }), unknown, NOW)).toMatchObject({ state: "cancelled" });
    expect(planViewOf(sub({ status: "past_due" }), unknown, NOW)).toMatchObject({ state: "pastDue" });
  });

  it("no day known: on is null", () => {
    expect(planViewOf(sub({ currentPeriodEnd: null }), null, NOW)).toMatchObject({ on: null });
    expect(planViewOf(sub({ isTrial: true, trialEndsAt: null }), null, NOW)).toMatchObject({ state: "trial", on: null });
  });

  it("a day in another year carries the year", () => {
    const view = planViewOf(
      sub({ currentPeriodEnd: "2027-01-03T00:00:00.000Z", usage: { limit: 500, remaining: 10, renewsAt: "2027-01-03T00:00:00.000Z" } }),
      null,
      NOW,
    );
    expect(view).toMatchObject({ on: "3 Jan 2027", credits: { left: 10, limit: 500, resetsOn: "3 Jan 2027" } });
  });
});

describe("canDelete", () => {
  const base = { kind: "plan", name: "Creator", price: "$49 a month", on: "14 Dec", credits: null } as const;

  it("no plan: yes", () => {
    expect(canDelete({ kind: "none", trialAvailable: true })).toBe(true);
    expect(canDelete({ kind: "none", trialAvailable: false })).toBe(true);
  });

  it("a cancelled plan: yes", () => {
    expect(canDelete({ ...base, state: "cancelled" })).toBe(true);
  });

  it("a plan that will bill again: no", () => {
    expect(canDelete({ ...base, state: "renews" })).toBe(false);
    expect(canDelete({ ...base, state: "trial" })).toBe(false);
    expect(canDelete({ ...base, state: "pastDue" })).toBe(false);
  });

  it("from planViewOf", () => {
    expect(canDelete(planViewOf(sub(), live({ cancelAtPeriodEnd: true }), NOW))).toBe(true);
    expect(canDelete(planViewOf(sub(), live(), NOW))).toBe(false);
  });
});
