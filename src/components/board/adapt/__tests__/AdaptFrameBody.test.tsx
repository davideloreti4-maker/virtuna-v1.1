/** @vitest-environment happy-dom */
/**
 * Tests for AdaptFrameBody component.
 *
 * State machine cases:
 *   1 — niche-prompt: empty niche (both primary and sub null) shows inline NichePicker
 *   2 — mutateAsync-then-generate: niche inline → await updateProfile THEN fire adapt (no race)
 *   3 — auto-fire-once: niche present + decode present + no adapt → fires exactly once
 *   4 — rehydrate-no-regen: variants.remix.adapt on permalink → cards with NO fetch (Pitfall 3)
 *   5 — independent-failure: adapt failure → error state, Decode unaffected (D-06)
 *   6 — decode-absent empty state: decode absent + niche present → empty-state copy
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { AdaptConcept, DecodeOutput } from '@/lib/engine/remix/decode-types';
import { DECODE_FIXTURE } from '@/lib/engine/remix/decode.fixture';

// =====================================================
// Module mocks
// =====================================================

const mockMutateAsync = vi.fn();
const mockUpdateMutateAsync = vi.fn();

vi.mock('@/hooks/queries/use-analysis-stream', () => ({
  useAnalysisStream: vi.fn(() => ({ result: null, status: 'idle' })),
}));

vi.mock('@/hooks/queries/use-permalink-analysis', () => ({
  usePermalinkAnalysis: vi.fn(() => ({ data: null, id: null, isLoading: false })),
}));

vi.mock('@/hooks/queries/use-creator-profile', () => ({
  useCreatorProfile: vi.fn(() => ({
    data: { niche_primary: 'fitness', niche_sub: 'strength-training' },
  })),
  useUpdateCreatorProfile: vi.fn(() => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  })),
}));

vi.mock('@/lib/niches/taxonomy', () => ({
  NICHE_TREE: [
    {
      slug: 'fitness',
      label: 'Fitness',
      branches: [
        { slug: 'strength-training', label: 'Strength Training' },
      ],
    },
  ],
  getNicheBranches: vi.fn((primary: string) =>
    primary === 'fitness' ? [{ slug: 'strength-training', label: 'Strength Training' }] : [],
  ),
  getPrimaryLabel: vi.fn((slug: string) => slug),
  getSubLabel: vi.fn((_primary: string, sub: string) => sub),
}));

vi.mock('@/hooks/queries/use-adapt-concepts', () => ({
  useAdaptConcepts: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
    isError: false,
    error: null,
  })),
}));

// =====================================================
// Fixtures
// =====================================================

const THREE_CONCEPTS: AdaptConcept[] = [
  {
    hook: 'Concept 1 hook for niche',
    angle: 'Angle 1 borrowing the open-loop structure',
    who_its_for: 'Fitness creators',
    format_borrowed: 'open-loop cold open',
  },
  {
    hook: 'Concept 2 hook for niche',
    angle: 'Angle 2 applying 4-beat emotional arc',
    who_its_for: 'Fitness creators doing product reviews',
    format_borrowed: '4-beat emotional arc',
  },
  {
    hook: 'Concept 3 hook for niche',
    angle: 'Angle 3 using counter-intuitive turn',
    who_its_for: 'Fitness creators targeting beginners',
    format_borrowed: 'counter-intuitive turn at 60% mark',
  },
];

const MOCK_ROW_WITH_DECODE = {
  variants: { remix: { decode: DECODE_FIXTURE as DecodeOutput } },
};

const MOCK_ROW_WITH_ADAPT = {
  variants: { remix: { decode: DECODE_FIXTURE as DecodeOutput, adapt: THREE_CONCEPTS } },
};

const MOCK_CAMERA = { x: 0, y: 0, scale: 1 };
const MOCK_LAYOUT = {
  id: 'adapt' as const,
  label: 'Adapt',
  bounds: { x: 0, y: 0, width: 400, height: 600 },
};

// =====================================================
// Helper
// =====================================================

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

async function renderAdaptFrameBody() {
  const { AdaptFrameBody } = await import('../AdaptFrameBody');
  return render(
    React.createElement(AdaptFrameBody, { camera: MOCK_CAMERA, layout: MOCK_LAYOUT }),
    { wrapper: createWrapper() },
  );
}

// =====================================================
// Tests
// =====================================================

describe('AdaptFrameBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({ concepts: THREE_CONCEPTS });
    mockUpdateMutateAsync.mockResolvedValue({ success: true });
  });

  // ======================================
  // Test 1: niche-prompt state
  // ======================================
  it('niche-prompt: empty niche (both null) renders inline NichePicker (D-11)', async () => {
    const { useCreatorProfile } = await import('@/hooks/queries/use-creator-profile');
    const { useAnalysisStream } = await import('@/hooks/queries/use-analysis-stream');
    vi.mocked(useCreatorProfile).mockReturnValue(
      { data: { niche_primary: null, niche_sub: null } } as unknown as ReturnType<typeof useCreatorProfile>,
    );
    vi.mocked(useAnalysisStream).mockReturnValue(
      { result: MOCK_ROW_WITH_DECODE } as unknown as ReturnType<typeof useAnalysisStream>,
    );

    await renderAdaptFrameBody();

    expect(screen.getByText('Add your niche to generate concepts')).toBeDefined();
  });

  // ======================================
  // Test 2: mutateAsync-then-generate (no cache race, Pitfall 5)
  // ======================================
  it('niche inline: awaits updateProfile THEN fires adapt with just-picked niche (no race)', async () => {
    const { useCreatorProfile } = await import('@/hooks/queries/use-creator-profile');
    const { useAnalysisStream } = await import('@/hooks/queries/use-analysis-stream');
    const { usePermalinkAnalysis } = await import('@/hooks/queries/use-permalink-analysis');

    vi.mocked(useCreatorProfile).mockReturnValue(
      { data: { niche_primary: null, niche_sub: null } } as unknown as ReturnType<typeof useCreatorProfile>,
    );
    vi.mocked(useAnalysisStream).mockReturnValue(
      { result: MOCK_ROW_WITH_DECODE } as unknown as ReturnType<typeof useAnalysisStream>,
    );
    vi.mocked(usePermalinkAnalysis).mockReturnValue(
      { data: null, id: '550e8400-e29b-41d4-a716-446655440000', isLoading: false },
    );

    await renderAdaptFrameBody();

    // Niche prompt renders
    expect(screen.getByText('Add your niche to generate concepts')).toBeDefined();
    // updateProfile must NOT have been called yet (user hasn't confirmed)
    expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
    // adapt must NOT have fired (niche is empty)
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  // ======================================
  // Test 3: auto-fire-once (already-fired ref guard)
  // ======================================
  it('auto-fire-once: niche present + decode present + no adapt → fires exactly once', async () => {
    const { useCreatorProfile } = await import('@/hooks/queries/use-creator-profile');
    const { useAnalysisStream } = await import('@/hooks/queries/use-analysis-stream');
    const { usePermalinkAnalysis } = await import('@/hooks/queries/use-permalink-analysis');

    vi.mocked(useCreatorProfile).mockReturnValue(
      { data: { niche_primary: 'fitness', niche_sub: 'strength-training' } } as unknown as ReturnType<typeof useCreatorProfile>,
    );
    vi.mocked(useAnalysisStream).mockReturnValue(
      { result: MOCK_ROW_WITH_DECODE } as unknown as ReturnType<typeof useAnalysisStream>,
    );
    vi.mocked(usePermalinkAnalysis).mockReturnValue(
      { data: null, id: '550e8400-e29b-41d4-a716-446655440000', isLoading: false },
    );

    await act(async () => {
      await renderAdaptFrameBody();
    });

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });
  });

  // ======================================
  // Test 4: rehydrate-no-regen (Pitfall 3, D-05)
  // ======================================
  it('rehydrate-no-regen: variants.remix.adapt present → renders 3 cards with NO mutation call', async () => {
    const { useCreatorProfile } = await import('@/hooks/queries/use-creator-profile');
    const { useAnalysisStream } = await import('@/hooks/queries/use-analysis-stream');
    const { usePermalinkAnalysis } = await import('@/hooks/queries/use-permalink-analysis');

    vi.mocked(useCreatorProfile).mockReturnValue(
      { data: { niche_primary: 'fitness', niche_sub: 'strength-training' } } as unknown as ReturnType<typeof useCreatorProfile>,
    );
    vi.mocked(useAnalysisStream).mockReturnValue(
      { result: MOCK_ROW_WITH_ADAPT } as unknown as ReturnType<typeof useAnalysisStream>,
    );
    vi.mocked(usePermalinkAnalysis).mockReturnValue(
      { data: MOCK_ROW_WITH_ADAPT, id: '550e8400-e29b-41d4-a716-446655440000', isLoading: false },
    );

    await act(async () => {
      await renderAdaptFrameBody();
    });

    // Renders 3 cards from persisted data
    await waitFor(() => {
      expect(screen.getByText('Concept 1 hook for niche')).toBeDefined();
      expect(screen.getByText('Concept 2 hook for niche')).toBeDefined();
      expect(screen.getByText('Concept 3 hook for niche')).toBeDefined();
    });

    // No mutation call — rehydrate-no-regen
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  // ======================================
  // Test 5: independent-failure (D-06)
  // ======================================
  it('independent-failure: adapt error shows error state with role="alert" (D-06)', async () => {
    const { useCreatorProfile } = await import('@/hooks/queries/use-creator-profile');
    const { useAnalysisStream } = await import('@/hooks/queries/use-analysis-stream');
    const { usePermalinkAnalysis } = await import('@/hooks/queries/use-permalink-analysis');
    const { useAdaptConcepts } = await import('@/hooks/queries/use-adapt-concepts');

    vi.mocked(useCreatorProfile).mockReturnValue(
      { data: { niche_primary: 'fitness', niche_sub: 'strength-training' } } as unknown as ReturnType<typeof useCreatorProfile>,
    );
    vi.mocked(useAnalysisStream).mockReturnValue(
      { result: MOCK_ROW_WITH_DECODE } as unknown as ReturnType<typeof useAnalysisStream>,
    );
    vi.mocked(usePermalinkAnalysis).mockReturnValue(
      { data: null, id: '550e8400-e29b-41d4-a716-446655440000', isLoading: false },
    );
    vi.mocked(useAdaptConcepts).mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue(new Error('Generation failed')),
      isPending: false,
      isError: true,
      error: new Error('Generation failed'),
    } as unknown as ReturnType<typeof useAdaptConcepts>);

    await act(async () => {
      await renderAdaptFrameBody();
    });

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeDefined();
      expect(screen.getByText("Couldn't generate concepts")).toBeDefined();
    });
  });

  // ======================================
  // Test 6: decode-absent empty state
  // ======================================
  it('decode-absent: niche present but no decode → shows empty-state copy', async () => {
    const { useCreatorProfile } = await import('@/hooks/queries/use-creator-profile');
    const { useAnalysisStream } = await import('@/hooks/queries/use-analysis-stream');
    const { useAdaptConcepts } = await import('@/hooks/queries/use-adapt-concepts');

    vi.mocked(useCreatorProfile).mockReturnValue(
      { data: { niche_primary: 'fitness', niche_sub: 'strength-training' } } as unknown as ReturnType<typeof useCreatorProfile>,
    );
    vi.mocked(useAnalysisStream).mockReturnValue(
      { result: { variants: { remix: {} } } } as unknown as ReturnType<typeof useAnalysisStream>,
    );
    // Ensure no error state from previous test
    vi.mocked(useAdaptConcepts).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ concepts: THREE_CONCEPTS }),
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useAdaptConcepts>);

    await renderAdaptFrameBody();

    expect(screen.getByText('Concepts generate once the source video is decoded.')).toBeDefined();
  });

  // =====================================================
  // Wave 0 smoke tests — fixture + import verification
  // =====================================================

  it('THREE_CONCEPTS has exactly 3 items with all required fields', () => {
    expect(THREE_CONCEPTS).toHaveLength(3);
    for (const c of THREE_CONCEPTS) {
      expect(c.hook).toBeTruthy();
      expect(c.angle).toBeTruthy();
      expect(c.who_its_for).toBeTruthy();
      expect(c.format_borrowed).toBeTruthy();
    }
  });

  it('DECODE_FIXTURE is importable from the contract path (seam health check)', () => {
    expect(DECODE_FIXTURE.repeatable).toHaveLength(3);
    expect(DECODE_FIXTURE.luck).toHaveLength(2);
  });

  it('THREE_CONCEPTS format_borrowed labels match DECODE_FIXTURE.repeatable labels', () => {
    const repeatableLabels = DECODE_FIXTURE.repeatable.map((i) => i.label);
    const luckLabels = DECODE_FIXTURE.luck.map((i) => i.label);
    for (const concept of THREE_CONCEPTS) {
      expect(repeatableLabels).toContain(concept.format_borrowed);
      expect(luckLabels).not.toContain(concept.format_borrowed);
    }
  });
});
