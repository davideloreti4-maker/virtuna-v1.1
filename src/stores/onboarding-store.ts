import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";

/**
 * Welcome-flow state machine. D-03 / INT-04 trimmed the union to two members:
 * the user lands on "connect", supplies their TikTok handle (or a description),
 * and the store transitions to "completed" — at which point the welcome page
 * redirects to /home (D-23; /dashboard was sunset by D-25 and only 308s there).
 *
 * ⚠️ The union stays TWO members even though /welcome now has two visible steps.
 * The second step (calibrate) is local page state on purpose: persisting it would
 * restore a reloading user straight back into an auto-starting calibration, and
 * that is a real Apify scrape on a metered account. See the welcome page header.
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

  /**
   * ⚠️ The DB write happens BEFORE the step flips, and the order is load-bearing.
   *
   * Flipping first is the optimistic-update instinct, and here it causes a bounce: the welcome
   * page redirects to /home the moment `step` becomes "completed", and middleware.ts:173 gates
   * /home on `onboarding_completed_at` being present in the DATABASE. Redirect and write were
   * racing, so a creator who had just sat through a ~128s calibration could be thrown straight
   * back to the welcome form. Caught live on the resume path (2026-08-02), where it reproduced
   * every time; the write itself was always landing.
   *
   * A failed persist still flips the step — persistToSupabase swallows its own errors, so
   * awaiting it only sequences the two. That leaves the pre-existing behaviour intact for the
   * offline case rather than trapping the user on /welcome with no way forward.
   */
  completeOnboarding: async () => {
    const state = get();
    const step = "completed" as OnboardingStep;
    await persistToSupabase({
      onboarding_step: "completed",
      onboarding_completed_at: new Date().toISOString(),
      tiktok_handle: state.tiktokHandle || null,
    });
    saveToStorage({ step, tiktokHandle: state.tiktokHandle });
    set({ step });
  },

  skipOnboarding: async () => {
    const state = get();
    const step = "completed" as OnboardingStep;
    await persistToSupabase({
      onboarding_step: "completed",
      onboarding_completed_at: new Date().toISOString(),
    });
    saveToStorage({ step, tiktokHandle: state.tiktokHandle });
    set({ step });
  },

  reset: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
    set({ step: "connect", tiktokHandle: "" });
  },
}));
