/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useComparisons } from '../use-comparisons';
import React from 'react';

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

describe('useComparisons', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('is disabled when analysisId is null (no fetch call)', () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    const { result } = renderHook(() => useComparisons(null), { wrapper: makeWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches /api/analyze/{id}/comparisons when analysisId is provided', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ history: [70, 75], niche: null }), { status: 200 }));
    const { result } = renderHook(() => useComparisons('abc-123'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchSpy).toHaveBeenCalledWith('/api/analyze/abc-123/comparisons');
    expect(result.current.data).toEqual({ history: [70, 75], niche: null });
  });

  it('throws comparisons_fetch_failed on non-2xx', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 500 }));
    const { result } = renderHook(() => useComparisons('abc-456'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('comparisons_fetch_failed');
  });
});
