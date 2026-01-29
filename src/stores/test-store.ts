// src/stores/test-store.ts
import { create } from 'zustand';
import type {
  TestType,
  TestResult,
  TestStatus,
  ImpactLabel,
  Variant,
  ConversationTheme,
} from '@/types/test';

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

// Get impact label based on score
function getImpactLabel(score: number): ImpactLabel {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Average';
  if (score >= 40) return 'Below Average';
  return 'Poor';
}

// Generate mock variants (temporary inline - will use mock-data.ts later)
function generateMockVariants(originalContent: string): Variant[] {
  const originalScore = Math.floor(Math.random() * 20) + 50; // 50-70
  return [
    {
      id: `var_${Date.now()}_1`,
      type: 'original',
      content: originalContent,
      impactScore: originalScore,
    },
    {
      id: `var_${Date.now()}_2`,
      type: 'ai-generated',
      content:
        originalContent.length > 50
          ? originalContent.substring(0, 50) + '... (AI variant)'
          : originalContent + ' (AI variant)',
      impactScore: originalScore + Math.floor(Math.random() * 15) + 5,
      label: 'More engaging hook',
    },
    {
      id: `var_${Date.now()}_3`,
      type: 'ai-generated',
      content:
        originalContent.length > 50
          ? originalContent.substring(0, 50) + '... (Direct variant)'
          : originalContent + ' (Direct variant)',
      impactScore: originalScore + Math.floor(Math.random() * 20) + 10,
      label: 'Direct approach',
    },
  ];
}

// Generate mock insights (temporary inline - will use mock-data.ts later)
function generateMockInsights(): string[] {
  return [
    'Your content resonates well with the target audience, particularly among professionals aged 25-45.',
    'The opening hook captures attention effectively, with 78% of simulated users reading past the first line.',
    'Consider adding more specific data points to strengthen credibility with skeptical readers.',
    'The call-to-action placement could be optimized for higher conversion rates.',
  ];
}

// Generate mock themes (temporary inline - will use mock-data.ts later)
function generateMockThemes(): ConversationTheme[] {
  return [
    {
      id: `theme_${Date.now()}_1`,
      title: 'Professional Appeal',
      percentage: 45,
      description: 'Content appeals to career-focused individuals seeking growth opportunities.',
      quotes: ['"This speaks to my professional goals"', '"I can see how this would help my career"'],
    },
    {
      id: `theme_${Date.now()}_2`,
      title: 'Value Clarity',
      percentage: 35,
      description: 'The value proposition is clear and compelling to the target audience.',
      quotes: [
        '"I understand what they\'re offering"',
        '"The benefits are clearly outlined"',
        '"This addresses my specific needs"',
      ],
    },
    {
      id: `theme_${Date.now()}_3`,
      title: 'Emotional Connection',
      percentage: 20,
      description: 'Emotional elements resonate with audience aspirations and pain points.',
      quotes: ['"This really gets how I feel"', '"They understand my struggles"'],
    },
  ];
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
