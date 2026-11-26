/**
 * The Settings page's words (spec 2026-11-26-settings-design, 2.1, 2.4 and 5), against the real
 * `PLANS` and `TRIAL`: each sentence as the spec writes it, and each with its day left out.
 */
import { describe, expect, it } from "vitest";

import { PLANS } from "@/lib/pricing";
import type { PlanView } from "@/lib/settings/plan-view";

import {
  blockedBody,
  creditsLine,
  creditsLost,
  creditsNote,
  deleteTitle,
  emailLine,
  opensWhop,
  planCredits,
  planLine,
  startPlanLabel,
  startPlanLine,
} from "../settings-words";

type Plan = Extract<PlanView, { kind: "plan" }>;
const CREDITS = { left: 312, limit: 500, resetsOn: "14 Dec" };
const plan = (over: Partial<Plan> = {}): PlanView => ({ kind: "plan", name: "Creator", price: "$49 a month", state: "renews", on: "14 Dec", credits: CREDITS, ...over });
const [CREATOR, PRO, STUDIO] = PLANS as unknown as [(typeof PLANS)[number], (typeof PLANS)[number], (typeof PLANS)[number]];

describe("planLine: the line under the plan's name", () => {
  it.each<[string, PlanView, string]>([
    ["paid, renewing", plan(), "$49 a month · renews 14 Dec"],
    ["cancelled, still running", plan({ state: "cancelled" }), "Ends 14 Dec. Nothing more is billed."],
    ["payment failed", plan({ state: "pastDue" }), "Whop couldn't take the payment. Update your card there to keep your credits."],
    ["in the trial", plan({ state: "trial", on: "29 Nov" }), "$1 for 3 days. Becomes Creator, $49 a month, on 29 Nov unless you cancel."],
    ["Studio", plan({ name: "Studio", price: "$499 a month", on: "2 Dec", credits: "unlimited" }), "$499 a month · renews 2 Dec"],
    ["no plan, trial unused", { kind: "none", trialAvailable: true }, "Try any plan for $1: 50 credits over 3 days."],
    ["no plan, trial used", { kind: "none", trialAvailable: false }, "Plans from $49 a month."],
  ])("%s", (_state, view, line) => {
    expect(planLine(view)).toBe(line);
  });

  it.each<[string, PlanView, string]>([
    ["renewing", plan({ on: null }), "$49 a month"],
    ["cancelled", plan({ state: "cancelled", on: null }), "Nothing more is billed."],
    ["the trial", plan({ state: "trial", on: null }), "$1 for 3 days. Becomes Creator, $49 a month, unless you cancel."],
  ])("leaves a day it does not know out of the sentence: %s", (_state, view, line) => {
    expect(planLine(view)).toBe(line);
    expect(planLine(view)).not.toMatch(/null/);
  });
});

describe("the credits and what stands at their right", () => {
  it.each<[string, PlanView, string | null, string | null]>([
    ["renewing", plan(), "312 of 500 credits left", "Resets 14 Dec"],
    ["cancelled", plan({ state: "cancelled" }), "312 of 500 credits left", "Until 14 Dec"],
    ["payment failed", plan({ state: "pastDue" }), "312 of 500 credits left", "Resets 14 Dec"],
    ["the trial", plan({ state: "trial", on: "29 Nov", credits: { left: 30, limit: 50, resetsOn: "29 Nov" } }), "30 of 50 trial credits left", "Ends 29 Nov"],
    ["Studio", plan({ credits: "unlimited" }), "Unlimited credits", null],
    ["a plan whose credits were not read", plan({ credits: null }), null, null],
    ["no plan", { kind: "none", trialAvailable: true }, null, null],
  ])("%s", (_state, view, line, note) => {
    expect(creditsLine(view)).toBe(line);
    expect(creditsNote(view)).toBe(note);
  });

  it("writes thousands with a comma and never a count under zero", () => {
    expect(creditsLine(plan({ credits: { left: 1234, limit: 1500, resetsOn: null } }))).toBe("1,234 of 1,500 credits left");
    expect(creditsLine(plan({ credits: { left: -4, limit: 500, resetsOn: null } }))).toBe("0 of 500 credits left");
  });

  it("says no day it does not know", () => {
    expect(creditsNote(plan({ credits: { ...CREDITS, resetsOn: null } }))).toBeNull();
    expect(creditsNote(plan({ state: "cancelled", on: null }))).toBeNull();
    expect(creditsNote(plan({ state: "trial", on: null }))).toBeNull();
  });
});

describe("See plans", () => {
  it("names each plan's credits as PLANS has them", () => {
    expect(PLANS.map(planCredits)).toEqual(["500 credits a month", "1,500 credits a month", "Unlimited credits"]);
  });

  it("the button names the plan, and the dollar while the trial is unused", () => {
    expect(startPlanLabel(CREATOR, true)).toBe("Start Creator for $1");
    expect(startPlanLabel(PRO, true)).toBe("Start Pro for $1");
    expect(startPlanLabel(CREATOR, false)).toBe("Start Creator · $49 a month");
    expect(startPlanLabel(STUDIO, false)).toBe("Start Studio · $499 a month");
  });

  it("the line under it says what follows the trial, or how the plan is billed", () => {
    expect(startPlanLine(CREATOR, true)).toBe("50 credits over 3 days, then $49 a month. Cancel any time on Whop.");
    expect(startPlanLine(PRO, true)).toBe("50 credits over 3 days, then $99 a month. Cancel any time on Whop.");
    expect(startPlanLine(PRO, false)).toBe("Billed monthly by Whop. Cancel any time.");
  });
});

describe("Account and Delete", () => {
  it("names Google on the email of an account that signs in with it", () => {
    expect(emailLine("nia@example.com", false)).toBe("nia@example.com");
    expect(emailLine("nia@example.com", true)).toBe("nia@example.com · Google");
  });

  it("a link to Whop says it opens a new tab", () => {
    expect(opensWhop("Manage on Whop")).toBe("Manage on Whop, opens Whop in a new tab");
  });

  it("the blocked sheet names the plan and its day, and leaves out what it does not know", () => {
    expect(blockedBody("Creator", "14 Dec")).toBe("Your Creator plan renews on 14 Dec and is billed by Whop. Deleting your account would not stop it.");
    expect(blockedBody("Creator", null)).toBe("Your Creator plan renews and is billed by Whop. Deleting your account would not stop it.");
    expect(blockedBody(null, null)).toBe("Your plan renews and is billed by Whop. Deleting your account would not stop it.");
  });

  it("the confirm names the account, or the account without an email", () => {
    expect(deleteTitle("nia@example.com")).toBe("Delete nia@example.com?");
    expect(deleteTitle(null)).toBe("Delete your account?");
  });

  it("says the credits that are lost", () => {
    expect(creditsLost(312)).toBe("The 312 credits left are lost.");
    expect(creditsLost(1500)).toBe("The 1,500 credits left are lost.");
    expect(creditsLost(1)).toBe("The 1 credit left is lost.");
  });
});
