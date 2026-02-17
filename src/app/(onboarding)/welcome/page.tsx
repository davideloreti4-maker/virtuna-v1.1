"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { ConnectStep } from "@/components/onboarding/connect-step";
import { GoalStep } from "@/components/onboarding/goal-step";
import { PreviewStep } from "@/components/onboarding/preview-step";
import { cn } from "@/lib/utils";

const STEPS = ["connect", "goal", "preview"] as const;

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

  // Ensure user is authenticated, then hydrate from Supabase
  useEffect(() => {
    if (!_isHydrated) return;

    async function initOnboarding() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/");
        return;
      }

      // Ensure creator_profiles row exists
      await supabase.from("creator_profiles").upsert(
        { user_id: user.id, onboarding_step: "connect" },
        { onConflict: "user_id", ignoreDuplicates: true }
      );

      // Fetch existing onboarding state
      const { data: profile } = await supabase
        .from("creator_profiles")
        .select("onboarding_step, onboarding_completed_at, tiktok_handle, primary_goal")
        .eq("user_id", user.id)
        .single();

      if (profile?.onboarding_completed_at) {
        router.replace("/dashboard");
        return;
      }

      // Restore state from DB if available
      if (profile) {
        const dbStep = profile.onboarding_step as typeof step;
        if (dbStep && dbStep !== store.step) {
          store.setStep(dbStep);
        }
        if (profile.tiktok_handle && !store.tiktokHandle) {
          store.setTiktokHandle(profile.tiktok_handle);
        }
        if (profile.primary_goal && !store.primaryGoal) {
          store.setPrimaryGoal(profile.primary_goal as "monetization" | "viral_content" | "affiliate_revenue");
        }
      }
    }

    initOnboarding();
  }, [_isHydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect to dashboard when onboarding completes
  useEffect(() => {
    if (_isHydrated && step === "completed") {
      router.replace("/dashboard");
    }
  }, [step, _isHydrated, router]);

  if (!_isHydrated || step === "completed") {
    return (
      <div
        className="w-full max-w-[400px] rounded-[12px] border border-white/[0.06] px-8 py-10"
        style={{
          backgroundImage:
            "linear-gradient(137deg, rgba(17, 18, 20, 0.75) 4.87%, rgba(12, 13, 15, 0.9) 75.88%)",
          backdropFilter: "blur(5px)",
          WebkitBackdropFilter: "blur(5px)",
          boxShadow: "rgba(255,255,255,0.15) 0px 1px 1px 0px inset",
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

  const currentStepIndex = STEPS.indexOf(step as (typeof STEPS)[number]);

  return (
    <div
      className="w-full max-w-[400px] rounded-[12px] border border-white/[0.06] px-8 py-10"
      style={{
        backgroundImage:
          "linear-gradient(137deg, rgba(17, 18, 20, 0.75) 4.87%, rgba(12, 13, 15, 0.9) 75.88%)",
        backdropFilter: "blur(5px)",
        WebkitBackdropFilter: "blur(5px)",
        boxShadow: "rgba(255,255,255,0.15) 0px 1px 1px 0px inset",
      }}
    >
      {/* Step indicator */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={cn(
              "h-1.5 w-8 rounded-full transition-colors",
              i <= currentStepIndex ? "bg-accent" : "bg-white/[0.1]"
            )}
          />
        ))}
      </div>

      <div className="min-h-[320px]">
        {step === "connect" && <ConnectStep />}
        {step === "goal" && <GoalStep />}
        {step === "preview" && <PreviewStep />}
      </div>
    </div>
  );
}
