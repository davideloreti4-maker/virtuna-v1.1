// src/stores/society-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Society, PersonalSociety, TargetSociety } from '@/types/society';
import {
  INITIAL_SOCIETIES,
  INITIAL_TARGET_SOCIETIES,
} from '@/lib/mock-societies';

interface SocietyState {
  societies: Society[];
  selectedSocietyId: string | null;

  // Selectors (derived)
  getPersonalSocieties: () => PersonalSociety[];
  getTargetSocieties: () => TargetSociety[];
  getSelectedSociety: () => Society | undefined;

  // Actions
  selectSociety: (id: string) => void;
  addSociety: (society: Society) => void;
  updateSociety: (id: string, updates: Partial<Society>) => void;
  deleteSociety: (id: string) => void;
  resetSocieties: () => void;
}

export const useSocietyStore = create<SocietyState>()(
  persist(
    (set, get) => ({
      societies: INITIAL_SOCIETIES,
      selectedSocietyId: INITIAL_TARGET_SOCIETIES[0]?.id ?? null,

      // Selectors
      getPersonalSocieties: () =>
        get().societies.filter((s): s is PersonalSociety => s.type === 'personal'),

      getTargetSocieties: () =>
        get().societies.filter((s): s is TargetSociety => s.type === 'target'),

      getSelectedSociety: () =>
        get().societies.find((s) => s.id === get().selectedSocietyId),

      // Actions
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
      name: 'virtuna-societies', // localStorage key
    }
  )
);
