import { create } from "zustand";

export type TooltipId =
  | "hive-viz"
  | "test-creation"
  | "settings";

const STORAGE_KEY = "virtuna-tooltips";

interface TooltipState {
  dismissedTooltips: TooltipId[];
  onboardingComplete: boolean;
  _isHydrated: boolean;

  _hydrate: () => void;
  dismissTooltip: (id: TooltipId) => void;
  isTooltipVisible: (id: TooltipId) => boolean;
  setOnboardingComplete: (complete: boolean) => void;
}

function loadFromStorage(): Pick<TooltipState, "dismissedTooltips" | "onboardingComplete"> | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveToStorage(
  state: Pick<TooltipState, "dismissedTooltips" | "onboardingComplete">
) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

export const useTooltipStore = create<TooltipState>((set, get) => ({
  dismissedTooltips: [],
  onboardingComplete: false,
  _isHydrated: false,

  _hydrate: () => {
    const stored = loadFromStorage();
    if (stored) {
      set({
        dismissedTooltips: stored.dismissedTooltips || [],
        onboardingComplete: stored.onboardingComplete || false,
        _isHydrated: true,
      });
    } else {
      set({ _isHydrated: true });
    }
  },

  dismissTooltip: (id) => {
    const state = get();
    if (state.dismissedTooltips.includes(id)) return;
    const updated = [...state.dismissedTooltips, id];
    saveToStorage({ dismissedTooltips: updated, onboardingComplete: state.onboardingComplete });
    set({ dismissedTooltips: updated });
  },

  isTooltipVisible: (id) => {
    const state = get();
    return state.onboardingComplete && !state.dismissedTooltips.includes(id);
  },

  setOnboardingComplete: (complete) => {
    const state = get();
    saveToStorage({ dismissedTooltips: state.dismissedTooltips, onboardingComplete: complete });
    set({ onboardingComplete: complete });
  },
}));
