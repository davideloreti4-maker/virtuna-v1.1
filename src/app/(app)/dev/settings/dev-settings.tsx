"use client";

import { useEffect, useRef, useState } from "react";

import { SettingsScreen, type DeleteResult, type PasswordResult, type PlanRead } from "@/components/settings-next/settings-screen";
import { DELETE_ACCOUNT, MANAGE_HREF, PASSWORD_FAILED } from "@/components/settings-next/settings-words";
import type { PlanView } from "@/lib/settings/plan-view";
import { useThemeChoice } from "@/lib/theme/use-theme";

import { CANCELLED, DEV_EMAIL, IN_TRIAL, NO_PLAN, NO_PLAN_TRIAL_USED, PAID, PAST_DUE, STUDIO } from "./fixtures";

/**
 * Settings on fixtures and local handlers, for /dev/settings (`page.tsx`). Nothing is sent: a password
 * saves after 400 ms (one with "fail" in it is refused, with the screen's words); See plans' start,
 * Log out and Manage on Whop go nowhere; the delete answers per state after 400 ms. The theme is the
 * real choice (the page is looked at in light and dark).
 */
export type DevSettingsState =
  | "paid"
  | "none"
  | "none-used"
  | "trial"
  | "cancelled"
  | "pastdue"
  | "studio"
  | "google"
  | "noemail"
  | "loading"
  | "error"
  | "delete-blocked"
  | "delete-confirm"
  | "delete-failed"
  | "delete-whop";

const VIEW: Partial<Record<DevSettingsState, PlanView>> = {
  none: NO_PLAN,
  "none-used": NO_PLAN_TRIAL_USED,
  trial: IN_TRIAL,
  cancelled: CANCELLED,
  pastdue: PAST_DUE,
  studio: STUDIO,
  // The confirm's states: a plan that will not bill again, with credits left to lose.
  "delete-confirm": CANCELLED,
  "delete-failed": CANCELLED,
  "delete-whop": CANCELLED,
};

/** What the delete answers; elsewhere it never answers, holding "Deleting…" (a real page would leave). */
const DELETE_ANSWER: Partial<Record<DevSettingsState, DeleteResult>> = {
  "delete-failed": "failed",
  "delete-whop": "whop_unreachable",
};

const wait = <T,>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 400));
const never = () => new Promise<never>(() => {});
const nothing = () => {};

export function DevSettings({ state }: { state: DevSettingsState }) {
  const [theme, setTheme] = useThemeChoice();
  const view = VIEW[state] ?? PAID;
  const [read, setRead] = useState<PlanRead["state"]>(state === "loading" || state === "error" ? state : "ready");
  // Try again: the card loads, then the plan is read.
  const retry = () => {
    setRead("loading");
    void wait(null).then(() => setRead("ready"));
  };
  const plan: PlanRead = read === "ready" ? { state: "ready", view } : read === "error" ? { state: "error", onRetry: retry } : { state: "loading" };

  // The delete states open on the sheet, as if its row was pressed.
  const page = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!state.startsWith("delete-")) return;
    const row = [...(page.current?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.startsWith(DELETE_ACCOUNT));
    row?.click();
  }, [state]);

  const onPassword = (password: string): Promise<PasswordResult> => wait(password.includes("fail") ? { error: PASSWORD_FAILED } : "saved");
  const onDelete = (): Promise<DeleteResult> => {
    const answer = DELETE_ANSWER[state];
    return answer ? wait(answer) : never();
  };

  return (
    <div ref={page} className="contents">
      <SettingsScreen
        plan={plan}
        account={{ email: state === "noemail" ? null : DEV_EMAIL, google: state === "google" }}
        theme={theme}
        onTheme={setTheme}
        onPassword={onPassword}
        onLogOut={nothing}
        onStartPlan={nothing}
        onDelete={onDelete}
        onRecheckPlan={nothing}
        manageHref={MANAGE_HREF}
      />
    </div>
  );
}
