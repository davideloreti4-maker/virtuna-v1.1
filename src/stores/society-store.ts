// src/stores/society-store.ts
import { create } from 'zustand';
import type { Society } from '@/types/society';
import {
  INITIAL_SOCIETIES,
  INITIAL_TARGET_SOCIETIES,
} from '@/lib/mock-societies';

const STORAGE_KEY = 'virtuna-societies';

interface SocietyState {
  societies: Society[];
  selectedSocietyId: string | null;
  _isHydrated: boolean;

  // Actions
  selectSociety: (id: string) => void;
  addSociety: (society: Society) => void;
  updateSociety: (id: string, updates: Partial<Society>) => void;
  deleteSociety: (id: string) => void;
  resetSocieties: () => void;
  _hydrate: () => void;
}

// Helper to save to localStorage
function saveToStorage(societies: Society[], selectedSocietyId: string | null) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ societies, selectedSocietyId }));
  } catch {
    // Ignore storage errors
  }
}

// Helper to load from localStorage
function loadFromStorage(): { societies: Society[]; selectedSocietyId: string | null } | null {
  if (typeof window === 'undefined') return null;
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

export const useSocietyStore = create<SocietyState>((set, get) => ({
  societies: INITIAL_SOCIETIES,
  selectedSocietyId: INITIAL_TARGET_SOCIETIES[0]?.id ?? null,
  _isHydrated: false,

  _hydrate: () => {
    const stored = loadFromStorage();
    if (stored) {
      set({
        societies: stored.societies,
        selectedSocietyId: stored.selectedSocietyId,
        _isHydrated: true,
      });
    } else {
      set({ _isHydrated: true });
    }
  },

  selectSociety: (id) => {
    set({ selectedSocietyId: id });
    const state = get();
    saveToStorage(state.societies, id);
  },

  addSociety: (society) => {
    set((state) => {
      const newSocieties = [...state.societies, society];
      saveToStorage(newSocieties, society.id);
      return {
        societies: newSocieties,
        selectedSocietyId: society.id,
      };
    });
  },

  updateSociety: (id, updates) => {
    set((state) => {
      const newSocieties = state.societies.map((s) =>
        s.id === id ? ({ ...s, ...updates } as Society) : s
      );
      saveToStorage(newSocieties, state.selectedSocietyId);
      return { societies: newSocieties };
    });
  },

  deleteSociety: (id) => {
    set((state) => {
      const filteredSocieties = state.societies.filter((s) => s.id !== id);
      const newSelectedId =
        state.selectedSocietyId === id
          ? filteredSocieties[0]?.id ?? null
          : state.selectedSocietyId;
      saveToStorage(filteredSocieties, newSelectedId);
      return {
        societies: filteredSocieties,
        selectedSocietyId: newSelectedId,
      };
    });
  },

  resetSocieties: () => {
    const defaultId = INITIAL_TARGET_SOCIETIES[0]?.id ?? null;
    saveToStorage(INITIAL_SOCIETIES, defaultId);
    set({
      societies: INITIAL_SOCIETIES,
      selectedSocietyId: defaultId,
    });
  },
}));
