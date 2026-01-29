// src/stores/test-store.ts
import { create } from 'zustand';
import type { TestType, TestResult, TestStatus } from '@/types/test';
import {
  generateMockVariants,
  generateMockInsights,
  generateMockThemes,
  getImpactLabel,
} from '@/lib/mock-data';

const STORAGE_KEY = 'virtuna-tests';

/**
 * Simulation phase during AI processing
 */
export type SimulationPhase =
  | 'analyzing' // Phase 1: Analyzing content
  | 'matching' // Phase 2: Matching profiles
  | 'simulating' // Phase 3: Running simulation
  | 'generating'; // Phase 4: Generating insights

interface TestState {
  tests: TestResult[];
  currentTestType: TestType | null;
  currentStatus: TestStatus;
  currentResult: TestResult | null;
  simulationPhase: SimulationPhase | null;
  phaseProgress: number; // 0-100 for overall progress
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

// Helper to save to localStorage
function saveToStorage(tests: TestResult[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tests }));
  } catch {
    // Ignore storage errors
  }
}

// Helper to load from localStorage
function loadFromStorage(): { tests: TestResult[] } | null {
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

// Generate a unique ID
function generateId(): string {
  return `test_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Generate mock attention breakdown that sums to 100
function generateAttention(): { full: number; partial: number; ignore: number } {
  const full = Math.floor(Math.random() * 40) + 30; // 30-70
  const partial = Math.floor(Math.random() * 30) + 15; // 15-45
  const ignore = 100 - full - partial; // Remainder
  return { full, partial, ignore };
}

// Note: getImpactLabel, generateMockVariants, generateMockInsights, generateMockThemes
// are imported from @/lib/mock-data

export const useTestStore = create<TestState>((set, get) => ({
  tests: [],
  currentTestType: null,
  currentStatus: 'idle',
  currentResult: null,
  simulationPhase: null,
  phaseProgress: 0,
  _isHydrated: false,

  _hydrate: () => {
    const stored = loadFromStorage();
    if (stored) {
      set({
        tests: stored.tests,
        _isHydrated: true,
      });
    } else {
      set({ _isHydrated: true });
    }
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

    // Set simulating status and start phase 1
    set({
      currentStatus: 'simulating',
      simulationPhase: 'analyzing',
      phaseProgress: 0,
    });

    // Phase 1: Analyzing (0-25%)
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (get().currentStatus !== 'simulating') return; // cancelled

    set({ simulationPhase: 'matching', phaseProgress: 25 });

    // Phase 2: Matching (25-50%)
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (get().currentStatus !== 'simulating') return; // cancelled

    set({ simulationPhase: 'simulating', phaseProgress: 50 });

    // Phase 3: Simulating (50-75%)
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (get().currentStatus !== 'simulating') return; // cancelled

    set({ simulationPhase: 'generating', phaseProgress: 75 });

    // Phase 4: Generating (75-100%)
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (get().currentStatus !== 'simulating') return; // cancelled

    set({ phaseProgress: 100 });

    // Generate mock result
    const impactScore = Math.floor(Math.random() * 36) + 60; // 60-95
    const result: TestResult = {
      id: generateId(),
      testType: currentTestType,
      content,
      impactScore,
      impactLabel: getImpactLabel(impactScore),
      attention: generateAttention(),
      variants: generateMockVariants(content),
      insights: generateMockInsights(),
      conversationThemes: generateMockThemes(),
      createdAt: new Date().toISOString(),
      societyId,
    };

    // Add to tests array and save
    set((state) => {
      const newTests = [result, ...state.tests];
      saveToStorage(newTests);
      return {
        tests: newTests,
        currentResult: result,
        currentStatus: 'viewing-results',
        simulationPhase: null,
        phaseProgress: 0,
      };
    });
  },

  cancelSimulation: () => {
    set({
      currentStatus: 'filling-form',
      simulationPhase: null,
      phaseProgress: 0,
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
      });
    }
  },

  deleteTest: (testId) => {
    set((state) => {
      const newTests = state.tests.filter((t) => t.id !== testId);
      saveToStorage(newTests);
      return {
        tests: newTests,
        // Clear current result if it was the deleted test
        currentResult: state.currentResult?.id === testId ? null : state.currentResult,
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
    });
  },
}));
