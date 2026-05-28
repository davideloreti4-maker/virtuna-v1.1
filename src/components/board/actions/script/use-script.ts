'use client';
import { useQuery } from '@tanstack/react-query';
import type { ScriptResult } from './script-types';

export function useScript(analysisId: string | null, phase: string) {
  return useQuery<ScriptResult>({
    queryKey: ['script', analysisId],
    queryFn: async () => {
      const res = await fetch(`/api/analyze/${analysisId}/script`);
      if (!res.ok) throw new Error('script_fetch_failed');
      return (await res.json()) as ScriptResult;
    },
    enabled: !!analysisId && phase === 'complete',
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
  });
}
