import { create } from "zustand";
import { persist } from "zustand/middleware";

type ViewMode = "grid" | "table";

interface CompetitorsUIState {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

export const useCompetitorsStore = create<CompetitorsUIState>()(
  persist(
    (set) => ({
      viewMode: "grid",
      setViewMode: (mode: ViewMode) => set({ viewMode: mode }),
    }),
    {
      name: "virtuna-competitors-view",
    }
  )
);
