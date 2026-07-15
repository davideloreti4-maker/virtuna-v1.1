"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { ConnectStep } from "@/components/onboarding/connect-step";

const STEPS = ["connect"] as const;

export default function WelcomePage() {
  const router = useRouter();
  const store = useOnboardingStore();
  const { step, _isHydrated, _hydrate } = store;

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
        router.replace("/start");
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

  // Redirect to the briefing (home) when onboarding completes
  useEffect(() => {
    if (_isHydrated && step === "completed") {
      router.replace("/start");
    }
  }, [step, _isHydrated, router]);

  if (!_isHydrated || step === "completed") {
    return (
      <div
        className="w-full max-w-[400px] rounded-[12px] border border-white/[0.06] px-8 py-10"
        style={{
          backgroundColor: "var(--color-charcoal-chip)",
          boxShadow: "rgba(255,255,255,0.05) 0 1px 0 0 inset",
        }}
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
      className="w-full max-w-[400px] rounded-[12px] border border-white/[0.06] px-8 py-10"
      style={{
        backgroundColor: "var(--color-charcoal-chip)",
        boxShadow: "rgba(255,255,255,0.05) 0 1px 0 0 inset",
      }}
    >
      {/* Step indicator (single-step now, kept for visual symmetry with prior flow) */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {STEPS.map((s) => (
          <div
            key={s}
            className="h-1.5 w-8 rounded-full bg-action transition-colors"
          />
        ))}
      </div>

      <div className="min-h-[320px]">
        {step === "connect" && <ConnectStep />}
      </div>
    </div>
  );
}
