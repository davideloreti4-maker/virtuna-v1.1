// src/stores/test-store.ts
import { create } from 'zustand';
import type { TestType, TestResult, TestStatus } from '@/types/test';

/**
 * Simulation phase during v2 AI processing (matches SSE phases from use-analyze)
 */
export type SimulationPhase = 'analyzing' | 'reasoning' | 'scoring';

// UX-03: Phase-specific messaging (v2 pipeline stages)
export const PHASE_MESSAGES: Record<SimulationPhase, string> = {
  analyzing: 'Analyzing content with AI models...',
  reasoning: 'Processing behavioral predictions...',
  scoring: 'Calculating final scores and insights...',
};

// ---------------------------------------------------------------------------
// Thinned Zustand Store — UI flow state only
// ---------------------------------------------------------------------------
// Server state (analysis results, SSE streaming, history) lives in TanStack
// Query hooks (useAnalyze, useAnalysisHistory). This store manages only the
// client-side UI flow: which step is the user on, what test type is selected.
//
// Compatibility note: currentResult and viewResult are kept as thin shims
// because sidebar.tsx, content-form.tsx, survey-form.tsx, and
// test-creation-flow.tsx still reference them. They will be migrated to
// TanStack Query in a follow-up plan.
// ---------------------------------------------------------------------------

interface TestState {
  currentTestType: TestType | null;
  currentStatus: TestStatus;
  isViewingHistory: boolean;
  _isHydrated: boolean;
  /** ID of the test being viewed — use with useAnalysisDetail() */
  _viewingTestId: string | null;

  // Compatibility shim — will be removed when all consumers migrate
  currentResult: TestResult | null;

  // Actions
  setTestType: (type: TestType | null) => void;
  setStatus: (status: TestStatus) => void;
  setCurrentResult: (result: TestResult | null) => void;
  viewResult: (testId: string) => void;
  reset: () => void;
  _hydrate: () => void;
}

export const useTestStore = create<TestState>((set) => ({
  currentTestType: null,
  currentStatus: 'idle',
  isViewingHistory: false,
  _isHydrated: false,
  _viewingTestId: null,
  currentResult: null,

  _hydrate: () => {
    // UX-07: No longer uses localStorage — history comes from Supabase
    // via useAnalysisHistory() hook. Just mark as hydrated.
    set({ _isHydrated: true });
  },

  setTestType: (type) => {
    set({ currentTestType: type });
  },

  setStatus: (status) => {
    set({ currentStatus: status });
  },

  setCurrentResult: (result) => {
    set({ currentResult: result });
  },

  viewResult: (testId: string) => {
    // Set viewing state — the actual data fetch is handled by
    // useAnalysisDetail(testId) in the consuming component.
    // Store the ID so components can use it with the query hook.
    set({
      currentStatus: 'viewing-results',
      isViewingHistory: true,
      _viewingTestId: testId,
    });
  },

  reset: () => {
    set({
      currentTestType: null,
      currentStatus: 'idle',
      currentResult: null,
      isViewingHistory: false,
      _viewingTestId: null,
    });
  },
}));
