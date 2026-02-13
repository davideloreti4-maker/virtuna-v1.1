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

const PHASE_ORDER: SimulationPhase[] = [
  'analyzing',
  'matching',
  'simulating',
  'generating',
];

// UX-02: Minimum theater duration (4.5 seconds)
const MIN_THEATER_DURATION_MS = 4500;
// Minimum time per phase to ensure visible animation
const MIN_PHASE_DURATION_MS = 1000;

interface TestState {
  tests: TestResult[];
  currentTestType: TestType | null;
  currentStatus: TestStatus;
  currentResult: TestResult | null;
  simulationPhase: SimulationPhase | null;
  phaseProgress: number;
  phaseMessage: string;
  isViewingHistory: boolean;
  _isHydrated: boolean;

  // Actions
  setTestType: (type: TestType | null) => void;
  setStatus: (status: TestStatus) => void;
  submitTest: (content: string, societyId: string) => Promise<void>;
  cancelSimulation: () => void;
  viewResult: (testId: string) => void;
  deleteTest: (testId: string) => void;
  reset: () => void;
  _hydrate: () => void;
}

// UX-03: Phase-specific messaging
const PHASE_MESSAGES: Record<SimulationPhase, string> = {
  analyzing: 'Analyzing content structure and patterns...',
  matching: 'Matching against rule library and trends...',
  simulating: 'Simulating audience reactions...',
  generating: 'Generating predictions and insights...',
};

function getImpactLabel(score: number): ImpactLabel {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Average';
  if (score >= 40) return 'Below Average';
  return 'Poor';
}

/** Derive attention breakdown from persona reactions */
function deriveAttention(result: PredictionResult): {
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
function mapPredictionToTestResult(
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

export const useTestStore = create<TestState>((set, get) => ({
  tests: [],
  currentTestType: null,
  currentStatus: 'idle',
  currentResult: null,
  simulationPhase: null,
  phaseProgress: 0,
  phaseMessage: '',
  isViewingHistory: false,
  _isHydrated: false,

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

  submitTest: async (content, societyId) => {
    const { currentTestType } = get();
    if (!currentTestType) return;

    const theaterStart = performance.now();

    // Start simulation
    set({
      currentStatus: 'simulating',
      simulationPhase: 'analyzing',
      phaseProgress: 0,
      phaseMessage: PHASE_MESSAGES.analyzing,
    });

    // Map content type for API
    const contentTypeMap: Record<string, string> = {
      'tiktok-script': 'video',
      'instagram-post': 'reel',
      'x-post': 'post',
      'linkedin-post': 'post',
      'email-subject-line': 'post',
      'email': 'post',
      'article': 'post',
      'website-content': 'post',
      'advertisement': 'post',
      'product-proposition': 'post',
      'survey': 'post',
    };

    let prediction: PredictionResult | null = null;
    let currentPhaseIdx = 0;

    try {
      // UX-01: Call real API with SSE streaming
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_text: content,
          content_type: contentTypeMap[currentTestType] ?? 'post',
          society_id: societyId,
        }),
      });

      if (!res.ok) {
        throw new Error('Analysis failed');
      }

      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        if (get().currentStatus !== 'simulating') return; // cancelled

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7).trim();
            const dataLine = lines[i + 1];

            if (dataLine?.startsWith('data: ')) {
              const data = JSON.parse(dataLine.slice(6));

              if (eventType === 'phase') {
                const phase = data.phase as SimulationPhase;
                const phaseIdx = PHASE_ORDER.indexOf(phase);

                // UX-02: Ensure minimum per-phase duration
                if (phaseIdx > currentPhaseIdx) {
                  const elapsed = performance.now() - theaterStart;
                  const expectedMinForPhase = (phaseIdx) * MIN_PHASE_DURATION_MS;
                  if (elapsed < expectedMinForPhase) {
                    await new Promise((r) =>
                      setTimeout(r, expectedMinForPhase - elapsed)
                    );
                  }
                  currentPhaseIdx = phaseIdx;
                }

                set({
                  simulationPhase: phase,
                  phaseProgress: ((phaseIdx + 1) / PHASE_ORDER.length) * 100,
                  phaseMessage: data.message || PHASE_MESSAGES[phase] || '',
                });
              } else if (eventType === 'complete') {
                prediction = data as PredictionResult;
              } else if (eventType === 'error') {
                throw new Error(data.error || 'Analysis error');
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('[test-store] Analysis failed:', error);
      set({
        currentStatus: 'filling-form',
        simulationPhase: null,
        phaseProgress: 0,
        phaseMessage: '',
      });
      return;
    }

    if (!prediction || get().currentStatus !== 'simulating') return;

    // UX-02: Enforce minimum theater duration
    const elapsed = performance.now() - theaterStart;
    if (elapsed < MIN_THEATER_DURATION_MS) {
      // Run through remaining phases during the wait
      for (let i = currentPhaseIdx + 1; i < PHASE_ORDER.length; i++) {
        const phase = PHASE_ORDER[i]!;
        set({
          simulationPhase: phase,
          phaseProgress: ((i + 1) / PHASE_ORDER.length) * 100,
          phaseMessage: PHASE_MESSAGES[phase],
        });
        await new Promise((r) => setTimeout(r, MIN_PHASE_DURATION_MS));
        if (get().currentStatus !== 'simulating') return;
      }

      const remainingWait = MIN_THEATER_DURATION_MS - (performance.now() - theaterStart);
      if (remainingWait > 0) {
        await new Promise((r) => setTimeout(r, remainingWait));
      }
    }

    if (get().currentStatus !== 'simulating') return;

    // Map prediction to TestResult
    const result = mapPredictionToTestResult(
      prediction,
      content,
      currentTestType,
      societyId
    );

    // UX-06: Update state — crossfade handled by AnimatePresence in UI
    set((state) => ({
      tests: [result, ...state.tests],
      currentResult: result,
      currentStatus: 'viewing-results',
      simulationPhase: null,
      phaseProgress: 0,
      phaseMessage: '',
    }));
  },

  cancelSimulation: () => {
    set({
      currentStatus: 'filling-form',
      simulationPhase: null,
      phaseProgress: 0,
      phaseMessage: '',
    });
  },

  viewResult: (testId) => {
    const { tests } = get();
    const result = tests.find((t) => t.id === testId);
    if (result) {
      set({
        currentResult: result,
        currentTestType: result.testType,
        currentStatus: 'viewing-results',
        isViewingHistory: true,
      });
    }
  },

  deleteTest: (testId) => {
    set((state) => {
      const newTests = state.tests.filter((t) => t.id !== testId);
      const wasViewing = state.currentResult?.id === testId;
      return {
        tests: newTests,
        currentResult: wasViewing ? null : state.currentResult,
        currentStatus: wasViewing ? 'idle' : state.currentStatus,
        isViewingHistory: wasViewing ? false : state.isViewingHistory,
        currentTestType: wasViewing ? null : state.currentTestType,
      };
    });
  },

  reset: () => {
    set({
      currentTestType: null,
      currentStatus: 'idle',
      currentResult: null,
      simulationPhase: null,
      phaseProgress: 0,
      phaseMessage: '',
      isViewingHistory: false,
    });
  },
}));
