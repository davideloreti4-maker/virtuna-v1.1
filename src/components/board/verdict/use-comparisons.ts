'use client';
import { useQuery } from '@tanstack/react-query';

export interface ComparisonsResponse {
  history: number[];
  niche: null | {
    median: number;
    p75: number;
    count: number;
  };
}

export function useComparisons(analysisId: string | null) {
  return useQuery<ComparisonsResponse>({
    queryKey: ['comparisons', analysisId],
    queryFn: async () => {
      const res = await fetch(`/api/analyze/${analysisId}/comparisons`);
      if (!res.ok) throw new Error('comparisons_fetch_failed');
      return (await res.json()) as ComparisonsResponse;
    },
    enabled: !!analysisId,
    staleTime: 5 * 60 * 1000,
  });
}
