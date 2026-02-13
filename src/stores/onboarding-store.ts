import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";

export type OnboardingStep = "connect" | "goal" | "preview" | "completed";
export type PrimaryGoal =
  | "monetization"
  | "viral_content"
  | "affiliate_revenue";

const STORAGE_KEY = "virtuna-onboarding";

interface OnboardingState {
  step: OnboardingStep;
  tiktokHandle: string;
  primaryGoal: PrimaryGoal | null;
  _isHydrated: boolean;

  _hydrate: () => void;
  setStep: (step: OnboardingStep) => void;
  setTiktokHandle: (handle: string) => void;
  setPrimaryGoal: (goal: PrimaryGoal) => void;
  completeOnboarding: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
  reset: () => void;
}

function loadFromStorage(): Partial<OnboardingState> | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveToStorage(
  state: Pick<OnboardingState, "step" | "tiktokHandle" | "primaryGoal">
) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

async function persistToSupabase(updates: Record<string, unknown>) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("creator_profiles")
    .update(updates)
    .eq("user_id", user.id);
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  step: "connect",
  tiktokHandle: "",
  primaryGoal: null,
  _isHydrated: false,

  _hydrate: () => {
    const stored = loadFromStorage();
    if (stored) {
      set({
        step: (stored.step as OnboardingStep) || "connect",
        tiktokHandle: stored.tiktokHandle || "",
        primaryGoal: (stored.primaryGoal as PrimaryGoal) || null,
        _isHydrated: true,
      });
    } else {
      set({ _isHydrated: true });
    }
  },

  setStep: (step) => {
    const state = get();
    saveToStorage({ step, tiktokHandle: state.tiktokHandle, primaryGoal: state.primaryGoal });
    set({ step });
    persistToSupabase({ onboarding_step: step });
  },

  setTiktokHandle: (tiktokHandle) => {
    const state = get();
    saveToStorage({ step: state.step, tiktokHandle, primaryGoal: state.primaryGoal });
    set({ tiktokHandle });
    persistToSupabase({ tiktok_handle: tiktokHandle });
  },

  setPrimaryGoal: (primaryGoal) => {
    const state = get();
    saveToStorage({ step: state.step, tiktokHandle: state.tiktokHandle, primaryGoal });
    set({ primaryGoal });
    persistToSupabase({ primary_goal: primaryGoal });
  },

  completeOnboarding: async () => {
    const state = get();
    const step = "completed" as OnboardingStep;
    saveToStorage({ step, tiktokHandle: state.tiktokHandle, primaryGoal: state.primaryGoal });
    set({ step });
    await persistToSupabase({
      onboarding_step: "completed",
      onboarding_completed_at: new Date().toISOString(),
      tiktok_handle: state.tiktokHandle || null,
      primary_goal: state.primaryGoal,
    });
  },

  skipOnboarding: async () => {
    const state = get();
    const step = "completed" as OnboardingStep;
    saveToStorage({ step, tiktokHandle: state.tiktokHandle, primaryGoal: state.primaryGoal });
    set({ step });
    await persistToSupabase({
      onboarding_step: "completed",
      onboarding_completed_at: new Date().toISOString(),
    });
  },

  reset: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
    set({ step: "connect", tiktokHandle: "", primaryGoal: null });
  },
}));
