// src/stores/test-store.ts
import { create } from 'zustand';
import type { TestType, TestResult, TestStatus } from '@/types/test';

const STORAGE_KEY = 'virtuna-tests';

interface TestState {
  tests: TestResult[];
  currentTestType: TestType | null;
  currentStatus: TestStatus;
  currentResult: TestResult | null;
  _isHydrated: boolean;

  // Actions
  setTestType: (type: TestType | null) => void;
  setStatus: (status: TestStatus) => void;
  submitTest: (content: string, societyId: string) => Promise<void>;
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

export const useTestStore = create<TestState>((set, get) => ({
  tests: [],
  currentTestType: null,
  currentStatus: 'idle',
  currentResult: null,
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

    // Set simulating status
    set({ currentStatus: 'simulating' });

    // Wait 2 seconds (mock AI processing)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Generate mock result
    const result: TestResult = {
      id: generateId(),
      testType: currentTestType,
      content,
      impactScore: Math.floor(Math.random() * 36) + 60, // 60-95
      attention: generateAttention(),
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
      };
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
    });
  },
}));
