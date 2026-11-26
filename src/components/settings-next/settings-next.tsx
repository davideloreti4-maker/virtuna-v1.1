"use client";

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { CheckoutModal } from "@/components/app/checkout-modal";
import { Card } from "@/components/ui/card";
import { useChangePassword } from "@/hooks/queries/use-profile";
import { useSubscription } from "@/hooks/use-subscription";
import type { PaidPlanId } from "@/lib/pricing";
import { planViewOf, type LiveInput } from "@/lib/settings/plan-view";
import { createClient } from "@/lib/supabase/client";
import { useThemeChoice } from "@/lib/theme/use-theme";

import { SettingsScreen, type DeleteResult, type PasswordResult, type PlanRead } from "./settings-screen";
import { MANAGE_HREF, PASSWORD_FAILED, PASSWORD_MIN, PASSWORD_TOO_SHORT } from "./settings-words";

/**
 * Settings under the new look with its data and handlers (spec
 * docs/superpowers/specs/2026-11-26-settings-design.md, 2.4, 2.6 and 5). `SettingsScreen` draws; this
 * reads and sends.
 *
 * - The plan: the stored subscription (`useSubscription`, `GET /api/subscription`) and the live Whop
 *   read (`GET /api/settings/plan-state`), as one view (`planViewOf`). The card is ready once the
 *   stored plan is read; the live read refines it when it lands (a failed one counts as unknown, and
 *   the stored plan stands). Both are read again when the delete sheet asks, after a refusal because
 *   a plan renews, and after a checkout.
 * - The account: the signed-in user's email and whether it signs in with Google, read once. Until
 *   then the page's outline stands, so neither the email row nor the delete sheet's title changes
 *   under the reader.
 * - Log out: the sign-out alone; the AuthGuard's listener owns the way to /login.
 * - Deleted: sign out, then always leave for `/login?deleted=1`, even when the sign-out throws.
 */
type Account = { email: string | null; google: boolean };

/** A save the server refused for the length rule says so; anything else is the plain failure. */
const TOO_SHORT = new RegExp(`\\b${PASSWORD_MIN} characters\\b`, "i");

async function readLive(): Promise<LiveInput> {
  try {
    const res = await fetch("/api/settings/plan-state");
    if (!res.ok) return { unknown: true };
    return (await res.json()) as LiveInput;
  } catch {
    return { unknown: true };
  }
}

async function sendDelete(): Promise<Response | null> {
  try {
    return await fetch("/api/settings/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    });
  } catch {
    return null;
  }
}

export function SettingsNext(): React.JSX.Element {
  const subscription = useSubscription();
  const { refetch } = subscription;
  const changePassword = useChangePassword();
  const [theme, setTheme] = useThemeChoice();

  const [account, setAccount] = useState<Account | null>(null);
  const [live, setLive] = useState<LiveInput>(null);
  const [retrying, setRetrying] = useState(false);
  const [checkout, setCheckout] = useState<{ planId: PaidPlanId; trial: boolean } | null>(null);

  // Only the newest live read is kept: an older answer that lands late is dropped.
  const liveSeq = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const readLiveNow = useCallback(async () => {
    const seq = ++liveSeq.current;
    const next = await readLive();
    if (mounted.current && seq === liveSeq.current) setLive(next);
  }, []);

  /** Both reads again. The card keeps what it shows meanwhile (an open sheet keeps its face). */
  const recheck = useCallback(() => Promise.all([refetch(), readLiveNow()]), [refetch, readLiveNow]);
  // Stable: the delete sheet listens for the page being shown again with it.
  const onRecheckPlan = useCallback(() => void recheck(), [recheck]);

  useEffect(() => {
    void readLiveNow();
  }, [readLiveNow]);

  useEffect(() => {
    let active = true;
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        const user = data.user;
        const providers: unknown = user?.app_metadata?.providers;
        return { email: user?.email ?? null, google: Array.isArray(providers) && providers.includes("google") };
      })
      .catch(() => ({ email: null, google: false }))
      .then((read) => {
        if (active) setAccount(read);
      });
    return () => {
      active = false;
    };
  }, []);

  const retry = () => {
    setRetrying(true);
    void recheck().finally(() => {
      if (mounted.current) setRetrying(false);
    });
  };

  let plan: PlanRead;
  if (subscription.isLoading || retrying) plan = { state: "loading" };
  else if (subscription.error) plan = { state: "error", onRetry: retry };
  else plan = { state: "ready", view: planViewOf(subscription, live, new Date()) };

  const onPassword = async (password: string): Promise<PasswordResult> => {
    try {
      await changePassword.mutateAsync(password);
      return "saved";
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      return { error: TOO_SHORT.test(message) ? PASSWORD_TOO_SHORT : PASSWORD_FAILED };
    }
  };

  const onDelete = async (): Promise<DeleteResult> => {
    const res = await sendDelete();
    if (res?.ok) {
      try {
        await createClient().auth.signOut();
      } catch {
        // The account is gone either way; leaving is what matters.
      } finally {
        window.location.assign("/login?deleted=1");
      }
      return "deleted";
    }
    if (res?.status === 503) return "whop_unreachable";
    if (res?.status === 409) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (body?.error === "plan_renews") {
        void recheck();
        return "plan_renews";
      }
    }
    return "failed";
  };

  if (account === null) return <SettingsNextLoading />;

  return (
    <>
      <SettingsScreen
        plan={plan}
        account={account}
        theme={theme}
        onTheme={setTheme}
        onPassword={onPassword}
        onLogOut={() => {
          void createClient().auth.signOut();
        }}
        onStartPlan={(planId, trial) => setCheckout({ planId, trial })}
        onDelete={onDelete}
        onRecheckPlan={onRecheckPlan}
        manageHref={MANAGE_HREF}
      />
      {checkout && (
        <CheckoutModal
          open
          planId={checkout.planId}
          trial={checkout.trial}
          onClose={() => setCheckout(null)}
          onComplete={() => void recheck()}
        />
      )}
    </>
  );
}

/**
 * The page's outline while it loads (the route's `loading.tsx` under the flag, and the page until the
 * account is read): the 720 column with the Plan card, Appearance and Account, quiet and busy.
 */
export function SettingsNextLoading(): React.JSX.Element {
  return (
    <div data-testid="settings-next-loading" aria-busy="true" className="flex w-full flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-[720px] flex-col px-4 pb-12 pt-1 md:pb-16 md:pt-11">
        {/* The heading (from 768), each section's label, then the card it labels: the screen's heights. */}
        <div className="hidden h-[43px] md:block" />
        <div className="h-[38px]" />
        <Card className="h-[152px]" />
        <Card className="mt-[18px] h-[72px]" />
        <div className="h-[46px]" />
        <Card className="h-[200px]" />
      </div>
    </div>
  );
}
