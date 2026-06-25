import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";

/**
 * Welcome-flow state machine. D-03 / INT-04 trimmed the union to two members:
 * the user lands on "connect", supplies their TikTok handle, and the store
 * transitions to "completed" (the welcome page then redirects to /dashboard).
 *
 * The creator-goal capture is delegated exclusively to Card 3 of the
 * post-upload interview modal (Plan 02-04) — duplicating it here would
 * violate INT-04 (no duplication of capture surfaces).
 */
export type OnboardingStep = "connect" | "completed";

const STORAGE_KEY = "virtuna-onboarding";

interface OnboardingState {
  step: OnboardingStep;
  tiktokHandle: string;
  _isHydrated: boolean;

  _hydrate: () => void;
  setStep: (step: OnboardingStep) => void;
  setTiktokHandle: (handle: string) => void;
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
  state: Pick<OnboardingState, "step" | "tiktokHandle">
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
    .update(updates as Database["public"]["Tables"]["creator_profiles"]["Update"])
    .eq("user_id", user.id);
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  step: "connect",
  tiktokHandle: "",
  _isHydrated: false,

  _hydrate: () => {
    const stored = loadFromStorage();
    if (stored) {
      set({
        step: (stored.step as OnboardingStep) || "connect",
        tiktokHandle: stored.tiktokHandle || "",
        _isHydrated: true,
      });
    } else {
      set({ _isHydrated: true });
    }
  },

  setStep: (step) => {
    const state = get();
    saveToStorage({ step, tiktokHandle: state.tiktokHandle });
    set({ step });
    persistToSupabase({ onboarding_step: step });
  },

  setTiktokHandle: (tiktokHandle) => {
    const state = get();
    saveToStorage({ step: state.step, tiktokHandle });
    set({ tiktokHandle });
    persistToSupabase({ tiktok_handle: tiktokHandle });
  },

  completeOnboarding: async () => {
    const state = get();
    const step = "completed" as OnboardingStep;
    saveToStorage({ step, tiktokHandle: state.tiktokHandle });
    set({ step });
    await persistToSupabase({
      onboarding_step: "completed",
      onboarding_completed_at: new Date().toISOString(),
      tiktok_handle: state.tiktokHandle || null,
    });
  },

  skipOnboarding: async () => {
    const state = get();
    const step = "completed" as OnboardingStep;
    saveToStorage({ step, tiktokHandle: state.tiktokHandle });
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
    set({ step: "connect", tiktokHandle: "" });
  },
}));
