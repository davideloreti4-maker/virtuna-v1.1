// src/stores/society-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Society } from '@/types/society';
import {
  INITIAL_SOCIETIES,
  INITIAL_TARGET_SOCIETIES,
} from '@/lib/mock-societies';

interface SocietyState {
  // Hydration state for SSR
  _hasHydrated: boolean;

  societies: Society[];
  selectedSocietyId: string | null;

  // Actions
  setHasHydrated: (state: boolean) => void;
  selectSociety: (id: string) => void;
  addSociety: (society: Society) => void;
  updateSociety: (id: string, updates: Partial<Society>) => void;
  deleteSociety: (id: string) => void;
  resetSocieties: () => void;
}

export const useSocietyStore = create<SocietyState>()(
  persist(
    (set) => ({
      _hasHydrated: false,

      societies: INITIAL_SOCIETIES,
      selectedSocietyId: INITIAL_TARGET_SOCIETIES[0]?.id ?? null,

      // Actions
      setHasHydrated: (state) => set({ _hasHydrated: state }),

      selectSociety: (id) => set({ selectedSocietyId: id }),

      addSociety: (society) =>
        set((state) => ({
          societies: [...state.societies, society],
          selectedSocietyId: society.id, // Auto-select new society
        })),

      updateSociety: (id, updates) =>
        set((state) => ({
          societies: state.societies.map((s) =>
            s.id === id ? ({ ...s, ...updates } as Society) : s
          ),
        })),

      deleteSociety: (id) =>
        set((state) => {
          const filteredSocieties = state.societies.filter((s) => s.id !== id);
          return {
            societies: filteredSocieties,
            selectedSocietyId:
              state.selectedSocietyId === id
                ? filteredSocieties[0]?.id ?? null
                : state.selectedSocietyId,
          };
        }),

      resetSocieties: () =>
        set({
          societies: INITIAL_SOCIETIES,
          selectedSocietyId: INITIAL_TARGET_SOCIETIES[0]?.id ?? null,
        }),
    }),
    {
      name: 'virtuna-societies',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// Stable selectors (defined once, reused across renders)
export const selectHasHydrated = (s: SocietyState) => s._hasHydrated;
export const selectSocieties = (s: SocietyState) => s.societies;
export const selectSelectedSocietyId = (s: SocietyState) => s.selectedSocietyId;
export const selectSelectSociety = (s: SocietyState) => s.selectSociety;
export const selectDeleteSociety = (s: SocietyState) => s.deleteSociety;
export const selectAddSociety = (s: SocietyState) => s.addSociety;
