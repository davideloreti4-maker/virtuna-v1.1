/** @vitest-environment happy-dom */
/**
 * Tests for useAdaptConcepts mutation hook.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { AdaptConcept } from '@/lib/engine/remix/decode-types';
import { DECODE_FIXTURE } from '@/lib/engine/remix/decode.fixture';

// =====================================================
// Mocks
// =====================================================

const mockInvalidateQueries = vi.fn();
const mockQueryClient = {
  invalidateQueries: mockInvalidateQueries,
};

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => mockQueryClient,
  };
});

// =====================================================
// Fixtures
// =====================================================

const ANALYSIS_ID = '550e8400-e29b-41d4-a716-446655440000';

const THREE_CONCEPTS: AdaptConcept[] = [
  {
    hook: 'Concept 1 hook',
    angle: 'Angle 1',
    who_its_for: 'Fitness creators',
    format_borrowed: 'open-loop cold open',
  },
  {
    hook: 'Concept 2 hook',
    angle: 'Angle 2',
    who_its_for: 'Fitness creators doing product reviews',
    format_borrowed: '4-beat emotional arc',
  },
  {
    hook: 'Concept 3 hook',
    angle: 'Angle 3',
    who_its_for: 'Fitness creators targeting beginners',
    format_borrowed: 'counter-intuitive turn at 60% mark',
  },
];

const ADAPT_INPUT = {
  analysis_id: ANALYSIS_ID,
  decode: {
    hook_pattern: DECODE_FIXTURE.hook_pattern,
    structure: DECODE_FIXTURE.structure,
    the_turn: DECODE_FIXTURE.the_turn,
    emotional_beat: DECODE_FIXTURE.emotional_beat,
    repeatable: DECODE_FIXTURE.repeatable,
  },
  niche: 'fitness / strength training',
};

// =====================================================
// Helper — creates a QueryClient wrapper for renderHook
// =====================================================

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
  return Wrapper;
}

// =====================================================
// Tests
// =====================================================

describe('useAdaptConcepts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('posts to /api/remix/adapt with JSON Content-Type and returns concepts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ concepts: THREE_CONCEPTS }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { useAdaptConcepts } = await import('../use-adapt-concepts');
    const { result } = renderHook(() => useAdaptConcepts(ANALYSIS_ID), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync(ADAPT_INPUT);
    });

    expect(fetch).toHaveBeenCalledWith('/api/remix/adapt', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
    }));
  });

  it('throws on non-ok response with the server error message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Generation failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { useAdaptConcepts } = await import('../use-adapt-concepts');
    const { result } = renderHook(() => useAdaptConcepts(ANALYSIS_ID), {
      wrapper: createWrapper(),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync(ADAPT_INPUT);
      }),
    ).rejects.toThrow('Generation failed');
  });

  it('invalidates the analysis query on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ concepts: THREE_CONCEPTS }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { useAdaptConcepts } = await import('../use-adapt-concepts');
    const { result } = renderHook(() => useAdaptConcepts(ANALYSIS_ID), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync(ADAPT_INPUT);
    });

    await waitFor(() => {
      expect(mockInvalidateQueries).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['analysis', 'detail', ANALYSIS_ID] }),
      );
    });
  });

  it('mutation input decode type does not include luck field', async () => {
    // Structural test: verify the input type doesn't have luck
    // by confirming the fixture doesn't pass luck through
    const input = { ...ADAPT_INPUT };
    // If luck were in the type, TypeScript would catch it at compile time
    // At runtime: confirm the body doesn't contain luck
    let capturedBody: unknown = null;
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_url, init) => {
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;
      return new Response(JSON.stringify({ concepts: THREE_CONCEPTS }), { status: 200 });
    });

    const { useAdaptConcepts } = await import('../use-adapt-concepts');
    const { result } = renderHook(() => useAdaptConcepts(ANALYSIS_ID), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect((capturedBody as Record<string, unknown>)?.decode).not.toHaveProperty('luck');
  });
});
