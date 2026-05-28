'use client';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queries/query-keys';

/**
 * Reads the current /analyze/[id] route param and returns the cached analysis
 * row from `GET /api/analysis/[id]`. TanStack Query deduplicates the fetch so
 * multiple consumers (Board, AudienceNode, etc.) share a single network call
 * and the row hydrates every useAnalysisStream instance via its initialData.
 *
 * Without this shared lookup, child nodes that call `useAnalysisStream()`
 * with no initialData start with `result=null` — which surfaces as the
 * "no data loads at all" symptom on permalink loads.
 */
export function usePermalinkAnalysis() {
  const params = useParams();
  const id =
    params && typeof (params as { id?: unknown }).id === 'string'
      ? (params as { id: string }).id
      : null;

  const query = useQuery({
    queryKey: queryKeys.analysis.detail(id ?? ''),
    queryFn: async () => {
      const r = await fetch(`/api/analysis/${id}`);
      if (!r.ok) throw new Error(`Failed to load analysis ${id}`);
      return r.json();
    },
    enabled: !!id,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
  });

  return { id, data: query.data ?? null, isLoading: query.isLoading };
}
