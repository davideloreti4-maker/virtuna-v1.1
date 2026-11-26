/**
 * What the Settings screen's tests share: a made-up account (`nia@example.com`), one view per plan
 * state of the spec's 2.1 table, the screen's props with spies for its handlers, and the window's width
 * (`matchMedia`, the one stand-in: a phone's bottom sheet or a desk's dialog).
 */
import { fireEvent } from "@testing-library/react";
import { vi } from "vitest";

import type { PlanView } from "@/lib/settings/plan-view";

import type { SettingsScreenProps } from "../settings-screen";

type Plan = Extract<PlanView, { kind: "plan" }>;

export const PAID: Plan = { kind: "plan", name: "Creator", price: "$49 a month", state: "renews", on: "14 Dec", credits: { left: 312, limit: 500, resetsOn: "14 Dec" } };
export const CANCELLED: Plan = { ...PAID, state: "cancelled" };
export const PAST_DUE: Plan = { ...PAID, state: "pastDue" };
export const IN_TRIAL: Plan = { ...PAID, state: "trial", on: "29 Nov", credits: { left: 30, limit: 50, resetsOn: "29 Nov" } };
export const STUDIO: Plan = { kind: "plan", name: "Studio", price: "$499 a month", state: "renews", on: "2 Dec", credits: "unlimited" };
export const NO_PLAN: PlanView = { kind: "none", trialAvailable: true };
export const NO_PLAN_TRIAL_USED: PlanView = { kind: "none", trialAvailable: false };

export const MANAGE_HREF = "https://whop.com/hub/memberships";

export const ready = (view: PlanView): SettingsScreenProps["plan"] => ({ state: "ready", view });

export function props(over: Partial<SettingsScreenProps> = {}): SettingsScreenProps {
  return {
    plan: ready(PAID),
    account: { email: "nia@example.com", google: false },
    theme: "light",
    onTheme: vi.fn(),
    onPassword: vi.fn(async () => "saved" as const),
    onLogOut: vi.fn(),
    onStartPlan: vi.fn(),
    onDelete: vi.fn(async () => "deleted" as const),
    onRecheckPlan: vi.fn(),
    manageHref: MANAGE_HREF,
    ...over,
  };
}

/** A promise the test settles by hand. */
export function later<T>() {
  let settle!: (value: T) => void;
  let fail!: (reason: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  return { promise, settle, fail };
}

/** A click as a pointer gives it: the control takes the focus first. */
export function press(el: HTMLElement) {
  el.focus();
  fireEvent.click(el);
}

export function widthIs(view: "phone" | "desk") {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: view === "desk" && /min-width:\s*768px/.test(query),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}
