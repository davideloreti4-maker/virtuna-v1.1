// src/stores/settings-store.ts
import { create } from "zustand";
import type {
  UserProfile,
  NotificationPrefs,
  TeamMember,
  BillingInfo,
} from "@/types/settings";

const STORAGE_KEY = "virtuna-settings";

// Default profile — name/email come from Supabase on mount, company/role from localStorage
const DEFAULT_PROFILE: UserProfile = {
  name: "",
  email: "",
  company: "",
  role: "",
};

const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  emailUpdates: true,
  testResults: true,
  weeklyDigest: false,
  marketingEmails: false,
};

const DEFAULT_TEAM: TeamMember[] = [
  {
    id: "1",
    name: "Davide Loreti",
    email: "davide.loreti4@gmail.com",
    role: "owner",
    joinedAt: "2024-01-15",
  },
];

const DEFAULT_BILLING: BillingInfo = {
  plan: "free",
  status: "active",
  whopConnected: false,
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
  creditsRemaining: 0,
  creditsTotal: 0,
};

interface SettingsState {
  // Data
  profile: UserProfile;
  notifications: NotificationPrefs;
  team: TeamMember[];
  billing: BillingInfo;

  // Hydration
  _isHydrated: boolean;
  _hydrate: () => void;

  // Actions
  updateProfile: (updates: Partial<UserProfile>) => void;
  updateNotifications: (updates: Partial<NotificationPrefs>) => void;
  addTeamMember: (member: Omit<TeamMember, "id" | "joinedAt">) => void;
  removeTeamMember: (id: string) => void;
  updateTeamMemberRole: (id: string, role: TeamMember["role"]) => void;
}

function loadFromStorage(): Partial<SettingsState> | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveToStorage(
  state: Pick<SettingsState, "profile" | "notifications" | "team">
) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  profile: DEFAULT_PROFILE,
  notifications: DEFAULT_NOTIFICATIONS,
  team: DEFAULT_TEAM,
  billing: DEFAULT_BILLING, // Billing not persisted - comes from backend in real app

  _isHydrated: false,

  _hydrate: () => {
    const stored = loadFromStorage();
    if (stored) {
      set({
        profile: stored.profile || DEFAULT_PROFILE,
        notifications: stored.notifications || DEFAULT_NOTIFICATIONS,
        team: stored.team || DEFAULT_TEAM,
        _isHydrated: true,
      });
    } else {
      set({ _isHydrated: true });
    }
  },

  updateProfile: (updates) => {
    set((state) => {
      const newProfile = { ...state.profile, ...updates };
      saveToStorage({
        profile: newProfile,
        notifications: state.notifications,
        team: state.team,
      });
      return { profile: newProfile };
    });
  },

  updateNotifications: (updates) => {
    set((state) => {
      const newNotifications = { ...state.notifications, ...updates };
      saveToStorage({
        profile: state.profile,
        notifications: newNotifications,
        team: state.team,
      });
      return { notifications: newNotifications };
    });
  },

  addTeamMember: (member) => {
    set((state) => {
      const newMember: TeamMember = {
        ...member,
        id: crypto.randomUUID(),
        joinedAt: new Date().toISOString().split("T")[0]!,
      };
      const newTeam = [...state.team, newMember];
      saveToStorage({
        profile: state.profile,
        notifications: state.notifications,
        team: newTeam,
      });
      return { team: newTeam };
    });
  },

  removeTeamMember: (id) => {
    set((state) => {
      const newTeam = state.team.filter((m) => m.id !== id);
      saveToStorage({
        profile: state.profile,
        notifications: state.notifications,
        team: newTeam,
      });
      return { team: newTeam };
    });
  },

  updateTeamMemberRole: (id, role) => {
    set((state) => {
      const newTeam = state.team.map((m) => (m.id === id ? { ...m, role } : m));
      saveToStorage({
        profile: state.profile,
        notifications: state.notifications,
        team: newTeam,
      });
      return { team: newTeam };
    });
  },
}));
