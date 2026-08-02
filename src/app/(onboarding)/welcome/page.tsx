"use client";

/**
 * /welcome — the first authenticated screen a new account sees.
 *
 * TWO steps, and the second one is the point:
 *
 *   1. connect    — ConnectStep collects EITHER an @handle or a written description,
 *                   and creates the draft audience row.
 *   2. calibrate  — CalibrationFlow runs the real pipeline against that draft, inline.
 *
 * Why the wait lives here, blocking, instead of in the background (owner call, 2026-08-02):
 * calibration is a measured ~128s, but it is not a blank one. The spine draws calibration's three
 * real phases and, seconds in, the creator's own avatar, follower count and video covers — their
 * material, on screen, roughly two minutes before the audience it produces. Deferring it would buy
 * an instant entry and hand them a product whose every card reads "Not tested yet", which is
 * exactly the disconnect this flow exists to close.
 *
 * ⚠️ The calibrate stage is LOCAL state, deliberately not persisted to `creator_profiles.
 * onboarding_step`. Restoring into it on reload would remount CalibrationFlow with autoStart and
 * fire a SECOND Apify scrape against a metered account. A reload mid-run returns to step 1.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Audience } from "@/lib/audience/audience-types";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { ConnectStep } from "@/components/onboarding/connect-step";
import { CalibrationFlow } from "@/components/audience/calibration-flow";
import { cn } from "@/lib/utils";

/** The two real steps. The indicator counts these — it is progress, not decoration. */
const STEPS = ["connect", "calibrate"] as const;
type Stage = (typeof STEPS)[number];

export default function WelcomePage() {
  const router = useRouter();
  const store = useOnboardingStore();
  const { step, _isHydrated, _hydrate } = store;

  // Local — see the header note on why this is not persisted.
  const [stage, setStage] = useState<Stage>("connect");
  const [draft, setDraft] = useState<Audience | null>(null);
  const [prefill, setPrefill] = useState<{ handle?: string; description?: string }>({});

  // Hydrate store on mount
  useEffect(() => {
    if (!_isHydrated) {
      _hydrate();
    }
  }, [_isHydrated, _hydrate]);

  // CR-05: Ensure user is authenticated, hydrate from Supabase, and only
  // insert the creator_profiles row if it is genuinely missing. An unmount
  // guard prevents store writes against a now-unmounted consumer if the
  // user navigates away mid-effect. We deliberately read first, then insert
  // only on miss — the previous `upsert(..., { ignoreDuplicates: true })`
  // was a no-op on every existing-row mount but still ate a network round
  // trip on each visit.
  //
  // WR-02: log a warning when `dbStep` is neither "connect" nor "completed"
  // so any stale value left behind by a legacy/in-flight writer is
  // observable rather than silently coerced.
  useEffect(() => {
    if (!_isHydrated) return;
    let unmounted = false;

    async function initOnboarding() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (unmounted) return;

      if (!user) {
        router.replace("/");
        return;
      }

      // Read first — avoid the round-trip + write on every mount for users
      // whose row already exists.
      const { data: profile } = await supabase
        .from("creator_profiles")
        .select("onboarding_step, onboarding_completed_at, tiktok_handle")
        .eq("user_id", user.id)
        .maybeSingle();
      if (unmounted) return;

      if (profile?.onboarding_completed_at) {
        router.replace("/home");
        return;
      }

      if (!profile) {
        // First-time visitor — create the bootstrap row.
        await supabase
          .from("creator_profiles")
          .insert({ user_id: user.id, onboarding_step: "connect" });
        if (unmounted) return;
        return;
      }

      // Restore state from DB if available — defense-in-depth: any DB value
      // outside the narrowed "connect" | "completed" union coerces back to
      // "connect" so the store cannot enter an unrepresentable state even if
      // a legacy row escaped the migration UPDATE in Plan 02-01.
      const dbStep = profile.onboarding_step as string | null;
      if (dbStep && dbStep !== store.step) {
        if (dbStep === "connect" || dbStep === "completed") {
          store.setStep(dbStep);
        } else {
          console.warn(
            "[welcome] coercing unknown onboarding_step to 'connect':",
            dbStep
          );
          store.setStep("connect");
        }
      }
      if (profile.tiktok_handle && !store.tiktokHandle) {
        store.setTiktokHandle(profile.tiktok_handle);
      }
    }

    void initOnboarding();
    return () => {
      unmounted = true;
    };
  }, [_isHydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect into the app when onboarding completes. /dashboard was sunset (D-25) and
  // middleware 308s it to /home — going there directly saves every new account a pointless
  // extra hop on its first navigation.
  useEffect(() => {
    if (_isHydrated && step === "completed") {
      router.replace("/home");
    }
  }, [step, _isHydrated, router]);

  /**
   * Every exit from calibration ends onboarding — success, thin-data fallback, or a failed
   * scrape. Completing on failure is deliberate: middleware bounces any authenticated user
   * without `onboarding_completed_at` back to /welcome, so NOT stamping it here would trap a
   * user whose account is private or whose scrape failed in a loop they cannot leave.
   * `completeOnboarding` also persists the handle we collected in step 1.
   */
  async function finishOnboarding() {
    await store.completeOnboarding();
  }

  const isCalibrating = stage === "calibrate" && draft !== null;

  if (!_isHydrated || step === "completed") {
    return (
      <div
        className="w-full max-w-[400px] rounded-[12px] border border-white/[0.06] px-8 py-10"
        style={{ backgroundColor: "var(--color-charcoal-chip)" }}
      >
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s) => (
            <div key={s} className="h-1.5 w-8 rounded-full bg-white/[0.1]" />
          ))}
        </div>
        <div className="space-y-4 animate-pulse">
          <div className="h-6 w-48 mx-auto rounded bg-white/[0.05]" />
          <div className="h-4 w-64 mx-auto rounded bg-white/[0.05]" />
          <div className="h-[42px] w-full rounded-[8px] bg-white/[0.05]" />
          <div className="h-11 w-full rounded-lg bg-white/[0.05]" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full rounded-[12px] border border-white/[0.06] px-8 py-10 transition-[max-width] duration-300",
        // The calibration stage carries an avatar row, a three-row spine and a cover grid —
        // it needs more room than a single input does.
        isCalibrating ? "max-w-[560px]" : "max-w-[400px]"
      )}
      style={{ backgroundColor: "var(--color-charcoal-chip)" }}
    >
      {/* Step indicator — two REAL steps now, so it measures something. */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {STEPS.map((s, i) => {
          const reached = i <= STEPS.indexOf(stage);
          return (
            <div
              key={s}
              className={cn(
                "h-1.5 w-8 rounded-full transition-colors",
                reached ? "bg-action" : "bg-white/[0.1]"
              )}
            />
          );
        })}
      </div>

      <div className="min-h-[320px]">
        {isCalibrating && draft ? (
          <CalibrationFlow
            audience={draft}
            autoStart
            prefillHandle={prefill.handle}
            prefillDescription={prefill.description}
            prefillPlatform={draft.platform}
            onDone={() => void finishOnboarding()}
            onSkip={() => void finishOnboarding()}
          />
        ) : (
          <ConnectStep
            onDraftReady={(created, p) => {
              setDraft(created);
              setPrefill(p);
              setStage("calibrate");
            }}
          />
        )}
      </div>
    </div>
  );
}
