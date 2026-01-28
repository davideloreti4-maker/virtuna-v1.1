// src/stores/society-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { Society, PersonalSociety, TargetSociety } from '@/types/society';
import {
  INITIAL_SOCIETIES,
  INITIAL_TARGET_SOCIETIES,
} from '@/lib/mock-societies';

interface SocietyState {
  societies: Society[];
  selectedSocietyId: string | null;

  // Actions
  selectSociety: (id: string) => void;
  addSociety: (society: Society) => void;
  updateSociety: (id: string, updates: Partial<Society>) => void;
  deleteSociety: (id: string) => void;
  resetSocieties: () => void;
}

export const useSocietyStore = create<SocietyState>()(
  persist(
    (set) => ({
      societies: INITIAL_SOCIETIES,
      selectedSocietyId: INITIAL_TARGET_SOCIETIES[0]?.id ?? null,

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

// Selector hooks with proper memoization
export function useSelectedSociety() {
  return useSocietyStore(
    useShallow((s) => s.societies.find((soc) => soc.id === s.selectedSocietyId))
  );
}

export function usePersonalSocieties() {
  return useSocietyStore(
    useShallow((s) => s.societies.filter((soc): soc is PersonalSociety => soc.type === 'personal'))
  );
}

export function useTargetSocieties() {
  return useSocietyStore(
    useShallow((s) => s.societies.filter((soc): soc is TargetSociety => soc.type === 'target'))
  );
}
