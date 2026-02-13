// src/stores/test-store.ts
import { create } from 'zustand';
import type { TestType, TestResult, TestStatus, ImpactLabel } from '@/types/test';
import type { PredictionResult } from '@/lib/engine/types';

/**
 * Simulation phase during AI processing
 */
export type SimulationPhase =
  | 'analyzing'
  | 'matching'
  | 'simulating'
  | 'generating';

// UX-03: Phase-specific messaging
export const PHASE_MESSAGES: Record<SimulationPhase, string> = {
  analyzing: 'Analyzing content structure and patterns...',
  matching: 'Matching against rule library and trends...',
  simulating: 'Simulating audience reactions...',
  generating: 'Generating predictions and insights...',
};

// ---------------------------------------------------------------------------
// Pure utility functions (extracted from store — no store dependency)
// ---------------------------------------------------------------------------

export function getImpactLabel(score: number): ImpactLabel {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Average';
  if (score >= 40) return 'Below Average';
  return 'Poor';
}

/** Derive attention breakdown from persona reactions */
export function deriveAttention(result: PredictionResult): {
  full: number;
  partial: number;
  ignore: number;
} {
  const reactions = result.persona_reactions;
  if (!reactions || reactions.length === 0) {
    return { full: 40, partial: 35, ignore: 25 };
  }
  const positive = reactions.filter((r) => r.sentiment === 'positive').length;
  const neutral = reactions.filter((r) => r.sentiment === 'neutral').length;
  const negative = reactions.filter((r) => r.sentiment === 'negative').length;
  const total = reactions.length || 1;
  return {
    full: Math.round((positive / total) * 100),
    partial: Math.round((neutral / total) * 100),
    ignore: Math.round((negative / total) * 100),
  };
}

/** Map PredictionResult to TestResult for backward-compatible UI display */
export function mapPredictionToTestResult(
  prediction: PredictionResult,
  content: string,
  testType: TestType,
  societyId: string
): TestResult {
  return {
    id: `test_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    testType,
    content,
    impactScore: prediction.overall_score,
    impactLabel: getImpactLabel(prediction.overall_score),
    attention: deriveAttention(prediction),
    variants: prediction.variants.map((v) => ({
      id: v.id,
      type: v.type === 'original' ? 'original' as const : 'ai-generated' as const,
      content: v.content,
      impactScore: v.predicted_score,
      label: v.label,
    })),
    insights: prediction.suggestions.map((s) => s.text),
    conversationThemes: prediction.conversation_themes.map((t) => ({
      id: t.id,
      title: t.title,
      percentage: t.percentage,
      description: t.description,
      quotes: [],
    })),
    createdAt: new Date().toISOString(),
    societyId,
  };
}

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

  viewResult: (_testId: string) => {
    // TODO: Reimplement with query data — fetch result by ID from API
    // For now, just toggle viewing state (sidebar calls this)
    set({
      currentStatus: 'viewing-results',
      isViewingHistory: true,
    });
  },

  reset: () => {
    set({
      currentTestType: null,
      currentStatus: 'idle',
      currentResult: null,
      isViewingHistory: false,
    });
  },
}));
